"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageFlag } from "@/components/editor/LanguageFlag";
import {
  ANNOTATION_PROPERTIES,
  getAnnotationPropertiesByVocabulary,
  type KnownAnnotationProperty,
} from "@/lib/ontology/annotationProperties";

interface InlineAnnotationAdderProps {
  excludeIris: string[];
  onAdd: (propertyIri: string, value: string, lang: string) => void;
  /** Called after a new annotation is committed — used for auto-save */
  onSaveNeeded?: () => void;
}

export function InlineAnnotationAdder({ excludeIris, onAdd, onSaveNeeded }: InlineAnnotationAdderProps) {
  const [selectedProperty, setSelectedProperty] = useState<KnownAnnotationProperty | null>(null);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [value, setValue] = useState("");
  const [lang, setLang] = useState("en");

  const containerRef = useRef<HTMLDivElement>(null);
  const propertyInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const excludeSet = new Set(excludeIris);
  const filteredProperties = ANNOTATION_PROPERTIES.filter((p) => {
    if (excludeSet.has(p.iri)) return false;
    if (!propertyQuery.trim()) return true;
    const q = propertyQuery.toLowerCase();
    return (
      p.displayLabel.toLowerCase().includes(q) ||
      p.curie.toLowerCase().includes(q) ||
      p.iri.toLowerCase().includes(q)
    );
  });

  const grouped = getAnnotationPropertiesByVocabulary();
  const filteredGrouped: Record<string, KnownAnnotationProperty[]> = {};
  for (const [vocab, props] of Object.entries(grouped)) {
    const filteredProps = props.filter((p) => filteredProperties.includes(p));
    if (filteredProps.length > 0) {
      filteredGrouped[vocab] = filteredProps;
    }
  }

  const handleSelectProperty = (prop: KnownAnnotationProperty) => {
    setSelectedProperty(prop);
    setPropertyQuery("");
    setIsDropdownOpen(false);
    setTimeout(() => valueInputRef.current?.focus(), 0);
  };

  const handleCommit = () => {
    if (!selectedProperty || !value.trim()) return;
    onAdd(selectedProperty.iri, value.trim(), lang.trim());
    setSelectedProperty(null);
    setPropertyQuery("");
    setValue("");
    setLang("en");
    onSaveNeeded?.();
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedProperty && value.trim()) {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div className="flex gap-4">
      <div className="w-40 shrink-0 pt-1">
        {/* Property combobox */}
        <div ref={containerRef} className="relative">
          {selectedProperty ? (
            <button
              onClick={() => {
                setSelectedProperty(null);
                setIsDropdownOpen(true);
                setTimeout(() => propertyInputRef.current?.focus(), 0);
              }}
              className="flex w-full items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-xs font-medium text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
            >
              <span className="flex-1 truncate">{selectedProperty.displayLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
            </button>
          ) : (
            <div className="relative">
              <input
                ref={propertyInputRef}
                type="text"
                value={propertyQuery}
                onChange={(e) => {
                  setPropertyQuery(e.target.value);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsDropdownOpen(false);
                }}
                placeholder="Select property..."
                aria-label="Select annotation property"
                className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:placeholder:text-slate-500"
              />
            </div>
          )}

          {isDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
              {!selectedProperty && (
                <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-1.5 dark:border-slate-600">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={propertyQuery}
                    onChange={(e) => setPropertyQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsDropdownOpen(false);
                    }}
                    placeholder="Filter properties..."
                    className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-white dark:placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              )}
              <div className="max-h-48 overflow-y-auto py-1">
                {Object.keys(filteredGrouped).length === 0 ? (
                  <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    No matching properties
                  </p>
                ) : (
                  Object.entries(filteredGrouped).map(([vocab, props]) => (
                    <div key={vocab}>
                      <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {vocab}
                      </p>
                      {props.map((prop) => (
                        <button
                          key={prop.iri}
                          onClick={() => handleSelectProperty(prop)}
                          className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-600"
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {prop.displayLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {prop.curie}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Value + lang + placeholder for delete button */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <input
            ref={valueInputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleValueKeyDown}
            onBlur={() => {
              if (selectedProperty && value.trim()) handleCommit();
            }}
            placeholder={selectedProperty ? "Enter value..." : "Select a property first"}
            disabled={!selectedProperty}
            aria-label="Annotation value"
            className={cn(
              "flex-1 rounded-md border px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500",
              selectedProperty
                ? "border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                : "border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
            )}
          />
          <div className="mt-1 shrink-0">
            <LanguageFlag lang={lang} />
          </div>
          <input
            type="text"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-14 shrink-0 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5 text-center text-xs focus:border-primary-500 focus:border-solid focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            aria-label="Language tag"
            placeholder="lang"
            disabled={!selectedProperty}
          />
          {/* Invisible placeholder to align with delete buttons above */}
          <div className="shrink-0 rounded-xs p-1">
            <div className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
