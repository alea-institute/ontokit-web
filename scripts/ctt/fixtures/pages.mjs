// Synthetic CTT pages that mirror the public markup (class names, aria-labels, Svelte
// hydration comments). The words, counts and quotations are invented for tests; no
// site content is copied here.
const row = (label, tag, selected = false) => `<button class="row svelte-x${selected ? ' sel" aria-current="true' : ''}"><span class="term svelte-x">${label}</span> <!--[1-->${tag}<!--]--></button>`;
const senseTag = n => `<span class="tag svelte-x">${n} sense${n === 1 ? '' : 's'}</span>`;
const ffTag = n => `<span class="tag ff svelte-x"><span class="x svelte-x" aria-hidden="true">✕</span><span class="num">${n}</span><span class="sr-only">false-friend pairs</span></span>`;
const footer = '<footer><span>Built 2026-01-02 from <span class="mono svelte-y">abc1234</span> · <a href="/changelog/">Changelog</a></span></footer>';

export function vocabularyPage({banner = true, extraAnchor = false, badTag = false, communityTotal = 3} = {}) {
  const words = ['lumen', 'free will', 'tessera', 'quorum'];
  return `<!doctype html><html><body><div><!--[-->${[...words, ...(extraAnchor ? ['orphan'] : [])].map(w => `<span id="t-${w.replace(' ', '-')}"></span>`).join('')}<!--]--></div>
<header><p class="page-sub">This page lists all 4 words in the atlas, the senses of each, and which pairs of the ${communityTotal} communities use a word in different senses.</p>
${banner ? '<p class="uncal svelte-z"><b class="svelte-z">Uncalibrated:</b> nothing here is checked yet.</p>' : ''}</header>
<select><option value="all" selected="">All (4)</option></select>
${row('lumen', senseTag(1), true)}${row('free will', badTag ? '<span class="tag svelte-x">many</span>' : senseTag(2))}${row('tessera', ffTag(3))}${row('quorum', '<span class="tag svelte-x">no verdict</span>')}
<div class="codes svelte-x"><span class="cg"><b class="svelte-x">Theology:</b> <span class="cd svelte-x">AAA</span> First &amp; foremost, <span class="cd svelte-x">BBB</span> Second tradition</span><span class="cg"><b class="svelte-x">Science:</b> <span class="cd svelte-x">CCC</span> Lab work</span></div>
${footer}</body></html>`;
}

export function homePage({mismatch = false} = {}) {
  return `<!doctype html><html><body><div class="card"><h2 class="subhead">Two core words and their senses</h2><ul class="os">
<li><span class="hd"><span class="w term svelte-a">lumen</span> <span class="meta num svelte-a">3 communities · 1,234 uses</span></span> <span class="bar" role="img" aria-label="lumen: one sense in ${mismatch ? 2 : 3} communities (light, glow, shine)"><span class="seg"></span></span></li>
<li><span class="hd"><span class="w term svelte-a">free will</span> <span class="meta num svelte-a">2 communities · 56 uses</span></span> <span class="bar" role="img" aria-label="free will: two senses in 2 communities (noun: choice, liberty, agency; verb: choose, decide, elect)"><span class="seg"></span></span></li>
</ul></div>${footer}</body></html>`;
}

export function findingsPage({quoteWords = 8, missingPair = false} = {}) {
  const quote = Array.from({length: quoteWords}, (_, i) => `w${i}`).join(' ');
  return `<!doctype html><html><body><p>We found 3 such pairs of communities, on one words.</p>
<article class="flip svelte-f" aria-label="tessera: a false friend"><h3 class="t"><span class="term">tessera</span></h3>
<ul class="key svelte-f" aria-label="Senses, named by their top substitutes"><li class="svelte-f"><span class="sw" style="x"></span>tile, mosaic, piece</li><li class="svelte-f"><span class="sw" style="y"></span>token, pass, ticket</li></ul>
<div class="side"><p class="who svelte-f">First &amp; foremost</p></div>${missingPair ? '' : '<div class="side"><p class="who svelte-f">Lab work</p></div>'}
<div class="quotes"><blockquote class="q"><p class="sent svelte-f">…${quote} <mark>tessera</mark> ${quote}…</p> <p class="src svelte-f">Lab work · A &quot;made-up&quot; paper, 2001</p></blockquote></div>
<p class="more"><a href="/vocabulary/#t-tessera">A false friend in three community pairs</a>.</p></article>
${footer}</body></html>`;
}

export const pages = (options = {}) => ({home: homePage(options.home), vocabulary: vocabularyPage(options.vocabulary), findings: findingsPage(options.findings)});
