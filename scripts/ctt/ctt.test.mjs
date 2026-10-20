import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pages } from './fixtures/pages.mjs';
import { parseFindingsPage, parseHomePage, parseVocabularyPage, snapshotFromPages, textOf } from './pages.mjs';
import { SNAPSHOT_SCHEMA, validateSnapshot } from './snapshot.mjs';
import { DEFAULT_BASE, literal, mergeTurtle, snapshotToTurtle } from './turtle.mjs';
import { fetchPages, importCtt } from './import.mjs';

const RETRIEVED = '2026-01-03T00:00:00.000Z';
const snapshot = (options, extra) => snapshotFromPages(pages(options), {retrievedAt: RETRIEVED, ...extra});

test('vocabulary page yields every word, its verdict and the community legend', () => {
  const {terms, communities, build} = parseVocabularyPage(pages().vocabulary);
  assert.deepEqual(terms, [
    {slug: 'lumen', label: 'lumen', verdict: 'one-sense', senseCount: 1},
    {slug: 'free-will', label: 'free will', verdict: 'multi-sense', senseCount: 2},
    {slug: 'tessera', label: 'tessera', verdict: 'false-friend', falseFriendPairs: 3},
    {slug: 'quorum', label: 'quorum', verdict: 'no-verdict', senseCount: null},
  ]);
  assert.deepEqual(communities, [
    {code: 'AAA', label: 'First & foremost', group: 'Theology'},
    {code: 'BBB', label: 'Second tradition', group: 'Theology'},
    {code: 'CCC', label: 'Lab work', group: 'Science'},
  ]);
  assert.deepEqual(build, {date: '2026-01-02', commit: 'abc1234'});
});

test('vocabulary parse fails closed when the page totals disagree or a tag is unknown', () => {
  assert.throws(() => parseVocabularyPage(pages({vocabulary: {extraAnchor: true}}).vocabulary), /parsed 4 words and 5 anchors/);
  assert.throws(() => parseVocabularyPage(pages({vocabulary: {badTag: true}}).vocabulary), /unrecognized tag for "free will"/);
  assert.throws(() => parseVocabularyPage(pages({vocabulary: {communityTotal: 24}}).vocabulary), /parsed 3 communities, page says 24/);
  assert.throws(() => parseVocabularyPage('not html'), /not HTML/);
});

test('home page core words carry counts and part-of-speech senses', () => {
  assert.deepEqual(parseHomePage(pages().home).core, [
    {slug: 'lumen', communityCount: 3, useCount: 1234, senses: [{substitutes: ['light', 'glow', 'shine']}]},
    {slug: 'free-will', communityCount: 2, useCount: 56, senses: [
      {partOfSpeech: 'noun', substitutes: ['choice', 'liberty', 'agency']},
      {partOfSpeech: 'verb', substitutes: ['choose', 'decide', 'elect']}]},
  ]);
  assert.throws(() => parseHomePage(pages({home: {mismatch: true}}).home), /counts disagree/);
});

test('findings page false friends keep senses, the strongest pair and attributed quotations', () => {
  const [ff] = parseFindingsPage(pages().findings).falseFriends;
  assert.equal(ff.slug, 'tessera');
  assert.deepEqual(ff.strongestPair, ['First & foremost', 'Lab work']);
  assert.deepEqual(ff.senses.map(s => s.substitutes[0]), ['tile', 'token']);
  assert.equal(ff.examples[0].community, 'Lab work');
  assert.equal(ff.examples[0].work, 'A "made-up" paper, 2001');
  assert.match(ff.examples[0].quote, /tessera/);
  assert.throws(() => parseFindingsPage(pages({findings: {missingPair: true}}).findings), /"tessera" is malformed/);
});

