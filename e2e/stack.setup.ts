import { test as setup, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { loadRun } from "./fixtures/run";
import { saveAuthenticatedPersona } from "./fixtures/auth";

setup("genuine OIDC sessions for two fresh ordinary users", async ({browser, request}) => {
  // Two independent real authorization flows share this setup test. Each UI
  // transition remains bounded and waits for observable state, never sleeps.
  setup.setTimeout(180_000);
  const run = loadRun();
  await fs.mkdir(path.join(run.dir, "auth"), {mode: 0o700});
  const discovery = await request.get(`${run.issuer}/.well-known/openid-configuration`);
  expect(discovery.status()).toBe(200);
  expect((await discovery.json()).issuer).toBe(run.issuer);
  expect(run.ordinaryUserPolicyVerified).toBe(true);
  await saveAuthenticatedPersona(browser, run, "owner");
  await saveAuthenticatedPersona(browser, run, "unrelated");
  await fs.writeFile(path.join(run.dir, "auth-foundation.json"), JSON.stringify({issuer: run.issuer, distinctOrdinaryUsers: true, genuineBrowserCallbacks: 2}), {mode: 0o600});
});
