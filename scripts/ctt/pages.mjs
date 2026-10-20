// CTT taxonomy import: the public HTML pages source (home, vocabulary, findings).
//
// The site publishes no export or API yet, so this source reads only what the public
// pages render: labels, counts, sense names and the short quotations the site already
// limits to twelve words either side of a word. Parsing keys on accessible names
// (aria-label) and stable semantic classes, and fails closed when the page's own totals
// disagree with what was parsed, so a site redesign stops the import instead of
// silently producing a partial vocabulary. Pure module: callers supply the HTML.
import { SNAPSHOT_SCHEMA, slugFor, validateSnapshot } from './snapshot.mjs';

export const CTT_SITE = 'https://ctt.jaces.com/';
export const CTT_PAGES = Object.freeze({home: '', vocabulary: 'vocabulary/', findings: 'findings/'});

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
  return ENTITIES[name.toLowerCase()] ?? whole;
});
/** Visible text of an HTML fragment: tags removed, entities decoded, whitespace collapsed. */
export const textOf = fragment => decode(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
// Svelte hydration markers (<!--[-->, <!--]-->) split otherwise adjacent markup.
const clean = html => {
  if (typeof html !== 'string' || !html.includes('<')) throw new Error('CTT page is not HTML');
  return html.replace(/<!--[\s\S]*?-->/g, '');
};
const fail = (page, detail) => new Error(`CTT ${page} page did not parse: ${detail}`);
const integer = value => Number.parseInt(value.replace(/,/g, ''), 10);
const list = value => value.split(',').map(word => word.trim()).filter(Boolean);

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const senseTotal = value => /^\d+$/.test(value) ? Number(value) : NUMBER_WORDS.indexOf(value.toLowerCase());

/** Footer build stamp, e.g. "Built 2026-10-19 from f66099a". */
export function parseBuild(html) {
  const match = textOf(clean(html)).match(/Built (\d{4}-\d{2}-\d{2}) from ([0-9a-f]{7,40})/);
  return match ? {date: match[1], commit: match[2]} : {};
}

/** Vocabulary page: every word, its sense-count tag, and the community legend. */
export function parseVocabularyPage(html) {
  const page = clean(html);
  const total = page.match(/All \((\d+)\)/);
  if (!total) throw fail('vocabulary', 'word total missing');
  const anchors = new Set([...page.matchAll(/<span id="t-([a-z0-9-]+)"><\/span>/g)].map(m => m[1]));
  const terms = [];
  const rows = /<button class="row[^"]*"[^>]*>\s*<span class="term[^"]*">([^<]+)<\/span>([\s\S]*?)<\/button>/g;
  for (const [, rawLabel, rest] of page.matchAll(rows)) {
    const label = textOf(rawLabel);
    const slug = slugFor(label);
    if (!anchors.has(slug)) throw fail('vocabulary', `no anchor for "${label}"`);
    const pairs = rest.match(/class="tag ff[^"]*"[\s\S]*?<span class="num">(\d+)<\/span>/);
    const tag = textOf(rest);
    let term;
    if (pairs) term = {verdict: 'false-friend', falseFriendPairs: Number(pairs[1])};
    else if (tag === 'no verdict') term = {verdict: 'no-verdict', senseCount: null};
    else {
      const senses = tag.match(/^(\d+) senses?$/);
      if (!senses) throw fail('vocabulary', `unrecognized tag for "${label}"`);
      term = {verdict: Number(senses[1]) === 1 ? 'one-sense' : 'multi-sense', senseCount: Number(senses[1])};
    }
    terms.push({slug, label, ...term});
  }
  if (terms.length !== Number(total[1]) || anchors.size !== terms.length) throw fail('vocabulary', `parsed ${terms.length} words and ${anchors.size} anchors, page says ${total[1]}`);

  const communities = [];
  for (const [, group, body] of page.matchAll(/<span class="cg"><b[^>]*>([^<]+):<\/b>([\s\S]*?)<\/span>(?=<span class="cg">|<\/div>)/g)) {
    for (const [, code, label] of body.matchAll(/<span class="cd[^"]*">([A-Z]+)<\/span>([^<]*)/g)) {
      communities.push({code, label: textOf(label).replace(/,$/, '').trim(), group: textOf(group)});
    }
  }
  const declared = page.match(/pairs of the (\d+) communities/);
  if (!communities.length || (declared && Number(declared[1]) !== communities.length)) throw fail('vocabulary', `parsed ${communities.length} communities${declared ? `, page says ${declared[1]}` : ''}`);
  return {terms, communities, build: parseBuild(html)};
}

/** Home page "core words": community and use counts plus sense names. */
export function parseHomePage(html) {
  const page = clean(html);
  const core = [];
  const items = /<span class="w term[^"]*">([^<]+)<\/span>\s*<span class="meta num[^"]*">([^<]+)<\/span>[\s\S]*?role="img" aria-label="([^"]+)"/g;
  for (const [, word, meta, aria] of page.matchAll(items)) {
    const counts = textOf(meta).match(/^([\d,]+) communities · ([\d,]+) uses$/);
    const described = decode(aria).match(/^(.+?): (\w+) senses? in (\d+) communities \((.+)\)$/);
    if (!counts || !described || described[1] !== textOf(word)) throw fail('home', `core word "${textOf(word)}" is malformed`);
    const senses = described[4].split(';').map(part => {
      const pos = part.trim().match(/^(noun|verb|adjective|adverb): (.+)$/);
      return pos ? {partOfSpeech: pos[1], substitutes: list(pos[2])} : {substitutes: list(part)};
    });
    if (senses.length !== senseTotal(described[2]) || integer(counts[1]) !== Number(described[3])) throw fail('home', `core word "${described[1]}" counts disagree`);
    core.push({slug: slugFor(described[1]), communityCount: integer(counts[1]), useCount: integer(counts[2]), senses});
  }
  const declared = textOf(page).match(/(\w+) core words and their senses/i);
  if (!core.length || (declared && senseTotal(declared[1]) !== core.length)) throw fail('home', `parsed ${core.length} core words`);
  return {core};
}

