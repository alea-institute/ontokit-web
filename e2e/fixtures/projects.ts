import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { Project, ProjectCreate, ProjectImportResponse } from "../../lib/api/projects";
import { test as authenticatedTest, expect } from "./auth";
import type { ModeRunConfig } from "./run";

export const projectsPath = "/api/v1/projects";
export const ontologyNamespace = "https://example.org/ontokit-e2e#";
export const tinyOntologyPath = path.resolve("e2e/fixtures/tiny-ontology.ttl");
export interface SourceSnapshot { project_id: string; version: string; revision: string; filename: string; content: string }
export async function readSource(api: APIRequestContext, id: string, branch = "main"): Promise<SourceSnapshot> {
  const response = await api.get(`${projectsPath}/${id}/revisions/file`, {params: {version: branch}});
  expect(response.status()).toBe(200);
  const source = await response.json() as SourceSnapshot;
  expect(source.project_id).toBe(id);
  expect(source.version).toBe(branch);
  expect(source.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(source.content.length).toBeGreaterThan(0);
  return source;
}
export async function projectIds(api: APIRequestContext): Promise<string[]> {
  const ids: string[] = [];
  for (let skip = 0; ; skip += 100) {
    const response = await api.get(projectsPath, {params: {filter: "mine", skip, limit: 100}});
    expect(response.status()).toBe(200);
    const page = await response.json() as {items: Project[]; total: number};
    ids.push(...page.items.map(project => project.id));
    if (ids.length >= page.total) return ids.sort();
    expect(page.items.length).toBeGreaterThan(0);
  }
}
/**
 * D09 run-tagged projects seeded inside the API container before any browser case (KTD4).
 * `publicProject` and `foreignPrivateProject` belong to a synthetic foreign user;
 * `personaPrivateProject` (optional-configured only) belongs to `run.users.owner`.
 * Outer run cleanup deletes them by exact ID; specs must not delete them.
 */
export function seededProject(run: ModeRunConfig, key: "publicProject" | "foreignPrivateProject" | "personaPrivateProject"): string {
  const id = (run.fixtures as unknown as Record<string, unknown>)[key];
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new Error(`Seeded project ${key} is not available in the ${run.profile} profile`);
  return id;
}
interface ProjectFixtures {
  projects: {
    create(data?: Partial<ProjectCreate>): Promise<Project>;
    importOntology(name?: string): Promise<ProjectImportResponse>;
  };
}
export const test = authenticatedTest.extend<ProjectFixtures>({
  projects: async ({ownerApi}, provide) => {
    const createdIds = new Set<string>();
    async function capture(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
      expect(response.status()).toBe(201);
      const project = await response.json() as ProjectImportResponse;
      expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
      createdIds.add(project.id);
      return project;
    }
    try {
      await provide({
        create: async (data = {}) => capture(await ownerApi.post(projectsPath, {data: {
          name: `D06 project ${randomUUID()}`, is_public: false, ...data,
        }})),
        importOntology: async (name = `D06 ontology ${randomUUID()}`) => capture(await ownerApi.post(`${projectsPath}/import`, {multipart: {
          name, is_public: "true", file: {name: "tiny-ontology.ttl", mimeType: "text/turtle", buffer: await fs.readFile(tinyOntologyPath)},
        }})),
      });
    } finally {
      // Delete only IDs returned by this fixture. Outer volume cleanup remains mandatory.
      const failures: string[] = [];
      for (const id of createdIds) {
        try {
          const response = await ownerApi.delete(`${projectsPath}/${id}`);
          if (![204, 404].includes(response.status())) failures.push(`${id}: ${response.status()}`);
        } catch { failures.push(`${id}: request failed`); }
      }
      expect(failures, "Exact-ID project teardown").toEqual([]);
    }
  },
});
export { expect };
