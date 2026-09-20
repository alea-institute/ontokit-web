import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";

// Only the HTTP and browser socket boundaries are replaced; API decoding and
// the panel's asynchronous lifecycle run unchanged.
class Socket {
  static instances: Socket[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { Socket.instances.push(this); }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const props = { projectId: "branch-health", accessToken: "test-token", branch: "review", isOpen: true, canRunLint: true, onClose: vi.fn() };
const makeIssue = (type: string) => ({ id: type, rule_id: `rule-${type}`, message: `${type} finding`, issue_type: type, subject_iri: null, subject_type: null, details: null });
const summary = { last_run: { status: "failed", started_at: "2026-09-18T10:00:00Z" }, total_issues: 3, error_count: 1, warning_count: 1, info_count: 1 };
let request: ReturnType<typeof vi.fn>;
let route: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  route = () => undefined;
  request = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const override = route(url, init);
    if (override) return override;
    if (url.pathname.endsWith("/lint/status")) return json(summary);
    if (url.pathname.endsWith("/lint/issues")) return json({ items: ["error", "warning", "info"].filter(type => !url.searchParams.has("issue_type") || url.searchParams.get("issue_type") === type).map(makeIssue) });
    if (url.pathname.endsWith("/lint/config")) return json({ lint_level: null, effective_rules: [] });
    if (url.pathname.endsWith("/lint/levels")) return json({ levels: [] });
    if (url.pathname.endsWith("/quality/issues")) return json({ issues: [] });
    if (url.pathname.endsWith("/quality/duplicates/latest")) return json({ clusters: [] });
    if (init?.method === "DELETE") return json({});
    if (init?.method === "POST") return json({ job_id: "job-1" });
    throw new Error(`Unhandled test request: ${url}`);
  });
  vi.stubGlobal("fetch", request);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function qualitySocket() {
  await waitFor(() => expect(Socket.instances.some(s => s.url.includes("/quality/ws"))).toBe(true));
  return Socket.instances.find(s => s.url.includes("/quality/ws"))!;
}
const qualityCases = [
  { tab: "Consistency", path: "/quality/issues", event: "consistency_complete", empty: "No consistency issues", result: { issues: [{ rule_id: "cycle", severity: "error", message: "Obsolete branch finding", entity_iri: "https://example.org/Old", entity_type: "class" }] } },
  { tab: "Duplicates", path: "/quality/duplicates/latest", event: "duplicates_complete", empty: "No duplicates detected", result: { clusters: [{ similarity: 0.99, entities: [{ iri: "https://example.org/Old", label: "Obsolete branch finding", entity_type: "class" }] }] } },
];

