import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installFixtures } from "./ow4-fixtures";

const evidenceDir = process.env.OW4_UI_EVIDENCE_DIR || "docs/plans/evidence/ow-16";

test("Scalar renders the local API schema and keeps its operation readable in both themes", async ({ page, context }) => {
  const { writes, unexpected } = await installFixtures(context);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let schemaReads = 0;
  await context.route("**/openapi.json", async route => {
    expect(route.request().method()).toBe("GET");
    schemaReads += 1;
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        openapi: "3.1.0",
        info: { title: "OntoKit fixture API", version: "1.0.0" },
        paths: {
          "/fixture-ontologies": {
            get: {
              operationId: "listFixtureOntologies",
              summary: "List fixture ontologies",
              description: "Read the public ontology catalog.",
              responses: { "200": { description: "Public ontology names", content: {
                "application/json": { schema: { type: "array", items: { type: "string" } } },
              } } },
            },
          },
        },
      },
    });
  });
  await page.goto("/api-docs");
  const operation = page.locator(".scalar-container").getByRole("heading", { name: "List fixture ontologies", exact: true });
  await expect(operation).toBeVisible();
  expect(schemaReads).toBeGreaterThan(0);
  await mkdir(evidenceDir, { recursive: true });
  for (const theme of ["Dark", "Light"] as const) {
    await page.getByRole("group", { name: "Theme", exact: true }).getByRole("button", { name: theme, exact: true }).click();
    await expect(page.locator("body")).toHaveClass(theme === "Dark" ? /dark-mode/ : /light-mode/);
    await operation.scrollIntoViewIfNeeded();
    await expect(operation).toBeVisible();
    await expect(page.locator(".scalar-container")).toContainText("Read the public ontology catalog.");
    await page.screenshot({ path: `${evidenceDir}/api-docs-${theme.toLowerCase()}.png`, animations: "disabled" });
  }
  expect(errors, "The actual Scalar bundle must mount without client exceptions").toEqual([]);
  expect(writes).toEqual([]);
  expect(unexpected).toEqual([]);
});
