import { test as teardown } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { loadRun } from "./fixtures/run";

teardown("remove private browser credentials", async () => {
  const run = loadRun();
  await fs.rm(path.join(run.dir, "auth"), {recursive: true, force: true});
  // Outer launcher owns processes, containers and all remaining private artifacts,
  // including when setup fails or Playwright never reaches this teardown project.
});
