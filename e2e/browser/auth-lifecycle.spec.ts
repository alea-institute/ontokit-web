// D08 U3: four browser-observed authentication lifecycle boundaries (R1–R4).
//
// Provider lifetimes are exercised with REAL elapsed time against the disposable
// Zitadel instance (KTD2); only the application-cookie case moves the owned Next
// process clock (KTD3). Every transition is observed through the browser itself:
// a real reload makes SessionProvider fetch, then the settings page performs the
// protected commit-identity read with the session bearer (KTD4). Credential values
// stay in memory; assertions and evidence carry booleans, numbers and subjects only.
import { randomUUID } from "node:crypto";
import {
  test, expect, accountControl, applyClockOffset, browserSession, clearsAll, END_SESSION_PATH, expectActiveSession,
  followProviderFlow, installSpecimen, jarSessionCookies, protectedOperation, recordEvidence,
  responseSkewMs, SESSION_PATH, signInControl, signInFromApp, waitUntil, workerSkewMs, type BrowserSession, type CookieSpecimen,
} from "../fixtures/auth-lifecycle";

// The lifecycle project runs one worker, so cases execute one at a time against the
// shared instance-wide provider policy; each remains independent of the others.

test("R1 UI sign-out ends the application and provider sessions and the next sign-in requires provider interaction", async ({run, fresh}) => {
  test.setTimeout(180_000);
  const {context, page, recorder} = fresh;
  const persona = run.users.lifecycle;
  const issuer = new URL(run.issuer).origin;
  const loginOrigin = new URL(run.login).origin;

  // A fresh browser context has no provider session, so the first login is interactive.
  const first = await signInFromApp(page, run, recorder, {requireInteraction: true});
  const cookieNames = (await jarSessionCookies(context, run)).map(cookie => cookie.name);
  expect(cookieNames.length, "application session cookie issued").toBeGreaterThan(0);

  const endSession = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.origin === issuer && url.pathname === END_SESSION_PATH;
  }, {timeout: 30_000});
  const signOut = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === run.web && url.pathname === "/api/auth/signout" && response.request().method() === "POST";
  }, {timeout: 30_000});
  // The sign-out click leaves the page committed at the application until the
  // federated logout navigation lands, so wait for a NEW main-frame commit.
  const landed = page.waitForEvent("framenavigated", {
    predicate: frame => frame === page.mainFrame() && (() => {
      const url = new URL(frame.url());
      return (url.origin === loginOrigin && url.pathname.endsWith("/logout")) || url.origin === run.web;
    })(),
    timeout: 30_000,
  });
  await accountControl(page, first.session).click();
  await page.getByRole("button", {name: "Sign out", exact: true}).click();

  const signOutResponse = await signOut;
  expect(signOutResponse.status(), "application sign-out status").toBe(200);
  const appCookiesCleared = clearsAll(await signOutResponse.headersArray(), cookieNames, Date.now());
  expect(appCookiesCleared, "application sign-out clears every session cookie").toBe(true);
  const endSessionUrl = new URL((await endSession).url());
  const clientIdPresent = (endSessionUrl.searchParams.get("client_id") ?? "").length > 0;
  expect(clientIdPresent, "end_session names the OIDC client").toBe(true);
  expect(endSessionUrl.searchParams.get("post_logout_redirect_uri"), "post-logout redirect").toBe(run.web);

  // The pinned Login UI completes end-session without an id_token_hint by listing
  // this browser's provider sessions; choosing the persona's session clears it.
  await landed;
  await page.waitForLoadState("load");
  const providerSessionChooser = new URL(page.url()).origin === loginOrigin;
  let postLogoutRedirected = !providerSessionChooser;
  if (providerSessionChooser) {
    const entry = page.getByRole("button").filter({hasText: persona.email});
    await expect(entry).toHaveCount(1);
    await entry.click();
    await Promise.race([
      page.waitForURL(url => url.origin === run.web, {timeout: 30_000}),
      expect(entry).toHaveCount(0, {timeout: 30_000}),
    ]);
    await page.waitForLoadState("load");
    postLogoutRedirected = new URL(page.url()).origin === run.web;
  }
  // Recorded before the next sign-in so a later failure still shows the observed logout path.
  recordEvidence({case: "r1-logout-observed", providerSessionChooser, postLogoutRedirected, endSessionClientId: clientIdPresent, appCookiesCleared});

  // Application session: gone for the browser.
  const signedOut = browserSession(page, run);
  await page.goto(`${run.web}/`);
  expect((await signedOut).body, "browser session after sign-out").toBeNull();
  expect((await jarSessionCookies(context, run)).length, "application cookies left in the browser").toBe(0);
  await expect(signInControl(page)).toBeVisible();

  // Provider session: the next sign-in cannot silently reuse it.
  const callbacksBefore = recorder.callbacks;
  const landing = browserSession(page, run, () => recorder.callbacks > callbacksBefore, 90_000);
  await signInControl(page).click();
  const second = await followProviderFlow(page, run, recorder, {requireInteraction: true, since: callbacksBefore});
  await expect(page).toHaveURL(`${run.web}/`);
  expectActiveSession((await landing).body, run);
  recordEvidence({
    case: "r1-logout", clock: "real", firstLoginInteractive: first.interactive, appCookiesCleared, endSessionClientId: clientIdPresent,
    providerSessionChooser, postLogoutRedirected, nextLoginInteractive: second.interactive,
  });
});

