import { test, expect, projectsPath, projectIds } from "../fixtures/projects";

test("project create, list, read, update and delete persist through HTTP", async ({ownerApi, projects, run}) => {
  const project = await projects.create({description: "Before update"});
  expect(project.owner_id).toBe(run.users.owner.id);
  expect(project.user_role).toBe("owner");
  expect(await projectIds(ownerApi)).toContain(project.id);
  const read = await ownerApi.get(`${projectsPath}/${project.id}`);
  expect(read.status()).toBe(200);
  expect(await read.json()).toMatchObject({id: project.id, name: project.name, description: "Before update", is_public: false});
  const changed = {name: `${project.name} updated`, description: "After update", is_public: true};
  const update = await ownerApi.patch(`${projectsPath}/${project.id}`, {data: changed});
  expect(update.status()).toBe(200);
  const persisted = await ownerApi.get(`${projectsPath}/${project.id}`);
  expect(persisted.status()).toBe(200);
  expect(await persisted.json()).toMatchObject(changed);
  expect((await ownerApi.delete(`${projectsPath}/${project.id}`)).status()).toBe(204);
  const absent = await ownerApi.get(`${projectsPath}/${project.id}`);
  expect(absent.status()).toBe(404);
  expect(await absent.json()).toEqual({detail: "Project not found"});
  expect(await projectIds(ownerApi)).not.toContain(project.id);
});
