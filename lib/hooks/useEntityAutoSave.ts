/**
 * Generic auto-save hook for properties and individuals.
 *
 * Uses the same draft and completion ownership rules as class auto-save.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useDraftStore, draftKey, type AnyDraftEntry } from "@/lib/stores/draftStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import type { SaveOrigin } from "@/lib/editor/autoSave";

export type SaveStatus = "idle" | "draft" | "saving" | "saved" | "error";

interface UseEntityAutoSaveOptions {
  projectId: string;
  branch: string;
  entityIri: string | null;
  canEdit: boolean;
  onFlush?: (iri: string) => Promise<void>;
  onError?: (msg: string) => void;
  /** Announces the first successful navigate-away auto-save for this browser profile. */
  onFirstAutoSave?: () => void;
  /** Build a draft entry from the current edit state */
  buildDraftEntry: () => AnyDraftEntry | null;
  /** Validate before saving — return error message or null */
  validate?: () => string | null;
}

export interface UseEntityAutoSaveReturn {
  saveStatus: SaveStatus;
  saveError: string | null;
  validationError: string | null;
  triggerSave: () => void;
  flushToGit: (origin?: SaveOrigin) => Promise<boolean>;
  discardDraft: () => void;
  restoredDraft: AnyDraftEntry | null;
  clearRestoredDraft: () => void;
}

export function useEntityAutoSave({
  projectId,
  branch,
  entityIri,
  canEdit,
  onFlush,
  onError,
  onFirstAutoSave,
  buildDraftEntry,
  validate,
}: UseEntityAutoSaveOptions): UseEntityAutoSaveReturn {
  const { setDraft, clearDraft, getDraft } = useDraftStore();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onFirstAutoSaveRef = useRef(onFirstAutoSave);
  onFirstAutoSaveRef.current = onFirstAutoSave;
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;
  const buildDraftEntryRef = useRef(buildDraftEntry);
  buildDraftEntryRef.current = buildDraftEntry;
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<AnyDraftEntry | null>(null);

  const scopeKey = JSON.stringify([projectId, branch, entityIri]);
  const scopeRef = useRef({ key: scopeKey });
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey };
  const mountedRef = useRef(true);
  const editGenerationRef = useRef(0);
  const flushingRef = useRef<object | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for restored draft on entity change
  useEffect(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setRestoredDraft(null);
    setSaveStatus("idle");
    setSaveError(null);
    setValidationError(null);
    if (!entityIri || !branch) return;
    const key = draftKey(projectId, branch, entityIri);
    const draft = getDraft(key);
    if (draft) {
      setRestoredDraft(draft);
    }
  }, [entityIri, branch, projectId, getDraft]);

  const clearRestoredDraft = useCallback(() => {
    setRestoredDraft(null);
  }, []);

  const discardDraft = useCallback(() => {
    editGenerationRef.current++;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    if (!entityIri || !branch) return;
    const key = draftKey(projectId, branch, entityIri);
    clearDraft(key);
    setSaveStatus("idle");
    setSaveError(null);
    setValidationError(null);
    setRestoredDraft(null);
  }, [entityIri, branch, projectId, clearDraft]);

  // Save edit state to draft store (Tier 1: instant, local)
  const triggerSave = useCallback(() => {
    editGenerationRef.current++;
    if (!entityIri || !branch || !canEdit) return;

    // Validate
    const error = validateRef.current?.();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);

    const entry = buildDraftEntryRef.current();
    if (!entry) return;

    const key = draftKey(projectId, branch, entityIri);
    setDraft(key, entry);
    setSaveStatus("draft");
    setSaveError(null);

    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, [entityIri, branch, projectId, canEdit, setDraft]);

  // Flush draft to git (Tier 2: commit on navigate away)
  // Returns true on success, false on error or no-op
  const flushToGit = useCallback(async (origin: SaveOrigin = "auto"): Promise<boolean> => {
    if (flushingRef.current === scopeRef.current) return false;
    if (!entityIri || !branch || !canEdit || !onFlushRef.current) return false;

    // Re-validate current edit state to prevent flushing a stale draft
    // after triggerSave() aborted on validation
    const error = validateRef.current?.();
    if (error) {
      setValidationError(error);
      return false;
    }
    setValidationError(null);

    const key = draftKey(projectId, branch, entityIri);
    const draft = getDraft(key);
    if (!draft) return false;

    const scope = scopeRef.current;
    const generation = editGenerationRef.current;
    const isCurrent = () => mountedRef.current && scopeRef.current === scope
      && editGenerationRef.current === generation;
    flushingRef.current = scope;
    setSaveStatus("saving");
    setSaveError(null);

    try {
      await onFlushRef.current(entityIri);
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
  }, [entityIri, branch, projectId, canEdit, getDraft, clearDraft]);

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
    restoredDraft,
    clearRestoredDraft,
  };
}
