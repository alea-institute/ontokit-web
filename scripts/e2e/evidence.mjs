// Explicit acceptance inventory: deleting a spec cannot silently lower the gate.
export const REQUIRED_TESTS = [
  {
    "file": "api/branches.spec.ts",
    "title": "branch edits persist independently of the target branch",
    "project": "chromium"
  },
  {
    "file": "api/branches.spec.ts",
    "title": "stale branch revision is rejected without changing source or target",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "absent project write returns stable 404 and creates nothing",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "schema-invalid project create returns validation locations and creates nothing",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "anonymous source write is rejected without changing owner state",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "unrelated source write is rejected without changing owner state",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "invalid Turtle source write is rejected without changing owner state",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "invalid schema source write is rejected without changing owner state",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "malformed Turtle import leaves no partial project",
    "project": "chromium"
  },
  {
    "file": "api/errors.spec.ts",
    "title": "malformed multipart import leaves no partial project",
    "project": "chromium"
  },
  {
    "file": "api/ontology.spec.ts",
    "title": "import initializes persisted source, branch, class and property labels",
    "project": "chromium"
  },
  {
    "file": "api/ontology.spec.ts",
    "title": "source save persists a new immutable revision",
    "project": "chromium"
  },
  {
    "file": "api/projects.spec.ts",
    "title": "project create, list, read, update and delete persist through HTTP",
    "project": "chromium"
  },
  {
    "file": "api/pull-requests.spec.ts",
    "title": "ordinary owner reviews a diff and merges persisted branch content into the target",
    "project": "chromium"
  },
  {
    "file": "api/search-lint.spec.ts",
    "title": "lexical search reflects the saved target revision and excludes nonmatching entities",
    "project": "chromium"
  },
  {
    "file": "api/search-lint.spec.ts",
    "title": "each lint enqueue produces a fresh completed persisted worker run with deterministic issues",
    "project": "chromium"
  },
  {
    "file": "auth-foundation.spec.ts",
    "title": "real owner and unrelated sessions authenticate protected API reads",
    "project": "chromium"
  },
  {
    "file": "auth-foundation.spec.ts",
    "title": "anonymous context has no identity and cannot access a protected API read",
    "project": "chromium"
  },
  {
    "file": "browser/ontology-workflow.spec.ts",
    "title": "fresh UI sign-in imports, edits, reviews and merges a label that survives target reload",
    "project": "chromium"
  },
  {
    "file": "stack.setup.ts",
    "title": "genuine OIDC sessions for two fresh ordinary users",
    "project": "stack setup"
  },
  {
    "file": "stack.teardown.ts",
    "title": "remove private browser credentials",
    "project": "stack teardown"
  }
];


// D08 lifecycle profile (KTD1): a separate fresh stack with its own fixed inventory.
export const LIFECYCLE_SPEC = 'browser/auth-lifecycle.spec.ts';
export const LIFECYCLE_REQUIRED_TESTS = [
  'R1 UI sign-out ends the application and provider sessions and the next sign-in requires provider interaction',
  'R2 real elapsed access-token expiry renews through the provider on reload without interactive login',
  'R3 real elapsed refresh-token idle expiry reauthenticates through SessionGuard back to the original URL',
  'R4 controlled Next clock expires the genuine application cookie and explicit sign-in recovers at normal time',
].map(title => ({file: LIFECYCLE_SPEC, title, project: 'lifecycle'}));
export const PROFILE_INVENTORIES = Object.freeze({baseline: REQUIRED_TESTS, lifecycle: LIFECYCLE_REQUIRED_TESTS});
const PROFILE_PROJECTS = {baseline: ['chromium', 'stack setup', 'stack teardown'], lifecycle: ['lifecycle']};

