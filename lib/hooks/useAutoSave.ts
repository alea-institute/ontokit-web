import { useState, useRef, useCallback, useEffect } from "react";
import { useDraftStore, draftKey, type DraftEntry } from "@/lib/stores/draftStore";
import type { LocalizedString, AnnotationUpdate, ClassUpdatePayload } from "@/lib/api/client";
import type { RelationshipGroup } from "@/components/editor/standard/RelationshipSection";
import type { OWLClassDetail } from "@/lib/api/client";

export type SaveStatus = "idle" | "draft" | "saving" | "saved" | "error";

export type SaveMode = "commit" | "suggest";

interface UseAutoSaveOptions {
  projectId: string;
  branch: string;
  classIri: string | null;
  classDetail: OWLClassDetail | null;
  canEdit: boolean;
  onUpdateClass?: (classIri: string, data: ClassUpdatePayload) => Promise<void>;
  onError?: (msg: string) => void;
  /** When "suggest", flushes go through onSuggestSave instead of onUpdateClass */
  saveMode?: SaveMode;
  /** Called when saveMode is "suggest" — saves to suggestion branch */
  onSuggestSave?: (classIri: string, data: ClassUpdatePayload, label: string) => Promise<void>;
}

interface EditState {
  labels: LocalizedString[];
  comments: LocalizedString[];
  parentIris: string[];
  parentLabels: Record<string, string>;
  annotations: AnnotationUpdate[];
  relationships: RelationshipGroup[];
}

export interface UseAutoSaveReturn {
  saveStatus: SaveStatus;
  saveError: string | null;
  validationError: string | null;
  triggerSave: () => void;
  flushToGit: () => Promise<void>;
  discardDraft: () => void;
  editStateRef: React.MutableRefObject<EditState | null>;
  classDetailRef: React.MutableRefObject<OWLClassDetail | null>;
  restoredDraft: DraftEntry | null;
  clearRestoredDraft: () => void;
}

export function useAutoSave({
  projectId,
  branch,
  classIri,
  classDetail,
  canEdit,
  onUpdateClass,
  onError,
  saveMode = "commit",
  onSuggestSave,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const { setDraft, clearDraft, getDraft } = useDraftStore();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<DraftEntry | null>(null);

  // Refs to hold current edit state so flush closure reads latest values
  const editStateRef = useRef<EditState | null>(null);
  const classDetailRef = useRef<OWLClassDetail | null>(null);
  const flushingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep classDetail ref up to date
  useEffect(() => {
    classDetailRef.current = classDetail;
  }, [classDetail]);

  // Check for restored draft on class change
  useEffect(() => {
    if (!classIri || !branch) return;
    const key = draftKey(projectId, branch, classIri);
    const draft = getDraft(key);
    // Only restore class drafts (no entityType or entityType === "class")
    if (draft && (!draft.entityType || draft.entityType === "class")) {
      setRestoredDraft(draft as DraftEntry);
    } else {
      setRestoredDraft(null);
    }
    setSaveStatus("idle");
    setSaveError(null);
    setValidationError(null);
  }, [classIri, branch, projectId, getDraft]);

  const clearRestoredDraft = useCallback(() => {
    setRestoredDraft(null);
  }, []);

  // Discard draft for current classIri (used by Cancel)
  const discardDraft = useCallback(() => {
    if (!classIri || !branch) return;
    const key = draftKey(projectId, branch, classIri);
    clearDraft(key);
    setSaveStatus("idle");
    setSaveError(null);
    setValidationError(null);
    setRestoredDraft(null);
    editStateRef.current = null;
  }, [classIri, branch, projectId, clearDraft, editStateRef]);

  // Save edit state to draft store (Tier 1: instant, local)
  const triggerSave = useCallback(() => {
    const canSave = canEdit || saveMode === "suggest";
    if (!classIri || !branch || !canSave) return;
    const state = editStateRef.current;
    if (!state) return;

    // Validate: at least one non-empty label
    const validLabels = state.labels.filter((l) => l.value.trim());
    if (validLabels.length === 0) {
      setValidationError("At least one label is required");
      return;
    }
    setValidationError(null);

    const key = draftKey(projectId, branch, classIri);
    const entry: DraftEntry = {
      labels: state.labels,
      comments: state.comments,
      parentIris: state.parentIris,
      parentLabels: state.parentLabels,
      annotations: state.annotations,
      relationships: state.relationships,
      updatedAt: Date.now(),
    };
    setDraft(key, entry);
    setSaveStatus("draft");
    setSaveError(null);

    // Clear any "saved" fade timer
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, [classIri, branch, projectId, canEdit, saveMode, setDraft]);

  // Flush draft to git (Tier 2: commit on navigate away)
  const flushToGit = useCallback(async () => {
    if (flushingRef.current) return;
    const canFlush = canEdit || saveMode === "suggest";
    const hasHandler = saveMode === "suggest" ? !!onSuggestSave : !!onUpdateClass;
    if (!classIri || !branch || !canFlush || !hasHandler) return;

    const key = draftKey(projectId, branch, classIri);
    const rawDraft = getDraft(key);
    if (!rawDraft) return;
    // Only flush class drafts
    if (rawDraft.entityType && rawDraft.entityType !== "class") return;
    const draft = rawDraft as DraftEntry;

    const detail = classDetailRef.current;

    flushingRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);

    try {
      // Filter out empty annotation values
      const cleanAnnotations = draft.annotations
        .map((a) => ({
          ...a,
          values: a.values.filter((v) => v.value.trim()),
        }))
        .filter((a) => a.values.length > 0);

      // Convert relationships back to annotation format
      const relationshipAnnotations: AnnotationUpdate[] = draft.relationships
        .filter((g) => g.targets.length > 0)
        .map((g) => ({
          property_iri: g.property_iri,
          values: g.targets.map((t) => ({ value: t.iri, lang: "" })),
        }));

      const validLabels = draft.labels.filter((l) => l.value.trim());

      const payload: ClassUpdatePayload = {
        labels: validLabels,
        comments: draft.comments.filter((c) => c.value.trim()),
        parent_iris: draft.parentIris,
        annotations: [...cleanAnnotations, ...relationshipAnnotations],
        deprecated: detail?.deprecated,
        equivalent_iris: detail?.equivalent_iris,
        disjoint_iris: detail?.disjoint_iris,
      };

      if (saveMode === "suggest" && onSuggestSave) {
        const label = validLabels[0]?.value || classIri;
        await onSuggestSave(classIri, payload, label);
      } else if (onUpdateClass) {
        await onUpdateClass(classIri, payload);
      }
      clearDraft(key);
      setSaveStatus("saved");

      // Fade "saved" indicator after 2s
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setSaveStatus("error");
      setSaveError(msg);
      onErrorRef.current?.(msg);
    } finally {
      flushingRef.current = false;
    }
  }, [classIri, branch, projectId, canEdit, saveMode, onUpdateClass, onSuggestSave, getDraft, clearDraft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  return {
    saveStatus,
    saveError,
    validationError,
    triggerSave,
    flushToGit,
    discardDraft,
    editStateRef,
    classDetailRef,
    restoredDraft,
    clearRestoredDraft,
  };
}
