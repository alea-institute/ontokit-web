import { useState, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import {
  generationApi,
  type DuplicateCandidate,
  type GeneratedSuggestion,
  type SuggestionType,
} from "@/lib/api/generation";
import { ApiError } from "@/lib/api/client";
import { LLM_STATUS_INVALIDATION_EVENT } from "@/lib/api/llm";
import { storeKey, suggestionBatchBusyReason, useSuggestionStore, type StoredSuggestion } from "@/lib/stores/suggestionStore";

export interface UseSuggestionsOptions {
  projectId: string;
  entityIri: string | null;
  branch: string;
  suggestionType: SuggestionType;
  batchSize?: number;
  canUseLLM: boolean;
  accessToken?: string;
  byoKey?: string;
  onAccepted?: (suggestion: GeneratedSuggestion, editedValue?: string) => void | Promise<void>;
  getAcceptanceError?: (suggestion: GeneratedSuggestion) => string | null;
}

export interface UseSuggestionsReturn {
  items: StoredSuggestion[];
  batchId?: string;
  batchVersion?: number;
  busyReason?: string;
  hasBatch: boolean;
  isAcceptingAll: boolean;
  eligibleCount: number;
  requestError: string | null;
  isLoading: boolean;
  error: string | null;
  request(): Promise<void>;
  request(batchSize?: number, onSettled?: () => void): Promise<void>;
  accept: (index: number) => Promise<void>;
  acceptAll: () => Promise<{ accepted: number; skipped: number }>;
  rejectAll: () => void;
  restoreRejected: () => void;
  acceptingIndices: ReadonlySet<number>;
  reject: (index: number) => void;
  edit: (index: number, value: string, definition?: string) => void;
  markDistinct: (index: number, candidate: DuplicateCandidate) => void;
}

// Stable fallback so the store selector returns a referentially-equal
// snapshot when an entity has no suggestions — a fresh [] per call makes
// useSyncExternalStore's getSnapshot unstable and React 19 aborts the
// render ("The result of getSnapshot should be cached").
const NO_SUGGESTIONS: StoredSuggestion[] = [];

export function generationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Could not generate suggestions.";
  }
  switch (error.status) {
    case 400:
      return "No generation model is configured. Choose a model in project AI settings.";
    case 402:
      return error.detail === "Daily spending cap reached for this project."
        ? "This project's daily AI spending cap has been reached. Try again tomorrow, or ask a project admin to raise the cap."
        : "This project's monthly AI budget is used up. Ask a project admin to review the budget.";
    case 403:
      return "Your project role does not allow AI suggestions.";
    case 429:
      return "You've reached today's AI request limit for your role. Try again tomorrow.";
    case 500:
      return "The AI service encountered an unexpected error. Try again, and contact support if the problem continues.";
    case 502:
      return "The configured AI provider is unavailable. Check the provider connection and try again.";
    case 503:
      return "Model pricing is unavailable. Choose a registry model or a local provider in project AI settings.";
    default:
      return "Could not generate suggestions.";
  }
}

