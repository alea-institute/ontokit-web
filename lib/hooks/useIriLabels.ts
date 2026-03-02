import { useState, useEffect, useRef } from "react";
import { projectOntologyApi } from "@/lib/api/client";
import { getPreferredLabel, getLocalName } from "@/lib/utils";

/**
 * Async-resolve rdfs:labels for a set of IRIs.
 *
 * Returns a stable `Map<string, string>` that maps IRI → human-readable label.
 * Incrementally resolves new IRIs as they appear, caching previous results.
 */
export function useIriLabels(
  iris: string[],
  opts: {
    projectId: string;
    accessToken?: string;
    branch?: string;
  },
): Record<string, string> {
  const { projectId, accessToken, branch } = opts;
  const [labels, setLabels] = useState<Record<string, string>>({});
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    // Determine which IRIs we haven't resolved yet
    const unresolved = iris.filter(
      (iri) => iri && !labels[iri] && !pendingRef.current.has(iri),
    );
    if (unresolved.length === 0) return;

    // Mark as pending so we don't double-resolve
    for (const iri of unresolved) pendingRef.current.add(iri);

    let cancelled = false;

    const resolve = async () => {
      const newLabels: Record<string, string> = {};

      await Promise.all(
        unresolved.map(async (iri) => {
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

  return labels;
}
