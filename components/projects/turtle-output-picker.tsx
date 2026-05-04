"use client";

import { useState, useEffect } from "react";
import { Check, FileText, AlertCircle, PenLine } from "lucide-react";
import { projectApi, type GitHubRepoFileInfo } from "@/lib/api/projects";
import { cn } from "@/lib/utils";

interface TurtleOutputPickerProps {
  owner: string;
  repo: string;
  token: string;
  onSelect: (turtlePath: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TurtleOutputPicker({
  owner,
  repo,
  token,
  onSelect,
}: TurtleOutputPickerProps) {
  const [ttlFiles, setTtlFiles] = useState<GitHubRepoFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState("ontology.ttl");

  useEffect(() => {
    let cancelled = false;

    const scan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await projectApi.scanGitHubRepoFiles(owner, repo, token);
        if (cancelled) return;

        const ttl = result.items.filter((f) =>
          f.path.toLowerCase().endsWith(".ttl")
        );
        setTtlFiles(ttl);

        if (ttl.length === 1) {
          // Auto-select the single .ttl file
          setMode("existing");
          setSelectedPath(ttl[0].path);
          onSelect(ttl[0].path);
        } else if (ttl.length > 1) {
          // Multiple — show list, default to existing mode
          setMode("existing");
        } else {
          // No .ttl files — default to new path mode
          setMode("new");
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to scan repository"
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    scan();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectExisting = (path: string) => {
    setSelectedPath(path);
    onSelect(path);
  };

  const handleConfirmNewPath = () => {
    const trimmed = customPath.trim();
    if (!trimmed || !trimmed.toLowerCase().endsWith(".ttl")) return;
    setSelectedPath(trimmed);
    onSelect(trimmed);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-600 dark:bg-slate-700/50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Scanning repository for .ttl files...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  // Auto-selected single file — just show a confirmation badge
  if (ttlFiles.length === 1 && selectedPath === ttlFiles[0].path) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        <p className="text-sm text-green-700 dark:text-green-300">
          Turtle output path:{" "}
          <span className="font-medium">{selectedPath}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Where should the Turtle (.ttl) output be written?
      </label>

      <div className="space-y-3">
        {/* Option: Select existing .ttl file */}
        {ttlFiles.length > 0 && (
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="turtleOutputMode"
              checked={mode === "existing"}
              onChange={() => {
                setMode("existing");
                setSelectedPath(null);
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Use existing .ttl file
              </span>
              {mode === "existing" && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-600">
                  {ttlFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => handleSelectExisting(f.path)}
                      className={cn(
                        "w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-b-0 dark:border-slate-700",
                        "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                        selectedPath === f.path &&
                          "bg-primary-50 dark:bg-primary-900/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {f.path}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatFileSize(f.size)}
                            </p>
                          </div>
                        </div>
                        {selectedPath === f.path && (
                          <Check className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
        )}

        {/* Option: Define new path */}
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="turtleOutputMode"
            checked={mode === "new"}
            onChange={() => {
              setMode("new");
              setSelectedPath(null);
            }}
            className="mt-1"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Define new file path
            </span>
            {mode === "new" && (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => {
                    setCustomPath(e.target.value);
                    setSelectedPath(null);
                  }}
                  placeholder="path/to/output.ttl"
                  className="block flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  disabled={
                    !customPath.trim() ||
                    !customPath.trim().toLowerCase().endsWith(".ttl")
                  }
                  onClick={handleConfirmNewPath}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    customPath.trim() &&
                      customPath.trim().toLowerCase().endsWith(".ttl")
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                  )}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Confirm
                </button>
              </div>
            )}
            {mode === "new" &&
              customPath.trim() &&
              !customPath.trim().toLowerCase().endsWith(".ttl") && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Path must end with .ttl
                </p>
              )}
          </div>
        </label>
      </div>

      {/* Confirmed selection indicator */}
      {selectedPath && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 dark:border-green-900/50 dark:bg-green-900/20">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <p className="text-sm text-green-700 dark:text-green-300">
            Output path:{" "}
            <span className="font-medium">{selectedPath}</span>
          </p>
        </div>
      )}
    </div>
  );
}
