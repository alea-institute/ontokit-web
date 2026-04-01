"use client";

import { useState, useEffect } from "react";
import { Check, FileText, AlertCircle } from "lucide-react";
import {
  projectApi,
  type GitHubRepoFileInfo,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";

interface OntologyFilePickerProps {
  owner: string;
  repo: string;
  token: string;
  onSelect: (file: GitHubRepoFileInfo, turtlePath: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Replace the file extension with .ttl, preserving the directory path. */
function toTtlPath(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return `${filePath}.ttl`;
  return `${filePath.substring(0, dotIndex)}.ttl`;
}

function isTtlFile(path: string): boolean {
  return path.toLowerCase().endsWith(".ttl");
}

export function OntologyFilePicker({
  owner,
  repo,
  token,
  onSelect,
}: OntologyFilePickerProps) {
  const [files, setFiles] = useState<GitHubRepoFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubRepoFileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Turtle path sub-step state (for non-.ttl source files)
  const [turtlePathMode, setTurtlePathMode] = useState<"existing" | "new">("new");
  const [customTurtlePath, setCustomTurtlePath] = useState("");
  const [selectedTurtleFile, setSelectedTurtleFile] = useState<GitHubRepoFileInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const scan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await projectApi.scanGitHubRepoFiles(owner, repo, token);
        if (cancelled) return;
        setFiles(result.items);

        // Auto-select if only one file AND it's a .ttl file
        if (result.items.length === 1 && isTtlFile(result.items[0].path)) {
          setSelectedFile(result.items[0]);
          onSelect(result.items[0], result.items[0].path);
        } else if (result.items.length === 1) {
          // Single non-.ttl file: visually select it but don't call onSelect yet
          setSelectedFile(result.items[0]);
          setCustomTurtlePath(toTtlPath(result.items[0].path));
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

  const handleSelect = (file: GitHubRepoFileInfo) => {
    setSelectedFile(file);
    // Reset turtle path state
    setSelectedTurtleFile(null);

    if (isTtlFile(file.path)) {
      // .ttl files proceed immediately
      setTurtlePathMode("new");
      onSelect(file, file.path);
    } else {
      // Non-.ttl: suggest a default turtle path
      setCustomTurtlePath(toTtlPath(file.path));
      // Default to "existing" mode if .ttl files are available in the repo
      if (ttlFiles.length > 0) {
        setTurtlePathMode("existing");
        setSelectedTurtleFile(ttlFiles[0]);
      } else {
        setTurtlePathMode("new");
      }
    }
  };

  const handleConfirmTurtlePath = () => {
    if (!selectedFile) return;

    const turtlePath =
      turtlePathMode === "existing" && selectedTurtleFile
        ? selectedTurtleFile.path
        : customTurtlePath.trim();

    if (!turtlePath || !turtlePath.toLowerCase().endsWith(".ttl")) return;

    onSelect(selectedFile, turtlePath);
  };

  const ttlFiles = files.filter((f) => isTtlFile(f.path));
  const needsTurtlePath = selectedFile && !isTtlFile(selectedFile.path);

  // Validate the current turtle path
  const currentTurtlePath =
    turtlePathMode === "existing" && selectedTurtleFile
      ? selectedTurtleFile.path
      : customTurtlePath.trim();
  const isTurtlePathValid =
    currentTurtlePath.length > 0 && currentTurtlePath.toLowerCase().endsWith(".ttl");

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-600 dark:bg-slate-700/50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Scanning repository for ontology files...
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

  if (files.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            No ontology files found
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            This repository does not contain any files with supported extensions
            (.ttl, .owl, .owx, .rdf, .n3, .jsonld).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {files.length === 1
          ? "Found 1 ontology file"
          : `Found ${files.length} ontology files — select one`}
      </label>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            onClick={() => handleSelect(file)}
            className={cn(
              "w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 dark:border-slate-700",
              "hover:bg-slate-50 dark:hover:bg-slate-700/50",
              selectedFile?.path === file.path &&
                "bg-primary-50 dark:bg-primary-900/20"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {file.path}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              {selectedFile?.path === file.path && (
                <Check className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Turtle output path sub-step for non-.ttl source files */}
      {needsTurtlePath && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-200">
            The selected file is not Turtle (.ttl). Where should the normalized
            Turtle output be written in the repository?
          </p>

          <div className="space-y-3">
            {/* Option: Create new .ttl file */}
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="turtlePathMode"
                checked={turtlePathMode === "new"}
                onChange={() => setTurtlePathMode("new")}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Create new .ttl file
                </span>
                {turtlePathMode === "new" && (
                  <input
                    type="text"
                    value={customTurtlePath}
                    onChange={(e) => setCustomTurtlePath(e.target.value)}
                    placeholder="path/to/output.ttl"
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                  />
                )}
              </div>
            </label>

            {/* Option: Use existing .ttl file */}
            <label className={cn(
              "flex items-start gap-2",
              ttlFiles.length === 0 && "cursor-not-allowed opacity-50"
            )}>
              <input
                type="radio"
                name="turtlePathMode"
                checked={turtlePathMode === "existing"}
                onChange={() => setTurtlePathMode("existing")}
                disabled={ttlFiles.length === 0}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Use existing .ttl file
                </span>
                {ttlFiles.length === 0 && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    No .ttl files found in the repository
                  </p>
                )}
                {turtlePathMode === "existing" && ttlFiles.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-300 dark:border-slate-600">
                    {ttlFiles.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => setSelectedTurtleFile(f)}
                        className={cn(
                          "w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 dark:border-slate-700",
                          "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                          selectedTurtleFile?.path === f.path &&
                            "bg-primary-50 font-medium dark:bg-primary-900/20"
                        )}
                      >
                        {f.path}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>

            {/* Confirm button */}
            <button
              type="button"
              disabled={!isTurtlePathValid}
              onClick={handleConfirmTurtlePath}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                isTurtlePathValid
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
              )}
            >
              Confirm Turtle output path
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
