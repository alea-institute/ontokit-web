import { randomUUID } from "node:crypto";
import { test, expect, projectsPath, projectIds, readSource } from "../fixtures/projects";

for (const rejection of ["anonymous", "unrelated", "invalid Turtle", "invalid schema"] as const) {
  test(`${rejection} source write is rejected without changing owner state`, async ({ownerApi, unrelatedApi, anonymousApi, projects}) => {
    const project = await projects.importOntology();
    const before = await readSource(ownerApi, project.id);
    const beforeProject = await ownerApi.get(`${projectsPath}/${project.id}`);
    expect(beforeProject.status()).toBe(200);
    const metadata = await beforeProject.json();
    if (rejection === "unrelated") {
      const publicRead = await unrelatedApi.get(`${projectsPath}/${project.id}`);
      expect(publicRead.status()).toBe(200);
      expect((await publicRead.json()).owner_id).toBe(project.owner_id);
    }
    const api = rejection === "anonymous" ? anonymousApi : rejection === "unrelated" ? unrelatedApi : ownerApi;
    const data = {
      content: rejection === "invalid Turtle" ? "@prefix broken" : before.content.replace('"Test Person"@en', '"Rejected Person"@en'),
      base_revision: rejection === "invalid schema" ? "not-a-commit" : before.revision,
      commit_message: "This write must fail",
    };
    const response = await api.put(`${projectsPath}/${project.id}/source`, {params: {branch: "main"}, data});
    const expectedStatus = rejection === "anonymous" ? 401 : rejection === "unrelated" ? 403 : 422;
    expect(response.status()).toBe(expectedStatus);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body = await response.json();
    if (rejection === "anonymous") expect(body).toEqual({detail: "Not authenticated"});
    else if (rejection === "unrelated") expect(body).toEqual({detail: "Must be an editor or higher to save changes"});
    else if (rejection === "invalid Turtle") expect(body).toEqual({detail: expect.stringMatching(/^Invalid Turtle syntax:/)});
    else expect(body.detail).toEqual(expect.arrayContaining([expect.objectContaining({loc: ["body", "base_revision"], type: expect.any(String), msg: expect.any(String)})]));
    // A separate owner request must observe the exact original commit and bytes.
    expect(await readSource(ownerApi, project.id)).toEqual(before);
    const afterProject = await ownerApi.get(`${projectsPath}/${project.id}`);
    expect(afterProject.status()).toBe(200);
    expect(await afterProject.json()).toMatchObject({name: metadata.name, description: metadata.description, updated_at: metadata.updated_at});
  });
}

test("absent project write returns stable 404 and creates nothing", async ({ownerApi}) => {
  const before = await projectIds(ownerApi);
  const response = await ownerApi.patch(`${projectsPath}/${randomUUID()}`, {data: {name: "Must not create"}});
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({detail: "Project not found"});
  expect(await projectIds(ownerApi)).toEqual(before);
});

test("schema-invalid project create returns validation locations and creates nothing", async ({ownerApi}) => {
  const before = await projectIds(ownerApi);
  const response = await ownerApi.post(projectsPath, {data: {name: "", is_public: true}});
  expect(response.status()).toBe(422);
  expect((await response.json()).detail).toEqual(expect.arrayContaining([expect.objectContaining({loc: ["body", "name"], type: "string_too_short", msg: expect.any(String)})]));
  expect(await projectIds(ownerApi)).toEqual(before);
});

for (const malformed of ["Turtle", "multipart"] as const) {
  test(`malformed ${malformed} import leaves no partial project`, async ({ownerApi}) => {
    const before = await projectIds(ownerApi);
    const response = await ownerApi.post(`${projectsPath}/import`, {multipart: malformed === "Turtle" ? {
      name: `Rejected import ${randomUUID()}`, is_public: "true",
      file: {name: "broken.ttl", mimeType: "text/turtle", buffer: Buffer.from("@prefix broken")},
    } : {name: "Missing file", is_public: "true"}});
    expect(response.status()).toBe(422);
    const body = await response.json();
    if (malformed === "Turtle") expect(body.detail).toEqual(expect.any(String));
    else expect(body.detail).toEqual(expect.arrayContaining([expect.objectContaining({loc: ["body", "file"], type: "missing", msg: expect.any(String)})]));
    // Compare all exact owner IDs, not a name prefix that could hide a partial import.
    expect(await projectIds(ownerApi)).toEqual(before);
  });
}
