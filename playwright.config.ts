import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { loadRunConfig } from "./e2e/fixtures/run";

// Profiles run on separate fresh stacks (KTD1). The lifecycle profile shortens
// instance-wide provider lifetimes, so its spec never joins the baseline run and
// baseline specs never run against lifecycle lifetimes.
const run = loadRunConfig();
const LIFECYCLE_SPEC = /auth-lifecycle\.spec\.ts$/;
export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(run.dir, "test-results"),
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["line"], ["json", { outputFile: path.join(run.dir, "playwright-report.json") }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: run.web,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: run.profile === "lifecycle"
    ? [{ name: "lifecycle", testMatch: LIFECYCLE_SPEC }]
    : [
      { name: "stack setup", testMatch: /stack\.setup\.ts/, teardown: "stack teardown" },
      { name: "stack teardown", testMatch: /stack\.teardown\.ts/ },
      { name: "chromium", testMatch: /.*\.spec\.ts/, testIgnore: LIFECYCLE_SPEC, dependencies: ["stack setup"] },
    ],
});
