import { setTimeout as delay } from "node:timers/promises";
import type { APIRequestContext } from "@playwright/test";
import type { LintRun, LintRunDetail, LintRunListResponse } from "../../lib/api/lint";
import { expect, projectsPath, readSource, type SourceSnapshot } from "./projects";

// Only pending observable state is retried. HTTP failures, malformed envelopes,
// and terminal worker failures escape immediately instead of being retried.
async function pollState<T>(description: string, read: (remaining: number) => Promise<T | undefined>, timeout = 60_000): Promise<T> {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const value = await read(Math.max(1, Math.min(5_000, deadline - performance.now())));
    if (value !== undefined) return value;
    const remaining = deadline - performance.now();
    if (remaining > 0) await delay(Math.min(250, remaining));
  }
  throw new Error(`Timed out waiting for ${description} after ${timeout}ms`);
}

export async function waitForIndex(api: APIRequestContext, id: string, branch: string, revision: string) {
  await pollState("index ready at the saved revision", async timeout => {
    const response = await api.get(`${projectsPath}/${id}/ontology/index-status`, {params: {branch}, timeout});
    if (response.status() === 404) return undefined; // No persisted status until worker starts.
    expect(response.status()).toBe(200);
    const state = await response.json();
    expect(["pending", "indexing", "ready", "failed"]).toContain(state.status);
    if (state.status === "failed") throw new Error("Ontology indexing reached terminal failure");
    return state.status === "ready" && state.commit_hash === revision ? state : undefined;
  });
}

export async function saveLabel(api: APIRequestContext, id: string, before: SourceSnapshot, label: string) {
  const content = before.content.replace('"Test Person"@en', `"${label}"@en`);
  expect(content).not.toBe(before.content);
  const response = await api.put(`${projectsPath}/${id}/source`, {
    params: {branch: before.version},
    data: {content, base_revision: before.revision, commit_message: `Rename Person to ${label}`},
  });
  expect(response.status()).toBe(200);
  const saved = await response.json();
  expect(saved).toMatchObject({success: true, branch: before.version});
  const after = await readSource(api, id, before.version);
  expect(after.content).toBe(content);
  expect(after.revision).toBe(saved.commit_hash);
  expect(after.revision).not.toBe(before.revision);
  return after;
}

export async function createBranch(api: APIRequestContext, id: string, branch: string) {
  const main = await readSource(api, id);
  const response = await api.post(`${projectsPath}/${id}/branches`, {data: {name: branch, from_branch: "main"}});
  expect(response.status()).toBe(201);
  expect(await response.json()).toMatchObject({name: branch, commit_hash: main.revision});
  const source = await readSource(api, id, branch);
  expect(source.revision).toBe(main.revision);
  expect(source.content).toBe(main.content);
  return source;
}

export async function lintRuns(api: APIRequestContext, id: string, timeout = 5_000): Promise<LintRun[]> {
  const response = await api.get(`${projectsPath}/${id}/lint/runs`, {params: {limit: 100}, timeout});
  expect(response.status()).toBe(200);
  const page = await response.json() as LintRunListResponse;
  // These project-owned tests create at most two runs. Never silently omit old IDs.
  expect(page.total).toBe(page.items.length);
  for (const run of page.items) expect(run.project_id).toBe(id);
  return page.items;
}

export async function waitForNewLintRun(api: APIRequestContext, id: string, beforeIds: Set<string>): Promise<LintRunDetail> {
  const completed = await pollState<LintRun>("a new persisted lint run to complete", async timeout => {
    const fresh = (await lintRuns(api, id, timeout)).filter(run => !beforeIds.has(run.id));
    expect(fresh.length, "Only this test's enqueue may create a new run").toBeLessThanOrEqual(1);
    const run = fresh[0];
    if (!run) return undefined;
    expect(["pending", "running", "completed", "failed"]).toContain(run.status);
    if (run.status === "failed") throw new Error("New lint run reached terminal failure");
    return run.status === "completed" ? run : undefined;
  });
  const response = await api.get(`${projectsPath}/${id}/lint/runs/${completed.id}`, {timeout: 5_000});
  expect(response.status()).toBe(200);
  const detail = await response.json() as LintRunDetail;
  expect(detail).toMatchObject({id: completed.id, project_id: id, status: "completed", error_message: null});
  expect(beforeIds.has(detail.id)).toBe(false);
  expect(detail.completed_at).not.toBeNull();
  expect(detail.issues_found).toBe(detail.issues.length);
  return detail;
}
