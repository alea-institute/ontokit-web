import fs from "node:fs/promises";
import type { APIRequestContext, Page } from "@playwright/test";
import { test as base, expect, addSuggestionMembers, directProbe, recordProbe, saveExistingLabel, openTriage } from "../fixtures/suggestions";
import { authPath, type SuggestionPersona } from "../fixtures/run";
import { ontologyNamespace, projectsPath, readSource, tinyOntologyPath } from "../fixtures/projects";
import type { Notification, NotificationType } from "../../lib/api/notifications";
import type { SuggestionSessionSummary } from "../../lib/api/suggestions";

const personIri = `${ontologyNamespace}Person`;
const sessionsPath = (id: string) => `${projectsPath}/${id}/suggestions/sessions`;
type FixtureProject = {id: string; name: string};
type Saved = {sessionId: string; branch: string};

const test = base.extend<{
  makeProject: (isPublic?: boolean) => Promise<FixtureProject>;
  people: Record<SuggestionPersona, Page>;
}>({
  makeProject: async ({ownerApi, run}, provide, info) => {
    const ids: string[] = [];
    try {
      await provide(async (isPublic = true) => {
        const name = `D10 ${run.id} case ${info.line}-${ids.length + 1}`;
        const response = await ownerApi.post(`${projectsPath}/import`, {multipart: {
          name, description: `ontokit-e2e-run:${run.id}:suggestions:${info.line}:${ids.length + 1}`,
          is_public: String(isPublic),
          file: {name: "tiny-ontology.ttl", mimeType: "text/turtle", buffer: await fs.readFile(tinyOntologyPath)},
        }});
        expect(response.status()).toBe(201);
        const {id} = await response.json() as {id: string};
        ids.push(id);
        await addSuggestionMembers(ownerApi, run, id);
        const source = await readSource(ownerApi, id);
        await expect.poll(async () => {
          const status = await ownerApi.get(`${projectsPath}/${id}/ontology/index-status`, {params: {branch: "main"}});
          if (status.status() === 404) return null;
          expect(status.status()).toBe(200);
          const state = await status.json() as {status: string; commit_hash: string};
          expect(state.status).not.toBe("failed");
          return state.status === "ready" ? state.commit_hash : null;
        }, {timeout: 60_000}).toBe(source.revision);
        return {id, name};
      });
    } finally {
      for (const id of ids) expect([204, 404]).toContain((await ownerApi.delete(`${projectsPath}/${id}`)).status());
    }
  },
  people: async ({browser, run}, provide) => {
    const contexts = [];
    const pages = {} as Record<SuggestionPersona, Page>;
    try {
      for (const persona of ["owner", "suggester", "editor", "unrelated"] as const) {
        const context = await browser.newContext({storageState: authPath(run, persona)});
        contexts.push(context);
        pages[persona] = await context.newPage();
      }
      await provide(pages);
    } finally {
      for (const context of contexts) await context.close();
    }
  },
});
test.beforeEach(() => test.setTimeout(240_000));

