// OW-2's public evidence contract. Never copy arbitrary target/report fields out.
import {isIP} from 'node:net';
import {validateReport, SUGGESTION_REQUIRED_TESTS} from './evidence.mjs';

export const PERSONAS = Object.freeze(['owner', 'suggester', 'editor', 'unrelated']);
export const HOSTED_CASES = Object.freeze([
  ...PERSONAS.map(persona => ({title: `${persona} completes interactive sign-in and federated sign-out`, proof: {case: `identity-${persona}`, subjectMatched: true, protectedRead: true, appSignedOut: true, providerLogout: true, nextLoginInteractive: true}})),
  {title: 'optional mode preserves public visibility and private isolation through sign-in', proof: {case: 'visibility', publicVisible: true, privateHidden: true, anonymousDenied: true, unrelatedDenied: true, originalUrlRestored: true, ownerAllowed: true}},
  {title: 'anonymous proposal reaches owner triage', proof: {case: 'anonymous', anonymous: true, saved: true, submitted: true, ownerTriage: true}},
  {title: 'real elapsed authentication boundaries are observed or remain explicitly open', proof: {case: 'expiry', renewal: 'not-observed', refreshRecovery: 'not-observed', cookieExpiry: 'not-observed'}},
]);
export const fail = code => { throw new Error(`HOSTED_${code}`); };
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
const exactKeys = (value, keys) => value && Object.keys(value).sort().join() === [...keys].sort().join();
function origin(value) {
  let url;
  try { url = new URL(value); } catch { fail('TARGET'); }
  // DNS HTTPS origins only; URL normalizes abbreviated IPs before this check.
  if (typeof value !== 'string' || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      isIP(url.hostname) || url.hostname.startsWith('[') || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname)) fail('TARGET');
  return url.origin;
}
function runtime(value, now) {
  if (!value || !timestamp(value.observedAt) || Date.parse(value.observedAt) > now || now - Date.parse(value.observedAt) > 30 * 60_000 ||
      !sha(value.web) || !sha(value.api) || value.worker !== value.api) fail('RUNTIME');
  for (const side of ['web', 'api']) if (value.authModes?.[side]?.mode !== 'optional' || value.authModes[side].providerConfigured !== true) fail('MODE');
  return {observedAt: value.observedAt, web: value.web, api: value.api, worker: value.worker,
    authModes: {web: {mode: 'optional', providerConfigured: true}, api: {mode: 'optional', providerConfigured: true}}};
}
/** Controller attestation is necessary; real subject/membership assertions still run in the browser. */
export function validateTarget(raw, now = Date.now()) {
  if (!raw || !exactKeys(raw.users, PERSONAS)) fail('PERSONAS');
  const target = {web: origin(raw.web), api: origin(raw.api), issuer: origin(raw.issuer), login: origin(raw.login), users: {}};
  for (const persona of PERSONAS) {
    const user = raw.users[persona];
    if (!user || !['id', 'email', 'password'].every(k => typeof user[k] === 'string' && user[k].length > 0) || !user.email.includes('@')) fail('PERSONAS');
    target.users[persona] = {id: user.id, email: user.email, password: user.password};
  }
  if (new Set(PERSONAS.map(p => target.users[p].id)).size !== 4 || new Set(PERSONAS.map(p => target.users[p].email.toLowerCase())).size !== 4) fail('PERSONAS');
  const h = raw.hosted;
  if (!h || h.version !== 1 || h.retain !== true) fail('PREREQUISITES');
  if (!exactKeys(h.ordinaryPersonas, PERSONAS) || PERSONAS.some(p => h.ordinaryPersonas[p]?.subject !== target.users[p].id || h.ordinaryPersonas[p]?.nonAdministrative !== true)) fail('ORDINARY_PERSONAS');
  if (!['import', 'index', 'save', 'submit'].every(k => h.noBilling?.[k] === true)) fail('NO_BILLING');
  if (!Number.isSafeInteger(h.observationWindowSeconds) || h.observationWindowSeconds < 0 || h.observationWindowSeconds > 3600 ||
      !Number.isSafeInteger(h.refreshIdleSeconds) || h.refreshIdleSeconds <= 0 || !Number.isSafeInteger(h.refreshAbsoluteSeconds) || h.refreshAbsoluteSeconds < h.refreshIdleSeconds) fail('OBSERVATION_WINDOW');
  return {...target, hosted: {version: 1, retain: true, observationWindowSeconds: h.observationWindowSeconds, runtime: runtime(h.runtime, now),
    ordinaryPersonas: Object.fromEntries(PERSONAS.map(p => [p, {subject: target.users[p].id, nonAdministrative: true}])),
    noBilling: {import: true, index: true, save: true, submit: true}, refreshIdleSeconds: h.refreshIdleSeconds, refreshAbsoluteSeconds: h.refreshAbsoluteSeconds}};
}
export function validateRuntimeAfter(target, raw, finishedAt, now = Date.now()) {
  const after = runtime(raw, now);
  if (Date.parse(after.observedAt) < finishedAt || ['web', 'api', 'worker'].some(k => after[k] !== target.hosted.runtime[k])) fail('RUNTIME_CHANGED');
  // Bind the readback to this target, not a different environment at the same revision.
  if (raw.webOrigin !== target.web || raw.apiOrigin !== target.api) fail('RUNTIME_TARGET');
  return after;
}
function flatten(report) {
  const found = [];
  const visit = suites => {
    if (!Array.isArray(suites)) fail('REPORT');
    for (const suite of suites) {
      if (suite.specs !== undefined && !Array.isArray(suite.specs)) fail('REPORT');
      found.push(...(suite.specs ?? [])); visit(suite.suites ?? []);
    }
  };
  visit(report?.suites);
  return found;
}
export function validateHostedReport(report) {
  const total = SUGGESTION_REQUIRED_TESTS.length + HOSTED_CASES.length;
  if (report?.stats?.expected !== total || report.stats.unexpected !== 0 || report.stats.skipped !== 0 || report.stats.flaky !== 0 || !Array.isArray(report.errors) || report.errors.length) fail('REPORT');
  const all = flatten(report);
  if (all.length !== total || all.some(s => !s.ok || s.tests?.length !== 1)) fail('REPORT');
  const suggestions = all.filter(s => s.file === 'browser/suggestions.spec.ts');
  let chain;
  try { chain = validateReport({...report, stats: {...report.stats, expected: 7}, suites: [{specs: suggestions}]}, {profile: 'suggestions'}); } catch { fail('REPORT'); }
  const personas = HOSTED_CASES.map(c => {
    const matches = all.filter(s => s.file === 'browser/hosted-personas.spec.ts' && s.title === c.title);
    if (matches.length !== 1) fail('REPORT');
    const t = matches[0].tests[0], result = t.results?.[0];
    if (t.projectName !== 'hosted-personas' || t.status !== 'expected' || t.expectedStatus !== 'passed' || t.results?.length !== 1 || result.status !== 'passed' || result.errors?.length || (result.retry ?? 0) !== 0) fail('REPORT');
    const annotations = [...(t.annotations ?? []), ...(result.annotations ?? [])];
    if (annotations.some(a => ['skip', 'fixme', 'fail', 'slow-skip', 'mode-evidence', 'lifecycle-evidence'].includes(a.type))) fail('REPORT');
    const source = t.annotations?.some(a => a.type === 'hosted-evidence') ? t.annotations : result.annotations ?? [];
    const entries = source.filter(a => a.type === 'hosted-evidence');
    if (entries.length !== 1) fail('REPORT');
    let entry; try { entry = JSON.parse(entries[0].description); } catch { fail('REPORT'); }
    if (!exactKeys(entry, Object.keys(c.proof))) fail('REPORT');
    if (c.proof.case === 'expiry') {
      if (entry.case !== 'expiry' || !['observed', 'not-observed'].includes(entry.renewal) || !['observed', 'not-observed'].includes(entry.refreshRecovery) || entry.cookieExpiry !== 'not-observed') fail('REPORT');
    } else if (Object.entries(c.proof).some(([k, v]) => entry[k] !== v)) fail('REPORT');
    return {title: c.title, evidence: Object.fromEntries(Object.keys(c.proof).map(k => [k, entry[k]]))};
  });
  return {suggestions: chain, personas};
}
