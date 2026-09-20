import fs from "node:fs";
import path from "node:path";

export type Persona = "owner" | "unrelated";
export interface RunConfig {
  id: string;
  dir: string;
  issuer: string;
  login: string;
  web: string;
  api: string;
  ordinaryUserPolicyVerified: boolean;
  users: Record<Persona, { id: string; email: string; password: string }>;
}
export function loadRun(): RunConfig {
  const file = process.env.ONTOKIT_E2E_CONFIG;
  if (!file || !path.isAbsolute(file)) throw new Error("Use npm run test:e2e with an explicit API checkout; a private run config is required");
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error("Unsafe private E2E config");
  const run = JSON.parse(fs.readFileSync(file, "utf8")) as RunConfig;
  const expected = `/tmp/ontokit-e2e-${process.getuid?.()}/${run.id}`;
  if (!/^[a-f0-9]{32}$/.test(run.id) || run.id !== process.env.ONTOKIT_E2E_RUN || run.dir !== expected || path.dirname(file) !== expected) throw new Error("E2E config does not belong to this invocation");
  for (const value of [run.web, run.api, run.issuer, run.login]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.hostname !== "localhost" || !url.port || url.username || url.password) throw new Error("E2E URLs must be explicit loopback origins");
  }
  if (!run.ordinaryUserPolicyVerified || !run.users.owner.id || !run.users.unrelated.id || run.users.owner.id === run.users.unrelated.id) throw new Error("Fresh ordinary identities were not verified");
  return run;
}
export const authPath = (run: RunConfig, persona: Persona) => path.join(run.dir, "auth", `${persona}.json`);
export const sessionPath = (run: RunConfig, persona: Persona) => path.join(run.dir, "auth", `${persona}-session.json`);
