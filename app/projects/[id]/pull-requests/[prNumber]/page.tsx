"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitPullRequest } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { PRDetail } from "@/components/pr/PRDetail";
import { projectApi, type Project } from "@/lib/api/projects";

export default function PullRequestDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;
  const prNumber = parseInt(params.prNumber as string, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              {project.name}
            </Link>
            <span>/</span>
            <Link
              href={`/projects/${projectId}/pull-requests`}
              className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <GitPullRequest className="h-4 w-4" />
              Pull Requests
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-slate-100">
              #{prNumber}
            </span>
          </div>

          {/* PR Detail */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <PRDetail
              projectId={projectId}
              prNumber={prNumber}
              accessToken={session?.accessToken}
              userRole={project.user_role}
              currentUserId={session?.user?.id}
            />
          </div>
        </div>
      </main>
    </>
  );
}
