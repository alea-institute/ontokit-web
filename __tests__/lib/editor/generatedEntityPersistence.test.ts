import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  projectOntologyApi: { saveSource: vi.fn() },
}));

vi.mock("@/lib/api/revisions", () => ({
  revisionsApi: { getFileAtVersion: vi.fn() },
}));

import { ApiError, projectOntologyApi } from "@/lib/api/client";
import { revisionsApi } from "@/lib/api/revisions";
import {
  createGeneratedEntityPersistenceQueue,
  GeneratedEntitySaveError,
  persistGeneratedEntity,
} from "@/lib/editor/generatedEntityPersistence";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

const BASE_SOURCE = [
  "@prefix ex: <http://example.org/ont#> .",
  "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "",
  "ex:Parent a owl:Class .",
  "",
].join("\n");

const mockedLoad = vi.mocked(revisionsApi.getFileAtVersion);
const mockedDirectSave = vi.mocked(projectOntologyApi.saveSource);

beforeEach(() => {
  vi.clearAllMocks();
  useSuggestionStore.getState().clearAllSuggestions();
  mockedLoad.mockResolvedValue({
    project_id: "project-1",
    version: "main",
    revision: "abc",
    filename: "ontology.ttl",
    content: BASE_SOURCE,
  });
  mockedDirectSave.mockResolvedValue({
    success: true,
    commit_hash: "def",
    commit_message: "Add generated entity",
    branch: "main",
  });
});

