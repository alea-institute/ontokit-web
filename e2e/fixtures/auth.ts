import { test as base, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { loadRun, authPath, sessionPath, type Persona, type RunConfig } from "./run";

export interface Session { accessToken: string; user: { id: string; email: string }; error?: string }
async function completeSignIn(page: Page, run: RunConfig, persona: Persona): Promise<Session> {
  await page.goto(`${run.web}/auth/signin?callbackUrl=${encodeURIComponent(`${run.web}/`)}`);
  await page.getByRole("button", { name: "Sign in with Zitadel" }).click();
  await expect(page).toHaveURL(url => url.origin === new URL(run.login).origin);
  await page.getByTestId("username-text-input").fill(run.users[persona].email);
  await page.getByTestId("submit-button").click();
  await expect(page.getByTestId("password-text-input")).toBeVisible({timeout: 30_000});
  await page.getByTestId("password-text-input").fill(run.users[persona].password);
  await page.getByTestId("submit-button").click();
  await expect(page).toHaveURL(url => (url.origin === run.web && url.pathname === "/") || (url.origin === new URL(run.login).origin && url.pathname.endsWith("/mfa/set")), {timeout: 45_000});
  if (new URL(page.url()).pathname.endsWith("/mfa/set")) {
    // Optional enrollment is not authentication bypass. Never click password-reset.
    const skip = page.getByTestId("reset-button");
    await expect(skip).toHaveText(/skip/i);
    await skip.click();
  }
  await expect(page).toHaveURL(url => url.origin === run.web && url.pathname === "/", {timeout: 45_000});
  const response = await page.request.get(`${run.web}/api/auth/session`);
  expect(response.status()).toBe(200);
  const session = await response.json() as Session;
  // Never assert on the token's value: failed assertions can serialize secrets.
  expect(Boolean(session.accessToken && !session.error)).toBe(true);
  expect(session.user.id).toBe(run.users[persona].id);
  expect(session.user.email).toBe(run.users[persona].email);
  return session;
}
// Failed locator operations do not report the surrounding Login UI. Capture only
// bounded diagnostic state inside the private run log; never print it to stdout.
async function recordSignInFailure(page: Page, run: RunConfig, persona: Persona) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inspection: unknown;
  try {
    inspection = await Promise.race([
      page.evaluate(() => ({
        testIds: Array.from(document.querySelectorAll("[data-testid]")).slice(0, 100).map(element => element.getAttribute("data-testid")?.slice(0, 100)),
        errors: Array.from(document.querySelectorAll('[data-testid*="error"], [role="alert"]'))
          .filter(element => element instanceof HTMLElement && element.checkVisibility())
          .slice(0, 16).map(element => element.textContent?.slice(0, 500)),
      })),
      new Promise(resolve => { timer = setTimeout(() => resolve({inspectionUnavailable: true}), 2000); }),
    ]);
  } catch { inspection = {inspectionUnavailable: true}; }
  finally { if (timer) clearTimeout(timer); }
  const url = new URL(page.url());
  const file = await fs.open(path.join(run.dir, "private.log"), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077)) throw new Error("Unsafe private sign-in diagnostic log");
    await file.write(`\nPrivate sign-in failure: ${JSON.stringify({persona, origin: url.origin, pathname: url.pathname.slice(0, 2048), query: url.search.slice(0, 8192), inspection})}\n`);
  } finally { await file.close(); }
}
export async function signIn(page: Page, run: RunConfig, persona: Persona): Promise<Session> {
  try { return await completeSignIn(page, run, persona); }
  catch (error) {
    try { await recordSignInFailure(page, run, persona); } catch { /* Original failure and outer cleanup take precedence. */ }
    throw error;
  }
}
export async function saveAuthenticatedPersona(browser: Browser, run: RunConfig, persona: Persona) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const session = await signIn(page, run, persona);
    await context.storageState({path: authPath(run, persona)});
    await fs.writeFile(sessionPath(run, persona), JSON.stringify(session), {mode: 0o600});
  } finally { await context.close(); }
}
export async function loadSession(run: RunConfig, persona: Persona): Promise<Session> {
  return JSON.parse(await fs.readFile(sessionPath(run, persona), "utf8")) as Session;
}
export const test = base.extend<{ run: RunConfig; ownerApi: APIRequestContext; unrelatedApi: APIRequestContext; anonymousApi: APIRequestContext }>({
  run: async ({}, provide) => { await provide(loadRun()); },
  ownerApi: async ({playwright, run}, provide) => {
    const session = await loadSession(run, "owner");
    const api = await playwright.request.newContext({baseURL: run.api, extraHTTPHeaders: {Authorization: `Bearer ${session.accessToken}`}});
    try { await provide(api); } finally { await api.dispose(); }
  },
  unrelatedApi: async ({playwright, run}, provide) => {
    const session = await loadSession(run, "unrelated");
    const api = await playwright.request.newContext({baseURL: run.api, extraHTTPHeaders: {Authorization: `Bearer ${session.accessToken}`}});
    try { await provide(api); } finally { await api.dispose(); }
  },
  anonymousApi: async ({playwright, run}, provide) => {
    const api = await playwright.request.newContext({baseURL: run.api});
    try { await provide(api); } finally { await api.dispose(); }
  },
});
export { expect } from "@playwright/test";
