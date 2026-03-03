"use client";

import { useRef, useCallback } from "react";
import { Search, X, Plus, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntityTreeToolbarProps {
  canAdd?: boolean;
  onAdd?: () => void;
  showSearch: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
  onCloseSearch: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function EntityTreeToolbar({
  canAdd,
  onAdd,
  showSearch,
  searchQuery,
  onToggleSearch,
  onSearchChange,
  onCloseSearch,
  searchInputRef,
  onExpandAll,
  onCollapseAll,
}: EntityTreeToolbarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || internalRef;

  const handleToggle = useCallback(() => {
    onToggleSearch();
    if (!showSearch) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [onToggleSearch, showSearch, inputRef]);

  return (
    <div className="border-b border-slate-200 px-4 py-1.5 dark:border-slate-700">
      <div className="flex items-center justify-end gap-1">
        {canAdd && onAdd && (
          <button
            onClick={onAdd}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Add entity"
          >
            <Plus className="h-4 w-4 text-slate-500" />
          </button>
        )}
        {onExpandAll && (
          <button
            onClick={onExpandAll}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Expand all"
          >
            <ChevronsDownUp className="h-4 w-4 text-slate-500" />
          </button>
        )}
        {onCollapseAll && (
          <button
            onClick={onCollapseAll}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Collapse all"
          >
            <ChevronsUpDown className="h-4 w-4 text-slate-500" />
          </button>
        )}
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center gap-0.5 rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700",
            showSearch && "bg-slate-100 dark:bg-slate-700",
          )}
          title={showSearch ? "Close search" : "Search (Ctrl+K)"}
          aria-label={showSearch ? "Close search" : "Search entities"}
        >
          {showSearch ? (
            <X className="h-4 w-4 text-slate-500" />
          ) : (
            <>
              <Search className="h-4 w-4 text-slate-500" />
              <kbd className="hidden text-[9px] text-slate-400 sm:inline">K</kbd>
            </>
          )}
        </button>
      </div>
      {showSearch && (
        <div className="mt-1.5 pb-0.5">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCloseSearch();
            }}
            placeholder="Search classes, properties, individuals..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
      )}
    </div>
  );
}
