import { test, expect, projectsPath, ontologyNamespace, readSource } from "../fixtures/projects";

test("import initializes persisted source, branch, class and property labels", async ({ownerApi, projects}) => {
  const project = await projects.importOntology();
  expect(project.ontology_iri).toBe("https://example.org/ontokit-e2e");
  expect(project.file_path.length).toBeGreaterThan(0);
  const branches = await ownerApi.get(`${projectsPath}/${project.id}/branches`);
  expect(branches.status()).toBe(200);
  const branchList = await branches.json();
  expect(branchList.default_branch).toBe("main");
  const source = await readSource(ownerApi, project.id);
  expect(branchList.items).toEqual(expect.arrayContaining([expect.objectContaining({name: "main", commit_hash: source.revision})]));
  expect(source.content).toContain('"Test Person"@en');
  const detail = await ownerApi.get(`${projectsPath}/${project.id}/ontology/classes/${encodeURIComponent(`${ontologyNamespace}Researcher`)}`, {params: {branch: "main"}});
  expect(detail.status()).toBe(200);
  expect(await detail.json()).toMatchObject({iri: `${ontologyNamespace}Researcher`, labels: expect.arrayContaining([{value: "Test Researcher", lang: "en"}]), parent_iris: expect.arrayContaining([`${ontologyNamespace}Person`])});
  // The project's supported property read is its typed entity search; legacy
  // /ontologies/{id}/properties does not load project-owned Git state.
  for (const [query, localName, label, kind] of [["Knows person", "knows", "Knows person", "object"], ["Age in years", "age", "Age in years", "data"]]) {
    const response = await ownerApi.get(`${projectsPath}/${project.id}/ontology/search`, {params: {q: query, entity_types: "property", branch: "main"}});
    expect(response.status()).toBe(200);
    expect((await response.json()).results).toEqual(expect.arrayContaining([expect.objectContaining({iri: `${ontologyNamespace}${localName}`, label, entity_type: "property", property_kind: kind})]));
  }
});

test("source save persists a new immutable revision", async ({ownerApi, projects}) => {
  const project = await projects.importOntology();
  const before = await readSource(ownerApi, project.id);
  const content = before.content.replace('"Test Person"@en', '"Updated Person"@en');
  expect(content).not.toBe(before.content);
  const save = await ownerApi.put(`${projectsPath}/${project.id}/source`, {params: {branch: "main"}, data: {content, base_revision: before.revision, commit_message: "Update person label"}});
  expect(save.status()).toBe(200);
  const saved = await save.json();
  expect(saved).toMatchObject({success: true, branch: "main"});
  const after = await readSource(ownerApi, project.id);
  expect(after.revision).toBe(saved.commit_hash);
  expect(after.revision).not.toBe(before.revision);
  expect(after.content).toBe(content);
});
