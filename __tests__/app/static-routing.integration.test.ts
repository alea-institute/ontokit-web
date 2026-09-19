// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRobots } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import { getURLFromRedirectError, getRedirectStatusCodeFromError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import ProjectsPage from "@/app/projects/page";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("static routes through Next serialization and redirect handling", () => {
  it.each([
    [undefined, "http://localhost:3000"],
    ["", "http://localhost:3000"],
    ["https://ontology.example.test", "https://ontology.example.test"],
  ])("serializes robots rules using site URL %s", async (site, expected) => {
    vi.stubEnv("SITE_URL", site);
    vi.resetModules();
    const robots = (await import("@/app/robots")).default;
    const text = resolveRobots(robots());
    expect(text).toBe([
      "User-Agent: *", "Allow: /", "Disallow: /api/", "Disallow: /auth/",
      "Disallow: /settings", "Disallow: /projects/new", "", `Sitemap: ${expected}/sitemap.xml`, "",
    ].join("\n"));
  });

  it("redirects the legacy projects listing to the root through Next's redirect contract", () => {
    let caught: unknown;
    try { ProjectsPage(); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true);
    if (!isRedirectError(caught)) throw new Error("Expected Next redirect error");
    expect(getURLFromRedirectError(caught)).toBe("/");
    expect(getRedirectStatusCodeFromError(caught)).toBe(307);
  });
});