describe("persistGeneratedEntity", () => {
  it("serializes deferred persistence operations within one editor branch", async () => {
    const queue = createGeneratedEntityPersistenceQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run("project-1:main", async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
      return "first";
    });
    const second = queue.run("project-1:main", async () => {
      events.push("second:start");
      return "second";
    });

    await vi.waitFor(() => expect(events).toEqual(["first:start"]));

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("continues a scope after a rejected operation", async () => {
    const queue = createGeneratedEntityPersistenceQueue();
    const failed = queue.run("project-1:main", async () => {
      throw new Error("save failed");
    });
    const recovered = queue.run("project-1:main", async () => "recovered");

    await expect(failed).rejects.toThrow("save failed");
    await expect(recovered).resolves.toBe("recovered");
  });

  it("allows unrelated branch scopes to persist concurrently", async () => {
    const queue = createGeneratedEntityPersistenceQueue();
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const main = queue.run("project-1:main", async () => {
      started.push("main");
      await gate;
    });
    const feature = queue.run("project-1:feature", async () => {
      started.push("feature");
      await gate;
    });

    await vi.waitFor(() => expect(started).toEqual(["main", "feature"]));
    release();
    await Promise.all([main, feature]);
  });

  it("loads the authoritative branch and saves a generated child directly", async () => {
    const result = await persistGeneratedEntity({
      mode: "direct",
      projectId: "project-1",
      branch: "main",
      accessToken: "token",
      ontologyPath: "ontology.ttl",
      entity: {
        iri: "http://example.org/ont#Child",
        label: "Child",
        parentIri: "http://example.org/ont#Parent",
        entityType: "class",
      },
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });

    expect(mockedLoad).toHaveBeenCalledWith("project-1", "main", "token", "ontology.ttl");
    expect(mockedDirectSave).toHaveBeenCalledWith(
      "project-1",
      expect.stringContaining("ex:Child a owl:Class"),
      'Add generated class "Child"',
      "token",
      "main",
      "abc",
    );
    expect(result.content).toContain("rdfs:subClassOf ex:Parent");
    expect(result.revision).toBe("def");
  });

  it("carries the generated draft through a stale direct-save conflict", async () => {
    mockedDirectSave.mockRejectedValueOnce(new ApiError(409, "Conflict", JSON.stringify({
      detail: {
        code: "SOURCE_REVISION_CONFLICT",
        message: "The source changed.",
        base_revision: "abc",
        current_revision: "newer",
        branch: "main",
      },
    })));

    const save = persistGeneratedEntity({
      mode: "direct",
      projectId: "project-1",
      branch: "main",
      accessToken: "token",
      entity: {
        iri: "http://example.org/ont#Child",
        label: "Child",
        parentIri: "http://example.org/ont#Parent",
        entityType: "class",
      },
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });

    await expect(save).rejects.toMatchObject({
      name: "GeneratedEntitySaveError",
      draftContent: expect.stringContaining("ex:Child a owl:Class"),
      cause: expect.any(ApiError),
    } satisfies Partial<GeneratedEntitySaveError>);
    expect(mockedDirectSave).toHaveBeenCalledTimes(1);
  });

  it("keeps the real suggestion card state pending until the API-bound helper succeeds", async () => {
    const scope = { projectId: "project-1", branch: "main" };
    const entityIri = "http://example.org/ont#Parent";
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [{
      iri: "http://example.org/ont#Child",
      suggestion_type: "children",
      label: "Child",
      confidence: 0.9,
      provenance: "llm-proposed",
      validation_errors: [],
      duplicate_verdict: "pass",
      duplicate_candidates: [],
    }]);
    const { result } = renderHook(() => useSuggestions({
      projectId: scope.projectId,
      branch: scope.branch,
      entityIri,
      suggestionType: "children",
      canUseLLM: true,
      accessToken: "token",
      onAccepted: (suggestion, editedValue) => persistGeneratedEntity({
        mode: "direct",
        projectId: scope.projectId,
        branch: scope.branch,
        accessToken: "token",
        entity: {
          iri: suggestion.iri,
          label: editedValue ?? suggestion.label,
          parentIri: entityIri,
          entityType: "class",
        },
        ontologyPrefix: "ex",
        ontologyNamespace: "http://example.org/ont#",
      }).then(() => undefined),
    }));

    await act(async () => { await result.current.accept(0); });

    expect(mockedDirectSave).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].status).toBe("accepted");
  });

  it("starts and saves an authenticated session before returning a generated property", async () => {
    const session = {
      startSession: vi.fn().mockResolvedValue("suggest/session-1"),
      saveToSession: vi.fn().mockResolvedValue(true),
    };

    const result = await persistGeneratedEntity({
      mode: "authenticated-suggestion",
      projectId: "project-1",
      branch: "main",
      accessToken: "token",
      entity: {
        iri: "http://example.org/ont#childProperty",
        label: "child property",
        parentIri: "http://example.org/ont#parentProperty",
        entityType: "objectProperty",
      },
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
      suggestionSession: session,
    });

    expect(session.startSession).toHaveBeenCalledTimes(1);
    expect(mockedLoad).toHaveBeenCalledWith("project-1", "suggest/session-1", "token", undefined);
    expect(session.saveToSession).toHaveBeenCalledWith(
      expect.stringContaining("ex:childProperty a owl:ObjectProperty"),
      "http://example.org/ont#childProperty",
      "child property",
    );
    expect(result.content).toContain("rdfs:subPropertyOf ex:parentProperty");
    expect(result.revision).toBeNull();
    expect(mockedDirectSave).not.toHaveBeenCalled();
  });

  it("starts and saves an anonymous session without a bearer token", async () => {
    const session = {
      startSession: vi.fn().mockResolvedValue("anonymous/session-1"),
      saveToSession: vi.fn().mockResolvedValue(true),
    };

    await persistGeneratedEntity({
      mode: "anonymous-suggestion",
      projectId: "project-1",
      branch: "main",
      entity: {
        iri: "http://example.org/ont#AnonymousChild",
        label: "Anonymous child",
        parentIri: "http://example.org/ont#Parent",
        entityType: "class",
      },
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
      anonymousSession: session,
    });

    expect(mockedLoad).toHaveBeenCalledWith("project-1", "anonymous/session-1", undefined, undefined);
    expect(session.saveToSession).toHaveBeenCalledTimes(1);
    expect(mockedDirectSave).not.toHaveBeenCalled();
  });

  it("rejects a failed session save instead of returning optimistic content", async () => {
    const session = {
      startSession: vi.fn().mockResolvedValue("suggest/session-1"),
      saveToSession: vi.fn().mockResolvedValue(false),
    };

    await expect(persistGeneratedEntity({
      mode: "authenticated-suggestion",
      projectId: "project-1",
      branch: "main",
      accessToken: "token",
      entity: {
        iri: "http://example.org/ont#Child",
        label: "Child",
        parentIri: "http://example.org/ont#Parent",
        entityType: "class",
      },
      suggestionSession: session,
    })).rejects.toThrow(/was not saved.*retry/i);
  });

  it("treats an entity already present on the authoritative branch as an idempotent retry", async () => {
    mockedLoad.mockResolvedValue({
      project_id: "project-1",
      version: "main",
      revision: "already-present-revision",
      filename: "ontology.ttl",
      content: `${BASE_SOURCE}\nex:Child a owl:Class ;\n    rdfs:label "Child"@en .\n`,
    });

    const result = await persistGeneratedEntity({
      mode: "direct",
      projectId: "project-1",
      branch: "main",
      accessToken: "token",
      entity: {
        iri: "http://example.org/ont#Child",
        label: "Child",
        parentIri: "http://example.org/ont#Parent",
        entityType: "class",
      },
      ontologyPrefix: "ex",
      ontologyNamespace: "http://example.org/ont#",
    });

    expect(result.content.match(/ex:Child a owl:Class/g)).toHaveLength(1);
    expect(result.revision).toBe("already-present-revision");
    expect(mockedDirectSave).not.toHaveBeenCalled();
  });
});
