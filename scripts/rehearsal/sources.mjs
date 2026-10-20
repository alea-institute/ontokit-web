// BAIF rehearsal inputs (cycle sweep-2026-10-20): the real FOLIO and Catholic OS
// ontologies at pinned upstream commits, plus the CTT module merged into the Catholic
// ontology. `prepareSources` is the only step that touches the network; it writes an
// ignored cache and a manifest of hashes. `verifySources` re-hashes the cache before any
// run uses it, so a stale or tampered file stops the rehearsal before an import.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCtt } from '../ctt/import.mjs';
import { DEFAULT_BASE } from '../ctt/turtle.mjs';
import { TARGETS, UPSTREAM } from './pins.mjs';

export { TARGETS, UPSTREAM };

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = path.join(ROOT, '.e2e-runs', 'rehearsal-sources');
export const MANIFEST_VERSION = 1;
const MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024; // The API accepts imports up to 50 MiB.

export const rawUrl = ({repository, commit, path: file}) => `https://raw.githubusercontent.com/${repository}/${commit}/${file}`;
export const GENERATED = Object.freeze({cttModule: 'ctt-module.ttl', cttSnapshot: 'ctt-snapshot.json', catholicCtt: 'catholic-os-ctt.ttl'});

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function download(url, fetchImpl) {
  const response = await fetchImpl(url, {redirect: 'error', signal: AbortSignal.timeout(300_000)});
  if (!response.ok) throw new Error(`Rehearsal source download returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error('Rehearsal source is larger than the import limit');
  return bytes;
}
async function writeAtomic(file, bytes) {
  const temporary = `${file}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes, {mode: 0o600, flag: 'wx'}); await rename(temporary, file); }
  catch (error) { await rm(temporary, {force: true}); throw error; }
}

/**
 * Downloads and verifies the pinned upstream files, runs the CTT import against the live
 * site (or `cttHtmlDir` / `cttExport`), merges it into the Catholic ontology and writes
 * the manifest. Reuses an already verified upstream file instead of downloading again.
 */
