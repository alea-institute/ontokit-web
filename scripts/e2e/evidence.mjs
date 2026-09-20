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

export function validateReport(report) {
  const fail = () => { throw new Error('Full-stack runner did not pass every mandatory test'); };
  const stats = report?.stats;
  if (!stats || !Array.isArray(report.errors) || report.errors.length ||
      !Number.isInteger(stats.expected) || stats.expected < REQUIRED_TESTS.length ||
      stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0) fail();
  const found = [];
  function visit(suites) {
    if (!Array.isArray(suites)) fail();
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        if (!spec.ok || !Array.isArray(spec.tests) || !spec.tests.length) fail();
        for (const t of spec.tests) {
          if (t.status !== 'expected' || t.expectedStatus !== 'passed' || t.results?.length !== 1 ||
              t.results[0].status !== 'passed' || (t.results[0].errors?.length || 0)) fail();
          found.push({file: spec.file, title: spec.title, project: t.projectName});
        }
      }
      visit(suite.suites || []);
    }
  }
  visit(report.suites);
  if (found.length !== stats.expected) fail();
  for (const required of REQUIRED_TESTS) {
    if (found.filter(t => t.file === required.file && t.title === required.title && t.project === required.project).length !== 1) fail();
  }
  // Only checked, fixed inventory names are durable; additional dynamic titles stay private.
  return {passed: stats.expected, skipped: 0, failed: 0, flaky: 0, mandatory: REQUIRED_TESTS.map(t => ({...t}))};
}

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function sanitizedEvidence(manifest, {cleanup, workflowPassed, startedAt, finishedAt}) {
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
  const tests = manifest.tests ? {passed: manifest.tests.passed, skipped: 0, failed: 0, flaky: 0,
    mandatory: REQUIRED_TESTS.map(t => ({...t}))} : null;
  return {version: 1, run: /^[a-f0-9]{32}$/.test(manifest.id) ? manifest.id : null,
    startedAt, finishedAt, sources, images, migrationHeads, tests,
    workflowPassed: workflowPassed === true, cleanup: cleanup === 'complete' ? 'complete' : 'failed',
    acceptedRun: workflowPassed === true && cleanup === 'complete' && !!tests &&
      Object.keys(sources).length === 2 && ['postgres', 'redis', 'minio', 'zitadel', 'login', 'api', 'worker'].every(service => images.some(image => image.service === service)) && migrationHeads.length > 0};
}
