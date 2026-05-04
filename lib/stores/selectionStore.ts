import { create } from "zustand";

import type { SelectableEntityType } from "@/lib/utils/selectionUrl";

/**
 * Which project surface the user is most recently on. Used by side-page
 * Back-to-project links to route the user back where they came from instead
 * of forcing them through the global preferEditMode preference.
 */
export type ProjectViewMode = "viewer" | "editor";

interface SelectionState {
  /** IRI of the entity the user is currently focused on (whichever tab is active). */
  iri: string | null;
  /** Entity type that resolves the punning ambiguity for {@link iri}. */
  type: SelectableEntityType | null;
  /** Most recent viewer/editor surface the user was on, or null on cold load. */
  mode: ProjectViewMode | null;
  setSelection: (iri: string | null, type: SelectableEntityType | null) => void;
  setMode: (mode: ProjectViewMode) => void;
  clear: () => void;
}

/**
 * In-session active-selection + viewer/editor mode state shared between
 * project pages and cross-page chrome (Viewer/Editor switcher, side-page
 * Back-to-project links via useProjectHomeHref). Not persisted — on a full
 * page reload, the URL search params drive selection and the preferEditMode
 * preference drives mode.
 */
export const useSelectionStore = create<SelectionState>()((set) => ({
  iri: null,
  type: null,
  mode: null,
  setSelection: (iri, type) => set({ iri, type }),
  setMode: (mode) => set({ mode }),
  clear: () => set({ iri: null, type: null, mode: null }),
}));
