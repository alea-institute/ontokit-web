/**
 * Suggestion session API client
 *
 * Manages the suggestion workflow for non-technical users (suggesters).
 * Each session maps to a suggestion branch; edits auto-save as commits,
 * and explicit submission creates a PR for review.
 *
 * Also provides anonymousSuggestionsApi for unauthenticated users —
 * uses X-Anonymous-Token header instead of Authorization: Bearer.
 */

import { api } from "./client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types ---

export interface SuggestionSession {
  session_id: string;
  branch: string;
  created_at: string;
}

export interface SuggestionSaveResponse {
  commit_hash: string;
  branch: string;
  changes_count: number;
}

export interface SuggestionSubmitResponse {
  pr_number: number;
  pr_url: string | null;
  status: "submitted" | "auto-submitted";
}

export type SuggestionSessionStatus =
  | "active"
  | "submitted"
  | "auto-submitted"
  | "discarded"
  | "merged"
  | "rejected"
  | "changes-requested";

export interface SuggestionUser {
  id: string;
  name?: string;
  email?: string;
}

export interface SuggestionSessionSummary {
  session_id: string;
  branch: string;
  changes_count: number;
  last_activity: string;
  entities_modified: string[];
  status: SuggestionSessionStatus;
  pr_number?: number;
  pr_url?: string;
  github_pr_url?: string;
  submitter?: SuggestionUser;
  reviewer?: SuggestionUser;
  reviewer_feedback?: string;
  reviewed_at?: string;
  revision?: number;
  summary?: string;
  is_anonymous?: boolean;
}

export interface SuggestionSessionListResponse {
  items: SuggestionSessionSummary[];
}

export interface SuggestionSavePayload {
  content: string;
  entity_iri: string;
  entity_label: string;
}

export interface SuggestionSubmitPayload {
  summary?: string;
}

export interface SuggestionRejectPayload {
  reason: string;
}

export interface SuggestionRequestChangesPayload {
  feedback: string;
}

export interface SuggestionResubmitPayload {
  summary?: string;
}

export interface SuggestionBeaconPayload {
  session_id: string;
  content: string;
}

// --- Anonymous suggestion types ---

/**
 * Response from creating an anonymous suggestion session.
 * The anonymous_token must be stored client-side and passed as
 * X-Anonymous-Token on all subsequent calls for this session.
 */
export interface AnonymousSessionCreateResponse {
  session_id: string;
  branch: string;
  created_at: string;
  anonymous_token: string;
}

/**
 * Payload for submitting an anonymous suggestion session.
 * submitter_name and submitter_email are optional credit fields.
 * website is a honeypot — always send as empty string; bots fill it.
 */
export interface AnonymousSubmitPayload {
  summary?: string;
  submitter_name?: string;
  submitter_email?: string;
  website?: string; // honeypot field — always send empty string
}

// --- API ---

