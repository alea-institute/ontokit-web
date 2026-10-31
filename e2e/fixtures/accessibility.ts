import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** Scan settled, application-owned content, including portalled dialogs separately. */
export async function expectAccessible(page: Page, scope = "main") {
  await expect(page.locator(scope)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include(scope)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  // Raw node HTML can contain account data. Keep it out of reports and receipts.
  const summarize = (rules: typeof results.violations) => rules.map(({ id, impact, nodes }) => ({
    id, impact, nodes: nodes.length,
  }));
  console.log("rehearsal-accessibility", JSON.stringify({
    scope, violations: summarize(results.violations), incomplete: summarize(results.incomplete),
  }));
  expect(summarize(results.violations), `Accessibility violations in ${scope}`).toEqual([]);
}

/** Private capture only: inspect and copy these PNGs before the runner cleans up. */
export async function captureRehearsalState(region: Locator, info: TestInfo, name: string) {
  await expect(region).toBeVisible();
  await region.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
}
