import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserSearchInput } from "@/components/projects/user-search-input";

const users = [
  { id: "coverage-a", username: "sample-a", display_name: "Sample A", email: "sample-a@example.test" },
  { id: "coverage-b", username: "sample-b" },
];
const fetchBoundary = vi.fn<typeof fetch>();
const response = (items = users) => new Response(JSON.stringify({ items, total: items.length }), { headers: { "Content-Type": "application/json" } });

function Harness({ disabled = false, token = 'coverage-token' }: { disabled?: boolean; token?: string }) {
  const [selected, setSelected] = useState("");
  return <><output>{selected || "none"}</output><UserSearchInput value={selected} onSelect={setSelected} onClear={() => setSelected("")} token={token} disabled={disabled} /></>;
}
const input = () => screen.getByRole("textbox") as HTMLInputElement;
async function search(query = "sample") {
  fireEvent.change(input(), { target: { value: query } });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

describe("UserSearchInput through the real user settings API and client", () => {
  it.each(['credentials', 'disabled'])('rejects pending results when %s change', async change => {
    let finish!: (value: Response) => void;
    fetchBoundary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<Harness />);
    await search();
    view.rerender(change === 'credentials' ? <Harness token="new-token" /> : <Harness disabled />);
    await act(async () => finish(response()));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(view.container.querySelector('.animate-spin')).toBeNull();
    view.rerender(<Harness token="new-token" />);
    await search('fresh');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('does not search after clearing during the debounce', async () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'sample' } });
    fireEvent.click(screen.getByRole('button'));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchBoundary).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it.each(['clear', 'new query'])('ignores an in-flight response after %s', async action => {
    let finish!: (value: Response) => void;
    fetchBoundary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<Harness />);
    await search('sample');
    if (action === 'clear') fireEvent.click(screen.getByRole('button'));
    else fireEvent.change(input(), { target: { value: 'different' } });
    await act(async () => finish(response()));
    expect(screen.queryByRole('option')).toBeNull();
    if (action === 'new query') {
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(screen.getAllByRole('option')).toHaveLength(2);
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    fetchBoundary.mockReset().mockImplementation(async () => response());
    vi.stubGlobal("fetch", fetchBoundary);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("debounces edits, encodes the query and authenticates the actual HTTP request", async () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "sa" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    fireEvent.change(input(), { target: { value: "sample & alias" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(fetchBoundary).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    const [url, init] = fetchBoundary.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/api/v1/users/search");
    expect(new URL(String(url)).searchParams.get("q")).toBe("sample & alias");
    expect(new URL(String(url)).searchParams.get("limit")).toBe("10");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer coverage-token");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("clamps keyboard navigation and selects a username fallback into parent state", async () => {
    render(<Harness />);
    await search();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("none");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(screen.getAllByRole("option").every(option => option.getAttribute("aria-selected") === "false")).toBe(true);
    for (let i = 0; i < 3; i++) fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("false");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(input().value).toBe("sample-b");
    expect(screen.getByRole("status").textContent).toBe("coverage-b");
    expect(screen.getByText("sample-b")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("selects by hover and keyboard, shows the email badge, and clears selection when edited", async () => {
    render(<Harness />);
    await search();
    fireEvent.mouseEnter(screen.getAllByRole("option")[0]);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("coverage-a");
    expect(screen.getByText("(sample-a@example.test)")).toBeTruthy();
    fireEvent.change(input(), { target: { value: "b" } });
    expect(screen.getByRole("status").textContent).toBe("none");
    expect(screen.queryByText("(sample-a@example.test)")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("clears a mouse selection and restores focus to the empty input", async () => {
    render(<Harness />);
    await search();
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    expect(screen.getByRole("status").textContent).toBe("coverage-a");
    fireEvent.click(screen.getByRole("button"));
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
    expect(screen.getByRole("status").textContent).toBe("none");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("dismisses outside clicks, retains inside clicks, and reopens cached results on focus", async () => {
    render(<Harness />);
    await search();
    fireEvent.mouseDown(input());
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.focus(input());
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.keyDown(input(), { key: "Tab" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
  });

  it.each(["empty", "forbidden", "network"])("removes old results after a %s response and recovers on the next query", async (failure) => {
    render(<Harness />);
    await search();
    if (failure === "empty") fetchBoundary.mockResolvedValueOnce(response([]));
    if (failure === "forbidden") fetchBoundary.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Denied" }), { status: 403 }));
    if (failure === "network") fetchBoundary.mockRejectedValueOnce(new TypeError("Offline fixture"));
    await search("different");
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.focus(input());
    expect(screen.queryByRole("option")).toBeNull();
    await search("recovered");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(fetchBoundary).toHaveBeenCalledTimes(3);
  });

  it("closes existing results when the query shrinks below the search threshold", async () => {
    render(<Harness />);
    await search();
    await search("s");
    expect(screen.queryByRole("option")).toBeNull();
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
  });

  it("shows loading while the real client waits for a response and removes it on completion", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchBoundary.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveResponse = resolve; }));
    const { container } = render(<Harness />);
    await search();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    await act(async () => { resolveResponse(response()); });
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("recovers transparently when the actual GET client retries a temporary server failure", async () => {
    fetchBoundary.mockResolvedValueOnce(new Response("Temporarily unavailable", { status: 503 }));
    const { container } = render(<Harness />);
    await search();
    expect(fetchBoundary).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchBoundary).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("does not send a debounced request after unmount", async () => {
    const view = render(<Harness />);
    fireEvent.change(input(), { target: { value: "sample" } });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchBoundary).not.toHaveBeenCalled();
  });

  it("disables clearing an existing selection when its parent disables the field", async () => {
    const view = render(<Harness />);
    await search();
    fireEvent.mouseDown(screen.getAllByRole("option")[0]);
    view.rerender(<Harness disabled />);
    expect(input().disabled).toBe(true);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("status").textContent).toBe("coverage-a");
  });
});
