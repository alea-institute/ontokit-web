import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TurtleOutputPicker } from "@/components/projects/turtle-output-picker";

const response = (items: { path: string; size: number }[]) => new Response(JSON.stringify({ items }), {
  headers: { "Content-Type": "application/json" },
});
function pending() {
  let resolve!: (value: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => vi.unstubAllGlobals());

describe("Turtle output selection through project API", () => {
  it("filters case-insensitively and scans with repository query and auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{ path: "schemas/ONTOLOGY.TTL", size: 1 }, { path: "readme.txt", size: 50 }]));
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();
    render(<TurtleOutputPicker owner="team name" repo="ontology" token="test-token" onSelect={onSelect} />);
    await screen.findByText("schemas/ONTOLOGY.TTL");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("schemas/ONTOLOGY.TTL");
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/v1/projects/github/scan-files");
    expect(new URL(url).searchParams.get("owner")).toBe("team name");
    expect(new URL(url).searchParams.get("repo")).toBe("ontology");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    expect(screen.queryByText("readme.txt")).toBeNull();
  });

  it("switches existing/new modes, clears local confirmation and confirms a trimmed uppercase path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
      { path: "tiny.ttl", size: 1 }, { path: "medium.ttl", size: 1024 }, { path: "large.ttl", size: 1048576 },
    ])));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TurtleOutputPicker owner="owner" repo="repo" token="test-token" onSelect={onSelect} />);
    await screen.findByText("1.0 MB");
    expect(screen.getByText("1.0 KB")).toBeDefined();
    expect(screen.getByText("1 B")).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /medium.ttl/ }));
    expect(onSelect).toHaveBeenLastCalledWith("medium.ttl");
    expect(screen.getByText(/Output path:/)).toBeDefined();
    await user.click(screen.getAllByRole("radio")[1]);
    expect(screen.queryByText(/Output path:/)).toBeNull();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Confirm" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Path must end with .ttl")).toBeNull();
    fireEvent.change(input, { target: { value: " exports/New.TTL  " } });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSelect).toHaveBeenLastCalledWith("exports/New.TTL");
    expect(screen.getByText("exports/New.TTL")).toBeDefined();
    fireEvent.change(input, { target: { value: "another.ttl" } });
    expect(screen.queryByText(/Output path:/)).toBeNull();
    await user.click(screen.getAllByRole("radio")[0]);
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: /tiny.ttl/ }));
    expect(onSelect.mock.calls.map(([path]) => path)).toEqual(["medium.ttl", "exports/New.TTL", "tiny.ttl"]);
  });

  it.each(["resolve", "reject"] as const)("ignores an old repository scan that later %ss", async (settlement) => {
    const old = pending();
    const current = pending();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise));
    const onSelect = vi.fn();
    const { rerender } = render(<TurtleOutputPicker owner="owner" repo="old" token="t" onSelect={onSelect} />);
    rerender(<TurtleOutputPicker owner="owner" repo="current" token="t" onSelect={onSelect} />);
    await act(async () => { current.resolve(response([{ path: "current.ttl", size: 1 }])); });
    await screen.findByText("current.ttl");
    await act(async () => {
      if (settlement === "resolve") old.resolve(response([{ path: "old.ttl", size: 1 }]));
      else old.reject(new Error("obsolete error"));
    });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("current.ttl");
    expect(screen.queryByText("old.ttl")).toBeNull();
    expect(screen.queryByText("obsolete error")).toBeNull();
    expect(screen.getByText("current.ttl")).toBeDefined();
  });

  it("does not notify the parent after unmounting during a scan", async () => {
    const request = pending();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(request.promise));
    const onSelect = vi.fn();
    const { unmount } = render(<TurtleOutputPicker owner="owner" repo="repo" token="t" onSelect={onSelect} />);
    unmount();
    await act(async () => { request.resolve(response([{ path: "late.ttl", size: 1 }])); });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("recovers from a network failure on repository change and permits explicit confirmation for an empty repository", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline scan")).mockResolvedValueOnce(response([])));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<TurtleOutputPicker owner="owner" repo="offline" token="t" onSelect={onSelect} />);
    await screen.findByText("offline scan");
    rerender(<TurtleOutputPicker owner="owner" repo="empty" token="t" onSelect={onSelect} />);
    await screen.findByRole("textbox");
    expect(screen.queryByText("offline scan")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("ontology.ttl");
  });
});
