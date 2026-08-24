"use client";

import { FlaskConical, LogOut } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useProject } from "@/lib/hooks/useProject";

export function DemoProjectBanner() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { project } = useProject(params.id, session?.accessToken);

  if (!project?.is_demo) return null;

  const sourceHref = project.demo_source_project_id
    ? `/projects/${project.demo_source_project_id}`
    : "/";

  return (
    <aside
      aria-label="Demo workspace notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-cyan-300/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-2xl shadow-slate-950/30 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300 sm:mt-0" />
        <p>
          <span className="font-semibold text-white">
            Demo workspace: {project.demo_repository_full_name ?? project.name}.
          </span>{" "}
          Changes may disappear when this project resets.
        </p>
      </div>
      <Link
        href={sourceHref}
        className="inline-flex shrink-0 items-center gap-1.5 self-end font-medium text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:self-auto"
      >
        Return to source <LogOut className="h-4 w-4" />
      </Link>
    </aside>
  );
}
