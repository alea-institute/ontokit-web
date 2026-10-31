import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { choosePreview, entity, filePath, installFixtures, projectId } from "./ow4-fixtures";

test("entity preview follows selections, preserves source edits and captures light/dark page evidence", async ({ page, context }) => {
  const { writes, unexpected } = await installFixtures(context);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/projects/${projectId}/editor`);
  await entity(page, "Person").click();
  await expect(page.getByRole("tab", { name: "Detail", exact: true })).toHaveAttribute("aria-selected", "true");
  await choosePreview(page);
  const excerpts = page.getByLabel("Source excerpts");
  await expect(excerpts).toContainText(":Person a owl:Class");
  await expect(entity(page, "Person")).toBeVisible();

  await page.getByRole("button", { name: "Properties", exact: true }).click();
  await expect(page.getByText("Select an entity in the tree to inspect its source.")).toBeVisible();
  await entity(page, "hasGuide").click();
  await expect(excerpts).toContainText(`# File: ${filePath}, line 8`);
  await expect(excerpts).toContainText(":hasGuide a owl:ObjectProperty");
  await expect(excerpts).not.toContainText(":Person a owl:Class");
  await page.getByRole("button", { name: "Copy snippet", exact: true }).click();
  await expect(page.getByText("Snippet copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await excerpts.textContent());

  await page.getByRole("button", { name: "Individuals", exact: true }).click();
  await entity(page, "alice").click();
  await expect(excerpts).toContainText(":alice a owl:NamedIndividual, :Person");
  await expect(excerpts).not.toContainText(":hasGuide a owl:ObjectProperty");
  await expect(entity(page, "alice")).toBeVisible();
  await mkdir("docs/plans/evidence", { recursive: true });
  await page.screenshot({ path: "docs/plans/evidence/2026-10-26-ow-4-entity-source-preview.png", fullPage: true, animations: "disabled" });
  await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: "docs/plans/evidence/2026-10-26-ow-4-entity-source-preview-dark.png", fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "Open full source", exact: true }).click();
  const editor = page.locator(".monaco-editor textarea").first();
  await expect(editor).toBeVisible();
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText('\n:alice rdfs:comment "Unsaved source note" .\n');
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(excerpts).toContainText('rdfs:comment "Unsaved source note"');
  await expect(page.getByRole("tab", { name: "Entity source", exact: true })).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 768, height: 900 });
  const panel = page.getByRole("region", { name: "Entity source preview" });
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(768);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Open full source", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Existing entry points still render their real surfaces.
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("Unsaved source note");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("button", { name: "Classes", exact: true }).click();
  await entity(page, "Person").click();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("group", { name: "Editor mode", exact: true }).getByRole("button", { name: "Standard", exact: true }).click();
  await expect(entity(page, "Person")).toBeVisible();
  expect(writes, "Preview and unsaved source navigation must not write to the API").toEqual([]);
  expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
});
