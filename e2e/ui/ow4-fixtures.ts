import { expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Synthetic data only: these checks prove browser presentation and navigation,
// not hosted authentication, API permissions, or the BAIF rehearsal.
export const projectId = "11111111-1111-4111-8111-111111111111";
export const ns = "https://example.org/ow4/";
export const filePath = "ontologies/demo.ttl";
export const source = `@prefix : <${ns}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Person a owl:Class ;
    rdfs:label "Person"@en .

:hasGuide a owl:ObjectProperty ;
    rdfs:label "has guide"@en ;
    rdfs:domain :Person ;
    rdfs:range :Person .

:alice a owl:NamedIndividual, :Person ;
    rdfs:label "Alice"@en .
`;
const classDetail = {
  iri: `${ns}Person`, labels: [{ value: "Person", lang: "en" }], comments: [],
  parent_iris: [], parent_labels: {}, equivalent_iris: [], disjoint_iris: [],
  child_count: 0, instance_count: 1, is_defined: false, deprecated: false, annotations: [],
};
const node = { iri: `${ns}Person`, label: "Person", child_count: 0, deprecated: false };

export async function installFixtures(context: BrowserContext) {
  const writes: string[] = [];
  const unexpected: string[] = [];
  await context.addInitScript(() => {
    localStorage.setItem("ontokit-editor-preferences", JSON.stringify({ version: 1, state: {
      editorMode: "developer", theme: "light", preferEditMode: false,
      showManualSaveButton: true, hasSeenAutoSaveToast: true,
    } }));
  });
  await context.route("**/api/auth/session", route => route.fulfill({ json: {
    user: { id: "synthetic-editor", name: "Demo editor", email: "editor@example.invalid" },
    accessToken: "synthetic-ui-session", expires: "2099-01-01T00:00:00.000Z",
  } }));
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace(`/api/v1/projects/${projectId}`, "");
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*",
      } });
    }
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 409, json: { detail: "The source-preview test must not write" } });
    }
    const reply = (json: unknown) => route.fulfill({ json, headers: { "Access-Control-Allow-Origin": "*" } });
    if (suffix === "") return reply({
      id: projectId, name: "Entity source demo", is_public: true, user_role: "editor", owner_id: "synthetic-owner",
      source_file_path: filePath, git_ontology_path: filePath, member_count: 2, created_at: "2026-01-01T00:00:00Z",
    });
    if (suffix === "/branches") return reply({
      items: [{ name: "main", is_current: true, is_default: true, commits_ahead: 0, commits_behind: 0,
        remote_commits_ahead: null, remote_commits_behind: null, can_delete: false, has_open_pr: false, has_delete_permission: false }],
      current_branch: "main", default_branch: "main", preferred_branch: null,
      has_github_remote: false, last_sync_at: null, sync_status: null,
    });
    if (suffix === "/revisions/file") return reply({
      project_id: projectId, version: url.searchParams.get("version"), revision: "a".repeat(40), filename: filePath, content: source,
    });
    if (suffix === "/ontology/tree") return reply({ nodes: [node], total_classes: 1 });
    if (suffix.endsWith("/ancestors") || suffix.endsWith("/children")) return reply({ nodes: [], total_classes: 1 });
    if (suffix.startsWith("/ontology/classes/")) return reply(classDetail);
    if (suffix === "/ontology/search") {
      const type = url.searchParams.get("entity_types");
      const results = type === "property"
        ? [{ iri: `${ns}hasGuide`, label: "has guide", entity_type: "property", property_kind: "object" }]
        : type === "individual"
          ? [{ iri: `${ns}alice`, label: "Alice", entity_type: "individual" }]
          : [{ iri: `${ns}Person`, label: "Person", entity_type: "class" }];
      return reply({ results, total: results.length });
    }
    if (suffix === "/suggestions/capabilities") return reply({
      tier: "reviewer", can_suggest: true, can_mint_entities: true, promotion_threshold: 5,
      accepted_count: 5, auto_accept_enabled: false, auto_accept_quiet_days: 7, verification_required: false,
    });
    if (suffix === "/suggestions/pending" || suffix === "/pull-requests") return reply({ items: [], total: 0 });
    if (suffix === "/lint/issues") return reply({ items: [], total: 0 });
    if (suffix === "/lint/status") return reply({ project_id: projectId, status: "complete", total_issues: 0, error_count: 0, warning_count: 0, info_count: 0, last_run: null });
    if (suffix === "/normalization/status") return reply({ needs_normalization: false, checking: false, last_run: null });
    // An unconfigured project: the API contract allows a null remote-sync config.
    if (suffix === "/remote-sync") return reply(null);
    // Standard-mode class detail reads, returned empty for the synthetic entity.
    const entityRead = suffix.match(/^\/(?:entities|analytics\/entity)\/([^/]+)\/(references|similar|history)$/);
    if (entityRead) {
      const entityIri = decodeURIComponent(entityRead[1]);
      if (entityRead[2] === "references") return reply({ target_iri: entityIri, total: 0, groups: [] });
      if (entityRead[2] === "similar") return reply([]);
      return reply({ entity_iri: entityIri, events: [], total: 0 });
    }
    if (suffix === "/llm/status") return reply({ configured: false, budget_exhausted: false, monthly_spent_usd: 0, monthly_budget_usd: null });
    if (suffix === "/translation/config") return reply({ language_tags: [], provisional_gate: false });
    if (suffix === "/translation/entity-state") return reply({ entity_iri: url.searchParams.get("entity_iri"), branch: "main", items: [] });
    if (url.pathname === "/api/v1/translation/palette") return reply([]);
    if (url.pathname === "/api/v1/pr-party/me") return reply({ is_reviewer: false, degraded: false });
    unexpected.push(url.pathname);
    return route.fulfill({ status: 404, json: { detail: "Unmapped synthetic request" } });
  });

  // Serve Monaco's installed assets locally through its existing CDN request
  // boundary, so full-source proof does not require an outside service.
  const monacoRoot = path.resolve("node_modules/monaco-editor/min/vs");
  await context.route("https://cdn.jsdelivr.net/npm/monaco-editor@*/min/vs/**", async route => {
    const relative = new URL(route.request().url()).pathname.split("/min/vs/")[1];
    const filename = path.resolve(monacoRoot, relative);
    if (!filename.startsWith(monacoRoot + path.sep)) return route.abort();
    const contentType = filename.endsWith(".css") ? "text/css" : filename.endsWith(".ttf") ? "font/ttf" : "text/javascript";
    await route.fulfill({ body: await readFile(filename), contentType });
  });
  return { writes, unexpected };
}

export function entity(page: Page, localName: string) {
  return page.locator(`[role="treeitem"][data-iri="${ns}${localName}"]`);
}

export async function choosePreview(page: Page) {
  const detail = page.getByRole("tab", { name: "Detail", exact: true });
  await detail.focus();
  await page.keyboard.press("ArrowRight");
  const tab = page.getByRole("tab", { name: "Entity source", exact: true });
  await expect(tab).toBeFocused();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toHaveCSS("outline-style", "solid");
}
