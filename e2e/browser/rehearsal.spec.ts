// BAIF rehearsal (sweep-2026-10-20): the contributor and reviewer journeys on the real
// FOLIO ontology and on the Catholic OS ontology with CTT terms merged in. Runs on the
// isolated stack (`npm run test:e2e:rehearsal`) or a serving host (`npm run rehearsal:hosted`).
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, openClass, classLabels, type RehearsalProject } from "../fixtures/rehearsal";
import { signIn } from "../fixtures/auth";
import { saveExistingLabel, openTriage } from "../fixtures/suggestions";
import { projectsPath, readSource } from "../fixtures/projects";
import type { RehearsalRunConfig, RehearsalTarget } from "../fixtures/run";
import { expectAccessible, captureRehearsalState } from "../fixtures/accessibility";

const sessionsPath = (id: string) => `${projectsPath}/${id}/suggestions/sessions`;
// Saving a label rewrites the whole real ontology; budget minutes per step.
const SAVE_TIMEOUT = 600_000;
/** Durations go to the private run log only, as rehearsal sizing evidence. */
async function timed<T>(step: string, work: () => Promise<T>) {
  const started = Date.now();
  const result = await work();
  console.log(`rehearsal-timing ${JSON.stringify({step, seconds: Math.round((Date.now() - started) / 100) / 10})}`);
  return result;
}
// Each case has a long real-ontology load; the editor parses megabytes of Turtle.
test.beforeEach(() => test.setTimeout(2_400_000));

