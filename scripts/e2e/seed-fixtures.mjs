// D09 ownership fixtures (KTD4). Provider-less profiles have no bearer tokens, so the
// launcher seeds run-tagged projects by running a fixed Python entry inside the run's own
// `api` container, through ProjectService with a synthetic current user. Only project
// IDs, synthetic owner subjects and the run tag leave the container.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { baseEnv, composeArgs } from './runtime.mjs';
import { saveManifest, ownsResource } from './ownership.mjs';
import { profileSpec } from './auth-modes.mjs';

export const FIXTURE_KEYS = Object.freeze(['publicProject', 'foreignPrivateProject', 'personaPrivateProject']);
const RUN_ID = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Zitadel subjects are numeric; anything shaped like the synthetic or anonymous owner is refused.
const PERSONA_SUBJECT = /^[0-9]{6,40}$/;
export const runTag = (runId, key) => `ontokit-e2e-run:${runId}:${key}`;
export const foreignOwner = runId => `e2e-foreign-${runId}`;

/** The fixtures one profile needs, validated before anything touches the container. */
export function seedPlan(profile, {runId, personaSubject} = {}) {
  const seed = profileSpec(profile).seed;
  if (!seed) throw new Error('Seed fixtures are not defined for this profile');
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) throw new Error('Seed input invalid: run identity');
  const owner = foreignOwner(runId);
  const fixture = (key, isPublic, fixtureOwner) => ({key, isPublic, owner: fixtureOwner, name: `D09 ${key} ${runId.slice(0, 8)}`, tag: runTag(runId, key)});
  const plan = [fixture('publicProject', true, owner), fixture('foreignPrivateProject', false, owner)];
  if (seed.persona) {
    if (typeof personaSubject !== 'string' || !PERSONA_SUBJECT.test(personaSubject)) throw new Error('Seed input invalid: persona subject');
    plan.push(fixture('personaPrivateProject', false, personaSubject));
  } else if (personaSubject !== undefined) throw new Error('Seed input invalid: provider-less profiles have no persona');
  return plan;
}

const PY_PREAMBLE = [
  'import asyncio, base64, json, sys',
  'from uuid import UUID',
  'from sqlalchemy import func, select',
  'from ontokit.core.auth import CurrentUser',
  'from ontokit.core.database import async_session_maker',
  'from ontokit.models.project import Project',
  'from ontokit.services.project_service import ProjectService',
  'spec = json.loads(sys.argv[1])',
  'prefix = "ontokit-e2e-run:" + spec["runId"] + ":"',
  'def user(subject): return CurrentUser(id=subject, email=subject + "@example.test", name="D09 fixture owner", username=subject)',
];
// Creates each fixture by import so it has real persisted source and a queued index build
// (as POST /projects/import does), then proves the run's tagged rows are exactly these.
export const SEED_SCRIPT = [
  ...PY_PREAMBLE,
  'from ontokit.services.storage import get_storage_service',
  'from ontokit.api.utils.redis import get_arq_pool',
  'async def main():',
  '    ontology = base64.b64decode(spec["ontology"])',
  '    out = {}',
  '    async with async_session_maker() as db:',
  '        if (await db.execute(select(func.count()).select_from(Project).where(Project.description.startswith(prefix)))).scalar_one():',
  '            raise SystemExit("run fixtures already exist")',
  '        service = ProjectService(db)',
  '        for f in spec["fixtures"]:',
  '            result = await service.create_from_import(file_content=ontology, filename="tiny-ontology.ttl", is_public=f["isPublic"], owner=user(f["owner"]), storage=get_storage_service(), name_override=f["name"], description_override=f["tag"])',
  '            if not service.git_service.repository_exists(result.id):',
  '                raise SystemExit("fixture repository missing")',
  '            out[f["key"]] = {"id": str(result.id), "owner": f["owner"], "isPublic": f["isPublic"], "tag": f["tag"]}',
  '        rows = (await db.execute(select(Project.id, Project.owner_id, Project.is_public, Project.description).where(Project.description.startswith(prefix)))).all()',
  '    # Same follow-up as POST /projects/import: build the ontology index on the worker.',
  '    pool = await get_arq_pool()',
  '    if pool is None:',
  '        raise SystemExit("index queue unavailable")',
  '    for f in out.values():',
  '        await pool.enqueue_job("run_ontology_index_task", f["id"], "main")',
  '    tagged = sorted([str(r[0]), r[1], bool(r[2]), r[3]] for r in rows)',
  '    print(json.dumps({"fixtures": out, "tagged": tagged}))',
  'asyncio.run(main())',
].join('\n');
// Deletes exactly the recorded IDs, as their recorded owner, and only when the row still
// carries this run's tag. Any other run's rows are never selected.
export const PURGE_SCRIPT = [
  ...PY_PREAMBLE,
  'async def main():',
  '    deleted = 0',
  '    async with async_session_maker() as db:',
  '        service = ProjectService(db)',
  '        for f in spec["fixtures"]:',
  '            project = (await db.execute(select(Project).where(Project.id == UUID(f["id"])))).scalar_one_or_none()',
  '            if project is None:',
  '                continue',
  '            if project.description != f["tag"] or project.owner_id != f["owner"]:',
  '                raise SystemExit("fixture ownership mismatch")',
  '            await service.delete(project.id, user(f["owner"]))',
  '            deleted += 1',
  '        remaining = (await db.execute(select(func.count()).select_from(Project).where(Project.description.startswith(prefix)))).scalar_one()',
  '    print(json.dumps({"deleted": deleted, "remaining": remaining}))',
  'asyncio.run(main())',
].join('\n');

