import { projectOntologyApi } from "@/lib/api/client";
import { revisionsApi } from "@/lib/api/revisions";
import type { EntityType } from "@/lib/ontology/iriGeneration";
import type { AcceptedSuggestionProvenance } from "@/lib/ontology/suggestionProvenance";
import { generateTurtleSnippet, isProvPrefixBoundToProvO } from "@/lib/ontology/turtleSnippetGenerator";
import { findBlock, parseDeclarations } from "@/lib/ontology/turtleUtils";

export type GeneratedEntityPersistenceMode =
  | "direct"
  | "authenticated-suggestion"
  | "anonymous-suggestion";

export interface GeneratedEntitySessionWriter {
  startSession: () => Promise<string | null>;
  saveToSession: (content: string, entityIri: string, entityLabel: string) => Promise<boolean>;
}

interface GeneratedEntityInput {
  iri: string;
  label: string;
  parentIri: string;
  entityType: EntityType;
  provenance?: AcceptedSuggestionProvenance;
}

interface PersistGeneratedEntityOptions {
  mode: GeneratedEntityPersistenceMode;
  projectId: string;
  branch?: string;
  accessToken?: string;
  ontologyPath?: string;
  entity: GeneratedEntityInput;
  ontologyPrefix?: string;
  ontologyNamespace?: string;
  suggestionSession?: GeneratedEntitySessionWriter;
  anonymousSession?: GeneratedEntitySessionWriter;
}

export class GeneratedEntitySaveError extends Error {
  constructor(
    public readonly cause: unknown,
    public readonly draftContent: string,
  ) {
    super(cause instanceof Error ? cause.message : "Could not save the generated entity.");
    this.name = "GeneratedEntitySaveError";
  }
}

export interface GeneratedEntityPersistenceQueue {
  run: <T>(scope: string, operation: () => Promise<T>) => Promise<T>;
}

/**
 * Serialize authoritative read/append/save transactions that target the same
 * editor branch. A rejected operation does not poison the queue, and unrelated
 * branches remain independent.
 */
export function createGeneratedEntityPersistenceQueue(): GeneratedEntityPersistenceQueue {
  const tails = new Map<string, Promise<unknown>>();

  return {
    run<T>(scope: string, operation: () => Promise<T>): Promise<T> {
      const previous = tails.get(scope) ?? Promise.resolve();
      const result = previous.catch(() => undefined).then(operation);
      tails.set(scope, result);

      const cleanup = () => {
        if (tails.get(scope) === result) tails.delete(scope);
      };
      void result.then(cleanup, cleanup);

      return result;
    },
  };
}

function entityAlreadyExists(source: string, iri: string): boolean {
  const { prefixes, base } = parseDeclarations(source);
  return findBlock(source.split("\n"), iri, prefixes, base) !== null;
}

function requireBranch(branch: string | null | undefined, context: string): string {
  if (!branch) throw new Error(`Could not ${context}: no target branch is available.`);
  return branch;
}

function requireSession(
  session: GeneratedEntitySessionWriter | undefined,
  context: string,
): GeneratedEntitySessionWriter {
  if (!session) throw new Error(`Could not ${context}: the suggestion session is unavailable.`);
  return session;
}

/**
 * Persist an accepted generated entity before callers mutate local editor UI.
 *
 * The authoritative branch is loaded on every attempt. Besides avoiding a
 * partial-document write when local source is absent, this makes a retry after
 * an ambiguous network failure idempotent: an entity already present on the
 * branch is treated as the completed first attempt and is never appended twice.
 */
export async function persistGeneratedEntity(
  options: PersistGeneratedEntityOptions,
): Promise<{ content: string; revision: string | null }> {
  const {
    mode,
    projectId,
    accessToken,
    ontologyPath,
    entity,
    ontologyPrefix,
    ontologyNamespace,
  } = options;

  let targetBranch: string;
  let targetToken: string | undefined;
  let session: GeneratedEntitySessionWriter | undefined;

  if (mode === "direct") {
    targetBranch = requireBranch(options.branch, "save the generated entity");
    if (!accessToken) throw new Error("Could not save the generated entity: sign in and retry.");
    targetToken = accessToken;
  } else {
    session = requireSession(
      mode === "authenticated-suggestion"
        ? options.suggestionSession
        : options.anonymousSession,
      "start the generated-entity proposal",
    );
    targetBranch = requireBranch(
      await session.startSession(),
      "start the generated-entity proposal",
    );
    targetToken = mode === "authenticated-suggestion" ? accessToken : undefined;
    if (mode === "authenticated-suggestion" && !targetToken) {
      throw new Error("Could not save the generated suggestion: sign in and retry.");
    }
  }

  const response = await revisionsApi.getFileAtVersion(
    projectId,
    targetBranch,
    targetToken,
    ontologyPath,
  );
  const source = response.content;
  if (!source.trim()) {
    throw new Error("Could not save the generated entity because the ontology source is empty. Reload and retry.");
  }

  // A previous attempt may have reached the server even if its response was
  // lost. Authoritative presence is sufficient proof to finish acceptance.
  if (entityAlreadyExists(source, entity.iri)) {
    return {
      content: source,
      revision: mode === "direct" ? response.revision : null,
    };
  }

  const content = source + generateTurtleSnippet({
    ...entity,
    ontologyPrefix,
    ontologyNamespace,
    provenance: entity.provenance
      ? { ...entity.provenance, declarePrefix: !isProvPrefixBoundToProvO(source) }
      : undefined,
  });

  if (mode === "direct") {
    const kind = entity.entityType === "class" ? "class" : "property";
    let saved;
    try {
      saved = await projectOntologyApi.saveSource(
        projectId,
        content,
        `Add generated ${kind} "${entity.label}"`,
        targetToken!,
        targetBranch,
        response.revision,
      );
    } catch (error) {
      throw new GeneratedEntitySaveError(error, content);
    }
    return { content, revision: saved.commit_hash };
  } else {
    const saved = await session!.saveToSession(content, entity.iri, entity.label);
    if (!saved) {
      throw new Error("The generated entity was not saved to the suggestion branch. Please retry.");
    }
  }

  return { content, revision: null };
}
