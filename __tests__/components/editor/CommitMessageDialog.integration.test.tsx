import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitMessageDialog } from "@/components/editor/CommitMessageDialog";
import { projectOntologyApi } from "@/lib/api/client";

function SaveWorkflow() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState("");
  return <>
    <button onClick={() => setOpen(true)}>Reopen save</button>
    <output>{saved}</output>
    <CommitMessageDialog open={open} onOpenChange={setOpen} defaultMessage="Edit labels"
      onConfirm={async (message) => {
        await projectOntologyApi.saveSource("project", "<urn:Cat> a <urn:Class> .", message, "test-token", "draft", "base123");
        setSaved(message);
      }} />
  </>;
}

function input() { return screen.getByRole("textbox") as HTMLInputElement; }
function submit() { return screen.getByRole("button", { name: "Save & Commit" }) as HTMLButtonElement; }

afterEach(() => vi.unstubAllGlobals());

describe("CommitMessageDialog workflow", () => {
  it('keeps a pending commit locked when the suggested message changes', async () => {
    let finish!: () => void;
    const confirm = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const close = vi.fn();
    const view = render(<CommitMessageDialog open onOpenChange={close} onConfirm={confirm} defaultMessage="Original" />);
    await userEvent.click(submit());
    view.rerender(<CommitMessageDialog open onOpenChange={close} onConfirm={confirm} defaultMessage="New suggestion" />);
    expect(input().disabled).toBe(true);
    expect(input().value).toBe('Original');
    await act(async () => finish());
    expect(confirm).toHaveBeenCalledExactlyOnceWith('Original');
  });

  it('shows the readable server detail for a rejected commit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Revision conflict; reload before saving' }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    render(<SaveWorkflow />);
    await userEvent.click(submit());
    expect(await screen.findByText('Revision conflict; reload before saving')).toBeDefined();
    expect(input().value).toBe('Edit labels');
  });

  it("trims a keyboard commit, sends source and revision through the API client, and closes", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: "next123" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    render(<SaveWorkflow />);
    fireEvent.change(input(), { target: { value: "  Rename cat  " } });
    fireEvent.keyDown(input(), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("Rename cat");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain("/api/v1/projects/project/source?branch=draft");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ content: "<urn:Cat> a <urn:Class> .", commit_message: "Rename cat", base_revision: "base123" });
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("preserves a failed message for a successful retry through the real API client", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("Save unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: "next" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    render(<SaveWorkflow />);
    fireEvent.change(input(), { target: { value: "Keep my edits" } });
    await userEvent.click(submit());
    expect(await screen.findByText("Save unavailable")).toBeDefined();
    expect(input().value).toBe("Keep my edits");
    expect(input().disabled).toBe(false);
    await userEvent.click(submit());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toBe("Keep my edits");
  });

  it("blocks edits and cancel until a pending confirmation completes", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const onOpenChange = vi.fn();
    render(<CommitMessageDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    await userEvent.click(submit());
    expect(input().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement).disabled).toBe(true);
    const cancel = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    await userEvent.click(cancel);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(input().disabled).toBe(false);
  });

  it("shows a fallback for a non-Error rejection and allows retry", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce("offline").mockResolvedValueOnce(undefined);
    const close = vi.fn();
    render(<CommitMessageDialog open onOpenChange={close} onConfirm={onConfirm} />);
    await userEvent.click(submit());
    expect(await screen.findByText("Failed to save")).toBeDefined();
    await userEvent.click(submit());
    expect(close).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Failed to save")).toBeNull();
  });

  it("validates whitespace when Enter bypasses the disabled submit button", async () => {
    const confirm = vi.fn();
    render(<CommitMessageDialog open onOpenChange={() => {}} onConfirm={confirm} defaultMessage="  " />);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(await screen.findByText("Commit message is required")).toBeDefined();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("leaves Shift+Enter and other keys to the input without submitting", () => {
    const confirm = vi.fn();
    render(<CommitMessageDialog open onOpenChange={() => {}} onConfirm={confirm} />);
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input(), { key: "ArrowLeft" });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("resets a failed edit when a controlled parent closes and reopens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    render(<SaveWorkflow />);
    fireEvent.change(input(), { target: { value: "Unfinished message" } });
    await userEvent.click(submit());
    expect(await screen.findByText(/Offline/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reopen save" }));
    expect(input().value).toBe("Edit labels");
    expect(screen.queryByText(/Offline/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });
});
