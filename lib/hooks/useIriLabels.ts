import { useState, useEffect, useRef } from "react";
import { projectOntologyApi } from "@/lib/api/client";
import { getPreferredLabel, getLocalName } from "@/lib/utils";

/**
 * IRIs whose namespace belongs to a well-known external vocabulary will never
 * resolve via the project's class/property/individual endpoints — and the
 * project's own searchEntities endpoint won't find them either. Skipping the
 * probe for these saves a round-trip and eliminates noisy 404s in the console
 * while still letting getLocalName provide a sensible default label.
 */
const EXTERNAL_VOCABULARY_PREFIXES: readonly string[] = [
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "http://www.w3.org/2000/01/rdf-schema#",
  "http://www.w3.org/2001/XMLSchema#",
  "http://www.w3.org/2002/07/owl#",
  "http://www.w3.org/2004/02/skos/core#",
  "http://purl.org/dc/elements/1.1/",
  "http://purl.org/dc/terms/",
  "http://xmlns.com/foaf/0.1/",
  "http://www.w3.org/ns/prov#",
];

function isExternalVocabularyIri(iri: string): boolean {
  for (const prefix of EXTERNAL_VOCABULARY_PREFIXES) {
    if (iri.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Async-resolve rdfs:labels for a set of IRIs.
 *
 * Returns a stable `Record<string, string>` that maps IRI → human-readable label.
 * Incrementally resolves new IRIs as they appear, caching previous results.
 * Cache is scoped to projectId+branch to avoid stale labels across contexts.
 */
export function useIriLabels(
  iris: string[],
  opts: {
    projectId: string;
    accessToken?: string;
    branch?: string;
    labelHints?: Record<string, string>;
  },
): Record<string, string> {
  const { projectId, accessToken, branch, labelHints } = opts;
  const [labels, setLabels] = useState<Record<string, string>>({});
  const pendingRef = useRef(new Set<string>());
  const contextRef = useRef("");

  // Reset cache when project/branch changes
  const contextKey = `${projectId}|${branch ?? ""}`;
  useEffect(() => {
    if (contextRef.current !== contextKey) {
      contextRef.current = contextKey;
      setLabels({});
      pendingRef.current = new Set<string>();
    }
  }, [contextKey]);

  useEffect(() => {
    // Deduplicate and filter already-resolved IRIs
    const unique = [...new Set(iris.filter(Boolean))];
    const unresolved = unique.filter(
      (iri) => !labels[iri] && !pendingRef.current.has(iri) && !(labelHints && labelHints[iri]),
    );
    if (unresolved.length === 0) return;

    // Mark as pending so we don't double-resolve
    for (const iri of unresolved) pendingRef.current.add(iri);

    let cancelled = false;

    const resolve = async () => {
      const newLabels: Record<string, string> = {};

      // Batch in groups of 10 to avoid spiking concurrent requests
      for (let i = 0; i < unresolved.length; i += 10) {
        const batch = unresolved.slice(i, i + 10);
        await Promise.all(
          batch.map(async (iri) => {
            // External-vocabulary IRIs (skos, rdfs, owl, dcterms, …) live
            // outside the project ontology, so neither the class endpoint nor
            // the project search can resolve them. Skip the probe entirely
            // and let the caller fall back on getLocalName.
            if (isExternalVocabularyIri(iri)) return;

            // 1. Try class endpoint (fastest for classes)
            try {
              const detail = await projectOntologyApi.getClassDetail(
                projectId, iri, accessToken, branch,
              );
              const label = getPreferredLabel(detail.labels);
              if (label) { newLabels[iri] = label; return; }
            } catch {
              // Not a class — fall through
            }

            // 2. Fallback: entity search by local name
            try {
              const localName = getLocalName(iri);
              const result = await projectOntologyApi.searchEntities(
                projectId, localName, accessToken, branch,
              );
              const match = result.results.find(
                (r: { iri: string; label?: string }) => r.iri === iri,
              );
              if (match?.label) { newLabels[iri] = match.label; return; }
            } catch {
              // Search failed — leave unresolved
            }
          }),
        );
      }

      if (!cancelled && Object.keys(newLabels).length > 0) {
        setLabels((prev) => ({ ...prev, ...newLabels }));
      }

      // Clean up pending set
      for (const iri of unresolved) pendingRef.current.delete(iri);
    };

    resolve();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iris.join(","), projectId, accessToken, branch]);

  return labelHints ? { ...labelHints, ...labels } : labels;
}
