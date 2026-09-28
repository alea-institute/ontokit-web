// D10: genuine OIDC personas and HTTP membership setup for the suggestions profile.
// All credentials stay in the private run directory; only fixed probe labels enter receipts.
import { test as base, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { SUGGESTION_CASES } from "../../scripts/e2e/evidence.mjs";
import { loadSession, saveAuthenticatedPersona } from "./auth";
import { loadSuggestionsRun, type SuggestionPersona, type SuggestionsRunConfig } from "./run";

const PERSONAS: SuggestionPersona[] = ["owner", "suggester", "editor", "unrelated"];
const apiPersonas = new WeakMap<APIRequestContext, SuggestionPersona>();
interface SuggestionFixtures {
  run: SuggestionsRunConfig;
  ownerApi: APIRequestContext;
  suggesterApi: APIRequestContext;
  editorApi: APIRequestContext;
  unrelatedApi: APIRequestContext;
}
interface SuggestionWorkers { suggestionsRun: SuggestionsRunConfig }
function personaApi(persona: SuggestionPersona) {
  return async ({playwright, run}: {playwright: PlaywrightWorkerArgs["playwright"]; run: SuggestionsRunConfig}, provide: (api: APIRequestContext) => Promise<void>) => {
    const session = await loadSession(run, persona);
    const api = await playwright.request.newContext({baseURL: run.api, extraHTTPHeaders: {Authorization: `Bearer ${session.accessToken}`}});
    apiPersonas.set(api, persona);
    try { await provide(api); } finally { apiPersonas.delete(api); await api.dispose(); }
  };
}
export const test = base.extend<SuggestionFixtures, SuggestionWorkers>({
  // A worker fixture avoids adding setup cases to the seven-case inventory.
  suggestionsRun: [async ({browser}, provide) => {
    const run = loadSuggestionsRun();
    const authDir = path.join(run.dir, "auth");
    await fs.mkdir(authDir, {mode: 0o700});
    try {
      for (const persona of PERSONAS) await saveAuthenticatedPersona(browser, run, persona);
      await provide(run);
    } finally {
      await fs.rm(authDir, {recursive: true, force: true});
    }
  }, {scope: "worker", timeout: 360_000}],
  run: async ({suggestionsRun}, provide) => { await provide(suggestionsRun); },
  ownerApi: personaApi("owner"),
  suggesterApi: personaApi("suggester"),
  editorApi: personaApi("editor"),
  unrelatedApi: personaApi("unrelated"),
});

/** The spec creates run-tagged projects as owner, then adds roles through the product API. */
export async function addSuggestionMembers(ownerApi: APIRequestContext, run: SuggestionsRunConfig, projectId: string) {
  if (apiPersonas.get(ownerApi) !== "owner") throw new Error("Membership setup requires the owner API fixture");
  for (const role of ["suggester", "editor"] as const) {
    const response = await ownerApi.post(`/api/v1/projects/${projectId}/members`, {data: {user_id: run.users[role].id, role}});
    expect(response.status(), `add ${role} membership`).toBe(201);
    const member = await response.json() as {user_id: string; role: string};
    expect(member.user_id).toBe(run.users[role].id);
    expect(member.role).toBe(role);
  }
}

function probeFor(name: string) {
  const probe = SUGGESTION_CASES.find(c => c.profile === "suggestions" && c.title === base.info().title)?.probes.find(p => p.probe === name);
  if (!probe) throw new Error("Probe is not in the suggestions inventory for this case");
  return probe;
}
type ObservedProbe = {tier: string; method: string; path: string; status: number; authorization: boolean};
/** Only allowlisted endpoint templates and observed tier/status enter annotations. */
export function recordProbe(name: string, observed: ObservedProbe) {
  const spec = probeFor(name);
  for (const field of ["tier", "method", "path", "status", "authorization"] as const) {
    expect(observed[field], `${name}: ${field}`).toBe(spec[field]);
  }
  const entry = {probe: spec.probe, tier: observed.tier, method: observed.method, path: observed.path, status: observed.status, authorization: observed.authorization};
  base.info().annotations.push({type: "mode-evidence", description: JSON.stringify(entry)});
  console.log(`mode-evidence ${JSON.stringify(entry)}`);
}
/** Uses the case's fixed method/path and a genuinely authenticated persona context. */
export async function directProbe(api: APIRequestContext, name: string, {projectId, sessionId, data}: {
  projectId: string; sessionId?: string; data?: unknown;
}): Promise<ObservedProbe & {json: () => Promise<unknown>}> {
  if (!apiPersonas.has(api)) throw new Error("Suggestion probes require an authenticated persona API fixture");
  const spec = probeFor(name);
  if (spec.path.includes("{sid}") && !sessionId) throw new Error("Suggestion probe requires a session ID");
  const endpoint = spec.path.replace("{id}", encodeURIComponent(projectId)).replace("{sid}", encodeURIComponent(sessionId ?? ""));
  const response = await api.fetch(endpoint, {method: spec.method, ...(data === undefined ? {} : {data}), maxRedirects: 0});
  return {tier: "api", method: spec.method, path: spec.path, status: response.status(), authorization: true, json: () => response.json()};
}
export { expect };

/** Shared UI path for authenticated suggestions and optional-mode proposals. */
export async function saveExistingLabel(page: Page, apiOrigin: string, projectId: string, label: string, anonymous = false) {
  const prefix = `/api/v1/projects/${projectId}/suggestions/${anonymous ? "anonymous/" : ""}sessions/`;
  const input = page.getByPlaceholder("Label text", {exact: true});
  await expect(input).toHaveCount(1);
  await input.fill(label);
  await input.press("Tab"); // Persist the draft on blur before the explicit Git save.
  const save = page.getByRole("status").getByRole("button", {name: "Save", exact: true});
  await expect(save).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).origin === apiOrigin && new URL(r.url()).pathname.startsWith(prefix)
      && new URL(r.url()).pathname.endsWith("/save") && r.request().method() === "PUT"),
    save.click(),
  ]);
  expect(response.status()).toBe(200);
  const result = await response.json() as {branch: string; changes_count: number};
  expect(result.changes_count).toBeGreaterThan(0);
  await expect(page.getByRole("status").filter({hasText: /^Saved/})).toBeVisible();
  return {sessionId: new URL(response.url()).pathname.slice(prefix.length, -"/save".length), branch: result.branch};
}

/** Each project has one submission, identified by its unique edited label. */
export async function openTriage(page: Page, web: string, projectId: string, label: string) {
  await page.goto(`${web}/projects/${projectId}/suggestions/review`);
  const triage = page.getByRole("group", {name: "Filter suggestions by contributor tier"}).getByRole("button", {name: "Triage", exact: true});
  await triage.click();
  await expect(triage).toHaveAttribute("aria-pressed", "true");
  const row = page.getByRole("main").getByRole("button").filter({hasText: label});
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page.getByRole("tabpanel", {name: "Summary", exact: true})).toContainText(label);
}
