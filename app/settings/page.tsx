"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Github, Trash2, Check, AlertCircle, LayoutGrid, Code, Sun, Moon, Monitor } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  userSettingsApi,
  type GitHubTokenStatus,
  type GitHubTokenResponse,
} from "@/lib/api/userSettings";
import { cn } from "@/lib/utils";
import {
  useEditorModeStore,
  type EditorMode,
  type ThemePreference,
} from "@/lib/stores/editorModeStore";

export default function UserSettingsPage() {
  const { data: session, status } = useSession();

  const [tokenStatus, setTokenStatus] = useState<GitHubTokenStatus | null>(null);
  const [tokenDetail, setTokenDetail] = useState<GitHubTokenResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // PAT input
  const [patInput, setPatInput] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isDeletingToken, setIsDeletingToken] = useState(false);

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const fetchTokenStatus = async () => {
      if (!session?.accessToken) return;
      setIsLoading(true);
      try {
        const result = await userSettingsApi.getGitHubTokenStatus(session.accessToken);
        setTokenStatus(result);
      } catch {
        // No token yet is fine
        setTokenStatus({ has_token: false });
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && isAuthenticated) {
      fetchTokenStatus();
    } else if (status !== "loading" && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [session?.accessToken, status, isAuthenticated]);

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !patInput.trim()) return;

    setIsSavingToken(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await userSettingsApi.saveGitHubToken(patInput.trim(), session.accessToken);
      setTokenDetail(result);
      setTokenStatus({
        has_token: true,
        github_username: result.github_username,
      });
      setPatInput("");
      setSuccessMessage("GitHub account connected successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!session?.accessToken) return;
    if (!confirm("Are you sure you want to disconnect your GitHub account? Projects using this token will lose GitHub sync.")) return;

    setIsDeletingToken(true);
    setError(null);

    try {
      await userSettingsApi.deleteGitHubToken(session.accessToken);
      setTokenStatus({ has_token: false });
      setTokenDetail(null);
      setSuccessMessage("GitHub account disconnected");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsDeletingToken(false);
    }
  };

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-900/20">
              <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                Sign in required
              </h2>
              <p className="mt-2 text-amber-600 dark:text-amber-300">
                You must be signed in to access settings.
              </p>
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
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage your connected accounts and preferences
            </p>
          </div>

          {/* Success / Error Messages */}
          {successMessage && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {successMessage}
              </div>
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Editor Preferences */}
          <EditorPreferencesSection />

          {/* Connected Accounts */}
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center gap-2">
              <Github className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Connected Accounts
              </h2>
            </div>

            {tokenStatus?.has_token ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 dark:bg-white">
                        <Github className="h-5 w-5 text-white dark:text-slate-900" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          GitHub
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Connected as{" "}
                          <span className="font-medium">
                            {tokenStatus.github_username || tokenDetail?.github_username || "unknown"}
                          </span>
                        </p>
                        {tokenDetail?.token_scopes && (
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Scopes: {tokenDetail.token_scopes}
                          </p>
                        )}
                        {tokenDetail?.token_preview && (
                          <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                            Token: {tokenDetail.token_preview}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteToken}
                      disabled={isDeletingToken}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {isDeletingToken ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    Your token is stored encrypted and is used to sync pull
                    requests with GitHub repositories connected in your projects.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Connect your GitHub account to enable repository syncing for
                  your projects. You need a{" "}
                  <a
                    href="https://github.com/settings/tokens?type=beta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline dark:text-primary-400"
                  >
                    GitHub Personal Access Token
                  </a>{" "}
                  with the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-700">repo</code> scope.
                </p>

                <form onSubmit={handleSaveToken} className="space-y-3">
                  <div>
                    <label
                      htmlFor="github-pat"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Personal Access Token
                    </label>
                    <input
                      id="github-pat"
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-sm font-mono",
                        "border-slate-300 focus:border-primary-500 focus:ring-primary-500",
                        "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      )}
                      required
                      disabled={isSavingToken}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Your token will be encrypted before storage. We never store tokens in plain text.
                    </p>
                  </div>
                  <Button type="submit" disabled={isSavingToken || !patInput.trim()}>
                    <Github className="mr-2 h-4 w-4" />
                    {isSavingToken ? "Connecting..." : "Connect GitHub"}
                  </Button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

// --- Editor Preferences Section ---

const modeOptions: { value: EditorMode; label: string; description: string; icon: typeof Code }[] = [
  { value: "standard", label: "Standard", description: "Form-based editing with visual controls", icon: LayoutGrid },
  { value: "developer", label: "Developer", description: "Source-code editor with Turtle syntax", icon: Code },
];

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function EditorPreferencesSection() {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const setEditorMode = useEditorModeStore((s) => s.setEditorMode);
  const theme = useEditorModeStore((s) => s.theme);
  const setTheme = useEditorModeStore((s) => s.setTheme);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Editor Preferences
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose your preferred editing mode and theme.
        </p>
      </div>

      {/* Editor Mode */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Editor Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          {modeOptions.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setEditorMode(value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                editorMode === value
                  ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
              )}
            >
              <Icon className={cn(
                "mt-0.5 h-5 w-5 flex-shrink-0",
                editorMode === value
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-slate-400",
              )} />
              <div>
                <p className={cn(
                  "font-medium",
                  editorMode === value
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-slate-900 dark:text-white",
                )}>
                  {label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Theme
        </label>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                theme === value
                  ? "border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/20 dark:text-primary-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
