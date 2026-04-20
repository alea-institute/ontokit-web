"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Globe, Lock, FolderOpen, LogIn, User } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { projectApi } from "@/lib/api/projects";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type FilterType = "public" | "private" | "mine" | "all";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [filter, setFilter] = useState<FilterType>("public");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const isAuthenticated = status === "authenticated";

  // Default authenticated users to "mine" tab
  const authDefaultApplied = useRef(false);
  useEffect(() => {
    if (!authDefaultApplied.current && status !== "loading") {
      authDefaultApplied.current = true;
      if (isAuthenticated) setFilter("mine");
    }
  }, [status, isAuthenticated]);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["projects", filter, isAuthenticated, debouncedSearch],
    queryFn: async ({ pageParam = 0 }) => {
      const filterParam = filter === "all" ? undefined : filter;
      return projectApi.list(pageParam, PAGE_SIZE, filterParam, session?.accessToken, debouncedSearch || undefined);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextSkip = lastPage.skip + lastPage.limit;
      return nextSkip < lastPage.total ? nextSkip : undefined;
    },
    enabled: status !== "loading" && !((filter === "mine" || filter === "private") && !isAuthenticated),
  });

  const projects = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages.at(-1)?.total ?? 0;
  const unfilteredTotal = data?.pages.at(-1)?.unfiltered_total ?? 0;
  const isFiltered = (!!debouncedSearch || filter !== "all") && unfilteredTotal > total;

  const [nextPageError, setNextPageError] = useState<string | null>(null);

  useEffect(() => {
    setNextPageError(null);
  }, [filter, debouncedSearch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      setNextPageError(null);
      fetchNextPage().catch((err) => {
        setNextPageError(err instanceof Error ? err.message : "Failed to load more projects");
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Projects
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isAuthenticated
                  ? "Browse public projects or manage your own"
                  : "Browse public ontology projects"}
              </p>
            </div>
            {isAuthenticated && (
              <Link href="/projects/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </Link>
            )}
          </div>

          {/* Filters and Search */}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
              {([
                { value: "mine" as const, label: "My Projects", icon: User },
                { value: "public" as const, label: "Public", icon: Globe },
                { value: "private" as const, label: "Private", icon: Lock },
                { value: "all" as const, label: "All", icon: FolderOpen },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === value
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm",
                  "placeholder:text-slate-400 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500",
                  "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
                  "sm:w-64"
                )}
              />
            </div>
          </div>

          {/* Content */}
          <div className="mt-8">
            {/* Private tab login prompt for unauthenticated users */}
            {(filter === "mine" || filter === "private") && !isAuthenticated ? (
              <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
                {filter === "private" ? (
                  <Lock className="mx-auto h-12 w-12 text-slate-400" />
                ) : (
                  <User className="mx-auto h-12 w-12 text-slate-400" />
                )}
                <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                  {filter === "private"
                    ? "Sign in to see private projects"
                    : "Sign in to see your projects"}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {filter === "private"
                    ? "View all private projects you own or are a member of"
                    : "View all projects you own or are a member of"}
                </p>
                <Button className="mt-6" onClick={() => signIn()}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </div>
            ) : isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : error && !data ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-400">{error instanceof Error ? error.message : "Failed to load projects"}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? "Retrying..." : "Try Again"}
                </Button>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
                <FolderOpen className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                  {debouncedSearch
                    ? "No projects found"
                    : (filter === "mine" || filter === "private")
                    ? "No projects yet"
                    : "No projects available"}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {debouncedSearch
                    ? "Try a different search term"
                    : (filter === "mine" || filter === "private") && isAuthenticated
                    ? "Create your first project to get started"
                    : "Check back later for public projects"}
                </p>
                {(filter === "mine" || filter === "private") && isAuthenticated && !debouncedSearch && (
                  <Link href="/projects/new" className="mt-4 inline-block">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Project
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  {debouncedSearch
                    ? `${total} ${total === 1 ? "result" : "results"} for "${debouncedSearch}"`
                    : `${total} ${total === 1 ? "project" : "projects"}`}
                  {isFiltered && (
                    <span className="text-slate-400 dark:text-slate-500">
                      {` (of ${unfilteredTotal})`}
                    </span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
                {hasNextPage && (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    {nextPageError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{nextPageError}</p>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? "Loading..." : nextPageError ? "Retry" : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
