import { defineConfig, devices } from "@playwright/test";

// Separate from the isolated-stack rehearsal harness: synthetic public reads,
// real pages and browser storage, no hosted personas or backend mutations.
const baseURL = process.env.DEMO_POLISH_BASE_URL || "http://localhost:3105";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Demo polish checks require an owned local server.");
}

export default defineConfig({
  testDir: "./ui-tests",
  testMatch: "demo-polish.spec.ts",
  outputDir: "test-results/demo-polish",
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    actionTimeout: 15_000,
    reducedMotion: "reduce",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
