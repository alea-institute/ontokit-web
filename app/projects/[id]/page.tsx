"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, FileCode, Pencil, LogIn, LayoutDashboard } from "lucide-react";
import { ShareButton } from "@/components/editor/ShareButton";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ModeSwitcher } from "@/components/editor/ModeSwitcher";
import { DeveloperEditorLayout } from "@/components/editor/developer/DeveloperEditorLayout";
import { StandardEditorLayout } from "@/components/editor/standard/StandardEditorLayout";
import { BranchProvider, useBranch } from "@/lib/context/BranchContext";
import { useProjectViewer } from "@/lib/hooks/useProjectViewer";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";
import { useToast } from "@/lib/context/ToastContext";
import { useProject, derivePermissions } from "@/lib/hooks/useProject";
import type { OntologySourceEditorRef } from "@/components/editor/OntologySourceEditor";

export default function ProjectViewerPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  // Project data from shared React Query cache
  const { project, isLoading, error, errorKind } = useProject(projectId, session?.accessToken);
  const { canManage, hasOntology } = derivePermissions(project, session?.accessToken);

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
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/20">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                {error || "Project not found"}
              </h2>
              <div className="mt-4 flex items-center justify-center gap-3">
                {errorKind === "private-403" && (
                  <Button onClick={() => signIn("zitadel")} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Button>
                )}
                <Link href="/">
                  <Button variant="outline">Back to Projects</Button>
                </Link>
              </div>
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
                  href="/"
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <h1 className="font-semibold text-slate-900 dark:text-white">{project.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <ShareButton projectId={projectId} />
                <Link href={`/projects/${projectId}/dashboard`}>
                  <Button variant="ghost" size="sm" title="Project dashboard" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <LayoutDashboard className="h-4 w-4" />
                  </Button>
                </Link>
                {canManage && (
                  <Link href={`/projects/${projectId}/settings`}>
                    <Button variant="ghost" size="sm" title="Project settings" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="flex h-[calc(100vh-4rem-3.5rem)] items-center justify-center">
            <div className="text-center">
              <FileCode className="mx-auto h-16 w-16 text-slate-400" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">No Ontology File</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                This project doesn&apos;t have an ontology file yet.
              </p>
              {canManage && (
                <>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                    Import an ontology file from the project settings.
                  </p>
                  <Link href={`/projects/${projectId}/settings`} className="mt-6 inline-block">
                    <Button variant="outline">Go to Settings</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <BranchProvider projectId={projectId} accessToken={session?.accessToken}>
      <ViewerContent
        projectId={projectId}
        accessToken={session?.accessToken}
        sessionStatus={status}
      />
    </BranchProvider>
  );
}

/**
 * Inner viewer component that lives inside BranchProvider
 * so it can access the default branch via useBranch().
 */
function ViewerContent({
  projectId,
  accessToken,
  sessionStatus,
}: {
  projectId: string;
  accessToken?: string;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
}) {
  const searchParams = useSearchParams();
  const classIriParam = searchParams.get("classIri");
  const editorMode = useEditorModeStore((s) => s.editorMode);

  // Use the default branch from the BranchProvider context
  const { defaultBranch, isLoading: isBranchLoading } = useBranch();
  const resolvedBranch = isBranchLoading ? undefined : defaultBranch;

  const viewer = useProjectViewer({
    projectId,
    accessToken,
    sessionStatus,
    activeBranch: resolvedBranch,
  });

  const {
    project, canManage, canSuggest, hasValidAccess,
    nodes, totalClasses, isTreeLoading, treeError,
    selectedIri, expandNode, collapseNode, selectNode,
    navigateToNode, collapseAll, collapseOneLevel, expandOneLevel, expandAllFully,
    hasExpandableNodes, hasExpandedNodes, isExpandingAll,
    selectedNodeFallback,
    sourceContent, setSourceContent, isLoadingSource, sourceError, isPreloading,
    loadSourceContent, sourceIriIndex,
    connectionStatus, wsEndpoint, wsPurpose,
  } = viewer;

  const sourceEditorRef = useRef<OntologySourceEditorRef>(null);
  const [pendingScrollIri, setPendingScrollIri] = useState<string | null>(null);

  // Navigate to classIri from URL query param once tree is ready
  useEffect(() => {
    if (!classIriParam || isTreeLoading || !nodes.length) return;
    if (selectedIri === classIriParam) return;
    navigateToNode(classIriParam);
  }, [classIriParam, isTreeLoading, nodes.length, selectedIri, navigateToNode]);

  const toast = useToast();
  const handleCopyIri = useCallback(async (iri: string) => {
    try {
      await navigator.clipboard.writeText(iri);
      toast.success("IRI copied to clipboard");
    } catch {
      toast.error("Failed to copy IRI");
    }
  }, [toast]);
  const noop = () => {};

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
        {/* Viewer Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="font-semibold text-slate-900 dark:text-white">{project?.name}</h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">{totalClasses} classes</span>
              <ModeSwitcher />
            </div>
            <div className="flex items-center gap-2">
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

              {/* Share */}
              <ShareButton
                projectId={projectId}
                selectedIri={selectedIri}
                selectedLabel={selectedNodeFallback?.label}
              />

              {/* Dashboard link */}
              <Link href={`/projects/${projectId}/dashboard`}>
                <Button variant="ghost" size="sm" title="Project dashboard" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                  <LayoutDashboard className="h-4 w-4" />
                </Button>
              </Link>

              {/* Open Editor / Sign In */}
              {canSuggest ? (
                <Link href={`/projects/${projectId}/editor${selectedIri ? `?classIri=${encodeURIComponent(selectedIri)}` : ''}`}>
                  <Button size="sm" className="gap-2">
                    <Pencil className="h-4 w-4" />
                    <span className="hidden sm:inline">Open Editor</span>
                  </Button>
                </Link>
              ) : !hasValidAccess ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signIn("zitadel")}
                  className="gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30"
                >
                  <LogIn className="h-3 w-3" />
                  Sign in to edit
                </Button>
              ) : null}

              {canManage && (
                <Link href={`/projects/${projectId}/settings`}>
                  <Button variant="ghost" size="sm" title="Project settings" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main Viewer Layout — mode-dependent, fully read-only */}
        <div className="relative flex h-[calc(100vh-4rem-3.5rem)]">
          <div className="flex-1 flex overflow-hidden">
            {editorMode === "developer" ? (
              <div className="flex-1 flex flex-col">
                <DeveloperEditorLayout
                  projectId={projectId}
                  accessToken={accessToken}
                  activeBranch={resolvedBranch}
                  canEdit={false}
                  canSuggest={false}
                  isSuggestionMode={false}
                  canManage={false}
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
                  onSaveSource={async () => {}}
                  onAddEntity={noop}
                  onCopyIri={handleCopyIri}
                  selectedNodeFallback={selectedNodeFallback}
                  detailRefreshKey={0}
                  showHealthCheck={false}
                  onCloseHealthCheck={noop}
                />
              </div>
            ) : (
              <StandardEditorLayout
                projectId={projectId}
                accessToken={accessToken}
                activeBranch={resolvedBranch}
                canEdit={false}
                canSuggest={false}
                isSuggestionMode={false}
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
                onAddEntity={noop}
                onCopyIri={handleCopyIri}
                selectedNodeFallback={selectedNodeFallback}
                sourceContent={sourceContent}
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
