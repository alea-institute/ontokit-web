import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { loadRunConfig } from "./e2e/fixtures/run";
import { playwrightProjects } from "./scripts/e2e/auth-modes.mjs";

// Profiles run on separate fresh stacks (KTD1). Projects come from the profile
// registry (KTD7): each non-baseline profile discovers only its own spec, and the
// baseline project ignores every spec another profile owns.
const run = loadRunConfig();
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
  projects: playwrightProjects(run.profile),
});
