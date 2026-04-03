"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Brain } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import { embeddingsApi } from "@/lib/api/embeddings";

/** Entity type icon badge */
const entityTypeIcons: Record<string, { letter: string; className: string }> = {
  class: { letter: "C", className: "bg-owl-class/10 border-owl-class/50 text-owl-class" },
  property: { letter: "P", className: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" },
  individual: { letter: "I", className: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400" },
};

interface EntitySearchComboboxProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  /** Filter to specific entity types (e.g., "class", "property", "individual") */
  entityTypes?: string;
  /** IRIs to exclude from results */
  excludeIris?: string[];
  /** Called when user selects an entity */
  onSelect: (result: EntitySearchResult) => void;
  /** Called when the combobox is closed */
  onClose: () => void;
  /** Placeholder text */
  placeholder?: string;
}

interface SearchResultWithScore extends EntitySearchResult {
  score?: number;
}

export function EntitySearchCombobox({
  projectId,
  accessToken,
  branch,
  entityTypes,
  excludeIris,
  onSelect,
  onClose,
  placeholder = "Search entities...",
}: EntitySearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"text" | "semantic">("text");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        const excludeSet = new Set(excludeIris || []);

        if (searchMode === "semantic") {
          try {
            const response = await embeddingsApi.semanticSearch(
              projectId,
              query.trim(),
              accessToken,
              branch,
              20,
              0.3
            );
            setResults(
              response.results
                .filter((r) => !excludeSet.has(r.iri))
                .map((r) => ({
                  iri: r.iri,
                  label: r.label,
                  entity_type: r.entity_type,
                  deprecated: r.deprecated,
                  score: r.score,
                }))
            );
            return;
          } catch {
            // Fall back to text search if semantic unavailable
          }
        }

        const response = await projectOntologyApi.searchEntities(
          projectId,
          query.trim(),
          accessToken,
          branch,
          entityTypes,
        );
        setResults(response.results.filter((r) => !excludeSet.has(r.iri)));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, accessToken, branch, entityTypes, excludeIris, searchMode]);

  const handleSelect = useCallback(
    (result: EntitySearchResult) => {
      onSelect(result);
      onClose();
    },
    [onSelect, onClose]
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
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white dark:placeholder:text-slate-500"
        />
        <button
          onClick={() => setSearchMode((m) => (m === "text" ? "semantic" : "text"))}
          className={cn(
            "rounded-sm p-1 transition-colors",
            searchMode === "semantic"
              ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400"
              : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600"
          )}
          title={searchMode === "semantic" ? "Semantic search (on)" : "Switch to semantic search"}
          aria-label="Toggle semantic search"
        >
          <Brain className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose} className="rounded-sm p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600">
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
            {results.map((result) => {
              const icon = entityTypeIcons[result.entity_type] || entityTypeIcons.class;
              return (
                <button
                  key={result.iri}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "hover:bg-slate-50 dark:hover:bg-slate-600"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      icon.className
                    )}
                  >
                    <span className="text-[9px] font-bold">{icon.letter}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {result.label || getLocalName(result.iri)}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {result.iri}
                    </p>
                  </div>
                  {result.score != null && result.score < 1 && (
                    <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                      {Math.round(result.score * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : query.trim() ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No results found
          </p>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Type to search
          </p>
        )}
      </div>
    </div>
  );
}
