// D09 authentication-mode profiles (KTD1-KTD3, KTD7).
//
// One registry owns every profile's API mode, compiled web mode, identity-service
// decision, personas, seeded fixtures and Playwright spec allowlist. This module is
// deliberately pure (no Docker, no process state) so `playwright.config.ts` and
// `evidence.mjs` can import the same allowlists the launcher uses.
import { readFile } from 'node:fs/promises';

export const AUTH_MODES = Object.freeze(['required', 'optional', 'disabled']);
// The API ZITADEL_CLIENT_ID Compose substitutes before identity bootstrap writes a real
// client. Provider-less profiles never replace it, so it means "no provider".
export const API_UNCONFIGURED_CLIENT = 'unconfigured';

const spec = file => Object.freeze(file);
export const PROFILE_REGISTRY = Object.freeze({
  // D06: every spec not owned by another profile, plus the setup/teardown projects.
  baseline: Object.freeze({apiMode: 'required', webMode: 'required', identity: true, personas: Object.freeze(['owner', 'unrelated']), seed: null, specs: null, projects: Object.freeze(['chromium', 'stack setup', 'stack teardown'])}),
  lifecycle: Object.freeze({apiMode: 'required', webMode: 'required', identity: true, personas: Object.freeze(['lifecycle']), seed: null, specs: Object.freeze([spec('browser/auth-lifecycle.spec.ts')]), projects: Object.freeze(['lifecycle'])}),
  'optional-configured': Object.freeze({apiMode: 'optional', webMode: 'optional', identity: true, personas: Object.freeze(['owner']), seed: Object.freeze({persona: 'owner'}), specs: Object.freeze([spec('browser/auth-mode-optional-configured.spec.ts')]), projects: Object.freeze(['optional-configured'])}),
  'optional-anonymous': Object.freeze({apiMode: 'optional', webMode: 'optional', identity: false, personas: Object.freeze([]), seed: Object.freeze({persona: null}), specs: Object.freeze([spec('browser/auth-mode-optional-anonymous.spec.ts')]), projects: Object.freeze(['optional-anonymous'])}),
  disabled: Object.freeze({apiMode: 'disabled', webMode: 'disabled', identity: false, personas: Object.freeze([]), seed: Object.freeze({persona: null}), specs: Object.freeze([spec('browser/auth-mode-disabled.spec.ts')]), projects: Object.freeze(['disabled'])}),
});
export const MODE_PROFILES = Object.freeze(['optional-configured', 'optional-anonymous', 'disabled']);
export const IDENTITY_SERVICES = Object.freeze(['zitadel', 'login']);
const CORE_SERVICES = Object.freeze(['postgres', 'redis', 'minio', 'api', 'worker']);

export function profileSpec(profile) {
  if (typeof profile !== 'string' || !Object.hasOwn(PROFILE_REGISTRY, profile)) throw new Error('Unknown E2E profile');
  return PROFILE_REGISTRY[profile];
}
/** Services whose images an accepted run of this profile must record (KTD3). */
export const serviceSet = profile => [...CORE_SERVICES, ...(profileSpec(profile).identity ? IDENTITY_SERVICES : [])];
/** Every spec file owned by a profile other than `profile`; baseline ignores all of them. */
export const foreignSpecs = profile => Object.entries(PROFILE_REGISTRY).filter(([name, p]) => name !== profile && p.specs).flatMap(([, p]) => p.specs);
/** Which profile owns a spec file (relative to e2e/); unowned specs belong to baseline. */
export const specOwner = file => Object.entries(PROFILE_REGISTRY).find(([, p]) => p.specs?.includes(file))?.[0] ?? 'baseline';

