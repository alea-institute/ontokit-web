import {test as base, expect, type Page} from "@playwright/test";
import {setTimeout as delay} from "node:timers/promises";
import {HOSTED_CASES} from "../../scripts/e2e/hosted-suggestions-contract.mjs";
import {enterProviderCredentials} from "../fixtures/auth";
import {loadSuggestionsRun, type SuggestionsRunConfig, type SuggestionPersona} from "../fixtures/run";
import {api, session, importProject, listed, isSessionCookie, bearerClaims, observationDeadline} from "../fixtures/hosted-personas";
import {gotoResolved, headerSignIn, projectLink} from "../fixtures/auth-mode";
import {saveExistingLabel, openTriage} from "../fixtures/suggestions";

const test = base.extend<{run: SuggestionsRunConfig}>({run: async ({}, provide) => {
  const run = loadSuggestionsRun();
  if (!run.hosted) throw new Error("HOSTED_TARGET_REQUIRED");
  await provide(run);
}});
const protectedPath = "/api/v1/users/me/commit-identity";
function evidence(index: number, values = HOSTED_CASES[index].proof) {
  test.info().annotations.push({type: "hosted-evidence", description: JSON.stringify(values)});
}
async function interactive(page: Page, run: SuggestionsRunConfig, persona: SuggestionPersona) {
  await enterProviderCredentials(page, {login: run.login, web: run.web, user: run.users[persona]});
  const current = await session(page, run);
  expect(current?.user?.id === run.users[persona].id && Boolean(current.accessToken) && !current.error).toBe(true);
  return current!;
}
async function login(page: Page, run: SuggestionsRunConfig, persona: SuggestionPersona) {
  await page.goto(`${run.web}/auth/signin?callbackUrl=${encodeURIComponent(`${run.web}/`)}`);
  await page.getByRole("button", {name: "Sign in with Zitadel"}).click();
  return interactive(page, run, persona);
}
for (const [index, persona] of (["owner", "suggester", "editor", "unrelated"] as const).entries()) {
  test(HOSTED_CASES[index].title, async ({page, context, run}) => {
    const current = await login(page, run, persona);
    expect((await api(page, run, persona, protectedPath)).status()).toBe(200);
    expect((await context.cookies(run.web)).filter(cookie => isSessionCookie(cookie.name)).length).toBeGreaterThan(0);
    const logout = page.waitForRequest(request => new URL(request.url()).origin === run.issuer && new URL(request.url()).pathname === "/oidc/v1/end_session");
    const signedOut = page.waitForResponse(response => new URL(response.url()).origin === run.web && new URL(response.url()).pathname === "/api/auth/signout" && response.request().method() === "POST");
    const landed = page.waitForEvent("framenavigated", {predicate: frame => frame === page.mainFrame() && new URL(frame.url()).origin === run.web, timeout: 45_000});
    await page.getByRole("banner").getByRole("button", {name: current.user?.name?.charAt(0).toUpperCase() || "U", exact: true}).click();
    await page.getByRole("button", {name: "Sign out", exact: true}).click();
    expect((await signedOut).status()).toBe(200);
    const end = new URL((await logout).url());
    expect(Boolean(end.searchParams.get("client_id") && end.searchParams.get("id_token_hint"))).toBe(true);
    expect(end.searchParams.get("post_logout_redirect_uri") === run.web).toBe(true);
    await landed;
    await expect(headerSignIn(page)).toBeVisible({timeout: 45_000});
    expect((await session(page, run))?.user?.id ?? null).toBeNull();
    expect((await context.cookies(run.web)).filter(cookie => isSessionCookie(cookie.name)).length).toBe(0);
    // No clearing cookies or fresh context here: credential UI must recur after real logout.
    await login(page, run, persona);
    expect((await api(page, run, persona, protectedPath)).status()).toBe(200);
    evidence(index);
  });
}

