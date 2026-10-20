// CTT taxonomy import (cycle sweep-2026-10-20).
//
// A snapshot is the one normalized shape every CTT source produces and the Turtle
// writer consumes. Today the only source is the public HTML pages (pages.mjs); when the
// Taxonomy Working Group publishes a structured export, a file in this shape (schema
// `ctt-snapshot/v1`, documented in docs/ctt-import.md) replaces the scrape without
// touching the writer or the rehearsal. Pure module: no network, no filesystem.

export const SNAPSHOT_SCHEMA = 'ctt-snapshot/v1';
export const CALIBRATION = Object.freeze(['uncalibrated', 'calibrated']);
export const VERDICTS = Object.freeze(['one-sense', 'multi-sense', 'false-friend', 'no-verdict']);
// The site publishes quotations of at most twelve words either side of the target word.
export const MAX_QUOTE_WORDS = 25;

const invalid = detail => new Error(`Invalid CTT snapshot: ${detail}`);
const text = (value, field, max = 300) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid(`${field} must be a non-empty string of at most ${max} characters`);
  return value.trim();
};
const count = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) throw invalid(`${field} must be a non-negative integer`);
  return value;
};
const optionalCount = (value, field) => value === undefined || value === null ? null : count(value, field);
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugFor = label => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const wordCount = value => value.trim().split(/\s+/).filter(Boolean).length;

function substitutes(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw invalid(`${field} must list one to five substitute words`);
  return value.map((word, i) => text(word, `${field}[${i}]`, 60));
}
function example(value, field) {
  const quote = text(value?.quote, `${field}.quote`, 600);
  if (wordCount(quote) > MAX_QUOTE_WORDS + 3) throw invalid(`${field}.quote exceeds the published quotation limit`);
  return {quote, community: text(value.community, `${field}.community`, 120), work: text(value.work, `${field}.work`, 300)};
}
function sense(value, field) {
  return {
    ...(value?.partOfSpeech === undefined ? {} : {partOfSpeech: text(value.partOfSpeech, `${field}.partOfSpeech`, 20)}),
    substitutes: substitutes(value?.substitutes, `${field}.substitutes`),
  };
}

/**
 * Validates and normalizes untrusted snapshot input (scraped or exported). Returns a
 * new object; throws on anything outside the schema so a malformed export cannot reach
 * the ontology. Unknown keys are dropped.
 */
export function validateSnapshot(input) {
  if (!input || typeof input !== 'object' || input.schema !== SNAPSHOT_SCHEMA) throw invalid(`schema must be ${SNAPSHOT_SCHEMA}`);
  const source = input.source ?? {};
  if (!['html-pages', 'structured-export'].includes(source.kind)) throw invalid('source.kind must be html-pages or structured-export');
  let site;
  try { site = new URL(source.site); } catch { throw invalid('source.site must be an absolute URL'); }
  if (site.protocol !== 'https:') throw invalid('source.site must use https');
  if (!CALIBRATION.includes(input.calibration)) throw invalid('calibration must be uncalibrated or calibrated');
  // The build stamp is written into a Turtle comment; only these exact shapes are allowed.
  const build = source.build ? {
    ...(source.build.date ? {date: text(source.build.date, 'source.build.date', 10)} : {}),
    ...(source.build.commit ? {commit: text(source.build.commit, 'source.build.commit', 40)} : {}),
  } : {};
  if (build.date && !/^\d{4}-\d{2}-\d{2}$/.test(build.date)) throw invalid('source.build.date must be YYYY-MM-DD');
  if (build.commit && !/^[0-9a-f]{7,40}$/.test(build.commit)) throw invalid('source.build.commit must be a hex commit');
  if (Number.isNaN(Date.parse(source.retrievedAt))) throw invalid('source.retrievedAt must be a timestamp');

  if (!Array.isArray(input.communities) || !input.communities.length) throw invalid('communities must be a non-empty list');
  const communities = input.communities.map((c, i) => {
    const code = text(c?.code, `communities[${i}].code`, 8);
    if (!/^[A-Z]{2,8}$/.test(code)) throw invalid(`communities[${i}].code must be upper-case letters`);
    return {code, label: text(c.label, `communities[${i}].label`, 120), group: text(c.group, `communities[${i}].group`, 60)};
  });
  if (new Set(communities.map(c => c.code)).size !== communities.length) throw invalid('community codes must be unique');

  if (!Array.isArray(input.terms) || !input.terms.length) throw invalid('terms must be a non-empty list');
  const terms = input.terms.map((t, i) => {
    const field = `terms[${i}]`;
    const label = text(t?.label, `${field}.label`, 80);
    const slug = text(t.slug, `${field}.slug`, 80);
    if (!SLUG.test(slug)) throw invalid(`${field}.slug must be a lower-case slug`);
    if (!VERDICTS.includes(t.verdict)) throw invalid(`${field}.verdict must be one of ${VERDICTS.join(', ')}`);
    const senseCount = optionalCount(t.senseCount, `${field}.senseCount`);
    if (t.verdict === 'no-verdict' ? senseCount !== null : senseCount === null || senseCount < 1) throw invalid(`${field}.senseCount disagrees with its verdict`);
    if (t.verdict === 'one-sense' && senseCount !== 1) throw invalid(`${field} one-sense verdict needs exactly one sense`);
    const senses = t.senses === undefined ? [] : (Array.isArray(t.senses) ? t.senses : [null]).map((s, j) => sense(s, `${field}.senses[${j}]`));
    if (senses.length && senseCount !== null && senses.length !== senseCount) throw invalid(`${field}.senses disagrees with senseCount`);
    const examples = t.examples === undefined ? [] : (Array.isArray(t.examples) ? t.examples : [null]).map((e, j) => example(e, `${field}.examples[${j}]`));
    const falseFriend = t.falseFriend === undefined || t.falseFriend === null ? null : {
      pairCount: count(t.falseFriend?.pairCount, `${field}.falseFriend.pairCount`),
      strongestPair: (Array.isArray(t.falseFriend.strongestPair) && t.falseFriend.strongestPair.length === 2 ? t.falseFriend.strongestPair : [null, null])
        .map((name, j) => text(name, `${field}.falseFriend.strongestPair[${j}]`, 120)),
    };
    if ((t.verdict === 'false-friend') !== !!falseFriend) throw invalid(`${field}.falseFriend must be present exactly for false-friend verdicts`);
    return {
      slug, label, verdict: t.verdict, senseCount,
      communityCount: optionalCount(t.communityCount, `${field}.communityCount`),
      useCount: optionalCount(t.useCount, `${field}.useCount`),
      core: t.core === true,
      senses, examples, falseFriend,
    };
  });
  if (new Set(terms.map(t => t.slug)).size !== terms.length) throw invalid('term slugs must be unique');
  return {
    schema: SNAPSHOT_SCHEMA,
    source: {kind: source.kind, site: site.origin + '/', build, retrievedAt: new Date(source.retrievedAt).toISOString()},
    calibration: input.calibration,
    communities, terms,
  };
}
