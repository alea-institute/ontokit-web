"use client";

/**
 * PR Party settings — the reviewer's own credential, pings and merge habit
 * (R11/R12, KTD13 UI half).
 *
 * Deliberately separate from `/settings`, which is the contributor surface and
 * takes no tokens at all. A PAT that can merge on the reviewer's behalf belongs
 * behind the same reviewer gate as the queue, not on the page every account
 * sees — so the gating here mirrors `PRPartyQueueView` exactly, and fails
 * closed: while capabilities are in flight the visitor is not a reviewer.
 *
 * Fetching, saving, removal and the two page-level banners live here;
 * `CredentialCard` is presentational (the `CommitIdentityCard` split). The PAT
 * is passed straight to the API and never stored, logged, or put in a query
 * key.
 */

import { useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bell, ExternalLink, GitMerge, LogIn } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CredentialCard } from "@/components/pr-party/CredentialCard";
import { usePRPartyCapabilities } from "@/lib/hooks/usePRPartyCapabilities";
import {
  prPartyQueryKeys,
  prPartyUserKey,
  usePRPartySettings,
} from "@/lib/hooks/usePRPartyQueue";
import { parsePRPartyError, prPartyApi, type PRPartyMergePlacement } from "@/lib/api/prParty";
import { cn } from "@/lib/utils";

/** ntfy topics are path segments and are effectively a shared secret. */
export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const MERGE_OPTIONS: { value: PRPartyMergePlacement; label: string; hint: string }[] = [
  {
    value: "dashboard",
    label: "Here",
    hint: "Merge with one tap from the review queue",
  },
  {
    value: "manual",
    label: "On GitHub",
    hint: "Show a link to the pull request instead of a merge button",
  },
];

/**
 * Has a timestamp already passed?
 *
 * The generation token, unlike the reviewer's own credential, carries no
 * server-computed `expired` flag — only `expires_at` — so this is the one
 * expiry the client has to decide for itself. Module-level and `now`-injectable
 * so the reading of the clock stays out of render.
 */
export function hasLapsed(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const at = new Date(expiresAt).getTime();
  return Number.isFinite(at) && at <= now;
}

function errorMessage(err: unknown, fallback: string): string {
  return (
    parsePRPartyError(err)?.message ||
    (err instanceof Error && err.message ? err.message : fallback)
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </>
  );
}

