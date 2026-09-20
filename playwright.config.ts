import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { loadRun } from "./e2e/fixtures/run";

const run = loadRun();
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
  projects: [
    { name: "stack setup", testMatch: /stack\.setup\.ts/, teardown: "stack teardown" },
    { name: "stack teardown", testMatch: /stack\.teardown\.ts/ },
    { name: "chromium", testMatch: /.*\.spec\.ts/, dependencies: ["stack setup"] },
  ],
});