test(HOSTED_CASES[4].title, async ({browser, page, run}) => {
  await login(page, run, "owner");
  const privateProject = await importProject(page, run, false);
  const publicProject = await importProject(page, run, true);
  const membersResponse = await api(page, run, "owner", `/api/v1/projects/${privateProject.id}/members`);
  expect(membersResponse.status()).toBe(200);
  const members = await membersResponse.json() as {items: {user_id: string; role: string}[]; total: number};
  expect(members.items.length).toBe(members.total);
  expect(members.items.some(member => member.user_id === run.users.owner.id && member.role === "owner")).toBe(true);
  expect(members.items.some(member => member.user_id === run.users.unrelated.id)).toBe(false);
  const outsider = await browser.newContext();
  try {
    const visitor = await outsider.newPage();
    await gotoResolved(visitor, `${run.web}/`, headerSignIn);
    await visitor.getByRole("button", {name: "All", exact: true}).click();
    await visitor.getByPlaceholder("Search projects...").fill(run.id);
    await expect(projectLink(visitor, publicProject.id)).toBeVisible();
    expect(await listed(visitor, run, publicProject.id)).toBe(true);
    expect(await listed(visitor, run, privateProject.id)).toBe(false);
    await expect(projectLink(visitor, privateProject.id)).toHaveCount(0);
    const endpoint = `/api/v1/projects/${privateProject.id}`;
    const anonymous = await visitor.request.get(`${run.api}${endpoint}`);
    expect(anonymous.status()).toBe(403);
    const original = `${run.web}/projects/${privateProject.id}?hosted=visibility`;
    await gotoResolved(visitor, original, p => p.getByRole("main").getByRole("button", {name: "Sign In", exact: true}));
    await visitor.getByRole("main").getByRole("button", {name: "Sign In", exact: true}).click();
    await interactive(visitor, run, "unrelated");
    await expect(visitor).toHaveURL(original);
    expect((await api(visitor, run, "unrelated", endpoint)).status()).toBe(403);
    await expect(visitor.getByRole("main").getByRole("button", {name: "Back to Projects", exact: true})).toBeVisible();
    await expect(visitor.getByRole("heading", {name: privateProject.name, exact: true})).toHaveCount(0);
    expect(await listed(visitor, run, privateProject.id, "unrelated")).toBe(false);
    expect((await api(page, run, "owner", endpoint)).status()).toBe(200);
    await page.goto(`${run.web}/projects/${privateProject.id}`);
    await expect(page.getByRole("heading", {level: 1, name: privateProject.name})).toBeVisible();
    expect(await listed(page, run, privateProject.id, "owner")).toBe(true);
    evidence(4);
  } finally { await outsider.close(); }
});

test(HOSTED_CASES[5].title, async ({browser, page, run}) => {
  await login(page, run, "owner");
  const project = await importProject(page, run, true);
  const source = await api(page, run, "owner", `/api/v1/projects/${project.id}/revisions/file?version=main`);
  expect(source.status()).toBe(200);
  const revision = (await source.json()).revision;
  await expect.poll(async () => {
    const response = await api(page, run, "owner", `/api/v1/projects/${project.id}/ontology/index-status?branch=main`);
    if (response.status() === 404) return false;
    expect(response.status()).toBe(200);
    const state = await response.json();
    if (state.status === "failed") throw new Error("HOSTED_INDEX_FAILED");
    return state.status === "ready" && state.commit_hash === revision;
  }, {timeout: 60_000}).toBe(true);
  const anonymousContext = await browser.newContext();
  try {
    const anonymous = await anonymousContext.newPage();
    await gotoResolved(anonymous, `${run.web}/projects/${project.id}/editor`, p => p.getByRole("treeitem", {name: /Test Person/}).first());
    await anonymous.getByRole("treeitem", {name: /Test Person/}).first().click();
    const prefix = `/api/v1/projects/${project.id}/suggestions/anonymous/sessions`;
    const created = anonymous.waitForResponse(r => new URL(r.url()).origin === run.api && new URL(r.url()).pathname === prefix && r.request().method() === "POST");
    await anonymous.getByRole("button", {name: "Propose Edit", exact: true}).click();
    const response = await created;
    expect(response.status()).toBe(201);
    expect(await response.request().headerValue("authorization")).toBeNull();
    const sessionId = (await response.json()).session_id;
    const label = `OW-2 anonymous ${run.id}`;
    const saved = await saveExistingLabel(anonymous, run.api, project.id, label, true);
    expect(saved.sessionId === sessionId).toBe(true);
    await anonymous.getByRole("button", {name: /^Submit Proposal/}).click();
    const submitted = anonymous.waitForResponse(r => new URL(r.url()).origin === run.api && new URL(r.url()).pathname === `${prefix}/${sessionId}/submit` && r.request().method() === "POST");
    await anonymous.getByRole("dialog", {name: "Want credit for your suggestions?", exact: true}).getByRole("button", {name: "Skip", exact: true}).click();
    const result = await submitted;
    expect(result.status()).toBe(200);
    expect(await result.request().headerValue("authorization")).toBeNull();
    const submission = await result.json();
    expect(submission.status).toBe("submitted");
    expect(submission.pr_number).toBeGreaterThan(0);
    await expect(anonymous.getByRole("dialog", {name: "Thank you — your proposal is in", exact: true})).toBeVisible();
    expect((await session(anonymous, run))?.user?.id ?? null).toBeNull();
    await openTriage(page, run.web, project.id, label);
    const summary = page.getByRole("tabpanel", {name: "Summary", exact: true});
    await expect(summary).toContainText("Anonymous");
    await expect(summary.getByRole("link", {name: `PR #${submission.pr_number}`, exact: true})).toBeVisible();
    evidence(5);
  } finally { await anonymousContext.close(); }
});

