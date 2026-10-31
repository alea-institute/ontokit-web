import fs from "node:fs";
import path from "node:path";
import { hostedRunDir } from "../../scripts/rehearsal/disposition.mjs";
import { randomBytes } from "node:crypto";

export type Persona = "owner" | "unrelated";
export type SuggestionPersona = "owner" | "suggester" | "editor" | "unrelated";
export type LifecyclePersona = "lifecycle";
export type ModePersona = "owner";
export type ModeProfile = "optional-configured" | "optional-anonymous" | "disabled";
export type Profile = "baseline" | "lifecycle" | "suggestions" | "rehearsal" | ModeProfile;
export type RehearsalPersona = "owner" | "suggester" | "editor";
export interface RunUser { id: string; email: string; password: string }
interface RunOrigins {
  id: string;
  dir: string;
  web: string;
  api: string;
}
interface RunBase extends RunOrigins {
  issuer: string;
  login: string;
  ordinaryUserPolicyVerified: boolean;
}
export interface RunConfig extends RunBase {
  profile: "baseline";
  users: Record<Persona, RunUser>;
}
export interface SuggestionsRunConfig extends RunBase {
  profile: "suggestions";
  users: Record<SuggestionPersona, RunUser>;
}
/** One class the rehearsal edits or inspects, as `scripts/rehearsal/sources.mjs` pins it. */
export interface RehearsalTarget { iri: string; label: string; edited?: string }
export type RehearsalTargets = Record<"folio" | "catholic" | "cttRoot" | "cttFalseFriends" | "cttTerm", RehearsalTarget>;
/**
 * BAIF rehearsal. `isolated` runs on the launcher's disposable stack (loopback origins);
 * `hosted` runs against a serving host with personas that already exist there.
 */
export interface RehearsalRunConfig extends RunBase {
  profile: "rehearsal";
  users: Record<RehearsalPersona, RunUser>;
  rehearsal: {
    target: "isolated" | "hosted";
    sources: { folio: string; catholicCtt: string };
    targets: RehearsalTargets;
    ctt: { calibration: "uncalibrated" | "calibrated"; terms: number; falseFriends: number; communities: number };
  };
}
export type AuthenticatedRunConfig = RunConfig | SuggestionsRunConfig | RehearsalRunConfig;
/** OIDC lifetimes read back from the disposable provider, in seconds. */
export interface LifecycleLifetimes {
  accessTokenLifetime: number;
  idTokenLifetime: number;
  refreshTokenIdleExpiration: number;
  refreshTokenExpiration: number;
}
export interface LifecycleRunConfig extends RunBase {
  profile: "lifecycle";
  users: Record<LifecyclePersona, RunUser>;
  lifecycle: {
    lifetimes: LifecycleLifetimes;
    /** Real elapsed-time budget added to each observed provider expiry. */
    graceSeconds: number;
    /** Observed exp - iat of a genuinely issued access token. */
    observedAccessTokenLifetimeSeconds: number;
    /** Pinned Auth.js session-cookie JWT decode tolerance. */
    verifierToleranceSeconds: number;
    sessionMaxAgeSeconds: number;
    /** Private control file read by the owned Next process preload. */
    clockControl: string;
    maxClockOffsetMs: number;
    clockPreflightVerified: boolean;
  };
}
/** Mode and provider flags the launcher observed and matched before any browser case (KTD2). */
export interface ObservedAuthMode { mode: "required" | "optional" | "disabled"; providerConfigured: boolean }
/** Run-tagged project IDs seeded inside the API container (KTD4). */
export interface SeededProjects { publicProject: string; foreignPrivateProject: string }
export interface OptionalConfiguredRunConfig extends RunBase {
  profile: "optional-configured";
  users: Record<ModePersona, RunUser>;
  authModes: { web: ObservedAuthMode; api: ObservedAuthMode };
  /** personaPrivateProject is owned by users.owner; the other two by a synthetic foreign user. */
  fixtures: SeededProjects & { personaPrivateProject: string };
}
/** Provider-less profiles: no issuer, Login, users or bearer tokens exist. */
export interface ProviderlessRunConfig extends RunOrigins {
  profile: "optional-anonymous" | "disabled";
  authModes: { web: ObservedAuthMode; api: ObservedAuthMode };
  fixtures: SeededProjects;
}
export type ModeRunConfig = OptionalConfiguredRunConfig | ProviderlessRunConfig;
export type AnyRunConfig = RunConfig | LifecycleRunConfig | ModeRunConfig | SuggestionsRunConfig | RehearsalRunConfig;

