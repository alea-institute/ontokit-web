import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";

// Transport boundaries only: requests, response decoding, and WebSocket dispatch use production code.
class Socket {
  static instances: Socket[] = [];
  static OPEN = 1; static CONNECTING = 0;
  readyState = 0;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  restart() { this.readyState = 3; this.onerror?.(new Event("error")); this.onclose?.({ code: 1001 } as CloseEvent); }
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
  it("reconciles a lost lint completion while the socket stays open", async () => {
    vi.useFakeTimers();
    render(<HealthCheckPanel {...props} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const ws = Socket.instances.find(s => s.url.includes("/lint/ws"))!;
    await act(async () => ws.open());
    expect(screen.getByText("Missing label")).toBeTruthy();
    act(() => ws.send({ type: "lint_started", project_id: props.projectId }));
    expect(screen.getByRole("button", { name: "Running..." })).toBeTruthy();
    route = url => url.pathname.endsWith("/lint/issues") ? response({ items: [{ ...issue, message: "Recovered periodic lint result" }] }) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText("Recovered periodic lint result")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run Lint" })).toBeTruthy();
  });

  it.each(["lint", "quality"])("reconnects the %s client with auth and recovers missed findings", async kind => {
    const view = render(<HealthCheckPanel {...props} />);
    const first = await socket(kind);
    act(() => first.open());
    await screen.findByText("Missing label");
    if (kind === "quality") {
      fireEvent.click(screen.getByRole("button", { name: "Consistency" }));
      await screen.findByText("No consistency issues");
    }
    vi.useFakeTimers();
    act(() => first.restart());
    route = url => {
      if (kind === "lint" && url.pathname.endsWith("/lint/issues")) return response({ items: [{ ...issue, message: "Recovered lint finding" }] });
      if (kind === "quality" && url.pathname.endsWith("/quality/issues")) return response({ issues: [{ rule_id: "cycle", message: "Recovered quality finding", severity: "warning", entity_iri: "https://example.org/Thing", entity_type: "class" }] });
      return undefined;
    };
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const current = Socket.instances.filter(s => s.url.includes(`/${kind}/ws`)).at(-1)!;
    expect(current).not.toBe(first);
    expect(new URL(current.url).searchParams.get("token")).toBe(props.accessToken);
    await act(async () => current.open());
    expect(screen.getByText(`Recovered ${kind} finding`)).toBeTruthy();
    const calls = request.mock.calls.filter(([url]) => String(url).includes(kind === "lint" ? "/lint/issues" : "/quality/issues"));
    expect(new Headers(calls.at(-1)![1]?.headers).get("Authorization")).toBe(`Bearer ${props.accessToken}`);
    act(() => first.send({ type: kind === "lint" ? "lint_started" : "consistency_started", project_id: props.projectId, branch: "review" }));
    expect(screen.queryByRole("button", { name: kind === "lint" ? "Running..." : "Checking..." })).toBeNull();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(Socket.instances.filter(s => s.url.includes(`/${kind}/ws`))).toHaveLength(2);
  });

  it.each([
    { tab: "Consistency", button: "Run Check", path: "/quality/jobs/job-1", value: { issues: [{ rule_id: "cycle", message: "Recovered completed job", severity: "warning", entity_iri: "https://example.org/Thing", entity_type: "class" }] } },
    { tab: "Duplicates", button: "Find Duplicates", path: "/quality/duplicates/jobs/job-1", value: { clusters: [{ similarity: 0.99, entities: [{ iri: "https://example.org/Thing", label: "Recovered completed job", entity_type: "class" }] }] } },
  ])("recovers a missed $tab terminal event after a connected job starts", async ({ tab, button, path, value }) => {
    render(<HealthCheckPanel {...props} />);
    const ws = await socket("quality"); act(() => ws.open());
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await screen.findByText(tab === "Consistency" ? "No consistency issues" : "No duplicates detected");
    route = url => url.pathname.endsWith(path) ? response(value) : undefined;
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: button })));
    // No terminal socket message: a disconnect after trigger cannot strand the job.
    act(() => ws.restart());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText("Recovered completed job")).toBeTruthy();
    expect((screen.getByRole("button", { name: button }) as HTMLButtonElement).disabled).toBe(false);
    const call = request.mock.calls.find(([url]) => String(url).endsWith(path));
    expect(new Headers(call![1]?.headers).get("Authorization")).toBe(`Bearer ${props.accessToken}`);
  });

  it("replaces both socket credentials and cancels old retries when the token changes", async () => {
    const view = render(<HealthCheckPanel {...props} />);
    await socket("quality");
    const old = [...Socket.instances];
    vi.useFakeTimers();
    act(() => old.forEach(ws => ws.restart()));
    view.rerender(<HealthCheckPanel {...props} accessToken="replacement+token" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(Socket.instances).toHaveLength(4);
    for (const ws of Socket.instances.slice(2)) expect(new URL(ws.url).searchParams.get("token")).toBe("replacement+token");
    view.rerender(<HealthCheckPanel {...props} accessToken={undefined} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(Socket.instances).toHaveLength(4);
    expect(Socket.instances.slice(2).every(ws => ws.close.mock.calls.length === 1)).toBe(true);
  });

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
    vi.useFakeTimers();
    act(() => ws.onerror?.(new Event("error")));
    expect(screen.getByText("Lint WebSocket connection failed")).toBeTruthy();
    act(() => ws.send({ type: "lint_started", project_id: props.projectId }));
    expect(screen.getByRole("button", { name: "Running..." })).toBeTruthy();
    act(() => ws.onclose?.({ code: 1006 } as CloseEvent));
    expect(screen.getByRole("button", { name: "Run Lint" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const replacement = Socket.instances.filter(s => s.url.includes("/lint/ws")).at(-1)!;
    await act(async () => replacement.open());
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByText("Lint WebSocket connection failed")).toBeNull());
    view.unmount();
    expect(replacement.close).toHaveBeenCalledOnce();
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
