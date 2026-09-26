// D09 U5: optional mode with an active provider (R4, R5). Real browser, real API and
// real disposable Zitadel. Each case starts in a fresh, anonymous browser context.
import { randomUUID } from "node:crypto";
import { seededProject } from "../fixtures/projects";
import {
  modeTest, expect, apiCall, completeProviderSignIn, fixtureName, gotoResolved, headerSignIn, observed,
  projectLink, projectPath, recordProbe, sessionUserId, startProposal,
} from "../fixtures/auth-mode";

const test = modeTest("optional-configured");
const PROFILE = "optional-configured";

test("anonymous visitor sees header sign-in and the public project but neither private fixture", async ({page, run}) => {
  const publicId = seededProject(run, "publicProject");
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, publicId));
  await expect(headerSignIn(page)).toBeVisible();
  for (const key of ["foreignPrivateProject", "personaPrivateProject"] as const) {
    await expect(projectLink(page, seededProject(run, key))).toHaveCount(0);
  }
  await page.getByRole("button", {name: "All", exact: true}).click();
  await expect(projectLink(page, publicId)).toBeVisible();
  for (const key of ["foreignPrivateProject", "personaPrivateProject"] as const) {
    await expect(projectLink(page, seededProject(run, key))).toHaveCount(0);
  }
  expect(await sessionUserId(page, run)).toBeNull();
});

test("foreign private denial Sign In completes real OIDC, returns to the original URL and stays denied", async ({page, run}) => {
  test.setTimeout(180_000);
  const foreignId = seededProject(run, "foreignPrivateProject");
  const denied = apiCall(page, run, "GET", projectPath(foreignId), {authorized: false});
  await gotoResolved(page, `${run.web}/projects/${foreignId}`, p => p.getByRole("main").getByRole("button", {name: "Sign In", exact: true}));
  recordProbe(PROFILE, "foreign-private-anonymous", await observed(await denied));

  const deniedAfter = apiCall(page, run, "GET", projectPath(foreignId), {authorized: true});
  await page.getByRole("main").getByRole("button", {name: "Sign In", exact: true}).click();
  await completeProviderSignIn(page, run);
  // signIn("zitadel") without a callback returns to the page that started it.
  await expect(page).toHaveURL(url => url.origin === run.web && url.pathname === `/projects/${foreignId}`, {timeout: 45_000});
  expect(await sessionUserId(page, run)).toBe(run.users.owner.id);
  recordProbe(PROFILE, "foreign-private-signed-in", await observed(await deniedAfter));
  await expect(page.getByRole("main").getByRole("button", {name: "Back to Projects", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {level: 1, name: fixtureName(run, "foreignPrivateProject")})).toHaveCount(0);
});

test("anonymous visitor starts a proposal session on a public project that the API accepts", async ({page, run, anonymousApi}) => {
  test.setTimeout(150_000);
  const response = await startProposal(page, run, anonymousApi, seededProject(run, "publicProject"));
  recordProbe(PROFILE, "anonymous-proposal-session", await observed(response));
  expect(await sessionUserId(page, run)).toBeNull();
});

test("after real sign-in the persona-owned private project is visible and a project create succeeds", async ({page, run}) => {
  test.setTimeout(180_000);
  const personaId = seededProject(run, "personaPrivateProject");
  const foreignId = seededProject(run, "foreignPrivateProject");
  const denied = apiCall(page, run, "GET", projectPath(personaId), {authorized: false});
  await gotoResolved(page, `${run.web}/projects/${personaId}`, p => p.getByRole("main").getByRole("button", {name: "Sign In", exact: true}));
  recordProbe(PROFILE, "persona-private-anonymous", await observed(await denied));

  const allowed = apiCall(page, run, "GET", projectPath(personaId), {authorized: true});
  await page.getByRole("main").getByRole("button", {name: "Sign In", exact: true}).click();
  await completeProviderSignIn(page, run);
  await expect(page).toHaveURL(url => url.origin === run.web && url.pathname === `/projects/${personaId}`, {timeout: 45_000});
  recordProbe(PROFILE, "persona-private-signed-in", await observed(await allowed));
  await expect(page.getByRole("heading", {level: 1, name: fixtureName(run, "personaPrivateProject")})).toBeVisible();

  // The authenticated home defaults to My Projects: own private project, never the foreign one.
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, personaId));
  await expect(projectLink(page, foreignId)).toHaveCount(0);

  await gotoResolved(page, `${run.web}/projects/new`, p => p.getByRole("button", {name: "Create Empty", exact: true}));
  await page.getByRole("button", {name: "Create Empty", exact: true}).click();
  await page.getByRole("textbox", {name: "Project Name"}).fill(`D09 created ${randomUUID()}`);
  const created = apiCall(page, run, "POST", "/api/v1/projects");
  await page.getByRole("button", {name: "Create Project", exact: true}).click();
  const response = await created;
  recordProbe(PROFILE, "project-create-signed-in", await observed(response));
  const project = await response.json() as {id: string};
  // Outer run cleanup removes the stack's volumes, including this project.
  await expect(page).toHaveURL(url => url.pathname === `/projects/${project.id}`, {timeout: 30_000});
});

test("sign-out returns the application to the anonymous state", async ({page, run}) => {
  test.setTimeout(180_000);
  const personaId = seededProject(run, "personaPrivateProject");
  await gotoResolved(page, `${run.web}/`, headerSignIn);
  await headerSignIn(page).click();
  await completeProviderSignIn(page, run);
  await expect(page).toHaveURL(url => url.origin === run.web && url.pathname === "/", {timeout: 45_000});
  const session = await (await page.request.get(`${run.web}/api/auth/session`)).json() as {user?: {id?: string; name?: string}};
  expect(session.user?.id).toBe(run.users.owner.id);
  const initial = session.user?.name?.charAt(0).toUpperCase() || "U";
  const account = page.getByRole("banner").getByRole("button", {name: initial, exact: true});
  await expect(account).toBeVisible();
  await expect(projectLink(page, personaId)).toBeVisible();

  // Federated logout leaves through the provider and lands back on the application:
  // wait for that NEW main-frame commit at the web origin.
  const landed = page.waitForEvent("framenavigated", {predicate: frame => frame === page.mainFrame() && new URL(frame.url()).origin === run.web, timeout: 45_000});
  await account.click();
  await page.getByRole("button", {name: "Sign out", exact: true}).click();
  await landed;
  await expect(headerSignIn(page)).toBeVisible({timeout: 45_000});
  expect(await sessionUserId(page, run)).toBeNull();
  await gotoResolved(page, `${run.web}/`, p => projectLink(p, seededProject(run, "publicProject")));
  await expect(headerSignIn(page)).toBeVisible();
  await expect(projectLink(page, personaId)).toHaveCount(0);
});
