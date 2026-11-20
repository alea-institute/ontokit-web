import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  generationApi,
  type DuplicateCandidate,
  type GeneratedSuggestion,
  type SuggestionType,
} from "@/lib/api/generation";
import { ApiError } from "@/lib/api/client";
import { LLM_STATUS_INVALIDATION_EVENT } from "@/lib/api/llm";
import { storeKey, useSuggestionStore, type StoredSuggestion } from "@/lib/stores/suggestionStore";

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
  hasBatch: boolean;
  isAcceptingAll: boolean;
  eligibleCount: number;
  requestError: string | null;
  isLoading: boolean;
  error: string | null;
  request(): Promise<void>;
  request(batchSize?: number): Promise<void>;
  accept: (index: number) => Promise<void>;
  acceptAll: () => Promise<{ accepted: number; skipped: number }>;
  rejectAll: () => void;
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
      return "This project's AI budget has been exhausted. Ask a project admin to review the budget.";
    case 403:
      return "Your project role does not allow AI suggestions.";
    case 429:
      return "The AI request limit has been reached. Wait before trying again.";
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const acceptingAllRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const acceptingRef = useRef(new Set<number>());
  const [acceptingIndices, setAcceptingIndices] = useState<ReadonlySet<number>>(new Set());

  const store = useSuggestionStore;
  const scope = useMemo(() => ({ projectId, branch }), [projectId, branch]);
  const key = entityIri ? storeKey(scope, entityIri, suggestionType) : null;
  const batch = useSuggestionStore((s) => key ? s.suggestions[key] : undefined);
  const batchId = useSuggestionStore((s) => key ? s.batchIds[key] : undefined);
  const items = batch ?? NO_SUGGESTIONS;

  const canAcceptInBatch = useCallback(({ suggestion, status }: StoredSuggestion) =>
    status === "pending" &&
    !suggestion.validation_errors?.length &&
    suggestion.duplicate_verdict !== "block" &&
    !getAcceptanceError?.(suggestion),
  [getAcceptanceError]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [entityIri]);

  const request = useCallback(async (size?: number) => {
    if (!entityIri || !canUseLLM || !accessToken || acceptingRef.current.size > 0 || acceptingAllRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
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
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [projectId, entityIri, branch, suggestionType, batchSize, canUseLLM, accessToken, byoKey, store, scope]);

  const acceptItem = useCallback(async (index: number, expectedItem?: StoredSuggestion) => {
    if (!entityIri || !key || acceptingRef.current.has(index)) return false;
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
    acceptingRef.current.add(index);
    setAcceptingIndices(new Set(acceptingRef.current));
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
      acceptingRef.current.delete(index);
      setAcceptingIndices(new Set(acceptingRef.current));
    }
  }, [entityIri, suggestionType, store, onAccepted, getAcceptanceError, scope, key]);

  const accept = useCallback(async (index: number) => {
    if (!acceptingAllRef.current) {
      setRequestError(null);
      await acceptItem(index);
    }
  }, [acceptItem]);

  const acceptAll = useCallback(async () => {
    const current = key ? store.getState().suggestions[key] ?? NO_SUGGESTIONS : NO_SUGGESTIONS;
    const pending = current.filter((item) => item.status === "pending").length;
    let accepted = 0;
    if (acceptingAllRef.current || acceptingRef.current.size > 0 || isLoading) {
      return { accepted, skipped: pending };
    }
    acceptingAllRef.current = true;
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
      acceptingAllRef.current = false;
      setIsAcceptingAll(false);
    }
  }, [acceptItem, canAcceptInBatch, isLoading, key, store]);

  const rejectAll = useCallback(() => {
    if (!entityIri || acceptingAllRef.current || acceptingRef.current.size > 0 || isLoading) return;
    store.getState().rejectPendingSuggestions(scope, entityIri, suggestionType);
    setError(null);
  }, [entityIri, isLoading, scope, store, suggestionType]);

  const reject = useCallback((index: number) => {
    if (!entityIri || acceptingAllRef.current || acceptingRef.current.has(index)) return;
    store.getState().rejectSuggestion(scope, entityIri, suggestionType, index);
  }, [entityIri, suggestionType, store, scope]);

  const edit = useCallback((index: number, value: string, definition?: string) => {
    if (!entityIri || acceptingAllRef.current || acceptingRef.current.has(index)) return;
    store.getState().editSuggestion(scope, entityIri, suggestionType, index, value, definition);
  }, [entityIri, suggestionType, store, scope]);

  const markDistinct = useCallback((index: number, candidate: DuplicateCandidate) => {
    if (!entityIri) return;
    store.getState().removeDuplicateCandidate(
      scope,
      entityIri,
      suggestionType,
      index,
      candidate,
    );
  }, [entityIri, suggestionType, store, scope]);

  return {
    items,
    batchId,
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
    acceptingIndices,
    reject,
    edit,
    markDistinct,
  };
}
