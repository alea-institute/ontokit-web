import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type Persona = "owner" | "unrelated";
export type LifecyclePersona = "lifecycle";
export type Profile = "baseline" | "lifecycle";
export interface RunUser { id: string; email: string; password: string }
interface RunBase {
  id: string;
  dir: string;
  issuer: string;
  login: string;
  web: string;
  api: string;
  ordinaryUserPolicyVerified: boolean;
}
export interface RunConfig extends RunBase {
  profile: "baseline";
  users: Record<Persona, RunUser>;
}
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
export type AnyRunConfig = RunConfig | LifecycleRunConfig;

const RUN_ID = /^[a-f0-9]{32}$/;
function validUser(user: RunUser | undefined): user is RunUser {
  return !!user && typeof user.id === "string" && !!user.id && typeof user.email === "string" && typeof user.password === "string";
}
/** Loads and validates the private config for this invocation, for either profile. */
export function loadRunConfig(): AnyRunConfig {
  const file = process.env.ONTOKIT_E2E_CONFIG;
  if (!file || !path.isAbsolute(file)) throw new Error("Use npm run test:e2e with an explicit API checkout; a private run config is required");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error("Unsafe private E2E config");
  const run = JSON.parse(fs.readFileSync(file, "utf8")) as AnyRunConfig;
  const expected = `/tmp/ontokit-e2e-${process.getuid?.()}/${run.id}`;
  if (!RUN_ID.test(run.id) || run.id !== process.env.ONTOKIT_E2E_RUN || run.dir !== expected || path.dirname(file) !== expected) throw new Error("E2E config does not belong to this invocation");
  for (const value of [run.web, run.api, run.issuer, run.login]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.hostname !== "localhost" || !url.port || url.username || url.password) throw new Error("E2E URLs must be explicit loopback origins");
  }
  if (!run.ordinaryUserPolicyVerified) throw new Error("Fresh ordinary identities were not verified");
  if (run.profile === "baseline") {
    if (Object.keys(run.users ?? {}).sort().join() !== "owner,unrelated" || !validUser(run.users.owner) || !validUser(run.users.unrelated) || run.users.owner.id === run.users.unrelated.id) throw new Error("Fresh ordinary identities were not verified");
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
/** Lifecycle consumers: rejects the baseline profile, whose provider lifetimes are normal. */
export function loadLifecycleRun(): LifecycleRunConfig {
  const run = loadRunConfig();
  if (run.profile !== "lifecycle") throw new Error("This suite requires the lifecycle E2E profile");
  return run;
}
export const authPath = (run: RunConfig, persona: Persona) => path.join(run.dir, "auth", `${persona}.json`);
export const sessionPath = (run: RunConfig, persona: Persona) => path.join(run.dir, "auth", `${persona}-session.json`);

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
