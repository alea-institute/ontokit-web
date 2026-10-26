// Hosted-only helpers: no clock controls, stored bearer reuse or destructive cleanup.
import type {Page, APIResponse} from "@playwright/test";
import type {SuggestionsRunConfig, SuggestionPersona} from "./run";
import fs from "node:fs/promises";
import {tinyOntologyPath} from "./projects";
import {recordResource} from "../../scripts/e2e/hosted-resources.mjs";

export const isSessionCookie = (name: string) => /^(?:__Secure-|__Host-)?authjs\.session-token(?:\.\d+)?$/.test(name);
/** Five seconds beyond the genuine boundary, plus a minute to observe recovery. */
export function observationDeadline(boundary: number, budgetEnd: number, now = Date.now()): number | null {
  return Number.isFinite(boundary) && boundary > now && boundary + 65_000 <= budgetEnd ? boundary + 5_000 : null;
}
export function bearerClaims(token: string | undefined): {sub: string; iat: number; exp: number} {
  try {
    const value = JSON.parse(Buffer.from((token ?? "").split(".")[1], "base64url").toString());
    if (typeof value.sub === "string" && Number.isSafeInteger(value.iat) && Number.isSafeInteger(value.exp) && value.exp > value.iat) return {sub: value.sub, iat: value.iat, exp: value.exp};
  } catch { /* Fixed error: never include the credential. */ }
  throw new Error("HOSTED_BEARER_CLAIMS");
}
export interface HostedSession {user?: {id?: string; name?: string}; accessToken?: string; error?: string}
export async function session(page: Page, run: SuggestionsRunConfig): Promise<HostedSession | null> {
  const response = await page.request.get(`${run.web}/api/auth/session`);
  if (response.status() !== 200) throw new Error("HOSTED_SESSION_READ");
  return response.json();
}
/** Fetch a browser-derived credential afresh for every protected API operation. */
export async function api(page: Page, run: SuggestionsRunConfig, persona: SuggestionPersona, endpoint: string,
  options: Parameters<Page["request"]["fetch"]>[1] = {}): Promise<APIResponse> {
  const current = await session(page, run);
  if (current?.user?.id !== run.users[persona].id || current.error || !current.accessToken) throw new Error("HOSTED_SESSION_IDENTITY");
  return page.request.fetch(`${run.api}${endpoint}`, {...options, headers: {...options?.headers, Authorization: `Bearer ${current.accessToken}`}, maxRedirects: 0});
}
export async function importProject(page: Page, run: SuggestionsRunConfig, isPublic: boolean) {
  if (!run.hosted) throw new Error("HOSTED_TARGET_REQUIRED");
  const name = `OW-2 ${run.id} ${isPublic ? "public" : "private"}`;
  const description = `OW-2 hosted synthetic fixture; run=${run.id}; retained` ;
  const buffer = await fs.readFile(tinyOntologyPath);
  // Intent is durable even if the response is lost after the server commits.
  await recordResource(run, {event: "project-import-intent", name, description, owner: run.users.owner.id});
  const response = await api(page, run, "owner", "/api/v1/projects/import", {method: "POST", multipart: {
    name, description, is_public: String(isPublic), file: {name: "tiny-ontology.ttl", mimeType: "text/turtle", buffer},
  }});
  const project = await response.json() as {id?: string};
  if (typeof project.id === "string") await recordResource(run, {event: "project-created", id: project.id, name, description, owner: run.users.owner.id, disposition: "retained"});
  if (response.status() !== 201 || !project.id || !/^[0-9a-f-]{36}$/.test(project.id)) throw new Error("HOSTED_PROJECT_IMPORT");
  return {id: project.id, name};
}
/** Full list pagination: an absent first-page card alone cannot prove isolation. */
export async function listed(page: Page, run: SuggestionsRunConfig, projectId: string, persona?: SuggestionPersona) {
  for (let skip = 0; skip < 100_000; skip += 100) {
    const endpoint = `/api/v1/projects?filter=all&skip=${skip}&limit=100`;
    const response = persona ? await api(page, run, persona, endpoint) : await page.request.get(`${run.api}${endpoint}`);
    if (response.status() !== 200) throw new Error("HOSTED_PROJECT_LIST");
    const body = await response.json() as {items: {id: string}[]; total: number};
    if (body.items.some(item => item.id === projectId)) return true;
    if (skip + body.items.length >= body.total) return false;
    if (!body.items.length) throw new Error("HOSTED_PROJECT_LIST_INCOMPLETE");
  }
  throw new Error("HOSTED_PROJECT_LIST_LIMIT");
}
