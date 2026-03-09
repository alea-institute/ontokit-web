"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Info,
  Tag,
  MessageSquare,
  Copy,
  Trash2,
  AlertTriangle,
  Pencil,
  X,
  Lightbulb,
  StickyNote,
  Link2,
  Layers,
  Equal,
  Ban,
  Box,
  Database,
} from "lucide-react";
import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import { cn, getLocalName } from "@/lib/utils";
import { LanguageFlag } from "@/components/editor/LanguageFlag";
import { AnnotationRow } from "@/components/editor/standard/AnnotationRow";
import { InlineAnnotationAdder } from "@/components/editor/standard/InlineAnnotationAdder";
import { RelationshipSection, type RelationshipGroup, type RelationshipTarget } from "@/components/editor/standard/RelationshipSection";
import { PropertyAssertionSection } from "@/components/editor/standard/PropertyAssertionSection";
import { LABEL_IRI, COMMENT_IRI, DEFINITION_IRI, SEE_ALSO_IRI, getAnnotationPropertyInfo } from "@/lib/ontology/annotationProperties";
import { AutoSaveStatusBar } from "@/components/editor/AutoSaveStatusBar";
import { useEntityAutoSave } from "@/lib/hooks/useEntityAutoSave";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useToast } from "@/lib/context/ToastContext";
import {
  extractIndividualDetail,
  type ParsedIndividualDetail,
  type PropertyAssertion,
} from "@/lib/ontology/entityDetailExtractors";
import { type IndividualDraftEntry } from "@/lib/stores/draftStore";
import { useIriLabels } from "@/lib/hooks/useIriLabels";

function ensureTrailingEmpty(arr: LocalizedString[]): LocalizedString[] {
  if (arr.length === 0 || arr[arr.length - 1].value.trim() !== "") {
    return [...arr, { value: "", lang: "en" }];
  }
  return arr;
}

interface IndividualDetailPanelProps {
  projectId: string;
  individualIri: string | null;
  sourceContent: string;
  canEdit: boolean;
  onUpdateIndividual?: (iri: string, data: import("@/lib/ontology/turtleIndividualUpdater").TurtleIndividualUpdateData) => Promise<void>;
  branch?: string;
  refreshKey?: number;
  onNavigateToEntity?: (iri: string) => void;
  onCopyIri?: (iri: string) => void;
  accessToken?: string;
  labelHints?: Record<string, string>;
}

