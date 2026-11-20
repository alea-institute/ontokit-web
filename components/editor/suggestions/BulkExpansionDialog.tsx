"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAnnounce } from "@/components/ui/ScreenReaderAnnouncer";
import { treeItemId } from "@/components/editor/shared/EntityTreeNode";
import {
  MAX_BULK_EXPANSION_CLASSES, useBulkExpansion,
  type BulkExpansionBatchSize, type BulkExpansionTarget,
} from "@/lib/hooks/useBulkExpansion";
import type { ClassTreeNode } from "@/lib/ontology/types";

interface BulkExpansionDialogProps {
  targets: BulkExpansionTarget[];
  onCancel: () => void;
  returnFocus: () => void;
  onGenerate: (targets: BulkExpansionTarget[], size: BulkExpansionBatchSize) => void;
}

const batchSizes: BulkExpansionBatchSize[] = [3, 5, 10];
const fieldFocus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:focus-visible:outline-primary-400";

export function BulkExpansionDialog({ targets, onCancel, returnFocus, onGenerate }: BulkExpansionDialogProps) {
  const [checked, setChecked] = useState(() => new Set(targets.slice(0, MAX_BULK_EXPANSION_CLASSES).map((target) => target.iri)));
  const [size, setSize] = useState<BulkExpansionBatchSize>(5);
  const submitted = useRef(false);
  const count = checked.size;

  const toggle = (iri: string, selected: boolean) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (selected && next.size < MAX_BULK_EXPANSION_CLASSES) next.add(iri);
      if (!selected) next.delete(iri);
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!submitted.current) returnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Suggest subclasses for each subclass</DialogTitle>
          <DialogDescription>
            This makes {count} AI request{count === 1 ? "" : "s"}, one per class, counted against your daily limit and the project budget.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="min-w-0 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          <legend className="font-medium">Subclasses to expand</legend>
          {targets.length > MAX_BULK_EXPANSION_CLASSES && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              The first {MAX_BULK_EXPANSION_CLASSES} subclasses are checked. Select up to {MAX_BULK_EXPANSION_CLASSES} at a time.
            </p>
          )}
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
            {targets.map(({ iri, label }) => (
              <li key={iri}>
                <label className="flex items-center gap-2 break-all rounded-sm px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={checked.has(iri)}
                    disabled={!checked.has(iri) && count >= MAX_BULK_EXPANSION_CLASSES}
                    onChange={(event) => toggle(iri, event.currentTarget.checked)}
                    className={`h-4 w-4 shrink-0 rounded-sm accent-primary-600 dark:accent-primary-400 ${fieldFocus}`}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Suggestions per class
          <select
            value={size}
            onChange={(event) => setSize(Number(event.currentTarget.value) as BulkExpansionBatchSize)}
            className={`rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800 ${fieldFocus}`}
          >
            {batchSizes.map((choice) => <option key={choice}>{choice}</option>)}
          </select>
        </label>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={count === 0} onClick={() => {
            submitted.current = true;
            onGenerate(targets.filter((target) => checked.has(target.iri)), size);
          }}>
            Generate for {count} {count === 1 ? "class" : "classes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function indexLoadedSubclasses(nodes: ClassTreeNode[]) {
  const byParent = new Map<string, BulkExpansionTarget[]>();
  const visit = (node: ClassTreeNode) => {
    if (node.children.length && !byParent.has(node.iri)) {
      byParent.set(node.iri, Array.from(new Map(node.children.map(({ iri, label }) => [iri, { iri, label: label || iri }])).values()));
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return byParent;
}

interface BulkExpansionControlsOptions {
  nodes: ClassTreeNode[];
  projectId: string;
  branch: string;
  accessToken?: string;
  byoKey?: string;
  canUseLLM: boolean;
}

export function useBulkExpansionControls({ nodes, ...options }: BulkExpansionControlsOptions) {
  const { announce } = useAnnounce();
  const { runId, jobs, totals, haltReason, start, stop, retry, dismiss } = useBulkExpansion({ ...options, announce });
  const targetsByIri = useMemo(() => indexLoadedSubclasses(nodes), [nodes]);
  const { projectId, branch } = options;
  const scope = useMemo(() => ({ projectId, branch }), [projectId, branch]);
  const [preflight, setPreflight] = useState<{
    scope: typeof scope;
    targets: BulkExpansionTarget[];
    returnFocus: () => void;
  } | null>(null);
  const close = () => setPreflight(null);

  const busy = totals.generating > 0;
  const menu = useMemo(() => ({
    getTargets: (iri: string) => targetsByIri.get(iri) ?? [],
    open: (iri: string, targets: BulkExpansionTarget[]) => {
      const row = document.getElementById(treeItemId(iri));
      setPreflight({
        scope,
        targets,
        returnFocus: () => {
          if (!row?.isConnected) return;
          if (!row.hasAttribute("tabindex")) {
            row.tabIndex = -1;
            row.addEventListener("blur", () => row.removeAttribute("tabindex"), { once: true });
          }
          row.focus();
        },
      });
    },
    lockedReason: busy ? "Bulk expansion is already running." : undefined,
  }), [busy, scope, targetsByIri]);

  return {
    menu,
    dialog: preflight?.scope === scope && {
      targets: preflight.targets,
      returnFocus: preflight.returnFocus,
      onCancel: close,
      onGenerate: (targets: BulkExpansionTarget[], size: BulkExpansionBatchSize) => {
        close();
        void start(targets, size);
      },
    },
    review: {
      projectId, branch, canUseLLM: options.canUseLLM,
      runId, jobs, totals, haltReason, stop, retry,
      dismiss: () => {
        dismiss();
        // The Close button leaves with the review; hand focus to the tree it came from.
        document.querySelector<HTMLElement>('[role="tree"]')?.focus();
      },
    },
  };
}
