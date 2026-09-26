// D09 U5: optional mode without an identity provider (R6, R7) — what external operators
// of the published image get. No Zitadel, no Login, no bearer tokens anywhere.
import { readSource, seededProject } from "../fixtures/projects";
import { waitForIndex } from "../fixtures/polling";
import {
  modeTest, expect, apiCall, directProbe, expectNoSignInControl, expectProvidersEmpty, fixtureName, gotoResolved,
  observed, projectLink, projectPath, recordProbe, sessionUserId, startProposal,
} from "../fixtures/auth-mode";

const test = modeTest("optional-anonymous");
const PROFILE = "optional-anonymous";

test("providers are empty and no sign-in control appears on any reachable inventoried route", async ({page, run, anonymousApi}) => {
  test.setTimeout(180_000);
  const publicId = seededProject(run, "publicProject");
  const foreignId = seededProject(run, "foreignPrivateProject");
  await expectProvidersEmpty(page, run);

  // Home: public list, then both private tabs explain instead of offering sign-in.
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, publicId));
  await expectNoSignInControl(page);
  await page.getByRole("button", {name: "My Projects", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Your projects aren't available here"})).toBeVisible();
  await expectNoSignInControl(page);
  await page.getByRole("button", {name: "Private", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Private projects aren't available here"})).toBeVisible();
  await expectNoSignInControl(page);

  // Private project denial: the API refuses, and the page explains without a control.
  const denied = apiCall(page, run, "GET", projectPath(foreignId));
  await gotoResolved(page, `${run.web}/projects/${foreignId}`, p => p.getByRole("heading", {name: "This is a private project"}));
  recordProbe(PROFILE, "foreign-private-anonymous", await observed(await denied));
  await expect(page.getByText("Sign-in is unavailable in this configuration, so private projects can't be opened here.")).toBeVisible();
  await expectNoSignInControl(page);

  // Viewer: a read-only note replaces "Sign in to edit".
  await gotoResolved(page, `${run.web}/projects/${publicId}`, p => p.getByTestId("viewer-sign-in-unavailable"));
  await expectNoSignInControl(page);

  // Editor (propose mode for a public project).
  await waitForIndex(anonymousApi, publicId, "main", (await readSource(anonymousApi, publicId)).revision);
  await gotoResolved(page, `${run.web}/projects/${publicId}/editor`, p => p.getByRole("treeitem", {name: /Test Person/}).first());
  await expectNoSignInControl(page);

  for (const [route, landmark] of [
    ["/projects/new", "Project creation is unavailable"],
    ["/auth/signin", "Sign-in is unavailable"],
    // A stale provider error link must not offer a retry that cannot succeed.
    ["/auth/error?error=Configuration", "Sign-in is unavailable"],
    ["/pr-party", "PR Party is unavailable here"],
    ["/pr-party/settings", "Review settings are unavailable here"],
  ] as const) {
    await gotoResolved(page, `${run.web}${route}`, p => p.getByRole("heading", {name: landmark}));
    await expectNoSignInControl(page);
  }
  await expect(page.getByRole("banner").getByRole("link", {name: "Review", exact: true})).toHaveCount(0);
  expect(await sessionUserId(page, run)).toBeNull();
});

test("public browsing and an anonymous proposal work while private access and API create are refused", async ({page, run, anonymousApi}) => {
  test.setTimeout(150_000);
  const publicId = seededProject(run, "publicProject");
  const foreignId = seededProject(run, "foreignPrivateProject");
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, publicId));
  await expect(projectLink(page, foreignId)).toHaveCount(0);
  await projectLink(page, publicId).first().click();
  await expect(page.getByRole("heading", {level: 1, name: fixtureName(run, "publicProject")})).toBeVisible();

  // The viewer offers no switcher here, so the editor is opened directly.
  recordProbe(PROFILE, "anonymous-proposal-session", await observed(await startProposal(page, run, anonymousApi, publicId)));

  const denied = apiCall(page, run, "GET", projectPath(foreignId));
  await gotoResolved(page, `${run.web}/projects/${foreignId}`, p => p.getByRole("heading", {name: "This is a private project"}));
  recordProbe(PROFILE, "foreign-private-anonymous", await observed(await denied));
  await expectNoSignInControl(page);

  // No create entry point exists in this mode; the API itself refuses an anonymous create.
  recordProbe(PROFILE, "project-create-anonymous", await directProbe(anonymousApi, "POST", "/api/v1/projects", {name: "D09 anonymous create probe", is_public: true}));
});
