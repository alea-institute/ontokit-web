"use client";

import { Header } from "@/components/layout/header";
import { HydrationReviewView } from "@/components/hydration-review/HydrationReviewView";

/**
 * Hydration review — row-level diff, sampling and correction for a
 * generative-folio write-back digest. Thin by design: `app/**` is excluded from
 * coverage, so the behavior lives in `components/hydration-review/`.
 */
export default function HydrationReviewPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hydration review</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Review proposed FOLIO additions from a local bundle, then export your decisions.
            </p>
          </div>
          <HydrationReviewView />
        </div>
      </main>
    </>
  );
}
