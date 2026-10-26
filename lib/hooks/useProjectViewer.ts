import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { useCollaborationStatus } from "@/lib/hooks/useCollaborationStatus";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import { useOpenPRCount } from "@/lib/hooks/useOpenPRCount";
import { useLintSummary } from "@/lib/hooks/useLintSummary";
import { useNormalizationStatus } from "@/lib/hooks/useNormalizationStatus";
import { usePendingSuggestionCount } from "@/lib/hooks/usePendingSuggestionCount";
import { revisionsApi, type RevisionFileResponse } from "@/lib/api/revisions";
import type { TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import type { IriPosition } from "@/lib/editor/indexWorker";

export interface UseProjectViewerOptions {
  projectId: string;
  accessToken?: string;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  activeBranch?: string;
  /** Anonymous proposal branch, used only when this project permits proposals. */
  proposalBranch?: string;
  /** Enable WebSocket connections (lint status, collaboration). Defaults to false. */
  enableWebSocket?: boolean;
}

export function useProjectViewer({
  projectId,
  accessToken,
  sessionStatus,
  activeBranch,
  proposalBranch,
  enableWebSocket = false,
}: UseProjectViewerOptions) {
  // Project data from shared React Query cache
  const {
    project, isLoading, error, errorKind,
  } = useProject(projectId, accessToken);
  const permissions = derivePermissions(project, accessToken);
  const {
    canManage, canEdit, canSuggest, isSuggester, isSuggestionMode,
    hasValidAccess: _hasValidAccess, hasOntology, hasExplicitRole,
  } = permissions;
  // Override hasValidAccess to check session status (not just token presence)
  const hasValidAccess = sessionStatus === "authenticated" && !!accessToken;

  // Secondary data via React Query hooks
  const { data: openPRCount = 0 } = useOpenPRCount(projectId, accessToken);
  const { data: lintSummary = null } = useLintSummary(projectId, accessToken);
  const { data: normalizationStatus = null } = useNormalizationStatus(
    projectId,
    accessToken,
    { enabled: !!project?.source_file_path },
  );
  const { data: pendingSuggestionCount = 0 } = usePendingSuggestionCount(
    projectId,
    accessToken,
    { enabled: !!canEdit },
  );

  // Tag the buffer with its read scope, including anonymous suggestion branches.
  // Render-time scope checks also cover the frame before branch-reset effects run.
  const sourceBranch = !canEdit && !canSuggest && project?.is_public
    ? proposalBranch ?? activeBranch : activeBranch;
  const sourceScope = useMemo(() => ({ projectId, branch: sourceBranch, filePath: project?.git_ontology_path }), [projectId, sourceBranch, project?.git_ontology_path]);
  const sourceScopeKey = JSON.stringify(sourceScope);
  const sourceScopeRef = useRef({ key: sourceScopeKey, epoch: 0 });
  if (sourceScopeRef.current.key !== sourceScopeKey) {
    sourceScopeRef.current = { key: sourceScopeKey, epoch: sourceScopeRef.current.epoch + 1 };
  }
  const sourceScopeEpoch = sourceScopeRef.current.epoch;
  const [sourceSnapshot, setSourceSnapshotState] = useState<{
    content: string; revision: string | null; epoch: number;
  }>({ content: "", revision: null, epoch: -1 });
  const isSourceReady = sourceSnapshot.epoch === sourceScopeEpoch;
  const sourceContent = isSourceReady ? sourceSnapshot.content : "";
  const sourceRevision = isSourceReady ? sourceSnapshot.revision : null;
  const setSourceContent = useCallback((next: React.SetStateAction<string>) => {
    if (sourceScopeRef.current.epoch !== sourceScopeEpoch) return;
    setSourceSnapshotState((previous) => {
      const current = previous.epoch === sourceScopeEpoch ? previous : { content: "", revision: null, epoch: sourceScopeEpoch };
      const content = typeof next === "function" ? next(current.content) : next;
      return { ...current, content };
    });
  }, [sourceScopeEpoch]);
  const setSourceSnapshot = useCallback((content: string, revision: string) => {
    if (sourceScopeRef.current.epoch !== sourceScopeEpoch) return;
    setSourceSnapshotState({ content, revision, epoch: sourceScopeEpoch });
  }, [sourceScopeEpoch]);
  const [sourceLoad, setSourceLoad] = useState({ epoch: -1, loading: false, preloading: false, error: null as string | null });
  const isLoadingSource = sourceLoad.epoch === sourceScopeEpoch && sourceLoad.loading;
  const isPreloading = sourceLoad.epoch === sourceScopeEpoch && sourceLoad.preloading;
  const sourceError = sourceLoad.epoch === sourceScopeEpoch ? sourceLoad.error : null;
  const preloadStartedRef = useRef<number | null>(null);
  const sourceRequestIdRef = useRef(0);

  // IRI indexing
  const [sourceIriIndex, setSourceIriIndex] = useState<Map<string, IriPosition>>(new Map());
  const [isIndexing, setIsIndexing] = useState(false);

  // Ontology tree
  const tree = useOntologyTree({
    projectId,
    accessToken,
    branchKey: activeBranch,
  });

  // WebSocket connection status (editor only)
  const collaboration = useCollaborationStatus({
    projectId,
    enabled: enableWebSocket && !!projectId && !!accessToken && sessionStatus === "authenticated",
    token: accessToken,
  });

  // Derive fallback data for the selected node from the tree
  const { selectedIri, nodes } = tree;
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

  const fetchSourceContent = useCallback(async (
    isPreload: boolean,
  ): Promise<RevisionFileResponse | undefined> => {
    if (!projectId || !sourceBranch) return;
    const requestId = ++sourceRequestIdRef.current;

    setSourceLoad({ epoch: sourceScopeEpoch, loading: !isPreload, preloading: isPreload, error: null });

    try {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        sourceBranch,
        accessToken,
        project?.git_ontology_path
      );
      if (
        requestId !== sourceRequestIdRef.current
        || sourceScopeEpoch !== sourceScopeRef.current.epoch
      ) return;
      setSourceSnapshot(response.content, response.revision);
      return response;
    } catch (err) {
      console.error("Failed to load source:", err);
      if (
        !isPreload
        && requestId === sourceRequestIdRef.current
        && sourceScopeEpoch === sourceScopeRef.current.epoch
      ) {
        setSourceLoad(previous => ({ ...previous, error: err instanceof Error ? err.message : "Failed to load source content" }));
      }
    } finally {
      if (
        requestId === sourceRequestIdRef.current
        && sourceScopeEpoch === sourceScopeRef.current.epoch
      ) {
        setSourceLoad(previous => ({ ...previous, loading: false, preloading: false }));
      }
    }
  }, [
    projectId,
    accessToken,
    sourceBranch,
    project?.git_ontology_path,
    setSourceSnapshot,
    sourceScopeEpoch,
  ]);

  // Load once for the current branch. Content and immutable revision always
  // come from the same response so direct saves cannot mix snapshots.
  const loadSourceContent = useCallback(async (isPreload = false) => {
    if (isSourceReady) return;
    await fetchSourceContent(isPreload);
  }, [isSourceReady, fetchSourceContent]);

  // Explicit reconciliation bypasses the ordinary already-loaded guard.
  const reloadSourceContent = useCallback(
    () => fetchSourceContent(false),
    [fetchSourceContent],
  );

  // Background preload source content after initial page load
  useEffect(() => {
    if (!isSourceReady && !sourceError && !isLoadingSource && !isPreloading && preloadStartedRef.current !== sourceScopeEpoch && hasOntology) {
      const timer = setTimeout(() => {
        if (preloadStartedRef.current !== sourceScopeEpoch) {
          preloadStartedRef.current = sourceScopeEpoch;
          loadSourceContent(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSourceReady, sourceError, sourceScopeEpoch, isLoadingSource, isPreloading, loadSourceContent, hasOntology]);

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

  // Reset source state (used by editor when switching branches)
  const resetSourceState = useCallback(() => {
    sourceRequestIdRef.current += 1;
    sourceScopeRef.current = {
      ...sourceScopeRef.current,
      epoch: sourceScopeRef.current.epoch + 1,
    };
    setSourceSnapshotState({ content: "", revision: null, epoch: -1 });
    setSourceLoad({ epoch: -1, loading: false, preloading: false, error: null });
    setSourceIriIndex(new Map());
    preloadStartedRef.current = null;
  }, []);

  return {
    // Project
    project,
    isLoading,
    error,
    errorKind,
    openPRCount,
    pendingSuggestionCount,
    lintSummary,
    normalizationStatus,

    // Permissions
    canManage,
    canEdit,
    canSuggest,
    isSuggester,
    isSuggestionMode,
    hasValidAccess,
    hasOntology,
    hasExplicitRole,

    // Tree
    nodes: tree.nodes,
    totalClasses: tree.totalClasses,
    isTreeLoading: tree.isLoading,
    treeError: tree.error,
    selectedIri: tree.selectedIri,
    loadRootClasses: tree.loadRootClasses,
    expandNode: tree.expandNode,
    collapseNode: tree.collapseNode,
    selectNode: tree.selectNode,
    navigateToNode: tree.navigateToNode,
    addOptimisticNode: tree.addOptimisticNode,
    removeOptimisticNode: tree.removeOptimisticNode,
    updateNodeLabel: tree.updateNodeLabel,
    collapseAll: tree.collapseAll,
    collapseOneLevel: tree.collapseOneLevel,
    expandOneLevel: tree.expandOneLevel,
    expandAllFully: tree.expandAllFully,
    hasExpandableNodes: tree.hasExpandableNodes,
    hasExpandedNodes: tree.hasExpandedNodes,
    isExpandingAll: tree.isExpandingAll,
    reparentOptimistic: tree.reparentOptimistic,
    rollbackReparent: tree.rollbackReparent,
    selectedNodeFallback,

    // Source
    isSourceReady,
    sourceScope,
    sourceContent,
    setSourceContent,
    sourceRevision,
    setSourceSnapshot,
    isLoadingSource,
    sourceError,
    isPreloading,
    loadSourceContent,
    reloadSourceContent,
    sourceIriIndex,
    setSourceIriIndex,
    isIndexing,
    resetSourceState,

    // Collaboration
    connectionStatus: collaboration.status,
    wsEndpoint: collaboration.endpoint,
    wsPurpose: collaboration.purpose,
  };
}
