/**
 * PR Party API client (KTD16 client half, KTD19).
 *
 * Two contracts live here and nowhere else:
 *
 * 1. **Idempotency.** Every actuation attempt carries a high-entropy key. It is
 *    retained while the outcome is uncertain, then discarded as soon as a
 *    definitive response arrives. A network retry replays the uncertain
 *    attempt; a later identical action is a genuinely new attempt.
 *
 * 2. **No 5xx retry on actuations.** The shared client retries 5xx three times
 *    inside one call. For a verdict or a merge that is a double-actuation
 *    vector, so every actuation passes `retryOn5xx: false`. Reads keep the
 *    retry — a flaky queue fetch is worth retrying.
 *
 * Brief fields (`brief_what`, `brief_why`, `brief_decisions`, `brief_links`)
 * are LLM-generated plain text derived from third-party PR content. They are
 * rendered as text nodes only — never handed to a markdown pipeline,
 * `dangerouslySetInnerHTML`, or an `href` without validation (R21).
 */

import { api, ApiError } from "./client";

// --- Types ---

export type PRPartyAuthorKind = "own" | "counterpart" | "third_party" | "bot";
export type PRPartyBriefStatus = "brewing" | "ready" | "ready_with_warning" | "failed";
export type PRPartyActionKind = "review" | "merge";
export type PRPartyVerdict = "approve" | "request_changes" | "comment" | "discuss_live";
export type PRPartyMergeMethod = "merge" | "squash" | "rebase";

/**
 * Where the reviewer merges from — *not* how GitHub merges (R11).
 *
 * `dashboard` puts a merge button on the card; `manual` replaces it with a link
 * to the PR. Distinct from `PRPartyMergeMethod`, which is GitHub's merge/squash/
 * rebase choice and is never what `settings.merge_default` carries.
 */
export type PRPartyMergePlacement = "dashboard" | "manual";

export interface PRPartyCredentialHealth {
  expires_at: string | null;
  last_validated_at: string | null;
  last_error: string | null;
  expired: boolean;
  expires_soon: boolean;
}

export interface PRPartyGenerationTokenHealth {
  expires_at: string | null;
  last_error: string | null;
}

/** `GET /pr-party/me` — a non-reviewer gets 200 with `is_reviewer: false`. */
export interface PRPartyMe {
  is_reviewer: boolean;
  degraded: boolean;
  github_login: string | null;
  credential: PRPartyCredentialHealth | null;
  generation_token: PRPartyGenerationTokenHealth | null;
}

export interface PRPartyReadiness {
  /** Server-supplied. Never re-derived client-side — the two would drift. */
  ready: boolean;
  /** Plain-language reason a verdict is blocked, when it is. */
  reason: string | null;
}

export interface PRPartyActionRecord {
  kind: PRPartyActionKind;
  verdict: PRPartyVerdict | null;
  status: string;
  head_sha: string;
  override: boolean;
  created_at: string;
  github_review_id?: string | null;
  merged?: boolean;
}

export interface PRPartyOtherReviewer {
  has_approved: boolean;
  has_pending_intent: boolean;
}

export interface PRPartyQueueCard {
  card_id: string;
  repo_full_name: string;
  pr_number: number;
  title: string | null;
  author_kind: PRPartyAuthorKind;
  author_github_login: string | null;
  read_only: boolean;
  state: string;
  head_sha: string;
  mergeable_state: string | null;
  checks_rollup: string | null;
  brief_status: PRPartyBriefStatus;
  brief_truncated: boolean;
  ready_at: string | null;
  updated_at_github: string | null;
  pr_url: string;
  diff_url: string;
  readiness: PRPartyReadiness;
  actions: PRPartyActionRecord[];
  other_reviewer: PRPartyOtherReviewer;
  stale: boolean;
  parked: boolean;
}

export interface PRPartyQAEntry {
  question_comment_id: string;
  question_body: string;
  question_author: string;
  question_url: string;
  asked_at: string;
  answer_comment_id: string | null;
  answer_body: string | null;
  answer_author: string | null;
  answer_url: string | null;
  answered_at: string | null;
}

export interface PRPartyCardDetail extends PRPartyQueueCard {
  /** Plain text. Render as a text node only (R21). */
  brief_what: string;
  /** Plain text. Render as a text node only (R21). */
  brief_why: string;
  /** Plain text. Render as text nodes only (R21). */
  brief_decisions: string[];
  /** Plain text. Validate before using as an href (R21). */
  brief_links: string[];
  truncated_note: string | null;
  brewing_since: string | null;
  created_at: string;
  updated_at: string;
  qa_thread: PRPartyQAEntry[];
}