async function selectPerson(page: Page) {
  const item = page.getByRole("treeitem").and(page.locator(`[data-iri="${personIri}"]`));
  await item.click();
  await expect(item).toHaveAttribute("aria-selected", "true");
}
async function edit(page: Page, run: {web: string; api: string}, id: string, label: string) {
  await page.goto(`${run.web}/projects/${id}/editor`);
  await selectPerson(page);
  return saveExistingLabel(page, run.api, id, label);
}
function responseFor(page: Page, api: string, path: string, method = "POST") {
  return page.waitForResponse(r => new URL(r.url()).origin === api && new URL(r.url()).pathname === path && r.request().method() === method);
}
async function submit(page: Page, api: string, id: string, saved: Saved, label: string, resubmit = false) {
  await page.getByRole("button", {name: resubmit ? /^Resubmit Suggestions/ : /^Submit Suggestions/}).click();
  const dialog = page.getByRole("dialog", {name: "Submit Suggestions", exact: true});
  await dialog.getByRole("textbox", {name: "Describe your changes (optional)", exact: true}).fill(label);
  const [response] = await Promise.all([
    responseFor(page, api, `${sessionsPath(id)}/${saved.sessionId}/${resubmit ? "resubmit" : "submit"}`),
    dialog.getByRole("button", {name: "Submit for Review", exact: true}).click(),
  ]);
  expect(response.status()).toBe(200);
  const result = await response.json() as {pr_number: number; status: string};
  expect(result.status).toBe("submitted");
  expect(result.pr_number).toBeGreaterThan(0);
  await expect(dialog).toBeHidden();
  return result.pr_number;
}
async function session(api: APIRequestContext, id: string, sid: string) {
  const response = await api.get(sessionsPath(id));
  expect(response.status()).toBe(200);
  const {items} = await response.json() as {items: SuggestionSessionSummary[]};
  const found = items.find(item => item.session_id === sid);
  expect(found).toBeDefined();
  return found!;
}
async function approve(page: Page, api: string, id: string, sid: string) {
  const [response] = await Promise.all([
    responseFor(page, api, `${sessionsPath(id)}/${sid}/approve`),
    page.getByRole("button", {name: "Approve", exact: true}).click(),
  ]);
  expect(response.ok()).toBe(true);
  await expect(page.getByRole("heading", {name: "Nothing waiting in triage", exact: true})).toBeVisible();
}
async function mergedLabel(api: APIRequestContext, page: Page, web: string, id: string, label: string) {
  // The index refresh is queued after the merge commit; poll the actual class read.
  await expect.poll(async () => {
    const response = await api.get(`${projectsPath}/${id}/ontology/classes/${encodeURIComponent(personIri)}`, {params: {branch: "main"}});
    expect(response.status()).toBe(200);
    return (await response.json() as {labels: {value: string}[]}).labels.map(l => l.value);
  }, {timeout: 60_000}).toContain(label);
  expect((await readSource(api, id)).content).toContain(`"${label}"@en`);
  await page.goto(`${web}/projects/${id}/editor?branch=main`);
  await page.reload();
  await selectPerson(page);
  await expect(page.getByRole("button", {name: `Copy link to ${label}`, exact: true})).toBeVisible();
}
async function notification(page: Page, run: {web: string; api: string}, project: FixtureProject, type: NotificationType, destination: "suggestions" | "suggestions/review", resubmitted = false) {
  await page.goto(`${run.web}/projects/${project.id}`);
  let notice: Notification | undefined;
  // Read the browser's own notification fetch to identify the current project's
  // notification, then prove that same title/body is rendered and navigable.
  await expect(async () => {
    const [response] = await Promise.all([
      responseFor(page, run.api, "/api/v1/notifications", "GET"),
      page.reload(),
    ]);
    expect(response.status()).toBe(200);
    const {items} = await response.json() as {items: Notification[]};
    const matches = items.filter(n => n.project_id === project.id && n.type === type
      && (!resubmitted || /resubmi/i.test(`${n.title} ${n.body ?? ""}`)));
    expect(matches).toHaveLength(1);
    notice = matches[0];
  }).toPass({timeout: 45_000, intervals: [500, 1_000, 2_000]});
  await page.getByRole("button", {name: "Notifications", exact: true}).click();
  const header = page.getByRole("banner");
  let row = header.getByRole("button").filter({has: page.getByText(notice!.title, {exact: true})});
  if (notice!.body) row = row.filter({has: page.getByText(notice!.body, {exact: true})});
  if (notice!.project_name) row = row.filter({hasText: notice!.project_name});
  await expect(row).toHaveCount(1);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(url => url.pathname === `/projects/${project.id}/${destination}`);
}

// Each case has its own owner-created project and fresh persona browser contexts.
test("suggester edits an existing class label, saves and submits for owner triage", async ({run, makeProject, people, suggesterApi}) => {
  const project = await makeProject();
  const label = "D10 submitted Person";
  const saved = await edit(people.suggester, run, project.id, label);
  await submit(people.suggester, run.api, project.id, saved, label);
  await openTriage(people.owner, run.web, project.id, label);
  await notification(people.owner, run, project, "suggestion_submitted", "suggestions/review");
  const content = (await readSource(suggesterApi, project.id, saved.branch)).content;
  recordProbe("submitted-save", await directProbe(suggesterApi, "submitted-save", {projectId: project.id, sessionId: saved.sessionId,
    data: {content, entity_iri: personIri, entity_label: label}}));
  recordProbe("suggester-approve", await directProbe(suggesterApi, "suggester-approve", {projectId: project.id, sessionId: saved.sessionId}));
});