export function IndividualDetailPanel({
  projectId,
  individualIri,
  sourceContent,
  canEdit,
  onUpdateIndividual,
  branch,
  refreshKey,
  onNavigateToEntity,
  onCopyIri,
  accessToken,
  labelHints,
}: IndividualDetailPanelProps) {
  const detail = useMemo((): ParsedIndividualDetail | null => {
    if (!individualIri || !sourceContent) return null;
    return extractIndividualDetail(sourceContent, individualIri);
  }, [individualIri, sourceContent, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all IRIs that need label resolution
  const allDisplayedIris = useMemo(() => {
    if (!detail) return [];
    const iris: string[] = [
      ...detail.typeIris,
      ...detail.sameAsIris,
      ...detail.differentFromIris,
      ...detail.seeAlsoIris,
      ...detail.isDefinedByIris,
    ];
    // Object property assertion property IRIs and target IRIs
    for (const a of detail.objectPropertyAssertions) {
      iris.push(a.propertyIri);
      if (a.targetIri) iris.push(a.targetIri);
    }
    // Data property assertion property IRIs
    for (const a of detail.dataPropertyAssertions) {
      iris.push(a.propertyIri);
    }
    // Annotation property IRIs
    for (const ann of detail.annotations) {
      iris.push(ann.property_iri);
    }
    return iris;
  }, [detail]);

  const resolvedLabels = useIriLabels(allDisplayedIris, { projectId, accessToken, branch, labelHints });

  const [isEditing, setIsEditing] = useState(false);
  const [editLabels, setEditLabels] = useState<LocalizedString[]>([]);
  const [editComments, setEditComments] = useState<LocalizedString[]>([]);
  const [editDefinitions, setEditDefinitions] = useState<LocalizedString[]>([]);
  const [editTypeIris, setEditTypeIris] = useState<string[]>([]);
  const [editSameAsIris, setEditSameAsIris] = useState<string[]>([]);
  const [editDifferentFromIris, setEditDifferentFromIris] = useState<string[]>([]);
  const [editObjectAssertions, setEditObjectAssertions] = useState<PropertyAssertion[]>([]);
  const [editDataAssertions, setEditDataAssertions] = useState<PropertyAssertion[]>([]);
  const [editAnnotations, setEditAnnotations] = useState<AnnotationUpdate[]>([]);
  const [editRelationships, setEditRelationships] = useState<RelationshipGroup[]>([]);

  const prevIriRef = useRef<string | null>(null);
  const editInitializedRef = useRef(false);
  const cancelledIriRef = useRef<string | null>(null);
  const continuousEditing = useEditorModeStore((s) => s.continuousEditing);
  const toast = useToast();

  const buildDraftEntry = useCallback((): IndividualDraftEntry | null => {
    return {
      entityType: "individual",
      labels: editLabels,
      comments: editComments,
      definitions: editDefinitions,
      typeIris: editTypeIris,
      sameAsIris: editSameAsIris,
      differentFromIris: editDifferentFromIris,
      objectPropertyAssertions: editObjectAssertions,
      dataPropertyAssertions: editDataAssertions,
      annotations: editAnnotations,
      relationships: editRelationships,
      deprecated: detail?.deprecated ?? false,
      updatedAt: Date.now(),
    };
  }, [editLabels, editComments, editDefinitions, editTypeIris, editSameAsIris, editDifferentFromIris, editObjectAssertions, editDataAssertions, editAnnotations, editRelationships, detail]);

  const validate = useCallback((): string | null => {
    const validLabels = editLabels.filter((l) => l.value.trim());
    if (validLabels.length === 0) return "At least one label is required";
    return null;
  }, [editLabels]);

  const {
    saveStatus,
    saveError,
    validationError,
    triggerSave,
    flushToGit,
    discardDraft,
    restoredDraft,
    clearRestoredDraft,
  } = useEntityAutoSave({
    projectId,
    branch: branch || "main",
    entityIri: individualIri,
    canEdit,
    onFlush: onUpdateIndividual ? async (iri: string) => {
      const draft = buildDraftEntry();
      if (!draft) return;

      const cleanAnnotations = draft.annotations
        .map((a) => ({ ...a, values: a.values.filter((v) => v.value.trim()) }))
        .filter((a) => a.values.length > 0);

      const relationshipAnnotations: AnnotationUpdate[] = draft.relationships
        .filter((g) => g.targets.length > 0)
        .map((g) => ({
          property_iri: g.property_iri,
          values: g.targets.map((t) => ({ value: t.iri, lang: "" })),
        }));

      await onUpdateIndividual(iri, {
        labels: draft.labels.filter((l) => l.value.trim()),
        comments: draft.comments.filter((c) => c.value.trim()),
        definitions: draft.definitions.filter((d) => d.value.trim()),
        typeIris: draft.typeIris,
        sameAsIris: draft.sameAsIris,
        differentFromIris: draft.differentFromIris,
        objectPropertyAssertions: draft.objectPropertyAssertions,
        dataPropertyAssertions: draft.dataPropertyAssertions,
        annotations: [...cleanAnnotations, ...relationshipAnnotations],
        deprecated: draft.deprecated,
        seeAlsoIris: draft.relationships
          .filter((g) => g.property_iri === SEE_ALSO_IRI)
          .flatMap((g) => g.targets.map((t) => t.iri)),
        isDefinedByIris: draft.relationships
          .filter((g) => g.property_iri === "http://www.w3.org/2000/01/rdf-schema#isDefinedBy")
          .flatMap((g) => g.targets.map((t) => t.iri)),
      });
    } : undefined,
    onError: (msg) => toast.error(msg),
    buildDraftEntry,
    validate,
  });

  const initEditState = useCallback((d: ParsedIndividualDetail) => {
    setEditLabels(d.labels.length > 0 ? d.labels.map((l) => ({ ...l })) : [{ value: "", lang: "en" }]);
    setEditComments(ensureTrailingEmpty(d.comments.map((c) => ({ ...c }))));
    setEditDefinitions(ensureTrailingEmpty(d.definitions.map((def) => ({ ...def }))));
    setEditTypeIris([...d.typeIris]);
    setEditSameAsIris([...d.sameAsIris]);
    setEditDifferentFromIris([...d.differentFromIris]);
    setEditObjectAssertions(d.objectPropertyAssertions.map((a) => ({ ...a })));
    setEditDataAssertions(d.dataPropertyAssertions.map((a) => ({ ...a })));

    const relationships: RelationshipGroup[] = [];
    if (d.seeAlsoIris.length > 0) {
      relationships.push({
        property_iri: SEE_ALSO_IRI,
        property_label: "See Also",
        targets: d.seeAlsoIris.map((iri) => ({ iri, label: getLocalName(iri) })),
      });
    }
    if (d.isDefinedByIris.length > 0) {
      relationships.push({
        property_iri: "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
        property_label: "Defined By",
        targets: d.isDefinedByIris.map((iri) => ({ iri, label: getLocalName(iri) })),
      });
    }
    if (relationships.length === 0) {
      relationships.push({ property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [] });
    }
    setEditRelationships(relationships);

    const regularAnnotations = d.annotations
      .filter((a) => a.property_iri !== DEFINITION_IRI)
      .map((a) => ({ ...a, values: ensureTrailingEmpty(a.values.map((v) => ({ ...v }))) }));
    setEditAnnotations(regularAnnotations);
  }, []);

  useEffect(() => {
    if (prevIriRef.current && prevIriRef.current !== individualIri) {
      flushToGit();
    }
    prevIriRef.current = individualIri;
    editInitializedRef.current = false;
    setIsEditing(false);
    cancelledIriRef.current = null;
  }, [individualIri, flushToGit]);

  const enterEditMode = useCallback(() => {
    if (!detail) return;
    initEditState(detail);
    editInitializedRef.current = true;
    setIsEditing(true);
  }, [detail, initEditState]);

  const cancelEditMode = useCallback(() => {
    discardDraft();
    if (detail) initEditState(detail);
    setIsEditing(false);
    cancelledIriRef.current = individualIri;
  }, [individualIri, detail, discardDraft, initEditState]);

  useEffect(() => {
    if (isEditing || editInitializedRef.current) return;
    if (!canEdit || !detail) return;

    if (restoredDraft && restoredDraft.entityType === "individual" && individualIri) {
      const d = restoredDraft as IndividualDraftEntry;
      setEditLabels(d.labels);
      setEditComments(ensureTrailingEmpty(d.comments));
      setEditDefinitions(ensureTrailingEmpty(d.definitions));
      setEditTypeIris(d.typeIris);
      setEditSameAsIris(d.sameAsIris);
      setEditDifferentFromIris(d.differentFromIris);
      setEditObjectAssertions(d.objectPropertyAssertions);
      setEditDataAssertions(d.dataPropertyAssertions);
      setEditAnnotations(d.annotations);
      setEditRelationships(d.relationships);
      editInitializedRef.current = true;
      setIsEditing(true);
      clearRestoredDraft();
      return;
    }

    if (continuousEditing && cancelledIriRef.current !== individualIri) {
      enterEditMode();
    }
  }, [detail, canEdit, restoredDraft, individualIri, clearRestoredDraft, continuousEditing, isEditing, enterEditMode]);

  // ── Edit helpers ──
  const updateLabel = useCallback((index: number, field: "value" | "lang", val: string) => {
    setEditLabels((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: val } : l)));
  }, []);
  const removeLabel = useCallback((index: number) => {
    setEditLabels((prev) => prev.filter((_, i) => i !== index));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const updateComment = useCallback((index: number, field: "value" | "lang", val: string) => {
    setEditComments((prev) => ensureTrailingEmpty(prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))));
  }, []);
  const removeComment = useCallback((index: number) => {
    setEditComments((prev) => ensureTrailingEmpty(prev.filter((_, i) => i !== index)));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const updateDefinition = useCallback((index: number, field: "value" | "lang", val: string) => {
    setEditDefinitions((prev) => ensureTrailingEmpty(prev.map((d, i) => (i === index ? { ...d, [field]: val } : d))));
  }, []);
  const removeDefinition = useCallback((index: number) => {
    setEditDefinitions((prev) => ensureTrailingEmpty(prev.filter((_, i) => i !== index)));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const updateAnnotationValue = useCallback(
    (propertyIri: string, valueIdx: number, field: "value" | "lang", val: string) => {
      setEditAnnotations((prev) =>
        prev.map((a) => {
          if (a.property_iri !== propertyIri) return a;
          const updated = a.values.map((v, vi) => (vi === valueIdx ? { ...v, [field]: val } : v));
          return { ...a, values: ensureTrailingEmpty(updated) };
        })
      );
    }, []
  );
  const removeAnnotationValue = useCallback(
    (propertyIri: string, valueIdx: number) => {
      setEditAnnotations((prev) =>
        prev.map((a) => {
          if (a.property_iri !== propertyIri) return a;
          return { ...a, values: ensureTrailingEmpty(a.values.filter((_, vi) => vi !== valueIdx)) };
        })
      );
      requestAnimationFrame(() => triggerSave());
    }, [triggerSave]
  );

  const addRelationshipTarget = useCallback((groupIdx: number, target: RelationshipTarget) => {
    setEditRelationships((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, targets: [...g.targets, target] } : g)));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);
  const removeRelationshipTarget = useCallback((groupIdx: number, targetIdx: number) => {
    setEditRelationships((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, targets: g.targets.filter((_, ti) => ti !== targetIdx) } : g)));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);
  const changeRelationshipProperty = useCallback((groupIdx: number, newIri: string, newLabel: string) => {
    setEditRelationships((prev) => prev.map((g, i) => (i === groupIdx ? { ...g, property_iri: newIri, property_label: newLabel } : g)));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);
  const addRelationshipGroup = useCallback(() => {
    setEditRelationships((prev) => [...prev, { property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [] }]);
  }, []);

  // ── Render ──
  if (!individualIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Info className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Select an individual to view its details</p>
        </div>
      </div>
    );
  }

  if (!sourceContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700">
            <span className="text-sm font-bold text-purple-700 dark:text-purple-400">I</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{getLocalName(individualIri)}</h2>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={individualIri}>{individualIri}</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">Could not find this individual in the ontology source.</p>
        </div>
      </div>
    );
  }

  const displayLabel = detail.labels.length > 0 ? detail.labels[0].value : getLocalName(individualIri);
  const canEnterEdit = canEdit && !!onUpdateIndividual;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700">
              <span className="text-sm font-bold text-purple-700 dark:text-purple-400">I</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {displayLabel}
                  {detail.deprecated && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle className="mr-1 h-3 w-3" />Deprecated
                    </span>
                  )}
                </h2>
                {canEnterEdit && (
                  <div className="shrink-0">
                    {isEditing ? (
                      <button onClick={cancelEditMode} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"><X className="h-3.5 w-3.5" />Cancel</button>
                    ) : (
                      <button onClick={enterEditMode} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"><Pencil className="h-3.5 w-3.5" />Edit Item</button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium border bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400">Individual</span>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={individualIri}>{individualIri}</p>
                {onCopyIri && (
                  <button onClick={() => onCopyIri(individualIri)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700" title="Copy IRI">
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Labels */}
          {isEditing ? (
            <Section title="Label(s)" icon={<Tag className="h-4 w-4" />}>
              <div className="space-y-2">
                {editLabels.map((label, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="text" value={label.value} onChange={(e) => updateLabel(index, "value", e.target.value)} onBlur={() => triggerSave()} placeholder="Label text" className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                    <LanguageFlag lang={label.lang} />
                    <input type="text" value={label.lang} onChange={(e) => updateLabel(index, "lang", e.target.value)} onBlur={() => triggerSave()} className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white" title="Language tag" />
                    {editLabels.length > 1 ? (
                      <button onClick={() => removeLabel(index)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                    ) : <div className="rounded p-1"><div className="h-3.5 w-3.5" /></div>}
                  </div>
                ))}
              </div>
            </Section>
          ) : detail.labels.length > 0 ? (
            <Section title="Label(s)" icon={<Tag className="h-4 w-4" />}>
              <div className="space-y-1">
                {detail.labels.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{l.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Definitions */}
          {isEditing ? (
            <Section title="Definition" icon={<Lightbulb className="h-4 w-4" />}>
              <div className="space-y-2">
                {editDefinitions.map((def, index) => (
                  <AnnotationRow key={index} propertyIri={DEFINITION_IRI} value={def.value} lang={def.lang}
                    onValueChange={(v) => updateDefinition(index, "value", v)} onLangChange={(l) => updateDefinition(index, "lang", l)}
                    onRemove={editDefinitions.filter((d) => d.value.trim()).length > 0 && index < editDefinitions.length - 1 ? () => removeDefinition(index) : undefined}
                    onBlur={() => triggerSave()} showPropertyLabel={false} placeholder="Add a definition..." />
                ))}
              </div>
            </Section>
          ) : detail.definitions.length > 0 ? (
            <Section title="Definition" icon={<Lightbulb className="h-4 w-4" />}>
              <div className="space-y-1">{detail.definitions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  {d.lang && <LanguageFlag lang={d.lang} />}
                  <span className="text-sm text-slate-700 dark:text-slate-300">{d.value}</span>
                </div>
              ))}</div>
            </Section>
          ) : null}

          {/* Comments */}
          {isEditing ? (
            <Section title="Comment(s)" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-2">
                {editComments.map((c, index) => (
                  <AnnotationRow key={index} propertyIri={COMMENT_IRI} value={c.value} lang={c.lang}
                    onValueChange={(v) => updateComment(index, "value", v)} onLangChange={(l) => updateComment(index, "lang", l)}
                    onRemove={editComments.filter((x) => x.value.trim()).length > 0 && index < editComments.length - 1 ? () => removeComment(index) : undefined}
                    onBlur={() => triggerSave()} showPropertyLabel={false} placeholder="Add a comment..." />
                ))}
              </div>
            </Section>
          ) : detail.comments.length > 0 ? (
            <Section title="Comment(s)" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-1">{detail.comments.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  {c.lang && <LanguageFlag lang={c.lang} />}
                  <span className="text-sm text-slate-700 dark:text-slate-300">{c.value}</span>
                </div>
              ))}</div>
            </Section>
          ) : null}

          {/* Types */}
          {(isEditing || detail.typeIris.length > 0) && (
            <Section title="Type(s)" icon={<Layers className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editTypeIris}
                  onRemove={(iri) => { setEditTypeIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditTypeIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId} accessToken={accessToken} branch={branch}
                  entityFilter="class" placeholder="Search classes..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.typeIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Same As */}
          {(isEditing || detail.sameAsIris.length > 0) && (
            <Section title="Same As" icon={<Equal className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editSameAsIris}
                  onRemove={(iri) => { setEditSameAsIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditSameAsIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId} accessToken={accessToken} branch={branch}
                  entityFilter="individual" placeholder="Search individuals..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.sameAsIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Different From */}
          {(isEditing || detail.differentFromIris.length > 0) && (
            <Section title="Different From" icon={<Ban className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editDifferentFromIris}
                  onRemove={(iri) => { setEditDifferentFromIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditDifferentFromIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId} accessToken={accessToken} branch={branch}
                  entityFilter="individual" placeholder="Search individuals..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.differentFromIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Object Property Assertions */}
          {isEditing && (
            <Section title="Object Properties" icon={<Box className="h-4 w-4" />}>
              <PropertyAssertionSection
                assertions={editObjectAssertions}
                assertionType="object"
                isEditing={true}
                projectId={projectId} accessToken={accessToken} branch={branch}
                onAdd={(a) => { setEditObjectAssertions((p) => [...p, a]); requestAnimationFrame(() => triggerSave()); }}
                onRemove={(idx) => { setEditObjectAssertions((p) => p.filter((_, i) => i !== idx)); requestAnimationFrame(() => triggerSave()); }}
                onNavigateToEntity={onNavigateToEntity}
                onSaveNeeded={() => triggerSave()}
                resolvedLabels={resolvedLabels}
              />
            </Section>
          )}
          {!isEditing && detail.objectPropertyAssertions.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-4">
                <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
                  <span className="text-slate-400 dark:text-slate-500"><Box className="h-4 w-4" /></span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Object Properties</span>
                </div>
              </div>
              {detail.objectPropertyAssertions.map((a, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-40 shrink-0 flex items-center">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300" title={a.propertyIri}>
                      {resolvedLabels?.[a.propertyIri] || getLocalName(a.propertyIri)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {a.targetIri ? (
                      <button
                        onClick={() => onNavigateToEntity?.(a.targetIri!)}
                        className="truncate text-sm text-primary-600 hover:underline dark:text-primary-400"
                        title={a.targetIri}
                      >
                        {resolvedLabels?.[a.targetIri] || getLocalName(a.targetIri)}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data Property Assertions */}
          {isEditing && (
            <Section title="Data Properties" icon={<Database className="h-4 w-4" />}>
              <PropertyAssertionSection
                assertions={editDataAssertions}
                assertionType="data"
                isEditing={true}
                projectId={projectId} accessToken={accessToken} branch={branch}
                onAdd={(a) => { setEditDataAssertions((p) => [...p, a]); requestAnimationFrame(() => triggerSave()); }}
                onRemove={(idx) => { setEditDataAssertions((p) => p.filter((_, i) => i !== idx)); requestAnimationFrame(() => triggerSave()); }}
                onNavigateToEntity={onNavigateToEntity}
                onSaveNeeded={() => triggerSave()}
                resolvedLabels={resolvedLabels}
              />
            </Section>
          )}
          {!isEditing && detail.dataPropertyAssertions.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-4">
                <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
                  <span className="text-slate-400 dark:text-slate-500"><Database className="h-4 w-4" /></span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Data Properties</span>
                </div>
              </div>
              {detail.dataPropertyAssertions.map((a, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-40 shrink-0 flex items-center">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300" title={a.propertyIri}>
                      {resolvedLabels?.[a.propertyIri] || getLocalName(a.propertyIri)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {a.lang && <LanguageFlag lang={a.lang} />}
                    <span className="text-sm text-slate-700 dark:text-slate-300">{a.value}</span>
                    {a.datatype && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400" title={a.datatype}>{getLocalName(a.datatype)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Annotations */}
          {isEditing ? (
            <Section title="Annotations" icon={<StickyNote className="h-4 w-4" />}>
              <div className="space-y-3">
                {editAnnotations.map((ann) => (
                  <div key={ann.property_iri} className="space-y-2">
                    {ann.values.map((v, vi) => (
                      <AnnotationRow key={`${ann.property_iri}-${vi}`} propertyIri={ann.property_iri} value={v.value} lang={v.lang}
                        onValueChange={(val) => updateAnnotationValue(ann.property_iri, vi, "value", val)}
                        onLangChange={(lang) => updateAnnotationValue(ann.property_iri, vi, "lang", lang)}
                        onRemove={ann.values.filter((x) => x.value.trim()).length > 0 && vi < ann.values.length - 1 ? () => removeAnnotationValue(ann.property_iri, vi) : undefined}
                        onBlur={() => triggerSave()} />
                    ))}
                  </div>
                ))}
                <InlineAnnotationAdder
                  excludeIris={[LABEL_IRI, COMMENT_IRI, DEFINITION_IRI, ...editAnnotations.map((a) => a.property_iri)]}
                  onAdd={(propIri, value, lang) => {
                    setEditAnnotations((prev) => {
                      const existing = prev.find((a) => a.property_iri === propIri);
                      if (existing) {
                        return prev.map((a) => a.property_iri === propIri
                          ? { ...a, values: [...a.values.filter((v) => v.value.trim()), { value, lang }, { value: "", lang: "en" }] } : a
                        );
                      }
                      return [...prev, { property_iri: propIri, values: [{ value, lang }, { value: "", lang: "en" }] }];
                    });
                  }}
                  onSaveNeeded={() => triggerSave()}
                />
              </div>
            </Section>
          ) : detail.annotations.length > 0 ? (
            <div className="space-y-1">
              <div className="flex gap-4">
                <div className="w-40 shrink-0 flex items-start gap-1.5 pt-1">
                  <span className="text-slate-400 dark:text-slate-500"><StickyNote className="h-4 w-4" /></span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Annotations</span>
                </div>
              </div>
              {detail.annotations.flatMap((ann) =>
                ann.values.map((v, vi) => {
                  const { displayLabel: propLabel, curie } = getAnnotationPropertyInfo(ann.property_iri);
                  const effectiveLabel = resolvedLabels[ann.property_iri] || propLabel;
                  return (
                    <div key={`${ann.property_iri}-${vi}`} className="flex gap-4">
                      <div className="w-40 shrink-0 flex items-center">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300" title={curie}>{effectiveLabel}</span>
                      </div>
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        {v.lang && <LanguageFlag lang={v.lang} />}
                        <span className="text-sm text-slate-700 dark:text-slate-300">{v.value}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {/* Relationships */}
          {(isEditing || detail.seeAlsoIris.length > 0 || detail.isDefinedByIris.length > 0) && (
            <Section title="Relationships" icon={<Link2 className="h-4 w-4" />}>
              <RelationshipSection
                groups={editRelationships} isEditing={isEditing}
                projectId={projectId} accessToken={accessToken} branch={branch}
                onAddTarget={addRelationshipTarget} onRemoveTarget={removeRelationshipTarget}
                onChangeProperty={changeRelationshipProperty} onAddGroup={addRelationshipGroup}
                onNavigateToClass={onNavigateToEntity} onSaveNeeded={() => triggerSave()} />
            </Section>
          )}
        </div>
      </div>

      {isEditing && (
        <AutoSaveStatusBar status={saveStatus} error={saveError} validationError={validationError} onRetry={() => flushToGit()} />
      )}
    </div>
  );
}

// ── Shared sub-components ──

function Section({ title, tooltip, icon, children }: { title: string; tooltip?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div
        className="w-40 shrink-0 flex items-start gap-1.5 pt-1"
        title={tooltip}
      >
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</span>
      </div>
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

function IriLinks({ iris, onNavigate, resolvedLabels }: { iris: string[]; onNavigate?: (iri: string) => void; resolvedLabels?: Record<string, string> }) {
  return (
    <div className="space-y-1">
      {iris.map((iri) => (
        <div key={iri}>
          <button onClick={() => onNavigate?.(iri)} className={cn("text-sm truncate max-w-full", onNavigate ? "text-primary-600 hover:underline dark:text-primary-400" : "text-slate-700 dark:text-slate-300")} title={iri} disabled={!onNavigate}>
            {resolvedLabels?.[iri] || getLocalName(iri)}
          </button>
        </div>
      ))}
    </div>
  );
}

function IriList({ iris, onRemove, onAdd, onNavigate, projectId, accessToken, branch, entityFilter, placeholder, resolvedLabels }: {
  iris: string[]; onRemove: (iri: string) => void; onAdd: (iri: string) => void; onNavigate?: (iri: string) => void;
  projectId: string; accessToken?: string; branch?: string; entityFilter?: string; placeholder?: string;
  resolvedLabels?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ iri: string; label?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { projectOntologyApi } = await import("@/lib/api/client");
        const response = await projectOntologyApi.searchEntities(projectId, query.trim(), accessToken, branch, entityFilter);
        setResults(response.results.filter((r: { iri: string }) => !iris.includes(r.iri)));
      } catch { setResults([]); } finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, projectId, accessToken, branch, entityFilter, iris]);

  useEffect(() => {
    if (!isFocused) return;
    const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsFocused(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isFocused]);

  return (
    <div className="space-y-2">
      {iris.map((iri) => (
        <div key={iri} className="flex items-center gap-2">
          <button onClick={() => onNavigate?.(iri)} className="flex-1 truncate text-sm text-primary-600 hover:underline dark:text-primary-400" title={iri}>{resolvedLabels?.[iri] || getLocalName(iri)}</button>
          <button onClick={() => onRemove(iri)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div ref={containerRef} className="relative">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setIsFocused(true)} placeholder={placeholder || "Search to add..."}
          className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500" />
        {isFocused && query.trim() && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
            <div className="max-h-48 overflow-y-auto">
              {isSearching ? <div className="flex items-center justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /></div>
              : results.length > 0 ? <div className="py-1">{results.map((r) => (
                <button key={r.iri} onClick={() => { onAdd(r.iri); setQuery(""); setResults([]); }} className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-600">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900 dark:text-white">{r.label || getLocalName(r.iri)}</p><p className="truncate text-xs text-slate-500">{r.iri}</p></div>
                </button>
              ))}</div> : <p className="py-4 text-center text-sm text-slate-500">No results</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
