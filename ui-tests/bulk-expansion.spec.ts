import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { GeneratedSuggestion, GenerateSuggestionsRequest } from "../lib/api/generation";
import { project as demoProject } from "./fixtures/demo-polish";

const project = { ...demoProject, id: "bulk-expansion", name: "Contract vocabulary", user_role: "editor" };
const prefix = `/api/v1/projects/${project.id}`;
const ns = "https://example.org/onto#";
const parent = `${ns}Agreement`;
const children = [
  { iri: `${ns}ServiceAgreement`, label: "Service agreement", child_count: 0 },
  { iri: `${ns}Lease`, label: "Lease", child_count: 0 },
  { iri: `${ns}License`, label: "License", child_count: 0 },
];
const proposals: GeneratedSuggestion[] = [
  { name: "MaintenanceAgreement", label: "Maintenance agreement", definition: "An agreement for the upkeep of property or equipment." },
  { name: "SupportAgreement", label: "Support agreement", definition: "An agreement to provide technical support." },
].map(({ name, label, definition }) => ({
  iri: ns + name, label, definition, confidence: 0.95, provenance: "llm-proposed",
  model: "fixture-model", suggestion_type: "children", validation_errors: [],
  duplicate_verdict: "pass", duplicate_candidates: [],
}));
const reason = "You've reached today's AI request limit for your role. Try again tomorrow.";
const menuItem = "Suggest subclasses for each subclass…";

