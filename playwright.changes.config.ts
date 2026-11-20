import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.CHANGES_PORT || 8917);
if (!Number.isInteger(port) || port < 8700 || port > 9999) {
  throw new Error("Choose a local port from 8700 through 9999 for the Changes test.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./ui-tests",
  testMatch: "changes-page.spec.ts",
  outputDir: "test-results/changes",
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/projects/project-1/changes`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_MODE: "disabled",
      NEXT_PUBLIC_API_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      // Keep Next's agent guidance generator from changing repository files.
      CODEX_CI: "",
      CODEX_SANDBOX: "",
      CODEX_THREAD_ID: "",
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    reducedMotion: "reduce",
  },
});
