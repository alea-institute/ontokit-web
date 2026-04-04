"use client";

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
  // Group shortcuts by category
  const grouped = new Map<string, ShortcutDefinition[]>();
  for (const s of shortcuts) {
    const group = grouped.get(s.category) || [];
    group.push(s);
    grouped.set(s.category, group);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts in the editor
          </DialogDescription>
        </DialogHeader>
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
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {shortcut.description}
                    </span>
                    <kbd className="rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
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
