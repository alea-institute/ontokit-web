"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import { userSettingsApi, type GitHubRepoInfo } from "@/lib/api/userSettings";
import { cn } from "@/lib/utils";

interface GitHubRepoPickerProps {
  onSelect: (repo: GitHubRepoInfo) => void;
}

export function GitHubRepoPicker({ onSelect }: GitHubRepoPickerProps) {
  const { data: session } = useSession();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<GitHubRepoInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if user has a GitHub token
  useEffect(() => {
    if (!session?.accessToken) return;
    userSettingsApi
      .getGitHubTokenStatus(session.accessToken)
      .then((status) => setHasToken(status.has_token))
      .catch(() => setHasToken(false));
  }, [session?.accessToken]);

  // Load initial repos
  useEffect(() => {
    if (!session?.accessToken || !hasToken) return;
    setIsLoading(true);
    userSettingsApi
      .listGitHubRepos(session.accessToken, undefined, 1, 20)
      .then((result) => setRepos(result.items))
      .catch(() => setRepos([]))
      .finally(() => setIsLoading(false));
  }, [session?.accessToken, hasToken]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedRepo(null);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (!session?.accessToken) return;
      setIsLoading(true);
      try {
        const result = await userSettingsApi.listGitHubRepos(
          session.accessToken,
          query || undefined,
          1,
          20
        );
        setRepos(result.items);
      } catch {
        setRepos([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleSelect = (repo: GitHubRepoInfo) => {
    setSelectedRepo(repo);
    onSelect(repo);
  };

  if (hasToken === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (hasToken === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/50 dark:bg-amber-900/20">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Connect your GitHub account first to clone repositories.
        </p>
        <Link
          href="/settings"
          className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Search repositories
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name..."
            className={cn(
              "w-full rounded-md border py-2 pl-9 pr-3 text-sm",
              "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
              "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            )}
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : repos.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {searchQuery ? "No repositories found" : "No repositories available"}
          </p>
        ) : (
          repos.map((repo) => (
            <button
              key={repo.full_name}
              type="button"
              onClick={() => handleSelect(repo)}
              className={cn(
                "w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 dark:border-slate-700",
                "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                selectedRepo?.full_name === repo.full_name &&
                  "bg-primary-50 dark:bg-primary-900/20"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {repo.full_name}
                    {repo.private && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        Private
                      </span>
                    )}
                  </p>
                  {repo.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                      {repo.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    Default branch: {repo.default_branch}
                  </p>
                </div>
                {selectedRepo?.full_name === repo.full_name && (
                  <Check className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
