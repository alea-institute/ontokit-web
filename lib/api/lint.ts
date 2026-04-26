/**
 * Lint API client for ontology health checking
 */

import { api } from "./client";

// Types
export type LintIssueType = "error" | "warning" | "info";
export type LintRunStatus = "pending" | "running" | "completed" | "failed";
export type SubjectType = "class" | "property" | "individual" | "other";
/** Numeric preset levels exposed by the backend's `/lint/levels` endpoint. */
export type LintLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Known fields the backend populates inside `LintIssue.details`.
 *
 * Add fields here when introducing a new lint rule that emits structured
 * payload data. The index signature keeps the type forward-compatible with
 * unknown rules, but consumers should validate at runtime before reading
 * unknown keys.
 */
export interface LintIssueDetails {
  /** Other entity IRIs that share the offending property (duplicate-label, etc.) */
  duplicate_iris?: string[];
  /** Conflicting label values (label-per-language) */
  labels?: string[];
  [key: string]: unknown;
}

export interface LintIssue {
  id: string;
  run_id: string;
  project_id: string;
  issue_type: LintIssueType;
  rule_id: string;
  message: string;
  subject_iri: string | null;
  subject_type: SubjectType | null;
  details: LintIssueDetails | null;
  created_at: string;
  resolved_at: string | null;
}

export interface LintRun {
  id: string;
  project_id: string;
  status: LintRunStatus;
  started_at: string;
  completed_at: string | null;
  issues_found: number | null;
  error_message: string | null;
}

export interface LintRunDetail extends LintRun {
  issues: LintIssue[];
}

export interface LintSummary {
  project_id: string;
  last_run: LintRun | null;
  error_count: number;
  warning_count: number;
  info_count: number;
  total_issues: number;
}

export interface LintTriggerResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface LintIssueListResponse {
  items: LintIssue[];
  total: number;
  skip: number;
  limit: number;
}

export interface LintRunListResponse {
  items: LintRun[];
  total: number;
  skip: number;
  limit: number;
}

export interface LintRuleInfo {
  rule_id: string;
  name: string;
  description: string;
  severity: LintIssueType;
  scope: string[];
}

export interface LintRulesResponse {
  rules: LintRuleInfo[];
}

export interface LintLevelInfo {
  level: LintLevel;
  name: string;
  description: string;
  rule_ids: string[];
}

export interface LintLevelsResponse {
  levels: LintLevelInfo[];
}

/**
 * Lint configuration payload. `lint_level: null` discriminates "custom" mode,
 * where `enabled_rules` is the explicit rule list to apply. When `lint_level`
 * is set, the backend ignores `enabled_rules`.
 */
export interface LintConfig {
  lint_level: LintLevel | null;
  enabled_rules: string[];
}

export interface LintConfigResponse {
  project_id: string;
  lint_level: LintLevel | null;
  enabled_rules: string[] | null;
  effective_rules: string[];
  updated_at: string | null;
}

// WebSocket message types
export interface LintWebSocketMessage {
  type: "lint_started" | "lint_complete" | "lint_failed";
  project_id: string;
  run_id: string;
  issues_found?: number;
  error?: string;
}

// API functions
export const lintApi = {
  /**
   * Trigger a new lint run for a project
   */
  triggerLint: (projectId: string, token: string) =>
    api.post<LintTriggerResponse>(
      `/api/v1/projects/${projectId}/lint/run`,
      undefined,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    ),

  /**
   * Get the current lint status and summary for a project
   */
  getStatus: (projectId: string, token?: string) =>
    api.get<LintSummary>(`/api/v1/projects/${projectId}/lint/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),

  /**
   * List all lint runs for a project
   */
  listRuns: (
    projectId: string,
    token?: string,
    options?: { skip?: number; limit?: number }
  ) =>
    api.get<LintRunListResponse>(`/api/v1/projects/${projectId}/lint/runs`, {
      params: options,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),

  /**
   * Get details of a specific lint run including all issues
   */
  getRun: (projectId: string, runId: string, token?: string) =>
    api.get<LintRunDetail>(
      `/api/v1/projects/${projectId}/lint/runs/${runId}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),

  /**
   * Get lint issues for a project
   */
  getIssues: (
    projectId: string,
    token?: string,
    options?: {
      issue_type?: LintIssueType;
      rule_id?: string;
      subject_iri?: string;
      include_resolved?: boolean;
      skip?: number;
      limit?: number;
    }
  ) =>
    api.get<LintIssueListResponse>(
      `/api/v1/projects/${projectId}/lint/issues`,
      {
        params: options,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),

  /**
   * Dismiss/resolve a lint issue
   */
  dismissIssue: (projectId: string, issueId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/lint/issues/${issueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * Get the list of available lint rules
   */
  getRules: () => api.get<LintRulesResponse>("/api/v1/projects/lint/rules"),

  /**
   * Get lint level definitions (which rules are in each level)
   */
  getLevels: () => api.get<LintLevelsResponse>("/api/v1/projects/lint/levels"),

  /**
   * Get lint configuration for a project
   */
  getLintConfig: (projectId: string, token?: string) =>
    api.get<LintConfigResponse>(`/api/v1/projects/${projectId}/lint/config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),

  /**
   * Update lint configuration for a project
   */
  updateLintConfig: (projectId: string, config: LintConfig, token?: string) =>
    api.put<LintConfigResponse>(
      `/api/v1/projects/${projectId}/lint/config`,
      config,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    ),

  /**
   * Clear all lint results (runs and issues) for a project
   */
  clearResults: (projectId: string, token: string) =>
    api.delete(`/api/v1/projects/${projectId}/lint/results`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

/**
 * Create a WebSocket connection for lint updates
 */
export function createLintWebSocket(
  projectId: string,
  onMessage: (message: LintWebSocketMessage) => void,
  onError?: (error: Event) => void,
  onClose?: (event: CloseEvent) => void,
  token?: string
): WebSocket {
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ||
    "ws://localhost:8000";

  const params = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(`${wsUrl}/api/v1/projects/${projectId}/lint/ws${params}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as LintWebSocketMessage;
      onMessage(data);
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    onError?.(error);
  };

  ws.onclose = (event) => {
    onClose?.(event);
  };

  return ws;
}

/**
 * Hook-friendly WebSocket manager with auto-reconnect
 */
export class LintWebSocketManager {
  private ws: WebSocket | null = null;
  private projectId: string;
  private onMessage: (message: LintWebSocketMessage) => void;
  private token?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isClosing = false;

  constructor(
    projectId: string,
    onMessage: (message: LintWebSocketMessage) => void,
    token?: string
  ) {
    this.projectId = projectId;
    this.onMessage = onMessage;
    this.token = token;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isClosing = false;
    this.ws = createLintWebSocket(
      this.projectId,
      this.onMessage,
      () => this.handleReconnect(),
      (event) => {
        if (!this.isClosing && event.code !== 1000) {
          this.handleReconnect();
        }
      },
      this.token
    );
  }

  disconnect(): void {
    this.isClosing = true;
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.ws = null;
    }
  }

  private handleReconnect(): void {
    if (this.isClosing) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => this.connect(), delay);
    }
  }
}
