"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Settings, Search, FileCode, GitPullRequest, Activity, TreePine, Code, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel } from "@/components/editor/ClassDetailPanel";
import { HealthCheckPanel } from "@/components/editor/HealthCheckPanel";
import { CommitMessageDialog } from "@/components/editor/CommitMessageDialog";
import { BranchSelector, BranchBadge, RevisionHistoryPanel, HistoryButton } from "@/components/revision";
import { BranchProvider } from "@/lib/context/BranchContext";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { useCollaborationStatus } from "@/lib/hooks/useCollaborationStatus";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { projectApi, type Project } from "@/lib/api/projects";
import { pullRequestsApi } from "@/lib/api/pullRequests";
import { lintApi, type LintSummary } from "@/lib/api/lint";
import { revisionsApi } from "@/lib/api/revisions";
import { projectOntologyApi } from "@/lib/api/client";
import { normalizationApi, type NormalizationStatusResponse } from "@/lib/api/normalization";

// Import the ref type and IRI position type
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";
import type { IriPosition } from "@/lib/editor/indexWorker";

// Dynamically import the source editor to avoid SSR issues with Monaco
const OntologySourceEditor = dynamic(
  () => import("@/components/editor/OntologySourceEditor").then((mod) => mod.OntologySourceEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-white dark:bg-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    ),
  }
);

type EditorView = "tree" | "source";

