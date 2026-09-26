// Browser lifecycle helpers for the D08 lifecycle profile (U3).
//
// Evidence rules (R7): credential values (access tokens, cookies, refresh tokens)
// stay in memory. Assertions compare booleans, numbers, subjects and URLs only, so a
// failure message can never serialize a credential into the private report.
import { setTimeout as delay } from "node:timers/promises";
import { test as base, expect, type BrowserContext, type Page, type Request, type Response } from "@playwright/test";
import { enterProviderCredentials } from "./auth";
import { loadLifecycleRun, resetAuthClock, setAuthClockOffset, type LifecycleRunConfig } from "./run";
import { cookieCleared, cookieExpiresMs, decodeJwtClaims, parseSetCookie } from "../../scripts/e2e/auth-lifecycle.mjs";

export const SESSION_PATH = "/api/auth/session";
export const CALLBACK_PATH = "/api/auth/callback/zitadel";
export const PROVIDER_SIGNIN_PATH = "/api/auth/signin/zitadel";
/** Existing protected user operation the settings page performs with the session bearer. */
export const PROTECTED_PATH = "/api/v1/users/me/commit-identity";
export const END_SESSION_PATH = "/oidc/v1/end_session";
export const SESSION_COOKIE = /^authjs\.session-token(?:\.\d{1,2})?$/;

export interface BrowserSession { user?: { id?: string; name?: string | null; email?: string | null }; expires?: string; accessToken?: string; error?: string }
export interface Claims { sub: string; iat: number; exp: number }
/** A genuinely issued application cookie, kept only in memory. */
export interface CookieSpecimen { cookies: { name: string; value: string; expires: number }[]; expiresMs: number }

/** Decodes JWT claims in memory; the token never appears in a thrown message. */
export function jwtClaims(token: string | undefined): Claims {
  const decoded = decodeJwtClaims(token);
  const claims = decoded.ok ? decoded.claims as Partial<Claims> | null : undefined;
  if (!claims || typeof claims.sub !== "string" || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)) {
    throw new Error("Lifecycle bearer is not a JWT with sub/iat/exp claims");
  }
  return claims as Claims;
}
async function bearerOf(request: Request): Promise<string | undefined> {
  const header = (await request.allHeaders()).authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

/**
 * In-memory record of the browser's auth-relevant traffic: application session
 * fetches, Auth.js provider sign-in initiations, provider authorization, Login UI
 * documents and OIDC callbacks. Holds counts and pathnames only.
 */
export class FlowRecorder {
  sessionFetches = 0;
  providerSignIns = 0;
  authorizations = 0;
  loginDocuments = 0;
  callbacks = 0;
  private waiters: { after: number; resolve: () => void }[] = [];
  constructor(page: Page, run: LifecycleRunConfig) {
    const web = run.web;
    const issuer = new URL(run.issuer).origin;
    const login = new URL(run.login).origin;
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.origin === web && url.pathname === SESSION_PATH && request.method() === "GET") this.sessionFetches += 1;
      if (url.origin === web && url.pathname === PROVIDER_SIGNIN_PATH && request.method() === "POST") this.providerSignIns += 1;
      if (url.origin === issuer && url.pathname === "/oauth/v2/authorize") this.authorizations += 1;
      if (url.origin === login && request.isNavigationRequest()) this.loginDocuments += 1;
      if (url.origin === web && url.pathname === CALLBACK_PATH) {
        this.callbacks += 1;
        this.waiters = this.waiters.filter(waiter => { if (this.callbacks > waiter.after) { waiter.resolve(); return false; } return true; });
      }
    });
  }
  /** Resolves once an OIDC callback beyond `after` has been requested (checked immediately). */
  callbackAfter(after: number, timeout: number) {
    if (this.callbacks > after) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters = this.waiters.filter(waiter => waiter.resolve !== done); reject(new Error("OIDC callback not observed in time")); }, timeout);
      const done = () => { clearTimeout(timer); resolve(); };
      this.waiters.push({after, resolve: done});
    });
  }
  snapshot() { return {sessionFetches: this.sessionFetches, providerSignIns: this.providerSignIns, authorizations: this.authorizations, loginDocuments: this.loginDocuments, callbacks: this.callbacks}; }
}

const isWeb = (run: LifecycleRunConfig, response: Response, pathname: string, method = "GET") => {
  const url = new URL(response.url());
  return url.origin === run.web && url.pathname === pathname && response.request().method() === method;
};
const isApi = (run: LifecycleRunConfig, response: Response, pathname: string) => {
  const url = new URL(response.url());
  return url.origin === run.api && url.pathname === pathname && response.request().method() === "GET";
};

