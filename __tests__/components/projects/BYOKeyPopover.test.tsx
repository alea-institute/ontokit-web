import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BYOKeyPopover } from "@/components/projects/BYOKeyPopover";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

const savedState = () => JSON.parse(sessionStorage.getItem("ontokit-byo-keys")!).state;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mount(overrides: Partial<React.ComponentProps<typeof BYOKeyPopover>> = {}) {
  const props = {
    projectId: "project-one", provider: "openai", accessToken: "test-session-token",
    anchorRef: { current: null }, onClose: vi.fn(), onKeySaved: vi.fn(), ...overrides,
  };
  return { ...render(<BYOKeyPopover {...props} />), props };
}

beforeEach(() => {
  useByoKeyStore.setState({ ownerId: null, entries: {} });
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("BYOKeyPopover with real API client and session store", () => {
  it("focuses a masked, non-autocompleting input and links to project AI settings", () => {
    mount();
    const input = screen.getByLabelText("API key");
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("type")).toBe("password");
    expect(input.getAttribute("autoComplete")).toBe("off");
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("settings?tab=ai");
    expect((screen.getByRole("button", { name: "Use Key" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects empty and whitespace-only Enter submission without transport or persistence", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { props } = mount();
    fireEvent.keyDown(screen.getByLabelText("API key"), { key: "Enter" });
    await userEvent.type(screen.getByLabelText("API key"), "   {Enter}");
    expect(fetch).not.toHaveBeenCalled();
    expect(props.onKeySaved).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("ontokit-byo-keys")).toBeNull();
    expect((screen.getByRole("button", { name: "Use Key" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("validates the trimmed key through the real client then persists a validated project entry", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ success: true }));
    vi.stubGlobal("fetch", fetch);
    useByoKeyStore.getState().setOwner("account-one");
    useByoKeyStore.getState().setKey("other-project", "anthropic", "fixture-other-key");
    const onKeySaved = vi.fn(() => {
      expect(savedState().entries["project-one"].validatedAt).toEqual(expect.any(String));
    });
    const { props } = mount({ onKeySaved });
    await userEvent.type(screen.getByLabelText("API key"), "  fixture-new-key  ");
    await userEvent.click(screen.getByRole("button", { name: "Use Key" }));
    await waitFor(() => expect(onKeySaved).toHaveBeenCalledOnce());
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/v1/projects/project-one/llm/test-connection");
    expect(options.method).toBe("POST");
    expect(options.headers.get("Authorization")).toBe("Bearer test-session-token");
    expect(options.headers.get("X-BYO-API-Key")).toBe("fixture-new-key");
    expect(options.body).toBeUndefined();
    expect(savedState()).toMatchObject({ ownerId: "account-one", entries: {
      "project-one": { provider: "openai", key: "fixture-new-key", validatedAt: expect.any(String) },
      "other-project": { key: "fixture-other-key", validatedAt: null },
    } });
    expect(Number.isNaN(Date.parse(useByoKeyStore.getState().getEntry("project-one")!.validatedAt!))).toBe(false);
    expect(localStorage.getItem("ontokit-byo-keys")).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("submits with Enter without an access token and records the chosen provider", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ success: true }));
    vi.stubGlobal("fetch", fetch);
    const { props } = mount({ accessToken: undefined, provider: "anthropic" });
    await userEvent.type(screen.getByLabelText("API key"), "fixture-key{Enter}");
    await waitFor(() => expect(props.onKeySaved).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer");
    expect(useByoKeyStore.getState().getEntry("project-one")?.provider).toBe("anthropic");
  });

  it("does not persist while validation is pending and disables repeated button submission", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const { props } = mount();
    await userEvent.type(screen.getByLabelText("API key"), "fixture-key");
    await userEvent.click(screen.getByRole("button", { name: "Use Key" }));
    const button = screen.getByRole("button", { name: "Validating..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(fetch).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("ontokit-byo-keys")).toBeNull();
    expect(props.onKeySaved).not.toHaveBeenCalled();
    await act(async () => resolve(response({ success: true })));
    expect(props.onKeySaved).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Use Key" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    [{ success: false, error: "Provider denied access" }, "Provider denied access"],
    [{ success: false }, "This API key was rejected. Check that it's correct and has the right permissions."],
  ])("reports rejected validation without replacing an existing key: %j", async (body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
    useByoKeyStore.getState().setKey("project-one", "openai", "fixture-existing-key");
    useByoKeyStore.getState().markValidated("project-one");
    const before = sessionStorage.getItem("ontokit-byo-keys");
    const { props } = mount();
    await userEvent.type(screen.getByLabelText("API key"), "fixture-rejected-key");
    await userEvent.click(screen.getByRole("button", { name: "Use Key" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(sessionStorage.getItem("ontokit-byo-keys")).toBe(before);
    expect(props.onKeySaved).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Use Key" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(["network", "http", "malformed", "empty"])("handles %s failure and allows a successful corrected retry", async (failure) => {
    const fetch = vi.fn();
    if (failure === "network") fetch.mockRejectedValueOnce(new TypeError("Offline"));
    else if (failure === "http") fetch.mockResolvedValueOnce(response({ detail: "Unavailable" }, 503));
    else if (failure === "malformed") fetch.mockResolvedValueOnce(new Response("not-json"));
    else fetch.mockResolvedValueOnce(new Response(""));
    fetch.mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal("fetch", fetch);
    const { props } = mount();
    await userEvent.type(screen.getByLabelText("API key"), "fixture-key");
    await userEvent.click(screen.getByRole("button", { name: "Use Key" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not validate key. Check your connection and try again.");
    expect(fetch).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("ontokit-byo-keys")).toBeNull();
    await userEvent.clear(screen.getByLabelText("API key"));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.type(screen.getByLabelText("API key"), "fixture-corrected-key{Enter}");
    await waitFor(() => expect(props.onKeySaved).toHaveBeenCalledOnce());
    expect(useByoKeyStore.getState().getKey("project-one")).toBe("fixture-corrected-key");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("closes and reopens through a real parent, discarding unsaved input without touching stored keys", async () => {
    useByoKeyStore.getState().setKey("other-project", "openai", "fixture-preserved-key");
    const before = sessionStorage.getItem("ontokit-byo-keys");
    function Parent() {
      const [open, setOpen] = useState(true);
      return open ? <BYOKeyPopover projectId="project-one" provider="openai" anchorRef={{ current: null }} onClose={() => setOpen(false)} onKeySaved={() => setOpen(false)} />
        : <button onClick={() => setOpen(true)}>Open key entry</button>;
    }
    render(<Parent />);
    await userEvent.type(screen.getByLabelText("API key"), "fixture-unsaved-key");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open key entry" }));
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Close popover" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sessionStorage.getItem("ontokit-byo-keys")).toBe(before);
  });

  it("ignores inside clicks and non-Escape keys but closes on outside mousedown", () => {
    vi.useFakeTimers();
    const { props } = mount();
    fireEvent.mouseDown(document.body);
    expect(props.onClose).not.toHaveBeenCalled();
    act(() => vi.runOnlyPendingTimers());
    fireEvent.mouseDown(screen.getByLabelText("API key"));
    fireEvent.keyDown(document, { key: "a" });
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it.each([false, true])("cleans up document handlers on unmount, timer fired=%s", (fireTimer) => {
    vi.useFakeTimers();
    const { unmount, props } = mount();
    if (fireTimer) act(() => vi.runOnlyPendingTimers());
    unmount();
    act(() => vi.runOnlyPendingTimers());
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.body);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
