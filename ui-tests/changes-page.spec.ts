import { homedir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { changesWithTransient, temporaryClause } from "../__tests__/components/changes/changeFixtures";

async function screenshot(page: Page, state: "light" | "dark" | "expanded" | "transient") {
  const prefix = process.env.CHANGES_SCREENSHOT_PREFIX || "ontokit-changes";
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({
    path: join(homedir(), `${prefix}-${state}.png`),
    fullPage: true,
    animations: "disabled",
    style: "nextjs-portal { display: none; }",
  });
}

test("shows Changes in light and dark and expands an AI-filtered row", async ({ page, baseURL }) => {
  const projectPath = "/api/v1/projects/project-1";
  const feedPath = `${projectPath}/analytics/changes`;
  const seen: URLSearchParams[] = [];

  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === baseURL) await route.continue();
    else await route.abort("blockedbyclient");
  });
  await page.route("**/api/v1/**", async (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.abort("blockedbyclient");
    if (pathname === projectPath) {
      return route.fulfill({ json: { id: "project-1", name: "Example ontology", is_public: true } });
    }
    if (pathname === feedPath) {
      seen.push(searchParams);
      const aiOnly = searchParams.get("origin") === "ai";
      return route.fulfill({ json: aiOnly ? {
        ...changesWithTransient,
        summary: {
          total_events: 3,
          entities_changed: 1,
          by_net_change: { added: 0, modified: 0, removed: 0, transient: 1 },
          by_origin: { human: 2, ai: 1, ai_edited: 0, system: 0 },
          authors: [
            { ...temporaryClause.authors[0], event_count: 2 },
            { ...temporaryClause.authors[1], event_count: 1 },
          ],
        },
        items: [temporaryClause],
      } : changesWithTransient });
    }
    if (pathname === "/api/v1/projects") return route.fulfill({ json: { items: [], total: 0 } });
    return route.abort("blockedbyclient");
  });

  await page.goto("/projects/project-1");
  const entry = page.getByRole("link", { name: "Changes", exact: true });
  await expect(entry).toBeVisible();
  await expect(entry).toHaveAttribute("href", "/projects/project-1/changes");
  await entry.press("Enter");
  await expect(page).toHaveURL(/\/projects\/project-1\/changes$/, { timeout: 45_000 });

  await expect(page.getByRole("heading", { name: "Changes", level: 1 })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Last 24 hours" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "7 days" })).toBeChecked();
  await expect(page.getByRole("link", { name: "has renewal" })).toBeVisible();
  await expect(page.getByText("LegacyTenant")).toBeVisible();
  await expect(page.getByRole("link", { name: "LegacyTenant" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await screenshot(page, "light");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

  const transient = page.getByRole("button", { name: "1 Added, then removed", exact: true });
  await transient.press("Enter");
  await expect(page).toHaveURL(/\bnet_change=transient\b/);
  await expect(page.getByRole("link", { name: "Lease" })).toHaveCount(0);
  const row = page.getByRole("listitem").filter({ hasText: "Trial clause" });
  await expect(row.getByText("Added, then removed")).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  const help = page.getByRole("button", { name: "How changes are tracked" });
  await help.press("Enter");
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/renaming an entity's IRI shows as one removal plus one addition/i)).toBeVisible();
  const desktopViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row.getByText("Added, then removed")).toBeVisible();
  await screenshot(page, "transient");
  await page.setViewportSize(desktopViewport);
  await help.press("Enter");
  await transient.press("Enter");
  await expect(page.getByRole("link", { name: "Lease" })).toBeVisible();

  const theme = page.getByRole("group", { name: "Theme" });
  await theme.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await screenshot(page, "dark");

  const ai = page.getByRole("group", { name: "Origin", exact: true })
    .getByRole("button", { name: "AI", exact: true });
  await ai.press("Enter");
  await expect(ai).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\borigin=ai\b/);
  await expect(page.getByRole("region", { name: "Change summary" })).toContainText("1 entity changed");
  await expect(page.getByText("LegacyTenant")).toHaveCount(0);
  expect(seen.some((params) => params.get("days") === "7" && params.get("origin") === "ai")).toBe(true);

  const details = page.getByRole("button", { name: "Details for Trial clause" });
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await details.press("Enter");
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Label changed")).toBeVisible();
  await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
  await expect(page.getByText("example-model")).toBeVisible();
  await screenshot(page, "expanded");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});
