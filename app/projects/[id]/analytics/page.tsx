"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Flame, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import {
  useProjectActivity,
  useHotEntities,
  useContributors,
} from "@/lib/hooks/useProjectAnalytics";
import { cn, getLocalName } from "@/lib/utils";

export default function ProjectAnalyticsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const token = session?.accessToken;

  const { data: activity, isLoading: loadingActivity } = useProjectActivity(
    projectId,
    token,
    30
  );
  const { data: hotEntities, isLoading: loadingHot } = useHotEntities(
    projectId,
    token,
    20
  );
  const { data: contributors, isLoading: loadingContributors } = useContributors(
    projectId,
    token,
    30
  );

  const maxDailyCount = activity
    ? Math.max(...activity.daily_counts.map((d) => d.count), 1)
    : 1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
        </div>

        <h1 className="mb-8 text-2xl font-bold text-slate-900 dark:text-white">
          Project Analytics
        </h1>

        {/* Activity Chart */}
        <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Activity (Last 30 Days)
            </h2>
            {activity && (
              <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                {activity.total_events} total edits
              </span>
            )}
          </div>

          {loadingActivity ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            </div>
          ) : activity ? (
            <div className="flex h-40 items-end gap-1">
              {activity.daily_counts.map((day) => (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="w-full rounded-t bg-primary-500 transition-colors hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-500"
                    style={{
                      height: `${Math.max((day.count / maxDailyCount) * 100, 2)}%`,
                      minHeight: day.count > 0 ? 4 : 1,
                    }}
                  />
                  <div className="pointer-events-none absolute -top-8 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-600">
                    {day.date}: {day.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No activity data available
            </p>
          )}
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Hot Entities */}
          <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Most Edited
              </h2>
            </div>

            {loadingHot ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              </div>
            ) : hotEntities && hotEntities.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {hotEntities.map((entity) => (
                  <button
                    key={entity.entity_iri}
                    onClick={() =>
                      router.push(
                        `/projects/${projectId}/editor?classIri=${encodeURIComponent(entity.entity_iri)}`
                      )
                    }
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-owl-class/10 border border-owl-class/50">
                      <span className="text-[9px] font-bold text-owl-class">
                        {entity.entity_type === "class"
                          ? "C"
                          : entity.entity_type === "property"
                            ? "P"
                            : "I"}
                      </span>
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
                      {entity.label || getLocalName(entity.entity_iri)}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {entity.edit_count} edits
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No recent edits
              </p>
            )}
          </section>

          {/* Contributors */}
          <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Contributors (30 Days)
              </h2>
            </div>

            {loadingContributors ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              </div>
            ) : contributors && contributors.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {contributors.map((contributor) => (
                  <div
                    key={contributor.user_id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                      <span className="text-xs font-medium text-primary-700 dark:text-primary-400">
                        {(contributor.user_name || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {contributor.user_name || contributor.user_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3 text-xs text-slate-500">
                      <span
                        className={cn(
                          contributor.create_count > 0 && "text-green-600 dark:text-green-400"
                        )}
                      >
                        +{contributor.create_count}
                      </span>
                      <span
                        className={cn(
                          contributor.update_count > 0 && "text-blue-600 dark:text-blue-400"
                        )}
                      >
                        ~{contributor.update_count}
                      </span>
                      <span
                        className={cn(
                          contributor.delete_count > 0 && "text-red-600 dark:text-red-400"
                        )}
                      >
                        -{contributor.delete_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No contributor data
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
