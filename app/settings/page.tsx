"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle, LayoutGrid, Code, Sun, Moon, Monitor, Pencil, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CommitIdentityCard } from "@/components/settings/CommitIdentityCard";
import { userSettingsApi, type CommitIdentity } from "@/lib/api/userSettings";
import { cn } from "@/lib/utils";
import {
  useEditorModeStore,
  type EditorMode,
  type ThemePreference,
} from "@/lib/stores/editorModeStore";

export default function UserSettingsPage() {
  const { data: session, status } = useSession();

  const [identity, setIdentity] = useState<CommitIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    const fetchIdentity = async () => {
      if (!session?.accessToken) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        setIdentity(await userSettingsApi.getCommitIdentity(session.accessToken));
      } catch {
        setError("Couldn't load your credit settings. Try again in a moment.");
        setIdentity(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== "loading" && isAuthenticated) {
      fetchIdentity();
    } else if (status !== "loading" && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [session?.accessToken, status, isAuthenticated]);

  const handleToggleVerifiedEmail = async (useVerified: boolean) => {
    if (!session?.accessToken) return;
    setIsSavingIdentity(true);
    setError(null);
    setSuccessMessage(null);
    try {
      setIdentity(
        await userSettingsApi.updateCommitIdentity(
          { use_verified_email: useVerified },
          session.accessToken,
        ),
      );
      setSuccessMessage("Credit settings updated");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update credit settings");
    } finally {
      setIsSavingIdentity(false);
    }
  };

  if (isLoading || status === "loading") {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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
        <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
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
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/"
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
            <div role="status" aria-live="polite" className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {successMessage}
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Editor Preferences */}
          <EditorPreferencesSection />

          {/* How your contributions are credited */}
          <CommitIdentityCard
            identity={identity}
            isSaving={isSavingIdentity}
            onToggleVerifiedEmail={handleToggleVerifiedEmail}
          />
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
  const preferEditMode = useEditorModeStore((s) => s.preferEditMode);
  const setPreferEditMode = useEditorModeStore((s) => s.setPreferEditMode);
  const [highlightedSetting, setHighlightedSetting] = useState<string | null>(null);

  // Highlight and scroll to the setting referenced by the URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSetting(hash);
    const timer = setTimeout(() => setHighlightedSetting(null), 2000);
    return () => clearTimeout(timer);
  }, []);
  const showManualSaveButton = useEditorModeStore((s) => s.showManualSaveButton);
  const setShowManualSaveButton = useEditorModeStore((s) => s.setShowManualSaveButton);

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
        <span id="editor-mode-label" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Editor Mode
        </span>
        <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="editor-mode-label">
          {modeOptions.map(({ value, label, description, icon: Icon }) => (
            <button
              type="button"
              key={value}
              onClick={() => setEditorMode(value)}
              aria-pressed={editorMode === value}
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
        <span id="theme-label" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Theme
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="theme-label">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              key={value}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
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

      {/* Prefer Edit Mode */}
      <div
        id="prefer-edit-mode"
        className={cn(
          "mt-6 scroll-mt-8 rounded-lg p-2 -mx-2 transition-colors duration-1000",
          highlightedSetting === "prefer-edit-mode" && "bg-amber-100 dark:bg-amber-900/30",
        )}
      >
        <span id="prefer-edit-mode-label" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Prefer Edit Mode
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={preferEditMode}
          aria-labelledby="prefer-edit-mode-label"
          onClick={() => setPreferEditMode(!preferEditMode)}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors w-full",
            preferEditMode
              ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20"
              : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
          )}
        >
          <Pencil className={cn(
            "h-5 w-5 flex-shrink-0",
            preferEditMode
              ? "text-primary-600 dark:text-primary-400"
              : "text-slate-400",
          )} />
          <div>
            <p className={cn(
              "font-medium",
              preferEditMode
                ? "text-primary-700 dark:text-primary-300"
                : "text-slate-900 dark:text-white",
            )}>
              {preferEditMode ? "On" : "Off"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              When on, opening a project takes you straight to the editor. When off, projects open in the read-only viewer first.
            </p>
          </div>
        </button>
      </div>

      {/* Manual Save Button */}
      <div
        id="save-button"
        className={cn(
          "mt-6 scroll-mt-8 rounded-lg p-2 -mx-2 transition-colors duration-1000",
          highlightedSetting === "save-button" && "bg-amber-100 dark:bg-amber-900/30",
        )}
      >
        <span id="manual-save-button-label" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Show Manual Save Button
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showManualSaveButton}
          aria-labelledby="manual-save-button-label"
          onClick={() => setShowManualSaveButton(!showManualSaveButton)}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors w-full",
            showManualSaveButton
              ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20"
              : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500",
          )}
        >
          <Save className={cn(
            "h-5 w-5 flex-shrink-0",
            showManualSaveButton
              ? "text-primary-600 dark:text-primary-400"
              : "text-slate-400",
          )} />
          <div>
            <p className={cn(
              "font-medium",
              showManualSaveButton
                ? "text-primary-700 dark:text-primary-300"
                : "text-slate-900 dark:text-white",
            )}>
              {showManualSaveButton ? "On" : "Off"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Show a Save button for immediate saves. Auto-save always saves when you navigate away.
            </p>
          </div>
        </button>
      </div>
    </section>
  );
}
