import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DistinctEntityDecisionsSection } from "@/components/projects/DistinctEntityDecisionsSection";
import { ToastProvider, useToast } from "@/lib/context/ToastContext";
import { llmHookHarness, jsonResponse } from "../../fixtures/llm-hook-harness";
import type { DistinctDecision } from "@/lib/api/duplicateCheck";

const decision: DistinctDecision = { id: "decision-1", project_id: "distinct-project", iri_a: "https://example.test/First", iri_b: "https://example.test/Second", fingerprint_a: "a", fingerprint_b: "b", reason: "Different meanings", marked_by: "test-reviewer", marked_at: "2026-09-18T12:00:00Z" };
const other = { ...decision, id: "decision-2", iri_a: "https://example.test/Third", reason: "Different purpose" };
function ToastMessages() { return <div>{useToast().toasts.map(t => <p key={t.id}>{t.title}: {t.description}</p>)}</div>; }
function mount(token: string | undefined = "test-token") {
  const harness = llmHookHarness();
  render(<harness.wrapper><ToastProvider><DistinctEntityDecisionsSection projectId="distinct-project" accessToken={token} /><ToastMessages /></ToastProvider></harness.wrapper>);
  return harness.client;
}
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("distinct decisions real API/cache integration", () => {
  it("retries a failed list and displays both authenticated empty states", async () => {
    const request = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Temporarily unavailable" }, 403)).mockImplementation(async () => jsonResponse([]));
    mount();
    await screen.findByText("Temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("No active distinct-entity decisions");
    fireEvent.click(screen.getByRole("button", { name: "Show history" }));
    await screen.findByText("No distinct-entity decisions yet");
    const [url, options] = request.mock.calls[2];
    expect(new URL(String(url)).searchParams.get("include_inactive")).toBe("true");
    expect(new URL(String(url)).searchParams.get("limit")).toBe("50");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("revokes through DELETE and updates both cached history and active lists without losing other decisions", async () => {
    const revoked = { ...decision, revoked_at: "2026-09-18T13:00:00Z", revoked_by: "test-owner" };
    let removed = false;
    const request = vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method === "DELETE") { removed = true; return jsonResponse(revoked); }
      return jsonResponse(removed ? [other] : [decision, other]);
    });
    const client = mount();
    await screen.findByText("Different meanings");
    fireEvent.click(screen.getByRole("button", { name: "Show history" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    const article = (await screen.findByText("Different meanings")).closest("article")!;
    fireEvent.click(within(article).getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke decision" }));
    await screen.findByText("Inactive");
    expect(client.getQueryData(["distinctEntityDecisions", "distinct-project", false])).toEqual([other]);
    expect(client.getQueryData(["distinctEntityDecisions", "distinct-project", true])).toEqual([revoked, other]);
    expect(within(screen.getByText("Different meanings").closest("article")!).queryByRole("button", { name: "Revoke" })).toBeNull();
    expect(request.mock.calls.some(([url, options]) => String(url).endsWith("/distinct-decisions/decision-1") && options?.method === "DELETE")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Active only" }));
    await waitFor(() => expect(screen.queryByText("Different meanings")).toBeNull());
    expect(screen.getByText("Different purpose")).toBeTruthy();
  });

  it("cancels confirmation without a revoke request and retains the active decision", async () => {
    const request = vi.mocked(fetch).mockImplementation(async () => jsonResponse([decision]));
    mount(); await screen.findByText("Different meanings");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("leaves the query disabled without authentication", () => {
    mount("");
    expect(screen.getByText("No active distinct-entity decisions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show history" }));
    expect(screen.getByText("No distinct-entity decisions yet")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps failed revocations open for retry and does not change cached decisions prematurely", async () => {
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      if (options?.method !== "DELETE") return jsonResponse([decision]);
      return ++attempts === 1 ? jsonResponse({ detail: "Role changed" }, 403) : jsonResponse({ ...decision, revoked_at: "2026-09-18T13:00:00Z" });
    });
    const client = mount();
    await screen.findByText("Different meanings");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke decision" }));
    await within(screen.getByRole("dialog")).findByText(/Role changed/);
    expect(client.getQueryData(["distinctEntityDecisions", "distinct-project", false])).toEqual([decision]);
    expect(screen.getByText(/Could not revoke decision: Role changed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revoke decision" }));
    await screen.findByText("No active distinct-entity decisions");
    expect(attempts).toBe(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

});
