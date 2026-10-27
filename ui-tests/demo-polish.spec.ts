import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { bundleText } from "../__tests__/fixtures/hydrationBundle";
import { test, expect, project, projectList } from "./fixtures/demo-polish";

const evidence = "docs/plans/evidence/ow-5";
async function capture(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true, animations: "disabled", caret: "initial" });
}
async function openBundle(page: Page, text = bundleText()) {
  await page.getByLabel("Review bundle file", { exact: true }).setInputFiles({
    name: "synthetic-review.jsonl", mimeType: "application/x-ndjson", buffer: Buffer.from(text),
  });
  await expect(page.getByRole("tab", { name: "Rows", exact: true })).toBeVisible();
}
async function selectGermanRow(page: Page) {
  await page.getByRole("row").filter({ hasText: "translation:de-de" }).getByRole("button", { name: "Alpha", exact: true }).click();
}
async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("projects announce loading and recover from no matches with keyboard focus", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let requestStarted!: () => void;
  const started = new Promise<void>((resolve) => { requestStarted = resolve; });
  await page.route("**/api/v1/projects?**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.searchParams.has("is_demo")) return route.fallback();
    requestStarted();
    await held;
    await route.fulfill({ json: projectList(url.searchParams.get("search") || "") });
  });
  await page.goto("/");
  await started;
  await expect(page.getByRole("status").filter({ hasText: /Loading projects/ })).toBeVisible();
  await capture(page, "projects-loading");
  release();
  await expect(page.getByRole("link", { name: `Open project ${project.name}` })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search projects" });
  await search.fill("no matching project");
  const clear = page.getByRole("button", { name: "Clear search" });
  await expect(clear).toBeVisible();
  await capture(page, "projects-no-results");
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(page.getByRole("link", { name: `Open project ${project.name}` })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoPageOverflow(page);
});

test("editor help opens with physical Shift+Slash and restores opener focus", async ({ page }) => {
  await page.goto(`/projects/${project.id}/editor`);
  const trigger = page.getByRole("button", { name: /Keyboard shortcuts/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
  await expect(dialog).toBeVisible();
  await capture(page, "editor-shortcuts");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Shift+Slash");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Search entities", exact: true }).click();
  const search = page.getByPlaceholder("Search classes, properties, individuals...");
  await search.focus();
  await page.keyboard.press("Shift+Slash");
  await expect(search).toHaveValue("?");
  await expect(dialog).toBeHidden();
  await search.fill("");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("hydration preserves drafts through filters and restores corrections from IndexedDB", async ({ page }) => {
  const text = bundleText();
  await page.goto("/hydration-review");
  const picker = page.getByLabel("Review bundle file", { exact: true });
  await picker.focus();
  await expect(picker).toBeFocused();
  await capture(page, "hydration-entry");
  await openBundle(page, text);
  await selectGermanRow(page);
  const draft = page.getByLabel("Corrected value", { exact: true });
  const note = page.getByLabel("Note (optional)", { exact: true });
  await draft.fill("Alpha-DE geprüft");
  await note.fill("Synthetic local review");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("no-such-row");
  await expect(page.getByText(/outside.*filter/i)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(draft).toHaveValue("Alpha-DE geprüft");
  await expect(note).toHaveValue("Synthetic local review");
  await expect(page.getByRole("button", { name: "Next row", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "MINOR", exact: true }).click();
  await page.getByRole("button", { name: "Save correction", exact: true }).click();
  await expect(page.getByRole("region", { name: "Row detail" }).getByText("MINOR · corrected", { exact: true })).toBeVisible();
  await capture(page, "hydration-review-desktop");
  await page.reload();
  await openBundle(page, text);
  await expect(page.getByText("Restored 1 saved reviews for this bundle.")).toBeVisible();
  await selectGermanRow(page);
  await expect(draft).toHaveValue("Alpha-DE geprüft");
  await expect(note).toHaveValue("Synthetic local review");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export reviews", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const records = Buffer.concat(chunks).toString("utf8").trim().split("\n").map((line) => JSON.parse(line));
  expect(records[0]).toMatchObject({ schema: "folio-review-export/1", bundle_sha256: createHash("sha256").update(text).digest("hex") });
  expect(records[1]).toMatchObject({ row_id: "r-de", classification: "MINOR", disposition: "correct", corrected_value: "Alpha-DE geprüft", note: "Synthetic local review" });
  await page.getByRole("tab", { name: "Samples", exact: true }).click();
  await expect(page.getByText(/No samples/i)).toBeVisible();
});

test("hydration controls fit a narrow dark viewport with RTL and long IRIs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/hydration-review");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  const longText = bundleText().replaceAll("https://folio.example/A", `https://folio.example/${"long-concept-".repeat(30)}`);
  await openBundle(page, longText);
  await page.getByRole("row").filter({ hasText: "translation:he-il" }).getByRole("button", { name: "Alpha", exact: true }).click();
  await expect(page.getByLabel("Corrected value", { exact: true })).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("Corrected value", { exact: true })).toHaveValue("אלפא");
  await expectNoPageOverflow(page);
  const table = page.getByRole("table").first();
  expect(await table.evaluate((el) => {
    const parent = el.parentElement!;
    return parent.scrollWidth > parent.clientWidth && getComputedStyle(parent).overflowX === "auto";
  })).toBe(true);
  for (const control of await page.locator('main button, main select, main input:not([type="file"]), main textarea').all()) {
    if (await control.evaluate((el) => !!el.closest("table"))) continue;
    if (!await control.isVisible()) continue;
    const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await capture(page, "hydration-review-narrow-dark");
});
