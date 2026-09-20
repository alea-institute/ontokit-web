import { useState, useRef, useCallback, useEffect } from "react";
import { useDraftStore, draftKey, type DraftEntry } from "@/lib/stores/draftStore";
import type { LocalizedString, AnnotationUpdate, ClassUpdatePayload } from "@/lib/api/client";
import type { RelationshipGroup } from "@/components/editor/standard/RelationshipSection";
import type { OWLClassDetail } from "@/lib/api/client";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { RELATIONSHIP_PROPERTY_IRIS } from "@/lib/ontology/annotationProperties";
import type { SaveOrigin } from "@/lib/editor/autoSave";

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
  /** Announces the first successful navigate-away auto-save for this browser profile. */
  onFirstAutoSave?: () => void;
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
  flushToGit: (origin?: SaveOrigin) => Promise<boolean>;
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
  onFirstAutoSave,
  saveMode = "commit",
  onSuggestSave,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const { setDraft, clearDraft, getDraft } = useDraftStore();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onFirstAutoSaveRef = useRef(onFirstAutoSave);
  onFirstAutoSaveRef.current = onFirstAutoSave;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<DraftEntry | null>(null);

  // Refs to hold current edit state so flush closure reads latest values
  const editStateRef = useRef<EditState | null>(null);
  const classDetailRef = useRef<OWLClassDetail | null>(null);
  const scopeKey = JSON.stringify([projectId, branch, classIri]);
  const scopeRef = useRef({ key: scopeKey });
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey };
  const mountedRef = useRef(true);
  const editGenerationRef = useRef(0);
  const flushingRef = useRef<object | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep classDetail ref up to date
  useEffect(() => {
    classDetailRef.current = classDetail;
  }, [classDetail]);

  // Check for restored draft on class change
  useEffect(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setRestoredDraft(null);
    setSaveStatus("idle");
    setSaveError(null);
    setValidationError(null);
    if (!classIri || !branch) return;
    const key = draftKey(projectId, branch, classIri);
    const draft = getDraft(key);
    // Only restore class drafts (no entityType or entityType === "class")
    if (draft && (!draft.entityType || draft.entityType === "class")) {
      setRestoredDraft(draft as DraftEntry);
    }
  }, [classIri, branch, projectId, getDraft]);

  const clearRestoredDraft = useCallback(() => {
    setRestoredDraft(null);
  }, []);

  // Discard draft for current classIri (used by Cancel)
  const discardDraft = useCallback(() => {
    editGenerationRef.current++;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
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
    editGenerationRef.current++;
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
  // Returns true on success, false on error or no-op
  const flushToGit = useCallback(async (origin: SaveOrigin = "auto"): Promise<boolean> => {
    if (flushingRef.current === scopeRef.current) return false;
    const canFlush = canEdit || saveMode === "suggest";
    const hasHandler = saveMode === "suggest" ? !!onSuggestSave : !!onUpdateClass;
    if (!classIri || !branch || !canFlush || !hasHandler) return false;

    // Re-validate current edit state to prevent flushing a stale draft
    // after triggerSave() aborted on validation
    const state = editStateRef.current;
    if (state && state.labels.every((l) => !l.value.trim())) {
      setValidationError("At least one label is required");
      return false;
    }
    setValidationError(null);

    const key = draftKey(projectId, branch, classIri);
    const rawDraft = getDraft(key);
    if (!rawDraft) return false;
    // Only flush class drafts
    if (rawDraft.entityType && rawDraft.entityType !== "class") return false;
    const draft = rawDraft as DraftEntry;

    const detail = classDetailRef.current;

    const scope = scopeRef.current;
    const generation = editGenerationRef.current;
    const isCurrent = () => mountedRef.current && scopeRef.current === scope
      && editGenerationRef.current === generation;
    flushingRef.current = scope;
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

      // Explicit empty updates remove managed predicates after a group is
      // cleared or changes property. Omitted unrelated annotations stay intact.
      const relationshipAnnotations: AnnotationUpdate[] = draft.relationships
        .map((g) => ({
          property_iri: g.property_iri,
          values: g.targets.map((t) => ({ value: t.iri, lang: "" })),
        }));

      for (const annotation of detail?.annotations ?? []) {
        if (RELATIONSHIP_PROPERTY_IRIS.has(annotation.property_iri)
          && !relationshipAnnotations.some((group) => group.property_iri === annotation.property_iri)) {
          relationshipAnnotations.push({ property_iri: annotation.property_iri, values: [] });
        }
      }

      const validLabels = draft.labels.filter((l) => l.value.trim());

      const payload: ClassUpdatePayload = {
        labels: validLabels,
        comments: draft.comments.filter((c) => c.value.trim()),
        parent_iris: draft.parentIris,
        annotations: [...cleanAnnotations, ...relationshipAnnotations],
        deprecated: detail?.deprecated,
        equivalent_iris: detail?.equivalent_iris ?? undefined,
        disjoint_iris: detail?.disjoint_iris ?? undefined,
      };

      if (saveMode === "suggest" && onSuggestSave) {
        const label = validLabels[0]?.value || classIri;
        await onSuggestSave(classIri, payload, label);
      } else if (onUpdateClass) {
        await onUpdateClass(classIri, payload);
      }
      // A successful write owns only the exact draft it submitted. A timestamp
      // cannot distinguish edits made in the same clock tick.
      const ownsDraft = getDraft(key) === draft;
      if (ownsDraft) clearDraft(key);
      if (!isCurrent() || !ownsDraft) return true;
      setSaveStatus("saved");

      if (origin === "auto") {
        const claimed = await useEditorModeStore.getState().claimAutoSaveTeachingToast();
        if (!isCurrent() || getDraft(key)) return true;
        if (claimed) onFirstAutoSaveRef.current?.();
      }

      // The teaching announcement can itself cause navigation or another edit.
      if (isCurrent() && !getDraft(key)) {
        savedTimerRef.current = setTimeout(() => {
          if (isCurrent() && !getDraft(key)) setSaveStatus("idle");
        }, 2000);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      if (isCurrent() && getDraft(key) === draft) {
        setSaveStatus("error");
        setSaveError(msg);
        onErrorRef.current?.(msg);
      }
      return false;
    } finally {
      if (flushingRef.current === scope) flushingRef.current = null;
    }
  }, [classIri, branch, projectId, canEdit, saveMode, onUpdateClass, onSuggestSave, getDraft, clearDraft]);

  // Cleanup timer on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