function responseFor(page: Page, api: string, path: string, method = "POST") {
  return page.waitForResponse(r => new URL(r.url()).origin === api && new URL(r.url()).pathname === path && r.request().method() === method, {timeout: SAVE_TIMEOUT});
}
async function tree(api: APIRequestContext, projectId: string, parent?: string) {
  const response = await api.get(`${projectsPath}/${projectId}/ontology/tree${parent ? `/${encodeURIComponent(parent)}/children` : ""}`, {params: {branch: "main"}});
  expect(response.status()).toBe(200);
  return await response.json() as {nodes: {iri: string; label: string; child_count: number}[]; total_classes: number};
}
/** Uses the tree toolbar search and selects the matching class from the results. */
async function searchAndSelect(page: Page, query: string, target: RehearsalTarget) {
  const trigger = page.getByRole("button", {name: "Search entities", exact: true});
  await trigger.focus();
  await page.keyboard.press("Enter");
  const search = page.getByRole("textbox", {name: "Search entities", exact: true});
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(search).toBeFocused();
  await page.getByPlaceholder("Search classes, properties, individuals...", {exact: true}).fill(query);
  const hit = page.getByRole("treeitem").and(page.locator(`[data-iri="${target.iri}"]`));
  await expect(hit).toBeVisible({timeout: 60_000});
  await hit.click();
  await expect(hit).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(target.iri)));
}
async function labelInput(page: Page, value: string) {
  const input = page.getByPlaceholder("Label text", {exact: true});
  await expect(input).toHaveCount(1, {timeout: 60_000});
  await expect(input).toHaveValue(value);
  await expect(input).toHaveAccessibleName(/^Primary label \(.+\)$/);
}
/** Contributor edits the target's label, saves and submits; returns the session and PR. */
async function propose(page: Page, run: RehearsalRunConfig, project: RehearsalProject, target: RehearsalTarget) {
  await timed(`${project.name}: open class in editor`, async () => {
    await page.setViewportSize({width: 1440, height: 1000});
    await openClass(page, run.web, project.id, target);
    await labelInput(page, target.label);
  });
  const label = page.getByRole("textbox", {name: /^Primary label \(.+\)$/});
  await label.fill(target.edited!);
  const saved = await timed(`${project.name}: save label`, () => saveExistingLabel(page, run.api, project.id, target.edited!, false, SAVE_TIMEOUT));
  await page.getByRole("button", {name: /^Submit Suggestions/}).click();
  const dialog = page.getByRole("dialog", {name: "Submit Suggestions", exact: true});
  await dialog.getByRole("textbox", {name: "Describe your changes (optional)", exact: true}).fill(`Rehearsal: ${target.label} → ${target.edited}`);
  await expectAccessible(page, '[role="dialog"]');
  await captureRehearsalState(dialog, test.info(), "submit-dialog");
  const [response] = await timed(`${project.name}: submit`, () => Promise.all([
    responseFor(page, run.api, `${sessionsPath(project.id)}/${saved.sessionId}/submit`),
    dialog.getByRole("button", {name: "Submit for Review", exact: true}).click(),
  ]));
  expect(response.status()).toBe(200);
  const result = await response.json() as {pr_number: number; status: string};
  expect(result).toMatchObject({status: "submitted"});
  await expect(dialog).toBeHidden({timeout: SAVE_TIMEOUT});
  return {...saved, pr: result.pr_number};
}
/** Reviewer finds the proposal in triage, approves it, and sees the merged label. */
async function reviewAndMerge(page: Page, run: RehearsalRunConfig, api: APIRequestContext, project: RehearsalProject, target: RehearsalTarget, sessionId: string) {
  await page.setViewportSize({width: 1440, height: 1000});
  await timed(`${project.name}: open triage`, () => openTriage(page, run.web, project.id, target.edited!));
  await expectAccessible(page);
  const summary = page.getByRole("tab", {name: "Summary", exact: true});
  const files = page.getByRole("tab", {name: "Files", exact: true});
  await page.keyboard.press("Tab");
  await expect(summary).toBeFocused();
  await expect(summary).toHaveAttribute("tabindex", "0");
  await expect(files).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowRight");
  await expect(files).toBeFocused();
  await expect(summary).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  const panel = page.getByRole("tabpanel", {name: "Files", exact: true});
  await expect(files).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText(target.edited!, {timeout: SAVE_TIMEOUT});
  await expect(files).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);
  await expectAccessible(page);
  // Crop to tabs and diff; the surrounding queue contains submitter identity.
  await captureRehearsalState(page.getByRole("tablist", {name: "Suggestion details"}).locator(".."), test.info(), "review-files");
  const [approved] = await timed(`${project.name}: approve and merge`, () => Promise.all([
    responseFor(page, run.api, `${sessionsPath(project.id)}/${sessionId}/approve`),
    page.getByRole("button", {name: "Approve", exact: true}).click(),
  ]));
  expect(approved.ok()).toBe(true);
  await expect(page.getByRole("heading", {name: "Nothing waiting in triage", exact: true})).toBeVisible({timeout: SAVE_TIMEOUT});
  // The merge commit queues an index refresh; poll the class read, then the source.
  await timed(`${project.name}: merged label indexed`, () => expect.poll(() => classLabels(api, project.id, target.iri), {timeout: SAVE_TIMEOUT, intervals: [2_000, 5_000, 10_000]}).toContain(target.edited));
  expect((await readSource(api, project.id)).content).toContain(`"${target.edited}"`);
  await openClass(page, run.web, project.id, target, "main");
  await labelInput(page, target.edited!);
}

