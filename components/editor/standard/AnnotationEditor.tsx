"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnnotationRow } from "./AnnotationRow";
import {
  ANNOTATION_PROPERTIES,
  getAnnotationPropertiesByVocabulary,
  type KnownAnnotationProperty,
} from "@/lib/ontology/annotationProperties";
import type { AnnotationUpdate } from "@/lib/api/client";
import type { LocalizedString } from "@/lib/api/client";

interface AnnotationEditorProps {
  /** Current annotation values, grouped by property IRI */
  annotations: AnnotationUpdate[];
  /** Called when annotations change */
  onChange: (annotations: AnnotationUpdate[]) => void;
  /**
   * Filter which properties to show (whitelist).
   * - If provided, only show annotations with matching property IRIs.
   * - If undefined, show all annotations (subject to excludeProperties).
   */
  propertyFilter?: string[];
  /**
   * Properties to exclude from display (blacklist).
   * Applied after propertyFilter. Useful for hiding properties shown in their own section.
   */
  excludeProperties?: string[];
  /**
   * Properties to exclude from the "add" picker
   * (e.g., rdfs:label and rdfs:comment if handled separately)
   */
  excludeFromPicker?: string[];
  /** Show the property label chip on each row (default true) */
  showPropertyLabels?: boolean;
}

export function AnnotationEditor({
  annotations,
  onChange,
  propertyFilter,
  excludeProperties,
  excludeFromPicker,
  showPropertyLabels = true,
}: AnnotationEditorProps) {
  const [showPicker, setShowPicker] = useState(false);

  const excludeSet = excludeProperties ? new Set(excludeProperties) : null;

  // Flatten annotations into a list of (property_iri, valueIndex, value) for rendering
  const flatRows: { propertyIri: string; annotationIdx: number; valueIdx: number; value: LocalizedString }[] = [];
  for (let ai = 0; ai < annotations.length; ai++) {
    const ann = annotations[ai];
    if (propertyFilter && !propertyFilter.includes(ann.property_iri)) continue;
    if (excludeSet?.has(ann.property_iri)) continue;
    for (let vi = 0; vi < ann.values.length; vi++) {
      flatRows.push({
        propertyIri: ann.property_iri,
        annotationIdx: ai,
        valueIdx: vi,
        value: ann.values[vi],
      });
    }
  }

  const updateValue = useCallback(
    (annotationIdx: number, valueIdx: number, field: "value" | "lang", newVal: string) => {
      const updated = annotations.map((a, ai) => {
        if (ai !== annotationIdx) return a;
        return {
          ...a,
          values: a.values.map((v, vi) =>
            vi === valueIdx ? { ...v, [field]: newVal } : v
          ),
        };
      });
      onChange(updated);
    },
    [annotations, onChange]
  );

  const removeValue = useCallback(
    (annotationIdx: number, valueIdx: number) => {
      const updated = annotations
        .map((a, ai) => {
          if (ai !== annotationIdx) return a;
          const newValues = a.values.filter((_, vi) => vi !== valueIdx);
          return { ...a, values: newValues };
        })
        // Remove annotation entries with no values
        .filter((a) => a.values.length > 0);
      onChange(updated);
    },
    [annotations, onChange]
  );

  const addAnnotationValue = useCallback(
    (propertyIri: string) => {
      // Check if property already exists in annotations
      const existingIdx = annotations.findIndex((a) => a.property_iri === propertyIri);
      if (existingIdx >= 0) {
        const updated = annotations.map((a, i) => {
          if (i !== existingIdx) return a;
          return { ...a, values: [...a.values, { value: "", lang: "en" }] };
        });
        onChange(updated);
      } else {
        onChange([...annotations, { property_iri: propertyIri, values: [{ value: "", lang: "en" }] }]);
      }
      setShowPicker(false);
    },
    [annotations, onChange]
  );

  return (
    <div className="space-y-2">
      {flatRows.map((row, i) => (
        <AnnotationRow
          key={`${row.propertyIri}-${row.valueIdx}-${i}`}
          propertyIri={row.propertyIri}
          value={row.value.value}
          lang={row.value.lang}
          onValueChange={(v) => updateValue(row.annotationIdx, row.valueIdx, "value", v)}
          onLangChange={(l) => updateValue(row.annotationIdx, row.valueIdx, "lang", l)}
          onRemove={() => removeValue(row.annotationIdx, row.valueIdx)}
          showPropertyLabel={showPropertyLabels}
        />
      ))}

      {showPicker ? (
        <AnnotationPropertyPicker
          onSelect={addAnnotationValue}
          onClose={() => setShowPicker(false)}
          excludeIris={excludeFromPicker}
        />
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
        >
          <Plus className="h-3 w-3" />
          Add annotation
        </button>
      )}
    </div>
  );
}

// ── Property Picker (inline dropdown) ──

export interface AnnotationPropertyPickerProps {
  onSelect: (propertyIri: string) => void;
  onClose: () => void;
  excludeIris?: string[];
}

export function AnnotationPropertyPicker({ onSelect, onClose, excludeIris }: AnnotationPropertyPickerProps) {
  const [query, setQuery] = useState("");
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

  const excludeSet = new Set(excludeIris || []);
  const filtered = ANNOTATION_PROPERTIES.filter((p) => {
    if (excludeSet.has(p.iri)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.displayLabel.toLowerCase().includes(q) || p.curie.toLowerCase().includes(q) || p.iri.toLowerCase().includes(q);
  });

  const grouped = getAnnotationPropertiesByVocabulary();
  const filteredGrouped: Record<string, KnownAnnotationProperty[]> = {};
  for (const [vocab, props] of Object.entries(grouped)) {
    const filteredProps = props.filter((p) => filtered.includes(p));
    if (filteredProps.length > 0) {
      filteredGrouped[vocab] = filteredProps;
    }
  }

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
          placeholder="Search annotation properties..."
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white dark:placeholder:text-slate-500"
        />
        <button onClick={onClose} className="rounded-xs p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600">
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {Object.keys(filteredGrouped).length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching properties
          </p>
        ) : (
          Object.entries(filteredGrouped).map(([vocab, props]) => (
            <div key={vocab}>
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {vocab}
              </p>
              {props.map((prop) => (
                <button
                  key={prop.iri}
                  onClick={() => onSelect(prop.iri)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                    "hover:bg-slate-50 dark:hover:bg-slate-600"
                  )}
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">{prop.displayLabel}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{prop.curie}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