const lastJson = output => {
  const line = String(output ?? '').trim().split('\n').filter(Boolean).at(-1);
  try { return JSON.parse(line); } catch { return null; }
};
/** Accepts only exactly the planned fixtures, each with a fresh UUID and its planned owner. */
export function parseSeedOutput(output, plan) {
  const value = lastJson(output);
  const fail = () => { throw new Error('Seed fixtures failed: unexpected container result'); };
  if (!value || typeof value.fixtures !== 'object' || !Array.isArray(value.tagged)) fail();
  const keys = Object.keys(value.fixtures).sort();
  if (keys.join() !== plan.map(f => f.key).sort().join()) fail();
  const fixtures = {};
  for (const f of plan) {
    const got = value.fixtures[f.key];
    if (!got || !UUID.test(got.id) || got.owner !== f.owner || got.isPublic !== f.isPublic || got.tag !== f.tag) fail();
    fixtures[f.key] = {id: got.id, owner: f.owner, isPublic: f.isPublic, tag: f.tag};
  }
  const ids = Object.values(fixtures).map(f => f.id);
  if (new Set(ids).size !== ids.length) fail();
  // Every run-tagged row is one of ours, with the recorded owner and visibility.
  const expected = Object.values(fixtures).map(f => JSON.stringify([f.id, f.owner, f.isPublic, f.tag])).sort();
  if (JSON.stringify(value.tagged.map(r => JSON.stringify(r)).sort()) !== JSON.stringify(expected)) fail();
  return fixtures;
}
/** Only IDs reach the private Playwright config; owners and tags stay in the manifest. */
export const fixtureIds = fixtures => Object.fromEntries(Object.entries(fixtures).map(([key, f]) => [key, f.id]));

/** Validates a manifest seed record before it can authorize any deletion. */
export function purgePayload(manifest) {
  const seed = manifest?.seed;
  // Nothing recorded, or interrupted before the container reported IDs: only volume
  // removal can clean that up, and it removes every run-labelled row.
  if (!seed || seed.fixtures === null) return null;
  if (seed.runId !== manifest.id || !RUN_ID.test(seed.runId) || !seed.fixtures || typeof seed.fixtures !== 'object') throw new Error('Seed record invalid');
  const fixtures = Object.entries(seed.fixtures).map(([key, f]) => {
    if (!FIXTURE_KEYS.includes(key) || !f || !UUID.test(f.id) || f.tag !== runTag(seed.runId, key)) throw new Error('Seed record invalid');
    if (key === 'personaPrivateProject' ? !PERSONA_SUBJECT.test(f.owner) : f.owner !== foreignOwner(seed.runId)) throw new Error('Seed record invalid');
    return {key, id: f.id, owner: f.owner, tag: f.tag};
  });
  if (!fixtures.length) throw new Error('Seed record invalid');
  return {runId: seed.runId, fixtures};
}
export function parsePurgeOutput(output, payload) {
  const value = lastJson(output);
  if (!value || !Number.isSafeInteger(value.deleted) || value.deleted < 0 || value.deleted > payload.fixtures.length || value.remaining !== 0) throw new Error('Seed fixture purge incomplete');
  return value;
}