/** Findings page: each false friend's senses, strongest pair and quotations. */
export function parseFindingsPage(html) {
  const page = clean(html);
  const falseFriends = [];
  for (const [, word, body] of page.matchAll(/<article class="flip[^"]*" aria-label="([^"]+): a false friend">([\s\S]*?)<\/article>/g)) {
    const keys = body.match(/<ul class="key[^"]*"[^>]*>([\s\S]*?)<\/ul>/);
    const senses = keys ? [...keys[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => ({substitutes: list(textOf(m[1]))})) : [];
    const pair = [...body.matchAll(/<p class="who[^"]*">([^<]+)<\/p>/g)].map(m => textOf(m[1]));
    const examples = [...body.matchAll(/<p class="sent[^"]*">([\s\S]*?)<\/p>\s*<p class="src[^"]*">([\s\S]*?)<\/p>/g)].map(([, sent, src]) => {
      const [community, ...work] = textOf(src).split(' · ');
      return {quote: textOf(sent), community, work: work.join(' · ')};
    });
    if (senses.length < 2 || pair.length !== 2 || examples.some(e => !e.work)) throw fail('findings', `false friend "${decode(word)}" is malformed`);
    falseFriends.push({slug: slugFor(decode(word)), senses, strongestPair: pair, examples});
  }
  const declared = textOf(page).match(/on (\w+) words\./);
  if (!falseFriends.length || (declared && senseTotal(declared[1]) !== falseFriends.length)) throw fail('findings', `parsed ${falseFriends.length} false friends`);
  return {falseFriends};
}

/**
 * Combines the three pages into a validated `ctt-snapshot/v1`. Every core word and false
 * friend must name a vocabulary word, and every false friend in the vocabulary must have
 * a findings panel. `includeExamples: false` drops quotations entirely.
 */
export function snapshotFromPages({home, vocabulary, findings}, {retrievedAt = new Date().toISOString(), includeExamples = true} = {}) {
  const vocab = parseVocabularyPage(vocabulary);
  const {core} = parseHomePage(home);
  const {falseFriends} = parseFindingsPage(findings);
  const bySlug = new Map(vocab.terms.map(t => [t.slug, t]));
  for (const item of [...core, ...falseFriends]) if (!bySlug.has(item.slug)) throw fail('home or findings', `"${item.slug}" is not a vocabulary word`);
  const panels = new Map(falseFriends.map(f => [f.slug, f]));
  const terms = vocab.terms.map(({slug, label, verdict, senseCount, falseFriendPairs}) => {
    const coreWord = core.find(c => c.slug === slug);
    const panel = panels.get(slug);
    if ((verdict === 'false-friend') !== !!panel) throw fail('findings', `"${slug}" false-friend status disagrees with the vocabulary`);
    return {
      slug, label, verdict,
      senseCount: panel ? panel.senses.length : senseCount,
      ...(coreWord ? {core: true, communityCount: coreWord.communityCount, useCount: coreWord.useCount} : {}),
      senses: (panel ?? coreWord)?.senses ?? [],
      ...(panel ? {falseFriend: {pairCount: falseFriendPairs, strongestPair: panel.strongestPair}} : {}),
      ...(panel && includeExamples ? {examples: panel.examples} : {}),
    };
  });
  const build = Object.keys(vocab.build).length ? vocab.build : parseBuild(home);
  // The site labels every verdict uncalibrated (/limits/#uncalibrated). If that banner
  // ever disappears, a person decides what the change means; the scrape never upgrades it.
  if (!/Uncalibrated:/.test(textOf(clean(vocabulary)))) throw fail('vocabulary', 'calibration banner missing; review the site before importing');
  return validateSnapshot({
    schema: SNAPSHOT_SCHEMA,
    source: {kind: 'html-pages', site: CTT_SITE, build, retrievedAt},
    calibration: 'uncalibrated',
    communities: vocab.communities,
    terms,
  });
}
