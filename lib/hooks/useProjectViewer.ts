import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { useCollaborationStatus } from "@/lib/hooks/useCollaborationStatus";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import { pullRequestsApi } from "@/lib/api/pullRequests";
import { lintApi, type LintSummary } from "@/lib/api/lint";
import { normalizationApi, type NormalizationStatusResponse } from "@/lib/api/normalization";
import { revisionsApi } from "@/lib/api/revisions";
import { suggestionsApi } from "@/lib/api/suggestions";
import type { TreeNodeFallback } from "@/components/editor/ClassDetailPanel";
import type { IriPosition } from "@/lib/editor/indexWorker";

export interface UseProjectViewerOptions {
  projectId: string;
  accessToken?: string;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  activeBranch?: string;
}

export function useProjectViewer({
  projectId,
  accessToken,
  sessionStatus,
  activeBranch,
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

  // Secondary data state
  const [openPRCount, setOpenPRCount] = useState(0);
  const [pendingSuggestionCount, setPendingSuggestionCount] = useState(0);
  const [lintSummary, setLintSummary] = useState<LintSummary | null>(null);
  const [normalizationStatus, setNormalizationStatus] = useState<NormalizationStatusResponse | null>(null);

  // Source state
  const [sourceContent, setSourceContent] = useState<string>("");
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadStartedRef = useRef(false);

  // IRI indexing
  const [sourceIriIndex, setSourceIriIndex] = useState<Map<string, IriPosition>>(new Map());
  const [isIndexing, setIsIndexing] = useState(false);

  // Ontology tree
  const tree = useOntologyTree({
    projectId,
    accessToken,
    branchKey: activeBranch,
  });

  // WebSocket connection status
  const collaboration = useCollaborationStatus({
    projectId,
    enabled: !!projectId && sessionStatus !== "loading",
  });

  // Fetch secondary data once project is loaded
  useEffect(() => {
    if (!project) return;
    pullRequestsApi.list(projectId, accessToken, "open", undefined, 0, 1)
      .then((res) => setOpenPRCount(res.total))
      .catch(() => { /* ignore */ });
    lintApi.getStatus(projectId, accessToken)
      .then((summary) => setLintSummary(summary))
      .catch(() => { /* ignore */ });
    if (project.source_file_path) {
      normalizationApi.getStatus(projectId, accessToken)
        .then((status) => setNormalizationStatus(status))
        .catch(() => { /* ignore */ });
    }
  }, [project, projectId, accessToken]);

  // Fetch pending suggestion count for editors/admins
  useEffect(() => {
    if (!canEdit || !accessToken) return;
    suggestionsApi
      .listPending(projectId, accessToken)
      .then((res) => setPendingSuggestionCount(res.items.length))
      .catch(() => { /* ignore — endpoint may not exist yet */ });
  }, [canEdit, projectId, accessToken]);

  // Derive fallback data for the selected node from the tree
  const selectedNodeFallback = useMemo((): TreeNodeFallback | null => {
    if (!tree.selectedIri) return null;
    const findInTree = (
      items: typeof tree.nodes,
      parentIri?: string,
      parentLabel?: string,
    ): TreeNodeFallback | null => {
      for (const node of items) {
        if (node.iri === tree.selectedIri) {
          return { iri: node.iri, label: node.label || "", parentIri, parentLabel };
        }
        const found = findInTree(node.children, node.iri, node.label);
        if (found) return found;
      }
      return null;
    };
    return findInTree(tree.nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.selectedIri, tree.nodes]);

  // Load source content
  const loadSourceContent = useCallback(async (isPreload = false) => {
    if (!projectId || !activeBranch) return;
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
        accessToken,
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
  }, [projectId, accessToken, sourceContent, activeBranch, project?.git_ontology_path]);

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

  // Reset source state (used by editor when switching branches)
  const resetSourceState = useCallback(() => {
    setSourceContent("");
    setSourceError(null);
    setSourceIriIndex(new Map());
    preloadStartedRef.current = false;
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
    sourceContent,
    setSourceContent,
    isLoadingSource,
    sourceError,
    isPreloading,
    loadSourceContent,
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
