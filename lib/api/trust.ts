/**
 * Contribution trust ladder API client (R4-R11).
 *
 * Two audiences:
 * - Contributors read `getCapabilities` to learn what they may do and how trust
 *   is earned. It is the same tier resolution the server-side gates use, so the
 *   UI's affordances and the enforcement can never disagree.
 * - Project admins read and write the member grants and the per-project
 *   promotion / auto-accept settings.
 */

import { api } from "./client";

// --- Types ---

/** Rungs of the ladder, least to most privileged. */
export type TrustTier = "anonymous" | "untrusted" | "trusted" | "reviewer";

/** Admin decision that outranks auto-promotion, and is sticky. */
export type TrustOverride = "none" | "granted" | "refused" | "revoked";

export interface SuggestionCapabilities {
  tier: TrustTier;
  can_suggest: boolean;
  /** Creating new classes or properties requires trusted status (R8). */
  can_mint_entities: boolean;
  promotion_threshold: number;
  accepted_count: number;
  auto_accept_enabled: boolean;
  auto_accept_quiet_days: number;
  /** True when the next suggestion needs a human-verification token (R10). */
  verification_required: boolean;
}

export interface MemberTrust {
  user_id: string;
  role: string;
  tier: TrustTier;
  is_trusted: boolean;
  trust_override: TrustOverride;
  trust_granted_at?: string | null;
  trust_granted_by?: string | null;
  accepted_count: number;
}

export interface ProjectTrustSettings {
  trust_promotion_threshold: number;
  auto_accept_enabled: boolean;
  auto_accept_quiet_days: number;
}

export type ProjectTrustSettingsUpdate = Partial<ProjectTrustSettings>;

/** One immutable submitter snapshot paired with its suggestion outcome. */
export interface SuggestionOutcomeItem {
  user_id: string;
  is_anonymous: boolean;
  submitter_name: string | null;
  submitter_email: string | null;
  snapshot_tier: TrustTier | null;
  snapshot_role: string | null;
  snapshot_captured_at: string | null;
  outcome: string;
  decided_by: string | null;
  decided_by_name: string | null;
  created_at: string;
}

export interface SuggestionOutcomesResponse {
  items: SuggestionOutcomeItem[];
  total: number;
  next_cursor: string | null;
}

export interface SuggestionOutcomesParams {
  cursor?: string;
  limit?: number;
}

// --- Helpers ---

function authHeaders(token?: string): Record<string, string> {
  // Capabilities are readable anonymously on public projects, so the header is
  // conditional rather than required.
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- API ---

export const trustApi = {
  /**
   * What the caller may do on this project, and how trust is earned.
   *
   * Safe to call unauthenticated on a public project; a private project
   * refuses, since a tier readout is itself information about the project.
   */
  getCapabilities: (projectId: string, token?: string) =>
    api.get<SuggestionCapabilities>(
      `/api/v1/projects/${projectId}/suggestions/capabilities`,
      { headers: authHeaders(token) },
    ),

  /** Every member's tier, grant state, and accepted count (owner/admin only). */
  listMemberTrust: (projectId: string, token: string) =>
    api.get<MemberTrust[]>(`/api/v1/projects/${projectId}/trust/members`, {
      headers: authHeaders(token),
    }),

  /** Submission outcomes with captured-at-submit identity and trust (owner/admin only). */
  listOutcomes: (
    projectId: string,
    { cursor, limit }: SuggestionOutcomesParams,
    token: string,
  ) =>
    api.get<SuggestionOutcomesResponse>(
      `/api/v1/projects/${projectId}/trust/outcomes`,
      {
        headers: authHeaders(token),
        params: { cursor, limit },
      },
    ),

  /** Grant, refuse, revoke, or clear a member's trusted status (owner/admin only). */
  setMemberTrust: (
    projectId: string,
    userId: string,
    trustOverride: TrustOverride,
    token: string,
  ) =>
    api.patch<MemberTrust>(
      `/api/v1/projects/${projectId}/trust/members/${encodeURIComponent(userId)}`,
      { trust_override: trustOverride },
      { headers: authHeaders(token) },
    ),

  /** Read the project's promotion threshold and auto-accept window. */
  getSettings: (projectId: string, token: string) =>
    api.get<ProjectTrustSettings>(`/api/v1/projects/${projectId}/trust/settings`, {
      headers: authHeaders(token),
    }),

  /** Update the promotion threshold and auto-accept window (owner/admin only). */
  updateSettings: (
    projectId: string,
    data: ProjectTrustSettingsUpdate,
    token: string,
  ) =>
    api.patch<ProjectTrustSettings>(
      `/api/v1/projects/${projectId}/trust/settings`,
      data,
      { headers: authHeaders(token) },
    ),
};