export const suggestionsApi = {
  /**
   * Create a new suggestion session (branch).
   * Called on first edit by a suggester.
   */
  createSession: (projectId: string, token: string) =>
    api.post<SuggestionSession>(
      `/api/v1/projects/${projectId}/suggestions/sessions`,
      undefined,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Save content to the suggestion branch.
   * Equivalent to a commit on the suggestion branch.
   */
  save: (
    projectId: string,
    sessionId: string,
    data: SuggestionSavePayload,
    token: string,
  ) =>
    api.put<SuggestionSaveResponse>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/save`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Submit the suggestion session — creates a PR for review.
   */
  submit: (
    projectId: string,
    sessionId: string,
    data: SuggestionSubmitPayload,
    token: string,
  ) =>
    api.post<SuggestionSubmitResponse>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/submit`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * List the current user's suggestion sessions.
   */
  listSessions: (projectId: string, token: string) =>
    api.get<SuggestionSessionListResponse>(
      `/api/v1/projects/${projectId}/suggestions/sessions`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Discard a suggestion session (deletes the suggestion branch).
   */
  discard: (projectId: string, sessionId: string, token: string) =>
    api.post<void>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/discard`,
      undefined,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Send a beacon payload to flush the last draft on browser close.
   * Uses navigator.sendBeacon — cannot set Authorization headers,
   * so a short-lived beaconToken is passed as a query param.
   */
  beacon: (
    projectId: string,
    sessionId: string,
    content: string,
    beaconToken: string,
  ) => {
    const url = `${API_BASE}/api/v1/projects/${projectId}/suggestions/beacon?token=${encodeURIComponent(beaconToken)}`;
    const payload = JSON.stringify({ session_id: sessionId, content });
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  },

  // --- Review / Admin methods ---

  /**
   * List pending suggestion sessions for review (editors/admins only).
   */
  listPending: (projectId: string, token: string) =>
    api.get<SuggestionSessionListResponse>(
      `/api/v1/projects/${projectId}/suggestions/pending`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Approve a suggestion session — merges the PR.
   */
  approve: (projectId: string, sessionId: string, token: string) =>
    api.post<void>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/approve`,
      undefined,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Reject a suggestion session with a reason.
   */
  reject: (
    projectId: string,
    sessionId: string,
    data: SuggestionRejectPayload,
    token: string,
  ) =>
    api.post<void>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/reject`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Request changes on a suggestion session with feedback.
   */
  requestChanges: (
    projectId: string,
    sessionId: string,
    data: SuggestionRequestChangesPayload,
    token: string,
  ) =>
    api.post<void>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/request-changes`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /**
   * Resubmit a suggestion session after addressing requested changes.
   */
  resubmit: (
    projectId: string,
    sessionId: string,
    data: SuggestionResubmitPayload,
    token: string,
  ) =>
    api.post<SuggestionSubmitResponse>(
      `/api/v1/projects/${projectId}/suggestions/sessions/${sessionId}/resubmit`,
      data,
      { headers: { Authorization: `Bearer ${token}` } },
    ),
};

// --- Anonymous suggestion API ---

/**
 * API client for anonymous (unauthenticated) suggestion sessions.
 *
 * All methods use X-Anonymous-Token header rather than Authorization: Bearer.
 * The anonymous token is returned on session creation and must be stored
 * in localStorage and passed to all subsequent calls.
 *
 * Only available when AUTH_MODE is "optional" or "disabled" on the server.
 */
export const anonymousSuggestionsApi = {
  /**
   * Create a new anonymous suggestion session.
   * No token required — returns an anonymous_token to use for subsequent calls.
   */
  createSession: (projectId: string) =>
    api.post<AnonymousSessionCreateResponse>(
      `/api/v1/projects/${projectId}/suggestions/anonymous/sessions`,
    ),

  /**
   * Save content to the anonymous suggestion branch.
   */
  save: (
    projectId: string,
    sessionId: string,
    data: SuggestionSavePayload,
    anonymousToken: string,
  ) =>
    api.put<SuggestionSaveResponse>(
      `/api/v1/projects/${projectId}/suggestions/anonymous/sessions/${sessionId}/save`,
      data,
      { headers: { "X-Anonymous-Token": anonymousToken } },
    ),

  /**
   * Submit the anonymous suggestion session — creates a PR for review.
   * Optionally includes submitter_name/email for credit attribution.
   * Always send website as empty string (honeypot — bots fill this, humans don't).
   */
  submit: (
    projectId: string,
    sessionId: string,
    data: AnonymousSubmitPayload,
    anonymousToken: string,
  ) =>
    api.post<SuggestionSubmitResponse>(
      `/api/v1/projects/${projectId}/suggestions/anonymous/sessions/${sessionId}/submit`,
      data,
      { headers: { "X-Anonymous-Token": anonymousToken } },
    ),

  /**
   * Discard an anonymous suggestion session (deletes the suggestion branch).
   */
  discard: (projectId: string, sessionId: string, anonymousToken: string) =>
    api.post<void>(
      `/api/v1/projects/${projectId}/suggestions/anonymous/sessions/${sessionId}/discard`,
      undefined,
      { headers: { "X-Anonymous-Token": anonymousToken } },
    ),

  /**
   * Send a beacon payload to flush the last draft on browser close.
   * Uses navigator.sendBeacon — cannot set X-Anonymous-Token header,
   * so the token is passed as a query param.
   */
  beacon: (
    projectId: string,
    sessionId: string,
    content: string,
    anonymousToken: string,
  ) => {
    const url = `${API_BASE}/api/v1/projects/${projectId}/suggestions/anonymous/beacon?token=${encodeURIComponent(anonymousToken)}`;
    const payload = JSON.stringify({ session_id: sessionId, content });
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  },
};
