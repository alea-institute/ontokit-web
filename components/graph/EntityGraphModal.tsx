"use client";

import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

const OntologyGraph = lazy(() =>
  import("./OntologyGraph").then((m) => ({ default: m.OntologyGraph })),
);

interface EntityGraphModalProps {
  focusIri: string;
  label: string;
  projectId: string;
  branch?: string;
  accessToken?: string;
  onNavigateToClass?: (iri: string) => void;
  onClose: () => void;
}

export function EntityGraphModal({
  focusIri,
  label,
  projectId,
  branch,
  accessToken,
  onNavigateToClass,
  onClose,
}: EntityGraphModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    // Focus the dialog container
    dialogRef.current?.focus();

    return () => {
      // Restore focus on unmount
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Trap focus within the modal
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        // When length === 1, first === last — both branches below keep focus on the single element

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleNavigate = useCallback(
    (iri: string) => {
      onNavigateToClass?.(iri);
      onClose();
    },
    [onNavigateToClass, onClose],
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-graph-title"
        tabIndex={-1}
        className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl outline-none dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
              <line x1="8" y1="7" x2="11" y2="16" strokeLinecap="round" />
              <line x1="16" y1="7" x2="13" y2="16" strokeLinecap="round" />
            </svg>
            <h2 id="entity-graph-title" className="text-lg font-bold text-slate-900 dark:text-white">
              <span className="font-medium text-slate-400 dark:text-slate-500">
                Entity Graph
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
              <span className="text-blue-700 dark:text-blue-400">{label}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Close graph modal"
          >
            <X className="h-4 w-4" />
            Close
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              Esc
            </kbd>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  <span className="text-sm text-slate-500">Loading graph viewer...</span>
                </div>
              </div>
            }
          >
            <OntologyGraph
              focusIri={focusIri}
              projectId={projectId}
              branch={branch}
              accessToken={accessToken}
              onNavigateToClass={handleNavigate}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