/** Waits for the browser's own SessionProvider fetch matching `when`. */
export function browserSession(page: Page, run: LifecycleRunConfig, when: () => boolean = () => true, timeout = 45_000) {
  return page.waitForResponse(response => isWeb(run, response, SESSION_PATH) && when(), {timeout}).then(async response => {
    expect(response.status(), "application session endpoint status").toBe(200);
    return {response, body: await response.json() as BrowserSession | null};
  });
}
/** Waits for the browser's protected API operation matching `when`; returns only derived facts. */
export function protectedOperation(page: Page, run: LifecycleRunConfig, when: () => boolean = () => true, timeout = 45_000) {
  return page.waitForResponse(response => isApi(run, response, PROTECTED_PATH) && when(), {timeout}).then(async response => {
    const bearer = await bearerOf(response.request());
    const claims = bearer ? jwtClaims(bearer) : undefined;
    return {status: response.status(), bearer, claims};
  });
}

/** Validates a browser session body against the lifecycle persona without exposing credentials. */
export function expectActiveSession(body: BrowserSession | null, run: LifecycleRunConfig) {
  expect(body !== null, "browser holds an application session").toBe(true);
  expect(body?.user?.id, "session subject").toBe(run.users.lifecycle.id);
  expect(body?.error ?? null, "session error").toBeNull();
  expect(Boolean(body?.accessToken), "session carries an access credential").toBe(true);
  expect(Number.isFinite(Date.parse(body?.expires ?? "")), "session expiry is a date").toBe(true);
}
/** Next worker Auth.js clock minus host clock, via `expires = workerNow + maxAge`. */
export function workerSkewMs(body: BrowserSession | null, run: LifecycleRunConfig, requestedAt: number, respondedAt: number) {
  const expires = Date.parse(body?.expires ?? "");
  if (!Number.isFinite(expires)) throw new Error("Lifecycle session expiry unobservable");
  return expires - run.lifecycle.sessionMaxAgeSeconds * 1000 - (requestedAt + respondedAt) / 2;
}
/** Worker skew of a browser session response, timed by the browser's own request timing. */
export async function responseSkewMs(response: Response, body: BrowserSession | null, run: LifecycleRunConfig) {
  await response.finished();
  const timing = response.request().timing();
  const end = timing.responseEnd > 0 ? timing.responseEnd : Math.max(timing.responseStart, 0);
  return workerSkewMs(body, run, timing.startTime, timing.startTime + end);
}

/** The header account control, whose accessible name is the session user's initial. */
export function accountControl(page: Page, body: BrowserSession | null) {
  const initial = body?.user?.name?.charAt(0).toUpperCase() || "U";
  return page.getByRole("banner").getByRole("button", {name: initial, exact: true});
}
export const signInControl = (page: Page) => page.getByRole("banner").getByRole("button", {name: "Sign in", exact: true});

/**
 * Follows an OIDC flow that something else already initiated (the sign-in page,
 * the user menu or SessionGuard). Legitimate provider SSO completes without any
 * credential screen; otherwise the persona's credentials are entered. With
 * `requireInteraction`, a callback that arrives before any credential screen is a
 * silent session reuse and fails the case.
 */
export async function followProviderFlow(page: Page, run: LifecycleRunConfig, recorder: FlowRecorder, {requireInteraction = false, since = recorder.callbacks, timeout = 60_000} = {}) {
  const callback = recorder.callbackAfter(since, timeout);
  const credentialScreen = page.getByTestId("username-text-input").or(page.getByTestId("password-text-input")).first()
    .waitFor({state: "visible", timeout});
  callback.catch(() => undefined);
  credentialScreen.catch(() => undefined);
  const first = await Promise.race([callback.then(() => "callback" as const), credentialScreen.then(() => "credentials" as const)]);
  if (first === "callback") {
    expect(requireInteraction, "provider reused a session silently where identity interaction was required").toBe(false);
    await page.waitForLoadState("load");
    return {interactive: false};
  }
  expect(recorder.callbacks, "no callback before the credential screen").toBe(since);
  await enterProviderCredentials(page, {login: run.login, web: run.web, user: run.users.lifecycle});
  await callback;
  await page.waitForLoadState("load");
  return {interactive: true};
}

/**
 * Starts OIDC from the application's own sign-in page, then follows the provider.
 * Resolves with the session response the landing page's SessionProvider fetched,
 * the application cookies issued by the OIDC callback (a genuine specimen, never
 * a later renewal), and whether credentials were entered.
 */
export async function signInFromApp(page: Page, run: LifecycleRunConfig, recorder: FlowRecorder, {callbackPath = "/", requireInteraction = false} = {}) {
  let issued: CookieSpecimen | undefined;
  const capture = (response: Response) => {
    const url = new URL(response.url());
    if (url.origin !== run.web || url.pathname !== CALLBACK_PATH) return;
    void response.headersArray().then(headers => { issued = parseIssuedCookies(headers, Date.now()); }).catch(() => undefined);
  };
  page.on("response", capture);
  try {
    await page.goto(`${run.web}/auth/signin?callbackUrl=${encodeURIComponent(`${run.web}${callbackPath}`)}`);
    const callbacksBefore = recorder.callbacks;
    const landing = browserSession(page, run, () => recorder.callbacks > callbacksBefore, 90_000);
    landing.catch(() => undefined);
    await page.getByRole("button", {name: "Sign in with Zitadel"}).click();
    const flow = await followProviderFlow(page, run, recorder, {requireInteraction});
    await expect(page).toHaveURL(`${run.web}${callbackPath}`, {timeout: 45_000});
    const session = await landing;
    expectActiveSession(session.body, run);
    return {...flow, session: session.body, sessionResponse: session.response, issued};
  } finally { page.off("response", capture); }
}

