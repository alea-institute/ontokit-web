"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Info,
  Tag,
  MessageSquare,
  ArrowUp,
  Copy,
  Trash2,
  AlertTriangle,
  Pencil,
  ArrowRight,
  ArrowLeftRight,
  CheckSquare,
  Lightbulb,
  StickyNote,
  Link2,
  Equal,
  Ban,
} from "lucide-react";
import type { LocalizedString, AnnotationUpdate } from "@/lib/api/client";
import { cn, getLocalName } from "@/lib/utils";
import { LanguageFlag } from "@/components/editor/LanguageFlag";
import { AnnotationRow } from "@/components/editor/standard/AnnotationRow";
import { InlineAnnotationAdder } from "@/components/editor/standard/InlineAnnotationAdder";
import { RelationshipSection, type RelationshipGroup, type RelationshipTarget } from "@/components/editor/standard/RelationshipSection";
import { LABEL_IRI, COMMENT_IRI, DEFINITION_IRI, SEE_ALSO_IRI, getAnnotationPropertyInfo } from "@/lib/ontology/annotationProperties";
import { AutoSaveAffordanceBar } from "@/components/editor/AutoSaveAffordanceBar";
import { useEntityAutoSave } from "@/lib/hooks/useEntityAutoSave";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useToast } from "@/lib/context/ToastContext";
import {
  extractPropertyDetail,
  PROPERTY_CHARACTERISTIC_TYPES,
  type ParsedPropertyDetail,
  type PropertyType,
} from "@/lib/ontology/entityDetailExtractors";
import { type PropertyDraftEntry } from "@/lib/stores/draftStore";
import { useIriLabels } from "@/lib/hooks/useIriLabels";

