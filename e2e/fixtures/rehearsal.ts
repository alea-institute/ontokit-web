// BAIF rehearsal (sweep-2026-10-20): personas, real-ontology projects and review helpers.
// Setup lives in one worker fixture, outside the four-case inventory: personas sign in,
// the steward imports both pinned ontologies as public projects, adds the contributor
// and reviewer, and waits until each index serves the imported revision.
import { test as base, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { loadSession, saveAuthenticatedPersona } from "./auth";
import { projectsPath, readSource } from "./projects";
import { loadRehearsalRun, authPath, type RehearsalPersona, type RehearsalRunConfig, type RehearsalTarget } from "./run";

const PERSONAS: RehearsalPersona[] = ["owner", "suggester", "editor"];
// Real ontologies take minutes, not seconds, to normalize and index.
const IMPORT_TIMEOUT = 600_000;
const INDEX_TIMEOUT = 1_200_000;
export interface RehearsalProject { id: string; name: string }
interface RehearsalWorker {
  rehearsalSetup: { run: RehearsalRunConfig; folio: RehearsalProject; catholic: RehearsalProject };
}
interface RehearsalFixtures {
  run: RehearsalRunConfig;
  folio: RehearsalProject;
  catholic: RehearsalProject;
  people: Record<RehearsalPersona, Page>;
  ownerApi: APIRequestContext;
  suggesterApi: APIRequestContext;
  editorApi: APIRequestContext;
}

async function personaContext(playwright: PlaywrightWorkerArgs["playwright"], run: RehearsalRunConfig, persona: RehearsalPersona) {
  const session = await loadSession(run, persona);
  return playwright.request.newContext({baseURL: run.api, timeout: IMPORT_TIMEOUT, extraHTTPHeaders: {Authorization: `Bearer ${session.accessToken}`}});
}

async function importProject(api: APIRequestContext, run: RehearsalRunConfig, key: "folio" | "catholicCtt", name: string): Promise<RehearsalProject> {
  const file = run.rehearsal.sources[key];
  const response = await api.post(`${projectsPath}/import`, {timeout: IMPORT_TIMEOUT, multipart: {
    name, description: `ontokit-e2e-run:${run.id}:rehearsal:${key}`, is_public: "true",
    file: {name: path.basename(file), mimeType: key === "folio" ? "application/rdf+xml" : "text/turtle", buffer: await fs.readFile(file)},
  }});
  expect(response.status(), `import ${key}`).toBe(201);
  const {id} = await response.json() as {id: string};
  return {id, name};
}

async function waitForIndex(api: APIRequestContext, id: string) {
  const source = await readSource(api, id);
  await expect.poll(async () => {
    const status = await api.get(`${projectsPath}/${id}/ontology/index-status`, {params: {branch: "main"}});
    if (status.status() === 404) return null;
    expect(status.status()).toBe(200);
    const state = await status.json() as {status: string; commit_hash: string};
    expect(state.status).not.toBe("failed");
    return state.status === "ready" ? state.commit_hash : null;
  }, {timeout: INDEX_TIMEOUT, intervals: [2_000, 5_000, 10_000]}).toBe(source.revision);
}

async function addMembers(api: APIRequestContext, run: RehearsalRunConfig, id: string) {
  for (const role of ["suggester", "editor"] as const) {
    const response = await api.post(`${projectsPath}/${id}/members`, {data: {user_id: run.users[role].id, role}});
    expect(response.status(), `add ${role} membership`).toBe(201);
  }
}

export const test = base.extend<RehearsalFixtures, RehearsalWorker>({
  rehearsalSetup: [async ({browser, playwright}, provide) => {
    const run = loadRehearsalRun();
    const authDir = path.join(run.dir, "auth");
    await fs.mkdir(authDir, {mode: 0o700});
    const created: string[] = [];
    let owner: APIRequestContext | undefined;
    try {
      for (const persona of PERSONAS) await saveAuthenticatedPersona(browser, run, persona);
      owner = await personaContext(playwright, run, "owner");
      const tag = run.id.slice(0, 8);
      const folio = await importProject(owner, run, "folio", `FOLIO rehearsal ${tag}`);
      created.push(folio.id);
      const catholic = await importProject(owner, run, "catholicCtt", `Catholic OS with CTT rehearsal ${tag}`);
      created.push(catholic.id);
      for (const project of [folio, catholic]) {
        await addMembers(owner, run, project.id);
        await waitForIndex(owner, project.id);
      }
      await provide({run, folio, catholic});
    } finally {
      // Exact-ID teardown of what this run created; isolated volume cleanup still follows.
      if (owner) {
        for (const id of created) expect([204, 404]).toContain((await owner.delete(`${projectsPath}/${id}`)).status());
        await owner.dispose();
      }
      await fs.rm(authDir, {recursive: true, force: true});
    }
  }, {scope: "worker", timeout: 2_700_000}],
  run: async ({rehearsalSetup}, provide) => { await provide(rehearsalSetup.run); },
  folio: async ({rehearsalSetup}, provide) => { await provide(rehearsalSetup.folio); },
  catholic: async ({rehearsalSetup}, provide) => { await provide(rehearsalSetup.catholic); },
  people: async ({browser, run}, provide) => {
    const contexts = [];
    const pages = {} as Record<RehearsalPersona, Page>;
    try {
      for (const persona of PERSONAS) {
        const context = await browser.newContext({storageState: authPath(run, persona)});
        contexts.push(context);
        pages[persona] = await context.newPage();
      }
      await provide(pages);
    } finally {
      for (const context of contexts) await context.close();
    }
  },
  ownerApi: async ({playwright, run}, provide) => { const api = await personaContext(playwright, run, "owner"); try { await provide(api); } finally { await api.dispose(); } },
  suggesterApi: async ({playwright, run}, provide) => { const api = await personaContext(playwright, run, "suggester"); try { await provide(api); } finally { await api.dispose(); } },
  editorApi: async ({playwright, run}, provide) => { const api = await personaContext(playwright, run, "editor"); try { await provide(api); } finally { await api.dispose(); } },
});
export { expect };

/** Opens the editor with one class selected through the shareable selection URL. */
export async function openClass(page: Page, web: string, projectId: string, target: RehearsalTarget, branch?: string) {
  const query = new URLSearchParams({classIri: target.iri, ...(branch ? {branch} : {})});
  await page.goto(`${web}/projects/${projectId}/editor?${query}`);
  const item = page.getByRole("treeitem").and(page.locator(`[data-iri="${target.iri}"]`));
  await expect(item).toHaveAttribute("aria-selected", "true", {timeout: 60_000});
  return item;
}

/** Reads one class through the API and returns its label values. */
export async function classLabels(api: APIRequestContext, projectId: string, iri: string) {
  const response = await api.get(`${projectsPath}/${projectId}/ontology/classes/${encodeURIComponent(iri)}`, {params: {branch: "main"}});
  expect(response.status()).toBe(200);
  return (await response.json() as {labels: {value: string}[]}).labels.map(l => l.value);
}