test('snapshot joins the pages, stays uncalibrated and can drop quotations', () => {
  const s = snapshot();
  assert.equal(s.schema, SNAPSHOT_SCHEMA);
  assert.equal(s.calibration, 'uncalibrated');
  assert.deepEqual(s.source, {kind: 'html-pages', site: 'https://ctt.jaces.com/', build: {date: '2026-01-02', commit: 'abc1234'}, retrievedAt: RETRIEVED});
  const tessera = s.terms.find(t => t.slug === 'tessera');
  assert.equal(tessera.senseCount, 2);
  assert.deepEqual(tessera.falseFriend, {pairCount: 3, strongestPair: ['First & foremost', 'Lab work']});
  assert.equal(tessera.examples.length, 1);
  assert.equal(s.terms.find(t => t.slug === 'free-will').core, true);
  assert.equal(snapshot(undefined, {includeExamples: false}).terms.find(t => t.slug === 'tessera').examples.length, 0);
  assert.throws(() => snapshot({vocabulary: {banner: false}}), /calibration banner missing/);
});

test('snapshot validation rejects malformed exports and over-long quotations', () => {
  const good = snapshot();
  assert.deepEqual(validateSnapshot(JSON.parse(JSON.stringify(good))), good, 'validation is idempotent');
  const broken = mutate => { const copy = structuredClone(good); mutate(copy); return () => validateSnapshot(copy); };
  assert.throws(broken(s => { s.schema = 'ctt-snapshot/v0'; }), /schema must be/);
  assert.throws(broken(s => { s.source.site = 'http://ctt.jaces.com/'; }), /https/);
  assert.throws(broken(s => { s.calibration = 'mostly'; }), /calibration/);
  assert.throws(broken(s => { s.terms[1].slug = s.terms[0].slug; }), /slugs must be unique/);
  assert.throws(broken(s => { s.terms[0].senseCount = 2; }), /one-sense verdict/);
  assert.throws(broken(s => { s.terms[3].senseCount = 1; }), /disagrees with its verdict/);
  assert.throws(broken(s => { delete s.terms[2].falseFriend; }), /falseFriend must be present/);
  assert.throws(broken(s => { s.communities[0].code = 'aa'; }), /upper-case/);
  assert.throws(() => snapshot({findings: {quoteWords: 20}}), /exceeds the published quotation limit/);
  const exported = structuredClone(good);
  exported.source.kind = 'structured-export';
  assert.equal(validateSnapshot(exported).source.kind, 'structured-export');
});

