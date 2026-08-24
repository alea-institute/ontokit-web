"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FlaskConical, Network, PencilLine, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { projectApi, type Project } from "@/lib/api/projects";

const DEMO_ENTRY_LIMIT = 2;

export interface DemoLoadResult {
  projects: Project[];
  unavailable: boolean;
}

export interface DemoLookupResult {
  project: Project | null;
  unavailable: boolean;
}

export async function loadDemoProjects(): Promise<DemoLoadResult> {
  try {
    const page = await projectApi.list(0, DEMO_ENTRY_LIMIT, "public", undefined, undefined, {
      isDemo: true,
    });
    const demos = page.items
      .filter((project) => project.is_demo)
      .slice(0, DEMO_ENTRY_LIMIT);

    return {
      projects: demos.sort((left, right) => left.name.localeCompare(right.name)),
      unavailable: false,
    };
  } catch {
    return { projects: [], unavailable: true };
  }
}

export async function loadDemoProjectForSource(
  sourceProjectId: string,
): Promise<DemoLookupResult> {
  try {
    const page = await projectApi.list(0, 1, "public", undefined, undefined, {
      isDemo: true,
      demoSourceProjectId: sourceProjectId,
    });
    const project = page.items.find(
      (candidate) =>
        candidate.is_demo && candidate.demo_source_project_id === sourceProjectId,
    );
    return { project: project ?? null, unavailable: false };
  } catch {
    return { project: null, unavailable: true };
  }
}

export function DemoProjectEntry() {
  const query = useQuery({
    queryKey: ["demo-projects"],
    queryFn: loadDemoProjects,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section
      aria-labelledby="demo-lab-title"
      className="relative mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 px-5 py-5 text-white shadow-lg shadow-slate-950/10 sm:px-6"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25">
        <svg className="h-full w-full" viewBox="0 0 900 220" preserveAspectRatio="none">
          <path d="M40 165 L210 70 L400 145 L590 55 L840 130" fill="none" stroke="currentColor" strokeWidth="1" className="text-cyan-300" />
          <path d="M210 70 L300 20 M400 145 L500 205 M590 55 L720 20" fill="none" stroke="currentColor" strokeWidth="1" className="text-indigo-300" />
          {["40,165", "210,70", "300,20", "400,145", "500,205", "590,55", "720,20", "840,130"].map((point) => {
            const [cx, cy] = point.split(",");
            return <circle key={point} cx={cx} cy={cy} r="5" fill="currentColor" className="text-cyan-200" />;
          })}
        </svg>
      </div>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,1.15fr)] lg:items-center">
        <div>
          <div className="flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            <FlaskConical className="h-4 w-4" />
            Resettable workspace
          </div>
          <h2 id="demo-lab-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            Change the ontology. Nothing permanent breaks.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Explore a real ontology or open the editor and propose changes. Demo branches reset regularly, so treat them as a lab bench—not a place to keep work.
          </p>
        </div>

        <div aria-live="polite">
          {query.isLoading ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-5 text-sm text-slate-300">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-cyan-300" />
              Checking the demo workspaces…
            </div>
          ) : query.data?.unavailable ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="font-medium text-amber-100">Demo workspaces are temporarily unavailable.</p>
              <p className="mt-1 text-sm text-amber-100/75">Public projects still work normally.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-amber-200/40 bg-transparent text-amber-50 hover:bg-amber-100/10"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                {query.isFetching ? "Trying again…" : "Try again"}
              </Button>
            </div>
          ) : query.data?.projects.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {query.data.projects.map((project) => (
                <div key={project.id} className="rounded-xl border border-slate-700 bg-slate-900/90 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-cyan-300" />
                    <h3 className="truncate font-medium">{project.name}</h3>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
                      Explore <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <span aria-hidden="true" className="text-slate-600">/</span>
                    <Link href={`/projects/${project.id}/editor`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">
                      Try editing <PencilLine className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Demo workspaces are being prepared.</p>
              <p className="mt-1">Browse the public projects below in the meantime.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function DemoProjectLink({ sourceProjectId }: { sourceProjectId: string }) {
  const query = useQuery({
    queryKey: ["demo-project", "source", sourceProjectId],
    queryFn: () => loadDemoProjectForSource(sourceProjectId),
    staleTime: 5 * 60 * 1000,
  });
  const demo = query.data?.project;

  if (!demo) return null;

  return (
    <Link
      href={`/projects/${demo.id}`}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-transparent px-3 text-sm font-medium transition-colors hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
    >
      <FlaskConical className="h-4 w-4" />
      Try demo
    </Link>
  );
}
