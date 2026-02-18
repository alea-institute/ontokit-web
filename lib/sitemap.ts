/**
 * Sitemap generation utilities for OntoKit.
 *
 * Generates a static sitemap.xml file that can be served directly by Nginx
 * or the Next.js static file server. The backend triggers regeneration
 * via HTTP POST when public projects change.
 */

import { readdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITEMAP_PATH =
  process.env.SITEMAP_OUTPUT_PATH || `${process.cwd()}/public/sitemap.xml`;

/** Route prefixes excluded from the sitemap (auth-required or disallowed by robots.txt). */
const DISALLOWED_PREFIXES = ["/api", "/auth", "/settings", "/projects/new"];

/**
 * Scan the app/ directory for all page.tsx files and return the public static routes.
 * Excludes dynamic routes (containing `[`) and routes matching DISALLOWED_PREFIXES.
 */
function discoverStaticPages(): string[] {
  const appDir = join(process.cwd(), "app");
  const entries = readdirSync(appDir, { recursive: true }) as string[];

  return entries
    .filter((entry) => entry.endsWith("page.tsx"))
    .map((entry) => {
      // app/docs/changelog/page.tsx → /docs/changelog
      const route = "/" + entry.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
      return route === "/" ? "/" : route.replace(/\/$/, "");
    })
    .filter((route) => !route.includes("["))
    .filter((route) =>
      !DISALLOWED_PREFIXES.some(
        (prefix) => route === prefix || route.startsWith(prefix + "/"),
      ),
    )
    .sort();
}

interface ProjectListItem {
  id: string;
  updated_at: string;
}

interface ProjectListResponse {
  items: ProjectListItem[];
  total: number;
}

function buildUrlEntry(loc: string, lastmod?: string): string {
  const lines = [`  <url>`, `    <loc>${SITE_URL}${loc}</loc>`];
  if (lastmod) {
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
  }
  lines.push(`  </url>`);
  return lines.join("\n");
}

function buildSitemapXml(entries: string[]): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries,
    `</urlset>`,
    ``,
  ].join("\n");
}

/**
 * Fetch all public projects from the backend and generate a complete sitemap.xml.
 */
export async function generateSitemap(): Promise<void> {
  const entries: string[] = [];

  // Static pages (auto-discovered from app/ directory)
  for (const page of discoverStaticPages()) {
    entries.push(buildUrlEntry(page));
  }

  // Fetch all public projects (paginated, API max is 100 per page)
  try {
    let skip = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore) {
      const res = await fetch(
        `${API_BASE}/api/v1/projects?filter=public&limit=${limit}&skip=${skip}`
      );
      if (!res.ok) break;
      const data: ProjectListResponse = await res.json();
      for (const project of data.items) {
        entries.push(
          buildUrlEntry(`/projects/${project.id}`, project.updated_at)
        );
      }
      skip += limit;
      hasMore = data.items.length === limit;
    }
  } catch {
    // If the backend is unreachable, generate sitemap with static pages only
  }

  await writeFile(SITEMAP_PATH, buildSitemapXml(entries), "utf-8");
}

/**
 * Add a single URL entry to the existing sitemap.xml.
 * If the file doesn't exist, generates a full sitemap instead.
 */
export async function addSitemapEntry(
  url: string,
  lastmod?: string
): Promise<void> {
  let xml: string;
  try {
    xml = await readFile(SITEMAP_PATH, "utf-8");
  } catch {
    // File doesn't exist — generate from scratch
    await generateSitemap();
    return;
  }

  // Remove existing entry for this URL to avoid duplicates
  const fullUrl = `${SITE_URL}${url}`;
  const entryPattern = new RegExp(
    `\\s*<url>\\s*<loc>${escapeRegExp(fullUrl)}</loc>[\\s\\S]*?</url>`,
    "g"
  );
  xml = xml.replace(entryPattern, "");

  // Insert new entry before </urlset>
  const entry = buildUrlEntry(url, lastmod);
  xml = xml.replace("</urlset>", `${entry}\n</urlset>`);

  await writeFile(SITEMAP_PATH, xml, "utf-8");
}

/**
 * Remove a URL entry from the existing sitemap.xml.
 */
export async function removeSitemapEntry(url: string): Promise<void> {
  let xml: string;
  try {
    xml = await readFile(SITEMAP_PATH, "utf-8");
  } catch {
    // File doesn't exist — nothing to remove
    return;
  }

  const fullUrl = `${SITE_URL}${url}`;
  const entryPattern = new RegExp(
    `\\s*<url>\\s*<loc>${escapeRegExp(fullUrl)}</loc>[\\s\\S]*?</url>`,
    "g"
  );
  xml = xml.replace(entryPattern, "");

  await writeFile(SITEMAP_PATH, xml, "utf-8");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
