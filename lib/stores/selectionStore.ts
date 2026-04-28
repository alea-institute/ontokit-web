import { create } from "zustand";

import type { SelectableEntityType } from "@/lib/utils/selectionUrl";

interface SelectionState {
  /** IRI of the entity the user is currently focused on (whichever tab is active). */
  iri: string | null;
  /** Entity type that resolves the punning ambiguity for {@link iri}. */
  type: SelectableEntityType | null;
  setSelection: (iri: string | null, type: SelectableEntityType | null) => void;
  clear: () => void;
}

/**
 * In-session active-selection state shared between the entity-tab layouts and
 * cross-page chrome (e.g. the Viewer/Editor switcher). Not persisted — on a
 * full page reload, the URL search params drive initial state.
 */
export const useSelectionStore = create<SelectionState>()((set) => ({
  iri: null,
  type: null,
  setSelection: (iri, type) => set({ iri, type }),
  clear: () => set({ iri: null, type: null }),
}));
