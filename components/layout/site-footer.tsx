import Link from "next/link";

/**
 * Small site footer for public pages. Carries the privacy policy link that
 * Google's OAuth consent review expects to find from the home page.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <nav
        aria-label="Footer"
        className="container mx-auto flex items-center justify-end gap-4 px-4 py-4 text-sm"
      >
        <Link
          href="/privacy"
          className="text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
        >
          Privacy
        </Link>
      </nav>
    </footer>
  );
}