// The settings page sends the protected operation using its own current session.
async function operation(page: Page, run: SuggestionsRunConfig) {
  const response = await page.waitForResponse(r => new URL(r.url()).origin === run.api && new URL(r.url()).pathname === protectedPath && r.request().method() === "GET", {timeout: 60_000});
  expect(response.status()).toBe(200);
  const header = await response.request().headerValue("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const claims = bearerClaims(token);
  expect(claims.sub === run.users.owner.id).toBe(true);
  return {token, claims};
}
async function waitUntil(deadline: number) {
  while (Date.now() < deadline) await delay(Math.min(1000, deadline - Date.now()));
}

test(HOSTED_CASES[6].title, async ({page, run}) => {
  const hosted = run.hosted!;
  test.setTimeout((hosted.observationWindowSeconds + 180) * 1000);
  const budgetEnd = Date.now() + hosted.observationWindowSeconds * 1000;
  let renewal = "not-observed", refreshRecovery = "not-observed";
  await login(page, run, "owner");
  const target = `${run.web}/settings?hosted=expiry&return=original`;
  const first = operation(page, run);
  await page.goto(target);
  let initial = await first;
  const originalIssuedAt = initial.claims.iat * 1000;
  // about:blank keeps this context's genuine cookies but prevents background renewals.
  await page.goto("about:blank");
  const renewalAt = observationDeadline(initial.claims.exp * 1000, budgetEnd);
  if (renewalAt !== null && renewalAt < initial.claims.iat * 1000 + hosted.refreshIdleSeconds * 1000) {
    await waitUntil(renewalAt);
    let providerRequests = 0;
    const observe = (request: import("@playwright/test").Request) => {
      const url = new URL(request.url());
      if (url.origin === run.login || (url.origin === run.issuer && url.pathname === "/oauth/v2/authorize") || (url.origin === run.web && url.pathname === "/api/auth/callback/zitadel")) providerRequests += 1;
    };
    page.on("request", observe);
    try {
      const next = operation(page, run);
      await page.goto(target);
      const renewed = await next;
      expect(renewed.token !== initial.token && renewed.claims.exp > initial.claims.exp).toBe(true);
      expect(providerRequests).toBe(0);
      await expect(page).toHaveURL(target);
      initial = renewed;
      renewal = "observed";
    } finally { page.off("request", observe); }
    await page.goto("about:blank");
  }
  // Start the full idle interval now, conservatively after any last refresh, and
  // also wait beyond access expiry so the application must try the refresh grant.
  const refreshAt = observationDeadline(Math.max(Date.now() + hosted.refreshIdleSeconds * 1000, initial.claims.exp * 1000), budgetEnd);
  // Exercise idle expiry only while the original grant remains within its absolute lifetime.
  if (refreshAt !== null && refreshAt + 60_000 < originalIssuedAt + hosted.refreshAbsoluteSeconds * 1000) {
    await waitUntil(refreshAt);
    let guardStarted = false, callbackObserved = false, failureObserved = false;
    const observeRequest = (request: import("@playwright/test").Request) => {
      const url = new URL(request.url());
      if (url.origin === run.web && url.pathname === "/api/auth/signin/zitadel" && request.method() === "POST") guardStarted = true;
      if (url.origin === run.web && url.pathname === "/api/auth/callback/zitadel") callbackObserved = true;
    };
    const failedSession = page.waitForResponse(async response => {
      const url = new URL(response.url());
      if (url.origin !== run.web || url.pathname !== "/api/auth/session") return false;
      const body = await response.json();
      const failed = body?.error === "RefreshAccessTokenError" && body?.user?.id === run.users.owner.id;
      if (failed) failureObserved = true;
      return failed;
    }, {timeout: 60_000});
    failedSession.catch(() => undefined);
    page.on("request", observeRequest);
    try {
      await page.goto(target);
      await failedSession;
      // SessionGuard starts reauthentication; provider SSO is valid recovery.
      await expect.poll(() => guardStarted, {timeout: 30_000}).toBe(true);
      const credentials = page.getByTestId("username-text-input").or(page.getByTestId("password-text-input")).first();
      await expect.poll(async () => callbackObserved || await credentials.isVisible(), {timeout: 45_000}).toBe(true);
      if (!callbackObserved) await interactive(page, run, "owner");
      await expect.poll(() => callbackObserved).toBe(true);
      await expect(page).toHaveURL(target);
      const recovered = await session(page, run);
      expect(!recovered?.error && recovered?.user?.id === run.users.owner.id && recovered.accessToken !== initial.token).toBe(true);
      const recoveredClaims = bearerClaims(recovered?.accessToken);
      expect(recoveredClaims.sub === run.users.owner.id && recoveredClaims.exp > initial.claims.exp).toBe(true);
      expect((await api(page, run, "owner", protectedPath)).status()).toBe(200);
      expect(failureObserved && guardStarted).toBe(true);
      refreshRecovery = "observed";
    } finally { page.off("request", observeRequest); }
  }
  evidence(6, {case: "expiry", renewal, refreshRecovery, cookieExpiry: "not-observed"});
});
