"use client";

import { FlaskConical, LogOut } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import type { Project } from "@/lib/api/projects";
import { useProject } from "@/lib/hooks/useProject";

function useCurrentProject() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  return useProject(params.id, session?.accessToken).project;
}

function DemoProjectNotice({ project }: { project: Project }) {
  const sourceHref = project.demo_source_project_id
    ? `/projects/${project.demo_source_project_id}`
    : "/";

  return (
    <aside
      aria-label="Demo workspace notice"
      className="sticky top-0 z-30 w-full shrink-0 border-y border-cyan-300/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-lg shadow-slate-950/20 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <FlaskConical
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300 sm:mt-0"
          />
          <p>
            <span className="font-semibold text-white">
              Demo workspace: {project.demo_repository_full_name ?? project.name}.
            </span>{" "}
            Changes may disappear when this project resets.
          </p>
        </div>
        <Link
          href={sourceHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-end rounded-sm px-2 font-medium text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:min-h-0 sm:self-auto sm:px-0"
        >
          Return to source <LogOut aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

export function DemoProjectShell({ children }: { children: ReactNode }) {
  const project = useCurrentProject();

  if (!project?.is_demo) return children;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <DemoProjectNotice project={project} />
      <div
        data-testid="project-route-scroll-region"
        className="min-h-0 flex-1 overflow-auto"
      >
        {children}
      </div>
    </div>
  );
}
