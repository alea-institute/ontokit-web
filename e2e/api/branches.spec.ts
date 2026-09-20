import { test, expect, projectsPath, readSource } from "../fixtures/projects";
import { createBranch, saveLabel } from "../fixtures/polling";

test("branch edits persist independently of the target branch", async ({ownerApi, projects}) => {
  const project = await projects.importOntology();
  const main = await readSource(ownerApi, project.id);
  const branch = await createBranch(ownerApi, project.id, "isolated-edit");
  await saveLabel(ownerApi, project.id, branch, "Isolated Scholar");
  expect(await readSource(ownerApi, project.id)).toEqual(main);
  const historical = await readSource(ownerApi, project.id, branch.revision);
  expect(historical.content).toBe(main.content);
});

test("stale branch revision is rejected without changing source or target", async ({ownerApi, projects}) => {
  const project = await projects.importOntology();
  const main = await readSource(ownerApi, project.id);
  const before = await createBranch(ownerApi, project.id, "concurrent-edit");
  const saved = await saveLabel(ownerApi, project.id, before, "Current Scholar");
  const rejected = await ownerApi.put(`${projectsPath}/${project.id}/source`, {
    params: {branch: before.version},
    data: {content: before.content.replace("Test Person", "Stale Scholar"), base_revision: before.revision, commit_message: "Stale write must fail"},
  });
  expect(rejected.status()).toBe(409);
  expect(await rejected.json()).toMatchObject({detail: {
    code: "SOURCE_REVISION_CONFLICT", base_revision: before.revision, current_revision: saved.revision, branch: before.version,
  }});
  expect(await readSource(ownerApi, project.id, before.version)).toEqual(saved);
  expect(await readSource(ownerApi, project.id)).toEqual(main);
});
