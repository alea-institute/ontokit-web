import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.GENERATIVE_BASE_URL || "http://localhost:8917";
const origin = new URL(baseURL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
  Number(origin.port) < 8700 || Number(origin.port) > 9999) {
  throw new Error("Generative review checks require an owned local server on port 8700–9999.");
}

export default defineConfig({
  testDir: "./ui-tests",
  testMatch: "generative-batch.spec.ts",
  outputDir: "test-results/generative",
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