export default function EditorPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = params.id as string;
  const initialBranch = searchParams.get("branch")
    || (() => { try { return sessionStorage.getItem(`axigraph:branch:${projectId}`); } catch { return null; } })()
    || undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [openPRCount, setOpenPRCount] = useState(0);
  const [lintSummary, setLintSummary] = useState<LintSummary | null>(null);
  const [normalizationStatus, setNormalizationStatus] = useState<NormalizationStatusResponse | null>(null);

  // Track current branch so editor data reloads on switch
  const [activeBranch, setActiveBranch] = useState<string | undefined>(undefined);

  // View mode state
  const [viewMode, setViewMode] = useState<EditorView>("tree");
  const [sourceContent, setSourceContent] = useState<string>("");
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const preloadStartedRef = useRef(false);
  const sourceEditorRef = useRef<OntologySourceEditorRef>(null);

  // Background IRI indexing for "View in Source" feature
  const [sourceIriIndex, setSourceIriIndex] = useState<Map<string, IriPosition>>(new Map());
  const [isIndexing, setIsIndexing] = useState(false);

  // Commit dialog state
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [pendingSaveContent, setPendingSaveContent] = useState<string | null>(null);

  // Ontology tree state
  const {
    nodes,
    totalClasses,
    isLoading: isTreeLoading,
    error: treeError,
    selectedIri,
    expandNode,
    collapseNode,
    selectNode,
    navigateToNode,
  } = useOntologyTree({
    projectId,
    accessToken: session?.accessToken,
    branchKey: activeBranch,
  });

  // Track WebSocket connection status (uses lint WebSocket endpoint)
  const {
    status: connectionStatus,
    endpoint: wsEndpoint,
    purpose: wsPurpose,
  } = useCollaborationStatus({
    projectId,
    enabled: !!projectId && status !== "loading",
  });

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await projectApi.get(projectId, session?.accessToken);
        setProject(data);

        // Fetch open PR count
        try {
          const prResponse = await pullRequestsApi.list(
            projectId,
            session?.accessToken,
            "open",
            undefined,
            0,
            1
          );
          setOpenPRCount(prResponse.total);
        } catch {
          // Ignore PR count errors
        }

        // Fetch lint summary
        try {
          const summary = await lintApi.getStatus(projectId, session?.accessToken);
          setLintSummary(summary);
        } catch {
          // Ignore lint errors
        }

        // Fetch normalization status
        if (data.source_file_path) {
          try {
            const normStatus = await normalizationApi.getStatus(projectId, session?.accessToken);
            setNormalizationStatus(normStatus);
          } catch {
            // Ignore normalization status errors
          }
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
  const canEdit = project?.user_role === "owner" || project?.user_role === "admin" || project?.user_role === "editor";
  const hasOntology = project?.source_file_path;

  // Load source content (can be called for preloading or immediate loading)
  const loadSourceContent = useCallback(async (isPreload = false) => {
    if (!projectId || !session?.accessToken) return;
    if (sourceContent) return; // Already loaded

    if (isPreload) {
      setIsPreloading(true);
    } else {
      setIsLoadingSource(true);
    }
    setSourceError(null);

    try {
      const response = await revisionsApi.getFileAtVersion(
        projectId,
        activeBranch || "HEAD",
        session.accessToken
      );
      setSourceContent(response.content);
    } catch (err) {
      console.error("Failed to load source:", err);
      if (!isPreload) {
        setSourceError(
          err instanceof Error ? err.message : "Failed to load source content"
        );
      }
    } finally {
      if (isPreload) {
        setIsPreloading(false);
      } else {
        setIsLoadingSource(false);
      }
    }
  }, [projectId, session?.accessToken, sourceContent, activeBranch]);

  // Refs to handle the save promise
  const pendingSaveResolveRef = useRef<(() => void) | null>(null);
  const pendingSaveRejectRef = useRef<((error: Error) => void) | null>(null);

  // Handle saving source content - opens the commit dialog
  const handleSaveSource = useCallback(async (newContent: string) => {
    if (!projectId || !session?.accessToken) {
      throw new Error("Not authenticated");
    }

    // Store the content and open the dialog
    setPendingSaveContent(newContent);
    setCommitDialogOpen(true);

    // Return a promise that will be resolved/rejected when dialog closes
    // The actual save happens in handleCommitConfirm
    return new Promise<void>((resolve, reject) => {
      // Store resolve/reject in refs so the dialog can use them
      pendingSaveResolveRef.current = resolve;
      pendingSaveRejectRef.current = reject;
    });
  }, [projectId, session?.accessToken]);

  // Handle commit dialog confirmation
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

    // Update the local source content
    setSourceContent(pendingSaveContent);

    // Reset the IRI index so it gets rebuilt
    setSourceIriIndex(new Map());

    // Resolve the pending save promise
    pendingSaveResolveRef.current?.();
    pendingSaveResolveRef.current = null;
    pendingSaveRejectRef.current = null;
    setPendingSaveContent(null);
  }, [projectId, session?.accessToken, pendingSaveContent, activeBranch]);

  // Handle commit dialog cancel
  const handleCommitDialogClose = useCallback((open: boolean) => {
    setCommitDialogOpen(open);
    if (!open && pendingSaveContent) {
      // Dialog was closed without saving - reject the promise
      pendingSaveRejectRef.current?.(new Error("Save cancelled"));
      pendingSaveResolveRef.current = null;
      pendingSaveRejectRef.current = null;
      setPendingSaveContent(null);
    }
  }, [pendingSaveContent]);

  // Preload source content when hovering over Source tab
  const handleSourceTabHover = useCallback(() => {
    if (!sourceContent && !isLoadingSource && !isPreloading && !preloadStartedRef.current) {
      preloadStartedRef.current = true;
      loadSourceContent(true);
    }
  }, [sourceContent, isLoadingSource, isPreloading, loadSourceContent]);

  // Background preload source content after initial page load (with delay to prioritize tree)
  useEffect(() => {
    if (!sourceContent && !isLoadingSource && !isPreloading && !preloadStartedRef.current && hasOntology) {
      const timer = setTimeout(() => {
        if (!preloadStartedRef.current) {
          preloadStartedRef.current = true;
          loadSourceContent(true);
        }
      }, 2000); // Start preloading after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [sourceContent, isLoadingSource, isPreloading, loadSourceContent, hasOntology]);

  // Load source when switching to source view (if not already loaded/loading)
  useEffect(() => {
    if (viewMode === "source" && !sourceContent && !isLoadingSource && !isPreloading) {
      loadSourceContent(false);
    }
  }, [viewMode, sourceContent, isLoadingSource, isPreloading, loadSourceContent]);

  // Build IRI index in background when source content is available
  // This enables instant "View in Source" navigation
  // Using main thread with chunked processing to avoid blocking UI
  useEffect(() => {
    if (!sourceContent || sourceIriIndex.size > 0 || isIndexing) return;

    setIsIndexing(true);

    // Run indexing in chunks to avoid blocking UI
    const buildIriIndexAsync = async (content: string): Promise<Map<string, IriPosition>> => {
      const index = new Map<string, IriPosition>();
      const lines = content.split("\n");

      // Extract prefixes first
      const prefixes = new Map<string, string>();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prefixMatch = line.match(/@?prefix\s+(\w*):\s*<([^>]+)>/i);
        if (prefixMatch) {
          prefixes.set(prefixMatch[1], prefixMatch[2]);
        }
      }

      // Index IRIs in subject position, processing in chunks
      // A subject starts a new triple block - it's NOT a continuation of a previous line
      // Lines ending with , or ; indicate the next line is a continuation (object or predicate-object)
      const chunkSize = 5000;
      for (let start = 0; start < lines.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, lines.length);

        for (let i = start; i < end; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Skip comments, empty lines, and prefix declarations
          if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("@") || trimmed.toUpperCase().startsWith("PREFIX")) continue;

          // Check if previous non-empty line ends with , or ; (meaning this is a continuation)
          let isContinuation = false;
          for (let j = i - 1; j >= 0; j--) {
            const prevTrimmed = lines[j].trim();
            if (!prevTrimmed || prevTrimmed.startsWith("#")) continue; // Skip empty/comment lines
            // If previous line ends with , or ; this is a continuation
            if (prevTrimmed.endsWith(",") || prevTrimmed.endsWith(";")) {
              isContinuation = true;
            }
            break; // Only check the immediately preceding non-empty line
          }

          if (isContinuation) continue; // Skip - this is not a subject

          // Match full IRI at start of line: <...>
          const fullIriMatch = trimmed.match(/^<([^>\s]+)>/);
          if (fullIriMatch) {
            const iri = fullIriMatch[1];
            if (!index.has(iri)) {
              const col = line.indexOf('<') + 1;
              index.set(iri, { line: i + 1, col, len: fullIriMatch[0].length });
            }
          }

          // Match prefixed name at start of line: prefix:local or :local
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

        // Yield to UI every chunk
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

  // Handle branch change — reset all branch-dependent state and update URL
  const handleBranchChange = useCallback((branchName: string) => {
    setActiveBranch(branchName);
    // Reset source content so it reloads from the new branch
    setSourceContent("");
    setSourceError(null);
    setSourceIriIndex(new Map());
    preloadStartedRef.current = false;
    // Update URL to reflect the current branch
    router.replace(`${pathname}?branch=${encodeURIComponent(branchName)}`);
  }, [pathname, router]);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: EditorView) => {
    setViewMode(mode);
    // Close side panels when switching to source view
    if (mode === "source") {
      setShowHistory(false);
      setShowHealthCheck(false);
    }
  }, []);

  // Pending scroll IRI - set when navigating to source before editor is ready
  const [pendingScrollIri, setPendingScrollIri] = useState<string | null>(null);

  // Find IRI position in the pre-built index
  const findIriInIndex = useCallback((iri: string): IriPosition | null => {
    // Try exact match
    let pos = sourceIriIndex.get(iri);
    if (pos) return pos;

    // Try without trailing slash/hash
    const normalized = iri.replace(/[/#]$/, '');
    pos = sourceIriIndex.get(normalized);
    if (pos) return pos;

    // Try matching by local name
    const localName = iri.includes('#')
      ? iri.split('#').pop()
      : iri.split('/').pop();
    if (localName) {
      for (const [indexedIri, indexedPos] of sourceIriIndex) {
        const indexedLocal = indexedIri.includes('#')
          ? indexedIri.split('#').pop()
          : indexedIri.split('/').pop();
        if (indexedLocal === localName) {
          return indexedPos;
        }
      }
    }

    return null;
  }, [sourceIriIndex]);

  // Handle navigation to an IRI in the source view
  const handleNavigateToSource = useCallback((iri: string) => {
    // Switch to source view
    setViewMode("source");
    setShowHistory(false);
    setShowHealthCheck(false);

    // Store the IRI to scroll to - the editor will use this when ready
    setPendingScrollIri(iri);

    // If editor is already mounted and index is ready, scroll immediately
    if (sourceEditorRef.current && sourceIriIndex.size > 0) {
      sourceEditorRef.current.scrollToIri(iri);
    }
  }, [sourceIriIndex, findIriInIndex]);

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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

  // Show message if project doesn't have an ontology file
  if (!hasOntology) {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
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
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  {project.name}
                </h1>
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

          {/* No Ontology Message */}
          <div className="flex h-[calc(100vh-4rem-3.5rem)] items-center justify-center">
            <div className="text-center">
              <FileCode className="mx-auto h-16 w-16 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
                No Ontology File
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                This project doesn't have an ontology file yet.
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
      <main className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
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
              <h1 className="font-semibold text-slate-900 dark:text-white">
                {project.name}
              </h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {totalClasses} classes
              </span>
              <BranchBadge />

              {/* View Mode Tabs */}
              <div className="ml-4 flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  onClick={() => handleViewModeChange("tree")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "tree"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <TreePine className="h-4 w-4" />
                  <span className="hidden sm:inline">Tree</span>
                </button>
                <button
                  onClick={() => handleViewModeChange("source")}
                  onMouseEnter={handleSourceTabHover}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === "source"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Code className="h-4 w-4" />
                  <span className="hidden sm:inline">Source</span>
                  {isPreloading && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* WebSocket Connection Status Indicators */}
              <div className="flex items-center gap-1">
                {/* Collaboration WebSocket (not yet implemented) */}
                <ConnectionStatus
                  state="disabled"
                  purpose="Real-time collaboration (coming soon)"
                  endpoint="/api/v1/collab/ws"
                />
                {/* Lint WebSocket */}
                <ConnectionStatus
                  state={connectionStatus}
                  purpose={wsPurpose}
                  endpoint={wsEndpoint}
                />
              </div>

              {/* Branch Selector */}
              <BranchSelector onBranchChange={handleBranchChange} />

              {/* History Button */}
              <HistoryButton
                onClick={() => setShowHistory(!showHistory)}
                isOpen={showHistory}
              />

              {/* Normalization Status Indicator */}
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

              {/* Health Check Button */}
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

        {/* Main Editor Layout */}
        <div className="relative flex h-[calc(100vh-4rem-3.5rem)]">
          {viewMode === "tree" ? (
            <>
              {/* Left Panel - Class Tree */}
              <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                {/* Tree Header */}
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Class Hierarchy
                    </h2>
                    <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <Search className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* Tree Content */}
                <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
                  {isTreeLoading && nodes.length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                    </div>
                  ) : treeError ? (
                    <div className="p-4">
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/50 dark:bg-red-900/20">
                        <p className="text-sm text-red-700 dark:text-red-400">{treeError}</p>
                      </div>
                    </div>
                  ) : nodes.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No classes found in this ontology
                      </p>
                    </div>
                  ) : (
                    <ClassTree
                      nodes={nodes}
                      selectedIri={selectedIri}
                      onSelect={selectNode}
                      onExpand={expandNode}
                      onCollapse={collapseNode}
                    />
                  )}
                </div>
              </div>

              {/* Center Panel - Class Details */}
              <div className="flex-1 bg-white dark:bg-slate-800">
                <ClassDetailPanel
                  projectId={projectId}
                  classIri={selectedIri}
                  accessToken={session?.accessToken}
                  branch={activeBranch}
                  onNavigateToClass={navigateToNode}
                  onNavigateToSource={handleNavigateToSource}
                />
              </div>

              {/* Right Panel - Health Check (slide-out) */}
              {showHealthCheck && (
                <div className="w-96 flex-shrink-0">
                  <HealthCheckPanel
                    projectId={projectId}
                    accessToken={session?.accessToken}
                    isOpen={showHealthCheck}
                    onClose={() => setShowHealthCheck(false)}
                    onNavigateToClass={navigateToNode}
                  />
                </div>
              )}
            </>
          ) : (
            /* Source View */
            <div className="flex-1 bg-white dark:bg-slate-800">
              {isLoadingSource ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      Loading source...
                    </p>
                  </div>
                </div>
              ) : sourceError ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileCode className="mx-auto h-12 w-12 text-red-400" />
                    <h3 className="mt-4 text-lg font-medium text-red-700 dark:text-red-400">
                      Failed to load source
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {sourceError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSourceContent(false)}
                      className="mt-4"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : (
                <OntologySourceEditor
                  ref={sourceEditorRef}
                  projectId={projectId}
                  initialValue={sourceContent}
                  accessToken={session?.accessToken}
                  readOnly={!canEdit}
                  onSave={handleSaveSource}
                  onNavigateToClass={async (iri) => {
                    // Switch to tree view and try to navigate to class
                    setViewMode("tree");
                    try {
                      await navigateToNode(iri);
                    } catch (err) {
                      // The entity might not be a class (could be an individual, property, etc.)
                      // Just select it - the detail panel will show appropriate info or error
                      console.log(`Could not navigate to ${iri} - may not be a class`);
                    }
                  }}
                  height="100%"
                  prebuiltIriIndex={sourceIriIndex}
                  pendingScrollIri={pendingScrollIri}
                  onScrollComplete={() => setPendingScrollIri(null)}
                />
              )}
            </div>
          )}

          {/* Right Panel - Revision History (slide-out, available in both views) */}
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
    </BranchProvider>
  );
}
