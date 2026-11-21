import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { project as demoProject } from "./fixtures/demo-polish";

const project = { ...demoProject, id: "recent-changes", name: "Agreement vocabulary" };
const prefix = `/api/v1/projects/${project.id}`;
const branch = "review/contracts";
const ns = "https://example.org/onto#";
const classes = [
  { iri: ns + "Amendment", label: "Amendment", child_count: 0 },
  { iri: ns + "Lease", label: "Lease", child_count: 0 },
  { iri: ns + "Renewal", label: "Renewal", child_count: 0 },
];
const lease = classes[1];
const createdAt = "2026-11-19T10:00:00Z";
const event = {
  project_id: project.id,
  branch,
  entity_iri: lease.iri,
  entity_type: "class",
  user_id: "reviewer",
  user_name: "Project reviewer",
  changed_fields: ["labels"],
  created_at: createdAt,
};
const reads: Record<string, unknown> = {
  [prefix]: project,
  [`${prefix}/ontology/tree`]: { nodes: classes, total_classes: classes.length },
  [`${prefix}/ontology/classes/${encodeURIComponent(lease.iri)}`]: {
    iri: lease.iri, labels: [{ value: lease.label, lang: "en" }], comments: [],
    parent_iris: [], parent_labels: {}, equivalent_iris: [], disjoint_iris: [],
    child_count: 0, instance_count: 0, deprecated: false, is_defined: true, annotations: [],
  },
  [`${prefix}/analytics/entity/${encodeURIComponent(lease.iri)}/history`]: {
    total: 2,
    events: [
      { ...event, id: "update", event_type: "update", origin: "human" },
      { ...event, id: "create", event_type: "create", origin: "ai_edited", origin_model: "example-model" },
    ],
  },
  [`${prefix}/branches`]: {
    items: [{ name: branch, is_current: true, is_default: true, commit_hash: "example-revision" }],
    current_branch: branch, default_branch: branch,
  },
  [`${prefix}/suggestions/capabilities`]: { tier: "anonymous", can_mint_entities: false, accepted_count: 0, promotion_threshold: 3 },
  [`${prefix}/pull-requests`]: { items: [], total: 0 },
  [`${prefix}/lint/status`]: null,
  [`${prefix}/llm/status`]: { configured: false },
  [`${prefix}/suggestions/pending`]: { items: [] },
  [`${prefix}/normalization/status`]: { needs_normalization: false },
  [`${prefix}/revisions/file`]: { content: `@prefix : <${ns}> .`, revision: "example-revision", filename: "ontology.ttl" },
  [`${prefix}/remote-sync`]: { enabled: false },
  [`${prefix}/translation/config`]: { enabled: false, source_language: "en", language_tags: [] },
  [`${prefix}/translation/palette`]: { languages: [] },
  [`${prefix}/translation/state`]: { items: [] },
  [`${prefix}/lint/issues`]: { items: [], total: 0 },
  [`${prefix}/entities/${encodeURIComponent(lease.iri)}/references`]: { groups: [], total: 0 },
};

test("marks changed classes in both editor layouts and shows history provenance", async ({ page, baseURL }) => {
  const requests: URLSearchParams[] = [];
  const changedEntities = `${prefix}/analytics/changed-entities`;
  await page.route("**/*", (route) => new URL(route.request().url()).origin === baseURL
    ? route.continue()
    : route.abort("blockedbyclient"));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/v1/**", async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.abort("blockedbyclient");
    if (pathname === changedEntities) {
      requests.push(searchParams);
      return route.fulfill({
        json: {
          truncated: false,
          items: [
            { entity_iri: classes[0].iri, net_change: "added", origins: ["human"], last_changed_at: createdAt },
            { entity_iri: lease.iri, net_change: "modified", origins: ["human"], last_changed_at: createdAt },
            { entity_iri: classes[2].iri, net_change: "added", origins: ["ai"], last_changed_at: createdAt },
          ],
        },
      });
    }
    if (Object.hasOwn(reads, pathname)) return route.fulfill({ json: reads[pathname] });
    return route.fulfill({ status: 404, json: { detail: "No synthetic response for this endpoint." } });
  });

  const editor = `/projects/${project.id}/editor?${new URLSearchParams({ branch })}`;
  await page.goto(editor);
  const tree = page.getByRole("tree", { name: "Ontology class hierarchy" });
  await expect(tree.getByRole("treeitem", { name: "Amendment", exact: true })).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Show recent changes" });
  const link = page.getByRole("link", { name: "View all changes" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(requests).toHaveLength(0);
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).toHaveAttribute("href", `/projects/${project.id}/changes?branch=review%2Fcontracts`);
  await expect(tree.getByRole("treeitem", { name: "Amendment, changed in the last 7 days, added" }).getByRole("img", { name: "Added" })).toBeVisible();
  const leaseRow = tree.getByRole("treeitem", { name: "Lease, changed in the last 7 days, modified" });
  await expect(leaseRow.getByRole("img", { name: "Modified" })).toBeVisible();
  const aiMark = tree.getByRole("treeitem", { name: "Renewal, changed in the last 7 days, added from an AI suggestion" }).getByRole("img", { name: "added from an AI suggestion" });
  await expect(aiMark).toBeVisible();
  expect(requests.map((request) => Object.fromEntries(request))).toEqual([{ days: "7", branch }]);

  const screenshot = async (name: string) => {
    await page.screenshot({
      path: join(homedir(), name),
      animations: "disabled",
      style: "nextjs-portal { display: none; }",
    });
  };
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await screenshot("ok-u6-tree-markers-light.png");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await screenshot("ok-u6-tree-markers-dark.png");
  await aiMark.hover();
  await expect(page.getByRole("tooltip")).toHaveText("changed in the last 7 days, added from an AI suggestion");

  await leaseRow.click();
  const history = page.getByRole("button", { name: "History (2)" });
  await expect(history).toHaveAttribute("aria-expanded", "false");
  await history.press("Enter");
  await expect(page.getByText("Human", { exact: true })).toBeVisible();
  await expect(page.getByText("AI edited", { exact: true })).toBeVisible();
  await expect(page.getByText("example-model", { exact: true })).toBeVisible();
  await screenshot("ok-u6-history-origin.png");

  await page.evaluate(() => {
    localStorage.setItem("ontokit-editor-preferences", JSON.stringify({ state: { editorMode: "developer" }, version: 1 }));
  });
  await page.goto(editor);
  await expect(page.getByRole("button", { name: "Source", exact: true })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(aiMark).toBeVisible();
  await link.press("Enter");
  await expect(page).toHaveURL(`/projects/${project.id}/changes?branch=review%2Fcontracts`);
});