test("owner approval merges the label, removes the session branch and notifies the suggester", async ({run, makeProject, people, ownerApi, suggesterApi}) => {
  const project = await makeProject();
  const label = "D10 approved Person";
  const saved = await edit(people.suggester, run, project.id, label);
  await submit(people.suggester, run.api, project.id, saved, label);
  await openTriage(people.owner, run.web, project.id, label);
  await approve(people.owner, run.api, project.id, saved.sessionId);
  await mergedLabel(ownerApi, people.owner, run.web, project.id, label);
  const branches = await ownerApi.get(`${projectsPath}/${project.id}/branches`);
  expect(branches.status()).toBe(200);
  expect((await branches.json() as {items: {name: string}[]}).items.map(b => b.name)).not.toContain(saved.branch);
  expect((await session(suggesterApi, project.id, saved.sessionId)).status).toBe("merged");
  await notification(people.suggester, run, project, "suggestion_approved", "suggestions");
  await expect(people.suggester.getByText("Merged", {exact: true})).toBeVisible();
  recordProbe("merged-approve", await directProbe(ownerApi, "merged-approve", {projectId: project.id, sessionId: saved.sessionId}));

  // The owner can review others but must not approve their own suggestion.
  const own = await makeProject();
  const created = await ownerApi.post(sessionsPath(own.id));
  expect(created.status()).toBe(201);
  const {session_id: sid} = await created.json() as {session_id: string};
  const source = await readSource(ownerApi, own.id);
  expect((await ownerApi.put(`${sessionsPath(own.id)}/${sid}/save`, {data: {
    content: source.content.replace('"Test Person"@en', '"D10 self Person"@en'), entity_iri: personIri, entity_label: "D10 self Person",
  }})).status()).toBe(200);
  expect((await ownerApi.post(`${sessionsPath(own.id)}/${sid}/submit`, {data: {summary: "Self review refusal"}})).status()).toBe(200);
  recordProbe("creator-self-approve", await directProbe(ownerApi, "creator-self-approve", {projectId: own.id, sessionId: sid}));
});

test("requested changes notify the suggester who resumes and resubmits revision two on the same pull request for owner approval and merge", async ({run, makeProject, people, ownerApi, suggesterApi}) => {
  const project = await makeProject();
  const first = "D10 first revision Person", second = "D10 revised Person";
  const saved = await edit(people.suggester, run, project.id, first);
  const pr = await submit(people.suggester, run.api, project.id, saved, first);
  expect(await session(suggesterApi, project.id, saved.sessionId)).toMatchObject({pr_number: pr, revision: 1});
  await openTriage(people.owner, run.web, project.id, first);
  await people.owner.getByRole("button", {name: "Request Changes", exact: true}).click();
  const dialog = people.owner.getByRole("dialog", {name: "Request Changes", exact: true});
  await dialog.getByRole("textbox", {name: "Feedback", exact: true}).fill("Please revise the Person label");
  const [requested] = await Promise.all([
    responseFor(people.owner, run.api, `${sessionsPath(project.id)}/${saved.sessionId}/request-changes`),
    dialog.getByRole("button", {name: "Request Changes", exact: true}).click(),
  ]);
  expect(requested.ok()).toBe(true);
  await notification(people.suggester, run, project, "suggestion_changes_requested", "suggestions");
  await expect(people.suggester.getByText("Please revise the Person label", {exact: true})).toBeVisible();
  const [reopened] = await Promise.all([
    responseFor(people.suggester, run.api, `${sessionsPath(project.id)}/${saved.sessionId}/reopen`),
    people.suggester.getByRole("link", {name: "Resume Editing", exact: true}).click(),
  ]);
  expect(reopened.status()).toBe(200);
  await selectPerson(people.suggester);
  const revised = await saveExistingLabel(people.suggester, run.api, project.id, second);
  expect(revised).toEqual(saved);
  expect(await submit(people.suggester, run.api, project.id, revised, second, true)).toBe(pr);
  expect(await session(suggesterApi, project.id, saved.sessionId)).toMatchObject({pr_number: pr, revision: 2, status: "submitted"});
  const prs = await ownerApi.get(`${projectsPath}/${project.id}/pull-requests`);
  expect(prs.status()).toBe(200);
  expect((await prs.json() as {items: {pr_number: number}[]}).items.map(p => p.pr_number)).toEqual([pr]);
  await notification(people.owner, run, project, "suggestion_submitted", "suggestions/review", true);
  await openTriage(people.owner, run.web, project.id, second);
  await expect(people.owner.getByRole("tabpanel", {name: "Summary"})).toContainText("Revision 2");
  await approve(people.owner, run.api, project.id, saved.sessionId);
  await mergedLabel(ownerApi, people.owner, run.web, project.id, second);
});

