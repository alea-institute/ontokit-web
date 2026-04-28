"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  ExternalLink,
  AlertTriangle,
  Info,
  Tag,
  MessageSquare,
  BookOpen,
  ArrowUp,
  FileText,
  XCircle,
  Code,
  Clock,
  Copy,
  Plus,
  Trash2,
  Equal,
  Ban,
  BarChart3,
  Star,
  Tags,
  EyeOff,
  Lightbulb,
  StickyNote,
  Hash,
  Link2,
} from "lucide-react";
import { projectOntologyApi, type OWLClassDetail, type ClassUpdatePayload, type AnnotationUpdate } from "@/lib/api/client";
import type { LocalizedString } from "@/lib/api/client";
import { lintApi, type LintIssue } from "@/lib/api/lint";
import { cn, getLocalName, getPreferredLabel } from "@/lib/utils";
import { LanguageFlag } from "@/components/editor/LanguageFlag";
import { LanguagePicker } from "@/components/editor/LanguagePicker";
import { ParentClassPicker } from "@/components/editor/ParentClassPicker";
import { AnnotationRow } from "@/components/editor/standard/AnnotationRow";
import { InlineAnnotationAdder } from "@/components/editor/standard/InlineAnnotationAdder";
import { RelationshipSection, type RelationshipGroup, type RelationshipTarget } from "@/components/editor/standard/RelationshipSection";
import { LABEL_IRI, COMMENT_IRI, DEFINITION_IRI, RELATIONSHIP_PROPERTY_IRIS, SEE_ALSO_IRI, getAnnotationPropertyInfo } from "@/lib/ontology/annotationProperties";
import { AutoSaveAffordanceBar } from "@/components/editor/AutoSaveAffordanceBar";
import { CrossReferencesPanel } from "@/components/editor/CrossReferencesPanel";
import { SimilarConceptsPanel } from "@/components/editor/SimilarConceptsPanel";
import { EntityHistoryTab } from "@/components/editor/EntityHistoryTab";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { useToast } from "@/lib/context/ToastContext";

/** Ensure an array of localized strings always ends with an empty placeholder row */
export function ensureTrailingEmpty(arr: LocalizedString[]): LocalizedString[] {
  if (arr.length === 0 || arr[arr.length - 1].value.trim() !== "") {
    return [...arr, { value: "", lang: "en" }];
  }
  return arr;
}

/** Minimal data from the tree node, used as fallback when the API has no data yet */
export interface TreeNodeFallback {
  label: string;
  iri: string;
  parentIri?: string;
  parentLabel?: string;
}

interface ClassDetailPanelProps {
  projectId: string;
  classIri: string | null;
  accessToken?: string;
  branch?: string;
  onNavigateToClass?: (iri: string) => void;
  onNavigateToSource?: (iri: string) => void;
  onCopyIri?: (iri: string) => void;
  selectedNodeFallback?: TreeNodeFallback | null;
  canEdit?: boolean;
  isSuggestionMode?: boolean;
  onUpdateClass?: (classIri: string, data: ClassUpdatePayload) => Promise<void>;
  refreshKey?: number;
  /** Extra actions rendered in the header row (e.g. Graph button) */
  headerActions?: ReactNode;
}

