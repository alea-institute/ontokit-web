"use client";

/**
 * "How your contributions are credited" — the settings card where a lay
 * contributor meets the attribution model (R14, R15).
 *
 * Presentational by design: fetching, saving and the page-level success/error
 * banners stay with the settings page, so this card renders exactly one thing —
 * the current commit identity and the single opt-in that can change it.
 * `identity === null` is the unavailable state (a failed load), which must read
 * as an explanation rather than an empty card.
 */

import { ShieldCheck } from "lucide-react";
import type { CommitIdentity } from "@/lib/api/userSettings";

export interface CommitIdentityCardProps {
  /** The current commit identity, or `null` when it could not be loaded. */
  identity: CommitIdentity | null;
  /** True while an update is in flight; disables the opt-in. */
  isSaving: boolean;
  /** Called with the new opt-in value when the contributor toggles it. */
  onToggleVerifiedEmail: (useVerified: boolean) => void;
}

export function CommitIdentityCard({
  identity,
  isSaving,
  onToggleVerifiedEmail,
}: CommitIdentityCardProps) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          How your contributions are credited
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Your suggestions become permanent, public history. By default you are
        credited by name with a private stand-in address, so your real email
        address is never published.
      </p>

      {identity ? (
        <div className="space-y-4">
          <dl className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-700/50">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Credited as</dt>
              <dd className="font-medium text-slate-900 dark:text-white">
                {identity.display_name || "Contributor"}
              </dd>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">
                Address shown publicly
              </dt>
              <dd
                data-testid="effective-email"
                className="max-w-full break-all text-right font-mono text-xs text-slate-700 dark:text-slate-200"
              >
                {identity.effective_email}
              </dd>
            </div>
          </dl>

          {identity.commit_email ? (
            identity.commit_email_verified ? (
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={identity.use_verified_email}
                  disabled={isSaving}
                  onChange={(e) => onToggleVerifiedEmail(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  Use my verified address{" "}
                  <span className="font-mono text-xs">{identity.commit_email}</span>{" "}
                  instead, so contributions link to my account on the public
                  mirror.
                </span>
              </label>
            ) : (
              <p
                role="status"
                className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              >
                <span className="font-mono text-xs">{identity.commit_email}</span> is
                not verified yet, so it will not be used. Your stand-in address
                stays in place until it is.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nothing to do here — the stand-in address is used automatically.
            </p>
          )}
        </div>
      ) : (
        <p role="alert" className="text-sm text-slate-500 dark:text-slate-400">
          Credit settings are unavailable right now.
        </p>
      )}
    </section>
  );
}