test("editor rejection closes the pull request and notifies the suggester", async ({run, makeProject, people, ownerApi, suggesterApi}) => {
  const project = await makeProject();
  const label = "D10 rejected Person";
  const saved = await edit(people.suggester, run, project.id, label);
  const pr = await submit(people.suggester, run.api, project.id, saved, label);
  await openTriage(people.editor, run.web, project.id, label);
  await people.editor.getByRole("button", {name: "Reject", exact: true}).click();
  const dialog = people.editor.getByRole("dialog", {name: "Reject Suggestion", exact: true});
  await dialog.getByRole("textbox").fill("Keep the existing label");
  const [rejected] = await Promise.all([
    responseFor(people.editor, run.api, `${sessionsPath(project.id)}/${saved.sessionId}/reject`),
    dialog.getByRole("button", {name: "Reject", exact: true}).click(),
  ]);
  expect(rejected.ok()).toBe(true);
  const closed = await ownerApi.get(`${projectsPath}/${project.id}/pull-requests/${pr}`);
  expect(closed.status()).toBe(200);
  expect(await closed.json()).toMatchObject({status: "closed"});
  expect((await session(suggesterApi, project.id, saved.sessionId)).status).toBe("rejected");
  await notification(people.suggester, run, project, "suggestion_rejected", "suggestions");
  await expect(people.suggester.getByText("Rejected", {exact: true})).toBeVisible();
  expect((await readSource(ownerApi, project.id)).content).toContain('"Test Person"@en');
});

test("private non-member create and untrusted entity mint are refused by the API", async ({makeProject, unrelatedApi, suggesterApi}) => {
  const project = await makeProject(false);
  recordProbe("private-non-member-create", await directProbe(unrelatedApi, "private-non-member-create", {projectId: project.id}));
  const capabilities = await suggesterApi.get(`${projectsPath}/${project.id}/suggestions/capabilities`);
  expect(capabilities.status()).toBe(200);
  expect(await capabilities.json()).toMatchObject({tier: "untrusted", can_suggest: true, can_mint_entities: false});
  const created = await suggesterApi.post(sessionsPath(project.id));
  expect(created.status()).toBe(201);
  const saved = await created.json() as {session_id: string; branch: string};
  const before = await readSource(suggesterApi, project.id, saved.branch);
  recordProbe("untrusted-mint", await directProbe(suggesterApi, "untrusted-mint", {projectId: project.id, sessionId: saved.session_id, data: {
    content: `${before.content}\nex:NewClass a owl:Class ; rdfs:label "New entity"@en .\n`,
    entity_iri: `${ontologyNamespace}NewClass`, entity_label: "New entity",
  }}));
  expect(await readSource(suggesterApi, project.id, saved.branch)).toEqual(before);
});

// Provisional R9 and R10 stay standalone so either decision can be reverted alone.
test("editor approval merges a suggestion through the suggestion review path", async ({run, makeProject, people, editorApi}) => {
  const project = await makeProject();
  const label = "D10 editor approved Person";
  const saved = await edit(people.suggester, run, project.id, label);
  await submit(people.suggester, run.api, project.id, saved, label);
  await openTriage(people.editor, run.web, project.id, label);
  await approve(people.editor, run.api, project.id, saved.sessionId);
  await mergedLabel(editorApi, people.editor, run.web, project.id, label);
});

test("public non-member capabilities agree with session create and submission succeeds", async ({run, makeProject, people, unrelatedApi, ownerApi}) => {
  const project = await makeProject();
  const members = await ownerApi.get(`${projectsPath}/${project.id}/members`);
  expect(members.status()).toBe(200);
  const membership = await members.json() as {items: {user_id: string}[]};
  expect(membership.items.map(m => m.user_id)).not.toContain(run.users.unrelated.id);
  const capabilities = await unrelatedApi.get(`${projectsPath}/${project.id}/suggestions/capabilities`);
  expect(capabilities.status()).toBe(200);
  expect(await capabilities.json()).toMatchObject({tier: "untrusted", can_suggest: true, can_mint_entities: false});
  // Observe the real browser's creation; don't pre-create a session as a fixture shortcut.
  await people.unrelated.goto(`${run.web}/projects/${project.id}/editor`);
  await selectPerson(people.unrelated);
  const [created, saved] = await Promise.all([
    responseFor(people.unrelated, run.api, sessionsPath(project.id)),
    saveExistingLabel(people.unrelated, run.api, project.id, "D10 public visitor Person"),
  ]);
  expect(created.status()).toBe(201);
  const pr = await submit(people.unrelated, run.api, project.id, saved, "D10 public visitor Person");
  expect(await session(unrelatedApi, project.id, saved.sessionId)).toMatchObject({status: "submitted", pr_number: pr});
  await openTriage(people.owner, run.web, project.id, "D10 public visitor Person");
});
