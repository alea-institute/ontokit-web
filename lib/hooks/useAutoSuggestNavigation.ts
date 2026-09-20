import { useCallback, useEffect, useState } from "react";

/** Own the delay outside the detail panel, which remounts for each entity. */
export function useAutoSuggestNavigation(selectedIri: string | null, enabled: boolean, scope: string) {
  const [request, setRequest] = useState<{ iri: string; scope: string } | null>(null);
  const [ready, setReady] = useState<typeof request>(null);
  const schedule = useCallback((iri: string) => {
    setReady(null);
    setRequest({ iri, scope });
  }, [scope]);

  // Invalidate a previous navigation before a different entity can consume it.
  if (request && (!enabled || request.scope !== scope || request.iri !== selectedIri)) {
    setRequest(null);
    setReady(null);
  }

  useEffect(() => {
    if (!request || !enabled || request.scope !== scope || request.iri !== selectedIri) return;
    const timer = setTimeout(() => setReady(request), 800);
    return () => clearTimeout(timer);
  }, [request, selectedIri, enabled, scope]);

  return { schedule, shouldSuggest: enabled && ready?.scope === scope && ready?.iri === selectedIri };
}
