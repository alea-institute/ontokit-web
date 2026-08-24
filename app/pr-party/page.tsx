"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { PRPartyQueueView } from "@/components/pr-party/PRPartyQueueView";
import { CardDetail } from "@/components/pr-party/CardDetail";

/**
 * PR Party — the canonical review queue.
 *
 * Deliberately thin: `app/**` is excluded from coverage, so the gating, the
 * grouping and every verdict affordance live in `components/pr-party/` where
 * tests can reach them. The Suspense boundary is what `useSearchParams` needs
 * to keep the route prerenderable.
 */
export default function PRPartyPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Review</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pull requests waiting on you, what they change, and what to do about them.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div
                  role="status"
                  aria-label="Loading the review queue"
                  className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
                />
              </div>
            }
          >
            <PRPartyQueueView
              renderCardDetail={(card, reviewerId) => (
                <CardDetail card={card} reviewerId={reviewerId} />
              )}
            />
          </Suspense>
        </div>
      </main>
    </>
  );
}