// `upstream` and `targets` are injectable for tests only; runs always use the pins above.
export async function prepareSources({cache = CACHE, fetchImpl = fetch, cttHtmlDir, cttExport, now = new Date(), upstream = UPSTREAM, targets = TARGETS} = {}) {
  await mkdir(cache, {recursive: true, mode: 0o700});
  const files = {};
  const text = {};
  for (const [name, spec] of Object.entries(upstream)) {
    const file = path.join(cache, spec.file);
    let bytes = await readFile(file).catch(() => null);
    if (!bytes || sha256(bytes) !== spec.sha256) {
      bytes = await download(rawUrl(spec), fetchImpl);
      if (sha256(bytes) !== spec.sha256) throw new Error(`${spec.repository} ${spec.path} does not match its pinned hash`);
      await writeAtomic(file, bytes);
    }
    files[name] = {file: spec.file, sha256: spec.sha256, mimeType: spec.mimeType, repository: spec.repository, commit: spec.commit, path: spec.path, license: spec.license};
    text[name] = bytes.toString('utf8');
  }
  const ctt = await importCtt({htmlDir: cttHtmlDir, exportFile: cttExport, host: text.catholic, retrievedAt: now.toISOString(), fetchImpl});
  const generated = {cttModule: ctt.turtle, cttSnapshot: JSON.stringify(ctt.snapshot, null, 2) + '\n', catholicCtt: ctt.merged};
  for (const [name, body] of Object.entries(generated)) {
    await writeAtomic(path.join(cache, GENERATED[name]), Buffer.from(body));
    files[name] = {file: GENERATED[name], sha256: sha256(Buffer.from(body)), mimeType: name === 'cttSnapshot' ? 'application/json' : 'text/turtle'};
  }
  const sourceText = {folio: text.folio, catholicCtt: generated.catholicCtt};
  for (const [key, target] of Object.entries(targets)) {
    if (!sourceText[target.source].includes(target.marker)) throw new Error(`Rehearsal target ${key} is missing from its source`);
  }
  const terms = ctt.snapshot.terms;
  const manifest = {
    version: MANIFEST_VERSION, preparedAt: now.toISOString(), files,
    ctt: {
      source: ctt.snapshot.source, calibration: ctt.snapshot.calibration, base: DEFAULT_BASE,
      terms: terms.length, communities: ctt.snapshot.communities.length,
      falseFriends: terms.filter(t => t.verdict === 'false-friend').length, coreWords: terms.filter(t => t.core).length,
    },
  };
  await writeAtomic(path.join(cache, 'manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return manifest;
}

/** Re-hashes every cached file against the manifest and the upstream pins. */
export async function verifySources(cache = CACHE, upstream = UPSTREAM) {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(cache, 'manifest.json'), 'utf8')); }
  catch { throw new Error('Rehearsal sources are not prepared; run npm run rehearsal:sources'); }
  if (manifest?.version !== MANIFEST_VERSION) throw new Error('Rehearsal source manifest has an unknown version');
  for (const [name, spec] of Object.entries(upstream)) if (manifest.files?.[name]?.sha256 !== spec.sha256) throw new Error(`Rehearsal ${name} source is not the pinned upstream file`);
  for (const name of [...Object.keys(upstream), ...Object.keys(GENERATED)]) {
    const entry = manifest.files?.[name];
    if (!entry || path.basename(entry.file) !== entry.file) throw new Error(`Rehearsal ${name} source entry is invalid`);
    const bytes = await readFile(path.join(cache, entry.file)).catch(() => null);
    if (!bytes || sha256(bytes) !== entry.sha256) throw new Error(`Rehearsal ${name} source does not match its manifest`);
  }
  if (manifest.ctt?.calibration !== 'uncalibrated' && manifest.ctt?.calibration !== 'calibrated') throw new Error('Rehearsal CTT calibration is unknown');
  return manifest;
}

/** Copies the verified files into a private run directory; returns absolute paths. */
export async function stageSources(destination, cache = CACHE, upstream = UPSTREAM) {
  const manifest = await verifySources(cache, upstream);
  await mkdir(destination, {mode: 0o700});
  const paths = {};
  for (const name of ['folio', 'catholicCtt']) {
    const target = path.join(destination, manifest.files[name].file);
    await copyFile(path.join(cache, manifest.files[name].file), target);
    if (sha256(await readFile(target)) !== manifest.files[name].sha256) throw new Error('Staged rehearsal source changed while copying');
    paths[name] = target;
  }
  return {manifest, paths};
}

/** Non-secret receipt fields: hashes, pins and the CTT build. */
export const sourceEvidence = manifest => ({
  folio: {repository: manifest.files.folio.repository, commit: manifest.files.folio.commit, sha256: manifest.files.folio.sha256},
  catholic: {repository: manifest.files.catholic.repository, commit: manifest.files.catholic.commit, sha256: manifest.files.catholic.sha256},
  catholicCtt: {sha256: manifest.files.catholicCtt.sha256},
  ctt: {site: manifest.ctt.source.site, build: manifest.ctt.source.build, calibration: manifest.ctt.calibration, terms: manifest.ctt.terms, communities: manifest.ctt.communities, falseFriends: manifest.ctt.falseFriends},
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  prepareSources({cttHtmlDir: value('--ctt-html-dir'), cttExport: value('--ctt-export')}).then(manifest => {
    console.log(`Rehearsal sources ready in ${CACHE}`);
    console.log(`FOLIO ${manifest.files.folio.commit.slice(0, 8)}, Catholic OS ${manifest.files.catholic.commit.slice(0, 8)}, CTT ${manifest.ctt.terms} terms (${manifest.ctt.calibration}, build ${Object.values(manifest.ctt.source.build).join(' ') || 'unknown'})`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
