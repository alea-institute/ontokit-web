import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedPlan, seedFixtures, purgeSeededFixtures, purgeSeededForRecovery, purgePayload, parseSeedOutput, parsePurgeOutput,
  verifyFixturesThroughApi, fixtureIds, runTag, foreignOwner, SEED_SCRIPT, PURGE_SCRIPT,
} from './seed-fixtures.mjs';

const RUN = 'a'.repeat(32), OTHER = 'b'.repeat(32), PERSONA = '345678901234567890';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// A synthetic container: creates exactly what the plan asks for and reports it.
function fakeContainer({mutate = value => value, tagged} = {}) {
  const calls = [];
  const exec = (_ctx, args) => {
    calls.push(args);
    assert.deepEqual(args.slice(0, 2), ['python', '-c']);
    const spec = JSON.parse(args[3]);
    if (args[2] === SEED_SCRIPT) {
      const fixtures = Object.fromEntries(spec.fixtures.map((f, i) => [f.key, {id: uuid(i + 1), owner: f.owner, isPublic: f.isPublic, tag: f.tag}]));
      const rows = tagged ?? Object.values(fixtures).map(f => [f.id, f.owner, f.isPublic, f.tag]);
      return `startup noise\n${JSON.stringify(mutate({fixtures, tagged: rows}))}\n`;
    }
    assert.equal(args[2], PURGE_SCRIPT);
    return JSON.stringify({deleted: spec.fixtures.length, remaining: 0});
  };
  return {exec, calls};
}
const ctxFor = () => ({manifest: {id: RUN}, dir: '/nonexistent', signal: undefined});
const okStatus = fixtures => async url => {
  const f = Object.values(fixtures ?? {}).find(x => url.endsWith(x.id));
  return f?.isPublic ? {status: 200, body: {id: f.id, is_public: true}} : {status: 403, body: null};
};
async function seed(profile, options = {}) {
  const ctx = ctxFor();
  const container = options.container ?? fakeContainer();
  let seeded;
  const fetchStatus = async (url, signal) => okStatus(seeded)(url, signal);
  const saves = [];
  const result = await seedFixtures(ctx, {profile, api: 'http://localhost:4', personaSubject: options.personaSubject}, {
    exec: (c, args) => { const out = container.exec(c, args); seeded = parseSeedOutput(out, seedPlan(profile, {runId: RUN, personaSubject: options.personaSubject})); return out; },
    ontology: Buffer.from('@prefix ex: <https://example.org/> .'), fetchStatus: options.fetchStatus ?? fetchStatus,
    save: async c => saves.push(structuredClone(c.manifest.seed)),
  });
  return {ctx, result, saves, container};
}