/** Ensure an array of localized strings always ends with an empty placeholder row */
function ensureTrailingEmpty(arr: LocalizedString[]): LocalizedString[] {
  if (arr.length === 0 || arr[arr.length - 1].value.trim() !== "") {
    return [...arr, { value: "", lang: "en" }];
  }
  return arr;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, { label: string; letter: string; color: string }> = {
  object: { label: "Object Property", letter: "O", color: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400" },
  data: { label: "Data Property", letter: "D", color: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400" },
  annotation: { label: "Annotation Property", letter: "A", color: "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400" },
};

interface PropertyDetailPanelProps {
  projectId: string;
  propertyIri: string | null;
  sourceContent: string;
  canEdit: boolean;
  onUpdateProperty?: (iri: string, data: import("@/lib/ontology/turtlePropertyUpdater").TurtlePropertyUpdateData) => Promise<void>;
  branch?: string;
  refreshKey?: number;
  onNavigateToEntity?: (iri: string) => void;
  onCopyIri?: (iri: string) => void;
  accessToken?: string;
  labelHints?: Record<string, string>;
}

export function PropertyDetailPanel({
  projectId,
  propertyIri,
  sourceContent,
  canEdit,
  onUpdateProperty,
  branch,
  refreshKey,
  onNavigateToEntity,
  onCopyIri,
  accessToken,
  labelHints,
}: PropertyDetailPanelProps) {
  // Parse property detail from source
  const detail = useMemo((): ParsedPropertyDetail | null => {
    if (!propertyIri || !sourceContent) return null;
    return extractPropertyDetail(sourceContent, propertyIri);
  }, [propertyIri, sourceContent, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all IRIs that need label resolution
  const allDisplayedIris = useMemo(() => {
    if (!detail) return [];
    const iris: string[] = [
      ...detail.domainIris,
      ...detail.rangeIris,
      ...detail.parentIris,
      ...detail.equivalentIris,
      ...detail.disjointIris,
      ...detail.seeAlsoIris,
      ...detail.isDefinedByIris,
    ];
    if (detail.inverseOf) iris.push(detail.inverseOf);
    // Annotation property IRIs
    for (const ann of detail.annotations) {
      iris.push(ann.property_iri);
    }
    return iris;
  }, [detail]);

  const resolvedLabels = useIriLabels(allDisplayedIris, { projectId, accessToken, branch, labelHints });

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editLabels, setEditLabels] = useState<LocalizedString[]>([]);
  const [editComments, setEditComments] = useState<LocalizedString[]>([]);
  const [editDefinitions, setEditDefinitions] = useState<LocalizedString[]>([]);
  const [editDomainIris, setEditDomainIris] = useState<string[]>([]);
  const [editRangeIris, setEditRangeIris] = useState<string[]>([]);
  const [editParentIris, setEditParentIris] = useState<string[]>([]);
  const [editInverseOf, setEditInverseOf] = useState<string | null>(null);
  const [editCharacteristics, setEditCharacteristics] = useState<string[]>([]);
  const [editAnnotations, setEditAnnotations] = useState<AnnotationUpdate[]>([]);
  const [editRelationships, setEditRelationships] = useState<RelationshipGroup[]>([]);
  const [editPropertyType, setEditPropertyType] = useState<PropertyType>("object");

  const prevIriRef = useRef<string | null>(null);
  const editInitializedRef = useRef(false);
  const cancelledIriRef = useRef<string | null>(null);
  const continuousEditing = useEditorModeStore((s) => s.continuousEditing);
  const toast = useToast();

  // Build draft entry for auto-save
  const buildDraftEntry = useCallback((): PropertyDraftEntry | null => {
    return {
      entityType: "property",
      propertyType: editPropertyType,
      labels: editLabels,
      comments: editComments,
      definitions: editDefinitions,
      domainIris: editDomainIris,
      rangeIris: editRangeIris,
      parentIris: editParentIris,
      inverseOf: editInverseOf,
      characteristics: editCharacteristics,
      annotations: editAnnotations,
      relationships: editRelationships,
      deprecated: detail?.deprecated ?? false,
      equivalentIris: detail?.equivalentIris ?? [],
      disjointIris: detail?.disjointIris ?? [],
      updatedAt: Date.now(),
    };
  }, [editPropertyType, editLabels, editComments, editDefinitions, editDomainIris, editRangeIris, editParentIris, editInverseOf, editCharacteristics, editAnnotations, editRelationships, detail]);

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
    entityIri: propertyIri,
    canEdit,
    onFlush: onUpdateProperty ? async (iri: string) => {
      // Build update data from current draft
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

      await onUpdateProperty(iri, {
        propertyType: draft.propertyType,
        labels: draft.labels.filter((l) => l.value.trim()),
        comments: draft.comments.filter((c) => c.value.trim()),
        definitions: draft.definitions.filter((d) => d.value.trim()),
        domainIris: draft.domainIris,
        rangeIris: draft.rangeIris,
        parentIris: draft.parentIris,
        inverseOf: draft.inverseOf,
        characteristics: draft.characteristics,
        annotations: [...cleanAnnotations, ...relationshipAnnotations],
        deprecated: draft.deprecated,
        equivalentIris: draft.equivalentIris,
        disjointIris: draft.disjointIris,
        seeAlsoIris: detail?.seeAlsoIris,
        isDefinedByIris: detail?.isDefinedByIris,
      });
    } : undefined,
    onError: (msg) => toast.error(msg),
    buildDraftEntry,
    validate,
  });

  // Initialize edit state from parsed detail
  const initEditState = useCallback((d: ParsedPropertyDetail) => {
    setEditPropertyType(d.propertyType);
    setEditLabels(d.labels.length > 0 ? d.labels.map((l) => ({ ...l })) : [{ value: "", lang: "en" }]);
    setEditComments(ensureTrailingEmpty(d.comments.map((c) => ({ ...c }))));
    setEditDefinitions(ensureTrailingEmpty(d.definitions.map((def) => ({ ...def }))));
    setEditDomainIris([...d.domainIris]);
    setEditRangeIris([...d.rangeIris]);
    setEditParentIris([...d.parentIris]);
    setEditInverseOf(d.inverseOf);
    setEditCharacteristics([...d.characteristics]);

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

    // Annotations: filter out definition (shown in its own section)
    const regularAnnotations = d.annotations
      .filter((a) => a.property_iri !== DEFINITION_IRI)
      .map((a) => ({ ...a, values: ensureTrailingEmpty(a.values.map((v) => ({ ...v }))) }));

    if (!regularAnnotations.find((a) => a.property_iri === DEFINITION_IRI)) {
      // Don't add definition here — it has its own section
    }

    setEditAnnotations(regularAnnotations);
  }, []);

  // Flush to git on navigate away
  useEffect(() => {
    if (prevIriRef.current && prevIriRef.current !== propertyIri) {
      flushToGit();
    }
    prevIriRef.current = propertyIri;
    editInitializedRef.current = false;
    setIsEditing(false);
    cancelledIriRef.current = null;
  }, [propertyIri]); // eslint-disable-line react-hooks/exhaustive-deps

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
    cancelledIriRef.current = propertyIri;
  }, [propertyIri, detail, discardDraft, initEditState]);

  const saveAndExitEditMode = useCallback(async () => {
    triggerSave();
    const ok = await flushToGit();
    if (ok) setIsEditing(false);
  }, [triggerSave, flushToGit]);

  // Auto-enter edit mode
  useEffect(() => {
    if (isEditing || editInitializedRef.current) return;
    if (!canEdit || !detail) return;

    if (restoredDraft && restoredDraft.entityType === "property" && propertyIri) {
      const d = restoredDraft as PropertyDraftEntry;
      setEditPropertyType(d.propertyType);
      setEditLabels(d.labels);
      setEditComments(ensureTrailingEmpty(d.comments));
      setEditDefinitions(ensureTrailingEmpty(d.definitions));
      setEditDomainIris(d.domainIris);
      setEditRangeIris(d.rangeIris);
      setEditParentIris(d.parentIris);
      setEditInverseOf(d.inverseOf);
      setEditCharacteristics(d.characteristics);
      setEditAnnotations(d.annotations);
      setEditRelationships(d.relationships);
      editInitializedRef.current = true;
      setIsEditing(true);
      clearRestoredDraft();
      return;
    }

    if (continuousEditing && cancelledIriRef.current !== propertyIri) {
      enterEditMode();
    }
  }, [detail, canEdit, restoredDraft, propertyIri, clearRestoredDraft, continuousEditing, isEditing, enterEditMode]);

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
    },
    []
  );

  const removeAnnotationValue = useCallback(
    (propertyIri: string, valueIdx: number) => {
      setEditAnnotations((prev) =>
        prev.map((a) => {
          if (a.property_iri !== propertyIri) return a;
          const filtered = a.values.filter((_, vi) => vi !== valueIdx);
          return { ...a, values: ensureTrailingEmpty(filtered) };
        })
      );
      requestAnimationFrame(() => triggerSave());
    },
    [triggerSave]
  );

  const addRelationshipTarget = useCallback((groupIdx: number, target: RelationshipTarget) => {
    setEditRelationships((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, targets: [...g.targets, target] } : g))
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const removeRelationshipTarget = useCallback((groupIdx: number, targetIdx: number) => {
    setEditRelationships((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, targets: g.targets.filter((_, ti) => ti !== targetIdx) } : g))
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const changeRelationshipProperty = useCallback((groupIdx: number, newIri: string, newLabel: string) => {
    setEditRelationships((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, property_iri: newIri, property_label: newLabel } : g))
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const addRelationshipGroup = useCallback(() => {
    setEditRelationships((prev) => [...prev, { property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [] }]);
  }, []);

  const toggleCharacteristic = useCallback((charIri: string) => {
    setEditCharacteristics((prev) =>
      prev.includes(charIri) ? prev.filter((c) => c !== charIri) : [...prev, charIri]
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  // ── Render ──
  if (!propertyIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Info className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Select a property to view its details
          </p>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">P</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{getLocalName(propertyIri)}</h2>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={propertyIri}>{propertyIri}</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Could not find this property in the ontology source.
          </p>
        </div>
      </div>
    );
  }

  const typeInfo = PROPERTY_TYPE_LABELS[detail.propertyType];
  const displayLabel = detail.labels.length > 0 ? detail.labels[0].value : getLocalName(propertyIri);
  const canEnterEdit = canEdit && !!onUpdateProperty;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header — pinned, always visible */}
      <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border", typeInfo.color)}>
            <span className="text-sm font-bold">{typeInfo.letter}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                {displayLabel}
                {detail.deprecated && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Deprecated
                  </span>
                )}
              </h2>
              {canEnterEdit && !isEditing && (
                <div className="shrink-0">
                  <button onClick={enterEditMode} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20" title="Enter edit mode">
                    <Pencil className="h-3.5 w-3.5" />Edit Item
                  </button>
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border", typeInfo.color)}>
                {typeInfo.label}
              </span>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={propertyIri}>{propertyIri}</p>
              {onCopyIri && (
                <button onClick={() => onCopyIri(propertyIri)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700" title="Copy IRI">
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-save affordance bar — pinned edit toolbar */}
      {isEditing && (
        <AutoSaveAffordanceBar
          status={saveStatus}
          error={saveError}
          validationError={validationError}
          onRetry={() => flushToGit()}
          onManualSave={saveAndExitEditMode}
          onCancel={cancelEditMode}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Content */}
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
                      <button onClick={() => removeLabel(index)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                    ) : (
                      <div className="rounded p-1"><div className="h-3.5 w-3.5" /></div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          ) : detail.labels.length > 0 ? (
            <Section title="Label(s)" icon={<Tag className="h-4 w-4" />}>
              <div className="space-y-1">
                {detail.labels.map((label, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label.value}</span>
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
                  <AnnotationRow
                    key={index}
                    propertyIri={DEFINITION_IRI}
                    value={def.value}
                    lang={def.lang}
                    onValueChange={(v) => updateDefinition(index, "value", v)}
                    onLangChange={(l) => updateDefinition(index, "lang", l)}
                    onRemove={editDefinitions.filter((d) => d.value.trim()).length > 0 && index < editDefinitions.length - 1 ? () => removeDefinition(index) : undefined}
                    onBlur={() => triggerSave()}
                    showPropertyLabel={false}
                    placeholder="Add a definition..."
                  />
                ))}
              </div>
            </Section>
          ) : detail.definitions.length > 0 ? (
            <Section title="Definition" icon={<Lightbulb className="h-4 w-4" />}>
              <div className="space-y-1">
                {detail.definitions.map((def, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {def.lang && <LanguageFlag lang={def.lang} />}
                    <span className="text-sm text-slate-700 dark:text-slate-300">{def.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Comments */}
          {isEditing ? (
            <Section title="Comment(s)" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-2">
                {editComments.map((comment, index) => (
                  <AnnotationRow
                    key={index}
                    propertyIri={COMMENT_IRI}
                    value={comment.value}
                    lang={comment.lang}
                    onValueChange={(v) => updateComment(index, "value", v)}
                    onLangChange={(l) => updateComment(index, "lang", l)}
                    onRemove={editComments.filter((c) => c.value.trim()).length > 0 && index < editComments.length - 1 ? () => removeComment(index) : undefined}
                    onBlur={() => triggerSave()}
                    showPropertyLabel={false}
                    placeholder="Add a comment..."
                  />
                ))}
              </div>
            </Section>
          ) : detail.comments.length > 0 ? (
            <Section title="Comment(s)" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-1">
                {detail.comments.map((c, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {c.lang && <LanguageFlag lang={c.lang} />}
                    <span className="text-sm text-slate-700 dark:text-slate-300">{c.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Domain */}
          {(isEditing || detail.domainIris.length > 0) && (
            <Section title="Domain" icon={<ArrowRight className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editDomainIris}
                  onRemove={(iri) => { setEditDomainIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditDomainIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId}
                  accessToken={accessToken}
                  branch={branch}
                  entityFilter="class"
                  placeholder="Search classes for domain..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.domainIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Range */}
          {(isEditing || detail.rangeIris.length > 0) && (
            <Section title="Range" icon={<ArrowRight className="h-4 w-4 rotate-180" />}>
              {isEditing ? (
                <IriList
                  iris={editRangeIris}
                  onRemove={(iri) => { setEditRangeIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditRangeIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId}
                  accessToken={accessToken}
                  branch={branch}
                  entityFilter="class"
                  placeholder="Search classes for range..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.rangeIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Parent Properties */}
          {(isEditing || detail.parentIris.length > 0) && (
            <Section title="Parent Properties" icon={<ArrowUp className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editParentIris}
                  onRemove={(iri) => { setEditParentIris((p) => p.filter((i) => i !== iri)); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditParentIris((p) => [...p, iri]); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId}
                  accessToken={accessToken}
                  branch={branch}
                  entityFilter="property"
                  placeholder="Search parent properties..."
                  resolvedLabels={resolvedLabels}
                />
              ) : (
                <IriLinks iris={detail.parentIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              )}
            </Section>
          )}

          {/* Inverse Of (object properties only) */}
          {(isEditing || detail.inverseOf) && detail.propertyType === "object" && (
            <Section title="Inverse Of" icon={<ArrowLeftRight className="h-4 w-4" />}>
              {isEditing ? (
                <IriList
                  iris={editInverseOf ? [editInverseOf] : []}
                  onRemove={() => { setEditInverseOf(null); requestAnimationFrame(() => triggerSave()); }}
                  onAdd={(iri) => { setEditInverseOf(iri); requestAnimationFrame(() => triggerSave()); }}
                  onNavigate={onNavigateToEntity}
                  projectId={projectId}
                  accessToken={accessToken}
                  branch={branch}
                  entityFilter="property"
                  placeholder="Search inverse property..."
                  maxItems={1}
                  resolvedLabels={resolvedLabels}
                />
              ) : detail.inverseOf ? (
                <IriLinks iris={[detail.inverseOf]} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
              ) : null}
            </Section>
          )}

          {/* Characteristics (object properties only) */}
          {(isEditing || detail.characteristics.length > 0) && detail.propertyType === "object" && (
            <Section title="Characteristics" icon={<CheckSquare className="h-4 w-4" />}>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_CHARACTERISTIC_TYPES.map((ch) => (
                    <label key={ch.iri} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editCharacteristics.includes(ch.iri)}
                        onChange={() => toggleCharacteristic(ch.iri)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600"
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{ch.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.characteristics.map((ch) => {
                    const info = PROPERTY_CHARACTERISTIC_TYPES.find((c) => c.iri === ch);
                    return (
                      <span key={ch} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {info?.label || getLocalName(ch)}
                      </span>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* Annotations */}
          {isEditing ? (
            <Section title="Annotations" icon={<StickyNote className="h-4 w-4" />}>
              <div className="space-y-3">
                {editAnnotations.map((ann) => (
                  <div key={ann.property_iri} className="space-y-2">
                    {ann.values.map((v, vi) => (
                      <AnnotationRow
                        key={`${ann.property_iri}-${vi}`}
                        propertyIri={ann.property_iri}
                        value={v.value}
                        lang={v.lang}
                        onValueChange={(val) => updateAnnotationValue(ann.property_iri, vi, "value", val)}
                        onLangChange={(lang) => updateAnnotationValue(ann.property_iri, vi, "lang", lang)}
                        onRemove={ann.values.filter((x) => x.value.trim()).length > 0 && vi < ann.values.length - 1 ? () => removeAnnotationValue(ann.property_iri, vi) : undefined}
                        onBlur={() => triggerSave()}
                      />
                    ))}
                  </div>
                ))}
                <InlineAnnotationAdder
                  excludeIris={[LABEL_IRI, COMMENT_IRI, DEFINITION_IRI, ...editAnnotations.map((a) => a.property_iri)]}
                  onAdd={(propIri, value, lang) => {
                    setEditAnnotations((prev) => {
                      const existing = prev.find((a) => a.property_iri === propIri);
                      if (existing) {
                        return prev.map((a) =>
                          a.property_iri === propIri
                            ? { ...a, values: [...a.values.filter((v) => v.value.trim()), { value, lang }, { value: "", lang: "en" }] }
                            : a
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
                groups={editRelationships}
                isEditing={isEditing}
                projectId={projectId}
                accessToken={accessToken}
                branch={branch}
                onAddTarget={addRelationshipTarget}
                onRemoveTarget={removeRelationshipTarget}
                onChangeProperty={changeRelationshipProperty}
                onAddGroup={addRelationshipGroup}
                onNavigateToClass={onNavigateToEntity}
                onSaveNeeded={() => triggerSave()}
              />
            </Section>
          )}

          {/* Equivalents (read-only) */}
          {detail.equivalentIris.length > 0 && (
            <Section title="Equivalent Properties" icon={<Equal className="h-4 w-4" />}>
              <IriLinks iris={detail.equivalentIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
            </Section>
          )}

          {/* Disjoint (read-only) */}
          {detail.disjointIris.length > 0 && (
            <Section title="Disjoint Properties" icon={<Ban className="h-4 w-4" />}>
              <IriLinks iris={detail.disjointIris} onNavigate={onNavigateToEntity} resolvedLabels={resolvedLabels} />
            </Section>
          )}
        </div>
      </div>

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
          <button
            onClick={() => onNavigate?.(iri)}
            className={cn(
              "text-sm truncate max-w-full",
              onNavigate
                ? "text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400"
                : "text-slate-700 dark:text-slate-300"
            )}
            title={iri}
            disabled={!onNavigate}
          >
            {resolvedLabels?.[iri] || getLocalName(iri)}
          </button>
        </div>
      ))}
    </div>
  );
}

function IriList({
  iris,
  onRemove,
  onAdd,
  onNavigate,
  projectId,
  accessToken,
  branch,
  entityFilter,
  placeholder,
  maxItems,
  resolvedLabels,
}: {
  iris: string[];
  onRemove: (iri: string) => void;
  onAdd: (iri: string) => void;
  onNavigate?: (iri: string) => void;
  projectId: string;
  accessToken?: string;
  branch?: string;
  entityFilter?: string;
  placeholder?: string;
  maxItems?: number;
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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsFocused(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFocused]);

  const canAddMore = !maxItems || iris.length < maxItems;

  return (
    <div className="space-y-2">
      {iris.map((iri) => (
        <div key={iri} className="flex items-center gap-2">
          <button onClick={() => onNavigate?.(iri)} className="flex-1 truncate text-sm text-primary-600 hover:underline dark:text-primary-400" title={iri}>
            {resolvedLabels?.[iri] || getLocalName(iri)}
          </button>
          <button onClick={() => onRemove(iri)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {canAddMore && (
        <div ref={containerRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder || "Search to add..."}
            className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:border-solid focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
          />
          {isFocused && query.trim() && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700">
              <div className="max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                  </div>
                ) : results.length > 0 ? (
                  <div className="py-1">
                    {results.map((r) => (
                      <button key={r.iri} onClick={() => { onAdd(r.iri); setQuery(""); setResults([]); }} className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-600">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 dark:text-white">{r.label || getLocalName(r.iri)}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{r.iri}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No results found</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
