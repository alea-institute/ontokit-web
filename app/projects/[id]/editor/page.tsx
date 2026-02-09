"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, Search, FileCode } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ClassTree } from "@/components/editor/ClassTree";
import { ClassDetailPanel } from "@/components/editor/ClassDetailPanel";
import { useOntologyTree } from "@/lib/hooks/useOntologyTree";
import { projectApi, type Project } from "@/lib/api/projects";

export default function EditorPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  } = useOntologyTree({
    projectId,
    accessToken: session?.accessToken,
  });

  useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await projectApi.get(projectId, session?.accessToken);
        setProject(data);
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

  const canManage = project?.user_role === "owner" || project?.user_role === "admin";
  const hasOntology = project?.source_file_path;

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
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {totalClasses} classes
              </span>
            </div>
            <div className="flex items-center gap-2">
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
        <div className="flex h-[calc(100vh-4rem-3.5rem)]">
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

          {/* Right Panel - Class Details */}
          <div className="flex-1 bg-white dark:bg-slate-800">
            <ClassDetailPanel
              projectId={projectId}
              classIri={selectedIri}
              accessToken={session?.accessToken}
              onNavigateToClass={selectNode}
            />
          </div>
        </div>
      </main>
    </>
  );
}
