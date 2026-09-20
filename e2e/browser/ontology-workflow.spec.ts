import { randomUUID } from "node:crypto";
import { test, expect, branchButton, selectBranch, showSource, findSourceText, replaceSourceLabel } from "../fixtures/editor";
import { ontologyNamespace, projectsPath, readSource, tinyOntologyPath } from "../fixtures/projects";
import { waitForIndex } from "../fixtures/polling";

test("fresh UI sign-in imports, edits, reviews and merges a label that survives target reload", async ({journey, run}) => {
  test.setTimeout(240_000);
  const {page, api} = journey;
  const branch = "browser-label";
  const label = "Browser Quasar Person";

  await page.goto(`${run.web}/projects/new`);
  await page.getByRole("button", {name: "Import from File", exact: true}).click();
  await page.locator('input[type="file"]').setInputFiles(tinyOntologyPath);
  await page.getByRole("textbox", {name: "Project Name"}).fill(`D06 browser ${randomUUID()}`);
  const [importedResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === `${projectsPath}/import` && response.request().method() === "POST"),
    page.getByRole("button", {name: "Import Project", exact: true}).click(),
  ]);
  expect(importedResponse.status()).toBe(201);
  const imported = await importedResponse.json() as {id: string};
  journey.trackProject(imported.id);
  await expect(page).toHaveURL(url => url.pathname === `/projects/${imported.id}`);
  const original = await readSource(api, imported.id);
  await waitForIndex(api, imported.id, "main", original.revision);
  await page.getByRole("group", {name: "Project view"}).getByRole("link", {name: "Editor", exact: true}).click();
  await expect(page).toHaveURL(url => url.pathname === `/projects/${imported.id}/editor`);
  await page.getByRole("group", {name: "Editor mode"}).getByRole("button", {name: "Developer", exact: true}).click();
  await page.getByRole("button", {name: "Tree", exact: true}).click();
  const person = page.getByRole("treeitem", {name: /Test Person/});
  await person.click();
  await expect(person).toHaveAttribute("aria-selected", "true");
  await expect(person).toHaveAttribute("data-iri", `${ontologyNamespace}Person`);
  // In-page selection updates the tree/store and Share control; URL selection
  // parameters are restoration inputs, not a promise to rewrite on every click.
  await expect(page.getByRole("button", {name: "Copy link to Test Person", exact: true})).toBeVisible();

  await branchButton(page, "main").click();
  await page.getByRole("button", {name: "Create new branch", exact: true}).click();
  await page.getByPlaceholder("feature/my-changes").fill(branch);
  await page.getByRole("button", {name: "Create", exact: true}).click();
  await expect(branchButton(page, branch)).toBeVisible();
  await showSource(page);
  await replaceSourceLabel(page, "Test Person", label);
  await page.getByRole("button", {name: "Save", exact: true}).click();
  const commitDialog = page.getByRole("dialog", {name: "Save Changes"});
  await commitDialog.getByPlaceholder("Describe your changes...").fill("Rename Person through the browser");
  const [saveResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === `${projectsPath}/${imported.id}/source` && response.request().method() === "PUT"),
    commitDialog.getByRole("button", {name: "Save & Commit", exact: true}).click(),
  ]);
  expect(saveResponse.status()).toBe(200);
  await expect(commitDialog).toBeHidden();
  await expect(page.getByRole("button", {name: "Save", exact: true})).toBeDisabled();
  const saved = await readSource(api, imported.id, branch);
  expect(saved.content).toBe(original.content.replace('"Test Person"@en', `"${label}"@en`));
  expect(saved.revision).not.toBe(original.revision);
  expect(await readSource(api, imported.id)).toEqual(original);

  await page.locator(`a[href="/projects/${imported.id}/pull-requests"]`).click();
  await page.getByRole("button", {name: "New Pull Request", exact: true}).click();
  // PRCreateModal's From/Into labels are not associated with the selects.
  // Scope to its actual form, whose source/target order is defined in that component.
  const form = page.locator("form").filter({has: page.getByRole("textbox", {name: "Title", exact: true})});
  await expect(form.getByRole("combobox")).toHaveCount(2);
  await form.getByRole("combobox").nth(0).selectOption(branch);
  await form.getByRole("combobox").nth(1).selectOption("main");
  await form.getByRole("textbox", {name: "Title", exact: true}).fill("Review browser Person rename");
  await form.getByRole("button", {name: "Create Pull Request", exact: true}).click();
  await expect(page).toHaveURL(url => new RegExp(`/projects/${imported.id}/pull-requests/[0-9]+$`).test(url.pathname));
  const prPath = new URL(page.url()).pathname;
  await page.getByRole("button", {name: "Files Changed", exact: true}).click();
  const patch = page.locator("pre");
  await expect(patch).toContainText(/-.*"Test Person"@en/);
  await expect(patch).toContainText(new RegExp(`\\+.*"${label}"@en`));
  await page.getByRole("button", {name: "Merge", exact: true}).click();
  const mergeDialog = page.getByRole("dialog", {name: "Merge Pull Request"});
  await mergeDialog.getByRole("checkbox", {name: /Delete source branch/}).uncheck();
  const [mergeResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1${prPath}/merge` && response.request().method() === "POST"),
    mergeDialog.getByRole("button", {name: "Merge", exact: true}).click(),
  ]);
  expect(mergeResponse.status()).toBe(200);
  const merged = await mergeResponse.json() as {success: boolean; merge_commit_hash: string};
  expect(merged.success).toBe(true);
  await expect(mergeDialog).toBeHidden();
  await expect(page.getByText("Merged", {exact: true})).toBeVisible();
  const target = await readSource(api, imported.id);
  expect(target.revision).toBe(merged.merge_commit_hash);
  expect(target.content).toBe(saved.content);
  await waitForIndex(api, imported.id, "main", target.revision);

  // Navigate back to the retained source branch, then explicitly select main in UI.
  await page.goto(`${run.web}/projects/${imported.id}/editor?branch=${branch}`);
  await expect(branchButton(page, branch)).toBeVisible();
  await selectBranch(page, branch, "main");
  await page.reload();
  await expect(branchButton(page, "main")).toBeVisible();
  await page.getByRole("group", {name: "Editor mode"}).getByRole("button", {name: "Developer", exact: true}).click();
  await page.getByRole("button", {name: "Tree", exact: true}).click();
  const persistedPerson = page.getByRole("treeitem", {name: new RegExp(label)});
  await persistedPerson.click();
  await expect(persistedPerson).toHaveAttribute("aria-selected", "true");
  await expect(persistedPerson).toHaveAttribute("data-iri", `${ontologyNamespace}Person`);
  await expect(page.getByRole("button", {name: `Copy link to ${label}`, exact: true})).toBeVisible();
  await showSource(page);
  await findSourceText(page, `"${label}"@en`);
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(`"${label}"@en`);
  expect(await readSource(api, imported.id)).toEqual(target);
});
