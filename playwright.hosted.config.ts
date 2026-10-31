import {defineConfig, devices} from "@playwright/test";
import path from "node:path";
import {loadSuggestionsRun} from "./e2e/fixtures/run";

const run = loadSuggestionsRun();
if (!run.hosted) throw new Error("Hosted suggestions require an attested hosted target");
export default defineConfig({
  testDir: "./e2e", outputDir: path.join(run.dir, "test-results"),
  forbidOnly: true, fullyParallel: false, workers: 1, retries: 0, timeout: 240_000,
  expect: {timeout: 15_000},
  reporter: [["json", {outputFile: path.join(run.dir, "playwright-report.json")}]],
  use: {...devices["Desktop Chrome"], baseURL: run.web, actionTimeout: 15_000, navigationTimeout: 30_000, trace: "off", screenshot: "off", video: "off"},
  projects: [
    {name: "hosted-personas", testMatch: "**/browser/hosted-personas.spec.ts"},
    {name: "suggestions", testMatch: "**/browser/suggestions.spec.ts", dependencies: ["hosted-personas"]},
  ],
});