test("contributor signs in through the provider and browses the FOLIO class tree, search and class detail", async ({browser, run, folio, suggesterApi}) => {
  // A brand-new browser context proves interactive sign-in; the stored sessions are not used.
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setViewportSize({width: 1440, height: 1000});
    await signIn(page, run, "suggester");
    const target = run.rehearsal.targets.folio;
    const roots = await tree(suggesterApi, folio.id);
    expect(roots.total_classes).toBeGreaterThan(18_000);
    await page.goto(`${run.web}/projects/${folio.id}/editor`);
    // Root classes render from the real ontology, not a fixture.
    const first = roots.nodes.find(node => node.child_count > 0)!;
    await expect(page.getByRole("treeitem").and(page.locator(`[data-iri="${first.iri}"]`))).toBeVisible({timeout: 120_000});
    await searchAndSelect(page, target.label, target);
    await labelInput(page, target.label);
    await expect(page.getByText(/body of laws and regulations developed by the Catholic Church/)).toBeVisible();
    expect(await classLabels(suggesterApi, folio.id, target.iri)).toContain(target.label);
    await page.getByRole("button", {name: "Search entities", exact: true}).click();
    await expect(page.getByRole("textbox", {name: "Search entities", exact: true})).toBeFocused();
    await expectAccessible(page);
    await captureRehearsalState(page.getByRole("main"), test.info(), "folio-editor-search-label");
    await page.keyboard.press("Escape");
  } finally { await context.close(); }
});

test("contributor proposes a FOLIO label edit that the reviewer approves and merges", async ({run, folio, people, editorApi}) => {
  const target = run.rehearsal.targets.folio;
  const proposal = await propose(people.suggester, run, folio, target);
  expect(proposal.pr).toBeGreaterThan(0);
  await reviewAndMerge(people.editor, run, editorApi, folio, target, proposal.sessionId);
});

test("contributor browses the Catholic OS ontology and finds CTT terms marked uncalibrated", async ({run, catholic, people, suggesterApi}) => {
  const {cttRoot, cttFalseFriends, cttTerm, catholic: holySee} = run.rehearsal.targets;
  const roots = await tree(suggesterApi, catholic.id);
  expect(roots.total_classes).toBeGreaterThan(15_000);
  const rootNode = roots.nodes.find(node => node.iri === cttRoot.iri);
  expect(rootNode, "CTT term is a root class").toMatchObject({label: cttRoot.label});
  const falseFriends = await tree(suggesterApi, catholic.id, cttFalseFriends.iri);
  expect(falseFriends.nodes.map(n => n.label)).toContain(cttTerm.label);
  expect(falseFriends.nodes).toHaveLength(run.rehearsal.ctt.falseFriends);

  const page = people.suggester;
  await page.setViewportSize({width: 1440, height: 1000});
  await openClass(page, run.web, catholic.id, holySee);
  await labelInput(page, holySee.label);
  await searchAndSelect(page, cttTerm.label, cttTerm);
  await labelInput(page, cttTerm.label);
  await expectAccessible(page);
  await captureRehearsalState(page.getByRole("main"), test.info(), "catholic-editor-label");
  // The read-only viewer shows the term's annotations as text: calibration status and
  // both senses travel with every imported term, and it sits under CTT false friend.
  await page.goto(`${run.web}/projects/${catholic.id}?${new URLSearchParams({branch: "main", classIri: cttTerm.iri})}`);
  const detail = page.getByRole("main");
  await expect(detail.getByText(run.rehearsal.ctt.calibration, {exact: true}).first()).toBeVisible({timeout: 120_000});
  await expect(detail.getByText(/weight, validity, support/).first()).toBeVisible();
  await expect(detail.getByText(/commission, protocol, honor/).first()).toBeVisible();
  await expect(page.getByRole("treeitem").and(page.locator(`[data-iri="${cttFalseFriends.iri}"]`))).toBeVisible();
  await expectAccessible(page);
});

test("contributor proposes a Catholic OS edit that the reviewer approves and merges", async ({run, catholic, people, editorApi}) => {
  const target = run.rehearsal.targets.catholic;
  const proposal = await propose(people.suggester, run, catholic, target);
  expect(proposal.pr).toBeGreaterThan(0);
  await reviewAndMerge(people.editor, run, editorApi, catholic, target, proposal.sessionId);
  // The merge keeps the CTT module intact.
  const source = (await readSource(editorApi, catholic.id)).content;
  expect(source).toContain(run.rehearsal.targets.cttTerm.iri);
});
