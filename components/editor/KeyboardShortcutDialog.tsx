"use client";

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatShortcut, type ShortcutDefinition } from "@/lib/hooks/useKeyboardShortcuts";

interface KeyboardShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutDefinition[];
}

export function KeyboardShortcutDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutDialogProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  // Group shortcuts by category
  const grouped = new Map<string, ShortcutDefinition[]>();
  for (const s of shortcuts) {
    const group = grouped.get(s.category) || [];
    group.push(s);
    grouped.set(s.category, group);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={() => {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (openerRef.current?.isConnected) {
            event.preventDefault();
            openerRef.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts in the editor
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>Shortcuts marked “While typing” work in text fields. Other shortcuts pause while you type. The source editor keeps its own shortcuts.</p>
          <p>Use Save in the source editor to commit Turtle changes. Suggestion shortcuts require a focused suggestion.</p>
        </div>
        <div className="max-h-80 space-y-4 overflow-y-auto">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {category}
              </h3>
              <div className="space-y-1.5">
                {items.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="min-w-0 text-sm text-slate-700 dark:text-slate-300">
                      {shortcut.description}
                      {shortcut.global && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400">While typing</span>
                      )}
                    </span>
                    <kbd className="shrink-0 whitespace-nowrap rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
