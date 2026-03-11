#!/usr/bin/env node
/**
 * Set the next development version for OntoKit Web.
 *
 * Usage:
 *   node scripts/set-version.mjs 0.3.0
 *
 * This will:
 *   1. Update package.json version to "0.3.0-dev"
 *   2. Create a git commit: "chore: setting version to 0.3.0-dev"
 */

import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(__dirname, "..", "package.json");

const version = process.argv[2];

if (!version) {
  console.error(`Usage: node scripts/set-version.mjs <version>`);
  console.error("Example: node scripts/set-version.mjs 0.3.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    `Error: Invalid version format '${version}'. Expected X.Y.Z`,
  );
  process.exit(1);
}

const devVersion = `${version}-dev`;

execFileSync("npm", ["pkg", "set", `version=${devVersion}`], { stdio: "inherit" });
console.log(`Updated package.json to ${devVersion}`);

// Git commit
execFileSync("git", ["add", packagePath], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", `chore: setting version to ${devVersion}`], {
  stdio: "inherit",
});
console.log(`Created commit: chore: setting version to ${devVersion}`);