// Mirrors PROFILE_REGISTRY in scripts/e2e/auth-modes.mjs; the loader re-checks agreement.
const MODE_PROFILES: Record<ModeProfile, { mode: ObservedAuthMode["mode"]; provider: boolean }> = {
  "optional-configured": { mode: "optional", provider: true },
  "optional-anonymous": { mode: "optional", provider: false },
  disabled: { mode: "disabled", provider: false },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function loopback(value: unknown) {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new Error("E2E URLs must be explicit loopback origins"); }
  if (url.protocol !== "http:" || url.hostname !== "localhost" || !url.port || url.username || url.password) throw new Error("E2E URLs must be explicit loopback origins");
}
/** Hosted rehearsal origins: HTTPS only, no credentials in the URL. */
function hostedOrigin(value: unknown) {
  let url: URL;
  try { url = new URL(String(value)); } catch { throw new Error("Hosted rehearsal URLs must be explicit HTTPS origins"); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Hosted rehearsal URLs must be explicit HTTPS origins");
  // Mirrors scripts/rehearsal/hosted.mjs: a hosted run never targets this machine or a private network.
  if (/^(localhost|.*\.localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i.test(url.hostname)) throw new Error("Hosted rehearsal URLs must be remote HTTPS origins");
}
function validateRehearsalRun(run: RehearsalRunConfig) {
  const users = Object.values(run.users ?? {});
  if (Object.keys(run.users ?? {}).sort().join() !== "editor,owner,suggester" || users.some(user => !validUser(user)) || new Set(users.map(user => user.id)).size !== 3) throw new Error("Rehearsal personas were not verified");
  const r = run.rehearsal;
  if (!r || !["isolated", "hosted"].includes(r.target)) throw new Error("Rehearsal target is invalid");
  for (const file of [r.sources?.folio, r.sources?.catholicCtt]) {
    if (typeof file !== "string" || path.dirname(file) !== path.join(run.dir, "rehearsal")) throw new Error("Rehearsal sources must be staged in this run's private directory");
  }
  for (const key of ["folio", "catholic", "cttRoot", "cttFalseFriends", "cttTerm"] as const) {
    const target = r.targets?.[key];
    if (!target || typeof target.iri !== "string" || !/^https?:\/\//.test(target.iri) || typeof target.label !== "string" || !target.label) throw new Error("Rehearsal targets are invalid");
  }
  if (!r.targets.folio.edited || !r.targets.catholic.edited) throw new Error("Rehearsal edit targets are invalid");
  if (!["uncalibrated", "calibrated"].includes(r.ctt?.calibration) || !(r.ctt.terms > 0) || !(r.ctt.falseFriends > 0)) throw new Error("Rehearsal CTT summary is invalid");
  // The isolated launcher only ever produces loopback origins; hosted runs only HTTPS.
  for (const value of [run.web, run.api, run.issuer, run.login]) (r.target === "isolated" ? loopback : hostedOrigin)(value);
  if (!run.ordinaryUserPolicyVerified && r.target === "isolated") throw new Error("Fresh ordinary identities were not verified");
}
function validateModeRun(run: ModeRunConfig) {
  const expected = MODE_PROFILES[run.profile];
  for (const side of [run.authModes?.web, run.authModes?.api]) {
    if (!side || side.mode !== expected.mode || side.providerConfigured !== expected.provider) throw new Error("E2E config does not record mode agreement for this profile");
  }
  const keys = ["publicProject", "foreignPrivateProject", ...(expected.provider ? ["personaPrivateProject"] : [])].sort().join();
  const fixtures = (run.fixtures ?? {}) as unknown as Record<string, unknown>;
  const ids = Object.values(fixtures);
  if (Object.keys(fixtures).sort().join() !== keys || ids.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(ids).size !== ids.length) throw new Error("Seeded E2E fixtures are invalid for this profile");
  if (run.profile === "optional-configured") {
    for (const value of [run.issuer, run.login]) loopback(value);
    if (!run.ordinaryUserPolicyVerified || Object.keys(run.users ?? {}).join() !== "owner" || !validUser(run.users.owner)) throw new Error("Fresh ordinary identities were not verified");
  } else {
    const raw = run as unknown as Record<string, unknown>;
    if (["issuer", "login", "users"].some(key => key in raw)) throw new Error("Provider-less E2E config must not carry identity URLs or users");
  }
}

const RUN_ID = /^[a-f0-9]{32}$/;
function validUser(user: RunUser | undefined): user is RunUser {
  return !!user && typeof user.id === "string" && !!user.id && typeof user.email === "string" && typeof user.password === "string";
}
/** Loads and validates the private config for this invocation, for any profile. */
export function loadRunConfig(): AnyRunConfig {
  const file = process.env.ONTOKIT_E2E_CONFIG;
  if (!file || !path.isAbsolute(file)) throw new Error("Use npm run test:e2e with an explicit API checkout; a private run config is required");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error("Unsafe private E2E config");
  const run = JSON.parse(fs.readFileSync(file, "utf8")) as AnyRunConfig;
  const expected = run.profile === "rehearsal" && run.rehearsal?.target === "hosted"
    ? hostedRunDir(run.id)
    : `/tmp/ontokit-e2e-${process.getuid?.()}/${run.id}`;
  if (!RUN_ID.test(run.id) || run.id !== process.env.ONTOKIT_E2E_RUN || run.dir !== expected || path.dirname(file) !== expected) throw new Error("E2E config does not belong to this invocation");
  if (run.profile === "rehearsal") {
    validateRehearsalRun(run);
    return run;
  }
  for (const value of [run.web, run.api]) loopback(value);
  if (Object.hasOwn(MODE_PROFILES, run.profile)) {
    validateModeRun(run as ModeRunConfig);
    return run;
  }
  const provider = run as RunConfig | LifecycleRunConfig | SuggestionsRunConfig;
  for (const value of [provider.issuer, provider.login]) loopback(value);
  if (!provider.ordinaryUserPolicyVerified) throw new Error("Fresh ordinary identities were not verified");
  if (run.profile === "baseline") {
    if (Object.keys(run.users ?? {}).sort().join() !== "owner,unrelated" || !validUser(run.users.owner) || !validUser(run.users.unrelated) || run.users.owner.id === run.users.unrelated.id) throw new Error("Fresh ordinary identities were not verified");
  } else if (run.profile === "suggestions") {
    const users = Object.values(run.users ?? {});
    if (Object.keys(run.users ?? {}).sort().join() !== "editor,owner,suggester,unrelated" || users.some(user => !validUser(user)) || new Set(users.map(user => user.id)).size !== 4) throw new Error("Fresh ordinary identities were not verified");
  } else if (run.profile === "lifecycle") {
    const lifecycle = run.lifecycle;
    if (Object.keys(run.users ?? {}).join() !== "lifecycle" || !validUser(run.users.lifecycle)) throw new Error("Fresh ordinary identities were not verified");
    if (!lifecycle || lifecycle.clockControl !== path.join(expected, "auth-clock.json") || lifecycle.clockPreflightVerified !== true) throw new Error("Lifecycle clock preflight was not verified for this invocation");
    for (const value of [...Object.values(lifecycle.lifetimes ?? {}), lifecycle.graceSeconds, lifecycle.observedAccessTokenLifetimeSeconds, lifecycle.verifierToleranceSeconds, lifecycle.sessionMaxAgeSeconds, lifecycle.maxClockOffsetMs]) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error("Lifecycle profile metadata is invalid");
    }
  } else throw new Error("Unknown E2E profile");
  return run;
}
/** Baseline D06 consumers: rejects the lifecycle profile so its persona can never stand in. */
export function loadRun(): RunConfig {
  const run = loadRunConfig();
  if (run.profile !== "baseline") throw new Error("This suite requires the baseline E2E profile");
  return run;
}
/** D09 mode-profile consumers: rejects every other profile, so a spec cannot run on the wrong stack. */
export type ModeRunFor<P extends ModeProfile> = P extends "optional-configured" ? OptionalConfiguredRunConfig : ProviderlessRunConfig & { profile: P };
export function loadModeRun<P extends ModeProfile>(profile: P): ModeRunFor<P> {
  const run = loadRunConfig();
  if (run.profile !== profile) throw new Error(`This suite requires the ${profile} E2E profile`);
  return run as ModeRunFor<P>;
}
/** Lifecycle consumers: rejects the baseline profile, whose provider lifetimes are normal. */
export function loadLifecycleRun(): LifecycleRunConfig {
  const run = loadRunConfig();
  if (run.profile !== "lifecycle") throw new Error("This suite requires the lifecycle E2E profile");
  return run;
}
export function loadSuggestionsRun(): SuggestionsRunConfig {
  const run = loadRunConfig();
  if (run.profile !== "suggestions") throw new Error("This suite requires the suggestions E2E profile");
  return run;
}
export function loadRehearsalRun(): RehearsalRunConfig {
  const run = loadRunConfig();
  if (run.profile !== "rehearsal") throw new Error("This suite requires the rehearsal E2E profile");
  return run;
}
export const authPath = (run: AuthenticatedRunConfig, persona: SuggestionPersona) => path.join(run.dir, "auth", `${persona}.json`);
export const sessionPath = (run: AuthenticatedRunConfig, persona: SuggestionPersona) => path.join(run.dir, "auth", `${persona}-session.json`);

/**
 * Sets the owned Next process clock offset (KTD3). Writes the same private control
 * format that scripts/e2e/auth-clock.mjs validates: atomic, mode 0600, bound to this
 * run, never following symlinks and never replacing another run's control. The Next
 * preload applies a change within tens of milliseconds; callers must still observe
 * Auth.js (for example the session `expires` field) before relying on it, and must
 * reset to zero in a finally block and before any interactive OIDC exchange.
 */
export function setAuthClockOffset(run: LifecycleRunConfig, offsetMs: number) {
  if (!Number.isSafeInteger(offsetMs) || offsetMs < 0 || offsetMs > run.lifecycle.maxClockOffsetMs) throw new Error("Auth clock offset out of range");
  const file = run.lifecycle.clockControl;
  const dir = path.dirname(file);
  const dirStat = fs.lstatSync(dir);
  if (dir !== run.dir || !dirStat.isDirectory() || dirStat.isSymbolicLink() || dirStat.uid !== process.getuid?.() || (dirStat.mode & 0o077) !== 0 || fs.realpathSync(dir) !== dir) throw new Error("Unsafe auth clock directory");
  let existing: fs.Stats | undefined;
  try { existing = fs.lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink() || existing.uid !== process.getuid?.() || (existing.mode & 0o077) !== 0) throw new Error("Unsafe auth clock control");
    const current = JSON.parse(fs.readFileSync(file, "utf8")) as { run?: unknown };
    if (current.run !== run.id) throw new Error("Auth clock control belongs to another run");
  }
  const temporary = path.join(dir, `.auth-clock.json.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, run: run.id, offsetMs }), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
export const resetAuthClock = (run: LifecycleRunConfig) => setAuthClockOffset(run, 0);