export interface PRPartyQueueResponse {
  generated_at: string;
  cards: PRPartyQueueCard[];
}

/** Caller-facing action input. `idempotency_key` is derived unless supplied. */
export interface PRPartyActionInput {
  action_kind: PRPartyActionKind;
  verdict?: PRPartyVerdict | null;
  body?: string;
  head_sha: string;
  override?: boolean;
  merge_method?: PRPartyMergeMethod;
  idempotency_key?: string;
}

export interface PRPartyActionResponse {
  action: PRPartyActionRecord;
  card: PRPartyCardDetail;
  /** True when the verdict was recorded as intent only (token expired, R12). */
  degraded?: boolean;
  /** Where to finish the action by hand when degraded. */
  deep_link?: string;
  /** True when an idempotent replay returned a stored receipt. */
  replayed?: boolean;
}

export interface PRPartyCommentResponse {
  posted: boolean;
  degraded: boolean;
  body: string;
  comment_id: string | null;
  comment_url: string | null;
  deep_link: string | null;
  card: PRPartyCardDetail;
}

export interface PRPartyCredentialRevokeResponse {
  revoked_locally: boolean;
  revoke_url: string;
}

export interface PRPartySettings {
  merge_default: PRPartyMergePlacement;
  ntfy_topic: string | null;
  ntfy_base_url?: string | null;
}

export type PRPartySettingsUpdate = Partial<PRPartySettings>;

/** Structured `detail` on a PR Party error response. */
export interface PRPartyErrorDetail {
  message: string;
  /** Present on a 409 drift — the fresh card the UI must re-render. */
  card?: PRPartyCardDetail;
  /** Present when the server has concluded the card should leave the queue. */
  retire?: boolean;
  reason?: string;
}

// --- Helpers ---

const BASE = "/api/v1/pr-party";

function authHeaders(token: string): Record<string, string> {
  // PR Party is reviewer-only; there is no anonymous read.
  return { Authorization: `Bearer ${token}` };
}

/** Options every actuation shares: authenticated, and never auto-retried. */
function actuationOptions(token: string) {
  return { headers: authHeaders(token), retryOn5xx: false };
}

// --- Idempotency ---

/** What the server accepts as an `Idempotency-Key`. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const pendingAttemptKeys = new Map<string, string>();
const PENDING_ATTEMPT_PREFIX = "pr-party:pending-attempt:";

async function attemptFingerprint(
  cardId: string,
  input: PRPartyActionInput,
): Promise<string> {
  const intent = JSON.stringify([
    cardId,
    input.action_kind,
    input.head_sha,
    input.verdict ?? null,
    input.body ?? null,
    input.override ?? false,
    input.merge_method ?? null,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(intent));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** A UUID carries 122 random bits and fits the server's key grammar. */
export function mintIdempotencyKey(): string {
  return `attempt_${crypto.randomUUID().replaceAll("-", "")}`;
}

function outcomeIsUncertain(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}

function readPendingAttempt(fingerprint: string): string | null {
  const memoryKey = pendingAttemptKeys.get(fingerprint);
  if (memoryKey) return memoryKey;
  try {
    return window.sessionStorage.getItem(`${PENDING_ATTEMPT_PREFIX}${fingerprint}`);
  } catch {
    return null;
  }
}

function writePendingAttempt(fingerprint: string, key: string): void {
  pendingAttemptKeys.set(fingerprint, key);
  try {
    window.sessionStorage.setItem(`${PENDING_ATTEMPT_PREFIX}${fingerprint}`, key);
  } catch {
    // In-memory replay protection still covers this page lifetime.
  }
}

function clearPendingAttempt(fingerprint: string): void {
  pendingAttemptKeys.delete(fingerprint);
  try {
    window.sessionStorage.removeItem(`${PENDING_ATTEMPT_PREFIX}${fingerprint}`);
  } catch {
    // Storage may be unavailable; the in-memory key is already gone.
  }
}

// --- Error shapes ---

/**
 * Parse a PR Party error body into its structured detail, or null when the
 * error is not one (a network failure, a non-JSON body, a plain Error).
 */
export function parsePRPartyError(error: unknown): PRPartyErrorDetail | null {
  if (!(error instanceof ApiError)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(error.message);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const detail = (parsed as { detail?: unknown }).detail;
  if (typeof detail === "string") return { message: detail };
  if (!detail || typeof detail !== "object") return null;
  const record = detail as Partial<PRPartyErrorDetail>;
  return { ...record, message: record.message ?? "" };
}

/**
 * A 409 that carries a fresh card: the PR moved while the reviewer was
 * reading. The UI re-renders the card and requires a second tap — it must
 * never auto-resubmit (KTD16).
 */
export function isPRPartyDriftError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  return !!parsePRPartyError(error)?.card;
}

