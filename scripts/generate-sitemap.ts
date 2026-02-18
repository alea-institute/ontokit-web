#!/usr/bin/env npx tsx
/**
 * CLI script to generate sitemap.xml.
 *
 * Usage:
 *   npx tsx scripts/generate-sitemap.ts
 *
 * This fetches all public projects from the backend API and writes
 * a complete sitemap.xml to public/sitemap.xml (or SITEMAP_OUTPUT_PATH).
 *
 * Useful for:
 *   - Initial setup
 *   - CI/CD builds
 *   - Recovery after data changes
 */

import { generateSitemap } from "../lib/sitemap";

async function main() {
  console.log("Generating sitemap.xml...");
  await generateSitemap();
  const path =
    process.env.SITEMAP_OUTPUT_PATH ||
    `${process.cwd()}/public/sitemap.xml`;
  console.log(`Sitemap written to ${path}`);
}

main().catch((err) => {
  console.error("Failed to generate sitemap:", err);
  process.exit(1);
});