test("R2 real elapsed access-token expiry renews through the provider on reload without interactive login", async ({run, fresh}) => {
  test.setTimeout(240_000);
  const {page, recorder} = fresh;
  const persona = run.users.lifecycle;
  await signInFromApp(page, run, recorder);

  const target = `${run.web}/settings?lifecycle=renewal`;
  const initialOperation = protectedOperation(page, run);
  await page.goto(target);
  const initial = await initialOperation;
  expect(initial.status, "initial protected operation").toBe(200);
  expect(initial.claims?.sub, "initial bearer subject").toBe(persona.id);
  const issuedLifetime = initial.claims!.exp - initial.claims!.iat;
  expect(Math.abs(issuedLifetime - run.lifecycle.observedAccessTokenLifetimeSeconds) <= 1, "short provider access lifetime in effect").toBe(true);

  // KTD2: wait for the provider-issued expiry in real time; the renewal must be
  // observed before that expiry plus the documented grace.
  const expiryMs = initial.claims!.exp * 1000;
  const deadlineMs = expiryMs + run.lifecycle.graceSeconds * 1000;
  await waitUntil(expiryMs + 5_000);
  const before = recorder.snapshot();
  const session = browserSession(page, run);
  const renewedOperation = protectedOperation(page, run);
  await page.reload();
  const renewedSession = await session;
  expectActiveSession(renewedSession.body, run);
  const renewed = await renewedOperation;
  const observedAt = Date.now();
  const after = recorder.snapshot();

  const credentialChanged = renewed.bearer !== undefined && renewed.bearer !== initial.bearer;
  expect(renewed.status, "protected operation with renewed credential").toBe(200);
  expect(renewed.claims?.sub, "renewed bearer subject").toBe(persona.id);
  expect(credentialChanged, "browser uses a renewed access credential").toBe(true);
  expect(renewed.claims!.exp > initial.claims!.exp, "renewed credential expires later").toBe(true);
  expect(observedAt <= deadlineMs, "renewal observed within expiry plus grace").toBe(true);
  expect(after.authorizations - before.authorizations, "interactive authorizations during renewal").toBe(0);
  expect(after.loginDocuments - before.loginDocuments, "Login UI documents during renewal").toBe(0);
  expect(after.callbacks - before.callbacks, "OIDC callbacks during renewal").toBe(0);
  expect(page.url(), "renewal keeps the browser on its page").toBe(target);
  recordEvidence({
    case: "r2-renewal", clock: "real-elapsed", observedAccessLifetimeSeconds: issuedLifetime, graceSeconds: run.lifecycle.graceSeconds,
    renewedAfterExpirySeconds: Math.round((observedAt - expiryMs) / 1000), credentialChanged, sameSubject: true, interactiveLogin: false,
  });
});