test('provider-less seeding returns exactly one public and one foreign private project', async () => {
  for (const profile of ['optional-anonymous', 'disabled']) {
    const {ctx, result, saves} = await seed(profile);
    assert.deepEqual(Object.keys(result).sort(), ['foreignPrivateProject', 'publicProject']);
    assert.equal(result.publicProject.isPublic, true);
    assert.equal(result.foreignPrivateProject.isPublic, false);
    for (const f of Object.values(result)) assert.equal(f.owner, foreignOwner(RUN));
    assert.deepEqual(fixtureIds(result), {publicProject: uuid(1), foreignPrivateProject: uuid(2)});
    assert.deepEqual(ctx.manifest.seed.anonymousApiStatus, {publicProject: 200, foreignPrivateProject: 403});
    assert.equal(saves[0].fixtures, null, 'intent is recorded before the container creates anything');
  }
});
test('optional-configured also seeds a persona-owned private project owned by the persona subject', async () => {
  const {result} = await seed('optional-configured', {personaSubject: PERSONA});
  assert.deepEqual(Object.keys(result).sort(), ['foreignPrivateProject', 'personaPrivateProject', 'publicProject']);
  assert.equal(result.personaPrivateProject.owner, PERSONA);
  assert.equal(result.personaPrivateProject.isPublic, false);
  assert.notEqual(result.foreignPrivateProject.owner, PERSONA);
  assert.equal(result.foreignPrivateProject.owner, foreignOwner(RUN));
});
test('seed input is validated before the container is touched', () => {
  assert.throws(() => seedPlan('baseline', {runId: RUN}), /not defined/);
  assert.throws(() => seedPlan('lifecycle', {runId: RUN}), /not defined/);
  assert.throws(() => seedPlan('unknown', {runId: RUN}), /Unknown E2E profile/);
  for (const runId of [undefined, 'A'.repeat(32), 'a'.repeat(31), `${RUN}\n`, '../' + RUN]) assert.throws(() => seedPlan('disabled', {runId}), /run identity/);
  for (const personaSubject of [undefined, '', 'anonymous', foreignOwner(RUN), '12345', '1234567 ; rm', '9'.repeat(41)]) {
    assert.throws(() => seedPlan('optional-configured', {runId: RUN, personaSubject}), /persona subject/);
  }
  assert.throws(() => seedPlan('disabled', {runId: RUN, personaSubject: PERSONA}), /no persona/);
  for (const f of seedPlan('optional-configured', {runId: RUN, personaSubject: PERSONA})) assert.equal(f.tag, runTag(RUN, f.key));
});
test('container results that differ from the plan are rejected', async () => {
  const plan = seedPlan('disabled', {runId: RUN});
  const good = {fixtures: {publicProject: {id: uuid(1), owner: foreignOwner(RUN), isPublic: true, tag: runTag(RUN, 'publicProject')}, foreignPrivateProject: {id: uuid(2), owner: foreignOwner(RUN), isPublic: false, tag: runTag(RUN, 'foreignPrivateProject')}}};
  good.tagged = Object.values(good.fixtures).map(f => [f.id, f.owner, f.isPublic, f.tag]);
  assert.equal(Object.keys(parseSeedOutput(JSON.stringify(good), plan)).length, 2);
  const bad = [
    v => { v.fixtures.personaPrivateProject = {...v.fixtures.publicProject, id: uuid(3)}; },
    v => { delete v.fixtures.foreignPrivateProject; },
    v => { v.fixtures.publicProject.owner = 'anonymous'; },
    v => { v.fixtures.publicProject.isPublic = false; },
    v => { v.fixtures.publicProject.id = 'not-a-uuid'; },
    v => { v.fixtures.foreignPrivateProject.id = v.fixtures.publicProject.id; },
    v => { v.tagged.push([uuid(9), foreignOwner(RUN), false, runTag(RUN, 'publicProject')]); },
    v => { v.tagged = v.tagged.slice(1); },
    v => { v.fixtures.publicProject.tag = runTag(OTHER, 'publicProject'); },
  ];
  for (const mutate of bad) {
    const value = structuredClone(good); mutate(value);
    assert.throws(() => parseSeedOutput(JSON.stringify(value), plan), /unexpected container result/);
  }
  assert.throws(() => parseSeedOutput('Traceback: boom', plan), /unexpected container result/);
});
test('a seed failure fails setup before any browser case', async () => {
  const ctx = ctxFor();
  await assert.rejects(seedFixtures(ctx, {profile: 'disabled', api: 'http://localhost:4'}, {exec: () => { throw new Error('container said something private'); }, ontology: Buffer.from('x'), save: async () => {}}), /^Error: Seed fixtures failed in the API container$/);
  assert.deepEqual(ctx.manifest.seed.planned, ['publicProject', 'foreignPrivateProject']);
  assert.equal(purgePayload(ctx.manifest), null, 'no recorded IDs means only volume removal applies');
  await assert.rejects(seed('disabled', {fetchStatus: async () => ({status: 404, body: null})}), /not visible as expected/);
});
test('fixtures must be visible to the anonymous API caller exactly as seeded', async () => {
  const fixtures = {publicProject: {id: uuid(1), isPublic: true}, foreignPrivateProject: {id: uuid(2), isPublic: false}};
  assert.deepEqual(await verifyFixturesThroughApi('http://localhost:4', fixtures, {fetchStatus: okStatus(fixtures)}), {publicProject: 200, foreignPrivateProject: 403});
  await assert.rejects(verifyFixturesThroughApi('http://localhost:4', fixtures, {fetchStatus: async () => ({status: 200, body: {id: uuid(2), is_public: false}})}), /publicProject/);
  await assert.rejects(verifyFixturesThroughApi('http://localhost:4', fixtures, {fetchStatus: async url => url.endsWith(uuid(1)) ? {status: 200, body: {id: uuid(1), is_public: true}} : {status: 200, body: {}}}), /foreignPrivateProject: 200/);
});

