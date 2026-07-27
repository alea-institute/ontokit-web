"use client";

/**
 * "Your GitHub connection" — where a reviewer hands OntoKit a PAT, sees how
 * healthy it is, and takes it back (R11/R12, KTD13).
 *
 * Presentational by design, on the `CommitIdentityCard` model: this card owns
 * the intake form and the four health states, while fetching, saving, removal
 * and the page-level success/error banners stay with the settings page. What is
 * *not* delegated is the disclosure — a token that can approve, merge and
 * comment as the reviewer is not something to ask for behind a bare label, so
 * the four facts (what it can do, where it lives, how to revoke, and that
 * declining is a supported way to work) are rendered next to the field itself,
 * before it is filled, every time.
 *
 * The PAT never persists client-side. It lives in one piece of component state
 * that is cleared on success, the field is `type="password"` with
 * `autoComplete="off"`, and its name is deliberately non-guessable so a password
 * manager does not offer to remember a credential the user did not choose to
 * store. On a failed save the value is deliberately *kept*, because a 40-
 * character token retyped from scratch after a wrong-login error is how people
 * give up.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PRPartyCredentialHealth } from "@/lib/api/prParty";

/** The field name. Non-guessable on purpose — see the note above. */
export const PAT_FIELD_NAME = "prp_token_entry";

export interface CredentialCardProps {
  /** Health of the stored PAT, or `null` when there is none (degraded mode). */
  credential: PRPartyCredentialHealth | null;
  /** The login the credential is expected to belong to, when known. */
  githubLogin: string | null;
  /** True while a save is in flight. */
  isSaving: boolean;
  /** True while a removal is in flight. */
  isRemoving: boolean;
  /** The last save error, rendered inline so the form keeps its input. */
  saveError: string | null;
  /** Called with the raw PAT. Resolving clears the field; rejecting keeps it. */
  onSave: (token: string) => Promise<void>;
  /** Opens the page's confirm dialog. Removal itself is the page's job. */
  onRequestRemove: () => void;
}

function formatWhen(value: string | null): string {
  if (!value) return "unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CredentialCard({
  credential,
  githubLogin,
  isSaving,
  isRemoving,
  saveError,
  onSave,
  onRequestRemove,
}: CredentialCardProps) {
  const [token, setToken] = useState("");

  const hasCredential = credential !== null;
  const expired = credential?.expired === true;
  const expiringSoon = credential?.expires_soon === true;
  const lastError = credential?.last_error ?? null;
  const unhealthy = expired || !!lastError;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = token.trim();
    if (!value || isSaving) return;
    try {
      await onSave(value);
      // Only a confirmed save clears the field.
      setToken("");
    } catch {
      // The page renders the message; the typed token stays put.
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Your GitHub connection
        </h2>
      </div>

      {/* --- Health --- */}
      {hasCredential ? (
        <>
          {unhealthy ? (
            <p
              role="alert"
              data-testid="credential-banner-expired"
              className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {expired
                  ? "Your GitHub token has expired. Verdicts are still recorded here, but they are finished on GitHub by hand until you reconnect."
                  : `GitHub rejected your token: ${lastError}. Reconnect below.`}
              </span>
            </p>
          ) : expiringSoon ? (
            <p
              role="status"
              data-testid="credential-banner-expiring"
              className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Your GitHub token expires on {formatWhen(credential.expires_at)}.
                Replace it below before then and nothing will interrupt.
              </span>
            </p>
          ) : (
            <p
              data-testid="credential-banner-healthy"
              className="mb-4 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Connected{githubLogin ? ` as ${githubLogin}` : ""}.</span>
            </p>
          )}

          <dl className="mb-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-700/50">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Expires</dt>
              <dd data-testid="credential-expires" className="font-medium text-slate-900 dark:text-white">
                {credential.expires_at ? formatWhen(credential.expires_at) : "no expiry set"}
              </dd>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Last checked</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {formatWhen(credential.last_validated_at)}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <div
          data-testid="credential-degraded-explainer"
          className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300"
        >
          <p className="font-medium">No GitHub token connected — that is a supported way to work.</p>
          <p className="mt-1">
            Your verdicts are recorded here and you finish each one on GitHub with
            one tap. Connecting a token below removes that second step.
          </p>
        </div>
      )}

      {/* --- Disclosure. Always above the field, never behind a toggle. --- */}
      <div className="mb-4 rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        <h3 className="font-medium text-slate-900 dark:text-white">
          Before you paste a token
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            It acts as you: OntoKit will post reviews, merge pull requests, and
            comment on GitHub under your account.
          </li>
          <li>
            It is stored encrypted on OntoKit&apos;s servers and is never shown
            back to you or to anyone else.
          </li>
          <li>
            You can revoke it at GitHub at any time, in one step, from{" "}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary-700 underline dark:text-primary-300"
            >
              your personal access tokens
              <ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden="true" />
            </a>
            . Removing it here does not revoke it there.
          </li>
          <li>
            You never have to connect one. Reviewing without a token works
            permanently, not just as a fallback.
          </li>
        </ul>
      </div>

      {/* --- Intake / rotation --- */}
      <form onSubmit={handleSubmit} noValidate>
        <label
          htmlFor={PAT_FIELD_NAME}
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {hasCredential ? "Replace your token" : "GitHub personal access token"}
        </label>
        <input
          id={PAT_FIELD_NAME}
          name={PAT_FIELD_NAME}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          disabled={isSaving}
          onChange={(event) => setToken(event.target.value)}
          placeholder="ghp_…"
          aria-describedby={saveError ? "credential-save-error" : undefined}
          aria-invalid={saveError ? true : undefined}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-hidden focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hasCredential
            ? "The token you have now keeps working until the new one is verified."
            : "A fine-grained or classic token with pull request access."}
        </p>

        {saveError && (
          <p
            id="credential-save-error"
            role="alert"
            data-testid="credential-save-error"
            className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {saveError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={isSaving || !token.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {hasCredential ? "Replace token" : "Connect token"}
          </Button>

          {hasCredential && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isRemoving}
              onClick={onRequestRemove}
            >
              {isRemoving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Remove token
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
