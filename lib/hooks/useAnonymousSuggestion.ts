"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  anonymousSuggestionsApi,
  type SuggestionSavePayload,
} from "@/lib/api/suggestions";
import {
  useAnonymousTokenStore,
} from "@/lib/stores/anonymousCreditStore";

import type { SuggestionStatus } from "@/lib/hooks/useSuggestionSession";

// Re-export SuggestionStatus so callers can use it from this module too
export type { SuggestionStatus };

export interface UseAnonymousSuggestionReturn {
  sessionId: string | null;
  branch: string | null;
  anonymousToken: string | null;
  changesCount: number;
  status: SuggestionStatus;
  error: string | null;
  entitiesModified: string[];
  isActive: boolean;
  startSession: () => Promise<void>;
  /** Resolves true only when the save actually reached the session branch. */
  saveToSession: (content: string, entityIri: string, entityLabel: string) => Promise<boolean>;
  /** `website` is the honeypot value — forward verbatim from CreditModal. */
  submitSession: (
    summary?: string,
    submitterName?: string,
    submitterEmail?: string,
    website?: string,
  ) => Promise<void>;
  discardSession: () => Promise<void>;
}

interface UseAnonymousSuggestionOptions {
  projectId: string;
  onSubmitted?: (prNumber: number, prUrl: string | null) => void;
  onError?: (msg: string) => void;
}

/**
 * Manages the full anonymous suggestion session lifecycle.
 *
 * Mirrors useSuggestionSession but uses anonymous tokens
 * (X-Anonymous-Token header) instead of Bearer tokens.
 * The anonymous token is persisted in sessionStorage via useAnonymousTokenStore
 * and restored on mount so sessions survive page navigations.
 *
 * Only usable when AUTH_MODE is "optional" or "disabled" on the server.
 */
export function useAnonymousSuggestion({
  projectId,
  onSubmitted,
  onError,
}: UseAnonymousSuggestionOptions): UseAnonymousSuggestionReturn {
  const tokenStore = useAnonymousTokenStore();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [anonymousToken, setAnonymousToken] = useState<string | null>(null);
  const [changesCount, setChangesCount] = useState(0);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [entitiesModified, setEntitiesModified] = useState<string[]>([]);

  const savingRef = useRef(false);
  const submittingRef = useRef(false);
  const restoredRef = useRef(false);

  // Restore any unexpired active session from sessionStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const entry = tokenStore.getToken(projectId);
    if (entry) {
      setSessionId(entry.sessionId);
      setBranch(entry.branch);
      setAnonymousToken(entry.token);
      setStatus("active");
    }
  // Only run once on mount — tokenStore.getToken is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startSession = useCallback(async () => {
    // Don't create a duplicate session if one already exists
    if (sessionId) return;

    try {
      const session = await anonymousSuggestionsApi.createSession(projectId);

      // Persist the 24-hour token lifetime before updating state. The server's
      // created_at is authoritative when valid; Date.now is the safe fallback.
      const serverIssuedAt = Date.parse(session.created_at);
      tokenStore.setToken(
        projectId,
        session.anonymous_token,
        session.session_id,
        session.branch,
        Number.isNaN(serverIssuedAt) ? Date.now() : serverIssuedAt,
      );

      setSessionId(session.session_id);
      setBranch(session.branch);
      setAnonymousToken(session.anonymous_token);
      setStatus("active");
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start anonymous suggestion session";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    }
  }, [sessionId, projectId, tokenStore, onError]);

  const saveToSession = useCallback(async (
    content: string,
    entityIri: string,
    entityLabel: string,
  ): Promise<boolean> => {
    // Returns true only when the save actually happened — callers must NOT
    // report success (or update local state) on a false return (a concurrent
    // save was in flight, the session is missing, or the request failed).
    if (!sessionId || !anonymousToken || savingRef.current) return false;

    savingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      const payload: SuggestionSavePayload = {
        content,
        entity_iri: entityIri,
        entity_label: entityLabel,
      };
      const result = await anonymousSuggestionsApi.save(projectId, sessionId, payload, anonymousToken);
      setChangesCount(result.changes_count);

      // Track modified entities (deduplicated by label)
      setEntitiesModified((prev) => {
        if (prev.includes(entityLabel)) return prev;
        return [...prev, entityLabel];
      });

      setStatus("active");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save anonymous suggestion";
      setStatus("error");
      setError(msg);
      onError?.(msg);
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [sessionId, anonymousToken, projectId, onError]);

  const submitSession = useCallback(async (
    summary?: string,
    submitterName?: string,
    submitterEmail?: string,
    website: string = "",
  ) => {
    // Double-submit guard: a fast second click while the first submit is in
    // flight must not open two PRs for the same session.
    if (!sessionId || !anonymousToken || submittingRef.current) return;
    submittingRef.current = true;

    setStatus("submitting");
    setError(null);

    try {
      const result = await anonymousSuggestionsApi.submit(
        projectId,
        sessionId,
        {
          summary,
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          // Honeypot: forwarded VERBATIM — empty for humans (the visible form
          // never touches it); bots fill it and the server silently fakes
          // success. The client must not sanitize this to "".
          website,
        },
        anonymousToken,
      );

      // Clear persisted token on successful submit
      tokenStore.clearToken(projectId);

      setStatus("submitted");
      onSubmitted?.(result.pr_number, result.pr_url);

      // Reset session state so a new session can start
      setSessionId(null);
      setBranch(null);
      setAnonymousToken(null);
      setChangesCount(0);
      setEntitiesModified([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit anonymous suggestions";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    } finally {
      submittingRef.current = false;
    }
  }, [sessionId, anonymousToken, projectId, tokenStore, onSubmitted, onError]);

  const discardSession = useCallback(async () => {
    if (!sessionId || !anonymousToken) return;

    try {
      await anonymousSuggestionsApi.discard(projectId, sessionId, anonymousToken);
    } catch {
      // Best-effort discard — don't block UX on network failure
    }

    // Clear persisted token regardless of API success
    tokenStore.clearToken(projectId);

    setSessionId(null);
    setBranch(null);
    setAnonymousToken(null);
    setChangesCount(0);
    setEntitiesModified([]);
    setStatus("idle");
    setError(null);
  }, [sessionId, anonymousToken, projectId, tokenStore]);

  return {
    sessionId,
    branch,
    anonymousToken,
    changesCount,
    status,
    error,
    entitiesModified,
    isActive: status === "active" || status === "saving",
    startSession,
    saveToSession,
    submitSession,
    discardSession,
  };
}
