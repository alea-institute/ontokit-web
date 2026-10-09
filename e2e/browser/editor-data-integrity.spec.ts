import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor";
import { projectsPath, readSource, type SourceSnapshot } from "../fixtures/projects";
import { waitForIndex } from "../fixtures/polling";
import type { EntitySearchResponse } from "../../lib/api/client";

// Drain tranche 1 UAT: editor writes change only what the editor meant to change.
// Every case asserts against the API's committed branch source or search response.
// All data is synthetic.

const NS = "https://example.org/ontokit-uat-integrity#";

const DOG_BLOCK = [
  ':Dog a owl:Class ;',
  '    rdfs:subClassOf :Animal ;',
  '    rdfs:label "Dog"@en ;',
  '    skos:altLabel "Hund"@de, "Chien"@fr, "Perro"@es .',
].join("\n");
const AXIOM_BLOCK = [
  '[] a owl:Axiom ;',
  '    owl:annotatedSource :Dog ;',
  '    owl:annotatedProperty skos:altLabel ;',
  '    owl:annotatedTarget "Hund"@de ;',
  '    rdfs:comment "synthetic provenance" .',
].join("\n");
const CAT_BLOCK = [
  ':Cat a owl:Class ;',
  '    rdfs:label "Cat"@en ;',
  '    rdfs:subClassOf [ a owl:Restriction ; owl:onProperty :hasPart ; owl:someValuesFrom :Animal ] .',
].join("\n");
const ORPHAN_BLOCK = ':Orphan a owl:Class ;\n    rdfs:label "Orphan"@en .';
const REX_BLOCK = [
  ':rex a owl:NamedIndividual, :Dog ;',
  '    rdfs:label "Rex"@en ;',
  '    skos:altLabel "Rexi"@de .',
].join("\n");

const ONTOLOGY = [
  `@prefix : <${NS}> .`,
  "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
  "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
  "",
  '<https://example.org/ontokit-uat-integrity> a owl:Ontology ; rdfs:label "UAT data-integrity ontology"@en .',
  "",
  ':hasPart a owl:ObjectProperty ;\n    rdfs:label "has part"@en .',
  "",
  ':Animal a owl:Class ;\n    rdfs:label "Animal"@en .',
  "",
  DOG_BLOCK,
  "",
  AXIOM_BLOCK,
  "",
  ORPHAN_BLOCK,
  "",
  CAT_BLOCK,
  "",
  ":LegacyThing a rdfs:Class .",
  "",
  ":legacyRel a rdf:Property .",
  "",
  REX_BLOCK,
  "",
].join("\n");


/** Screenshots go to the real account home: the harness points HOME at its private run dir. */
async function shot(page: Page, slug: string) {
  await page.screenshot({path: path.join(os.userInfo().homedir, `ontokit-uat-${slug}.png`)});
}

interface Baseline {
  id: string;
  source: SourceSnapshot;
  /** Committed bytes of each block. Import re-serializes, so these come from the API, not ONTOLOGY. */
  blocks: {dog: string; axiom: string; cat: string; orphan: string; rex: string};
}

async function importSynthetic(api: APIRequestContext, trackProject: (id: string) => void): Promise<Baseline> {
  const response = await api.post(`${projectsPath}/import`, {multipart: {
    name: `UAT data integrity ${randomUUID()}`, is_public: "false",
    file: {name: "uat-integrity.ttl", mimeType: "text/turtle", buffer: Buffer.from(ONTOLOGY, "utf8")},
  }});
  expect(response.status()).toBe(201);
  const {id} = await response.json() as {id: string};
  trackProject(id);
  const source = await readSource(api, id);
  const c = source.content;
  const blocks = {
    dog: subjectBlock(c, "Dog"), axiom: axiomBlock(c), cat: subjectBlock(c, "Cat"),
    orphan: subjectBlock(c, "Orphan"), rex: subjectBlock(c, "rex"),
  };
  // The synthetic facts each later case relies on are present in the committed import.
  for (const alt of ['"Hund"@de', '"Chien"@fr', '"Perro"@es', '"Dog"@en']) expect(blocks.dog).toContain(alt);
  expect(blocks.axiom).toContain('"synthetic provenance"');
  expect(blocks.axiom).toContain('owl:annotatedTarget "Hund"@de');
  expect(blocks.cat).toMatch(/owl:Restriction[\s\S]*owl:onProperty :hasPart[\s\S]*owl:someValuesFrom :Animal/);
  expect(blocks.rex).toContain('skos:altLabel "Rexi"@de');
  await waitForIndex(api, id, "main", source.revision);
  return {id, source, blocks};
}

/** The single owl:Axiom block (anonymous subject) in the committed source. */
function axiomBlock(content: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex(line => line.startsWith("[] a owl:Axiom"));
  expect(start, "owl:Axiom block").toBeGreaterThanOrEqual(0);
  let end = start;
  while (end < lines.length && !/\s\.\s*$/.test(lines[end])) end += 1;
  return lines.slice(start, end + 1).join("\n");
}

