import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "@/components/editor/ShareButton";
import { ToastProvider } from "@/lib/context/ToastContext";
import { ToastContainer } from "@/components/ui/toast-container";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup(); vi.clearAllTimers(); vi.useRealTimers();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});
function mount(iri: string | null = "https://example.test/ontology#Person & Place") {
  render(<ToastProvider><ShareButton projectId="sharing" selectedIri={iri} /><ToastContainer /></ToastProvider>);
}

describe("share links through the real toast provider and clipboard boundary", () => {
  it("keeps the menu open for inside clicks and non-dismissal keys, then closes on Escape", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    fireEvent.mouseDown(screen.getByRole("menu"));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menu")).toBeDefined();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each([false, true])("copies a selected namespace IRI without a local-name label (dropdown: %s)", async dropdown => {
    const iri = "https://example.test/ontology#";
    mount(iri);
    if (dropdown) fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    await act(async () => fireEvent.click(screen.getByRole(dropdown ? "menuitem" : "button", { name: /^Copy link to/ })));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/projects/sharing?classIri=${encodeURIComponent(iri)}`);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("copies the dropdown entity link with encoded IRI and dismisses its success toast", async () => {
    const iri = "https://example.test/ontology#Person & Place";
    mount(iri);
    fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: /Copy link to/ })));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/projects/sharing?classIri=${encodeURIComponent(iri)}`);
    expect(screen.getByRole("alert").textContent).toContain('Copied link to "Person & Place"');
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows clipboard refusal, closes the menu and allows a project-link retry", async () => {
    writeText.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: /Copy link to/ })));
    expect(screen.getByRole("alert").textContent).toContain("Failed to copy link");
    expect(screen.queryByRole("menu")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    fireEvent.click(screen.getByRole("button", { name: "More share options" }));
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Copy project link" })));
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/projects/sharing`);
    expect(screen.getByRole("alert").textContent).toContain("Copied project link");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("copies the project URL directly when no entity is selected", async () => {
    mount(null);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy project link" })));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/projects/sharing`);
    expect(screen.getByRole("alert").textContent).toContain("Copied project link");
    expect(screen.queryByRole("button", { name: "More share options" })).toBeNull();
  });
});
