"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";

interface ParentClassPickerProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  /** IRIs already selected as parents (to exclude from results) */
  excludeIris: string[];
  onSelect: (iri: string, label: string) => void;
  onClose: () => void;
}

export function ParentClassPicker({
  projectId,
  accessToken,
  branch,
  excludeIris,
  onSelect,
  onClose,
}: ParentClassPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await projectOntologyApi.searchEntities(
          projectId,
          query.trim(),
          accessToken,
          branch,
          "class",
        );
        // Filter out already-selected parents
        const excludeSet = new Set(excludeIris);
        setResults(response.results.filter((r) => !excludeSet.has(r.iri)));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, accessToken, branch, excludeIris]);

  const handleSelect = useCallback(
    (result: EntitySearchResult) => {
      onSelect(result.iri, result.label || getLocalName(result.iri));
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-600">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder="Search for a class..."
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
        />
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : results.length > 0 ? (
          <div className="py-1">
            {results.map((result) => (
              <button
                key={result.iri}
                onClick={() => handleSelect(result)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "hover:bg-slate-50 dark:hover:bg-slate-600",
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
                  <span className="text-[9px] font-bold text-owl-class">C</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">
                    {result.label || getLocalName(result.iri)}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {result.iri}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No classes found
          </p>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Type to search for classes
          </p>
        )}
      </div>
    </div>
  );
}