// R8: which proof each lifecycle case supplies. Real elapsed provider expiry and the
// controlled Next-process clock are separate kinds of evidence and never interchange.
export const CLOCK_LABELS = Object.freeze({real: 'real', realElapsed: 'real-elapsed', controlled: 'controlled-next-process'});
const B = 'boolean', N = 'number';
// Per-case evidence schemas: only these keys, with these types, survive. `proof` fields
// must hold the stated value; the spec asserts them before recording, so any other value
// is a fabricated or inconsistent annotation. Strings are only the fixed labels listed.
const CASES = [
  {test: 0, case: 'r1-logout-observed', clock: null,
    fields: {providerSessionChooser: B, postLogoutRedirected: B, endSessionClientId: B, endSessionIdTokenHint: B, appCookiesCleared: B},
    // RP-initiated logout with id_token_hint ends the provider session without a chooser.
    proof: {endSessionClientId: true, endSessionIdTokenHint: true, providerSessionChooser: false, postLogoutRedirected: true, appCookiesCleared: true}},
  {test: 0, case: 'r1-logout', clock: CLOCK_LABELS.real,
    fields: {firstLoginInteractive: B, appCookiesCleared: B, endSessionClientId: B, endSessionIdTokenHint: B, providerSessionChooser: B, postLogoutRedirected: B, nextLoginInteractive: B},
    proof: {firstLoginInteractive: true, appCookiesCleared: true, endSessionClientId: true, endSessionIdTokenHint: true, providerSessionChooser: false, postLogoutRedirected: true, nextLoginInteractive: true}},
  {test: 1, case: 'r2-renewal', clock: CLOCK_LABELS.realElapsed,
    fields: {observedAccessLifetimeSeconds: N, graceSeconds: N, renewedAfterExpirySeconds: N, credentialChanged: B, sameSubject: B, interactiveLogin: B},
    proof: {credentialChanged: true, sameSubject: true, interactiveLogin: false}},
  {test: 2, case: 'r3-refresh-recovery', clock: CLOCK_LABELS.realElapsed,
    fields: {refreshIdleSeconds: N, graceSeconds: N, waitedAfterIssueSeconds: N, refreshErrorObserved: B, sessionGuardInitiated: B, providerSsoReused: B, originalUrlRestored: B, credentialChanged: B},
    proof: {refreshErrorObserved: true, sessionGuardInitiated: true, originalUrlRestored: true, credentialChanged: true}},
  {test: 3, case: 'r4-cookie-expiry', clock: CLOCK_LABELS.controlled,
    fields: {specimenSource: ['oidc-callback'], verifierToleranceSeconds: N, marginSeconds: N, workerShiftErrorMs: N, toleranceWindowExercised: B, beforeAccepted: B, afterRejected: B, cookiesCleared: B, signedOutUi: B, restoredBeforeSignIn: B, refreshErrorBeforeBoundary: B, providerSsoReused: B},
    proof: {specimenSource: 'oidc-callback', toleranceWindowExercised: true, beforeAccepted: true, afterRejected: true, cookiesCleared: true, signedOutUi: true, restoredBeforeSignIn: true}},
];
const TEST_CLOCKS = [CLOCK_LABELS.real, CLOCK_LABELS.realElapsed, CLOCK_LABELS.realElapsed, CLOCK_LABELS.controlled];
const titlesWithClock = clock => LIFECYCLE_REQUIRED_TESTS.filter((_, i) => TEST_CLOCKS[i] === clock).map(t => t.title);

const typed = (type, value) => Array.isArray(type) ? type.includes(value) : type === N ? Number.isFinite(value) : typeof value === type;
/** Allowlists one evidence entry against its case schema; returns null when proof is missing. */
function sanitizeCase(spec, entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.case !== spec.case) return null;
  if (spec.clock ? entry.clock !== spec.clock : 'clock' in entry) return null;
  const out = {case: spec.case, ...(spec.clock ? {clock: spec.clock} : {})};
  for (const [key, type] of Object.entries(spec.fields)) if (Object.hasOwn(entry, key) && typed(type, entry[key])) out[key] = entry[key];
  for (const [key, value] of Object.entries(spec.proof)) if (out[key] !== value) return null;
  return out;
}
/** Rebuilds the four lifecycle case records from untrusted input; null unless complete. */
function lifecycleCases(evidenceByTest) {
  const cases = LIFECYCLE_REQUIRED_TESTS.map((t, i) => ({title: t.title, clock: TEST_CLOCKS[i], evidence: []}));
  for (const [i, entries] of evidenceByTest.entries()) {
    if (!Array.isArray(entries)) return null;
    for (const entry of entries) {
      const spec = CASES.find(c => c.test === i && c.case === entry?.case);
      const safe = spec && sanitizeCase(spec, entry);
      if (!safe || cases[i].evidence.some(e => e.case === safe.case)) return null;
      cases[i].evidence.push(safe);
    }
  }
  for (const spec of CASES) if (!cases[spec.test].evidence.some(e => e.case === spec.case)) return null;
  for (const c of cases) c.evidence.sort((a, b) => CASES.findIndex(s => s.case === a.case) - CASES.findIndex(s => s.case === b.case));
  return cases;
}
const lifecycleSummary = cases => ({cases, realElapsedCases: titlesWithClock(CLOCK_LABELS.realElapsed), clockControlledCases: titlesWithClock(CLOCK_LABELS.controlled)});

