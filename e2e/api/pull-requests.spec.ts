import { test, expect, projectsPath, ontologyNamespace, readSource } from "../fixtures/projects";
import { createBranch, saveLabel, waitForIndex } from "../fixtures/polling";

test("ordinary owner reviews a diff and merges persisted branch content into the target", async ({ownerApi, projects, run}) => {
  const project = await projects.importOntology();
  const main = await readSource(ownerApi, project.id);
  // Finish the import index before creating a later target revision.
  await waitForIndex(ownerApi, project.id, "main", main.revision);
  const branch = await createBranch(ownerApi, project.id, "review-label");
  const saved = await saveLabel(ownerApi, project.id, branch, "Merged Quasar Scholar");
  const settings = await ownerApi.get(`${projectsPath}/${project.id}/pr-settings`);
  expect(settings.status()).toBe(200);
  expect(await settings.json()).toMatchObject({pr_approval_required: 0, github_integration: null});
  const created = await ownerApi.post(`${projectsPath}/${project.id}/pull-requests`, {data: {
    title: "Rename Person for review", source_branch: branch.version, target_branch: "main",
  }});
  expect(created.status()).toBe(201);
  const pr = await created.json();
  expect(pr).toMatchObject({project_id: project.id, status: "open", author_id: run.users.owner.id, github_sync_status: "not_configured"});
  const prPath = `${projectsPath}/${project.id}/pull-requests/${pr.pr_number}`;
  const diffResponse = await ownerApi.get(`${prPath}/diff`);
  expect(diffResponse.status()).toBe(200);
  const diff = await diffResponse.json();
  expect(diff.files_changed).toBe(1);
  expect(diff.files).toHaveLength(1);
  expect(diff.files[0]).toMatchObject({path: main.filename, change_type: "modified"});
  const lines = (diff.files[0].patch as string).split("\n");
  expect(lines.some(line => line.startsWith("-") && line.includes('"Test Person"@en'))).toBe(true);
  expect(lines.some(line => line.startsWith("+") && line.includes('"Merged Quasar Scholar"@en'))).toBe(true);
  expect(await readSource(ownerApi, project.id)).toEqual(main);
  const merge = await ownerApi.post(`${prPath}/merge`, {data: {delete_source_branch: false}});
  expect(merge.status()).toBe(200);
  const merged = await merge.json();
  expect(merged.success).toBe(true);
  expect(merged.merge_commit_hash).toMatch(/^[a-f0-9]{40}$/);
  const persisted = await ownerApi.get(prPath);
  expect(persisted.status()).toBe(200);
  expect(await persisted.json()).toMatchObject({status: "merged", merged_by: run.users.owner.id, merge_commit_hash: merged.merge_commit_hash});
  const target = await readSource(ownerApi, project.id);
  expect(target.revision).toBe(merged.merge_commit_hash);
  expect(target.content).toBe(saved.content);
  expect(await readSource(ownerApi, project.id, branch.version)).toEqual(saved);
  await waitForIndex(ownerApi, project.id, "main", target.revision);
  const search = await ownerApi.get(`${projectsPath}/${project.id}/ontology/search`, {params: {q: "Merged Quasar", entity_types: "class", branch: "main"}});
  expect(search.status()).toBe(200);
  expect((await search.json()).results).toEqual([expect.objectContaining({iri: `${ontologyNamespace}Person`, label: "Merged Quasar Scholar"})]);
});
