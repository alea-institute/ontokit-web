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
  /** Stable account identity; token renewal alone must not lose an active draft. */
  viewerId?: string;
  resumeSessionId?: string;
  resumeBranch?: string;
  onSubmitted?: (prNumber: number, prUrl: string | null) => void;
  onError?: (msg: string) => void;
}

export function useSuggestionSession({
  projectId,
  accessToken,
  viewerId,
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
  const resumeAttemptedRef = useRef<{ sessionId: string; branch: string } | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const branchRef = useRef<string | null>(null);
  const startingRef = useRef<Promise<string | null> | null>(null);

  // Credentials may renew while a terminal operation is still committing on the
  // server. Its successful result belongs to the account/session, not the token.
  const isAuthenticated = !!accessToken;
  const ownerRef = useRef({ projectId, viewerId, isAuthenticated, live: true });
  if (ownerRef.current.projectId !== projectId || ownerRef.current.viewerId !== viewerId
    || ownerRef.current.isAuthenticated !== isAuthenticated) {
    ownerRef.current = { projectId, viewerId, isAuthenticated, live: true };
  }
  const owner = ownerRef.current;
  const terminalRef = useRef<{ owner: typeof owner; sessionId: string } | null>(null);
  useEffect(() => {
    owner.live = true;
    return () => { owner.live = false; };
  }, [owner]);

  const scopeRef = useRef({ projectId, accessToken, viewerId, live: true });
  if (scopeRef.current.projectId !== projectId || scopeRef.current.accessToken !== accessToken || scopeRef.current.viewerId !== viewerId) {
    scopeRef.current = { projectId, accessToken, viewerId, live: true };
  }
  const scope = scopeRef.current;
  const isCurrent = useCallback(() => scopeRef.current === scope && scope.live, [scope]);

  useEffect(() => {
    scope.live = true;
    savingRef.current = false;
    startingRef.current = null;
    resumeAttemptedRef.current = null;
    setStatus((current) => !terminalRef.current && (current === "saving" || current === "submitting")
      ? (sessionIdRef.current ? "active" : "idle") : current);
    return () => { scope.live = false; };
  }, [scope]);

  useEffect(() => {
    terminalRef.current = null;
    sessionIdRef.current = null;
    branchRef.current = null;
    setSessionId(null);
    setBranch(null);
    setBeaconToken(null);
    setChangesCount(0);
    setEntitiesModified([]);
    setStatus("idle");
    setError(null);
    setIsResumed(false);
  }, [projectId, isAuthenticated, viewerId]);

  const startSession = useCallback((): Promise<string | null> => {
    if (!isCurrent() || terminalRef.current) return Promise.resolve(null);
    if (sessionIdRef.current) {
      setStatus("active");
      setError(null);
      return Promise.resolve(branchRef.current);
    }
    if (!accessToken) return Promise.resolve(null);
    if (startingRef.current) return startingRef.current;

    const startPromise = (async () => {
      try {
        const session = await suggestionsApi.createSession(projectId, accessToken);
        if (!isCurrent()) return null;
        sessionIdRef.current = session.session_id;
        branchRef.current = session.branch;
        setSessionId(session.session_id);
        setBranch(session.branch);
        setBeaconToken(session.beacon_token);
        setStatus("active");
        setError(null);
        return session.branch;
      } catch (err) {
        if (!isCurrent()) return null;
        const msg = err instanceof Error ? err.message : "Failed to start suggestion session";
        setStatus("error");
        setError(msg);
        onError?.(msg);
        return null;
      } finally {
        if (isCurrent()) startingRef.current = null;
      }
    })();

    startingRef.current = startPromise;
    return startPromise;
  }, [accessToken, projectId, onError, isCurrent]);

  const saveToSession = useCallback(async (
    content: string,
    entityIri: string,
    entityLabel: string,
  ): Promise<boolean> => {
    const currentSessionId = sessionIdRef.current;
    if (!isCurrent() || !currentSessionId || !accessToken || savingRef.current || terminalRef.current) return false;

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
      if (!isCurrent() || sessionIdRef.current !== currentSessionId || terminalRef.current) return false;
      setChangesCount(result.changes_count);

      // Track modified entities (deduplicated)
      setEntitiesModified((prev) => {
        if (prev.includes(entityLabel)) return prev;
        return [...prev, entityLabel];
      });

      setStatus("active");
      return true;
    } catch (err) {
      if (!isCurrent() || sessionIdRef.current !== currentSessionId || terminalRef.current) return false;
      const msg = err instanceof Error ? err.message : "Failed to save suggestion";
      setStatus("error");
      setError(msg);
      onError?.(msg);
      return false;
    } finally {
      if (isCurrent()) savingRef.current = false;
    }
  }, [accessToken, projectId, onError, isCurrent]);

  const beginTerminal = useCallback((allowPendingSave = false) => {
    if (!isCurrent() || !sessionId || !accessToken || (!allowPendingSave && savingRef.current) || terminalRef.current) return null;
    const operation = { owner, sessionId };
    terminalRef.current = operation;
    // Invalidate a verification dispatched before this terminal operation.
    if (resumeAttemptedRef.current) resumeAttemptedRef.current = { ...resumeAttemptedRef.current };
    return operation;
  }, [accessToken, isCurrent, owner, sessionId]);
  const ownsTerminal = useCallback((operation: NonNullable<typeof terminalRef.current>) =>
    terminalRef.current === operation && ownerRef.current === operation.owner
      && operation.owner.live && sessionIdRef.current === operation.sessionId, []);

  const submitSession = useCallback(async (summary?: string) => {
    const operation = beginTerminal();
    if (!operation || !sessionId || !accessToken) return;

    setStatus("submitting");
    setError(null);

    try {
      const result = await suggestionsApi.submit(
        projectId,
        sessionId,
        { summary },
        accessToken,
      );
      if (!ownsTerminal(operation)) return;
      terminalRef.current = null;
      setStatus("submitted");

      // Reset session state so a new session can start
      setSessionId(null);
      setBranch(null);
      sessionIdRef.current = null;
      branchRef.current = null;
      setBeaconToken(null);
      setChangesCount(0);
      setEntitiesModified([]);
      setIsResumed(false);
      onSubmitted?.(result.pr_number, result.pr_url);
    } catch (err) {
      if (!ownsTerminal(operation)) return;
      terminalRef.current = null;
      if (!isCurrent()) { setStatus("active"); return; }
      const msg = err instanceof Error ? err.message : "Failed to submit suggestions";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    }
  }, [sessionId, accessToken, projectId, onSubmitted, onError, isCurrent, beginTerminal, ownsTerminal]);

  const discardSession = useCallback(async () => {
    // Branch navigation may discard while its last autosave is still pending.
    const operation = beginTerminal(true);
    if (!operation || !sessionId || !accessToken) return;

    try {
      await suggestionsApi.discard(projectId, sessionId, accessToken);
    } catch {
      // Best-effort discard, but an expired credential must leave a retryable
      // session when fresh credentials arrived while the request was pending.
      if (!ownsTerminal(operation)) return;
      if (!isCurrent()) {
        terminalRef.current = null;
        setStatus("active");
        return;
      }
    }

    if (!ownsTerminal(operation)) return;
    terminalRef.current = null;
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
  }, [sessionId, accessToken, projectId, isCurrent, beginTerminal, ownsTerminal]);

  /** Resume an existing changes-requested session without creating a new one. */
  const resumeSession = useCallback((sid: string, branchName: string) => {
    if (!isCurrent()) return;
    if (terminalRef.current?.sessionId === sid) return;
    terminalRef.current = null;
    sessionIdRef.current = sid;
    branchRef.current = branchName;
    setSessionId(sid);
    setBranch(branchName);
    // Session summaries do not provide a server-issued beacon token.
    setBeaconToken(null);
    setStatus("active");
    setError(null);
    setIsResumed(true);
  }, [isCurrent]);

  /** Resubmit a resumed session after addressing requested changes. */
  const resubmitSession = useCallback(async (summary?: string) => {
    const operation = beginTerminal();
    if (!operation || !sessionId || !accessToken) return;

    setStatus("submitting");
    setError(null);

    try {
      const result = await suggestionsApi.resubmit(
        projectId,
        sessionId,
        { summary },
        accessToken,
      );
      if (!ownsTerminal(operation)) return;
      terminalRef.current = null;
      setStatus("submitted");

      // Reset session state
      setSessionId(null);
      setBranch(null);
      sessionIdRef.current = null;
      branchRef.current = null;
      setBeaconToken(null);
      setChangesCount(0);
      setEntitiesModified([]);
      setIsResumed(false);
      onSubmitted?.(result.pr_number, result.pr_url);
    } catch (err) {
      if (!ownsTerminal(operation)) return;
      terminalRef.current = null;
      if (!isCurrent()) { setStatus("active"); return; }
      const msg = err instanceof Error ? err.message : "Failed to resubmit suggestions";
      setStatus("error");
      setError(msg);
      onError?.(msg);
    }
  }, [sessionId, accessToken, projectId, onSubmitted, onError, isCurrent, beginTerminal, ownsTerminal]);

  // Auto-resume on mount if resumeSessionId/resumeBranch are provided
  useEffect(() => {
    if (!resumeSessionId || !resumeBranch || !accessToken) {
      resumeAttemptedRef.current = null;
      return;
    }
    if (resumeAttemptedRef.current?.sessionId === resumeSessionId
      && resumeAttemptedRef.current.branch === resumeBranch) return;
    const attempt = { sessionId: resumeSessionId, branch: resumeBranch };
    resumeAttemptedRef.current = attempt;
    // Renewing a token must not reopen the session a terminal request is closing.
    if (terminalRef.current?.sessionId === resumeSessionId) return;

    // Verify the session is still in changes-requested state before resuming
    suggestionsApi
      .listSessions(projectId, accessToken)
      .then((response) => {
        if (!isCurrent() || resumeAttemptedRef.current !== attempt) return;
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
        if (!isCurrent() || resumeAttemptedRef.current !== attempt) return;
        onError?.("Failed to verify suggestion session status.");
      });
  }, [resumeSessionId, resumeBranch, accessToken, projectId, resumeSession, onError, isCurrent]);

  return {
    sessionId,
    branch,
    beaconToken,
    changesCount,
    status,
    error,
    entitiesModified,
    isActive: status === "active" || status === "saving" || (status === "error" && sessionId !== null),
    isResumed,
    startSession,
    saveToSession,
    submitSession,
    discardSession,
    resumeSession,
    resubmitSession,
  };
}
