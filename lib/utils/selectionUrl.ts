export type SelectableEntityType = "class" | "property" | "individual";

interface Selection {
  iri: string;
  type: SelectableEntityType;
}

/**
 * Param key per entity type. Keys are mutually exclusive in a URL — at most one should be set.
 * Order matters: when more than one is present (e.g. a stale link), readers honor the first match.
 * The priority is class > property > individual, matching the order entities appear in the tree.
 */
export const SELECTION_PARAM_BY_TYPE: Readonly<Record<SelectableEntityType, string>> = Object.freeze({
  class: "classIri",
  property: "propertyIri",
  individual: "individualIri",
});

const SELECTION_TYPES_IN_PRIORITY: readonly SelectableEntityType[] = ["class", "property", "individual"];

/**
 * Read the selection (IRI + entity type) from a URL's search params.
 * Returns null when no selection key is present.
 */
export function readSelectionFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): Selection | null {
  for (const type of SELECTION_TYPES_IN_PRIORITY) {
    const iri = searchParams.get(SELECTION_PARAM_BY_TYPE[type]);
    if (iri) return { iri, type };
  }
  return null;
}

/**
 * Build a leading-`?` query string carrying the given selection, or an empty string when no selection.
 */
export function buildSelectionQuery(selection: Selection | null): string {
  if (!selection || !selection.iri) return "";
  const key = SELECTION_PARAM_BY_TYPE[selection.type];
  return `?${key}=${encodeURIComponent(selection.iri)}`;
}
