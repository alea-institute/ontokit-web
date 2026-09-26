// D09 U5: authentication disabled (R8, R9). No provider, no authentication UI, and every
// caller is the API's shared anonymous identity. Disabled mode is supported only for a
// single-user deployment that is not network-exposed; this stack is loopback-only.
import { randomUUID } from "node:crypto";
import { readSource, seededProject, tinyOntologyPath } from "../fixtures/projects";
import { waitForIndex } from "../fixtures/polling";
import { findSourceText, replaceSourceLabel, showSource } from "../fixtures/editor";
import {
  modeTest, expect, apiCall, directProbe, expectNoSignInControl, expectProvidersEmpty, fixtureName, gotoResolved,
  observed, projectLink, projectPath, recordProbe, sessionUserId, startProposal,
} from "../fixtures/auth-mode";
import type { Page } from "@playwright/test";

const test = modeTest("disabled");
const PROFILE = "disabled";

async function expectNoAuthUi(page: Page) {
  await expectNoSignInControl(page);
  await expect(page.getByRole("button", {name: "Sign out", exact: true})).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", {name: "Review", exact: true})).toHaveCount(0);
}
const noPullRequestEntry = async (page: Page) => {
  await expect(page.getByRole("button", {name: /New Pull Request|Create Pull Request/})).toHaveCount(0);
  await expect(page.locator('a[href^="/pr-party"]')).toHaveCount(0);
};

test("providers are empty and no authentication UI appears on any reachable inventoried route", async ({page, run, anonymousApi}) => {
  test.setTimeout(180_000);
  const publicId = seededProject(run, "publicProject");
  const foreignId = seededProject(run, "foreignPrivateProject");
  await expectProvidersEmpty(page, run);

  await gotoResolved(page, `${run.web}/`, p => projectLink(p, publicId));
  await expectNoAuthUi(page);
  // A single-user workspace: My Projects and Private list the anonymous owner's projects
  // (none yet) rather than asking anyone to sign in.
  for (const tab of ["My Projects", "Private"]) {
    await page.getByRole("button", {name: tab, exact: true}).click();
    await expect(projectLink(page, publicId).or(page.getByRole("heading", {name: /^No (private )?projects yet$/}))).toBeVisible();
    await expect(projectLink(page, foreignId)).toHaveCount(0);
    await expectNoAuthUi(page);
  }

  const denied = apiCall(page, run, "GET", projectPath(foreignId));
  await gotoResolved(page, `${run.web}/projects/${foreignId}`, p => p.getByRole("heading", {name: "This is a private project"}));
  recordProbe(PROFILE, "foreign-private-anonymous", await observed(await denied));
  await expectNoAuthUi(page);

  await gotoResolved(page, `${run.web}/projects/${publicId}`, p => p.getByRole("heading", {level: 1, name: fixtureName(run, "publicProject")}));
  await expectNoAuthUi(page);

  await waitForIndex(anonymousApi, publicId, "main", (await readSource(anonymousApi, publicId)).revision);
  await gotoResolved(page, `${run.web}/projects/${publicId}/editor`, p => p.getByRole("treeitem", {name: /Test Person/}).first());
  await expectNoAuthUi(page);

  await gotoResolved(page, `${run.web}/projects/new`, p => p.getByRole("button", {name: "Create Empty", exact: true}));
  await expectNoAuthUi(page);
  await page.getByRole("button", {name: "Clone from GitHub", exact: true}).click();
  await expect(page.getByText("Cloning from GitHub is unavailable in this configuration.")).toBeVisible();

  for (const [route, landmark] of [
    ["/auth/signin", "Sign-in is unavailable"],
    ["/pr-party", "PR Party is unavailable here"],
    ["/pr-party/settings", "Review settings are unavailable here"],
  ] as const) {
    await gotoResolved(page, `${run.web}${route}`, p => p.getByRole("heading", {name: landmark}));
    await expectNoAuthUi(page);
  }
  expect(await sessionUserId(page, run)).toBeNull();
});

