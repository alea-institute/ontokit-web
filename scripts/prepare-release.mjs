#!/usr/bin/env node
/**
 * Prepare a release by stripping the -dev suffix from the version.
 *
 * Usage:
 *   node scripts/prepare-release.mjs
 *
 * This will:
 *   1. Read the current version from package.json (e.g. "0.2.0-dev")
 *   2. Strip the -dev suffix -> "0.2.0"
 *   3. Update package.json
 *   4. Create a git commit: "chore: releasing 0.2.0"
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(__dirname, "..", "package.json");

const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
const current = pkg.version;

if (!current.includes("-dev") && !current.includes("-rc")) {
  console.error(
    `Error: Current version '${current}' has no -dev or -rc suffix to strip`,
  );
  process.exit(1);
}

const release = current.replace("-dev", "").replace("-rc", "");

execSync(`npm pkg set version=${release}`, { stdio: "inherit" });
console.log(`Updated package.json: ${current} -> ${release}`);

// Git commit
execSync(`git add ${packagePath}`, { stdio: "inherit" });
execSync(`git commit -m "chore: releasing ${release}"`, { stdio: "inherit" });
console.log(`Created commit: chore: releasing ${release}`);
console.log();
console.log("Next steps:");
console.log(`  git tag -s ontokit-web-${release}`);
console.log("  git push && git push --tags");