export default function PRPartySettingsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = prPartyUserKey(session);
  const queryClient = useQueryClient();

  const {
    isReviewer,
    githubLogin,
    credential,
    generationToken,
    isLoading: capsLoading,
  } = usePRPartyCapabilities();
  const { settings } = usePRPartySettings({ enabled: isReviewer });

  const [success, setSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revokeUrl, setRevokeUrl] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: prPartyQueryKeys.root(userKey) });

  const credentialMutation = useMutation({
    mutationFn: (pat: string) => prPartyApi.setCredential(pat, token!),
    onSuccess: () => {
      setSaveError(null);
      setRevokeUrl(null);
      setSuccess("GitHub token saved. Verdicts will be sent to GitHub for you.");
      void invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => prPartyApi.revokeCredential(token!),
    onSuccess: (response) => {
      setSuccess(
        "OntoKit has forgotten your token. Reviews are recorded here and finished on GitHub by hand.",
      );
      setRevokeUrl(response.revoke_url ?? null);
      void invalidate();
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: Parameters<typeof prPartyApi.updateSettings>[0]) =>
      prPartyApi.updateSettings(data, token!),
    onSuccess: () => {
      setPageError(null);
      setSuccess("Saved.");
      void invalidate();
    },
    onError: (err) => setPageError(errorMessage(err, "That could not be saved.")),
  });

  // --- Gates (same shape as the queue, same fail-closed posture) ---

  if (status === "loading" || (status === "authenticated" && capsLoading)) {
    return (
      <Shell>
        <div className="flex h-64 items-center justify-center">
          <div
            role="status"
            aria-label="Loading your review settings"
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
          />
        </div>
      </Shell>
    );
  }

  if (status !== "authenticated") {
    return (
      <Shell>
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Sign in to manage your review settings
          </h1>
          <Button
            className="mt-6 min-h-11"
            onClick={() =>
              signIn("zitadel", { callbackUrl: "/pr-party/settings" })
            }
          >
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign In
          </Button>
        </div>
      </Shell>
    );
  }

  if (!isReviewer) {
    return (
      <Shell>
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            PR Party is limited to designated reviewers
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your account does not have review access. Nothing else on OntoKit is
            affected.
          </p>
        </div>
      </Shell>
    );
  }

  const topicValue = topic ?? settings?.ntfy_topic ?? "";
  const mergeDefault: PRPartyMergePlacement =
    settings?.merge_default === "manual" ? "manual" : "dashboard";

  async function handleSaveCredential(pat: string) {
    setSuccess(null);
    setPageError(null);
    setSaveError(null);
    try {
      await credentialMutation.mutateAsync(pat);
    } catch (err) {
      // Rendered inside the card so the typed token survives the failure.
      setSaveError(errorMessage(err, "GitHub would not accept that token."));
      throw err;
    }
  }

  async function handleRemoveCredential() {
    setSuccess(null);
    setPageError(null);
    setSaveError(null);
    try {
      await removeMutation.mutateAsync();
    } catch (err) {
      setPageError(errorMessage(err, "The token could not be removed."));
    }
  }

  function handleSaveTopic() {
    setSuccess(null);
    setPageError(null);
    const trimmed = topicValue.trim();
    if (trimmed && !NTFY_TOPIC_PATTERN.test(trimmed)) {
      setTopicError(
        "Use 1–64 letters, numbers, hyphens or underscores — nothing else.",
      );
      return;
    }
    setTopicError(null);
    settingsMutation.mutate({ ntfy_topic: trimmed || null });
  }

  function handleMergeDefault(next: PRPartyMergePlacement) {
    if (next === mergeDefault) return;
    setSuccess(null);
    setPageError(null);
    settingsMutation.mutate({ merge_default: next });
  }

  const generationExpired = hasLapsed(generationToken?.expires_at ?? null);

  return (
    <Shell>
      <div className="mb-6">
        <Link
          href="/pr-party"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the queue
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          Review settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your GitHub connection, where your pings go, and where you merge.
        </p>
      </div>

      {success && (
        <div
          role="status"
          aria-live="polite"
          data-testid="pr-party-settings-success"
          className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400"
        >
          {success}
          {revokeUrl && (
            <>
              {" "}
              <a
                href={revokeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Finish revoking it on GitHub
                <ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden="true" />
              </a>
            </>
          )}
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          data-testid="pr-party-settings-error"
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          {pageError}
        </div>
      )}

      <CredentialCard
        credential={credential}
        githubLogin={githubLogin}
        isSaving={credentialMutation.isPending}
        isRemoving={removeMutation.isPending}
        saveError={saveError}
        onSave={handleSaveCredential}
        onRequestRemove={() => setConfirmRemove(true)}
      />

      {/* --- AI review token. Read-only: an admin owns this one, not the
          reviewer — but its expiry is why briefs stop appearing, so hiding it
          would leave the reviewer guessing. --- */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          AI review token
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          The shared token that writes the briefs. You do not manage it, but you
          are the first to notice when it lapses.
        </p>
        {generationToken ? (
          <>
            <p
              data-testid="generation-token-expiry"
              className="mt-3 text-sm text-slate-700 dark:text-slate-300"
            >
              Expires:{" "}
              {generationToken.expires_at
                ? new Date(generationToken.expires_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "no expiry set"}
            </p>
            {(generationExpired || generationToken.last_error) && (
              <p
                role="alert"
                data-testid="generation-token-banner"
                className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {generationExpired
                    ? "This token has expired, so new briefs are not being written. Ask an administrator to replace it."
                    : `The brief writer last failed with: ${generationToken.last_error}`}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No shared token is configured.
          </p>
        )}
      </section>

      {/* --- ntfy --- */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Where your pings go
          </h2>
        </div>
        <label
          htmlFor="ntfy-topic"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          ntfy topic
        </label>
        <input
          id="ntfy-topic"
          type="text"
          autoComplete="off"
          value={topicValue}
          onChange={(event) => {
            setTopic(event.target.value);
            setTopicError(null);
          }}
          aria-describedby="ntfy-topic-hint"
          aria-invalid={topicError ? true : undefined}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-hidden focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <p id="ntfy-topic-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Treat this like a password: anyone who knows the topic can read your
          pings. Use something nobody would guess. Leave it empty for no pings.
        </p>
        {topicError && (
          <p
            role="alert"
            data-testid="ntfy-topic-error"
            className="mt-2 text-sm text-red-700 dark:text-red-400"
          >
            {topicError}
          </p>
        )}
        <Button
          type="button"
          className="mt-3 min-h-11"
          disabled={settingsMutation.isPending}
          onClick={handleSaveTopic}
        >
          Save topic
        </Button>
      </section>

      {/* --- Merge placement --- */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-center gap-2">
          <GitMerge className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Where you merge
          </h2>
        </div>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          This only moves the button. What you are allowed to merge is decided by
          GitHub either way.
        </p>
        <div
          role="group"
          aria-label="Where you merge"
          className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
        >
          {MERGE_OPTIONS.map((option) => {
            const isActive = mergeDefault === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                title={option.hint}
                disabled={settingsMutation.isPending}
                onClick={() => handleMergeDefault(option.value)}
                className={cn(
                  "min-h-11 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus:outline-hidden focus:ring-2 focus:ring-primary-500",
                  isActive
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        onConfirm={handleRemoveCredential}
        title="Remove your GitHub token?"
        description="OntoKit will forget the token and go back to recording your verdicts here for you to finish on GitHub. This does not revoke the token at GitHub — we will show you the link to do that."
        confirmLabel="Remove it"
        variant="danger"
      />
    </Shell>
  );
}