test('Turtle module types every word under the CTT term root with calibration and provenance', () => {
  const ttl = snapshotToTurtle(snapshot());
  assert.match(ttl, /^@prefix ctt: <https:\/\/ontology\.catholicos\.catholic\/ctt\/> \.$/m);
  assert.doesNotMatch(ttl, /owl:Ontology/);
  assert.match(ttl, /<https:\/\/ontology\.catholicos\.catholic\/ctt\/term\/tessera> a owl:Class ;\n {4}rdfs:subClassOf ctt:FalseFriend ;/);
  assert.match(ttl, /term\/free-will> a owl:Class ;\n {4}rdfs:subClassOf ctt:CoreWord ;/);
  assert.match(ttl, /term\/quorum> a owl:Class ;\n {4}rdfs:subClassOf ctt:Term ;/);
  assert.equal((ttl.match(/ctt:calibrationStatus "uncalibrated"/g) ?? []).length, 5, 'root plus four terms');
  assert.match(ttl, /ctt:senseSubstitutes "noun: choice, liberty, agency"@en/);
  assert.match(ttl, /skos:example ".*A \\"made-up\\" paper, 2001\)"@en/);
  assert.match(ttl, /rdfs:seeAlso <https:\/\/ctt\.jaces\.com\/vocabulary\/#t-tessera>/);
  assert.match(ttl, /community\/AAA> a owl:NamedIndividual, ctt:Community ;\n {4}rdfs:label "First & foremost"@en/);
  assert.doesNotMatch(snapshotToTurtle(snapshot(), {includeExamples: false}), /skos:example/);
  assert.match(snapshotToTurtle(snapshot(), {base: 'https://example.org/ctt#'}), /<https:\/\/example\.org\/ctt#term\/lumen>/);
  assert.throws(() => snapshotToTurtle(snapshot(), {base: 'https://example.org/no-separator'}), /ending in \/ or #/);
  assert.equal(literal('a "b"\\\nc'), '"a \\"b\\"\\\\\\nc"@en');
});

test('merge appends the module and refuses to rebind a host prefix', () => {
  const moduleTtl = snapshotToTurtle(snapshot());
  const host = '@prefix : <https://ontology.catholicos.catholic/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n:Thing a owl:Class .';
  const merged = mergeTurtle(host, moduleTtl);
  assert.ok(merged.startsWith(host));
  assert.ok(merged.endsWith(moduleTtl.replace(/\s*$/, '\n')));
  assert.throws(() => mergeTurtle('@prefix ctt: <https://other.example/> .\n', moduleTtl), /rebind prefix "ctt:"/);
  assert.throws(() => mergeTurtle('@prefix owl: <http://example.org/owl#> .\n', moduleTtl), /rebind prefix "owl:"/);
});

test('import reads an export file or fetched pages through one path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ctt-test-'));
  try {
    const file = path.join(dir, 'export.json');
    await writeFile(file, JSON.stringify({...snapshot(), source: {...snapshot().source, kind: 'structured-export'}}));
    const fromExport = await importCtt({exportFile: file, host: '@prefix : <https://h.example/> .\n'});
    assert.equal(fromExport.snapshot.source.kind, 'structured-export');
    assert.ok(fromExport.merged.includes('ctt:Term a owl:Class'));
    const served = pages();
    const routes = {'/': served.home, '/vocabulary/': served.vocabulary, '/findings/': served.findings};
    const fetchImpl = async url => new Response(routes[new URL(url).pathname], {headers: {'content-type': 'text/html; charset=utf-8'}});
    const fetched = await importCtt({fetchImpl, retrievedAt: RETRIEVED});
    assert.equal(fetched.turtle, snapshotToTurtle(snapshot(), {base: DEFAULT_BASE}));
    await assert.rejects(fetchPages({fetchImpl: async () => new Response('gone', {status: 404, headers: {'content-type': 'text/html'}})}), /returned 404/);
    await assert.rejects(importCtt({exportFile: file, htmlDir: dir}), /Choose one CTT source/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('text extraction decodes entities and drops markup', () => {
  assert.equal(textOf('<p>a&amp;b &#39;c&#x27; <mark>d</mark>\n e</p>'), "a&b 'c' d e");
});

test('untrusted export text cannot break out of literals, the header comment or the sense count', () => {
  const good = snapshot();
  const hostile = structuredClone(good);
  hostile.terms[0].label = 'a"b\\c\nd\re';
  hostile.communities[0].label = '"> . <urn:x> <urn:y> <urn:z> .';
  const ttl = snapshotToTurtle(hostile);
  assert.match(ttl, /rdfs:label "a\\"b\\\\c\\nd\\re"@en/);
  assert.match(ttl, /rdfs:label "\\"> \. <urn:x> <urn:y> <urn:z> \."@en/);
  for (const date of ['2026\n<urn:x> <urn:y> <urn:z> .\n#', '19 October']) {
    const injected = structuredClone(good);
    injected.source.build.date = date;
    assert.throws(() => validateSnapshot(injected), /YYYY-MM-DD|at most 10 characters/);
  }
  const commit = structuredClone(good);
  commit.source.build.commit = 'abc1234\n#';
  assert.throws(() => validateSnapshot(commit), /hex commit/);
  const senses = structuredClone(good);
  senses.terms.find(t => t.slug === 'lumen').senses.push({substitutes: ['extra']});
  assert.throws(() => validateSnapshot(senses), /senses disagrees with senseCount/);
});

test('merge also refuses SPARQL-style and commented prefix rebinding', () => {
  const moduleTtl = snapshotToTurtle(snapshot());
  assert.throws(() => mergeTurtle('PREFIX ctt: <https://other.example/>\n', moduleTtl), /rebind prefix "ctt:"/);
  assert.throws(() => mergeTurtle('@prefix ctt: <https://other.example/> . # legacy\n', moduleTtl), /rebind prefix "ctt:"/);
  assert.throws(() => mergeTurtle('prefix owl: <http://example.org/owl#>\n', moduleTtl), /rebind prefix "owl:"/);
});