// Playwright glob (not a constructed RegExp): matches the spec path literally.
const specPattern = file => `**/${file}`;
/** Playwright projects for one profile, built from the registry (KTD7). */
export function playwrightProjects(profile) {
  const p = profileSpec(profile);
  if (profile === 'baseline') {
    return [
      {name: 'stack setup', testMatch: /stack\.setup\.ts/, teardown: 'stack teardown'},
      {name: 'stack teardown', testMatch: /stack\.teardown\.ts/},
      {name: 'chromium', testMatch: /.*\.spec\.ts/, testIgnore: foreignSpecs('baseline').map(specPattern), dependencies: ['stack setup']},
    ];
  }
  if (p.projects.length !== 1 || p.specs.length !== 1) throw new Error('Unknown E2E profile');
  return [{name: p.projects[0], testMatch: specPattern(p.specs[0])}];
}

// ---- Launcher failure injection (probes only) ----
// The complete allowlist of --fail-at points. Each predicate says where the point can
// actually fire; a name outside this list, or a point that cannot fire for the launch,
// is rejected before any allocation so a typo never degrades into an ordinary green run.
const always = () => true;
const identityProfile = ({profile, lifecycleProbe}) => !lifecycleProbe && profileSpec(profile).identity;
export const FAIL_POINTS = Object.freeze({
  // Legacy D06/D08 points.
  'after-dependencies': always,
  'after-workflow': always,
  'identity-pat': identityProfile,
  'identity-issuer': identityProfile,
  'identity-callback': identityProfile,
  'lifecycle-readback': ({profile, lifecycleProbe}) => !lifecycleProbe && profile === 'lifecycle',
  'clock-preflight': ({profile, lifecycleProbe}) => !lifecycleProbe && profile === 'lifecycle',
  // Stops after mode agreement and fixture seeding, immediately before Playwright. Only
  // the seeded D09 profiles reach that stop; baseline and lifecycle would run green.
  'before-browser': ({profile, lifecycleProbe}) => !lifecycleProbe && MODE_PROFILES.includes(profile),
  // Build the web copy with a neighbouring profile's auth env; the gate must reject it.
  'web-mode-mismatch': ({profile, lifecycleProbe}) => !lifecycleProbe && MODE_PROFILES.includes(profile),
  // Start the API with a neighbouring mode; provider-less profiles only, because
  // identity bootstrap independently asserts optional-configured's API mode.
  'api-mode-mismatch': ({profile, lifecycleProbe}) => !lifecycleProbe && ['optional-anonymous', 'disabled'].includes(profile),
});
const WEB_MISMATCH = Object.freeze({'optional-configured': {webMode: 'optional', identity: false}, 'optional-anonymous': {webMode: 'disabled', identity: false}, disabled: {webMode: 'optional', identity: false}});
const API_MISMATCH = Object.freeze({'optional-anonymous': 'disabled', disabled: 'optional'});
/** Rejects a profile/flag combination the launcher does not support. */
export function assertLaunch({profile, failAt, lifecycleProbe = false}) {
  profileSpec(profile);
  if (lifecycleProbe && profile !== 'baseline') throw new Error('Unknown E2E profile combination');
  if (failAt === undefined) return profile;
  if (typeof failAt !== 'string' || !Object.hasOwn(FAIL_POINTS, failAt)) throw new Error('Unknown E2E failure point');
  if (!FAIL_POINTS[failAt]({profile, lifecycleProbe})) throw new Error('Unknown E2E profile combination');
  return profile;
}
/** The API AUTH_MODE Compose receives for this launch. */
export function apiModeFor(profile, failAt) {
  const p = profileSpec(profile);
  return failAt === 'api-mode-mismatch' && Object.hasOwn(API_MISMATCH, profile) ? API_MISMATCH[profile] : p.apiMode;
}

/**
 * Authentication inputs for the profile's production web build. Provider-less
 * profiles receive no issuer, client ID or client secret at all (KTD3).
 */
