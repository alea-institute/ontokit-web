import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { choosePreview, entity, filePath, installFixtures, projectId } from "./ow4-fixtures";

// Committed browser evidence for ow-4 at the merge gate's desktop and mobile
// viewports. Synthetic API/session fixtures only; no write reaches the API.
const evidenceDir = "docs/plans/evidence/ow-4";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`entity source preview evidence (${viewport.name} ${viewport.width}x${viewport.height})`, async ({ page, context }) => {
    const { writes, unexpected } = await installFixtures(context);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/projects/${projectId}/editor`);

    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await entity(page, "hasGuide").click();
    await choosePreview(page);
    const excerpts = page.getByLabel("Source excerpts");
    await expect(excerpts).toContainText(`# File: ${filePath}, line 8`);
    await expect(excerpts).toContainText(":hasGuide a owl:ObjectProperty");
    const panel = page.getByRole("region", { name: "Entity source preview" });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy snippet", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open full source", exact: true })).toBeVisible();

    await mkdir(evidenceDir, { recursive: true });
    // Finished transitions keep theme-colour fades out of the evidence.
    await page.screenshot({ path: `${evidenceDir}/entity-source-preview-${viewport.name}.png`, animations: "disabled" });
    if (viewport.name === "desktop") {
      await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.screenshot({ path: `${evidenceDir}/entity-source-preview-desktop-dark.png`, animations: "disabled" });
    }

    expect(writes, "Preview must not write to the API").toEqual([]);
    expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
  });
}
