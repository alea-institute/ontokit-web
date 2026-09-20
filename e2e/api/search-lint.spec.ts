import { test, expect, projectsPath, ontologyNamespace, readSource } from "../fixtures/projects";
import { lintRuns, saveLabel, waitForIndex, waitForNewLintRun } from "../fixtures/polling";

test("lexical search reflects the saved target revision and excludes nonmatching entities", async ({ownerApi, projects}) => {
  const project = await projects.importOntology();
  const before = await readSource(ownerApi, project.id);
  await waitForIndex(ownerApi, project.id, "main", before.revision);
  const saved = await saveLabel(ownerApi, project.id, before, "Nebula Archivist");
  await waitForIndex(ownerApi, project.id, "main", saved.revision);
  const search = await ownerApi.get(`${projectsPath}/${project.id}/ontology/search`, {params: {q: "Nebula", entity_types: "class", branch: "main"}});
  expect(search.status()).toBe(200);
  const results = (await search.json()).results;
  expect(results).toEqual([expect.objectContaining({iri: `${ontologyNamespace}Person`, label: "Nebula Archivist", entity_type: "class"})]);
  expect(results).not.toEqual(expect.arrayContaining([expect.objectContaining({iri: `${ontologyNamespace}Researcher`})]));
  const old = await ownerApi.get(`${projectsPath}/${project.id}/ontology/search`, {params: {q: "Test Person", branch: "main"}});
  expect(old.status()).toBe(200);
  expect((await old.json()).results).toEqual([]);
});

test("each lint enqueue produces a fresh completed persisted worker run with deterministic issues", async ({ownerApi, projects}) => {
  test.setTimeout(150_000);
  const project = await projects.importOntology();
  const config = await ownerApi.put(`${projectsPath}/${project.id}/lint/config`, {data: {lint_level: null, enabled_rules: ["missing-comment"]}});
  expect(config.status()).toBe(200);
  expect(await config.json()).toMatchObject({effective_rules: ["missing-comment"]});
  // Two enqueues prove that a completed previous run cannot satisfy the wait.
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await lintRuns(ownerApi, project.id);
    expect(before).toHaveLength(attempt);
    const queued = await ownerApi.post(`${projectsPath}/${project.id}/lint/run`);
    expect(queued.status()).toBe(202);
    const job = await queued.json();
    expect(job.status).toBe("queued");
    expect(typeof job.job_id).toBe("string");
    expect(job.job_id.length).toBeGreaterThan(0);
    // The API has no job-to-run lookup: isolated project + one enqueue + ID-set
    // difference correlates the new run without confusing job_id with run.id.
    const completed = await waitForNewLintRun(ownerApi, project.id, new Set(before.map(run => run.id)));
    expect(completed.issues).toEqual(expect.arrayContaining([expect.objectContaining({
      run_id: completed.id, project_id: project.id, rule_id: "missing-comment", issue_type: "info", subject_iri: `${ontologyNamespace}Person`, subject_type: "class",
    })]));
    expect(completed.issues.every(issue => issue.run_id === completed.id && issue.rule_id === "missing-comment")).toBe(true);
  }
});
