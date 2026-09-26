// D09 U5 shared helpers for the three authentication-mode profiles.
//
// KTD8: absence assertions ("no sign-in control") are made only after a positive,
// resolved-state landmark AND after the page's own /api/auth/session request answered.
// KTD9: every refusal is observed with its tier, method, fixed path template, status and
// whether an Authorization header was sent; only those allowlisted values are recorded.
import { test as base, expect, type APIRequestContext, type Locator, type Page, type Response } from "@playwright/test";
import { MODE_CASES } from "../../scripts/e2e/evidence.mjs";
import { enterProviderCredentials } from "./auth";
import { loadModeRun, type ModeProfile, type ModeRunConfig, type ModeRunFor, type OptionalConfiguredRunConfig } from "./run";
import { readSource } from "./projects";
import { waitForIndex } from "./polling";

export const SESSION_PATH = "/api/auth/session";
// Any control that offers to sign in, whatever its exact copy ("Sign in", "Sign In",
// "Sign in to edit", "Sign in with Zitadel"). Explanatory text is not a control.
const SIGN_IN_NAME = /\bsign[\s-]?in\b/i;

interface ModeFixtures<P extends ModeProfile> {
  run: ModeRunFor<P>;
  anonymousApi: APIRequestContext;
}
/** A test object bound to one profile: its config loader rejects every other profile. */
export function modeTest<P extends ModeProfile>(profile: P) {
  return base.extend<ModeFixtures<P>>({
    run: async ({}, provide) => { await provide(loadModeRun(profile)); },
    anonymousApi: async ({playwright, run}, provide) => {
      // Explicitly no credentials of any kind.
      const api = await playwright.request.newContext({baseURL: run.api, extraHTTPHeaders: {}});
      try { await provide(api); } finally { await api.dispose(); }
    },
  });
}

// ---- KTD9 evidence ----
interface Observed { status: number; authorization: boolean }
type ProbeSpec = (typeof MODE_CASES)[ModeProfile][number]["probes"][number];
function probeFor(profile: ModeProfile, name: string): ProbeSpec {
  const title = base.info().title;
  const found = MODE_CASES[profile].find(c => c.title === title)?.probes.find(p => p.probe === name);
  if (!found) throw new Error(`Probe ${name} is not in the ${profile} inventory for this case`);
  return found;
}
/** Asserts the observed tier result equals the inventory entry, then records that entry. */
export function recordProbe(profile: ModeProfile, name: string, observed: Observed) {
  const spec = probeFor(profile, name);
  expect(observed.status, `${name}: ${spec.method} ${spec.path} status`).toBe(spec.status);
  expect(observed.authorization, `${name}: Authorization header present`).toBe(spec.authorization);
  const entry = {probe: spec.probe, tier: spec.tier, method: spec.method, path: spec.path, status: observed.status, authorization: observed.authorization};
  base.info().annotations.push({type: "mode-evidence", description: JSON.stringify(entry)});
  // Labels, numbers and booleans only, so the private runner log can carry it.
  console.log(`mode-evidence ${JSON.stringify(entry)}`);
}
/** Observed values for a browser-issued request; the header value itself is never read out. */
export async function observed(response: Response): Promise<Observed> {
  return {status: response.status(), authorization: (await response.request().headerValue("authorization")) !== null};
}
/** Waits for the browser's own API call (the tier that decides), not a web-only redirect. */
export function apiCall(page: Page, run: ModeRunConfig, method: string, pathname: string, {authorized}: {authorized?: boolean} = {}) {
  const origin = new URL(run.api).origin;
  return page.waitForResponse(async response => {
    const url = new URL(response.url());
    if (url.origin !== origin || url.pathname !== pathname || response.request().method() !== method) return false;
    if (authorized === undefined) return true;
    return ((await response.request().headerValue("authorization")) !== null) === authorized;
  }, {timeout: 45_000});
}
/** Direct API probe for actions the UI does not offer (no Authorization header at all). */
export async function directProbe(api: APIRequestContext, method: "GET" | "POST", path: string, data?: unknown): Promise<Observed> {
  const response = method === "GET" ? await api.get(path) : await api.post(path, {data: data ?? {}});
  return {status: response.status(), authorization: false};
}

// ---- KTD8 resolved session ----
/** Navigates, then waits for the page's session request and a positive landmark. */
export async function gotoResolved(page: Page, url: string, landmark: (page: Page) => Locator) {
  const session = page.waitForResponse(response => new URL(response.url()).pathname === SESSION_PATH, {timeout: 30_000});
  await page.goto(url);
  expect((await session).status(), "session endpoint answered").toBe(200);
  await expect(landmark(page)).toBeVisible();
  // The UserMenu skeleton is the only loading placeholder in the header.
  await expect(page.getByRole("banner").locator(".animate-pulse")).toHaveCount(0);
}
export const signInControls = (page: Page) => page.getByRole("button", {name: SIGN_IN_NAME}).or(page.getByRole("link", {name: SIGN_IN_NAME}));
/** Only valid after gotoResolved (or another resolved landmark) on the current page. */
export async function expectNoSignInControl(page: Page) {
  await expect(signInControls(page)).toHaveCount(0);
}
export const headerSignIn = (page: Page) => page.getByRole("banner").getByRole("button", {name: "Sign in", exact: true});
export async function expectProvidersEmpty(page: Page, run: ModeRunConfig) {
  const response = await page.request.get(`${run.web}/api/auth/providers`);
  expect(await response.json(), "no provider is offered").toEqual({});
  recordProbe(run.profile, "providers-empty", {status: response.status(), authorization: false});
}

// ---- Shared journeys ----
export const projectPath = (id: string) => `/api/v1/projects/${id}`;
export const projectLink = (page: Page, id: string) => page.locator(`main a[href="/projects/${id}"]`);
export const fixtureName = (run: ModeRunConfig, key: string) => `D09 ${key} ${run.id.slice(0, 8)}`;

/**
 * Anonymous proposal session on a public project through the editor's own "Propose Edit"
 * control. Returns the browser's POST response for the anonymous session endpoint.
 */
export async function startProposal(page: Page, run: ModeRunConfig, api: APIRequestContext, projectId: string) {
  const source = await readSource(api, projectId);
  await waitForIndex(api, projectId, "main", source.revision);
  await gotoResolved(page, `${run.web}/projects/${projectId}/editor`, p => p.getByRole("treeitem", {name: /Test Person/}).first());
  const person = page.getByRole("treeitem", {name: /Test Person/}).first();
  await person.click();
  await expect(person).toHaveAttribute("aria-selected", "true");
  const created = apiCall(page, run, "POST", `${projectPath(projectId)}/suggestions/anonymous/sessions`);
  await page.getByRole("button", {name: "Propose Edit", exact: true}).click();
  return await created;
}

/** Completes a real OIDC flow that the application already started; returns at the web origin. */
export async function completeProviderSignIn(page: Page, run: OptionalConfiguredRunConfig) {
  await expect(page).toHaveURL(url => url.origin === new URL(run.login).origin, {timeout: 45_000});
  await enterProviderCredentials(page, {login: run.login, web: run.web, user: run.users.owner});
}
export async function sessionUserId(page: Page, run: ModeRunConfig): Promise<string | null> {
  const response = await page.request.get(`${run.web}${SESSION_PATH}`);
  expect(response.status()).toBe(200);
  const body = await response.json() as { user?: { id?: string } } | null;
  return body?.user?.id ?? null;
}
export { expect };