export function webAuthEnv(profile, {identity, web, api, secret, failAt} = {}) {
  const p = profileSpec(profile);
  const shape = failAt === 'web-mode-mismatch' && Object.hasOwn(WEB_MISMATCH, profile) ? WEB_MISMATCH[profile] : p;
  if (p.identity && !identity) throw new Error('Identity bootstrap result missing for a provider profile');
  if (!p.identity && identity) throw new Error('Provider-less profile received identity values');
  if (typeof secret !== 'string' || secret.length < 32 || !web || !api) throw new Error('Invalid web build inputs');
  return {
    AUTH_MODE: shape.webMode, AUTH_TRUST_HOST: 'true',
    ...(shape.identity ? {ZITADEL_ISSUER: identity.issuer, ZITADEL_CLIENT_ID: identity.clientId, ZITADEL_CLIENT_SECRET: identity.clientSecret} : {}),
    NEXTAUTH_URL: web, NEXTAUTH_SECRET: secret,
    NEXT_PUBLIC_API_URL: api, NEXT_PUBLIC_WS_URL: api.replace('http:', 'ws:'),
  };
}

// ---- KTD2 mode agreement ----
const disagreement = detail => new Error(`Authentication mode disagreement: ${detail}`);
/** Reads the mode and provider flags Next compiled into the build (not configuration intent). */
export function parseCompiledMode(text) {
  let files;
  try { files = JSON.parse(text); } catch { throw disagreement('compiled web env is unreadable'); }
  const env = files?.config?.env;
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw disagreement('compiled web env is missing');
  const mode = env.NEXT_PUBLIC_AUTH_MODE, configured = env.NEXT_PUBLIC_ZITADEL_CONFIGURED;
  if (!AUTH_MODES.includes(mode) || !['true', 'false'].includes(configured)) throw disagreement('compiled web env is malformed');
  return {mode, providerConfigured: configured === 'true'};
}
export async function readCompiledMode(file) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch { throw disagreement('compiled web env is missing'); }
  return parseCompiledMode(text);
}
// Runs inside the running `api` container: the settings object the application
// loads plus the AUTH_MODE of the serving process (PID 1), which must agree.
export const API_MODE_PROBE = [
  'import json',
  'from ontokit.core.config import settings',
  'raw = open("/proc/1/environ", "rb").read().decode("utf-8", "replace").split("\\0")',
  'env = dict(e.split("=", 1) for e in raw if "=" in e)',
  `client = settings.zitadel_client_id or ""`,
  `print(json.dumps({"mode": settings.auth_mode, "processMode": env.get("AUTH_MODE", ""), "providerConfigured": client not in ("", "${API_UNCONFIGURED_CLIENT}"), "superadmins": len(settings.superadmin_ids)}))`,
].join('\n');
export function parseApiMode(output) {
  const line = String(output ?? '').trim().split('\n').filter(Boolean).at(-1);
  let value;
  try { value = JSON.parse(line); } catch { throw disagreement('API mode report is unreadable'); }
  if (!value || !AUTH_MODES.includes(value.mode) || typeof value.providerConfigured !== 'boolean' || !Number.isSafeInteger(value.superadmins)) throw disagreement('API mode report is malformed');
  if (value.processMode !== value.mode) throw disagreement('API process and settings modes differ');
  if (value.superadmins !== 0) throw disagreement('API has a superadmin allowlist');
  return {mode: value.mode, providerConfigured: value.providerConfigured};
}
/** Fails unless the compiled web build and the running API both match the profile. */
export function assertModeAgreement(profile, {web, api}) {
  const p = profileSpec(profile);
  const expected = {mode: p.apiMode, providerConfigured: p.identity};
  if (p.webMode !== p.apiMode) throw disagreement('profile is inconsistent');
  for (const [name, observed] of [['web', web], ['API', api]]) {
    if (!observed || observed.mode !== expected.mode) throw disagreement(`${name} mode is not ${expected.mode}`);
    if (observed.providerConfigured !== expected.providerConfigured) throw disagreement(`${name} provider configuration is not ${expected.providerConfigured ? 'active' : 'absent'}`);
  }
  return {profile, web: {...web}, api: {...api}};
}