/** Parses Set-Cookie headers for non-empty Auth.js session cookies with an expiry. */
export function parseIssuedCookies(headers: { name: string; value: string }[], now: number): CookieSpecimen | undefined {
  const cookies: CookieSpecimen["cookies"] = [];
  for (const header of headers) {
    if (header.name.toLowerCase() !== "set-cookie") continue;
    const {name, value, separator, attributes} = parseSetCookie(header.value);
    if (separator < 1 || !SESSION_COOKIE.test(name) || !value) continue;
    const expiresMs = cookieExpiresMs(attributes, now);
    if (!Number.isFinite(expiresMs) || expiresMs <= now) continue;
    cookies.push({name, value, expires: Math.floor(expiresMs / 1000)});
  }
  if (!cookies.length) return undefined;
  return {cookies, expiresMs: Math.min(...cookies.map(cookie => cookie.expires * 1000))};
}
/** True when every named cookie is cleared (Max-Age<=0 or past Expires) by these headers. */
export function clearsAll(headers: { name: string; value: string }[], names: string[], now: number) {
  const cleared = new Set<string>();
  for (const header of headers) {
    if (header.name.toLowerCase() !== "set-cookie") continue;
    const {name, attributes} = parseSetCookie(header.value);
    if (cookieCleared(attributes, now)) cleared.add(name);
  }
  return names.every(name => cleared.has(name));
}
/** Replaces the jar's application session cookies with exactly this specimen. */
export async function installSpecimen(context: BrowserContext, run: LifecycleRunConfig, specimen: CookieSpecimen) {
  await context.clearCookies({name: SESSION_COOKIE});
  await context.addCookies(specimen.cookies.map(cookie => ({...cookie, url: run.web, httpOnly: true, sameSite: "Lax" as const})));
}
export async function jarSessionCookies(context: BrowserContext, run: LifecycleRunConfig): Promise<CookieSpecimen["cookies"]> {
  return (await context.cookies(run.web)).filter(cookie => SESSION_COOKIE.test(cookie.name)).map(({name, value, expires}) => ({name, value, expires}));
}

/**
 * Real elapsed-time wait (KTD2) until `untilMs` on the host clock. Bounded by the
 * caller's observed provider expiry plus the documented grace; the test timeout
 * cancels it, and fixture teardown still runs.
 */
export async function waitUntil(untilMs: number) {
  const remaining = untilMs - Date.now();
  if (remaining > 0) await delay(remaining);
}
/** Writes a controlled Next clock offset and gives the preload time to observe it. */
export async function applyClockOffset(run: LifecycleRunConfig, offsetMs: number) {
  setAuthClockOffset(run, Math.max(0, Math.round(offsetMs)));
  // The preload re-reads its control at most every 20ms; callers still observe Auth.js.
  await delay(250);
}
/** Per-case evidence recorded as a Playwright annotation: numbers and booleans only. */
export function recordEvidence(evidence: Record<string, number | boolean | string>) {
  for (const value of Object.values(evidence)) {
    if (typeof value === "string" && !/^[a-z0-9-]{1,40}$/.test(value)) throw new Error("Lifecycle evidence values must be fixed labels");
  }
  test.info().annotations.push({type: "lifecycle-evidence", description: JSON.stringify(evidence)});
  // Numbers, booleans and fixed labels only, so the private runner log can carry it.
  console.log(`lifecycle-evidence ${JSON.stringify(evidence)}`);
}

/**
 * Each case gets its own fresh browser context (no shared storage state) and a
 * clock that is reset to normal time before the case and, in teardown, even when
 * the case fails, times out or is interrupted.
 */
export const test = base.extend<{ run: LifecycleRunConfig; clock: { reset(): void }; fresh: { context: BrowserContext; page: Page; recorder: FlowRecorder } }>({
  run: async ({}, provide) => {
    const run = loadLifecycleRun();
    expect(run.lifecycle.clockPreflightVerified, "clock preflight verified for this invocation").toBe(true);
    await provide(run);
  },
  clock: async ({run}, provide) => {
    resetAuthClock(run);
    try { await provide({reset: () => resetAuthClock(run)}); }
    finally { resetAuthClock(run); }
  },
  fresh: async ({browser, run, clock}, provide) => {
    void clock;
    const context = await browser.newContext({baseURL: run.web});
    try {
      const page = await context.newPage();
      await provide({context, page, recorder: new FlowRecorder(page, run)});
    } finally { await context.close(); }
  },
});
export { expect };