for (const mode of ["Standard", "Developer"] as const) {
  test(`${mode} editor runs and reviews a metered bulk expansion`, async ({ page, baseURL }) => {
    const requests: GenerateSuggestionsRequest[] = [];
    const saveRequests: unknown[] = [];
    let finishRefusal!: () => void;
    const refusalReady = new Promise<void>((resolve) => { finishRefusal = resolve; });
    const reads: Record<string, unknown> = {
      [prefix]: project,
      [`${prefix}/ontology/tree`]: { nodes: [{ iri: parent, label: "Agreement", child_count: 3 }], total_classes: 4 },
      [`${prefix}/ontology/tree/${encodeURIComponent(parent)}/children`]: { nodes: children, total_classes: 4 },
      [`${prefix}/suggestions/capabilities`]: { tier: "editor", can_mint_entities: true, accepted_count: 0, promotion_threshold: 3 },
      [`${prefix}/pull-requests`]: { items: [], total: 0 },
      [`${prefix}/lint/status`]: null,
      [`${prefix}/llm/status`]: { configured: true, budget_exhausted: false, daily_remaining: 500, monthly_spent_usd: 0, monthly_budget_usd: null },
      [`${prefix}/suggestions/pending`]: { items: [] },
      [`${prefix}/branches`]: { items: [{ name: "main", is_current: true }], current_branch: "main", default_branch: "main" },
      [`${prefix}/normalization/status`]: { needs_normalization: false },
      [`${prefix}/remote-sync`]: { enabled: false },
      [`${prefix}/translation/config`]: { enabled: false, source_language: "en", language_tags: [] },
      [`${prefix}/translation/palette`]: { languages: [] },
      [`${prefix}/translation/state`]: { items: [] },
      [`${prefix}/lint/issues`]: { items: [], total: 0 },
      [`${prefix}/ontology/cross-references`]: { items: [], total: 0 },
    };
    let source = `@prefix : <${ns}> .\n`;
    let revision = "fixture-revision";

    await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL!).origin
      ? route.continue()
      : route.abort("blockedbyclient"));
    await page.routeWebSocket("**/*", (socket) => {
      const url = new URL(socket.url());
      if (url.host === new URL(baseURL!).host && url.pathname.startsWith("/_next/")) socket.connectToServer();
      else void socket.close();
    });
    await page.route("**/api/auth/session", (route) => route.fulfill({
      json: { user: { id: "editor" }, accessToken: "fixture", expires: "2099-01-01T00:00:00Z" },
    }));
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname === `${prefix}/llm/generate-suggestions` && request.method() === "POST") {
        requests.push(request.postDataJSON() as GenerateSuggestionsRequest);
        if (requests.length === 1) return route.fulfill({
          json: { batch_id: "fixture-batch", suggestions: proposals, input_tokens: 40, output_tokens: 80 },
        });
        await refusalReady;
        return route.fulfill({ status: 429, json: { detail: { message: "Daily LLM call limit reached for your role (editor). Try again tomorrow." } } });
      }
      if (pathname === `${prefix}/revisions/file`) {
        return route.fulfill({ json: { content: source, revision, filename: "ontology.ttl" } });
      }
      if (pathname === `${prefix}/source` && request.method() === "PUT") {
        const body = request.postDataJSON() as { content: string };
        saveRequests.push(body);
        source = body.content;
        revision = `fixture-revision-${saveRequests.length}`;
        return route.fulfill({ json: { commit_hash: revision } });
      }
      if (request.method() === "GET" && Object.hasOwn(reads, pathname)) return route.fulfill({ json: reads[pathname] });
      return route.fulfill({ status: 404, json: { detail: "No synthetic response for this endpoint." } });
    });

    try {
      await page.goto(`/projects/${project.id}/editor`);
      if (mode === "Developer") {
        await page.getByRole("button", { name: "Developer" }).click();
      }
      const tree = page.getByRole("tree", { name: "Ontology class hierarchy" });
      const root = tree.getByRole("treeitem", { name: /^Agreement\b/ });
      await expect(root).toBeVisible();
      const menu = page.getByRole("menu");
      const bulk = menu.getByRole("menuitem", { name: menuItem });

      await root.click({ button: "right" });
      await expect(menu.getByText("Expand this class in the tree to choose its subclasses.")).toBeVisible();
      await expect(bulk).toBeDisabled();
      await page.keyboard.press("Escape");

      await tree.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await expect(tree.getByRole("treeitem", { name: /^Service agreement\b/ })).toBeVisible();
      await page.keyboard.press("Shift+F10");
      await expect(bulk).toBeEnabled();
      await bulk.focus();
      await page.keyboard.press("Enter");

      const dialog = page.getByRole("dialog", { name: "Suggest subclasses for each subclass" });
      await expect(dialog.getByText("This makes 3 AI requests, one per class, counted against your daily limit and the project budget.")).toBeVisible();
      if (mode === "Standard") {
        await dialog.screenshot({ path: join(homedir(), "ok-u7-bulk-dialog.png"), animations: "disabled" });
      }
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(root).toBeFocused();
      expect(requests).toEqual([]);

      await root.click({ button: "right" });
      await bulk.click();
      await dialog.getByLabel("Suggestions per class").selectOption("3");
      await dialog.getByRole("button", { name: "Generate for 3 classes" }).click();
      const review = page.getByRole("region", { name: "Bulk expansion review" });
      await expect(review.getByRole("heading")).toBeFocused();
      await expect(review.getByRole("button", { name: /Lease.*Generating/ })).toBeVisible();
      await expect(review.getByRole("button", { name: /License.*Waiting/ })).toBeVisible();
      await expect(review.getByText("1 of 3 classes done, 0 failed")).toBeVisible();
      await expect(review.getByRole("button", { name: /Accept all eligible/ })).toHaveCount(0);
      await review.getByRole("button", { name: /Service agreement.*Done/ }).click();
      await expect(review.getByText(proposals[0].definition!)).toBeVisible();
      if (mode === "Standard") {
        await review.screenshot({ path: join(homedir(), "ok-u7-bulk-review-light.png"), animations: "disabled" });
      }

      finishRefusal();
      await expect(review.getByText(`Queue stopped. ${reason}`)).toBeVisible();
      await expect(review.getByRole("button", { name: /License.*Skipped/ })).toBeVisible();
      await expect(review.getByText("1 of 3 classes done, 1 failed, 1 skipped")).toBeVisible();
      await expect(review.getByRole("button", { name: "Stop" })).toHaveCount(0);
      expect(requests).toEqual(children.slice(0, 2).map(({ iri }) => ({
        class_iri: iri, branch: "main", suggestion_type: "children", batch_size: 3,
      })));
      expect(saveRequests).toHaveLength(0);

      if (mode === "Standard") {
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator("html")).toHaveClass(/dark/);
        await review.screenshot({ path: join(homedir(), "ok-u7-bulk-review-dark.png"), animations: "disabled" });
      }
      await review.getByRole("button", { name: "Accept all eligible (2)" }).click();
      const accept = page.getByRole("dialog", { name: "Accept all eligible suggestions" });
      await expect(accept.getByText(/2 classes under Service agreement/)).toBeVisible();
      expect(saveRequests).toHaveLength(0);
      await accept.getByRole("button", { name: "Accept 2 classes" }).click();
      await expect(page.getByText(/2 accepted, 0 skipped/)).toBeVisible();
      expect(saveRequests).toHaveLength(2);
      expect(source).toContain(`rdfs:subClassOf <${children[0].iri}>`);
      expect(source).toContain(proposals[0].definition);
      expect(source).toContain(proposals[1].definition);
    } finally {
      finishRefusal();
    }
  });
}
