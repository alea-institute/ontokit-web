import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pages } from '../ctt/fixtures/pages.mjs';
import { prepareSources, verifySources, stageSources, sourceEvidence, sha256, rawUrl, UPSTREAM, TARGETS } from './sources.mjs';
import { sanitizedEvidence, PROFILE_INVENTORIES, REHEARSAL_CASES } from '../e2e/evidence.mjs';
import { profileSpec } from '../e2e/auth-modes.mjs';
import { backup } from './test-helpers.mjs';
import { readTarget, runHosted } from './hosted.mjs';

const folio = Buffer.from('<rdf:RDF><owl:Class rdf:about="https://folio.example/Canon"/></rdf:RDF>');
const catholic = Buffer.from('@prefix : <https://catholic.example/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n:HolySee a owl:Class .\n');
const upstream = {
  folio: {...UPSTREAM.folio, sha256: sha256(folio)},
  catholic: {...UPSTREAM.catholic, sha256: sha256(catholic)},
};
const targets = {
  folio: {source: 'folio', marker: 'rdf:about="https://folio.example/Canon"'},
  catholic: {source: 'catholicCtt', marker: ':HolySee a owl:Class'},
  cttTerm: {source: 'catholicCtt', marker: 'term/tessera> a owl:Class'},
};
function fakeFetch({tamper = false} = {}) {
  const served = pages();
  const routes = {'/': served.home, '/vocabulary/': served.vocabulary, '/findings/': served.findings};
  const requested = [];
  const fetchImpl = async url => {
    const target = String(url);
    requested.push(target);
    if (target === rawUrl(upstream.folio)) return new Response(tamper ? Buffer.from('tampered') : folio);
    if (target === rawUrl(upstream.catholic)) return new Response(catholic);
    const page = routes[new URL(target).pathname];
    return page ? new Response(page, {headers: {'content-type': 'text/html'}}) : new Response('missing', {status: 404});
  };
  return {fetchImpl, requested};
}
async function withCache(check) {
  const cache = await mkdtemp(path.join(tmpdir(), 'rehearsal-sources-'));
  try { await check(cache); } finally { await rm(cache, {recursive: true, force: true}); }
}

test('pins name exact upstream commits and the rehearsal targets the spec drives', () => {
  for (const spec of Object.values(UPSTREAM)) {
    assert.match(spec.commit, /^[0-9a-f]{40}$/);
    assert.match(spec.sha256, /^[0-9a-f]{64}$/);
    assert.match(rawUrl(spec), new RegExp(`^https://raw\\.githubusercontent\\.com/${spec.repository}/${spec.commit}/`));
  }
  for (const key of ['folio', 'catholic']) assert.ok(TARGETS[key].edited && TARGETS[key].edited !== TARGETS[key].label);
  assert.deepEqual(Object.keys(TARGETS).sort(), ['catholic', 'cttFalseFriends', 'cttRoot', 'cttTerm', 'folio']);
});

test('prepare downloads pinned files, merges CTT into Catholic OS and records hashes', async () => withCache(async cache => {
  const {fetchImpl, requested} = fakeFetch();
  const manifest = await prepareSources({cache, fetchImpl, upstream, targets, now: new Date('2026-10-20T00:00:00Z')});
  assert.equal(manifest.files.folio.sha256, upstream.folio.sha256);
  assert.equal(manifest.ctt.calibration, 'uncalibrated');
  assert.deepEqual([manifest.ctt.terms, manifest.ctt.falseFriends, manifest.ctt.communities, manifest.ctt.coreWords], [4, 1, 3, 2]);
  const merged = await readFile(path.join(cache, manifest.files.catholicCtt.file), 'utf8');
  assert.ok(merged.startsWith(catholic.toString()));
  assert.match(merged, /ctt:Term a owl:Class/);
  assert.equal(sha256(Buffer.from(merged)), manifest.files.catholicCtt.sha256);
  assert.deepEqual((await verifySources(cache, upstream)).files, manifest.files);
  // A second prepare reuses verified upstream files instead of downloading them again.
  const again = fakeFetch();
  await prepareSources({cache, fetchImpl: again.fetchImpl, upstream, targets});
  assert.equal(again.requested.some(url => url.startsWith('https://raw.githubusercontent.com/')), false);
  assert.ok(requested.some(url => url === rawUrl(upstream.folio)));
}));

test('prepare refuses a download that does not match its pin, or a missing target', async () => withCache(async cache => {
  await assert.rejects(prepareSources({cache, fetchImpl: fakeFetch({tamper: true}).fetchImpl, upstream, targets}), /does not match its pinned hash/);
  await assert.rejects(prepareSources({cache, fetchImpl: fakeFetch().fetchImpl, upstream, targets: {...targets, gone: {source: 'folio', marker: 'nope'}}}), /target gone is missing/);
}));

