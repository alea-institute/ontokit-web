"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, FileCode, GitPullRequest, Activity, RefreshCw, Lightbulb, Eye, Keyboard } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CommitMessageDialog } from "@/components/editor/CommitMessageDialog";
import { AddEntityDialog, type NewEntityInfo } from "@/components/editor/AddEntityDialog";
import { useToast } from "@/lib/context/ToastContext";
import type { TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import { ModeSwitcher } from "@/components/editor/ModeSwitcher";
import { ContinuousEditingToggle } from "@/components/editor/ContinuousEditingToggle";
import { DeveloperEditorLayout } from "@/components/editor/developer/DeveloperEditorLayout";
import { StandardEditorLayout } from "@/components/editor/standard/StandardEditorLayout";
import { BranchSelector, BranchBadge, RevisionHistoryPanel, HistoryButton } from "@/components/revision";
import { useQueryClient } from "@tanstack/react-query";
import { BranchProvider, branchQueryKeys } from "@/lib/context/BranchContext";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { useCollaborationStatus } from "@/lib/hooks/useCollaborationStatus";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { projectApi, type Project } from "@/lib/api/projects";
import { pullRequestsApi } from "@/lib/api/pullRequests";
import { lintApi, type LintSummary } from "@/lib/api/lint";
import { revisionsApi } from "@/lib/api/revisions";
import { projectOntologyApi, type ClassUpdatePayload } from "@/lib/api/client";
import { getLocalName } from "@/lib/utils";
import { normalizationApi, type NormalizationStatusResponse } from "@/lib/api/normalization";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";
import { updateClassInTurtle } from "@/lib/ontology/turtleClassUpdater";
import { updatePropertyInTurtle, type TurtlePropertyUpdateData } from "@/lib/ontology/turtlePropertyUpdater";
import { updateIndividualInTurtle, type TurtleIndividualUpdateData } from "@/lib/ontology/turtleIndividualUpdater";
import { detectPatternFromIriIndex, type IriSuffixPattern } from "@/lib/ontology/iriGeneration";
import { commonPrefixes } from "@/lib/editor/languages/turtle";

import { useKeyboardShortcuts, type ShortcutDefinition } from "@/lib/hooks/useKeyboardShortcuts";
import { KeyboardShortcutDialog } from "@/components/editor/KeyboardShortcutDialog";
import { SuggestionSubmitDialog } from "@/components/editor/SuggestionSubmitDialog";
import { useSuggestionSession } from "@/lib/hooks/useSuggestionSession";
import { useSuggestionBeacon } from "@/lib/hooks/useSuggestionBeacon";
import { suggestionsApi } from "@/lib/api/suggestions";
import { DeleteImpactAnalysis } from "@/components/editor/DeleteImpactAnalysis";
import { UpstreamSyncIndicator } from "@/components/editor/UpstreamSyncIndicator";

import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import type { IriPosition } from "@/lib/editor/indexWorker";

export default function EditorPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = params.id as string;
  const resumeSessionParam = searchParams.get("resumeSession") || undefined;
  const resumeBranchParam = searchParams.get("branch") || undefined;
  const initialBranch = resumeBranchParam
    || (() => { try { return sessionStorage.getItem(`ontokit:branch:${projectId}`); } catch { return null; } })()
    || undefined;

  const editorMode = useEditorModeStore((s) => s.editorMode);

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [openPRCount, setOpenPRCount] = useState(0);
  const [pendingSuggestionCount, setPendingSuggestionCount] = useState(0);
  const [lintSummary, setLintSummary] = useState<LintSummary | null>(null);
  const [normalizationStatus, setNormalizationStatus] = useState<NormalizationStatusResponse | null>(null);

  // Branch state
  const queryClient = useQueryClient();
  const [activeBranch, setActiveBranch] = useState<string | undefined>(undefined);

  // Source state (shared across modes)
  const [sourceContent, setSourceContent] = useState<string>("");
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadStartedRef = useRef(false);
  const sourceEditorRef = useRef<OntologySourceEditorRef>(null);

  // IRI indexing
  const [sourceIriIndex, setSourceIriIndex] = useState<Map<string, IriPosition>>(new Map());
  const [isIndexing, setIsIndexing] = useState(false);

  // Commit dialog
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [pendingSaveContent, setPendingSaveContent] = useState<string | null>(null);

  // Add entity dialog
  const [addEntityDialogOpen, setAddEntityDialogOpen] = useState(false);
  const [addEntityParentIri, setAddEntityParentIri] = useState<string | undefined>(undefined);
  const [addEntityParentLabel, setAddEntityParentLabel] = useState<string | undefined>(undefined);

  // IRI pattern detection
  const [iriPattern, setIriPattern] = useState<IriSuffixPattern>("uuid");
  const [nextNumeric, setNextNumeric] = useState<number | undefined>(undefined);
  const [ontologyNamespace, setOntologyNamespace] = useState("http://example.org/ont#");
  const [ontologyPrefix, setOntologyPrefix] = useState<string | undefined>(undefined);
  const iriPatternDetectedRef = useRef(false);

  // Detail panel refresh key (bumped after class update)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  // Delete class state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIri, setDeleteTargetIri] = useState<string | null>(null);
  const [deleteTargetLabel, setDeleteTargetLabel] = useState<string>("");
  const [deleteImpactAcknowledged, setDeleteImpactAcknowledged] = useState(true);

  // Toast
  const toast = useToast();

  // Pending scroll IRI for source navigation
  const [pendingScrollIri, setPendingScrollIri] = useState<string | null>(null);

  // Ontology tree
  const {
    nodes,
    totalClasses,
    isLoading: isTreeLoading,
    error: treeError,
    selectedIri,
    loadRootClasses,
    expandNode,
    collapseNode,
    selectNode,
    navigateToNode,
    addOptimisticNode,
    removeOptimisticNode,
    updateNodeLabel,
    collapseAll,
    collapseOneLevel,
    expandOneLevel,
    expandAllFully,
    hasExpandableNodes,
    hasExpandedNodes,
    isExpandingAll,
    reparentOptimistic,
    rollbackReparent,
  } = useOntologyTree({
    projectId,
    accessToken: session?.accessToken,
    branchKey: activeBranch,
  });

  // Derive fallback data for the selected node from the tree
  const selectedNodeFallback = useMemo((): TreeNodeFallback | null => {
    if (!selectedIri) return null;
    const findInTree = (
      items: typeof nodes,
      parentIri?: string,
      parentLabel?: string,
    ): TreeNodeFallback | null => {
      for (const node of items) {
        if (node.iri === selectedIri) {
          return { iri: node.iri, label: node.label || "", parentIri, parentLabel };
        }
        const found = findInTree(node.children, node.iri, node.label);
        if (found) return found;
      }
      return null;
    };
    return findInTree(nodes);
  }, [selectedIri, nodes]);

  // WebSocket connection status
  const {
    status: connectionStatus,
    endpoint: wsEndpoint,
    purpose: wsPurpose,
  } = useCollaborationStatus({
    projectId,
    enabled: !!projectId && status !== "loading",
  });

  // Load project data
  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await projectApi.get(projectId, session?.accessToken);
        setProject(data);

        try {
          const prResponse = await pullRequestsApi.list(projectId, session?.accessToken, "open", undefined, 0, 1);
          setOpenPRCount(prResponse.total);
        } catch { /* ignore */ }

        try {
          const summary = await lintApi.getStatus(projectId, session?.accessToken);
          setLintSummary(summary);
        } catch { /* ignore */ }

        if (data.source_file_path) {
          try {
            const normStatus = await normalizationApi.getStatus(projectId, session?.accessToken);
            setNormalizationStatus(normStatus);
          } catch { /* ignore */ }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("403")) {
          setError("You don't have access to this project");
        } else if (err instanceof Error && err.message.includes("404")) {
          setError("Project not found");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && projectId) {
      fetchProject();
    }
  }, [projectId, session?.accessToken, status]);

  const canManage = project?.user_role === "owner" || project?.user_role === "admin" || project?.is_superadmin;
  // If user_role is null but user has access to the project, default to edit (backend enforces actual perms)
  const hasExplicitRole = !!project?.user_role;
  const canEdit = project?.user_role === "owner" || project?.user_role === "admin" || project?.user_role === "editor" || project?.is_superadmin;
  const isSuggester = project?.user_role === "suggester" || (!hasExplicitRole && !!session?.accessToken);
  const canSuggest = canEdit || isSuggester;
  const hasOntology = project?.source_file_path;

  // Fetch pending suggestion count for editors/admins
  useEffect(() => {
    if (!canEdit || !session?.accessToken) return;
    suggestionsApi
      .listPending(projectId, session.accessToken)
      .then((res) => setPendingSuggestionCount(res.items.length))
      .catch(() => { /* ignore — endpoint may not exist yet */ });
  }, [canEdit, projectId, session?.accessToken]);

  // Keyboard shortcut help dialog
  const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);

  // Suggestion session (only active for suggesters who can't directly edit)
  const isSuggestionMode = isSuggester && !canEdit;
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const suggestionSession = useSuggestionSession({
    projectId,
    accessToken: session?.accessToken,
    resumeSessionId: isSuggestionMode ? resumeSessionParam : undefined,
    resumeBranch: isSuggestionMode ? resumeBranchParam : undefined,
    onSubmitted: (prNumber) => {
      toast.success(`Suggestions submitted as PR #${prNumber}`);
    },
    onError: (msg) => toast.error("Suggestion error", msg),
  });

  // Beacon safety net for browser close
  useSuggestionBeacon({
    projectId,
    sessionId: suggestionSession.sessionId,
    beaconToken: suggestionSession.beaconToken,
    getCurrentContent: () => sourceContent || null,
    enabled: isSuggestionMode && suggestionSession.isActive,
  });

  // Load source content
  const loadSourceContent = useCallback(async (isPreload = false) => {
    if (!projectId || !session?.accessToken || !activeBranch) return;
    if (sourceContent) return;

    if (isPreload) {
      setIsPreloading(true);
    } else {
      setIsLoadingSource(true);
    }
    setSourceError(null);

    try {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path
      );
      setSourceContent(response.content);
    } catch (err) {
      console.error("Failed to load source:", err);
      if (!isPreload) {
        setSourceError(err instanceof Error ? err.message : "Failed to load source content");
      }
    } finally {
      if (isPreload) {
        setIsPreloading(false);
      } else {
        setIsLoadingSource(false);
      }
    }
  }, [projectId, session?.accessToken, sourceContent, activeBranch, project?.git_ontology_path]);

  // Save refs for commit promise
  const pendingSaveResolveRef = useRef<(() => void) | null>(null);
  const pendingSaveRejectRef = useRef<((error: Error) => void) | null>(null);

  const handleSaveSource = useCallback(async (newContent: string) => {
    if (!projectId || !session?.accessToken) {
      throw new Error("Not authenticated");
    }
    setPendingSaveContent(newContent);
    setCommitDialogOpen(true);
    return new Promise<void>((resolve, reject) => {
      pendingSaveResolveRef.current = resolve;
      pendingSaveRejectRef.current = reject;
    });
  }, [projectId, session?.accessToken]);

  const handleCommitConfirm = useCallback(async (commitMessage: string) => {
    if (!projectId || !session?.accessToken || !pendingSaveContent) {
      throw new Error("Not authenticated or no content to save");
    }

    await projectOntologyApi.saveSource(
      projectId,
      pendingSaveContent,
      commitMessage,
      session.accessToken,
      activeBranch
    );

    setSourceContent(pendingSaveContent);
    setSourceIriIndex(new Map());
    loadRootClasses();
    iriPatternDetectedRef.current = false;
    queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId) });

    pendingSaveResolveRef.current?.();
    pendingSaveResolveRef.current = null;
    pendingSaveRejectRef.current = null;
    setPendingSaveContent(null);
  }, [projectId, session?.accessToken, pendingSaveContent, activeBranch, loadRootClasses, queryClient]);

  const handleCommitDialogClose = useCallback((open: boolean) => {
    setCommitDialogOpen(open);
    if (!open && pendingSaveContent) {
      pendingSaveRejectRef.current?.(new Error("Save cancelled"));
      pendingSaveResolveRef.current = null;
      pendingSaveRejectRef.current = null;
      setPendingSaveContent(null);
    }
  }, [pendingSaveContent]);

  // Background preload source content after initial page load
  useEffect(() => {
    if (!sourceContent && !isLoadingSource && !isPreloading && !preloadStartedRef.current && hasOntology) {
      const timer = setTimeout(() => {
        if (!preloadStartedRef.current) {
          preloadStartedRef.current = true;
          loadSourceContent(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sourceContent, isLoadingSource, isPreloading, loadSourceContent, hasOntology]);

  // Build IRI index in background
  useEffect(() => {
    if (!sourceContent || sourceIriIndex.size > 0 || isIndexing) return;

    setIsIndexing(true);

    const buildIriIndexAsync = async (content: string): Promise<Map<string, IriPosition>> => {
      const index = new Map<string, IriPosition>();
      const lines = content.split("\n");

      const prefixes = new Map<string, string>();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
        if (prefixMatch) {
          prefixes.set(prefixMatch[1], prefixMatch[2]);
        }
      }

      const chunkSize = 5000;
      for (let start = 0; start < lines.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, lines.length);

        for (let i = start; i < end; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("@") || trimmed.toUpperCase().startsWith("PREFIX")) continue;

          let isContinuation = false;
          for (let j = i - 1; j >= 0; j--) {
            const prevTrimmed = lines[j].trim();
            if (!prevTrimmed || prevTrimmed.startsWith("#")) continue;
            if (prevTrimmed.endsWith(",") || prevTrimmed.endsWith(";")) {
              isContinuation = true;
            }
            break;
          }

          if (isContinuation) continue;

          const fullIriMatch = trimmed.match(/^<([^>\s]+)>/);
          if (fullIriMatch) {
            const iri = fullIriMatch[1];
            if (!index.has(iri)) {
              const col = line.indexOf('<') + 1;
              index.set(iri, { line: i + 1, col, len: fullIriMatch[0].length });
            }
          }

          const prefixedMatch = trimmed.match(/^(\w*):([A-Za-z_][A-Za-z0-9_\-]*)/);
          if (prefixedMatch) {
            const prefix = prefixedMatch[1];
            const localName = prefixedMatch[2];
            const namespace = prefixes.get(prefix);
            if (namespace) {
              const fullIri = namespace + localName;
              if (!index.has(fullIri)) {
                const prefixedName = `${prefix}:${localName}`;
                const col = line.indexOf(prefixedName) + 1;
                index.set(fullIri, { line: i + 1, col, len: prefixedName.length });
              }
            }
          }
        }

        if (end < lines.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      return index;
    };

    buildIriIndexAsync(sourceContent)
      .then((newIndex) => {
        setSourceIriIndex(newIndex);
        setIsIndexing(false);
      })
      .catch((error) => {
        console.error("[ViewInSource] Indexing error:", error);
        setIsIndexing(false);
      });
  }, [sourceContent, sourceIriIndex.size, isIndexing]);

  // Detect IRI pattern
  useEffect(() => {
    if (iriPatternDetectedRef.current || sourceIriIndex.size === 0 || !sourceContent) return;
    iriPatternDetectedRef.current = true;

    const internalNamespaces = new Set<string>();
    const prefixMap = new Map<string, string>();
    const externalNamespaces = new Set(commonPrefixes.map((p) => p.namespace));

    for (const line of sourceContent.split("\n")) {
      const baseMatch = line.match(/@base\s+<([^>]+)>/i);
      if (baseMatch) {
        internalNamespaces.add(baseMatch[1]);
      }
      const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
      if (prefixMatch) {
        const [, pfx, ns] = prefixMatch;
        prefixMap.set(pfx, ns);
        if (!externalNamespaces.has(ns)) {
          internalNamespaces.add(ns);
        }
      }
    }

    const defaultNs = prefixMap.get("") ?? [...internalNamespaces][0];
    if (defaultNs) {
      setOntologyNamespace(defaultNs);
    }

    for (const [pfx, ns] of prefixMap) {
      if (ns === defaultNs && pfx !== "") {
        setOntologyPrefix(pfx);
        break;
      }
    }

    const result = detectPatternFromIriIndex(sourceIriIndex, internalNamespaces);
    setIriPattern(result.pattern);
    if (result.nextNumeric !== undefined) {
      setNextNumeric(result.nextNumeric);
    }
  }, [sourceIriIndex, sourceContent]);

  // Handle "Add Entity"
  const handleAddEntity = useCallback((parentIri?: string) => {
    setAddEntityParentIri(parentIri);
    if (parentIri) {
      const findLabel = (items: typeof nodes): string | undefined => {
        for (const node of items) {
          if (node.iri === parentIri) return node.label;
          const found = findLabel(node.children);
          if (found) return found;
        }
        return undefined;
      };
      setAddEntityParentLabel(findLabel(nodes));
    } else {
      setAddEntityParentLabel(undefined);
    }
    setAddEntityDialogOpen(true);
  }, [nodes]);

  const handleEntityConfirm = useCallback(
    async (entity: NewEntityInfo) => {
      const snippet = generateTurtleSnippet({
        iri: entity.iri,
        label: entity.label,
        entityType: entity.entityType,
        parentIri: entity.parentIri,
        ontologyPrefix,
        ontologyNamespace,
      });

      if (sourceEditorRef.current) {
        sourceEditorRef.current.insertAtEnd(snippet);
        setSourceContent(sourceEditorRef.current.getValue());
      } else if (sourceContent) {
        setSourceContent((prev) => prev + snippet);
      } else {
        // Source not yet loaded — fetch it first to avoid overwriting with just the snippet
        if (!projectId || !session?.accessToken || !activeBranch) return;
        try {
          const response = await revisionsApi.getFileAtVersion(
            projectId,
            activeBranch,
            session.accessToken,
            project?.git_ontology_path
          );
          setSourceContent(response.content + snippet);
        } catch {
          toast.error("Failed to load source before adding entity");
          return;
        }
      }

      if (entity.entityType === "class") {
        addOptimisticNode(entity.iri, entity.label, entity.parentIri);
      }
    },
    [ontologyPrefix, ontologyNamespace, addOptimisticNode, sourceContent, projectId, session?.accessToken, activeBranch, project?.git_ontology_path, toast],
  );

  // Handle copy IRI
  const handleCopyIri = useCallback(async (iri: string) => {
    try {
      await navigator.clipboard.writeText(iri);
      toast.success("IRI copied to clipboard");
    } catch {
      toast.error("Failed to copy IRI");
    }
  }, [toast]);

  // Handle delete class
  const handleDeleteClass = useCallback((iri: string, label: string) => {
    setDeleteTargetIri(iri);
    setDeleteTargetLabel(label);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetIri || !session?.accessToken) return;

    // Optimistic removal
    removeOptimisticNode(deleteTargetIri);

    try {
      await projectOntologyApi.deleteClass(
        projectId,
        deleteTargetIri,
        `Delete class ${deleteTargetLabel}`,
        session.accessToken,
        activeBranch
      );
      toast.success(`Deleted "${deleteTargetLabel}"`);
      // Invalidate cached source so the next edit re-fetches from the server
      setSourceContent("");
      // Reload tree to ensure consistency
      loadRootClasses();
      queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId) });
    } catch (err) {
      toast.error(
        "Failed to delete class",
        err instanceof Error ? err.message : "Unknown error"
      );
      // Reload tree to restore state
      loadRootClasses();
    }
  }, [deleteTargetIri, deleteTargetLabel, session?.accessToken, projectId, activeBranch, removeOptimisticNode, toast, loadRootClasses, queryClient]);

  // Handle update class (form-based editing)
  // Routes through source save: modifies the Turtle text and commits via PUT /source
  const handleUpdateClass = useCallback(async (classIri: string, data: ClassUpdatePayload) => {
    if (!session?.accessToken) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    // Ensure source content is loaded
    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path,
      );
      source = response.content;
    }

    // Apply the update to the Turtle source text
    const modifiedSource = updateClassInTurtle(source, classIri, data);

    // Save via the source endpoint (the only project-level write path)
    const label = data.labels[0]?.value || getLocalName(classIri);
    const commitMessage = `Update class ${label}`;

    await projectOntologyApi.saveSource(
      projectId,
      modifiedSource,
      commitMessage,
      session.accessToken,
      activeBranch,
    );

    // Update local source content to match what was saved
    setSourceContent(modifiedSource);
    toast.success(`Updated "${label}"`);

    // Update the tree node label in-place (preserves expansion state)
    updateNodeLabel(classIri, label);
    setDetailRefreshKey((k) => k + 1);

    // Re-index source IRIs
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId) });
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, updateNodeLabel, queryClient]);

  // Handle update property (form-based editing)
  const handleUpdateProperty = useCallback(async (propertyIri: string, data: TurtlePropertyUpdateData) => {
    if (!session?.accessToken) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updatePropertyInTurtle(source, propertyIri, data);
    const label = data.labels[0]?.value || getLocalName(propertyIri);
    const commitMessage = `Update property ${label}`;

    await projectOntologyApi.saveSource(
      projectId,
      modifiedSource,
      commitMessage,
      session.accessToken,
      activeBranch,
    );

    setSourceContent(modifiedSource);
    toast.success(`Updated "${label}"`);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId) });
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, queryClient]);

  // Handle update individual (form-based editing)
  const handleUpdateIndividual = useCallback(async (individualIri: string, data: TurtleIndividualUpdateData) => {
    if (!session?.accessToken) {
      throw new Error("Not authenticated");
    }
    if (!activeBranch) {
      throw new Error("No branch selected");
    }

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updateIndividualInTurtle(source, individualIri, data);
    const label = data.labels[0]?.value || getLocalName(individualIri);
    const commitMessage = `Update individual ${label}`;

    await projectOntologyApi.saveSource(
      projectId,
      modifiedSource,
      commitMessage,
      session.accessToken,
      activeBranch,
    );

    setSourceContent(modifiedSource);
    toast.success(`Updated "${label}"`);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
    queryClient.invalidateQueries({ queryKey: branchQueryKeys.list(projectId) });
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, queryClient]);

  // Handle suggestion-mode class update
  // Instead of directly committing, sends modified source to the suggestion branch
  const handleSuggestClassUpdate = useCallback(async (classIri: string, data: ClassUpdatePayload) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    // Ensure session exists
    if (!suggestionSession.sessionId) {
      await suggestionSession.startSession();
    }

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch,
        session.accessToken,
        project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updateClassInTurtle(source, classIri, data);
    const label = data.labels[0]?.value || getLocalName(classIri);

    await suggestionSession.saveToSession(modifiedSource, classIri, label);

    setSourceContent(modifiedSource);
    toast.success(`Suggested update to "${label}"`);
    updateNodeLabel(classIri, label);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, updateNodeLabel, suggestionSession]);

  // Handle suggestion-mode property update
  const handleSuggestPropertyUpdate = useCallback(async (propertyIri: string, data: TurtlePropertyUpdateData) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    if (!suggestionSession.sessionId) {
      await suggestionSession.startSession();
    }

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId, activeBranch, session.accessToken, project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updatePropertyInTurtle(source, propertyIri, data);
    const label = data.labels[0]?.value || getLocalName(propertyIri);

    await suggestionSession.saveToSession(modifiedSource, propertyIri, label);

    setSourceContent(modifiedSource);
    toast.success(`Suggested update to "${label}"`);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, suggestionSession]);

  // Handle suggestion-mode individual update
  const handleSuggestIndividualUpdate = useCallback(async (individualIri: string, data: TurtleIndividualUpdateData) => {
    if (!session?.accessToken) throw new Error("Not authenticated");
    if (!activeBranch) throw new Error("No branch selected");

    if (!suggestionSession.sessionId) {
      await suggestionSession.startSession();
    }

    let source = sourceContent;
    if (!source) {
      const response = await revisionsApi.getFileAtVersion(
        projectId, activeBranch, session.accessToken, project?.git_ontology_path,
      );
      source = response.content;
    }

    const modifiedSource = updateIndividualInTurtle(source, individualIri, data);
    const label = data.labels[0]?.value || getLocalName(individualIri);

    await suggestionSession.saveToSession(modifiedSource, individualIri, label);

    setSourceContent(modifiedSource);
    toast.success(`Suggested update to "${label}"`);
    setDetailRefreshKey((k) => k + 1);
    setSourceIriIndex(new Map());
    iriPatternDetectedRef.current = false;
  }, [session?.accessToken, projectId, activeBranch, project?.git_ontology_path, sourceContent, toast, suggestionSession]);

  // Handle drag-and-drop reparent class
  // Fetches full class detail, modifies parent_iris, then routes through the appropriate save handler
  const handleReparentClass = useCallback(async (
    classIri: string,
    _oldParentIris: string[],
    newParentIris: string[],
    mode: "move" | "add",
  ) => {
    if (!session?.accessToken) throw new Error("Not authenticated");

    // Fetch the full class detail to get authoritative parent_iris
    const detail = await projectOntologyApi.getClassDetail(projectId, classIri, session.accessToken, activeBranch);

    // Build new parent list based on mode
    let updatedParentIris: string[];
    if (newParentIris.length === 0) {
      // Dropped on root zone — remove all parents
      updatedParentIris = [];
    } else if (mode === "add") {
      // Add mode — keep existing, add new (deduplicated)
      const parentSet = new Set(detail.parent_iris);
      for (const iri of newParentIris) parentSet.add(iri);
      updatedParentIris = [...parentSet];
    } else {
      // Move mode — replace old tree parent with new
      const oldTreeParent = _oldParentIris[0] || null;
      if (oldTreeParent && detail.parent_iris.includes(oldTreeParent)) {
        updatedParentIris = detail.parent_iris.map((p) =>
          p === oldTreeParent ? newParentIris[0] : p,
        );
      } else {
        // Old parent not in actual parents (e.g., node was at root) — just add new
        updatedParentIris = [...detail.parent_iris, ...newParentIris];
      }
      // Deduplicate
      updatedParentIris = [...new Set(updatedParentIris)];
    }

    // Build ClassUpdatePayload from the fetched detail
    const payload: ClassUpdatePayload = {
      labels: detail.labels,
      comments: detail.comments,
      parent_iris: updatedParentIris,
      annotations: detail.annotations.map((a) => ({
        property_iri: a.property_iri,
        values: a.values,
      })),
      deprecated: detail.deprecated,
      equivalent_iris: detail.equivalent_iris,
      disjoint_iris: detail.disjoint_iris,
    };

    // Route through the appropriate save handler
    const saveHandler = isSuggestionMode ? handleSuggestClassUpdate : handleUpdateClass;
    await saveHandler(classIri, payload);
  }, [session?.accessToken, projectId, activeBranch, isSuggestionMode, handleUpdateClass, handleSuggestClassUpdate]);

  // Handle branch change
  const handleBranchChange = useCallback((branchName: string) => {
    // Discard any active suggestion session tied to the old branch
    if (suggestionSession.isActive) {
      suggestionSession.discardSession();
    }
    setActiveBranch(branchName);
    setSourceContent("");
    setSourceError(null);
    setSourceIriIndex(new Map());
    preloadStartedRef.current = false;
    router.replace(`${pathname}?branch=${encodeURIComponent(branchName)}`);
  }, [pathname, router, suggestionSession]);

  // --- Keyboard shortcuts ---
  const keyboardShortcuts = useMemo((): ShortcutDefinition[] => [
    {
      id: "save",
      key: "s",
      modifiers: { ctrl: true },
      description: "Save / flush draft",
      category: "Editing",
      action: () => {
        // Trigger a blur on active element to flush auto-save drafts
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
      global: true,
      ignoreWhenEditorFocused: true,
    },
    {
      id: "add-entity",
      key: "n",
      modifiers: { ctrl: true },
      description: "Add new entity",
      category: "Editing",
      action: () => handleAddEntity(),
      global: true,
    },
    {
      id: "help",
      key: "?",
      description: "Show keyboard shortcuts",
      category: "General",
      action: () => setShortcutDialogOpen(true),
    },
    {
      id: "escape",
      key: "Escape",
      description: "Close topmost overlay",
      category: "General",
      action: () => {
        if (shortcutDialogOpen) {
          setShortcutDialogOpen(false);
        } else if (showHistory) {
          setShowHistory(false);
        }
      },
      global: true,
      ignoreWhenEditorFocused: false,
    },
  ], [handleAddEntity, shortcutDialogOpen, showHistory]);

  useKeyboardShortcuts(keyboardShortcuts);

  // --- Render ---

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/projects"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error || "Project not found"}
              </h2>
              <Link href="/projects" className="mt-4 inline-block">
                <Button variant="outline">Back to Projects</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!hasOntology) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${projectId}`}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <h1 className="font-semibold text-slate-900 dark:text-white">{project.name}</h1>
              </div>
              {canManage && (
                <Link href={`/projects/${projectId}/settings`}>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="flex h-[calc(100vh-4rem-3.5rem)] items-center justify-center">
            <div className="text-center">
              <FileCode className="mx-auto h-16 w-16 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">No Ontology File</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                This project doesn&apos;t have an ontology file yet.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                Import an ontology file from the project settings.
              </p>
              <Link href={`/projects/${projectId}/settings`} className="mt-6 inline-block">
                <Button variant="outline">Go to Settings</Button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <BranchProvider projectId={projectId} accessToken={session?.accessToken} initialBranch={initialBranch}>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
        {/* Editor Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="font-semibold text-slate-900 dark:text-white">{project.name}</h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">{totalClasses} classes</span>
              <BranchBadge />

              {/* Mode Switcher */}
              <ModeSwitcher />
              {canSuggest && <ContinuousEditingToggle />}

              {/* Suggestion mode indicator */}
              {isSuggestionMode && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lightbulb className="h-3 w-3" />
                  Suggesting
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Submit Suggestions button */}
              {isSuggestionMode && suggestionSession.changesCount > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setSubmitDialogOpen(true)}
                >
                  <Lightbulb className="h-4 w-4" />
                  {suggestionSession.isResumed ? "Resubmit Suggestions" : "Submit Suggestions"}
                  <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-xs">
                    {suggestionSession.changesCount}
                  </span>
                </Button>
              )}

              {/* Suggestions link */}
              {isSuggestionMode && (
                <Link href={`/projects/${projectId}/suggestions`}>
                  <Button variant="ghost" size="sm" className="gap-2 text-amber-600 dark:text-amber-400">
                    <Lightbulb className="h-4 w-4" />
                    <span className="hidden sm:inline">My Suggestions</span>
                  </Button>
                </Link>
              )}

              {/* Review Suggestions link (editors/admins only) */}
              {canEdit && pendingSuggestionCount > 0 && (
                <Link href={`/projects/${projectId}/suggestions/review`}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Review</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {pendingSuggestionCount}
                    </span>
                  </Button>
                </Link>
              )}

              {/* WebSocket Connection Status */}
              <div className="flex items-center gap-1">
                <ConnectionStatus
                  state="disabled"
                  purpose="Real-time collaboration (coming soon)"
                  endpoint="/api/v1/collab/ws"
                />
                <ConnectionStatus
                  state={connectionStatus}
                  purpose={wsPurpose}
                  endpoint={wsEndpoint}
                />
              </div>

              {/* Branch Selector */}
              <BranchSelector onBranchChange={handleBranchChange} canCreateBranch={canEdit} />

              {/* History Button */}
              <HistoryButton onClick={() => setShowHistory(!showHistory)} isOpen={showHistory} />

              {/* Upstream Sync Status */}
              <UpstreamSyncIndicator
                projectId={projectId}
                accessToken={session?.accessToken}
              />

              {/* Normalization Status */}
              {normalizationStatus?.needs_normalization && (
                <Link href={`/projects/${projectId}/settings#normalization`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                    title="Ontology normalization recommended"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Normalize</span>
                  </Button>
                </Link>
              )}

              {/* Health Check */}
              <Button
                variant={showHealthCheck ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowHealthCheck(!showHealthCheck)}
                className="gap-2"
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Health</span>
                {lintSummary && lintSummary.total_issues > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                    lintSummary.error_count > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : lintSummary.warning_count > 0
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {lintSummary.total_issues}
                  </span>
                )}
              </Button>

              {/* PR Link */}
              <Link href={`/projects/${projectId}/pull-requests`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <GitPullRequest className="h-4 w-4" />
                  <span className="hidden sm:inline">PRs</span>
                  {openPRCount > 0 && (
                    <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                      {openPRCount}
                    </span>
                  )}
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShortcutDialogOpen(true)}
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>

              {canManage && (
                <Link href={`/projects/${projectId}/settings`}>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main Editor Layout — mode-dependent */}
        <div className="relative flex h-[calc(100vh-4rem-3.5rem)]">
          <div className="flex-1 flex overflow-hidden">
            {editorMode === "developer" ? (
              <div className="flex-1 flex flex-col">
                <DeveloperEditorLayout
                  projectId={projectId}
                  accessToken={session?.accessToken}
                  activeBranch={activeBranch}
                  canEdit={!!canEdit}
                  canSuggest={!!canSuggest}
                  isSuggestionMode={isSuggestionMode}
                  canManage={!!canManage}
                  nodes={nodes}
                  isTreeLoading={isTreeLoading}
                  treeError={treeError}
                  selectedIri={selectedIri}
                  selectNode={selectNode}
                  expandNode={expandNode}
                  collapseNode={collapseNode}
                  expandOneLevel={expandOneLevel}
                  expandAllFully={expandAllFully}
                  collapseAll={collapseAll}
                  collapseOneLevel={collapseOneLevel}
                  hasExpandableNodes={hasExpandableNodes}
                  hasExpandedNodes={hasExpandedNodes}
                  isExpandingAll={isExpandingAll}
                  navigateToNode={navigateToNode}
                  sourceContent={sourceContent}
                  setSourceContent={setSourceContent as (content: string | ((prev: string) => string)) => void}
                  isLoadingSource={isLoadingSource}
                  sourceError={sourceError}
                  isPreloading={isPreloading}
                  loadSourceContent={loadSourceContent}
                  sourceIriIndex={sourceIriIndex}
                  pendingScrollIri={pendingScrollIri}
                  setPendingScrollIri={setPendingScrollIri}
                  sourceEditorRef={sourceEditorRef}
                  onSaveSource={handleSaveSource}
                  onAddEntity={handleAddEntity}
                  onDeleteClass={handleDeleteClass}
                  onCopyIri={handleCopyIri}
                  selectedNodeFallback={selectedNodeFallback}
                  onUpdateClass={isSuggestionMode ? handleSuggestClassUpdate : handleUpdateClass}
                  detailRefreshKey={detailRefreshKey}
                  showHealthCheck={showHealthCheck}
                  onCloseHealthCheck={() => setShowHealthCheck(false)}
                  onUpdateProperty={isSuggestionMode ? handleSuggestPropertyUpdate : handleUpdateProperty}
                  onUpdateIndividual={isSuggestionMode ? handleSuggestIndividualUpdate : handleUpdateIndividual}
                  onReparentClass={handleReparentClass}
                  reparentOptimistic={reparentOptimistic}
                  rollbackReparent={rollbackReparent}
                />
              </div>
            ) : (
              <StandardEditorLayout
                projectId={projectId}
                accessToken={session?.accessToken}
                activeBranch={activeBranch}
                canEdit={!!canEdit}
                canSuggest={!!canSuggest}
                isSuggestionMode={isSuggestionMode}
                nodes={nodes}
                isTreeLoading={isTreeLoading}
                treeError={treeError}
                selectedIri={selectedIri}
                selectNode={selectNode}
                expandNode={expandNode}
                collapseNode={collapseNode}
                expandOneLevel={expandOneLevel}
                expandAllFully={expandAllFully}
                collapseAll={collapseAll}
                collapseOneLevel={collapseOneLevel}
                hasExpandableNodes={hasExpandableNodes}
                hasExpandedNodes={hasExpandedNodes}
                isExpandingAll={isExpandingAll}
                navigateToNode={navigateToNode}
                onAddEntity={handleAddEntity}
                onDeleteClass={handleDeleteClass}
                onCopyIri={handleCopyIri}
                selectedNodeFallback={selectedNodeFallback}
                onUpdateClass={isSuggestionMode ? handleSuggestClassUpdate : handleUpdateClass}
                detailRefreshKey={detailRefreshKey}
                sourceContent={sourceContent}
                onUpdateProperty={isSuggestionMode ? handleSuggestPropertyUpdate : handleUpdateProperty}
                onUpdateIndividual={isSuggestionMode ? handleSuggestIndividualUpdate : handleUpdateIndividual}
                onReparentClass={handleReparentClass}
                reparentOptimistic={reparentOptimistic}
                rollbackReparent={rollbackReparent}
              />
            )}
          </div>

          {/* Right Panel - Revision History (available in both modes) */}
          <RevisionHistoryPanel
            projectId={projectId}
            accessToken={session?.accessToken}
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
          />
        </div>
      </main>

      {/* Commit Message Dialog */}
      <CommitMessageDialog
        open={commitDialogOpen}
        onOpenChange={handleCommitDialogClose}
        onConfirm={handleCommitConfirm}
        defaultMessage="Update ontology"
      />

      {/* Add Entity Dialog */}
      <AddEntityDialog
        open={addEntityDialogOpen}
        onOpenChange={setAddEntityDialogOpen}
        onConfirm={handleEntityConfirm}
        iriPattern={iriPattern}
        nextNumeric={nextNumeric}
        ontologyNamespace={ontologyNamespace}
        parentIri={addEntityParentIri}
        parentLabel={addEntityParentLabel}
      />

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteImpactAcknowledged(true);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Class"
        description={`Are you sure you want to delete "${deleteTargetLabel}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        confirmDisabled={!deleteImpactAcknowledged}
      >
        <DeleteImpactAnalysis
          projectId={projectId}
          entityIri={deleteTargetIri}
          accessToken={session?.accessToken}
          branch={activeBranch}
          onAcknowledge={setDeleteImpactAcknowledged}
        />
      </ConfirmDialog>

      {/* Suggestion Submit Dialog */}
      {isSuggestionMode && (
        <SuggestionSubmitDialog
          open={submitDialogOpen}
          onOpenChange={setSubmitDialogOpen}
          onConfirm={suggestionSession.isResumed ? suggestionSession.resubmitSession : suggestionSession.submitSession}
          entitiesModified={suggestionSession.entitiesModified}
          changesCount={suggestionSession.changesCount}
        />
      )}

      {/* Keyboard Shortcut Help Dialog */}
      <KeyboardShortcutDialog
        open={shortcutDialogOpen}
        onOpenChange={setShortcutDialogOpen}
        shortcuts={keyboardShortcuts}
      />
    </BranchProvider>
  );
}
