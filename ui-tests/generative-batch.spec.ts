import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { GeneratedSuggestion, GenerateSuggestionsRequest } from "../lib/api/generation";
import { project as demoProject } from "./fixtures/demo-polish";

const project = { ...demoProject, id: "class-suggestions", name: "Contract vocabulary", user_role: "editor" };
const prefix = `/api/v1/projects/${project.id}`;
const ns = "https://example.org/onto#";
const parent = `${ns}Agreement`;
const selected = `${ns}ServiceAgreement`;
const peer = `${ns}Lease`;
const editor = `/projects/${project.id}/editor`;
const proposals: GeneratedSuggestion[] = [
  ["SupplyAgreement", "Supply agreement", "An agreement for the provision of goods."],
  ["LicenseAgreement", "License agreement", "An agreement granting permission to use an asset."],
  ["DistributionAgreement", "Distribution agreement", "An agreement for distributing goods through a third party."],
  ["MaintenanceAgreement", "Maintenance agreement", "An agreement for the upkeep of property or equipment."],
  ["LeaseAgreement", "Lease agreement", "An agreement granting temporary use of an asset."],
].map(([name, label, definition], index) => ({
  iri: ns + name, label, definition, confidence: 0.95, provenance: "llm-proposed",
  model: "fixture-model", suggestion_type: "siblings", validation_errors: [],
  duplicate_verdict: index === 4 ? "block" : "pass",
  duplicate_candidates: index === 4 ? [{ iri: peer, label: "Lease", score: 0.98 }] : [],
}));