test('verify and stage refuse tampered or unprepared caches', async () => withCache(async cache => {
  await assert.rejects(verifySources(cache, upstream), /not prepared/);
  const manifest = await prepareSources({cache, fetchImpl: fakeFetch().fetchImpl, upstream, targets});
  await assert.rejects(verifySources(cache), /not the pinned upstream file/, 'the real pins reject test content');
  const run = await mkdtemp(path.join(tmpdir(), 'rehearsal-run-'));
  try {
    const staged = await stageSources(path.join(run, 'rehearsal'), cache, upstream);
    assert.equal(sha256(await readFile(staged.paths.catholicCtt)), manifest.files.catholicCtt.sha256);
    assert.equal(path.dirname(staged.paths.folio), path.join(run, 'rehearsal'));
  } finally { await rm(run, {recursive: true, force: true}); }
  await writeFile(path.join(cache, manifest.files.catholicCtt.file), 'changed');
  await assert.rejects(verifySources(cache, upstream), /catholicCtt source does not match its manifest/);
}));

test('rehearsal inventory is four exact cases in the rehearsal project', () => {
  assert.equal(REHEARSAL_CASES.length, 4);
  assert.deepEqual(PROFILE_INVENTORIES.rehearsal.map(t => t.project), Array(4).fill('rehearsal'));
  assert.deepEqual(new Set(PROFILE_INVENTORIES.rehearsal.map(t => t.file)), new Set(profileSpec('rehearsal').specs));
});

test('rehearsal receipts keep only pinned source evidence and require it for acceptance', () => {
  const evidence = sourceEvidence({
    files: {folio: {...UPSTREAM.folio}, catholic: {...UPSTREAM.catholic}, catholicCtt: {sha256: 'e'.repeat(64)}},
    ctt: {source: {site: 'https://ctt.jaces.com/', build: {date: '2026-10-19', commit: 'f66099a'}}, calibration: 'uncalibrated', terms: 250, communities: 24, falseFriends: 6},
  });
  const manifest = {
    profile: 'rehearsal', id: 'a'.repeat(32),
    sources: {api: {revision: 'b'.repeat(40), sha256: 'c'.repeat(64)}, web: {revision: 'd'.repeat(40), sha256: 'e'.repeat(64)}},
    evidenceImages: ['postgres', 'redis', 'minio', 'api', 'worker', 'zitadel', 'login'].map(service => ({service, id: `sha256:${'f'.repeat(64)}`, reference: `example/${service}@sha256:${'1'.repeat(64)}`})),
    migrationHeads: ['head1'],
    tests: {profile: 'rehearsal', passed: 4, mandatory: PROFILE_INVENTORIES.rehearsal},
    authModes: {profile: 'rehearsal', web: {mode: 'required', providerConfigured: true}, api: {mode: 'required', providerConfigured: true}},
    rehearsal: {...evidence, ctt: {...evidence.ctt, injected: 'secret'}},
  };
  const run = {cleanup: 'complete', workflowPassed: true, startedAt: '2026-10-20T00:00:00Z', finishedAt: '2026-10-20T01:00:00Z'};
  const receipt = sanitizedEvidence(manifest, run);
  assert.equal(receipt.acceptedRun, true);
  assert.deepEqual(receipt.rehearsal.folio, {repository: UPSTREAM.folio.repository, commit: UPSTREAM.folio.commit, sha256: UPSTREAM.folio.sha256});
  assert.equal('injected' in receipt.rehearsal.ctt, false);
  assert.deepEqual(receipt.acceptance, {scope: 'local-verification', hostedAcceptance: false});
  for (const broken of [
    {...manifest, rehearsal: undefined},
    {...manifest, rehearsal: {...evidence, folio: {...evidence.folio, sha256: '0'.repeat(64)}}},
    {...manifest, rehearsal: {...evidence, ctt: {...evidence.ctt, site: 'https://elsewhere.example/'}}},
    {...manifest, rehearsal: {...evidence, ctt: {...evidence.ctt, build: {date: 'yesterday'}}}},
  ]) assert.equal(sanitizedEvidence(broken, run).acceptedRun, false);
  assert.equal('rehearsal' in sanitizedEvidence({...manifest, profile: 'suggestions'}, run), false);
});