export function ClassDetailPanel({
  projectId,
  classIri,
  accessToken,
  branch,
  onNavigateToClass,
  onNavigateToSource,
  onCopyIri,
  selectedNodeFallback,
  canEdit,
  onUpdateClass,
  refreshKey,
  headerActions,
}: ClassDetailPanelProps) {
  const [classDetail, setClassDetail] = useState<OWLClassDetail | null>(null);
  const [classIssues, setClassIssues] = useState<LintIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedTargetLabels, setResolvedTargetLabels] = useState<Record<string, string>>({});

  // Edit mode: explicit state (default read-only)
  const [isEditing, setIsEditing] = useState(false);

  // Edit state
  const [editLabels, setEditLabels] = useState<LocalizedString[]>([]);
  const [editComments, setEditComments] = useState<LocalizedString[]>([]);
  const [editParentIris, setEditParentIris] = useState<string[]>([]);
  const [editParentLabels, setEditParentLabels] = useState<Record<string, string>>({});
  const [editAnnotations, setEditAnnotations] = useState<AnnotationUpdate[]>([]);
  const [editRelationships, setEditRelationships] = useState<RelationshipGroup[]>([]);
  const [showParentPicker, setShowParentPicker] = useState(false);

  // Track the previous classIri so we can flush on navigate
  const prevClassIriRef = useRef<string | null>(null);
  const editInitializedRef = useRef(false);

  // Toast for error feedback
  const toast = useToast();

  // Auto-save hook
  const {
    saveStatus,
    saveError,
    validationError,
    triggerSave,
    flushToGit,
    discardDraft,
    editStateRef,
    restoredDraft,
    clearRestoredDraft,
  } = useAutoSave({
    projectId,
    branch: branch || "main",
    classIri,
    classDetail,
    canEdit: !!canEdit && !!onUpdateClass,
    onUpdateClass,
    onError: (msg) => toast.error(msg),
  });

  // Keep editStateRef in sync with current edit state (only when editing)
  useEffect(() => {
    if (!isEditing) return;
    editStateRef.current = {
      labels: editLabels,
      comments: editComments,
      parentIris: editParentIris,
      parentLabels: editParentLabels,
      annotations: editAnnotations,
      relationships: editRelationships,
    };
  }, [isEditing, editLabels, editComments, editParentIris, editParentLabels, editAnnotations, editRelationships, editStateRef]);

  // Clear editStateRef when not editing
  useEffect(() => {
    if (!isEditing) {
      editStateRef.current = null;
    }
  }, [isEditing, editStateRef]);

  // Flush to git when class selection changes, then reset to read-only
  useEffect(() => {
    if (prevClassIriRef.current && prevClassIriRef.current !== classIri) {
      flushToGit();
    }
    prevClassIriRef.current = classIri;
    setResolvedTargetLabels({});
    editInitializedRef.current = false;
    setIsEditing(false);
  }, [classIri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter edit mode: initialize edit state from classDetail
  const enterEditMode = useCallback(() => {
    if (!classDetail) return;
    initEditState(classDetail);
    editInitializedRef.current = true;
    setIsEditing(true);
  }, [classDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel: discard the in-progress draft and re-init from server state.
  // The panel stays in edit mode — the editor is always editable.
  const cancelEditMode = useCallback(() => {
    discardDraft();
    if (classDetail) {
      initEditState(classDetail);
    }
  }, [classDetail, discardDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual save: flush the current draft to git. Stays in edit mode.
  const saveAndExitEditMode = useCallback(async () => {
    triggerSave();
    await flushToGit();
  }, [triggerSave, flushToGit]);

  // Auto-enter edit mode based on continuous editing or restored draft
  useEffect(() => {
    if (isEditing || editInitializedRef.current) return;
    if (!canEdit || !onUpdateClass || !classDetail) return;

    // Restored draft → always auto-enter
    if (restoredDraft && classIri) {
      setEditLabels(restoredDraft.labels.length > 0 ? restoredDraft.labels : [{ value: "", lang: "en" }]);
      setEditComments(ensureTrailingEmpty(restoredDraft.comments));
      setEditParentIris(restoredDraft.parentIris);
      setEditParentLabels(restoredDraft.parentLabels);
      setEditAnnotations(restoredDraft.annotations);
      setEditRelationships(restoredDraft.relationships);
      editInitializedRef.current = true;
      setIsEditing(true);
      clearRestoredDraft();
      return;
    }

    // In editor context (canEdit + onUpdateClass), always auto-enter edit mode.
    enterEditMode();
  }, [classDetail, canEdit, restoredDraft, classIri, clearRestoredDraft, onUpdateClass, isEditing, enterEditMode]);

  // Initialize edit state from OWLClassDetail
  const initEditState = useCallback((detail: OWLClassDetail) => {
    setEditLabels(detail.labels.length > 0 ? detail.labels.map((l) => ({ ...l })) : [{ value: "", lang: "en" }]);
    setEditComments(ensureTrailingEmpty(detail.comments.map((c) => ({ ...c }))));
    setEditParentIris([...detail.parent_iris]);
    setEditParentLabels({ ...detail.parent_labels });

    const allAnnotations = detail.annotations || [];
    const regularAnnotations: AnnotationUpdate[] = [];
    const relationships: RelationshipGroup[] = [];

    for (const a of allAnnotations) {
      if (RELATIONSHIP_PROPERTY_IRIS.has(a.property_iri)) {
        const propInfo = getAnnotationPropertyInfo(a.property_iri);
        relationships.push({
          property_iri: a.property_iri,
          property_label: propInfo.displayLabel,
          targets: a.values
            .filter((v) => v.value.trim())
            .map((v) => ({ iri: v.value, label: resolvedTargetLabels[v.value] || getLocalName(v.value) })),
        });
      } else {
        regularAnnotations.push({
          property_iri: a.property_iri,
          values: ensureTrailingEmpty(a.values.map((v) => ({ ...v }))),
        });
      }
    }

    if (!regularAnnotations.find((a) => a.property_iri === DEFINITION_IRI)) {
      regularAnnotations.unshift({ property_iri: DEFINITION_IRI, values: [{ value: "", lang: "en" }] });
    }

    if (relationships.length === 0) {
      relationships.push({ property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [] });
    }

    setEditAnnotations(regularAnnotations);
    setEditRelationships(relationships);
  }, [resolvedTargetLabels]);

  // Fetch class data
  useEffect(() => {
    if (!classIri) {
      setClassDetail(null);
      setClassIssues([]);
      return;
    }

    let cancelled = false;
    const fetchClassData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [detail, issuesResponse] = await Promise.all([
          projectOntologyApi.getClassDetail(projectId, classIri, accessToken, branch),
          lintApi.getIssues(projectId, accessToken, { subject_iri: classIri, limit: 50 }).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setClassDetail(detail);
        setClassIssues(issuesResponse.items);
      } catch (err) {
        if (cancelled) return;
        const is404 = err instanceof Error &&
          (err.message.includes("Class not found") || err.message.includes("404"));

        if (is404 && selectedNodeFallback?.iri === classIri) {
          setError(null);
        } else if (is404) {
          const localName = getLocalName(classIri);
          setError(`Could not load "${localName}" as an OWL Class, or a Property, or an Individual. Enable Developer mode to see the entity in the source view.`);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load class details");
        }
        setClassDetail(null);
        setClassIssues([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchClassData();
    return () => {
      cancelled = true;
    };
  }, [projectId, classIri, accessToken, branch, selectedNodeFallback, refreshKey]);

  // Resolve labels for relationship target IRIs
  useEffect(() => {
    if (!classDetail?.annotations) return;

    const targetIris: string[] = [];
    for (const a of classDetail.annotations) {
      if (RELATIONSHIP_PROPERTY_IRIS.has(a.property_iri)) {
        for (const v of a.values) {
          if (v.value.trim() && !resolvedTargetLabels[v.value]) {
            targetIris.push(v.value);
          }
        }
      }
    }

    if (targetIris.length === 0) return;

    let cancelled = false;
    const resolveLabels = async () => {
      const newLabels: Record<string, string> = {};
      await Promise.all(
        targetIris.map(async (iri) => {
          // Try class endpoint first (most common case)
          try {
            const detail = await projectOntologyApi.getClassDetail(projectId, iri, accessToken, branch);
            const label = getPreferredLabel(detail.labels);
            if (label) { newLabels[iri] = label; return; }
          } catch {
            // Not a class — fall through to entity search
          }
          // Fallback: search by local name to resolve individuals/properties
          try {
            const localName = getLocalName(iri);
            const searchResult = await projectOntologyApi.searchEntities(projectId, localName, accessToken, branch);
            const match = searchResult.results.find((r) => r.iri === iri);
            if (match?.label) newLabels[iri] = match.label;
          } catch {
            // Search failed — leave as IRI suffix
          }
        }),
      );
      if (!cancelled && Object.keys(newLabels).length > 0) {
        setResolvedTargetLabels((prev) => ({ ...prev, ...newLabels }));
      }
    };

    resolveLabels();
    return () => { cancelled = true; };
  }, [classDetail, projectId, accessToken, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Patch relationship target labels when async resolution finishes
  useEffect(() => {
    if (!isEditing || Object.keys(resolvedTargetLabels).length === 0) return;
    setEditRelationships((prev) =>
      prev.map((g) => ({
        ...g,
        targets: g.targets.map((t) => {
          const resolved = resolvedTargetLabels[t.iri];
          return resolved && resolved !== t.label ? { ...t, label: resolved } : t;
        }),
      })),
    );
  }, [resolvedTargetLabels, isEditing]);

  // -- Label editing helpers --
  const updateLabel = useCallback((index: number, field: "value" | "lang", newVal: string) => {
    setEditLabels((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: newVal } : l)));
  }, []);

  const removeLabel = useCallback((index: number) => {
    setEditLabels((prev) => prev.filter((_, i) => i !== index));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  // -- Comment editing helpers --
  const updateComment = useCallback((index: number, field: "value" | "lang", newVal: string) => {
    setEditComments((prev) => {
      const updated = prev.map((c, i) => (i === index ? { ...c, [field]: newVal } : c));
      return ensureTrailingEmpty(updated);
    });
  }, []);

  const removeComment = useCallback((index: number) => {
    setEditComments((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return ensureTrailingEmpty(updated);
    });
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  // -- Parent editing helpers --
  const addParent = useCallback((iri: string, label: string) => {
    setEditParentIris((prev) => [...prev, iri]);
    setEditParentLabels((prev) => ({ ...prev, [iri]: label }));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const removeParent = useCallback((iri: string) => {
    setEditParentIris((prev) => prev.filter((p) => p !== iri));
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  // -- Annotation editing helpers --
  const updateAnnotationValue = useCallback(
    (propertyIri: string, valueIdx: number, field: "value" | "lang", newVal: string) => {
      setEditAnnotations((prev) =>
        prev.map((a) => {
          if (a.property_iri !== propertyIri) return a;
          const updated = a.values.map((v, vi) => (vi === valueIdx ? { ...v, [field]: newVal } : v));
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

  // -- Relationship editing helpers --
  const addRelationshipTarget = useCallback((groupIdx: number, target: RelationshipTarget) => {
    setEditRelationships((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, targets: [...g.targets, target] } : g
      )
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const removeRelationshipTarget = useCallback((groupIdx: number, targetIdx: number) => {
    setEditRelationships((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, targets: g.targets.filter((_, ti) => ti !== targetIdx) } : g
      )
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const changeRelationshipProperty = useCallback((groupIdx: number, newIri: string, newLabel: string) => {
    setEditRelationships((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, property_iri: newIri, property_label: newLabel } : g
      )
    );
    requestAnimationFrame(() => triggerSave());
  }, [triggerSave]);

  const addRelationshipGroup = useCallback(() => {
    setEditRelationships((prev) => [
      ...prev,
      { property_iri: SEE_ALSO_IRI, property_label: "See Also", targets: [] },
    ]);
  }, []);

  // ── Render: empty state ──
  if (!classIri) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Info className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Select a class from the tree to view its details
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/50 dark:bg-red-900/20">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // No API data — show tree-node fallback if available (unsaved entity)
  if (!classDetail && selectedNodeFallback?.iri === classIri) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-owl-class/20 border border-owl-class">
              <span className="text-sm font-bold text-owl-class">C</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedNodeFallback.label}
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <Clock className="mr-1 h-3 w-3" />
                  Unsaved
                </span>
              </h2>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={classIri}>
                {classIri}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <Section title="Primary Label" tooltip="rdfs:label" icon={<Tag className="h-4 w-4" />}>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 dark:text-slate-300">{selectedNodeFallback.label}</span>
            </div>
          </Section>
          {selectedNodeFallback.parentIri && (
            <Section title="Parent(s)" tooltip="rdfs:subClassOf" icon={<ArrowUp className="h-4 w-4" />}>
              <IriLink
                iri={selectedNodeFallback.parentIri}
                label={selectedNodeFallback.parentLabel}
                onClick={onNavigateToClass}
              />
            </Section>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This entity has not been saved yet. Save your changes to persist it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!classDetail) {
    return null;
  }

  const displayLabel = getPreferredLabel(classDetail.labels) || getLocalName(classDetail.iri);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header — pinned, always visible */}
      <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-owl-class/20 border border-owl-class">
            <span className="text-sm font-bold text-owl-class">C</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                {displayLabel}
                {classDetail.deprecated && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Deprecated
                  </span>
                )}
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                {headerActions}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={classDetail.iri}>
                {classDetail.iri}
              </p>
              {onCopyIri && (
                <button
                  onClick={() => onCopyIri(classDetail.iri)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  title="Copy IRI"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
              {onNavigateToSource && (
                <button
                  onClick={() => onNavigateToSource(classDetail.iri)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-primary-600 hover:bg-primary-50 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-900/20 dark:hover:text-primary-300"
                  title="View in Source"
                >
                  <Code className="h-3 w-3" />
                  <span>Source</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ AUTO-SAVE AFFORDANCE BAR — pinned edit toolbar ═══ */}
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
          {/* Lint Issues (always read-only) */}
          {classIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Health Issues ({classIssues.length})
              </h3>
              <div className="space-y-2">
                {classIssues.map((issue) => (
                  <IssueItem key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* ═══ PRIMARY LABEL ═══ */}
          {isEditing ? (
            <Section title="Primary Label" tooltip="rdfs:label" icon={<Tag className="h-4 w-4" />}>
              <div className="space-y-2">
                {editLabels.map((label, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={label.value}
                      onChange={(e) => updateLabel(index, "value", e.target.value)}
                      onBlur={() => triggerSave()}
                      placeholder="Label text"
                      className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                    <LanguagePicker
                      value={label.lang}
                      onChange={(code) => {
                        updateLabel(index, "lang", code);
                        triggerSave();
                      }}
                    />
                    {editLabels.length > 1 ? (
                      <button
                        onClick={() => removeLabel(index)}
                        className="rounded-sm p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Remove label"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="rounded-sm p-1">
                        <div className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          ) : classDetail.labels.length > 0 ? (
            <Section title="Primary Label" tooltip="rdfs:label" icon={<Tag className="h-4 w-4" />}>
              <div className="space-y-1">
                {classDetail.labels.map((label, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* ═══ DEFINITION (skos:definition) ═══ */}
          {(() => {
            const defAnnotation = isEditing
              ? editAnnotations.find((a) => a.property_iri === DEFINITION_IRI)
              : classDetail.annotations?.find((a) => a.property_iri === DEFINITION_IRI);

            if (isEditing) {
              const defValues = defAnnotation?.values || [];
              return (
                <Section title="Definition" tooltip="skos:definition" icon={<BookOpen className="h-4 w-4" />}>
                  <div className="space-y-2">
                    {defValues.map((val, vIdx) => {
                      const isGhost = vIdx === defValues.length - 1 && val.value.trim() === "";
                      return (
                        <AnnotationRow
                          key={vIdx}
                          propertyIri={DEFINITION_IRI}
                          value={val.value}
                          lang={val.lang}
                          onValueChange={(v) => updateAnnotationValue(DEFINITION_IRI, vIdx, "value", v)}
                          onLangChange={(l) => updateAnnotationValue(DEFINITION_IRI, vIdx, "lang", l)}
                          onRemove={isGhost ? undefined : () => removeAnnotationValue(DEFINITION_IRI, vIdx)}
                          onBlur={() => triggerSave()}
                          showPropertyLabel={false}
                          placeholder={isGhost ? "Add another Definition \u2014 or translation." : undefined}
                        />
                      );
                    })}
                  </div>
                </Section>
              );
            }

            if (defAnnotation && defAnnotation.values.length > 0) {
              return (
                <Section title="Definition" tooltip="skos:definition" icon={<BookOpen className="h-4 w-4" />}>
                  <div className="space-y-1">
                    {defAnnotation.values.map((val, vIndex) => (
                      <div key={vIndex} className="flex items-start gap-2">
                        {val.lang && <LanguageFlag lang={val.lang} />}
                        <span className="text-sm text-slate-700 dark:text-slate-300">{val.value}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              );
            }

            return null;
          })()}

          {/* ═══ COMMENT (rdfs:comment) ═══ */}
          {isEditing ? (
            <Section title="Comment(s)" tooltip="rdfs:comment" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-2">
                {editComments.map((comment, index) => {
                  const isGhost = index === editComments.length - 1 && comment.value.trim() === "";
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <textarea
                        value={comment.value}
                        onChange={(e) => updateComment(index, "value", e.target.value)}
                        onBlur={() => triggerSave()}
                        placeholder={isGhost ? "Add another Comment \u2014 or translation." : ""}
                        rows={isGhost ? 1 : 2}
                        className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      />
                      <div className="mt-1 shrink-0">
                        <LanguagePicker
                          value={comment.lang}
                          onChange={(code) => {
                            updateComment(index, "lang", code);
                            triggerSave();
                          }}
                        />
                      </div>
                      {!isGhost ? (
                        <button
                          onClick={() => removeComment(index)}
                          className="mt-1 shrink-0 rounded-sm p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Remove comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="mt-1 shrink-0 rounded-sm p-1">
                          <div className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : classDetail.comments.length > 0 ? (
            <Section title="Comment(s)" tooltip="rdfs:comment" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-1">
                {classDetail.comments.map((comment, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {comment.lang && <LanguageFlag lang={comment.lang} />}
                    <span className="text-sm text-slate-700 dark:text-slate-300">{comment.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* ═══ ANNOTATIONS — each property as its own first-class section ═══ */}
          {(() => {
            const annotationGroups = (isEditing ? editAnnotations : classDetail.annotations || [])
              .filter((a) => a.property_iri !== DEFINITION_IRI && !RELATIONSHIP_PROPERTY_IRIS.has(a.property_iri) && a.values.length > 0);

            return (
              <>
                {annotationGroups.map((annotation) => {
                  const propInfo = getAnnotationPropertyInfo(annotation.property_iri);
                  const icon = getAnnotationIcon(annotation.property_iri);

                  if (isEditing) {
                    return (
                      <Section key={annotation.property_iri} title={propInfo.displayLabel} tooltip={propInfo.curie} icon={icon}>
                        <div className="space-y-2">
                          {annotation.values.map((val, vIdx) => {
                            const isGhost = vIdx === annotation.values.length - 1 && val.value.trim() === "";
                            return (
                              <AnnotationRow
                                key={vIdx}
                                propertyIri={annotation.property_iri}
                                value={val.value}
                                lang={val.lang}
                                onValueChange={(v) => updateAnnotationValue(annotation.property_iri, vIdx, "value", v)}
                                onLangChange={(l) => updateAnnotationValue(annotation.property_iri, vIdx, "lang", l)}
                                onRemove={isGhost ? undefined : () => removeAnnotationValue(annotation.property_iri, vIdx)}
                                onBlur={() => triggerSave()}
                                showPropertyLabel={false}
                                placeholder={isGhost ? `Add another ${propInfo.displayLabel} \u2014 or translation.` : undefined}
                              />
                            );
                          })}
                        </div>
                      </Section>
                    );
                  }

                  return (
                    <Section key={annotation.property_iri} title={propInfo.displayLabel} tooltip={propInfo.curie} icon={icon}>
                      <div className="space-y-1">
                        {annotation.values.map((val, vIdx) => (
                          <div key={vIdx} className="flex items-center gap-2">
                            {val.lang && <LanguageFlag lang={val.lang} />}
                            <span className="text-sm text-slate-700 dark:text-slate-300">{val.value}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  );
                })}

                {isEditing && (
                  <InlineAnnotationAdder
                    excludeIris={[
                      LABEL_IRI, COMMENT_IRI, DEFINITION_IRI,
                      ...Array.from(RELATIONSHIP_PROPERTY_IRIS),
                      ...editAnnotations.map((a) => a.property_iri),
                    ]}
                    onAdd={(propertyIri, value, lang) => {
                      setEditAnnotations((prev) => {
                        const existing = prev.find((a) => a.property_iri === propertyIri);
                        if (existing) {
                          return prev.map((a) =>
                            a.property_iri === propertyIri
                              ? { ...a, values: ensureTrailingEmpty([...a.values, { value, lang }]) }
                              : a
                          );
                        }
                        return [
                          ...prev,
                          { property_iri: propertyIri, values: ensureTrailingEmpty([{ value, lang }]) },
                        ];
                      });
                      requestAnimationFrame(() => triggerSave());
                    }}
                  />
                )}
              </>
            );
          })()}

          {/* ═══ PARENT CLASSES ═══ */}
          {isEditing ? (
            <Section title="Parent(s)" tooltip="rdfs:subClassOf" icon={<ArrowUp className="h-4 w-4" />}>
              <div className="space-y-2">
                {editParentIris.map((parentIri) => (
                  <div key={parentIri} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
                      <span className="text-[9px] font-bold text-owl-class">C</span>
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300" title={parentIri}>
                      {editParentLabels[parentIri] || getLocalName(parentIri)}
                    </span>
                    <button
                      onClick={() => removeParent(parentIri)}
                      className="rounded-sm p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Remove parent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {showParentPicker ? (
                  <div className="mt-1">
                    <ParentClassPicker
                      projectId={projectId}
                      accessToken={accessToken}
                      branch={branch}
                      excludeIris={[classDetail.iri, ...editParentIris]}
                      contextIri={classDetail.iri}
                      onSelect={addParent}
                      onClose={() => setShowParentPicker(false)}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowParentPicker(true)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                  >
                    <Plus className="h-3 w-3" />
                    Add parent
                  </button>
                )}
              </div>
            </Section>
          ) : classDetail.parent_iris.length > 0 ? (
            <Section title="Parent(s)" tooltip="rdfs:subClassOf" icon={<ArrowUp className="h-4 w-4" />}>
              <div className="space-y-1">
                {classDetail.parent_iris.map((parentIri) => (
                  <IriLink
                    key={parentIri}
                    iri={parentIri}
                    label={classDetail.parent_labels?.[parentIri]}
                    onClick={onNavigateToClass}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* ═══ RELATIONSHIP(S) ═══ */}
          {(() => {
            const readRelationships: RelationshipGroup[] = isEditing
              ? editRelationships
              : (classDetail.annotations || [])
                  .filter((a) => RELATIONSHIP_PROPERTY_IRIS.has(a.property_iri))
                  .map((a) => {
                    const propInfo = getAnnotationPropertyInfo(a.property_iri);
                    return {
                      property_iri: a.property_iri,
                      property_label: propInfo.displayLabel,
                      targets: a.values
                        .filter((v) => v.value.trim())
                        .map((v) => ({ iri: v.value, label: resolvedTargetLabels[v.value] || getLocalName(v.value) })),
                    };
                  });

            const hasRelationships = readRelationships.some((g) => g.targets.length > 0);
            if (!isEditing && !hasRelationships) return null;

            return (
              <Section title="Relationship(s)" icon={<Link2 className="h-4 w-4" />}>
                <RelationshipSection
                  groups={readRelationships}
                  isEditing={isEditing}
                  projectId={projectId}
                  accessToken={accessToken}
                  branch={branch}
                  onAddTarget={addRelationshipTarget}
                  onRemoveTarget={removeRelationshipTarget}
                  onChangeProperty={changeRelationshipProperty}
                  onAddGroup={addRelationshipGroup}
                  onNavigateToClass={onNavigateToClass}
                  onSaveNeeded={() => triggerSave()}
                />
              </Section>
            );
          })()}

          {/* Statistics (always read-only) */}
          <Section title="Statistics" icon={<BarChart3 className="h-4 w-4" />}>
            <div className="flex items-center gap-4">
              <StatItem label="subclasses" value={classDetail.child_count} />
              <span className="text-slate-300 dark:text-slate-600">&middot;</span>
              <StatItem label="instances" value={classDetail.instance_count ?? "—"} />
            </div>
          </Section>

          {/* Cross-References ("Used By") */}
          <CrossReferencesPanel
            projectId={projectId}
            entityIri={classIri}
            accessToken={accessToken}
            branch={branch}
            onNavigateToClass={onNavigateToClass}
          />

          {/* Entity History */}
          <EntityHistoryTab
            projectId={projectId}
            entityIri={classIri}
            accessToken={accessToken}
            branch={branch}
          />

          {/* Similar Concepts */}
          <SimilarConceptsPanel
            projectId={projectId}
            classIri={classIri}
            accessToken={accessToken}
            branch={branch}
            onNavigateToClass={onNavigateToClass}
          />

          {/* Equivalent Classes (read-only) */}
          {classDetail.equivalent_iris && classDetail.equivalent_iris.length > 0 && (
            <Section title="Equivalent Classes" tooltip="owl:equivalentClass" icon={<Equal className="h-4 w-4" />}>
              <div className="space-y-1">
                {classDetail.equivalent_iris.map((iri) => (
                  <IriLink key={iri} iri={iri} onClick={onNavigateToClass} />
                ))}
              </div>
            </Section>
          )}

          {/* Disjoint Classes (read-only) */}
          {classDetail.disjoint_iris && classDetail.disjoint_iris.length > 0 && (
            <Section title="Disjoint With" tooltip="owl:disjointWith" icon={<Ban className="h-4 w-4" />}>
              <div className="space-y-1">
                {classDetail.disjoint_iris.map((iri) => (
                  <IriLink key={iri} iri={iri} onClick={onNavigateToClass} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

const ANNOTATION_ICON_MAP: Record<string, React.ReactNode> = {
  "http://www.w3.org/2004/02/skos/core#prefLabel": <Star className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#altLabel": <Tags className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#hiddenLabel": <EyeOff className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#example": <Lightbulb className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#scopeNote": <StickyNote className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#editorialNote": <StickyNote className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#historyNote": <StickyNote className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#changeNote": <StickyNote className="h-4 w-4" />,
  "http://www.w3.org/2004/02/skos/core#notation": <Hash className="h-4 w-4" />,
  "http://www.w3.org/2000/01/rdf-schema#seeAlso": <ExternalLink className="h-4 w-4" />,
  "http://www.w3.org/2000/01/rdf-schema#isDefinedBy": <Link2 className="h-4 w-4" />,
};

function getAnnotationIcon(propertyIri: string): React.ReactNode {
  return ANNOTATION_ICON_MAP[propertyIri] || <FileText className="h-4 w-4" />;
}

// ── Sub-components ──────────────────────────────────────────────────

interface SectionProps {
  title: string;
  tooltip?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, tooltip, icon, children }: SectionProps) {
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

interface IriLinkProps {
  iri: string;
  label?: string;
  onClick?: (iri: string) => void;
}

function IriLink({ iri, label, onClick }: IriLinkProps) {
  const displayLabel = label || getLocalName(iri);

  return (
    <button
      onClick={() => onClick?.(iri)}
      className={cn(
        "flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 dark:hover:text-primary-300",
        !onClick && "cursor-default hover:no-underline"
      )}
      title={iri}
      disabled={!onClick}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
        <span className="text-[9px] font-bold text-owl-class">C</span>
      </span>
      {displayLabel}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </button>
  );
}

interface StatItemProps {
  label: string;
  value: number | string | null;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <span className="text-sm text-slate-700 dark:text-slate-300">
      <span className="font-medium">{value}</span>{" "}
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </span>
  );
}

interface IssueItemProps {
  issue: LintIssue;
}

const issueIcons = {
  error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  info: <Info className="h-3.5 w-3.5 text-blue-500" />,
};

const issueColors = {
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function IssueItem({ issue }: IssueItemProps) {
  return (
    <div className={cn("rounded-md px-2.5 py-1.5 text-xs", issueColors[issue.issue_type])}>
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 shrink-0">{issueIcons[issue.issue_type]}</span>
        <div>
          <span className="font-medium">{issue.rule_id}:</span>{" "}
          <span>{issue.message}</span>
        </div>
      </div>
    </div>
  );
}
