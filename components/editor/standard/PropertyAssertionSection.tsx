"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { getLocalName } from "@/lib/utils";
import { LanguageFlag } from "@/components/editor/LanguageFlag";
import { projectOntologyApi } from "@/lib/api/client";
import type { PropertyAssertion } from "@/lib/ontology/entityDetailExtractors";

interface PropertyAssertionSectionProps {
  assertions: PropertyAssertion[];
  assertionType: "object" | "data";
  isEditing: boolean;
  projectId: string;
  accessToken?: string;
  branch?: string;
  onAdd?: (assertion: PropertyAssertion) => void;
  onRemove?: (index: number) => void;
  onNavigateToEntity?: (iri: string) => void;
  onSaveNeeded?: () => void;
  resolvedLabels?: Record<string, string>;
}

export function PropertyAssertionSection({
  assertions,
  assertionType,
  isEditing,
  projectId,
  accessToken,
  branch,
  onAdd,
  onRemove,
  onNavigateToEntity,
  onSaveNeeded,
  resolvedLabels,
}: PropertyAssertionSectionProps) {
  if (!isEditing && assertions.length === 0) return null;

  return (
    <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
      {assertions.map((a, idx) => {
        const propLabel = resolvedLabels?.[a.propertyIri] || getLocalName(a.propertyIri);
        return (
          <div key={idx} className="contents">
            <span
              className="self-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              title={a.propertyIri}
            >
              {propLabel}
            </span>
            <div className="flex items-center gap-2">
              {assertionType === "object" && a.targetIri ? (
                <button
                  onClick={() => onNavigateToEntity?.(a.targetIri!)}
                  className="truncate text-sm text-primary-600 hover:underline dark:text-primary-400"
                  title={a.targetIri}
                >
                  {resolvedLabels?.[a.targetIri] || getLocalName(a.targetIri)}
                </button>
              ) : (
                <>
                  {a.lang && <LanguageFlag lang={a.lang} />}
                  <span className="text-sm text-slate-700 dark:text-slate-300">{a.value}</span>
                  {a.datatype && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400" title={a.datatype}>
                      {getLocalName(a.datatype)}
                    </span>
                  )}
                </>
              )}
              {isEditing && onRemove && (
                <button
                  onClick={() => { onRemove(idx); onSaveNeeded?.(); }}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Ghost row for adding */}
      {isEditing && onAdd && (
        <AssertionAdder
          assertionType={assertionType}
          projectId={projectId}
          accessToken={accessToken}
          branch={branch}
          onAdd={(a) => { onAdd(a); onSaveNeeded?.(); }}
        />
      )}
    </div>
  );
}

// ── Assertion adder sub-component ──

interface AssertionAdderProps {
  assertionType: "object" | "data";
  projectId: string;
  accessToken?: string;
  branch?: string;
  onAdd: (assertion: PropertyAssertion) => void;
}

function AssertionAdder({ assertionType, projectId, accessToken, branch, onAdd }: AssertionAdderProps) {
  const [propQuery, setPropQuery] = useState("");
  const [propResults, setPropResults] = useState<{ iri: string; label?: string }[]>([]);
  const [selectedPropIri, setSelectedPropIri] = useState<string | null>(null);
  const [selectedPropLabel, setSelectedPropLabel] = useState<string>("");
  const [isPropSearching, setIsPropSearching] = useState(false);
  const [isPropFocused, setIsPropFocused] = useState(false);

  const [valueQuery, setValueQuery] = useState("");
  const [valueResults, setValueResults] = useState<{ iri: string; label?: string }[]>([]);
  const [isValueSearching, setIsValueSearching] = useState(false);
  const [isValueFocused, setIsValueFocused] = useState(false);

  const [dataValue, setDataValue] = useState("");
  const [dataLang, setDataLang] = useState("en");

  const propContainerRef = useRef<HTMLDivElement>(null);
  const valueContainerRef = useRef<HTMLDivElement>(null);

  // Search properties
  useEffect(() => {
    if (!propQuery.trim()) { setPropResults([]); setIsPropSearching(false); return; }
    setIsPropSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await projectOntologyApi.searchEntities(projectId, propQuery.trim(), accessToken, branch, "property");
        setPropResults(response.results);
      } catch { setPropResults([]); } finally { setIsPropSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [propQuery, projectId, accessToken, branch]);

  // Search entities for object values
  useEffect(() => {
    if (assertionType !== "object" || !valueQuery.trim()) { setValueResults([]); setIsValueSearching(false); return; }
    setIsValueSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await projectOntologyApi.searchEntities(projectId, valueQuery.trim(), accessToken, branch);
        setValueResults(response.results);
      } catch { setValueResults([]); } finally { setIsValueSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [valueQuery, projectId, accessToken, branch, assertionType]);

  // Click outside handlers
  useEffect(() => {
    if (!isPropFocused) return;
    const h = (e: MouseEvent) => { if (propContainerRef.current && !propContainerRef.current.contains(e.target as Node)) setIsPropFocused(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isPropFocused]);

  useEffect(() => {
    if (!isValueFocused) return;
    const h = (e: MouseEvent) => { if (valueContainerRef.current && !valueContainerRef.current.contains(e.target as Node)) setIsValueFocused(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isValueFocused]);

  const handleSelectProp = useCallback((iri: string, label?: string) => {
    setSelectedPropIri(iri);
    setSelectedPropLabel(label || getLocalName(iri));
    setPropQuery("");
    setPropResults([]);
    setIsPropFocused(false);
  }, []);

  const handleAddObject = useCallback((targetIri: string) => {
    if (!selectedPropIri) return;
    onAdd({ propertyIri: selectedPropIri, targetIri });
    setSelectedPropIri(null);
    setSelectedPropLabel("");
    setValueQuery("");
    setValueResults([]);
  }, [selectedPropIri, onAdd]);

  const handleAddData = useCallback(() => {
    if (!selectedPropIri || !dataValue.trim()) return;
    onAdd({ propertyIri: selectedPropIri, value: dataValue.trim(), lang: dataLang.trim() || undefined });
    setSelectedPropIri(null);
    setSelectedPropLabel("");
    setDataValue("");
    setDataLang("en");
  }, [selectedPropIri, dataValue, dataLang, onAdd]);

  return (
    <div className="flex gap-2">
      {/* Property selector */}
      <div ref={propContainerRef} className="relative w-40 shrink-0">
        {selectedPropIri ? (
          <button
            onClick={() => { setSelectedPropIri(null); setSelectedPropLabel(""); }}
            className="flex w-full items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            <span className="flex-1 truncate">{selectedPropLabel}</span>
          </button>
        ) : (
          <input
            type="text"
            value={propQuery}
            onChange={(e) => setPropQuery(e.target.value)}
            onFocus={() => setIsPropFocused(true)}
            placeholder="Select property..."
            className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5 text-xs placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
          />
        )}
        {isPropFocused && propQuery.trim() && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
            <div className="max-h-48 overflow-y-auto py-1">
              {isPropSearching ? (
                <div className="flex items-center justify-center py-2"><div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /></div>
              ) : propResults.length > 0 ? (
                propResults.map((r) => (
                  <button key={r.iri} onClick={() => handleSelectProp(r.iri, r.label)} className="flex w-full items-center px-2 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-600">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.label || getLocalName(r.iri)}</span>
                  </button>
                ))
              ) : (
                <p className="py-2 text-center text-xs text-slate-500">No properties found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Value input */}
      <div className="min-w-0 flex-1">
        {assertionType === "object" ? (
          <div ref={valueContainerRef} className="relative">
            <input
              type="text"
              value={valueQuery}
              onChange={(e) => setValueQuery(e.target.value)}
              onFocus={() => setIsValueFocused(true)}
              placeholder={selectedPropIri ? "Search entity..." : "Select a property first"}
              disabled={!selectedPropIri}
              className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800"
            />
            {isValueFocused && valueQuery.trim() && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
                <div className="max-h-48 overflow-y-auto py-1">
                  {isValueSearching ? (
                    <div className="flex items-center justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /></div>
                  ) : valueResults.length > 0 ? (
                    valueResults.map((r) => (
                      <button key={r.iri} onClick={() => handleAddObject(r.iri)} className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-600">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 dark:text-white">{r.label || getLocalName(r.iri)}</p>
                          <p className="truncate text-xs text-slate-500">{r.iri}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-slate-500">No results</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={dataValue}
              onChange={(e) => setDataValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddData(); }}
              onBlur={() => { if (dataValue.trim()) handleAddData(); }}
              placeholder={selectedPropIri ? "Enter value..." : "Select a property first"}
              disabled={!selectedPropIri}
              className="flex-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800"
            />
            <div className="mt-1 shrink-0">
              <LanguageFlag lang={dataLang} />
            </div>
            <input
              type="text"
              value={dataLang}
              onChange={(e) => setDataLang(e.target.value)}
              className="w-14 shrink-0 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5 text-center text-xs focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              title="Language tag"
              placeholder="lang"
              disabled={!selectedPropIri}
            />
          </div>
        )}
      </div>
    </div>
  );
}
