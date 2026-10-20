#!/usr/bin/env node
// CTT taxonomy import CLI.
//
//   node scripts/ctt/import.mjs --out ctt.ttl [--snapshot-out snapshot.json]
//        [--html-dir DIR | --export snapshot.json] [--base IRI] [--omit-quotes]
//        [--merge-into host.ttl --merged-out merged.ttl]
//
// Without --html-dir or --export it fetches the three public pages. A future structured
// export in `ctt-snapshot/v1` form plugs in through --export with no other change.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CTT_PAGES, CTT_SITE, snapshotFromPages } from './pages.mjs';
import { validateSnapshot } from './snapshot.mjs';
import { DEFAULT_BASE, mergeTurtle, snapshotToTurtle } from './turtle.mjs';

const PAGE_FILES = Object.freeze({home: 'index.html', vocabulary: 'vocabulary.html', findings: 'findings.html'});
const MAX_PAGE_BYTES = 8 * 1024 * 1024;

/** Fetches the public pages. Node honours HTTPS_PROXY when NODE_USE_ENV_PROXY=1. */
export async function fetchPages({site = CTT_SITE, fetchImpl = fetch} = {}) {
  const pages = {};
  for (const [name, route] of Object.entries(CTT_PAGES)) {
    const response = await fetchImpl(new URL(route, site), {headers: {accept: 'text/html'}, redirect: 'error', signal: AbortSignal.timeout(30_000)});
    if (!response.ok || !/text\/html/.test(response.headers.get('content-type') ?? '')) throw new Error(`CTT ${name} page returned ${response.status}`);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_PAGE_BYTES) throw new Error(`CTT ${name} page is unexpectedly large`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_PAGE_BYTES) throw new Error(`CTT ${name} page is unexpectedly large`);
    pages[name] = bytes.toString('utf8');
  }
  return pages;
}
export async function readPages(dir) {
  const pages = {};
  for (const [name, file] of Object.entries(PAGE_FILES)) pages[name] = await readFile(path.join(dir, file), 'utf8');
  return pages;
}

/** Produces {snapshot, turtle, merged?} from one source; writes nothing. */
export async function importCtt({htmlDir, exportFile, base = DEFAULT_BASE, includeExamples = true, host, retrievedAt, fetchImpl} = {}) {
  if (htmlDir && exportFile) throw new Error('Choose one CTT source: --html-dir or --export');
  const snapshot = exportFile
    ? validateSnapshot(JSON.parse(await readFile(exportFile, 'utf8')))
    : snapshotFromPages(htmlDir ? await readPages(htmlDir) : await fetchPages({fetchImpl}), {retrievedAt, includeExamples});
  const turtle = snapshotToTurtle(snapshot, {base, includeExamples});
  return {snapshot, turtle, ...(host === undefined ? {} : {merged: mergeTurtle(host, turtle)})};
}

async function main(args) {
  const value = flag => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return args[i + 1];
  };
  const out = value('--out');
  const mergeInto = value('--merge-into'), mergedOut = value('--merged-out');
  if (!out) throw new Error('--out is required');
  if (!!mergeInto !== !!mergedOut) throw new Error('--merge-into and --merged-out go together');
  const result = await importCtt({
    htmlDir: value('--html-dir'), exportFile: value('--export'), base: value('--base') ?? DEFAULT_BASE,
    includeExamples: !args.includes('--omit-quotes'),
    host: mergeInto ? await readFile(mergeInto, 'utf8') : undefined,
  });
  await writeFile(out, result.turtle);
  const snapshotOut = value('--snapshot-out');
  if (snapshotOut) await writeFile(snapshotOut, JSON.stringify(result.snapshot, null, 2) + '\n');
  if (mergedOut) await writeFile(mergedOut, result.merged);
  const counts = result.snapshot.terms.reduce((acc, t) => ({...acc, [t.verdict]: (acc[t.verdict] ?? 0) + 1}), {});
  console.log(`CTT import: ${result.snapshot.terms.length} terms (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}), ${result.snapshot.communities.length} communities, calibration ${result.snapshot.calibration}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
