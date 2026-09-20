import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { signIn } from "./auth";
import { loadRun, type RunConfig } from "./run";
import { projectsPath } from "./projects";

async function recordEditorFailure(page: Page, run: RunConfig) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inspection: unknown;
  try {
    inspection = await Promise.race([
      page.evaluate(() => ({
        // No input values, session data, headers, query strings, or page dumps.
        controls: Array.from(document.querySelectorAll('main button, [role="dialog"] button'))
          .filter(element => element instanceof HTMLElement && element.checkVisibility())
          .slice(0, 40).map(element => ({text: element.textContent?.slice(0, 150), disabled: element.hasAttribute("disabled")})),
        alerts: Array.from(document.querySelectorAll('main [role="alert"], [role="dialog"] [role="alert"]'))
          .slice(0, 8).map(element => element.textContent?.slice(0, 300)),
        monacoEditors: document.querySelectorAll(".monaco-editor").length,
        treeItems: document.querySelectorAll('[role="treeitem"]').length,
      })),
      new Promise(resolve => { timer = setTimeout(() => resolve({inspectionUnavailable: true}), 2000); }),
    ]);
  } catch { inspection = {inspectionUnavailable: true}; }
  finally { if (timer) clearTimeout(timer); }
  const file = await fs.open(path.join(run.dir, "private.log"), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077)) throw new Error("Unsafe private browser diagnostic log");
    await file.write(`\nPrivate browser workflow failure: ${JSON.stringify({pathname: new URL(page.url()).pathname.slice(0, 1024), inspection})}\n`);
  } finally { await file.close(); }
}

interface BrowserJourney {
  page: Page;
  api: APIRequestContext;
  trackProject(id: string): void;
}
export const test = base.extend<{ run: RunConfig; journey: BrowserJourney }>({
  run: async ({}, provide) => { await provide(loadRun()); },
  journey: async ({browser, playwright, run}, provide, testInfo) => {
    // Explicitly empty: never consume U2's persisted owner storage state.
    const context = await browser.newContext({storageState: {cookies: [], origins: []}});
    const page = await context.newPage();
    const ids = new Set<string>();
    let api: APIRequestContext | undefined;
    try {
      const session = await signIn(page, run, "owner");
      api = await playwright.request.newContext({baseURL: run.api, extraHTTPHeaders: {Authorization: `Bearer ${session.accessToken}`}});
      await provide({page, api, trackProject(id) {
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        ids.add(id);
      }});
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        try { await recordEditorFailure(page, run); } catch { /* Preserve the original failure; outer cleanup remains mandatory. */ }
      }
      const failures: string[] = [];
      try {
        for (const id of ids) {
          try {
            const response = await api!.delete(`${projectsPath}/${id}`);
            if (![204, 404].includes(response.status())) failures.push(`${id}: ${response.status()}`);
          } catch { failures.push(`${id}: request failed`); }
        }
      } finally {
        try { await api?.dispose(); } finally { await context.close(); }
      }
      expect(failures, "Exact-ID browser project teardown").toEqual([]);
    }
  },
});

export function branchButton(page: Page, branch: string) {
  // BranchSelector renders the name in its own span beside the revision code.
  // Match that exact child text, independent of accessible-name whitespace.
  return page.getByRole("button").filter({has: page.getByText(branch, {exact: true})});
}

export async function selectBranch(page: Page, current: string, target: string) {
  await branchButton(page, current).click();
  await page.getByRole("option").filter({has: page.getByText(target, {exact: true})}).click();
  await expect(branchButton(page, target)).toBeVisible();
  await expect(page).toHaveURL(url => url.searchParams.get("branch") === target);
}

export async function showSource(page: Page) {
  await page.getByRole("group", {name: "Editor mode"}).getByRole("button", {name: "Developer", exact: true}).click();
  // The selected class also has a Source action. DeveloperEditorLayout's
  // Tree/Source/Graph sibling buttons select the full source editor instead.
  const viewTabs = page.getByRole("button", {name: "Tree", exact: true}).locator("..");
  await viewTabs.getByRole("button", {name: "Source", exact: true}).click();
  await expect(page.locator(".monaco-editor textarea.inputarea")).toBeVisible({timeout: 45_000});
}

export async function findSourceText(page: Page, text: string) {
  const editor = page.locator(".monaco-editor");
  // Monaco's textarea is covered by its rendered lines. Click the same text
  // surface a user would, then verify Monaco transferred keyboard focus.
  await editor.locator(".view-lines .view-line").first().click();
  await expect(editor.locator("textarea.inputarea")).toBeFocused();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+f");
  await editor.getByRole("textbox", {name: "Find", exact: true}).fill(text);
  await page.keyboard.press("Enter");
  // Monaco reveals the selected match, including lines outside its viewport.
  await expect(editor.locator(".view-lines")).toContainText(text);
  await page.keyboard.press("Escape");
}

export async function replaceSourceLabel(page: Page, before: string, after: string) {
  await findSourceText(page, before);
  // Typing replaces the Find selection through Monaco's real keyboard handler.
  await page.keyboard.insertText(after);
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(after);
  await expect(page.getByRole("button", {name: "Save", exact: true})).toBeEnabled();
}

export { expect };
