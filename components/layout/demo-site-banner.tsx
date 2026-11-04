import { FlaskConical } from "lucide-react";

/** Fixed banner copy — approved verbatim; do not reword. */
export const DEMO_SITE_BANNER_COPY =
  "OntoKit demo: preview how communities build the Catholic Semantic Canon and FOLIO together. Suggestions here land in demo copies on GitHub, never the official ontologies.";

/** Build-time flag: Next.js inlines NEXT_PUBLIC_* values into the bundle. */
export function isDemoSite(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_SITE === "true";
}

/**
 * Site-wide, non-dismissible notice for the public demo deployment. Mounted in
 * the root layout above every page header; renders nothing unless the
 * deployment was built with NEXT_PUBLIC_DEMO_SITE=true.
 */
export function DemoSiteBanner() {
  if (!isDemoSite()) return null;

  return (
    <div
      role="region"
      aria-label="Demo site notice"
      className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="container mx-auto flex items-start gap-2 sm:items-center">
        <FlaskConical
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0"
        />
        <span>{DEMO_SITE_BANNER_COPY}</span>
      </p>
    </div>
  );
}
