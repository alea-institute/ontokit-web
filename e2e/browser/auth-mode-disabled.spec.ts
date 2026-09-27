// D09 U5: authentication disabled (R8, R9) is read-and-suggest only. No provider
// or authentication UI; the API refuses direct writes from its anonymous identity.
import { readSource, seededProject } from "../fixtures/projects";
import { waitForIndex } from "../fixtures/polling";
import {
  modeTest, expect, apiCall, directProbe, expectNoSignInControl, expectProvidersEmpty, fixtureName, gotoResolved,
  observed, projectLink, projectPath, recordProbe, sessionUserId, startProposal,
} from "../fixtures/auth-mode";
import type { Page } from "@playwright/test";

const test = modeTest("disabled");
const PROFILE = "disabled";
const DISABLED_WRITE_DETAIL = "Authentication is disabled on this deployment, so it is read-only apart from anonymous suggestions";

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
  // Personal tabs explain their unavailability without offering sign-in.
  for (const tab of ["My Projects", "Private"]) {
    await page.getByRole("button", {name: tab, exact: true}).click();
    await expect(page.getByRole("heading", {name: tab === "My Projects" ? "Your projects aren't available here" : "Private projects aren't available here"})).toBeVisible();
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

  await gotoResolved(page, `${run.web}/projects/new`, p => p.getByRole("heading", {name: "Project creation is unavailable"}));
  await expectNoAuthUi(page);
  await expect(page.locator("main form")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);

  for (const [route, landmark] of [
    ["/auth/signin", "Sign-in is unavailable"],
    // A stale provider error link must not offer a retry that cannot succeed.
    ["/auth/error?error=Configuration", "Sign-in is unavailable"],
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

test("project create, import and source save are refused by the API and the web explains they are unavailable", async ({page, run, anonymousApi}) => {
  test.setTimeout(150_000);
  await gotoResolved(page, `${run.web}/projects/new`, p => p.getByRole("heading", {name: "Project creation is unavailable"}));
  await expectNoAuthUi(page);
  await expect(page.locator("main form")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", {name: /Create Empty|Import from File|Clone from GitHub/})).toHaveCount(0);

  const publicId = seededProject(run, "publicProject");
  const original = await readSource(anonymousApi, publicId);
  await waitForIndex(anonymousApi, publicId, "main", original.revision);
  await gotoResolved(page, `${run.web}/projects/${publicId}/editor`, p => p.getByRole("treeitem", {name: /Test Person/}).first());
  await page.getByRole("treeitem", {name: /Test Person/}).first().click();
  await expect(page.getByRole("button", {name: "Propose Edit", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: /^(Save|Save & Commit)$/})).toHaveCount(0);
  await expectNoAuthUi(page);

  // The auth dependency refuses even an empty import before body validation.
  // Exact detail distinguishes the disabled-mode gate from an ownership-based 403.
  const create = await directProbe(anonymousApi, "POST", "/api/v1/projects", {name: "D09 refused create", is_public: true});
  expect(await create.json()).toHaveProperty("detail", DISABLED_WRITE_DETAIL);
  recordProbe(PROFILE, "project-create-disabled", create);
  const imported = await directProbe(anonymousApi, "POST", "/api/v1/projects/import");
  expect(await imported.json()).toHaveProperty("detail", DISABLED_WRITE_DETAIL);
  recordProbe(PROFILE, "project-import-disabled", imported);
  const saved = await directProbe(anonymousApi, "PUT", `${projectPath(publicId)}/source?branch=main`, {
    content: original.content + "\n# refused disabled-mode edit",
    commit_message: "D09 refused source save",
    base_revision: original.revision,
  });
  expect(await saved.json()).toHaveProperty("detail", DISABLED_WRITE_DETAIL);
  recordProbe(PROFILE, "source-save-disabled", saved);
  const after = await readSource(anonymousApi, publicId);
  expect(after.content).toBe(original.content);
  expect(after.revision).toBe(original.revision);
});
