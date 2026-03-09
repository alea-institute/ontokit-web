import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import type { RelationshipGroup } from "@/components/editor/standard/RelationshipSection";
import type { PropertyType, PropertyAssertion } from "@/lib/ontology/entityDetailExtractors";

/** Class draft entry (backward-compatible: drafts without entityType are treated as class) */
export interface DraftEntry {
  entityType?: "class";
  labels: LocalizedString[];
  comments: LocalizedString[];
  parentIris: string[];
  parentLabels: Record<string, string>;
  annotations: AnnotationUpdate[];
  relationships: RelationshipGroup[];
  updatedAt: number;
}

/** Property draft entry */
export interface PropertyDraftEntry {
  entityType: "property";
  propertyType: PropertyType;
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  domainIris: string[];
  rangeIris: string[];
  parentIris: string[];
  inverseOf: string | null;
  characteristics: string[];
  annotations: AnnotationUpdate[];
  relationships: RelationshipGroup[];
  deprecated: boolean;
  equivalentIris: string[];
  disjointIris: string[];
  updatedAt: number;
}

/** Individual draft entry */
export interface IndividualDraftEntry {
  entityType: "individual";
  labels: LocalizedString[];
  comments: LocalizedString[];
  definitions: LocalizedString[];
  typeIris: string[];
  sameAsIris: string[];
  differentFromIris: string[];
  objectPropertyAssertions: PropertyAssertion[];
  dataPropertyAssertions: PropertyAssertion[];
  annotations: AnnotationUpdate[];
  relationships: RelationshipGroup[];
  deprecated: boolean;
  updatedAt: number;
}

export type AnyDraftEntry = DraftEntry | PropertyDraftEntry | IndividualDraftEntry;

/** Composite key: "projectId:branch:classIri" */
export function draftKey(projectId: string, branch: string, classIri: string): string {
  return `${projectId}:${branch}:${classIri}`;
}

interface DraftState {
  drafts: Record<string, AnyDraftEntry>;
  setDraft: (key: string, data: AnyDraftEntry) => void;
  clearDraft: (key: string) => void;
  getDraft: (key: string) => AnyDraftEntry | undefined;
  hasDraft: (key: string) => boolean;
  getDraftIris: (projectId: string, branch: string) => string[];
  clearAllDrafts: (projectId: string, branch: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},

      setDraft: (key, data) =>
        set((state) => ({
          drafts: { ...state.drafts, [key]: data },
        })),

      clearDraft: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.drafts;
          return { drafts: rest };
        }),

      getDraft: (key) => get().drafts[key],

      hasDraft: (key) => key in get().drafts,

      getDraftIris: (projectId, branch) => {
        const prefix = `${projectId}:${branch}:`;
        return Object.keys(get().drafts)
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length));
      },

      clearAllDrafts: (projectId, branch) =>
        set((state) => {
          const prefix = `${projectId}:${branch}:`;
          const remaining: Record<string, AnyDraftEntry> = {};
          for (const [k, v] of Object.entries(state.drafts)) {
            if (!k.startsWith(prefix)) remaining[k] = v;
          }
          return { drafts: remaining };
        }),
    }),
    {
      name: "ontokit-drafts",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