export function useSuggestions(opts: UseSuggestionsOptions): UseSuggestionsReturn {
  const {
    projectId, entityIri, branch, suggestionType,
    batchSize = 5, canUseLLM, accessToken, byoKey, onAccepted, getAcceptanceError,
  } = opts;

  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [acceptingIndices, setAcceptingIndices] = useState<ReadonlySet<number>>(new Set());

  const store = useSuggestionStore;
  const scope = useMemo(() => ({ projectId, branch }), [projectId, branch]);
  const key = entityIri ? storeKey(scope, entityIri, suggestionType) : null;
  const batch = useSuggestionStore((s) => key ? s.suggestions[key] : undefined);
  const batchId = useSuggestionStore((s) => key ? s.batchIds[key] : undefined);
  const batchVersion = useSuggestionStore((s) => key ? s.batchVersions[key] : undefined);
  const operation = useSuggestionStore((s) => key ? s.batchOperations[key] : undefined);
  const isLoading = operation === "generating";
  const busyReason = suggestionBatchBusyReason(operation);
  const items = batch ?? NO_SUGGESTIONS;

  const canAcceptInBatch = useCallback(({ suggestion, status }: StoredSuggestion) =>
    status === "pending" &&
    !suggestion.validation_errors?.length &&
    suggestion.duplicate_verdict !== "block" &&
    !getAcceptanceError?.(suggestion),
  [getAcceptanceError]);

  useLayoutEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [key]);

  const request = useCallback(async (size?: number, onSettled?: () => void) => {
    if (!entityIri || !key || !canUseLLM || !accessToken) return;
    abortRef.current?.abort();
    const state = store.getState();
    const release = state.beginBatchOperation(key, "generating");
    if (!release) {
      setRequestError(suggestionBatchBusyReason(state.batchOperations[key]) ?? null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    controller.signal.addEventListener("abort", release, { once: true });

    setError(null);
    setRequestError(null);
    try {
      const response = await generationApi.generateSuggestions(
        projectId,
        { class_iri: entityIri, branch, suggestion_type: suggestionType, batch_size: typeof size === "number" ? size : batchSize },
        accessToken,
        byoKey,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        store.getState().setSuggestions(scope, entityIri, suggestionType, response.suggestions, response.batch_id);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setRequestError(generationErrorMessage(err));
        if (err instanceof ApiError && (err.status === 402 || err.status === 429)) {
          window.dispatchEvent(
            new CustomEvent(LLM_STATUS_INVALIDATION_EVENT, { detail: { projectId } }),
          );
        }
      }
    } finally {
      controller.signal.removeEventListener("abort", release);
      release();
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) onSettled?.();
    }
  }, [projectId, entityIri, key, branch, suggestionType, batchSize, canUseLLM, accessToken, byoKey, store, scope]);

  const acceptItem = useCallback(async (index: number, expectedItem?: StoredSuggestion) => {
    if (!entityIri || !key) return false;
    const stored = store.getState().suggestions[key]?.[index];
    if (!stored || stored.status !== "pending" || (expectedItem && stored !== expectedItem)) {
      if (expectedItem) setError("The suggestion list changed. Review the new suggestions and try again.");
      return false;
    }
    if ((stored.suggestion.validation_errors?.length ?? 0) > 0) {
      setError("This suggestion cannot be accepted until its validation errors are resolved.");
      return false;
    }
    const acceptanceError = getAcceptanceError?.(stored.suggestion);
    if (acceptanceError) {
      setError(acceptanceError);
      return false;
    }
    setError(null);
    setAcceptingIndices(new Set([index]));
    try {
      const suggestion = stored.editedDefinition === undefined
        ? stored.suggestion
        : { ...stored.suggestion, definition: stored.editedDefinition };
      await onAccepted?.(suggestion, stored.editedValue);
      const current = store.getState().suggestions[key]?.[index];
      if (current !== stored) {
        setError("The suggestion list changed before acceptance completed. Review the new suggestions and retry.");
        return false;
      }
      store.getState().acceptSuggestion(scope, entityIri, suggestionType, index);
      return true;
    } catch (err) {
      const reason = err instanceof Error && err.message
        ? err.message
        : "The change could not be persisted.";
      setError(`Could not accept this suggestion. ${reason}`);
      return false;
    } finally {
      setAcceptingIndices(new Set());
    }
  }, [entityIri, suggestionType, store, onAccepted, getAcceptanceError, scope, key]);

  const accept = useCallback(async (index: number) => {
    const release = key && store.getState().beginBatchOperation(key, "accepting");
    if (!release) return;
    setRequestError(null);
    try {
      await acceptItem(index);
    } finally {
      release();
    }
  }, [acceptItem, key, store]);

  const acceptAll = useCallback(async () => {
    const current = key ? store.getState().suggestions[key] ?? NO_SUGGESTIONS : NO_SUGGESTIONS;
    const pending = current.filter((item) => item.status === "pending").length;
    let accepted = 0;
    const release = key && store.getState().beginBatchOperation(key, "accepting");
    if (!release) return { accepted, skipped: pending };
    setIsAcceptingAll(true);
    setRequestError(null);
    try {
      for (const [index, item] of current.entries()) {
        if (!canAcceptInBatch(item)) continue;
        if (!(await acceptItem(index, item))) break;
        accepted += 1;
      }
      return { accepted, skipped: pending - accepted };
    } finally {
      setIsAcceptingAll(false);
      release();
    }
  }, [acceptItem, canAcceptInBatch, key, store]);

  const rejectAll = useCallback(() => {
    if (!entityIri || !key || store.getState().batchOperations[key]) return;
    store.getState().rejectPendingSuggestions(scope, entityIri, suggestionType);
    setError(null);
  }, [entityIri, key, scope, store, suggestionType]);

  const restoreRejected = useCallback(() => {
    if (!entityIri || !key || store.getState().batchOperations[key]) return;
    store.getState().restoreRejectedSuggestions(scope, entityIri, suggestionType);
  }, [entityIri, key, scope, store, suggestionType]);

  const reject = useCallback((index: number) => {
    if (!entityIri || !key || store.getState().batchOperations[key]) return;
    store.getState().rejectSuggestion(scope, entityIri, suggestionType, index);
  }, [entityIri, key, suggestionType, store, scope]);

  const edit = useCallback((index: number, value: string, definition?: string) => {
    if (!entityIri || !key || store.getState().batchOperations[key]) return;
    store.getState().editSuggestion(scope, entityIri, suggestionType, index, value, definition);
  }, [entityIri, key, suggestionType, store, scope]);

  const markDistinct = useCallback((index: number, candidate: DuplicateCandidate) => {
    if (!entityIri || !key || store.getState().batchOperations[key]) return;
    store.getState().removeDuplicateCandidate(
      scope,
      entityIri,
      suggestionType,
      index,
      candidate,
    );
  }, [entityIri, key, suggestionType, store, scope]);

  return {
    items,
    batchId,
    batchVersion,
    busyReason,
    hasBatch: batch !== undefined,
    eligibleCount: items.filter(canAcceptInBatch).length,
    isLoading,
    isAcceptingAll,
    requestError,
    error: error ?? requestError,
    request,
    accept,
    acceptAll,
    rejectAll,
    restoreRejected,
    acceptingIndices,
    reject,
    edit,
    markDistinct,
  };
}
