import { describe, expect, it, vi, beforeEach } from "vitest";

// Use vi.hoisted to create shared mock functions that are referenced by both
// the vi.mock factories and the test assertions. This avoids ESM module
// resolution issues where vi.mock("fs") and the source's import("fs") may
// resolve to different module instances.
const mocks = vi.hoisted(() => ({
  readdirSync: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("fs", () => ({
  readdirSync: mocks.readdirSync,
  default: { readdirSync: mocks.readdirSync },
}));

vi.mock("fs/promises", () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  default: { readFile: mocks.readFile, writeFile: mocks.writeFile },
}));

import {
  generateSitemap,
  addSitemapEntry,
  removeSitemapEntry,
} from "@/lib/sitemap";

// These match the module-level defaults (captured at import time)
const SITE_URL = "http://localhost:3000";
const API_BASE = "http://localhost:8000";

function makeProjectResponse(
  items: Array<{ id: string; updated_at: string }>,
  total: number
) {
  return {
    items,
    total,
    unfiltered_total: total,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("generateSitemap", () => {
  it("discovers static pages and excludes dynamic routes and disallowed prefixes", async () => {
    mocks.readdirSync.mockReturnValue([
      "page.tsx",
      "docs/page.tsx",
      "docs/changelog/page.tsx",
      "projects/[id]/page.tsx",
      "api/health/page.tsx",
      "auth/login/page.tsx",
      "settings/page.tsx",
      "projects/new/page.tsx",
      "about/page.tsx",
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeProjectResponse([], 0),
    });
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await generateSitemap();

    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const xml: string = mocks.writeFile.mock.calls[0][1];

    // Static pages that should be included
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/about</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/docs</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/docs/changelog</loc>`);

    // Dynamic routes should be excluded
    expect(xml).not.toContain("[id]");

    // Disallowed prefixes should be excluded
    expect(xml).not.toContain(`<loc>${SITE_URL}/api/health</loc>`);
    expect(xml).not.toContain(`<loc>${SITE_URL}/auth/login</loc>`);
    expect(xml).not.toContain(`<loc>${SITE_URL}/settings</loc>`);
    expect(xml).not.toContain(`<loc>${SITE_URL}/projects/new</loc>`);
  });

  it("fetches public projects paginated and adds them to sitemap", async () => {
    mocks.readdirSync.mockReturnValue(["page.tsx"]);

    const page1Items = Array.from({ length: 100 }, (_, i) => ({
      id: `proj-${i}`,
      updated_at: "2026-01-01T00:00:00Z",
    }));
    const page2Items = [
      { id: "proj-100", updated_at: "2026-02-01T00:00:00Z" },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeProjectResponse(page1Items, 101),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeProjectResponse(page2Items, 101),
      });
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await generateSitemap();

    // Should have made two paginated requests
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects?filter=public&limit=100&skip=0`
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/v1/projects?filter=public&limit=100&skip=100`
    );

    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toContain(`<loc>${SITE_URL}/projects/proj-0</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/projects/proj-100</loc>`);
    expect(xml).toContain(`<lastmod>2026-02-01T00:00:00Z</lastmod>`);
  });

  it("handles API being unreachable and continues with static pages only", async () => {
    mocks.readdirSync.mockReturnValue(["page.tsx", "about/page.tsx"]);

    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await generateSitemap();

    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/about</loc>`);
    // No project entries
    expect(xml).not.toContain("/projects/");
  });

  it("handles non-ok API response and stops paginating", async () => {
    mocks.readdirSync.mockReturnValue(["page.tsx"]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await generateSitemap();

    // Should only call fetch once since first response was not ok
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).not.toContain("/projects/");
  });

  it("writes correct XML structure", async () => {
    mocks.readdirSync.mockReturnValue(["page.tsx"]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeProjectResponse([], 0),
    });
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await generateSitemap();

    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml).toContain("</urlset>");
    // Ends with trailing newline
    expect(xml).toMatch(/\n$/);
  });
});

describe("addSitemapEntry", () => {
  it("adds new entry to existing sitemap.xml before </urlset>", async () => {
    const existingXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${SITE_URL}/</loc>`,
      "  </url>",
      "</urlset>",
      "",
    ].join("\n");

    mocks.readFile.mockResolvedValue(existingXml);
    mocks.writeFile.mockResolvedValue(undefined);

    await addSitemapEntry("/projects/new-proj", "2026-03-15T00:00:00Z");

    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toContain(`<loc>${SITE_URL}/projects/new-proj</loc>`);
    expect(xml).toContain("<lastmod>2026-03-15T00:00:00Z</lastmod>");
    expect(xml).toContain("</urlset>");
    // Original entry still present
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
  });

  it("replaces existing entry for same URL (deduplication)", async () => {
    const existingXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${SITE_URL}/projects/proj-1</loc>`,
      "    <lastmod>2026-01-01T00:00:00Z</lastmod>",
      "  </url>",
      "</urlset>",
      "",
    ].join("\n");

    mocks.readFile.mockResolvedValue(existingXml);
    mocks.writeFile.mockResolvedValue(undefined);

    await addSitemapEntry("/projects/proj-1", "2026-04-01T00:00:00Z");

    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const xml: string = mocks.writeFile.mock.calls[0][1];

    // Old lastmod should be gone
    expect(xml).not.toContain("2026-01-01T00:00:00Z");
    // New lastmod should be present
    expect(xml).toContain("2026-04-01T00:00:00Z");

    // Should have exactly one entry for proj-1
    const matches = xml.match(
      new RegExp(`<loc>${SITE_URL}/projects/proj-1</loc>`, "g")
    );
    expect(matches).toHaveLength(1);
  });

  it("generates full sitemap if file does not exist", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    mocks.readdirSync.mockReturnValue(["page.tsx"]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeProjectResponse([], 0),
    });
    vi.stubGlobal("fetch", mockFetch);
    mocks.writeFile.mockResolvedValue(undefined);

    await addSitemapEntry("/projects/proj-1");

    // Should have fallen back to generateSitemap
    expect(mocks.readdirSync).toHaveBeenCalled();
    expect(mocks.writeFile).toHaveBeenCalledOnce();
  });

  it("handles entry without lastmod parameter", async () => {
    const existingXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "</urlset>",
      "",
    ].join("\n");

    mocks.readFile.mockResolvedValue(existingXml);
    mocks.writeFile.mockResolvedValue(undefined);

    await addSitemapEntry("/about");

    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).toContain(`<loc>${SITE_URL}/about</loc>`);
    expect(xml).not.toContain("<lastmod>");
  });
});

describe("removeSitemapEntry", () => {
  it("removes matching entry from sitemap", async () => {
    const existingXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${SITE_URL}/</loc>`,
      "  </url>",
      "  <url>",
      `    <loc>${SITE_URL}/projects/proj-1</loc>`,
      "    <lastmod>2026-01-01T00:00:00Z</lastmod>",
      "  </url>",
      "</urlset>",
      "",
    ].join("\n");

    mocks.readFile.mockResolvedValue(existingXml);
    mocks.writeFile.mockResolvedValue(undefined);

    await removeSitemapEntry("/projects/proj-1");

    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const xml: string = mocks.writeFile.mock.calls[0][1];
    expect(xml).not.toContain("proj-1");
    // Other entries should still be present
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
  });

  it("does nothing if file does not exist", async () => {
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));

    await removeSitemapEntry("/projects/proj-1");

    // Should not attempt to write
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
