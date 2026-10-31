import { test as base, expect, type Route } from "@playwright/test";

export const project = {
  id: "demo-polish",
  name: "FOLIO exploration",
  description: "A synthetic public ontology for local interface checks.",
  is_public: true,
  owner_id: "fixture-owner",
  user_role: null,
  member_count: 2,
  source_file_path: "ontology.ttl",
  created_at: "2026-10-20T12:00:00Z",
  updated_at: "2026-10-20T12:00:00Z",
};

export function projectList(search = "") {
  const items = search ? [] : [project];
  return { items, total: items.length, unfiltered_total: 1, skip: 0, limit: 50 };
}

export const test = base.extend<{ apiBoundary: void }>({
  apiBoundary: [async ({ page }, use) => {
    const unexpected: string[] = [];
    const prefix = `/api/v1/projects/${project.id}`;
    const reads: Record<string, unknown> = {
      [prefix]: project,
      [`${prefix}/ontology/tree`]: {
        nodes: [{ iri: "https://folio.example/Person", label: "Person", child_count: 0 }],
        total_classes: 1,
      },
      [`${prefix}/suggestions/capabilities`]: { tier: "anonymous", can_mint_entities: false, accepted_count: 0, promotion_threshold: 3 },
      [`${prefix}/pull-requests`]: { items: [], total: 0 },
      [`${prefix}/lint/status`]: null,
      [`${prefix}/llm/status`]: { configured: false },
      [`${prefix}/suggestions/pending`]: { items: [] },
      [`${prefix}/branches`]: { items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" },
      [`${prefix}/normalization/status`]: { needs_normalization: false },
      [`${prefix}/revisions/file`]: { content: "@prefix ex: <https://folio.example/> .\nex:Person a <http://www.w3.org/2002/07/owl#Class> .", revision: "fixture-revision", filename: "ontology.ttl" },
      [`${prefix}/remote-sync`]: { enabled: false },
      [`${prefix}/translation/config`]: { enabled: false, source_language: "en", language_tags: [] },
      [`${prefix}/translation/palette`]: { languages: [] },
      [`${prefix}/lint/issues`]: { items: [], total: 0 },
    };
    await page.route("**/api/v1/**", async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "GET") {
        if (url.pathname === "/api/v1/projects") {
          return route.fulfill({ json: url.searchParams.has("is_demo")
            ? { ...projectList(), items: [], total: 0 }
            : projectList(url.searchParams.get("search") || "") });
        }
        if (Object.hasOwn(reads, url.pathname)) return route.fulfill({ json: reads[url.pathname] });
      }
      unexpected.push(`${request.method()} ${url.pathname}`);
      await route.abort("blockedbyclient");
    });
    await use();
    expect(unexpected, "All API reads must be explicit; mutations are forbidden in this UI suite").toEqual([]);
  }, { auto: true }],
});

export { expect };