test("R3 real elapsed refresh-token idle expiry reauthenticates through SessionGuard back to the original URL", async ({run, fresh}) => {
  const {lifetimes, graceSeconds} = run.lifecycle;
  test.setTimeout((lifetimes.refreshTokenIdleExpiration + graceSeconds + 180) * 1000);
  const {page, recorder} = fresh;
  const persona = run.users.lifecycle;
  await signInFromApp(page, run, recorder);

  const original = `${run.web}/settings?lifecycle=refresh-recovery&view=${randomUUID()}`;
  const initialOperation = protectedOperation(page, run);
  await page.goto(original);
  const initial = await initialOperation;
  expect(initial.status, "initial protected operation").toBe(200);
  expect(initial.claims?.sub, "initial bearer subject").toBe(persona.id);

  // The refresh credential was issued with this access token and is never used while
  // the page stays idle: no session fetch may happen during the real wait.
  const issuedMs = initial.claims!.iat * 1000;
  const idleExpiryMs = issuedMs + lifetimes.refreshTokenIdleExpiration * 1000;
  const quiet = recorder.snapshot();
  await waitUntil(idleExpiryMs + graceSeconds * 1000);
  expect(recorder.sessionFetches - quiet.sessionFetches, "session fetches during the idle wait").toBe(0);
  expect(Date.now() < issuedMs + lifetimes.refreshTokenExpiration * 1000, "idle (not absolute) refresh expiry is exercised").toBe(true);

  const before = recorder.snapshot();
  const failed = browserSession(page, run);
  const recoveredSession = browserSession(page, run, () => recorder.callbacks > before.callbacks, 120_000);
  const recoveredOperation = protectedOperation(page, run, () => recorder.callbacks > before.callbacks, 120_000);
  recoveredSession.catch(() => undefined);
  recoveredOperation.catch(() => undefined);
  await page.reload();
  const failure = await failed;
  expect(failure.body?.user?.id, "failed-refresh session subject").toBe(persona.id);
  expect(failure.body?.error ?? null, "unusable refresh credential surfaces to the browser").toBe("RefreshAccessTokenError");

  // SessionGuard, not the test, initiates the provider flow; valid provider SSO may complete it.
  const flow = await followProviderFlow(page, run, recorder, {since: before.callbacks, timeout: 90_000});
  const after = recorder.snapshot();
  expect(after.providerSignIns - before.providerSignIns, "SessionGuard initiated provider sign-in").toBeGreaterThan(0);
  expect(after.authorizations - before.authorizations, "provider authorization after refresh failure").toBeGreaterThan(0);
  await expect(page).toHaveURL(original);
  const recovered = await recoveredSession;
  expectActiveSession(recovered.body, run);
  const operation = await recoveredOperation;
  const credentialChanged = operation.bearer !== undefined && operation.bearer !== initial.bearer;
  expect(operation.status, "protected operation after recovery").toBe(200);
  expect(operation.claims?.sub, "recovered bearer subject").toBe(persona.id);
  expect(credentialChanged, "recovery obtained a new access credential").toBe(true);
  expect(page.url(), "original same-origin URL and query restored").toBe(original);
  recordEvidence({
    case: "r3-refresh-recovery", clock: "real-elapsed", refreshIdleSeconds: lifetimes.refreshTokenIdleExpiration, graceSeconds,
    waitedAfterIssueSeconds: Math.round((Date.now() - issuedMs) / 1000), refreshErrorObserved: true, sessionGuardInitiated: true,
    providerSsoReused: !flow.interactive, originalUrlRestored: true, credentialChanged,
  });
});