test('cleanup purges this run by exact ID and tag, never another run', async () => {
  const {ctx, container} = await seed('optional-configured', {personaSubject: PERSONA});
  const result = await purgeSeededFixtures(ctx, {exec: container.exec, save: async () => {}});
  assert.deepEqual(result, {deleted: 3, remaining: 0});
  const payload = JSON.parse(container.calls.at(-1)[3]);
  assert.equal(payload.runId, RUN);
  assert.deepEqual(payload.fixtures.map(f => f.id).sort(), [uuid(1), uuid(2), uuid(3)]);
  for (const f of payload.fixtures) assert.equal(f.tag, runTag(RUN, f.key));
  assert.equal(ctx.manifest.seed.purged, true);
  // Any record naming another run's tag or owner cannot authorize deletion.
  for (const mutate of [
    m => { m.seed.runId = OTHER; },
    m => { m.seed.fixtures.publicProject.tag = runTag(OTHER, 'publicProject'); },
    m => { m.seed.fixtures.foreignPrivateProject.owner = foreignOwner(OTHER); },
    m => { m.seed.fixtures.publicProject.owner = 'anonymous'; },
    m => { m.seed.fixtures.personaPrivateProject.owner = foreignOwner(RUN); },
    m => { m.seed.fixtures.publicProject.id = '*'; },
    m => { m.seed.fixtures.unknownProject = m.seed.fixtures.publicProject; },
    m => { m.seed.fixtures = {}; },
  ]) {
    const manifest = structuredClone(ctx.manifest); mutate(manifest);
    assert.throws(() => purgePayload(manifest), /Seed record invalid/);
  }
  assert.equal(purgePayload({id: RUN}), null);
  assert.throws(() => parsePurgeOutput(JSON.stringify({deleted: 3, remaining: 1}), payload), /incomplete/);
  assert.throws(() => parsePurgeOutput(JSON.stringify({deleted: 4, remaining: 0}), payload), /incomplete/);
  assert.match(PURGE_SCRIPT, /project\.description != f\["tag"\] or project\.owner_id != f\["owner"\]/);
  assert.match(PURGE_SCRIPT, /Project\.id == UUID\(f\["id"\]\)/);
});
test('recovery purge uses only a running API container carrying both run labels', async () => {
  const {ctx} = await seed('disabled');
  const manifest = {...ctx.manifest, project: `ontokit-e2e-${RUN}`};
  const labels = {'io.ontokit.e2e.run': RUN, 'com.docker.compose.project': manifest.project, 'com.docker.compose.service': 'api'};
  const calls = [];
  const docker = (inspectLabels, running = ['c1']) => args => {
    calls.push(args);
    if (args[0] === 'ps') return running.join('\n');
    if (args[0] === 'inspect') return JSON.stringify([{Config: {Labels: inspectLabels}}]);
    if (args[0] === 'exec') return JSON.stringify({deleted: 2, remaining: 0});
    throw new Error('unexpected');
  };
  assert.deepEqual(purgeSeededForRecovery(manifest, {docker: docker(labels)}), {deleted: 2, remaining: 0});
  assert.deepEqual(calls.at(-1).slice(0, 4), ['exec', 'c1', 'python', '-c']);
  assert.equal(purgeSeededForRecovery(manifest, {docker: docker(labels, [])}), null, 'stopped API leaves data to volume removal');
  assert.throws(() => purgeSeededForRecovery(manifest, {docker: docker({...labels, 'com.docker.compose.project': 'someone-else'})}), /ownership mismatch/);
  assert.equal(purgeSeededForRecovery({...manifest, seed: {...manifest.seed, purged: true}}, {docker: docker(labels)}), null);
});
test('cleanup attempts the exact-ID purge before Docker removal and never lets it block recovery', async () => {
  const {recoverSeededFixtures} = await import('./cleanup.mjs');
  const {ctx} = await seed('disabled');
  const manifest = {...ctx.manifest, project: `ontokit-e2e-${RUN}`};
  const labels = {'io.ontokit.e2e.run': RUN, 'com.docker.compose.project': manifest.project, 'com.docker.compose.service': 'api'};
  const logs = [];
  const log = message => logs.push(message);
  const docker = exec => args => args[0] === 'ps' ? 'c1' : args[0] === 'inspect' ? JSON.stringify([{Config: {Labels: labels}}]) : exec();
  assert.equal(recoverSeededFixtures(manifest, {docker: docker(() => JSON.stringify({deleted: 2, remaining: 0})), log}), 'purged');
  assert.equal(recoverSeededFixtures(manifest, {docker: docker(() => { throw new Error('container gone'); }), log}), 'deferred-to-volume-removal');
  assert.equal(recoverSeededFixtures({id: RUN}, {docker: docker(() => ''), log}), 'none');
  assert.ok(logs.every(line => !line.includes('container gone')), 'raw container output never reaches the terminal');
  const foreign = args => args[0] === 'ps' ? 'c1' : JSON.stringify([{Config: {Labels: {...labels, 'io.ontokit.e2e.run': OTHER}}}]);
  assert.throws(() => recoverSeededFixtures(manifest, {docker: foreign, log}), /ownership mismatch/);
});
