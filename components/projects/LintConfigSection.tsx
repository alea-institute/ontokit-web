"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  lintApi,
  type LintConfig,
  type LintLevel,
  type LintSummary,
} from "@/lib/api/lint";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function getSeverityColor(severity: string) {
  switch (severity) {
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "info":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
}

export function LintConfigSection({
  projectId,
  accessToken,
  canManage,
}: {
  projectId: string;
  accessToken?: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRunningLint, setIsRunningLint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable state. `lintLevel === null` means custom mode (explicit rule list).
  const [lintLevel, setLintLevel] = useState<LintLevel | null>(2); // Default: Standard
  const [enabledRules, setEnabledRules] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Track saved state to detect changes
  const [savedLevel, setSavedLevel] = useState<LintLevel | null>(2);
  const [savedRules, setSavedRules] = useState<Set<string>>(new Set());

  // Fetch available lint rules
  const rulesQuery = useQuery({
    queryKey: ["lintRules"],
    queryFn: () => lintApi.getRules(),
    retry: false,
  });

  // Fetch lint level definitions from backend
  const levelsQuery = useQuery({
    queryKey: ["lintLevels"],
    queryFn: () => lintApi.getLevels(),
    retry: false,
  });

  // Build a map of level -> rule_ids from backend definitions
  const levelRuleMap = useMemo(() => {
    if (!levelsQuery.data) return new Map<LintLevel, Set<string>>();
    const map = new Map<LintLevel, Set<string>>();
    for (const level of levelsQuery.data.levels) {
      map.set(level.level, new Set(level.rule_ids));
    }
    return map;
  }, [levelsQuery.data]);

  const rules = useMemo(() => {
    if (!rulesQuery.data) return [];
    return [...rulesQuery.data.rules].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    );
  }, [rulesQuery.data]);

  // Fetch project lint config (depends on rules being loaded). The access
  // token is only used inside the queryFn; keeping it out of the queryKey
  // means a token rotation does not invalidate the cache.
  const configQuery = useQuery({
    queryKey: ["lintConfig", projectId],
    queryFn: () => lintApi.getLintConfig(projectId, accessToken),
    enabled: !!accessToken && rules.length > 0,
    retry: false,
  });

  // Fetch lint status summary
  const statusQuery = useQuery<LintSummary>({
    queryKey: ["lintSummary", projectId],
    queryFn: () => lintApi.getStatus(projectId, accessToken),
    enabled: !!accessToken,
  });

  // Sync rules / levels query errors
  useEffect(() => {
    if (rulesQuery.isError) {
      setError("Failed to load lint rules");
    } else if (levelsQuery.isError) {
      setError("Failed to load lint levels");
    }
  }, [rulesQuery.isError, levelsQuery.isError]);

  // Stable ref for hasChanges so the sync effect can read it without re-running
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  // Sync config data into local editable state
  useEffect(() => {
    if (!configQuery.data && !configQuery.isError) return;
    // Don't overwrite in-progress edits from background refetches
    if (hasChangesRef.current) return;

    if (configQuery.data) {
      const cfg = configQuery.data;
      const level = cfg.lint_level;
      // For preset mode, defer until levelsQuery has resolved — otherwise
      // levelRuleMap.get(level) returns undefined and we'd flash an
      // all-disabled state until levels load. The effect re-runs when
      // levelRuleMap changes.
      if (level !== null && levelRuleMap.size === 0) return;
      setLintLevel(level);
      setSavedLevel(level);
      if (level === null) {
        const ruleSet = new Set(cfg.enabled_rules ?? []);
        setEnabledRules(ruleSet);
        setSavedRules(ruleSet);
      } else {
        const presetRules = levelRuleMap.get(level) ?? new Set<string>();
        setEnabledRules(presetRules);
        setSavedRules(presetRules);
      }
    } else if (configQuery.isError) {
      setError(
        configQuery.error instanceof Error
          ? configQuery.error.message
          : "Failed to load lint configuration"
      );
    }
  }, [configQuery.data, configQuery.isError, configQuery.error, levelRuleMap]);

  const isLoading = rulesQuery.isLoading || levelsQuery.isLoading || (!!accessToken && rules.length > 0 && configQuery.isLoading);

  // Detect changes
  useEffect(() => {
    if (lintLevel !== savedLevel) {
      setHasChanges(true);
      return;
    }
    if (lintLevel === null) {
      // Custom mode: compare rule sets
      const currentIds = [...enabledRules].sort().join(",");
      const savedIds = [...savedRules].sort().join(",");
      setHasChanges(currentIds !== savedIds);
    } else {
      setHasChanges(false);
    }
  }, [lintLevel, enabledRules, savedLevel, savedRules]);

  const handleLevelChange = (level: LintLevel | null) => {
    setLintLevel(level);
    setError(null);
    setSuccess(null);
    if (level !== null) {
      setEnabledRules(levelRuleMap.get(level) ?? new Set<string>());
    }
  };

  const handleRuleToggle = (ruleId: string) => {
    if (lintLevel !== null) return; // Only toggle in custom mode
    setError(null);
    setSuccess(null);
    setEnabledRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // The backend's enforce_xor validator rejects payloads that set both
      // lint_level AND enabled_rules — preset mode must omit enabled_rules.
      const config: LintConfig =
        lintLevel === null
          ? { lint_level: null, enabled_rules: [...enabledRules] }
          : { lint_level: lintLevel };
      await lintApi.updateLintConfig(projectId, config, accessToken);
      setSavedLevel(lintLevel);
      setSavedRules(new Set(enabledRules));
      setHasChanges(false);
      setSuccess("Lint configuration saved");
      // Invalidate queries so cache stays fresh
      queryClient.invalidateQueries({ queryKey: ["lintConfig", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lint configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearResults = async () => {
    if (!accessToken) return;
    setIsClearing(true);
    setError(null);
    setSuccess(null);
    try {
      await lintApi.clearResults(projectId, accessToken);
      setSuccess("Lint results cleared");
      queryClient.invalidateQueries({ queryKey: ["lintSummary", projectId] });
      queryClient.invalidateQueries({ queryKey: ["lintIssues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["lintRuns", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear lint results");
    } finally {
      setIsClearing(false);
    }
  };

  const handleRunLint = async () => {
    if (!accessToken) return;
    setIsRunningLint(true);
    setError(null);
    setSuccess(null);
    try {
      await lintApi.triggerLint(projectId, accessToken);
      setSuccess("Lint run started");
      queryClient.invalidateQueries({ queryKey: ["lintSummary", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lint run");
    } finally {
      setIsRunningLint(false);
    }
  };

  const isCustom = lintLevel === null;
  // Mirror HealthCheckPanel: offer Clear only when there's something to clear,
  // otherwise the action button re-prompts a fresh Run Lint.
  const lastRunStatus = statusQuery.data?.last_run?.status;
  const hasResultsToClear =
    lastRunStatus === "completed" && (statusQuery.data?.total_issues ?? 0) > 0;
  const isLintInProgress = lastRunStatus === "pending" || lastRunStatus === "running";

  return (
    <section
      id="lint-config"
      className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Lint Rule Configuration
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Configure which lint rules are applied during ontology health checks.
        Choose a preset level or customize individual rules.
      </p>

      {/* Last run summary */}
      {statusQuery.data?.last_run && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Last run: {new Date(statusQuery.data.last_run.completed_at || statusQuery.data.last_run.started_at).toLocaleString()}
              {statusQuery.data.last_run.status !== "completed" && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  ({statusQuery.data.last_run.status})
                </span>
              )}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {statusQuery.data.error_count > 0 && (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {statusQuery.data.error_count} error{statusQuery.data.error_count !== 1 && "s"}
                </span>
              )}
              {statusQuery.data.warning_count > 0 && (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {statusQuery.data.warning_count} warning{statusQuery.data.warning_count !== 1 && "s"}
                </span>
              )}
              {statusQuery.data.info_count > 0 && (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {statusQuery.data.info_count} info
                </span>
              )}
              {statusQuery.data.total_issues === 0 && (
                <span className="font-medium text-green-600 dark:text-green-400">
                  No issues
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lint Level Selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Lint Level
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(levelsQuery.data?.levels ?? []).map((lvl) => (
                <button
                  key={lvl.level}
                  type="button"
                  onClick={() => canManage && handleLevelChange(lvl.level)}
                  disabled={!canManage}
                  aria-pressed={lintLevel === lvl.level}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    lintLevel === lvl.level
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-900/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
                    !canManage && "cursor-not-allowed opacity-60"
                  )}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Level {lvl.level} — {lvl.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lvl.description} ({lvl.rule_ids.length} rules)
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => canManage && handleLevelChange(null)}
                disabled={!canManage}
                aria-pressed={lintLevel === null}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  lintLevel === null
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-900/20"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
                  !canManage && "cursor-not-allowed opacity-60"
                )}
              >
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Custom
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose rules individually
                </p>
              </button>
            </div>
          </div>

          {/* Rule List */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Rules ({enabledRules.size} of {rules.length} enabled)
              </label>
              {isCustom && canManage && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEnabledRules(new Set(rules.map((r) => r.rule_id)))}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Enable all
                  </button>
                  <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setEnabledRules(new Set())}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Disable all
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-600">
              {rules.map((rule) => {
                const enabled = enabledRules.has(rule.rule_id);
                return (
                  <div
                    key={rule.rule_id}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                      enabled
                        ? "bg-slate-50 dark:bg-slate-700/50"
                        : "bg-transparent opacity-60"
                    )}
                  >
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleRuleToggle(rule.rule_id)}
                      disabled={!canManage || !isCustom}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        enabled
                          ? "bg-primary-600 dark:bg-primary-500"
                          : "bg-slate-300 dark:bg-slate-600",
                        (!canManage || !isCustom) && "cursor-not-allowed opacity-60"
                      )}
                      aria-label={`Toggle ${rule.name}`}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          enabled && "translate-x-4"
                        )}
                      />
                    </button>
                    {/* Rule info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {rule.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none",
                            getSeverityColor(rule.severity)
                          )}
                        >
                          {rule.severity}
                        </span>
                        {rule.scope && (
                          <span className="inline-flex gap-0.5">
                            {rule.scope.map((s) => (
                              <span
                                key={s}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[8px] font-bold text-slate-500 dark:border-slate-500 dark:text-slate-400"
                                title={s}
                              >
                                {s[0].toUpperCase()}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No lint rules available.
                </p>
              )}
            </div>
          </div>

          {/* Error/success messages — visible to all users */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Action buttons */}
          {canManage && (
            <div className="flex items-center justify-end gap-3">
              {success && (
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              )}
              {hasResultsToClear ? (
                <Button
                  onClick={handleClearResults}
                  disabled={isClearing}
                  size="sm"
                  variant="outline"
                >
                  {isClearing ? "Clearing..." : "Clear Results"}
                </Button>
              ) : (
                <Button
                  onClick={handleRunLint}
                  disabled={isRunningLint || isLintInProgress}
                  size="sm"
                  variant="outline"
                >
                  {isRunningLint || isLintInProgress ? "Running..." : "Run Lint"}
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                size="sm"
              >
                {isSaving ? "Saving..." : "Save Lint Configuration"}
              </Button>
            </div>
          )}

          {!canManage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only project owners and admins can modify lint configuration.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