/**
 * A 409 with no card: the same action is already in flight. Nothing to
 * re-render; the correct response is to wait, not to re-tap.
 */
export function isPRPartyInFlightError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const detail = parsePRPartyError(error);
  return !!detail && !detail.card;
}

// --- API ---

export const prPartyApi = {
  /** Reviewer posture and credential health. Non-reviewers get 200, not 403. */
  getMe: (token: string) =>
    api.get<PRPartyMe>(`${BASE}/me`, { headers: authHeaders(token) }),

  /** The live queue. Server-generated; readiness is never re-derived here. */
  getQueue: (token: string) =>
    api.get<PRPartyQueueResponse>(`${BASE}/queue`, { headers: authHeaders(token) }),

  /** One card with its brief and Q&A thread. */
  getCard: (cardId: string, token: string) =>
    api.get<PRPartyCardDetail>(`${BASE}/cards/${encodeURIComponent(cardId)}`, {
      headers: authHeaders(token),
    }),

  /**
   * Submit a review verdict or a merge.
   *
   * The PR identity comes from the server-side row `cardId` names — never from
   * client-supplied repo/number (A4).
   */
  submitAction: async (cardId: string, input: PRPartyActionInput, token: string) => {
    if (input.idempotency_key) {
      return api.post<PRPartyActionResponse>(
        `${BASE}/cards/${encodeURIComponent(cardId)}/actions`,
        input,
        actuationOptions(token),
      );
    }
    const fingerprint = await attemptFingerprint(cardId, input);
    const idempotencyKey = readPendingAttempt(fingerprint) ?? mintIdempotencyKey();
    writePendingAttempt(fingerprint, idempotencyKey);
    try {
      const response = await api.post<PRPartyActionResponse>(
        `${BASE}/cards/${encodeURIComponent(cardId)}/actions`,
        { ...input, idempotency_key: idempotencyKey },
        actuationOptions(token),
      );
      clearPendingAttempt(fingerprint);
      return response;
    } catch (error) {
      if (!outcomeIsUncertain(error)) clearPendingAttempt(fingerprint);
      throw error;
    }
  },

  /** Return a parked card to the queue for its concluding verdict (R9). */
  unpark: (cardId: string, token: string) =>
    api.post<PRPartyCardDetail>(
      `${BASE}/cards/${encodeURIComponent(cardId)}/unpark`,
      undefined,
      actuationOptions(token),
    ),

  /** Post a question to the PR thread. */
  askQuestion: (cardId: string, question: string, token: string) =>
    api.post<PRPartyCommentResponse>(
      `${BASE}/cards/${encodeURIComponent(cardId)}/questions`,
      { question },
      actuationOptions(token),
    ),

  /** Post a note to the PR thread. */
  addNote: (cardId: string, note: string, token: string) =>
    api.post<PRPartyCommentResponse>(
      `${BASE}/cards/${encodeURIComponent(cardId)}/notes`,
      { note },
      actuationOptions(token),
    ),

  /** Re-trigger brief generation for a card stuck brewing (R3). */
  rerunReview: (cardId: string, token: string) =>
    api.post<PRPartyCommentResponse>(
      `${BASE}/cards/${encodeURIComponent(cardId)}/rerun-review`,
      undefined,
      actuationOptions(token),
    ),

  /**
   * Register or replace the reviewer's GitHub PAT.
   *
   * `pat` is the credential being stored; `token` is the session token that
   * authenticates the call. Never swap them.
   */
  setCredential: (pat: string, token: string) =>
    api.put<PRPartyCredentialHealth>(
      `${BASE}/credential`,
      { token: pat },
      actuationOptions(token),
    ),

  /** Forget the stored PAT. Revoking it at GitHub is the reviewer's job. */
  revokeCredential: (token: string) =>
    api.delete<PRPartyCredentialRevokeResponse>(
      `${BASE}/credential`,
      actuationOptions(token),
    ),

  /** Merge default and ntfy topic. */
  getSettings: (token: string) =>
    api.get<PRPartySettings>(`${BASE}/settings`, { headers: authHeaders(token) }),

  /** Update only the fields being changed. */
  updateSettings: (data: PRPartySettingsUpdate, token: string) =>
    api.put<PRPartySettings>(`${BASE}/settings`, data, actuationOptions(token)),
};