describe("health panel filters and asynchronous branch boundaries", () => {
  it('ignores a delayed lint response after switching projects', async () => {
    const pending = deferred();
    route = url => url.pathname.includes('/branch-health/') && url.pathname.endsWith('/lint/issues') ? pending.promise : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    view.rerender(<HealthCheckPanel {...props} projectId="current-project" />);
    await screen.findByText('error finding');
    await act(async () => pending.resolve(json({ items: [{ ...makeIssue('error'), message: 'Obsolete lint finding' }] })));
    expect(screen.queryByText('Obsolete lint finding')).toBeNull();
    expect(screen.getByText('error finding')).toBeDefined();
  });

  it.each(qualityCases)('reloads the active $tab tab when the branch changes', async ({ tab, path, result, empty }) => {
    route = url => url.pathname.endsWith(path) && url.searchParams.get('branch') === 'review' ? json(result) : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    await screen.findByText('error finding');
    fireEvent.click(screen.getByRole('button', { name: tab }));
    await screen.findByText('Obsolete branch finding');
    view.rerender(<HealthCheckPanel {...props} branch="current" />);
    await waitFor(() => expect(request.mock.calls.some(([url]) => new URL(url).pathname.endsWith(path) && new URL(url).searchParams.get('branch') === 'current')).toBe(true));
    expect(await screen.findByText(empty)).toBeDefined();
  });

  it.each(qualityCases)('ignores old $tab poll results after a branch change', async ({ tab, result }) => {
    const pending = deferred();
    const jobPath = tab === 'Consistency' ? '/quality/jobs/job-1' : '/quality/duplicates/jobs/job-1';
    route = url => url.pathname.endsWith(jobPath) ? pending.promise : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    await qualitySocket();
    fireEvent.click(screen.getByRole('button', { name: tab }));
    await screen.findByText(tab === 'Consistency' ? 'No consistency issues' : 'No duplicates detected');
    vi.useFakeTimers();
    const run = tab === 'Consistency' ? 'Run Check' : 'Find Duplicates';
    await act(async () => fireEvent.click(screen.getByRole('button', { name: run })));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(request.mock.calls.some(([url]) => new URL(url).pathname.endsWith(jobPath))).toBe(true);
    view.rerender(<HealthCheckPanel {...props} branch="current" />);
    route = url => url.pathname.endsWith(jobPath) ? json(tab === 'Consistency' ? { issues: [] } : { clusters: [] }) : undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: run })));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { pending.resolve(json(result)); await vi.advanceTimersByTimeAsync(50); });
    expect(screen.queryByText('Obsolete branch finding')).toBeNull();
    expect((screen.getByRole('button', { name: run }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("navigates duplicate findings with missing labels using their actual entity types", async () => {
    const entities = [
      { iri: "https://example.org#Person", label: "Person class", entity_type: "class" },
      { iri: "https://example.org/hasName", label: "", entity_type: "property" },
      { iri: "https://example.org#Alice", entity_type: "individual" },
    ];
    route = url => url.pathname.endsWith("/quality/duplicates/latest")
      ? json({ clusters: [{ similarity: 0.956, entities }] }) : undefined;
    const navigate = vi.fn();
    render(<HealthCheckPanel {...props} onNavigateToClass={navigate} />);
    await screen.findByText("error finding");
    fireEvent.click(screen.getByRole("button", { name: "Duplicates" }));
    expect(await screen.findByText("96% similar")).toBeDefined();
    for (const [index, label] of [/Person class/, /hasName/, /Alice/].entries()) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(navigate).toHaveBeenNthCalledWith(index + 1, entities[index].iri, entities[index].entity_type);
    }
    expect(navigate).toHaveBeenCalledTimes(3);
    const calls = request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith("/quality/duplicates/latest"));
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0][0]).searchParams.get("branch")).toBe("review");
    expect(new Headers(calls[0][1]?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it.each(["/lint/config", "/lint/levels"])("keeps results usable when the hint request %s fails, then recovers on reopen", async (path) => {
    const logged = vi.spyOn(console, "error");
    route = url => url.pathname.endsWith(path) ? json({ detail: "Hint unavailable" }, 403) : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    await screen.findByText("error finding");
    await waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to fetch lint config hint:", expect.any(Error)));
    expect(screen.queryByText("All rules (0)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1 Warnings" }));
    await waitFor(() => expect(screen.queryByText("error finding")).toBeNull());
    expect(screen.getByText("warning finding")).toBeTruthy();
    view.rerender(<HealthCheckPanel {...props} isOpen={false} />);
    route = () => undefined;
    view.rerender(<HealthCheckPanel {...props} />);
    expect(await screen.findByText("All rules (0)")).toBeTruthy();
    expect(screen.getByText("warning finding")).toBeTruthy();
  });

  it.each([{ type: "error", label: "Errors" }, { type: "warning", label: "Warnings" }, { type: "info", label: "Info" }])("toggles $type filtering through the server and restores all severities", async ({ type, label }) => {
    render(<HealthCheckPanel {...props} />);
    await screen.findByText("error finding");
    fireEvent.click(screen.getByRole("button", { name: `1 ${label}` }));
    await screen.findByText(`${type} finding`);
    await waitFor(() => expect(screen.queryByText(`${type === "error" ? "warning" : "error"} finding`)).toBeNull());
    expect(request.mock.calls.some(([url]) => new URL(url).searchParams.get("issue_type") === type)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: `1 ${label}` }));
    await screen.findByText("error finding");
    await screen.findByText("warning finding");
    await screen.findByText("info finding");
    const issuesCalls = request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith("/lint/issues"));
    expect(new URL(issuesCalls.at(-1)![0]).searchParams.has("issue_type")).toBe(false);
  });

  it.each([{ type: "error", label: "Errors" }, { type: "info", label: "Info" }])("dismisses an $type and changes only its summary count", async ({ type, label }) => {
    route = url => url.pathname.endsWith("/lint/issues") ? json({ items: [makeIssue(type)] }) : undefined;
    render(<HealthCheckPanel {...props} />);
    fireEvent.click(await screen.findByTitle("Dismiss issue"));
    await waitFor(() => expect(screen.queryByText(`${type} finding`)).toBeNull());
    expect(screen.getByRole("button", { name: `0 ${label}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 Warnings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 Total" })).toBeTruthy();
    const call = request.mock.calls.find(([url, init]) => String(url).endsWith(`/lint/issues/${type}`) && init?.method === "DELETE");
    expect(new Headers(call?.[1].headers).get("Authorization")).toBe("Bearer test-token");
  });

  it.each(qualityCases)("discards a delayed $tab cache response after leaving that tab", async ({ tab, path, empty, result }) => {
    const pending = deferred();
    let calls = 0;
    route = url => url.pathname.endsWith(path) && ++calls === 1 ? pending.promise : undefined;
    render(<HealthCheckPanel {...props} />);
    await screen.findByText("error finding");
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await waitFor(() => expect(calls).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Lint" }));
    await act(async () => { pending.resolve(json(result)); });
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await waitFor(() => expect(calls).toBe(2));
    expect(await screen.findByText(empty)).toBeTruthy();
    expect(screen.queryByText("Obsolete branch finding")).toBeNull();
  });

  it.each(qualityCases.flatMap(item => [false, true].map(fails => ({ ...item, fails }))))("discards old-branch $tab completion (failure: $fails) when the branch changes in flight", async ({ tab, path, event, empty, result, fails }) => {
    const view = render(<HealthCheckPanel {...props} />);
    const ws = await qualitySocket();
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await waitFor(() => expect(request.mock.calls.some(([url]) => new URL(url).pathname.endsWith(path))).toBe(true));
    await screen.findByText(empty);
    const pending = deferred();
    route = url => url.pathname.endsWith(path) && url.searchParams.get('branch') === 'review' ? pending.promise : undefined;
    act(() => ws.emit({ type: event, project_id: props.projectId, branch: "review" }));
    await waitFor(() => expect(request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith(path))).toHaveLength(2));
    view.rerender(<HealthCheckPanel {...props} branch="new-branch" />);
    await act(async () => { pending.resolve(fails ? json({ detail: "Obsolete response error" }, 403) : json(result)); });
    expect(screen.queryByText("Obsolete response error")).toBeNull();
    expect(screen.queryByText("Obsolete branch finding")).toBeNull();
    expect(screen.getByText(empty)).toBeTruthy();
    expect(ws.close).toHaveBeenCalledOnce();
  });


  it.each([
    { tab: "Consistency", run: "Run Check", jobPath: "/quality/jobs/job-1", trigger: "/quality/check", status: 202 },
    { tab: "Duplicates", run: "Find Duplicates", jobPath: "/quality/duplicates/jobs/job-1", trigger: "/quality/duplicates", status: 202 },
    { tab: "Consistency", run: "Run Check", jobPath: "/quality/jobs/job-1", trigger: "/quality/check", status: 403 },
    { tab: "Duplicates", run: "Find Duplicates", jobPath: "/quality/duplicates/jobs/job-1", trigger: "/quality/duplicates", status: 403 },
  ])("stops $tab polling after closing while a result request returns $status", async ({ tab, run, jobPath, trigger, status }) => {
    const pending = deferred();
    route = url => url.pathname.endsWith(jobPath) ? pending.promise : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    await qualitySocket(); // Keep the socket disconnected to exercise the HTTP fallback.
    fireEvent.click(screen.getByRole("button", { name: tab }));
    await waitFor(() => expect(request.mock.calls.some(([url]) => new URL(url).pathname.endsWith(tab === "Consistency" ? "/quality/issues" : "/quality/duplicates/latest"))).toBe(true));
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: run })); });
    expect(request.mock.calls.some(([url, init]) => new URL(url).pathname.endsWith(trigger) && init?.method === "POST")).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith(jobPath))).toHaveLength(1);
    view.unmount();
    await act(async () => {
      pending.resolve(status === 202 ? json({ status: "pending" }, 202) : json({ detail: "Obsolete job denied" }, 403));
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(request.mock.calls.filter(([url]) => new URL(url).pathname.endsWith(jobPath))).toHaveLength(1);
    expect(Socket.instances.every(socket => socket.close.mock.calls.length === 1)).toBe(true);
  });

  it("ignores a delayed configuration hint after switching projects", async () => {
    const pending = deferred();
    route = url => url.pathname.endsWith("/lint/config") && url.pathname.includes("branch-health") ? pending.promise : undefined;
    const view = render(<HealthCheckPanel {...props} />);
    await screen.findByText("error finding");
    view.rerender(<HealthCheckPanel {...props} projectId="new-project" />);
    await screen.findByText("All rules (0)");
    await act(async () => { pending.resolve(json({ lint_level: 99, effective_rules: ["old-rule"] })); });
    expect(screen.queryByText("Level 99 (1 rules)")).toBeNull();
    expect(screen.getByRole("link", { name: "configure" }).getAttribute("href")).toBe("/projects/new-project/settings#lint-config");
  });
});