test("reviews a synthetic batch requested from the class tree", async ({ page, baseURL }) => {
  const requests: GenerateSuggestionsRequest[] = [];
  const reads: Record<string, unknown> = {
    [prefix]: project,
    [`${prefix}/ontology/tree`]: { nodes: [{ iri: parent, label: "Agreement", child_count: 2 }], total_classes: 3 },
    [`${prefix}/ontology/tree/${encodeURIComponent(parent)}/children`]: {
      nodes: [{ iri: selected, label: "Service agreement", child_count: 0 }, { iri: peer, label: "Lease", child_count: 0 }],
      total_classes: 3,
    },
    [`${prefix}/ontology/classes/${encodeURIComponent(selected)}`]: {
      iri: selected, labels: [{ value: "Service agreement", lang: "en" }], comments: [],
      parent_iris: [parent], parent_labels: { [parent]: "Agreement" }, equivalent_iris: [],
      disjoint_iris: [], child_count: 0, instance_count: 0, deprecated: false, is_defined: true, annotations: [],
    },
    [`${prefix}/suggestions/capabilities`]: { tier: "editor", can_mint_entities: true, accepted_count: 0, promotion_threshold: 3 },
    [`${prefix}/pull-requests`]: { items: [], total: 0 },
    [`${prefix}/lint/status`]: null,
    [`${prefix}/llm/status`]: { configured: true, budget_exhausted: false, daily_remaining: 500, monthly_spent_usd: 0, monthly_budget_usd: null },
    [`${prefix}/suggestions/pending`]: { items: [] },
    [`${prefix}/branches`]: { items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" },
    [`${prefix}/normalization/status`]: { needs_normalization: false },
    [`${prefix}/revisions/file`]: { content: `@prefix : <${ns}> .`, revision: "fixture-revision", filename: "ontology.ttl" },
    [`${prefix}/remote-sync`]: { enabled: false },
    [`${prefix}/translation/config`]: { enabled: false, source_language: "en", language_tags: [] },
    [`${prefix}/translation/palette`]: { languages: [] },
    [`${prefix}/translation/state`]: { items: [] },
    [`${prefix}/lint/issues`]: { items: [], total: 0 },
    [`${prefix}/ontology/cross-references`]: { items: [], total: 0 },
  };

  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL!).origin
    ? route.continue()
    : route.abort("blockedbyclient"));
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: { user: { id: "editor" }, accessToken: "fixture", expires: "2099-01-01T00:00:00Z" },
  }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === `${prefix}/llm/generate-suggestions` && request.method() === "POST") {
      requests.push(request.postDataJSON() as GenerateSuggestionsRequest);
      return route.fulfill({
        json: { batch_id: "17cc4cec-84c7-4206-8530-6912221fac53", suggestions: proposals, input_tokens: 40, output_tokens: 80 },
      });
    }
    if (request.method() === "GET" && Object.hasOwn(reads, pathname)) {
      return route.fulfill({ json: reads[pathname] });
    }
    return route.fulfill({ status: 404, json: { detail: "No synthetic response for this endpoint." } });
  });

  await page.goto(editor);
  const tree = page.getByRole("tree", { name: "Ontology class hierarchy" });
  await expect(tree.getByRole("treeitem", { name: /^Agreement\b/ })).toBeVisible();
  await tree.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const row = tree.getByRole("treeitem", { name: /^Service agreement\b/ });
  await expect(row).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu");
  const siblings = menu.getByRole("menuitem", { name: "Suggest Siblings" });
  await expect(siblings).toBeEnabled();
  await expect(menu.getByRole("menuitem", { name: "Suggest Subclasses" })).toBeVisible();
  await page.screenshot({ path: join(homedir(), "ok-u5-tree-menu.png"), animations: "disabled" });
  await siblings.focus();
  await page.keyboard.press("Enter");

  const region = page.getByRole("region", { name: "Suggested siblings of Service agreement" });
  await expect(region.getByRole("heading")).toBeFocused();
  await expect(region.getByText("4 pending, 0 accepted, 0 rejected, 1 blocked as duplicate")).toBeVisible();
  await expect(region.getByText("fixture-model", { exact: true })).toBeVisible();
  for (const { definition } of proposals) {
    await expect(region.getByText(definition!, { exact: true })).toBeVisible();
  }
  await expect(region.getByRole("button", { name: "Accept all (4)" })).toBeEnabled();
  await expect(region.getByRole("button", { name: "Grounding" })).toHaveAttribute("aria-expanded", "false");
  expect(requests).toEqual([{ class_iri: selected, branch: "main", suggestion_type: "siblings", batch_size: 5 }]);
  const reviewPane = region.locator("xpath=..");
  await reviewPane.screenshot({ path: join(homedir(), "ok-u5-batch-light.png"), animations: "disabled" });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await region.getByRole("button", { name: "Grounding" }).click();
  await expect(region.getByText("Based on: label, definition, parents, and 1 existing sibling")).toBeVisible();
  await reviewPane.screenshot({ path: join(homedir(), "ok-u5-batch-dark.png"), animations: "disabled" });

  await region.getByRole("button", { name: "Accept all (4)" }).click();
  const accept = page.getByRole("dialog", { name: "Accept all suggestions" });
  await expect(accept.getByText(/4 classes under Agreement/)).toBeVisible();
  await accept.getByRole("button", { name: "Cancel" }).click();
  await region.getByRole("button", { name: "Reject all" }).click();
  await page.getByRole("dialog", { name: "Reject all suggestions" }).getByRole("button", { name: "Reject 5 suggestions" }).click();
  await expect(region.getByText("0 pending, 0 accepted, 5 rejected, 0 blocked as duplicate")).toBeVisible();
  await expect(tree).toBeFocused();
  expect(requests).toHaveLength(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(region.getByRole("heading")).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest siblings" })).toBeVisible();
  await expect(page.getByLabel("Batch size")).toHaveValue("5");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByTestId("mobile-back-to-tree").click();
  await expect(tree).toBeVisible();
  await row.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Suggest Siblings" }).click();
  await expect(region.getByRole("heading")).toBeFocused();
  await region.getByRole("button", { name: "Reject all" }).click();
  await page.getByRole("dialog", { name: "Reject all suggestions" }).getByRole("button", { name: "Reject 5 suggestions" }).click();
  await expect(tree).toBeFocused();
  expect(requests).toHaveLength(2);
});
