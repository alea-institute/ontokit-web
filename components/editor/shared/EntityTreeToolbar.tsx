"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Search, X, Plus, ChevronDown, ChevronsDown, ChevronRight, ChevronsRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIP_DISMISSED_KEY = "ontokit:expand-tip-dismissed";

interface EntityTreeToolbarProps {
  canAdd?: boolean;
  onAdd?: () => void;
  showSearch: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
  onCloseSearch: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onExpandOneLevel?: () => void;
  onExpandAllFully?: () => void;
  onCollapseAll?: () => void;
  onCollapseOneLevel?: () => void;
  hasExpandableNodes?: boolean;
  hasExpandedNodes?: boolean;
  isExpandingAll?: boolean;
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
  onExpandOneLevel,
  onExpandAllFully,
  onCollapseAll,
  onCollapseOneLevel,
  hasExpandableNodes = false,
  hasExpandedNodes = false,
  isExpandingAll = false,
}: EntityTreeToolbarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || internalRef;

  // Dismissible tip
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TIP_DISMISSED_KEY)) {
        setShowTip(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dismissTip = useCallback(() => {
    setShowTip(false);
    try {
      localStorage.setItem(TIP_DISMISSED_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleToggle = useCallback(() => {
    onToggleSearch();
    if (!showSearch) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [onToggleSearch, showSearch, inputRef]);

  const handleExpandOneLevel = useCallback(() => {
    onExpandOneLevel?.();
    if (showTip) dismissTip();
  }, [onExpandOneLevel, showTip, dismissTip]);

  const showExpandGroup = !!(onExpandOneLevel && onExpandAllFully);
  const showCollapseGroup = !!(onCollapseAll && onCollapseOneLevel);
  const expandDisabled = !hasExpandableNodes || isExpandingAll;
  const collapseDisabled = !hasExpandedNodes;

  const btnBase = "flex items-center gap-1 px-1.5 py-1 text-xs font-medium transition-colors";
  const btnEnabled = "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700";
  const btnDisabled = "cursor-not-allowed text-slate-300 dark:text-slate-600";

  return (
    <div className="border-b border-slate-200 px-4 py-1.5 dark:border-slate-700">
      <div className="flex items-center justify-end gap-1.5">
        {canAdd && onAdd && (
          <button
            onClick={onAdd}
            className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Add entity"
          >
            <Plus className="h-4 w-4 text-slate-500" />
          </button>
        )}

        {/* Expand split-button group */}
        {showExpandGroup && (
          <div className="flex rounded-md border border-slate-200 dark:border-slate-600">
            <button
              onClick={handleExpandOneLevel}
              disabled={expandDisabled}
              className={cn(btnBase, "rounded-l-md border-r border-slate-200 dark:border-slate-600", expandDisabled ? btnDisabled : btnEnabled)}
              aria-label="Expand one level"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Expand</span>
            </button>
            <button
              onClick={onExpandAllFully}
              disabled={expandDisabled}
              className={cn(btnBase, "rounded-r-md px-1", expandDisabled ? btnDisabled : btnEnabled)}
              aria-label="Expand all levels"
            >
              {isExpandingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronsDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Collapse split-button group */}
        {showCollapseGroup && (
          <div className="flex rounded-md border border-slate-200 dark:border-slate-600">
            <button
              onClick={onCollapseAll}
              disabled={collapseDisabled}
              className={cn(btnBase, "rounded-l-md border-r border-slate-200 dark:border-slate-600", collapseDisabled ? btnDisabled : btnEnabled)}
              aria-label="Collapse all"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Collapse</span>
            </button>
            <button
              onClick={onCollapseOneLevel}
              disabled={collapseDisabled}
              className={cn(btnBase, "rounded-r-md px-1", collapseDisabled ? btnDisabled : btnEnabled)}
              aria-label="Collapse one level"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
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

      {/* Dismissible tip */}
      {showTip && showExpandGroup && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <span>Tip: click Expand to expand one level at a time</span>
          <button
            onClick={dismissTip}
            className="ml-auto rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800/50"
            aria-label="Dismiss tip"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

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
