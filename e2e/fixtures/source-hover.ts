import { createHash } from "node:crypto";
import { expect, type Page, type Response, type TestInfo } from "@playwright/test";

/** Keep the served bytes distinct from the version in the requested CDN URL. */
export function recordMonacoAssets(page: Page, substituted: boolean) {
  const responses: Response[] = [];
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.hostname === "cdn.jsdelivr.net"
      && url.pathname.includes("/monaco-editor@")
      && (url.pathname.endsWith("/vs/loader.js") || url.pathname.endsWith("/vs/editor/editor.main.js"))) {
      responses.push(response);
    }
  });
  return async (info: TestInfo) => {
    const assets = await Promise.all(responses.map(async response => ({
      url: response.url(), status: response.status(),
      sha256: createHash("sha256").update(await response.body()).digest("hex"),
    })));
    expect(assets.some(asset => asset.url.endsWith("/editor.main.js"))).toBe(true);
    expect(assets.every(asset => asset.status === 200)).toBe(true);
    await info.attach("monaco-served-assets", {
      body: JSON.stringify({ substituted, assets }, null, 2), contentType: "application/json",
    });
  };
}

/** Exercise Monaco's rendered hover through its ordinary find/keyboard actions. */
export async function expectClassIriHover(page: Page) {
  const editor = page.locator(".monaco-editor");
  await expect(editor.locator(".view-lines")).toBeVisible();
  await editor.locator(".view-lines").click();
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("ControlOrMeta+f");
  await editor.getByRole("textbox", { name: "Find", exact: true }).fill("owl:Class");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.press("ControlOrMeta+i");
  const hover = editor.locator(".monaco-hover").filter({ hasText: "Full IRI:" });
  await expect(hover).toBeVisible();
  await expect(hover).toContainText("http://www.w3.org/2002/07/owl#Class");
  return hover;
}
