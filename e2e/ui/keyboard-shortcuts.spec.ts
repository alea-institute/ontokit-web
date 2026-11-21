import { test, expect } from "@playwright/test";
import { installFixtures, projectId } from "./ow4-fixtures";

test("authorized editor keeps one keyboard-accessible help opener across breakpoints", async ({ page, context }) => {
  const { writes, unexpected } = await installFixtures(context);
  await page.goto(`/projects/${projectId}/editor`);
  const opener = page.getByRole("button", { name: /Keyboard shortcuts/ });
  const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });

  for (const width of [1440, 390, 767, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(opener).toHaveCount(1);
    await expect(opener).toHaveAccessibleName("Keyboard shortcuts");
    await expect(opener).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Add new entity", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }

  expect(writes, "Help must not write to the API").toEqual([]);
  expect(unexpected, "Every API read has an explicit synthetic contract").toEqual([]);
});