// ---- Hosted runner ----
const hostedUsers = Object.fromEntries(['owner', 'suggester', 'editor'].map(p => [p, {id: `${p}-id`, email: `${p}@example.org`, password: 'pw'}]));
const hostedTarget = {web: 'https://ontokit.example.org', api: 'https://api.example.org', issuer: 'https://auth.example.org', login: 'https://auth.example.org', users: hostedUsers};
async function withTarget(value, check, mode = 0o600) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rehearsal-target-'));
  const file = path.join(dir, 'target.json');
  try { await writeFile(file, JSON.stringify(value)); await chmod(file, mode); await check(file); }
  finally { await rm(dir, {recursive: true, force: true}); }
}
test('hosted target must be a private file with HTTPS origins and three distinct personas', async () => {
  await withTarget(hostedTarget, async file => assert.equal((await readTarget(file)).web, 'https://ontokit.example.org'));
  await withTarget(hostedTarget, async file => assert.rejects(readTarget(file), /mode 0600/), 0o644);
  await assert.rejects(readTarget('relative.json'), /absolute path/);
  for (const [bad, message] of [
    [{...hostedTarget, web: 'http://ontokit.example.org'}, /web must be an HTTPS origin/],
    [{...hostedTarget, api: 'https://u:p@api.example.org'}, /api must be an HTTPS origin/],
    [{...hostedTarget, login: 'https://auth.example.org/ui/v2/login'}, /login must be an HTTPS origin/],
    [{...hostedTarget, users: {owner: hostedUsers.owner, suggester: hostedUsers.suggester}}, /exactly owner, suggester, editor/],
    [{...hostedTarget, users: {...hostedUsers, editor: hostedUsers.owner}}, /three distinct/],
    [{...hostedTarget, users: {...hostedUsers, editor: {id: 'x', email: 'x@example.org'}}}, /editor needs id, email and password/],
  ]) await withTarget(bad, async file => assert.rejects(readTarget(file), message));
});
test('hosted preflight stops before any run directory exists when the host is not serving', async () => {
  await withTarget(hostedTarget, async file => {
    const down = async () => new Response('down', {status: 502});
    await assert.rejects(runHosted({targetFile: file, fetchImpl: down, runPlaywright: async () => assert.fail('must not run')}), /health returned 502/);
    const noProvider = async url => new Response(JSON.stringify(String(url).endsWith('/providers') ? {} : {ok: true}), {headers: {'content-type': 'application/json'}});
    await assert.rejects(runHosted({targetFile: file, fetchImpl: noProvider, runPlaywright: async () => assert.fail('must not run')}), /does not offer Zitadel/);
  });
});

test('verify rejects a regenerated file whose manifest hash was updated to match', async () => withCache(async cache => {
  const manifest = await prepareSources({cache, fetchImpl: fakeFetch().fetchImpl, upstream, targets});
  const file = path.join(cache, manifest.files.catholicCtt.file);
  const forged = (await readFile(file, 'utf8')) + '\n<urn:x> <urn:y> <urn:z> .\n';
  await writeFile(file, forged);
  manifest.files.catholicCtt.sha256 = sha256(Buffer.from(forged));
  await writeFile(path.join(cache, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(verifySources(cache, upstream), /not the Catholic OS file merged with the CTT module/);
  manifest.files.catholicCtt.file = manifest.files.cttModule.file;
  await writeFile(path.join(cache, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(verifySources(cache, upstream), /catholicCtt source entry is invalid/);
}));

test('hosted targets on loopback or private networks are refused', async () => {
  for (const web of ['https://localhost', 'https://127.0.0.1', 'https://10.0.0.5', 'https://192.168.1.2', 'https://172.20.0.1', 'https://[::1]']) {
    await withTarget({...hostedTarget, web}, async file => assert.rejects(readTarget(file), /web must be a remote host/));
  }
});

test('hosted runs remove the credential directory and never put secrets in the receipt', async () => {
  const serving = async url => new Response(JSON.stringify(String(url).endsWith('/providers') ? {zitadel: {}} : {ok: true}), {headers: {'content-type': 'application/json'}});
  await withTarget(hostedTarget, async file => {
    let runDir;
    const failing = async env => {
      runDir = path.dirname(env.ONTOKIT_E2E_CONFIG);
      const config = JSON.parse(await readFile(env.ONTOKIT_E2E_CONFIG, 'utf8'));
      assert.equal(config.rehearsal.target, 'hosted');
      assert.equal(config.users.owner.password, 'pw');
      return 1; // Playwright failed and wrote no report.
    };
    const stage = async destination => {
      await mkdir(destination, {mode: 0o700});
      const paths = {folio: path.join(destination, 'FOLIO.owl'), catholicCtt: path.join(destination, 'c.ttl')};
      for (const target of Object.values(paths)) await writeFile(target, 'x');
      return {paths, manifest: {
        files: {folio: {...UPSTREAM.folio}, catholic: {...UPSTREAM.catholic}, catholicCtt: {sha256: 'e'.repeat(64)}},
        ctt: {source: {site: 'https://ctt.jaces.com/', build: {date: '2026-10-19', commit: 'f66099a'}}, calibration: 'uncalibrated', terms: 250, communities: 24, falseFriends: 6},
      }};
    };
    const {receipt, file: receiptFile, failure} = await runHosted({targetFile: file, fetchImpl: serving, runPlaywright: failing, stage, verifyBackup: backup});
    try {
      assert.ok(failure);
      assert.ok(runDir, 'Playwright was reached');
      assert.equal(receipt.rehearsal.folio.commit, UPSTREAM.folio.commit);
      assert.equal(receipt.passed, false);
      assert.deepEqual(receipt.acceptance, {scope: 'hosted-rehearsal', hostedAcceptance: false});
      await assert.rejects(readFile(path.join(runDir, 'playwright-run.json')), {code: 'ENOENT'});
      const text = await readFile(receiptFile, 'utf8');
      for (const secret of ['"pw"', 'password', '@example.org', 'auth.example.org']) assert.equal(text.includes(secret), false, secret);
    } finally { await rm(receiptFile, {force: true}); }
  });
});