test("public browsing and proposal work while PR create and duplicate check are refused and PR Party is absent", async ({page, run, anonymousApi}) => {
  test.setTimeout(150_000);
  const publicId = seededProject(run, "publicProject");
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, publicId));
  await projectLink(page, publicId).first().click();
  await expect(page.getByRole("heading", {level: 1, name: fixtureName(run, "publicProject")})).toBeVisible();
  await noPullRequestEntry(page);

  recordProbe(PROFILE, "anonymous-proposal-session", await observed(await startProposal(page, run, anonymousApi, publicId)));
  await noPullRequestEntry(page);

  // The UI offers neither action, so the refusal is proven at the API tier directly.
  recordProbe(PROFILE, "pull-request-create", await directProbe(anonymousApi, "POST", `${projectPath(publicId)}/pull-requests`, {title: "D09 disabled PR probe", source_branch: "d09-probe", target_branch: "main"}));
  recordProbe(PROFILE, "duplicate-check", await directProbe(anonymousApi, "POST", `${projectPath(publicId)}/duplicate-check`, {label: "Test Person", entity_type: "class"}));
  // PR Party is not mounted at all in disabled mode.
  recordProbe(PROFILE, "pr-party-queue", await directProbe(anonymousApi, "GET", "/api/v1/pr-party/queue"));
  await gotoResolved(page, `${run.web}/pr-party`, p => p.getByRole("heading", {name: "PR Party is unavailable here"}));
  await expect(page.getByRole("banner").getByRole("link", {name: "Review", exact: true})).toHaveCount(0);
});

// Provisional (U4, disabled mode as a single-user workspace). Remove this describe with
// U4 if the disabled-mode decision changes.
test.describe("provisional single-user workspace", () => {
  test("a project imported in the browser opens in the editor and an edit saves without a bearer token", async ({page, run, anonymousApi}) => {
    test.setTimeout(240_000);
    const label = "Disabled Mode Person";
    await gotoResolved(page, `${run.web}/projects/new`, p => p.getByRole("button", {name: "Import from File", exact: true}));
    await page.getByRole("button", {name: "Import from File", exact: true}).click();
    await page.locator('input[type="file"]').setInputFiles(tinyOntologyPath);
    await page.getByRole("textbox", {name: "Project Name"}).fill(`D09 disabled import ${randomUUID()}`);
    const imported = apiCall(page, run, "POST", "/api/v1/projects/import");
    await page.getByRole("button", {name: "Import Project", exact: true}).click();
    const importResponse = await imported;
    recordProbe(PROFILE, "project-import-tokenless", await observed(importResponse));
    const {id} = await importResponse.json() as {id: string};
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page).toHaveURL(url => url.pathname === `/projects/${id}`, {timeout: 30_000});

    const original = await readSource(anonymousApi, id);
    await waitForIndex(anonymousApi, id, "main", original.revision);
    // The API grants the anonymous owner edit rights; the editor must not redirect away.
    await gotoResolved(page, `${run.web}/projects/${id}/editor`, p => p.getByRole("group", {name: "Editor mode"}));
    await expect(page).toHaveURL(url => url.pathname === `/projects/${id}/editor`);
    await showSource(page);
    await replaceSourceLabel(page, "Test Person", label);
    await page.getByRole("button", {name: "Save", exact: true}).click();
    const dialog = page.getByRole("dialog", {name: "Save Changes"});
    await dialog.getByPlaceholder("Describe your changes...").fill("Rename Person without a bearer token");
    const saved = apiCall(page, run, "PUT", `${projectPath(id)}/source`);
    await dialog.getByRole("button", {name: "Save & Commit", exact: true}).click();
    recordProbe(PROFILE, "source-save-tokenless", await observed(await saved));
    await expect(dialog).toBeHidden();

    const after = await readSource(anonymousApi, id);
    expect(after.content).toBe(original.content.replace('"Test Person"@en', `"${label}"@en`));
    expect(after.revision).not.toBe(original.revision);
    await page.reload();
    await showSource(page);
    await findSourceText(page, label);
  });
});
