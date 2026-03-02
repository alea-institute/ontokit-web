"use client";

import { Trash2 } from "lucide-react";
import { getAnnotationPropertyInfo } from "@/lib/ontology/annotationProperties";

interface AnnotationRowProps {
  propertyIri: string;
  value: string;
  lang: string;
  onValueChange: (value: string) => void;
  onLangChange: (lang: string) => void;
  onRemove?: () => void;
  /** Called when an input loses focus — used for auto-save */
  onBlur?: () => void;
  /** Show property label chip (false when used in a section that already has a heading) */
  showPropertyLabel?: boolean;
  /** Custom placeholder for the value input (defaults to "Value") */
  placeholder?: string;
}

export function AnnotationRow({
  propertyIri,
  value,
  lang,
  onValueChange,
  onLangChange,
  onRemove,
  onBlur,
  showPropertyLabel = true,
  placeholder = "Value",
}: AnnotationRowProps) {
  const { displayLabel, curie } = getAnnotationPropertyInfo(propertyIri);
  const isLongValue = value.length > 80;

  return (
    <div className="flex items-start gap-2">
      {showPropertyLabel && (
        <span
          className="mt-1.5 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          title={curie}
        >
          {displayLabel}
        </span>
      )}
      {isLongValue ? (
        <textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={2}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      )}
      <input
        type="text"
        value={lang}
        onChange={(e) => onLangChange(e.target.value)}
        onBlur={onBlur}
        className="w-14 shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        title="Language tag (e.g. en, de, fr)"
        placeholder="lang"
      />
      {onRemove ? (
        <button
          onClick={onRemove}
          className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="mt-1 shrink-0 rounded p-1">
          <div className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
