"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Search, ChevronDown, X } from "lucide-react";
import { cn, getLocalName } from "@/lib/utils";
import { projectOntologyApi, type EntitySearchResult } from "@/lib/api/client";
import {
  SEE_ALSO_IRI,
  IS_DEFINED_BY_IRI,
  getAnnotationPropertyInfo,
} from "@/lib/ontology/annotationProperties";

// ── Types ──

export interface RelationshipTarget {
  iri: string;
  label: string;
}

export interface RelationshipGroup {
  property_iri: string;
  property_label: string;
  targets: RelationshipTarget[];
}

// Built-in relationship properties for the property picker
const BUILT_IN_RELATIONSHIP_PROPERTIES = [
  { iri: SEE_ALSO_IRI, label: "See Also", curie: "rdfs:seeAlso" },
  { iri: IS_DEFINED_BY_IRI, label: "Defined By", curie: "rdfs:isDefinedBy" },
];

// ── Entity type badges ──

const entityTypeIcons: Record<string, { letter: string; className: string }> = {
  class: { letter: "C", className: "bg-owl-class/10 border-owl-class/50 text-owl-class" },
  property: { letter: "P", className: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" },
  individual: { letter: "I", className: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400" },
};

// ── Main Component ──

interface RelationshipSectionProps {
  groups: RelationshipGroup[];
  isEditing: boolean;
  projectId: string;
  accessToken?: string;
  branch?: string;
  onAddTarget?: (groupIdx: number, target: RelationshipTarget) => void;
  onRemoveTarget?: (groupIdx: number, targetIdx: number) => void;
  onChangeProperty?: (groupIdx: number, newIri: string, newLabel: string) => void;
  onAddGroup?: () => void;
  onNavigateToClass?: (iri: string) => void;
}

export function RelationshipSection({
  groups,
  isEditing,
  projectId,
  accessToken,
  branch,
  onAddTarget,
  onRemoveTarget,
  onChangeProperty,
  onAddGroup,
  onNavigateToClass,
}: RelationshipSectionProps) {
  // In read mode, only show groups that have actual targets
  const visibleGroups = isEditing ? groups : groups.filter((g) => g.targets.length > 0);

  if (!isEditing && visibleGroups.length === 0) return null;

  if (!isEditing) {
    // Read mode: compact inline layout (no nested columns — Section provides the outer layout)
    return (
      <div className="space-y-1">
        {visibleGroups.map((group, gIdx) => (
          <div key={`${group.property_iri}-${gIdx}`}>
            {group.targets.map((target) => (
              <div key={target.iri} className="flex items-center gap-2">
                <span
                  className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
                  title={getAnnotationPropertyInfo(group.property_iri).curie}
                >
                  {group.property_label}
                </span>
                <button
                  onClick={() => onNavigateToClass?.(target.iri)}
                  className={cn(
                    "min-w-0 truncate text-sm",
                    onNavigateToClass
                      ? "text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                  title={target.iri}
                  disabled={!onNavigateToClass}
                >
                  {target.label || getLocalName(target.iri)}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Edit mode: two-column layout with property picker and entity search
  return (
    <div className="space-y-3">
      {visibleGroups.map((group, gIdx) => (
        <div key={`${group.property_iri}-${gIdx}`} className="flex gap-4">
          {/* Property label (left column) */}
          <div className="w-40 shrink-0 pt-1">
            <RelationshipPropertyPicker
              currentIri={group.property_iri}
              currentLabel={group.property_label}
              projectId={projectId}
              accessToken={accessToken}
              branch={branch}
              onChange={(iri, label) => onChangeProperty?.(gIdx, iri, label)}
            />
          </div>

          {/* Targets (right column) */}
          <div className="min-w-0 flex-1 space-y-2">
            {group.targets.map((target, tIdx) => (
              <div key={target.iri} className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateToClass?.(target.iri)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                  title={target.iri}
                >
                  <span className="truncate">{target.label || getLocalName(target.iri)}</span>
                </button>
                <button
                  onClick={() => onRemoveTarget?.(gIdx, tIdx)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Ghost row: inline entity search for adding new target */}
            <RelationshipEntitySearch
              projectId={projectId}
              accessToken={accessToken}
              branch={branch}
              excludeIris={group.targets.map((t) => t.iri)}
              onSelect={(result) =>
                onAddTarget?.(gIdx, {
                  iri: result.iri,
                  label: result.label || getLocalName(result.iri),
                })
              }
            />
          </div>
        </div>
      ))}

      {/* Add relationship group button */}
      <button
        onClick={onAddGroup}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
      >
        <span className="text-sm">+</span>
        Add relationship
      </button>
    </div>
  );
}

// ── Property Picker (dropdown in the left column) ──

interface RelationshipPropertyPickerProps {
  currentIri: string;
  currentLabel: string;
  projectId: string;
  accessToken?: string;
  branch?: string;
  onChange: (iri: string, label: string) => void;
}

function RelationshipPropertyPicker({
  currentIri,
  currentLabel,
  projectId,
  accessToken,
  branch,
  onChange,
}: RelationshipPropertyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Search for ontology properties when query changes
  useEffect(() => {
    if (!query.trim()) {
      setApiResults([]);
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
          "property",
        );
        setApiResults(response.results);
      } catch {
        setApiResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, accessToken, branch]);

  const filteredBuiltIn = BUILT_IN_RELATIONSHIP_PROPERTIES.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.label.toLowerCase().includes(q) || p.curie.toLowerCase().includes(q) || p.iri.toLowerCase().includes(q);
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-xs font-medium text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
      >
        <span className="flex-1 truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
          <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-slate-600">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsOpen(false);
              }}
              placeholder="Search properties..."
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {/* Built-in relationship properties */}
            {filteredBuiltIn.length > 0 && (
              <div>
                <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  RDFS
                </p>
                {filteredBuiltIn.map((prop) => (
                  <button
                    key={prop.iri}
                    onClick={() => {
                      onChange(prop.iri, prop.label);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1 text-left text-xs",
                      "hover:bg-slate-50 dark:hover:bg-slate-600",
                      prop.iri === currentIri && "bg-primary-50 dark:bg-primary-900/20"
                    )}
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">{prop.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{prop.curie}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Ontology properties from search */}
            {query.trim() && (
              <div>
                {isSearching ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                  </div>
                ) : apiResults.length > 0 ? (
                  <>
                    <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Ontology Properties
                    </p>
                    {apiResults.map((result) => (
                      <button
                        key={result.iri}
                        onClick={() => {
                          onChange(result.iri, result.label || getLocalName(result.iri));
                          setIsOpen(false);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-600"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {result.label || getLocalName(result.iri)}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            )}

            {filteredBuiltIn.length === 0 && apiResults.length === 0 && !isSearching && query.trim() && (
              <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                No matching properties
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Entity Search (ghost row for adding targets) ──

interface RelationshipEntitySearchProps {
  projectId: string;
  accessToken?: string;
  branch?: string;
  excludeIris?: string[];
  onSelect: (result: EntitySearchResult) => void;
}

function RelationshipEntitySearch({
  projectId,
  accessToken,
  branch,
  excludeIris,
  onSelect,
}: RelationshipEntitySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        );
        const excludeSet = new Set(excludeIris || []);
        setResults(response.results.filter((r) => !excludeSet.has(r.iri)));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, accessToken, branch, excludeIris]);

  useEffect(() => {
    if (!isFocused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFocused]);

  const handleSelect = useCallback(
    (result: EntitySearchResult) => {
      onSelect(result);
      setQuery("");
      setResults([]);
    },
    [onSelect]
  );

  const showDropdown = isFocused && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsFocused(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search entities to add..."
        className="flex-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
      />
      {/* Placeholder to align with the delete button column */}
      <div className="shrink-0 rounded p-1">
        <div className="h-3.5 w-3.5" />
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
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
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-600"
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
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No results found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