function composeExecApi(ctx, args, timeout = 180_000) {
  return execFileSync('docker', composeArgs(ctx, 'exec', '-T', 'api', ...args), {env: baseEnv(), encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe']});
}
async function anonymousStatus(url, signal) {
  const response = await fetch(url, {redirect: 'error', signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(15_000)])});
  return {status: response.status, body: response.ok ? await response.json() : null};
}
/** Checks the fixtures through the real API as an anonymous caller before any browser case. */
export async function verifyFixturesThroughApi(api, fixtures, {signal, fetchStatus = anonymousStatus} = {}) {
  const observed = {};
  for (const [key, f] of Object.entries(fixtures)) {
    const {status, body} = await fetchStatus(`${api}/api/v1/projects/${f.id}`, signal);
    observed[key] = status;
    if (f.isPublic ? status !== 200 || body?.id !== f.id || body?.is_public !== true : status !== 403) throw new Error(`Seed fixtures not visible as expected through the API (${key}: ${status})`);
  }
  return observed;
}

export async function seedFixtures(ctx, {profile, api, personaSubject}, {exec = composeExecApi, ontology, fetchStatus, save = c => saveManifest(c.manifestDir, c.manifest)} = {}) {
  const runId = ctx.manifest.id;
  const plan = seedPlan(profile, {runId, personaSubject});
  // The copied web snapshot supplies the ontology, so the run fingerprint covers it.
  const bytes = ontology ?? await readFile(path.join(ctx.dir, 'web', 'e2e', 'fixtures', 'tiny-ontology.ttl'));
  // Record intent first so interruption after creation still has a validated purge scope.
  ctx.manifest.seed = {runId, planned: plan.map(f => f.key), fixtures: null};
  await save(ctx);
  let output;
  try { output = exec(ctx, ['python', '-c', SEED_SCRIPT, JSON.stringify({runId, fixtures: plan, ontology: Buffer.from(bytes).toString('base64')})]); }
  catch { throw new Error('Seed fixtures failed in the API container'); }
  const fixtures = parseSeedOutput(output, plan);
  ctx.manifest.seed = {runId, planned: plan.map(f => f.key), fixtures};
  await save(ctx);
  const observed = await verifyFixturesThroughApi(api, fixtures, {signal: ctx.signal, ...(fetchStatus ? {fetchStatus} : {})});
  ctx.manifest.seed.anonymousApiStatus = observed;
  await save(ctx);
  console.log(`Seeded ${plan.length} run-tagged fixtures (${plan.map(f => f.key).join(', ')}); anonymous API statuses ${JSON.stringify(observed)}`);
  return fixtures;
}

/** Exact-ID purge through the run's own Compose project (normal workflow path). */
export async function purgeSeededFixtures(ctx, {exec = composeExecApi, save = c => saveManifest(c.manifestDir, c.manifest)} = {}) {
  const payload = purgePayload(ctx.manifest);
  if (!payload) return null;
  let output;
  try { output = exec(ctx, ['python', '-c', PURGE_SCRIPT, JSON.stringify(payload)]); }
  catch { throw new Error('Seed fixture purge failed in the API container'); }
  const result = parsePurgeOutput(output, payload);
  ctx.manifest.seed.purged = true;
  await save(ctx);
  return result;
}

/**
 * Recovery path for cleanup.mjs: purge through a still-running API container that carries
 * both run ownership labels. Volume removal stays the authoritative data cleanup, so a
 * missing or stopped container is not an error here.
 */
export function purgeSeededForRecovery(manifest, {docker}) {
  const payload = purgePayload(manifest);
  if (!payload || manifest.seed.purged) return null;
  const ids = docker(['ps', '-q', '--filter', `label=io.ontokit.e2e.run=${manifest.id}`, '--filter', 'label=com.docker.compose.service=api']).split('\n').filter(Boolean);
  if (ids.length !== 1) return null;
  const info = JSON.parse(docker(['inspect', ids[0]]))[0];
  if (!ownsResource(manifest, info.Config?.Labels) || info.Config?.Labels?.['com.docker.compose.service'] !== 'api') throw new Error('Docker ownership mismatch; refusing cleanup');
  return parsePurgeOutput(docker(['exec', ids[0], 'python', '-c', PURGE_SCRIPT, JSON.stringify(payload)]), payload);
}