async function openTree(page: Page, web: string, id: string) {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(`${web}/projects/${id}/editor`);
  await page.getByRole("group", {name: "Editor mode"}).getByRole("button", {name: "Developer", exact: true}).click();
  await page.getByRole("button", {name: "Tree", exact: true}).click();
  await expect(treeItem(page, "Animal")).toBeVisible({timeout: 45_000});
}

function treeItem(page: Page, local: string) {
  return page.locator(`[role="treeitem"][data-iri="${NS}${local}"]`);
}

/** Text of the subject block for `:local`, from its subject line to the terminating " .". */
function subjectBlock(content: string, local: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex(line => line.startsWith(`:${local} `) || line.startsWith(`<${NS}${local}> `));
  expect(start, `subject block for :${local}`).toBeGreaterThanOrEqual(0);
  let end = start;
  while (end < lines.length && !/\s\.\s*$/.test(lines[end])) end += 1;
  return lines.slice(start, end + 1).join("\n");
}

async function waitForSave(page: Page, id: string) {
  return page.waitForResponse(response =>
    new URL(response.url()).pathname === `${projectsPath}/${id}/source` && response.request().method() === "PUT",
  {timeout: 30_000});
}

test("a. delete is enabled for a zero-reference class and removes only that class", async ({journey, run}) => {
  test.setTimeout(180_000);
  const {page, api} = journey;
  const {id, source, blocks} = await importSynthetic(api, journey.trackProject);
  await openTree(page, run.web, id);

  await treeItem(page, "Orphan").click({button: "right"});
  await page.getByRole("menuitem", {name: "Delete"}).click();
  const dialog = page.getByRole("dialog", {name: "Delete Class"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Checking references...")).toBeHidden({timeout: 30_000});
  const confirm = dialog.getByRole("button", {name: "Delete", exact: true});
  // CatholicOS#364: a class with zero cross-references needs no acknowledgement.
  await expect(confirm).toBeEnabled();
  await expect(dialog.getByText(/referenced by/)).toHaveCount(0);
  await shot(page, "delete-dialog-enabled");

  const saved = waitForSave(page, id);
  await confirm.click();
  expect((await saved).status()).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(treeItem(page, "Orphan")).toHaveCount(0);
  await shot(page, "delete-tree-after");

  const after = await readSource(api, id);
  expect(after.revision).not.toBe(source.revision);
  expect(after.content).not.toContain(":Orphan");
  expect(after.content).not.toContain(`${NS}Orphan`);
  // Every other block is byte-identical: Dog's four labels, its axiom, Cat's restriction, Rex.
  for (const block of [blocks.dog, blocks.axiom, blocks.cat, blocks.rex]) expect(after.content).toContain(block);
  // Nothing else changed beyond blank-line spacing around the removed block.
  const squeeze = (text: string) => text.replace(/\n{2,}/g, "\n\n");
  expect(squeeze(after.content)).toBe(squeeze(source.content.replace(blocks.orphan, "")));
});

test("b. a class form edit keeps altLabels, the provenance axiom and a sibling restriction", async ({journey, run}) => {
  test.setTimeout(180_000);
  const {page, api} = journey;
  const {id, source, blocks} = await importSynthetic(api, journey.trackProject);
  await openTree(page, run.web, id);
  await page.getByRole("button", {name: "Expand all levels"}).click();
  await treeItem(page, "Dog").click();
  await expect(treeItem(page, "Dog")).toHaveAttribute("aria-selected", "true");

  // Let the detail panel finish loading before typing.
  await expect(page.getByPlaceholder("Label text").first()).toHaveValue("Dog", {timeout: 30_000});
  // The ghost row loses its placeholder once typed into (a new ghost row is appended),
  // so focus it once and drive the keyboard rather than re-resolving the locator.
  await page.getByPlaceholder("Add another Comment — or translation.").click();
  await page.keyboard.type("Synthetic dog comment");
  await page.keyboard.press("Tab");
  const bar = page.getByRole("status").filter({hasText: "Draft saved"});
  try {
    await expect(bar).toBeVisible();
  } catch (error) {
    await shot(page, "debug-class-edit");
    throw error;
  }
  const saved = waitForSave(page, id);
  await bar.getByRole("button", {name: "Save", exact: true}).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('Updated "Dog"').first()).toBeVisible();
  // The panel reloads from the saved branch; wait until it shows the persisted comment.
  await expect.poll(() => page.locator("textarea").evaluateAll(
    elements => elements.some(element => (element as HTMLTextAreaElement).value === "Synthetic dog comment"),
  ), {timeout: 30_000}).toBe(true);
  await shot(page, "class-edit-saved");

  const after = await readSource(api, id);
  expect(after.revision).not.toBe(source.revision);
  const dog = subjectBlock(after.content, "Dog");
  expect(dog).toContain('"Synthetic dog comment"@en');
  expect(dog).toContain('"Dog"@en');
  for (const alt of ['"Hund"@de', '"Chien"@fr', '"Perro"@es']) {
    expect(dog).toContain(alt);
    expect(dog.split(alt).length - 1, `${alt} is not duplicated`).toBe(1);
  }
  expect(dog).toMatch(/subClassOf\s+(?::Animal|<https:\/\/example\.org\/ontokit-uat-integrity#Animal>)/);
  // Untouched blocks are byte-identical.
  for (const block of [blocks.axiom, blocks.cat, blocks.orphan, blocks.rex]) expect(after.content).toContain(block);
});

test("c. an individual label edit keeps its skos:altLabel", async ({journey, run}) => {
  test.setTimeout(180_000);
  const {page, api} = journey;
  const {id, source, blocks} = await importSynthetic(api, journey.trackProject);
  await openTree(page, run.web, id);
  await page.getByRole("button", {name: "Individuals", exact: true}).click();
  const rex = treeItem(page, "rex");
  await rex.click();
  await expect(rex).toHaveAttribute("aria-selected", "true");

  const label = page.getByPlaceholder("Label text").first();
  await expect(label).toHaveValue("Rex");
  await label.fill("Rex Prime");
  await label.blur();
  const bar = page.getByRole("status").filter({hasText: "Draft saved"});
  await expect(bar).toBeVisible();
  const saved = waitForSave(page, id);
  await bar.getByRole("button", {name: "Save", exact: true}).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('Updated "Rex Prime"').first()).toBeVisible();
  await shot(page, "individual-edit-saved");

  const after = await readSource(api, id);
  expect(after.revision).not.toBe(source.revision);
  const block = subjectBlock(after.content, "rex");
  expect(block).toContain('"Rex Prime"@en');
  expect(block).not.toContain('"Rex"@en');
  expect(block).toContain('skos:altLabel "Rexi"@de');
  expect(block).toMatch(/(?::Dog|<https:\/\/example\.org\/ontokit-uat-integrity#Dog>)/);
  for (const b of [blocks.dog, blocks.axiom, blocks.cat, blocks.orphan]) expect(after.content).toContain(b);
});

test("d. search returns a bare rdf:Property and a bare rdfs:Class", async ({journey, run}) => {
  test.setTimeout(180_000);
  const {page, api} = journey;
  const {id} = await importSynthetic(api, journey.trackProject);

  const response = await api.get(`${projectsPath}/${id}/ontology/search`, {params: {q: "legacy", branch: "main"}});
  expect(response.status()).toBe(200);
  const body = await response.json() as EntitySearchResponse;
  const rel = body.results.find(result => result.iri === `${NS}legacyRel`);
  const thing = body.results.find(result => result.iri === `${NS}LegacyThing`);
  expect(rel, "legacyRel in search results").toBeDefined();
  expect(rel!.entity_type).toBe("property");
  expect(rel!.property_kind ?? null).toBeNull();
  expect(thing, "LegacyThing in search results").toBeDefined();
  expect(thing!.entity_type).toBe("class");

  await openTree(page, run.web, id);
  await page.getByRole("button", {name: "Search entities"}).click();
  await page.getByPlaceholder("Search classes, properties, individuals...").fill("legacy");
  // UI evidence only; the contract above is the API response.
  await expect(page.getByText(/legacyRel/).first()).toBeVisible({timeout: 15_000}).catch(() => {});
  await shot(page, "search-legacy");
});

test("e. Add Entity keeps a label typed before the namespace settles", async ({journey, run}) => {
  test.setTimeout(180_000);
  const {page, api} = journey;
  const {id} = await importSynthetic(api, journey.trackProject);
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(`${run.web}/projects/${id}/editor`);
  const add = page.getByRole("button", {name: "Add entity"}).first();
  await add.click({timeout: 45_000});
  const dialog = page.getByRole("dialog", {name: "Add Entity"});
  const label = dialog.getByLabel("Label", {exact: true});
  await label.pressSequentially("Synthetic Wolf", {delay: 5});
  await dialog.getByRole("button", {name: "Advanced"}).click();
  const iri = dialog.getByLabel("IRI", {exact: true});
  // Settled: the detected ontology namespace and label-derived IRI have arrived.
  await expect(iri).toHaveValue(new RegExp(`^${NS.replace(/[.#/]/g, "\\$&")}`), {timeout: 30_000});
  await page.waitForTimeout(1_000);
  await expect(label).toHaveValue("Synthetic Wolf");
  await shot(page, "add-entity-label-kept");
  await dialog.getByRole("button", {name: "Cancel"}).click();
  // Cancelled: nothing was written.
  const after = await readSource(api, id);
  expect(after.content).not.toContain("Synthetic Wolf");
});
