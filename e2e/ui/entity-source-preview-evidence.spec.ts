import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { choosePreview, entity, filePath, installFixtures, projectId, source } from "./ow4-fixtures";

// Committed browser evidence for ow-12 at the merge gate's desktop and mobile
// viewports. Synthetic API/session fixtures only; no write reaches the API.
const evidenceDir = "docs/plans/evidence/ow-12";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`entity source preview evidence (${viewport.name} ${viewport.width}x${viewport.height})`, async ({ page, context }) => {
    const { writes, unexpected } = await installFixtures(context);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/projects/${projectId}/editor`);
    await expect(page).toHaveURL(url => url.pathname === `/projects/${projectId}/editor`);

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
    await page.screenshot({ path: `${evidenceDir}/editor-entity-source-preview-${viewport.name}.png`, animations: "disabled" });
    if (viewport.name === "desktop") {
      await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.screenshot({ path: `${evidenceDir}/editor-entity-source-preview-desktop-dark.png`, animations: "disabled" });
    }

    expect(writes, "Preview must not write to the API").toEqual([]);
    expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
  });
}

test("project viewer source preview evidence (desktop 1440x900) and read-only full source", async ({ page, context }) => {
  const { writes, unexpected } = await installFixtures(context);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${projectId}`);
  await expect(page).toHaveURL(url => url.pathname === `/projects/${projectId}`);

  await page.getByRole("button", { name: "Properties", exact: true }).click();
  await entity(page, "hasGuide").click();
  await choosePreview(page);
  const excerpts = page.getByLabel("Source excerpts");
  await expect(excerpts).toContainText(`# File: ${filePath}, line 8`);
  await expect(excerpts).toContainText(":hasGuide a owl:ObjectProperty");
  await expect(page.getByRole("region", { name: "Entity source preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy snippet", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open full source", exact: true })).toBeVisible();
  await expect(page).toHaveURL(url => url.pathname === `/projects/${projectId}`);

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/project-viewer-entity-source-preview-desktop.png`, animations: "disabled" });
  await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: `${evidenceDir}/project-viewer-entity-source-preview-desktop-dark.png`, animations: "disabled" });

  await page.getByRole("button", { name: "Copy snippet", exact: true }).click();
  await expect(page.getByText("Snippet copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await excerpts.textContent());

  await page.getByRole("button", { name: "Open full source", exact: true }).click();
  const editor = page.locator(".monaco-editor .view-lines");
  await expect(editor).toBeVisible();
  await expect(editor).toContainText(":hasGuide a owl:ObjectProperty");
  await editor.click();
  await page.keyboard.press("a");
  await expect(page.getByRole("paragraph").filter({ hasText: /^Cannot edit in read-only editor$/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+C");
  // Native full-editor copying may use platform clipboard line endings.
  await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n")).toBe(source);
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(excerpts).toContainText(`# File: ${filePath}, line 8`);
  await expect(page).toHaveURL(url => url.pathname === `/projects/${projectId}`);
  expect(writes, "Viewer preview and full-source navigation must not write to the API").toEqual([]);
  expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
});

// Geometry and action checks catch clipping that visibility alone misses.
for (const route of ["editor", "viewer"] as const) {
  for (const width of [390, 768]) {
    test(`${route} preview contains long lines and keeps actions reachable at ${width}px`, async ({ page, context }) => {
      const longSource = `${source}\n:hasGuide rdfs:comment "${"A long source statement. ".repeat(40)}" .\n`;
      const { writes, unexpected } = await installFixtures(context, longSource);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.setViewportSize({ width, height: 900 });
      const pathname = `/projects/${projectId}${route === "editor" ? "/editor" : ""}`;
      await page.goto(pathname);
      await page.getByRole("button", { name: "Properties", exact: true }).click();
      await entity(page, "hasGuide").click();
      await choosePreview(page);
      const excerpts = page.getByLabel("Source excerpts");
      await expect(excerpts).toContainText("A long source statement.");
      const panel = page.getByRole("region", { name: "Entity source preview" });
      const bounds = await panel.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.width).toBeGreaterThan(250);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // A long line scrolls within the snippet body, preserving exact text.
      expect(await excerpts.evaluate(el => {
        const scroller = el.parentElement!;
        scroller.scrollLeft = 100;
        return scroller.scrollWidth > scroller.clientWidth && scroller.scrollLeft > 0;
      })).toBe(true);

      const copy = page.getByRole("button", { name: "Copy snippet", exact: true });
      await page.keyboard.press("Tab");
      await expect(page.getByRole("tabpanel", { name: "Entity source", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(copy).toBeFocused();
      await expect(copy).toBeInViewport({ ratio: 1 });
      await copy.click();
      await expect(page.getByText("Snippet copied", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await excerpts.textContent());
      const fullSource = page.getByRole("button", { name: "Open full source", exact: true });
      await page.keyboard.press("Tab");
      await expect(fullSource).toBeFocused();
      await expect(fullSource).toBeInViewport({ ratio: 1 });
      await excerpts.evaluate(el => { el.parentElement!.scrollLeft = 0; });
      await page.evaluate(() => window.scrollTo(0, 0));
      await mkdir(evidenceDir, { recursive: true });
      await page.screenshot({ path: `${evidenceDir}/${route}-entity-source-preview-${width}.png`, fullPage: true, animations: "disabled" });
      await page.keyboard.press("Enter");
      await expect(page.locator(".monaco-editor .view-lines")).toContainText("A long source statement.");
      await page.getByRole("button", { name: "Tree", exact: true }).click();
      await expect(excerpts).toContainText("A long source statement.");
      await expect(page).toHaveURL(url => url.pathname === pathname);
      expect(writes, "Preview navigation must not write to the API").toEqual([]);
      expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
    });
  }
}