const EXPECTED_FAILURE = new Set(['skip', 'fixme', 'fail', 'slow-skip']);
export function validateReport(report, {profile} = {}) {
  const fail = () => { throw new Error('Full-stack runner did not pass every mandatory test'); };
  if (!Object.hasOwn(PROFILE_INVENTORIES, profile)) fail();
  const inventory = PROFILE_INVENTORIES[profile];
  const stats = report?.stats;
  if (!stats || !Array.isArray(report.errors) || report.errors.length ||
      !Number.isInteger(stats.expected) || stats.expected < inventory.length ||
      stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0) fail();
  const found = [];
  function visit(suites) {
    if (!Array.isArray(suites)) fail();
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        if (!spec.ok || !Array.isArray(spec.tests) || !spec.tests.length) fail();
        for (const t of spec.tests) {
          const result = t.results?.[0];
          if (t.status !== 'expected' || t.expectedStatus !== 'passed' || t.results?.length !== 1 ||
              result.status !== 'passed' || (result.errors?.length || 0) || (result.retry ?? 0) !== 0) fail();
          const annotations = [...(t.annotations || []), ...(result.annotations || [])];
          if (annotations.some(a => EXPECTED_FAILURE.has(a?.type))) fail();
          // A mixed run (either profile's cases in the other's report) never counts.
          if (!PROFILE_PROJECTS[profile].includes(t.projectName) || (profile === 'baseline') === (spec.file === LIFECYCLE_SPEC)) fail();
          // Playwright copies runtime annotations onto the test; read one source only.
          const own = (t.annotations?.some(a => a?.type === 'lifecycle-evidence') ? t.annotations : result.annotations) || [];
          const evidence = own.filter(a => a?.type === 'lifecycle-evidence').map(a => {
            try { return JSON.parse(a.description); } catch { return fail(); }
          });
          found.push({file: spec.file, title: spec.title, project: t.projectName, evidence});
        }
      }
      visit(suite.suites || []);
    }
  }
  visit(report.suites);
  if (found.length !== stats.expected) fail();
  if (profile === 'lifecycle' && found.length !== inventory.length) fail();
  const matches = inventory.map(required => found.filter(t => t.file === required.file && t.title === required.title && t.project === required.project));
  if (matches.some(m => m.length !== 1)) fail();
  if (profile === 'baseline' && found.some(t => t.evidence.length)) fail();
  // Only checked, fixed inventory names are durable; additional dynamic titles stay private.
  const summary = {profile, passed: stats.expected, skipped: 0, failed: 0, flaky: 0, mandatory: inventory.map(t => ({...t}))};
  if (profile === 'baseline') return summary;
  const cases = lifecycleCases(matches.map(m => m[0].evidence));
  if (!cases) fail();
  return {...summary, ...lifecycleSummary(cases)};
}

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const LIFETIME_FIELDS = ['accessTokenLifetime', 'idTokenLifetime', 'refreshTokenIdleExpiration', 'refreshTokenExpiration'];
const PREFLIGHT_NUMBERS = ['verifierToleranceSeconds', 'sessionMaxAgeSeconds', 'marginMs', 'workerShiftErrorMs', 'serviceClockSkewMs'];
const PREFLIGHT_BOOLEANS = ['toleranceWindowExercised', 'refreshErrorBeforeBoundary', 'beforeAccepted', 'afterRejected', 'cookiesCleared', 'restored'];
const PREFLIGHT_PROOF = ['toleranceWindowExercised', 'beforeAccepted', 'afterRejected', 'cookiesCleared', 'restored'];
/** Lifecycle preflight numbers and booleans only; null unless every field is present and proven. */
function sanitizedLifecycle(value) {
  const lifetimes = {};
  for (const field of LIFETIME_FIELDS) {
    if (!Number.isSafeInteger(value?.lifetimes?.[field]) || value.lifetimes[field] <= 0) return null;
    lifetimes[field] = value.lifetimes[field];
  }
  const preflight = {};
  for (const field of PREFLIGHT_NUMBERS) {
    if (!Number.isFinite(value?.preflight?.[field])) return null;
    preflight[field] = value.preflight[field];
  }
  for (const field of PREFLIGHT_BOOLEANS) {
    if (typeof value.preflight[field] !== 'boolean') return null;
    preflight[field] = value.preflight[field];
  }
  if (PREFLIGHT_PROOF.some(field => preflight[field] !== true)) return null;
  if (!Number.isSafeInteger(value.graceSeconds) || !Number.isSafeInteger(value.observedAccessTokenLifetimeSeconds)) return null;
  return {lifetimes, graceSeconds: value.graceSeconds, observedAccessTokenLifetimeSeconds: value.observedAccessTokenLifetimeSeconds, preflight};
}
/** Rebuilds the test summary from the fixed inventory; null unless it matches the profile. */
function sanitizedTests(profile, tests) {
  if (!profile || tests?.profile !== profile) return null;
  const inventory = PROFILE_INVENTORIES[profile];
  if (!Number.isSafeInteger(tests.passed) || tests.passed < inventory.length || (profile === 'lifecycle' && tests.passed !== inventory.length)) return null;
  const summary = {passed: tests.passed, skipped: 0, failed: 0, flaky: 0, mandatory: inventory.map(t => ({...t}))};
  if (profile === 'baseline') return summary;
  const input = Array.isArray(tests.cases) && tests.cases.length === inventory.length ? tests.cases : null;
  if (!input || input.some((c, i) => c?.title !== inventory[i].title || c?.clock !== TEST_CLOCKS[i])) return null;
  const cases = lifecycleCases(input.map(c => c.evidence));
  return cases && {...summary, ...lifecycleSummary(cases)};
}
export function sanitizedEvidence(manifest, {cleanup, workflowPassed, startedAt, finishedAt}) {
  const profile = Object.hasOwn(PROFILE_INVENTORIES, manifest.profile) ? manifest.profile : null;
  const sources = {};
  for (const name of ['api', 'web']) {
    const source = manifest.sources?.[name];
    if (source && /^[a-f0-9]{40}$/.test(source.revision) && hash(source.sha256)) sources[name] = {revision: source.revision, sha256: source.sha256};
  }
  const images = (manifest.evidenceImages || []).filter(i =>
    /^(postgres|redis|minio|zitadel|login|api|worker|migrate)$/.test(i.service) &&
    /^sha256:[a-f0-9]{64}$/.test(i.id) &&
    /^(?:[a-z0-9./_-]+@sha256:[a-f0-9]{64}|ontokit-e2e-[a-f0-9]{32}\/api:run)$/.test(i.reference)
  ).map(({service, id, reference}) => ({service, id, reference}));
  const migrationHeads = (manifest.migrationHeads || []).filter(h => /^[a-zA-Z0-9_]{1,100}$/.test(h));
  const tests = sanitizedTests(profile, manifest.tests);
  const lifecycle = profile === 'lifecycle' ? sanitizedLifecycle(manifest.lifecycle) : null;
  const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  return {version: 2, profile, run: /^[a-f0-9]{32}$/.test(manifest.id) ? manifest.id : null,
    startedAt: time(startedAt), finishedAt: time(finishedAt), sources, images, migrationHeads, tests, lifecycle,
    // R8: this harness only ever proves local verification; hosted acceptance is separate.
    acceptance: {scope: 'local-verification', hostedAcceptance: false},
    workflowPassed: workflowPassed === true, cleanup: cleanup === 'complete' ? 'complete' : 'failed',
    acceptedRun: workflowPassed === true && cleanup === 'complete' && !!profile && !!tests && (profile !== 'lifecycle' || !!lifecycle) &&
      Object.keys(sources).length === 2 && ['postgres', 'redis', 'minio', 'zitadel', 'login', 'api', 'worker'].every(service => images.some(image => image.service === service)) && migrationHeads.length > 0};
}