test("R4 controlled Next clock expires the genuine application cookie and explicit sign-in recovers at normal time", async ({run, fresh, playwright}) => {
  test.setTimeout(240_000);
  const {context, page, recorder} = fresh;
  const persona = run.users.lifecycle;
  const toleranceMs = run.lifecycle.verifierToleranceSeconds * 1000;
  const maxAgeMs = run.lifecycle.sessionMaxAgeSeconds * 1000;
  const marginMs = 5_000;
  const skewToleranceMs = 3_000;

  // Normal time: a genuine login; the specimen is the cookie the OIDC callback issued.
  const signedInAt = Date.now();
  const signedIn = await signInFromApp(page, run, recorder);
  const specimen = signedIn.issued as CookieSpecimen | undefined;
  expect(Boolean(specimen), "OIDC callback issued an application session cookie").toBe(true);
  const names = specimen!.cookies.map(cookie => cookie.name);
  expect(Math.abs(specimen!.expiresMs - signedInAt - maxAgeMs) < 120_000, "specimen carries the application session lifetime").toBe(true);
  const normalSkewMs = await responseSkewMs(signedIn.sessionResponse, signedIn.session, run);
  expect(Math.abs(normalSkewMs) <= skewToleranceMs, "Next worker clock normal before control").toBe(true);
  const boundaryMs = specimen!.expiresMs + toleranceMs;

  // Just before expiry + verifier tolerance (inside the tolerance window): accepted.
  const beforeOffset = boundaryMs - marginMs - Date.now();
  await applyClockOffset(run, beforeOffset);
  await installSpecimen(context, run, specimen!);
  // Observed by the browser as a top-level document request carrying the specimen from
  // its own cookie jar. Under the shifted clock the Next worker also sees the provider
  // access credential as expired and may record a refresh error; a SessionProvider page
  // would then let SessionGuard start an OIDC exchange at controlled time, which KTD3
  // forbids. A plain document load exercises the same Auth.js cookie verifier without it.
  const beforeDocument = await page.goto(`${run.web}${SESSION_PATH}`);
  expect(beforeDocument?.status(), "pre-boundary session document status").toBe(200);
  const before = {response: beforeDocument!, body: await beforeDocument!.json() as BrowserSession | null};
  expect(before.body?.user?.id, "specimen accepted just before the boundary").toBe(persona.id);
  const refreshErrorBeforeBoundary = before.body?.error === "RefreshAccessTokenError";
  const workerShiftErrorMs = Math.round(Math.abs((await responseSkewMs(before.response, before.body, run)) - normalSkewMs - beforeOffset));
  expect(workerShiftErrorMs <= skewToleranceMs, "Next worker observed the controlled clock").toBe(true);
  const toleranceWindowExercised = boundaryMs - marginMs > specimen!.expiresMs;
  // Positive control: the cookie Auth.js renewed at controlled time. It is used only to
  // observe the instrument, never substituted for the specimen.
  const positive = await jarSessionCookies(context, run);
  const specimenValues = new Set(specimen!.cookies.map(cookie => cookie.value));
  expect(positive.length > 0 && positive.every(cookie => !specimenValues.has(cookie.value)), "positive control is a distinct renewed cookie").toBe(true);
  const positiveHeader = positive.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
  const observeWorker = async () => {
    // A separate, cookie-jar-free request client: supplementary instrument observation only.
    const api = await playwright.request.newContext();
    try {
      const requestedAt = Date.now();
      const response = await api.get(`${run.web}${SESSION_PATH}`, {headers: {cookie: positiveHeader}, maxRedirects: 0});
      const body = response.status() === 200 ? await response.json() as {user?: {id?: string}; expires?: string} | null : null;
      expect(body?.user?.id, "positive control session subject").toBe(persona.id);
      return workerSkewMs(body, run, requestedAt, Date.now()) - normalSkewMs;
    } finally { await api.dispose(); }
  };

  // Just after the boundary: the same unchanged specimen is rejected.
  const afterOffset = boundaryMs + marginMs - Date.now();
  await applyClockOffset(run, afterOffset);
  expect(Math.abs((await observeWorker()) - afterOffset) <= skewToleranceMs, "Next worker at the post-boundary clock").toBe(true);
  await installSpecimen(context, run, specimen!);
  const afterWaiter = browserSession(page, run);
  await page.goto(`${run.web}/`);
  const after = await afterWaiter;
  expect(after.body, "specimen rejected after the boundary").toBeNull();
  const cookiesCleared = clearsAll(await after.response.headersArray(), names, Date.now());
  expect(cookiesCleared, "expired specimen cookies cleared").toBe(true);
  expect((await jarSessionCookies(context, run)).length, "application cookies left in the browser").toBe(0);
  await expect(signInControl(page)).toBeVisible();
  await expect(accountControl(page, before.body)).toHaveCount(0);

  // Restore normal time, observe it, and only then start an interactive OIDC exchange.
  await applyClockOffset(run, 0);
  expect(Math.abs(await observeWorker()) <= skewToleranceMs, "Next worker restored to normal time").toBe(true);
  const callbacksBefore = recorder.callbacks;
  const landing = browserSession(page, run, () => recorder.callbacks > callbacksBefore, 90_000);
  await signInControl(page).click();
  const flow = await followProviderFlow(page, run, recorder, {since: callbacksBefore});
  const recovered = await landing;
  expectActiveSession(recovered.body, run);
  expect(Math.abs((await responseSkewMs(recovered.response, recovered.body, run)) - normalSkewMs) <= skewToleranceMs, "recovered session issued at normal time").toBe(true);
  const operation = protectedOperation(page, run);
  await page.goto(`${run.web}/settings?lifecycle=cookie-expiry`);
  const recoveredOperation = await operation;
  expect(recoveredOperation.status, "protected operation after explicit sign-in").toBe(200);
  expect(recoveredOperation.claims?.sub, "recovered bearer subject").toBe(persona.id);
  recordEvidence({
    case: "r4-cookie-expiry", clock: "controlled-next-process", specimenSource: "oidc-callback", verifierToleranceSeconds: run.lifecycle.verifierToleranceSeconds,
    marginSeconds: marginMs / 1000, workerShiftErrorMs, toleranceWindowExercised, beforeAccepted: true, afterRejected: true, cookiesCleared,
    signedOutUi: true, restoredBeforeSignIn: true, refreshErrorBeforeBoundary, providerSsoReused: !flow.interactive,
  });
});
