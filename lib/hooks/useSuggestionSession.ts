"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  suggestionsApi,
  type SuggestionSavePayload,
} from "@/lib/api/suggestions";

export type SuggestionStatus =
  | "idle"         // No session yet
  | "active"       // Session created, accepting edits
  | "saving"       // Flush in progress
  | "submitting"   // PR creation in progress
  | "submitted"    // PR created successfully
  | "error";

export interface UseSuggestionSessionReturn {
  sessionId: string | null;
  branch: string | null;
  beaconToken: string | null;
  changesCount: number;
  status: SuggestionStatus;
  error: string | null;
  entitiesModified: string[];
  isActive: boolean;
  isResumed: boolean;
  /** Returns the active suggestion branch, or null when a session could not be started. */
  startSession: () => Promise<string | null>;
  /** Resolves true only when the source reached the suggestion branch. */
  saveToSession: (content: string, entityIri: string, entityLabel: string) => Promise<boolean>;
  submitSession: (summary?: string) => Promise<void>;
  discardSession: () => Promise<void>;
  resumeSession: (sessionId: string, branch: string) => void;
  resubmitSession: (summary?: string) => Promise<void>;
}

interface UseSuggestionSessionOptions {
  projectId: string;
  accessToken?: string;
  resumeSessionId?: string;
  resumeBranch?: string;
  onSubmitted?: (prNumber: number, prUrl: string | null) => void;
  onError?: (msg: string) => void;
}

export function useSuggestionSession({
  projectId,
  accessToken,
  resumeSessionId,
  resumeBranch,
  onSubmitted,
  onError,
}: UseSuggestionSessionOptions): UseSuggestionSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [beaconToken, setBeaconToken] = useState<string | null>(null);
  const [changesCount, setChangesCount] = useState(0);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [entitiesModified, setEntitiesModified] = useState<string[]>([]);
  const [isResumed, setIsResumed] = useState(false);

  const savingRef = useRef(false);
  const resumeAttemptedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const branchRef = useRef<string | null>(null);
  const startingRef = useRef<Promise<string | null> | null>(null);

  const startSession = useCallback((): Promise<string | null> => {
    if (sessionIdRef.current) return Promise.resolve(branchRef.current);
    if (!accessToken) return Promise.resolve(null);
    if (startingRef.current) return startingRef.current;

    const startPromise = (async () => {
      try {
        const session = await suggestionsApi.createSession(projectId, accessToken);
        sessionIdRef.current = session.session_id;
        branchRef.current = session.branch;
        setSessionId(session.session_id);
        setBranch(session.branch);
        setBeaconToken(session.beacon_token);
        setStatus("active");
        setError(null);
        return session.branch;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start suggestion session";
        setStatus("error");
        setError(msg);
        onError?.(msg);
        return null;
      } finally {
        startingRef.current = null;
      }
    })();

    startingRef.current = startPromise;
    return startPromise;
  }, [accessToken, projectId, onError]);

  const saveToSession = useCallback(async (
    content: string,
    entityIri: string,
    entityLabel: string,
  ): Promise<boolean> => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || !accessToken || savingRef.current) return false;

    savingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      const payload: SuggestionSavePayload = {
        content,
        entity_iri: entityIri,
        entity_label: entityLabel,
      };
      const result = await suggestionsApi.save(projectId, currentSessionId, payload, accessToken);
      setChangesCount(result.changes_count);

      // Track modified entities (deduplicated)
      setEntitiesModified((prev) => {
        if (prev.includes(entityLabel)) return prev;
        return [...prev, entityLabel];
      });

      setStatus("active");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save suggestion";
      setStatus("error");
      setError(msg);
      onError?.(msg);
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [accessToken, projectId, onError]);

  const submitSession = useCallback(async (summary?: string) => {
    if (!sessionId || !accessToken) return;

    setStatus("submitting");
    setError(null);

    try {
      const result = await suggestionsApi.submit(
        projectId,
        sessionId,
        { summary },
        accessToken,
      );
      setStatus("submitted");
      onSubmitted?.(result.pr_number, result.pr_url);

      // Reset session state so a new session can start
      setSessionId(null);
      setBranch(null);
      sessionIdRef.current = null;
      branchRef.current = null;
      setBeaconToken(null);
      setChangesCount(0);
      setEntitiesModified([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit suggestions";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    }
  }, [sessionId, accessToken, projectId, onSubmitted, onError]);

  const discardSession = useCallback(async () => {
    if (!sessionId || !accessToken) return;

    try {
      await suggestionsApi.discard(projectId, sessionId, accessToken);
    } catch {
      // Best-effort discard — don't block UX
    }

    setSessionId(null);
    setBranch(null);
    sessionIdRef.current = null;
    branchRef.current = null;
    setBeaconToken(null);
    setChangesCount(0);
    setEntitiesModified([]);
    setStatus("idle");
    setError(null);
    setIsResumed(false);
  }, [sessionId, accessToken, projectId]);

  /** Resume an existing changes-requested session without creating a new one. */
  const resumeSession = useCallback((sid: string, branchName: string) => {
    sessionIdRef.current = sid;
    branchRef.current = branchName;
    setSessionId(sid);
    setBranch(branchName);
    setBeaconToken(sid);
    setStatus("active");
    setError(null);
    setIsResumed(true);
  }, []);

  /** Resubmit a resumed session after addressing requested changes. */
  const resubmitSession = useCallback(async (summary?: string) => {
    if (!sessionId || !accessToken) return;

    setStatus("submitting");
    setError(null);

    try {
      const result = await suggestionsApi.resubmit(
        projectId,
        sessionId,
        { summary },
        accessToken,
      );
      setStatus("submitted");
      onSubmitted?.(result.pr_number, result.pr_url);

      // Reset session state
      setSessionId(null);
      setBranch(null);
      sessionIdRef.current = null;
      branchRef.current = null;
      setBeaconToken(null);
      setChangesCount(0);
      setEntitiesModified([]);
      setIsResumed(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resubmit suggestions";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    }
  }, [sessionId, accessToken, projectId, onSubmitted, onError]);

  // Auto-resume on mount if resumeSessionId/resumeBranch are provided
  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    if (!resumeSessionId || !resumeBranch || !accessToken) return;

    resumeAttemptedRef.current = true;

    // Verify the session is still in changes-requested state before resuming
    suggestionsApi
      .listSessions(projectId, accessToken)
      .then((response) => {
        const session = response.items.find(
          (s) => s.session_id === resumeSessionId,
        );
        if (session?.status === "changes-requested") {
          resumeSession(resumeSessionId, resumeBranch);
        } else {
          onError?.("This suggestion session is no longer available for editing.");
        }
      })
      .catch(() => {
        onError?.("Failed to verify suggestion session status.");
      });
  }, [resumeSessionId, resumeBranch, accessToken, projectId, resumeSession, onError]);

  return {
    sessionId,
    branch,
    beaconToken,
    changesCount,
    status,
    error,
    entitiesModified,
    isActive: status === "active" || status === "saving",
    isResumed,
    startSession,
    saveToSession,
    submitSession,
    discardSession,
    resumeSession,
    resubmitSession,
  };
}
