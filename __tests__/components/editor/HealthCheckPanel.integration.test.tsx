import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";

// Transport boundaries only: requests, response decoding, and WebSocket dispatch use production code.
class Socket {
  static instances: Socket[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { Socket.instances.push(this); }
  send(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
}
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const props = { projectId: "health-project", accessToken: "health-token", branch: "review", isOpen: true, onClose: vi.fn(), canRunLint: true };
const issue = { id: "i1", rule_id: "missing-label", message: "Missing label", issue_type: "warning", subject_iri: "https://example.org/Thing", subject_type: "class", details: null };
let request: ReturnType<typeof vi.fn>;
let route: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;
beforeEach(() => {
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  route = () => undefined;
  request = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const override = route(url, init);
    if (override) return override;
    if (url.pathname.endsWith("/lint/status")) return response({ last_run: null, total_issues: 1, warning_count: 1, error_count: 0, info_count: 0 });
    if (url.pathname.endsWith("/lint/issues")) return response({ items: [issue] });
    if (url.pathname.endsWith("/lint/config")) return response({ lint_level: 999, effective_rules: ["missing-label"] });
    if (url.pathname.endsWith("/lint/levels")) return response({ levels: [] });
    if (url.pathname.endsWith("/quality/issues")) return response({ issues: [] });
    if (url.pathname.endsWith("/quality/duplicates/latest")) return response({ clusters: [] });
    return response({ job_id: "job-1" });
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function socket(kind: string) {
  await waitFor(() => expect(Socket.instances.some(s => s.url.includes(`/${kind}/ws`))).toBe(true));
  return Socket.instances.find(s => s.url.includes(`/${kind}/ws`))!;
}

describe("health panel real API and socket integration", () => {
  it("decodes config fallback and dismisses an issue through the authenticated API", async () => {
    render(<HealthCheckPanel {...props} />);
    expect(await screen.findByText("Level 999 (1 rules)")).toBeTruthy();
    fireEvent.click(await screen.findByTitle("Dismiss issue"));
    await waitFor(() => expect(screen.queryByText("Missing label")).toBeNull());
    const call = request.mock.calls.find(([url, init]) => String(url).endsWith("/lint/issues/i1") && init.method === "DELETE");
    expect(new Headers(call?.[1].headers).get("Authorization")).toBe("Bearer health-token");
    expect(screen.getByRole("button", { name: "0 Warnings" })).toBeTruthy();
  });

  it("keeps failed dismissals visible and logs the real API failure", async () => {
    const logged = vi.spyOn(console, "error");
    route = (url, init) => url.pathname.endsWith("/i1") && init?.method === "DELETE" ? response({ detail: "Cannot dismiss" }, 403) : undefined;
    render(<HealthCheckPanel {...props} />);
    fireEvent.click(await screen.findByTitle("Dismiss issue"));
    await waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to dismiss issue:", expect.any(Error)));
    expect(screen.getByText("Missing label")).toBeTruthy();
  });

  it("surfaces lint socket errors, recovers on completion, and closes transports", async () => {
    const view = render(<HealthCheckPanel {...props} />);
    const ws = await socket("lint");
    act(() => ws.onerror?.(new Event("error")));
    expect(screen.getByText("Lint WebSocket connection failed")).toBeTruthy();
    act(() => ws.send({ type: "lint_started", project_id: props.projectId }));
    expect(screen.getByRole("button", { name: "Running..." })).toBeTruthy();
    act(() => ws.onclose?.({ code: 1006 } as CloseEvent));
    expect(screen.getByRole("button", { name: "Run Lint" })).toBeTruthy();
    act(() => ws.send({ type: "lint_failed", project_id: props.projectId }));
    await waitFor(() => expect(screen.queryByText("Lint WebSocket connection failed")).toBeNull());
    view.unmount();
    expect(ws.close).toHaveBeenCalledOnce();
    const before = request.mock.calls.length;
    act(() => ws.send({ type: "lint_complete", project_id: props.projectId }));
    expect(request).toHaveBeenCalledTimes(before);
  });

  it("uses default quality failure messages and recovers with branch-scoped results", async () => {
    render(<HealthCheckPanel {...props} />);
    const ws = await socket("quality");
    act(() => ws.onopen?.());
    fireEvent.click(screen.getByRole("button", { name: "Consistency" }));
    await screen.findByText("No consistency issues");
    act(() => ws.send({ type: "consistency_failed", project_id: props.projectId, branch: "review" }));
    expect(screen.getByText("Consistency check failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));
    await waitFor(() => expect(request.mock.calls.some(([url]) => String(url).includes("/quality/check?branch=review"))).toBe(true));
    route = url => url.pathname.endsWith("/quality/issues") ? response({ issues: [{ rule_id: "cycle", message: "Cycle found", severity: "info", entity_iri: "https://example.org/Thing", entity_type: "class" }] }) : undefined;
    act(() => ws.send({ type: "consistency_complete", project_id: props.projectId, branch: "review" }));
    expect(await screen.findByText("Cycle found")).toBeTruthy();
    expect(screen.queryByText("Consistency check failed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Duplicates" }));
    act(() => ws.send({ type: "duplicates_failed", project_id: props.projectId, branch: "review" }));
    expect(screen.getByText("Duplicate detection failed")).toBeTruthy();
  });

  it.each(["error", "close"] as const)("polls authenticated consistency results after the quality socket %s", async (event) => {
    let polls = 0;
    route = url => {
      if (!url.pathname.endsWith("/quality/jobs/job-1")) return undefined;
      polls++;
      return polls === 1 ? response({ status: "pending" }, 202) : response({ issues: [{ rule_id: "cycle", message: "Cycle from polling", severity: "warning", entity_iri: "https://example.org/Thing", entity_type: "class" }] });
    };
    render(<HealthCheckPanel {...props} />);
    const ws = await socket("quality");
    act(() => ws.onopen?.());
    fireEvent.click(screen.getByRole("button", { name: "Consistency" }));
    // Finish the animation-frame cache load before advancing the polling clock.
    await waitFor(() => expect(request.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith("/quality/issues"))).toBe(true));
    await screen.findByText("No consistency issues");
    act(() => event === "error" ? ws.onerror?.(new Event("error")) : ws.onclose?.({ code: 1006 } as CloseEvent));
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run Check" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(polls).toBe(1);
    expect(screen.queryByText("Cycle from polling")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByText("Cycle from polling")).toBeDefined();
    expect((screen.getByRole("button", { name: "Run Check" }) as HTMLButtonElement).disabled).toBe(false);
    const jobCalls = request.mock.calls.filter(([url]) => String(url).includes("/quality/jobs/job-1"));
    expect(jobCalls).toHaveLength(2);
    for (const [, init] of jobCalls) expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer health-token");
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(polls).toBe(2);
    expect(screen.queryByText(/Consistency check timed out/)).toBeNull();
  });

  it("observes schema drift without losing navigation to unknown entity types", async () => {
    const logged = vi.spyOn(console, "error");
    route = url => url.pathname.endsWith("/lint/issues") ? response({ items: [{ ...issue, subject_type: "future-type" }] }) : undefined;
    const navigate = vi.fn();
    render(<HealthCheckPanel {...props} onNavigateToClass={navigate} />);
    fireEvent.click(await screen.findByTitle(issue.subject_iri));
    expect(navigate).toHaveBeenCalledWith(issue.subject_iri, "other");
    expect(logged).toHaveBeenCalledWith("Unknown lint issue subject_type:", "future-type");
  });
});
