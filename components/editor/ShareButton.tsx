"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Share2, ChevronDown, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/context/ToastContext";
import { getLocalName } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  projectId: string;
  selectedIri?: string | null;
  selectedLabel?: string | null;
}

export function ShareButton({ projectId, selectedIri, selectedLabel }: ShareButtonProps) {
  const toast = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projectUrl = typeof window !== "undefined"
    ? `${window.location.origin}/projects/${projectId}`
    : `/projects/${projectId}`;

  const classUrl = selectedIri
    ? `${projectUrl}?classIri=${encodeURIComponent(selectedIri)}`
    : null;

  const displayLabel = selectedLabel || (selectedIri ? getLocalName(selectedIri) : null);
  const truncatedLabel = displayLabel && displayLabel.length > 24
    ? `${displayLabel.slice(0, 24)}…`
    : displayLabel;

  const copyToClipboard = useCallback(async (url: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(label ? `Copied link to "${label}"` : "Copied project link");
    } catch {
      toast.error("Failed to copy link");
    }
    setDropdownOpen(false);
  }, [toast]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Close on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dropdownOpen]);

  // No class selected — simple button
  if (!selectedIri || !classUrl) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => copyToClipboard(projectUrl)}
        aria-label="Copy project link"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Share</span>
      </Button>
    );
  }

  // Class selected — split button
  return (
    <div ref={dropdownRef} className="relative flex items-center">
      {/* Primary action: copy class link */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-r-none pr-1.5"
        onClick={() => copyToClipboard(classUrl, displayLabel || undefined)}
        aria-label={`Copy link to ${displayLabel}`}
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline text-xs max-w-[10rem] truncate">
          Share &ldquo;{truncatedLabel}&rdquo;
        </span>
      </Button>

      {/* Dropdown chevron */}
      <Button
        variant="ghost"
        size="sm"
        className="rounded-l-none border-l border-slate-200 px-1 dark:border-slate-700"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="More share options"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", dropdownOpen && "rotate-180")} />
      </Button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
            "dark:border-slate-700 dark:bg-slate-800",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          <button
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
              "dark:text-slate-300 dark:hover:bg-slate-700",
            )}
            onClick={() => copyToClipboard(classUrl, displayLabel || undefined)}
          >
            <Share2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Copy link to &ldquo;{truncatedLabel}&rdquo;</span>
          </button>
          <button
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
              "dark:text-slate-300 dark:hover:bg-slate-700",
            )}
            onClick={() => copyToClipboard(projectUrl)}
          >
            <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
            Copy project link
          </button>
        </div>
      )}
    </div>
  );
}
