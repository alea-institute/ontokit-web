import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

// A separate, synthetic-data UI run. It never imports full-stack target files.
const existingURL = process.env.OW4_UI_BASE_URL;
const port = existingURL ? null : Number(process.env.OW4_UI_PORT || execFileSync(process.execPath, ["-e", `
  const server = require('node:net').createServer();
  server.listen(0, '127.0.0.1', () => {
    process.stdout.write(String(server.address().port));
    server.close();
  });
`], { encoding: "utf8" }).trim());
// Workers reload this configuration; they must use the parent's server port.
if (port !== null) process.env.OW4_UI_PORT = String(port);
const baseURL = existingURL || `http://127.0.0.1:${port}`;
if (!["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)) {
  throw new Error("OW4_UI_BASE_URL must identify a local synthetic-data server");
}

export default defineConfig({
  testDir: "./e2e/ui",
  testMatch: "entity-source-preview.spec.ts",
  outputDir: "test-results/ow4-ui",
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 1000 },
    // Optional system Chrome supports runners that already provide it.
    channel: process.env.OW4_UI_CHROME === "1" ? "chrome" : undefined,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: existingURL ? undefined : {
    command: `node e2e/ui/server.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
  },
});
