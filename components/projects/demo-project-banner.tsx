"use client";

import { FlaskConical, LogOut } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import type { Project } from "@/lib/api/projects";
import { getRetiredFrom, useProject } from "@/lib/hooks/useProject";
import { isProjectUuid } from "@/lib/api/client";
import { RetiredDemoNotice } from "@/components/projects/retired-demo-notice";

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
  const { id: projectId } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { project, retiredRedirect } = useProject(projectId, session?.accessToken);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lastReplacement = useRef<string | null>(null);
  const queryString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const chain = getRetiredFrom(params, projectId);
    const target = retiredRedirect?.current_project_id.toLowerCase();
    if (target && target !== projectId.toLowerCase() && !chain.includes(target)) {
      const nextParams = new URLSearchParams();
      for (const key of ["classIri", "branch"]) {
        const value = params.get(key);
        if (value !== null) nextParams.set(key, value);
      }
      if (isProjectUuid(projectId)) chain.push(projectId.toLowerCase());
      nextParams.set("retired_from", chain.join(","));
      const subPath = pathname.slice(`/projects/${projectId}`.length);
      const nextUrl = `/projects/${target}${subPath}?${nextParams}`;
      if (lastReplacement.current !== nextUrl) {
        lastReplacement.current = nextUrl;
        router.replace(nextUrl);
      }
      return;
    }
    lastReplacement.current = null;

    // Strip invalid flags without a route transition or a new project fetch.
    const rawChain = params.getAll("retired_from");
    if (rawChain.length && (!chain.length || rawChain.length !== 1 || rawChain[0] !== chain.join(","))) {
      params.delete("retired_from");
      if (chain.length) params.set("retired_from", chain.join(","));
      const query = params.toString();
      window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, [pathname, projectId, queryString, retiredRedirect, router]);

  if (!project?.is_demo) return children;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <RetiredDemoNotice projectId={projectId} />
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
