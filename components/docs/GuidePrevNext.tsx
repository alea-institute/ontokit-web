import Link from "next/link";
import { getAdjacentChapters } from "@/lib/docs/guide-chapters";

export function GuidePrevNext({ currentSlug }: { currentSlug: string }) {
  const { prev, next } = getAdjacentChapters(currentSlug);

  return (
    <nav className="flex items-center justify-between mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
      {prev ? (
        <Link
          href={`/docs/guide/${prev.slug}`}
          className="group flex flex-col items-start gap-1"
        >
          <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            Previous
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/guide/${next.slug}`}
          className="group flex flex-col items-end gap-1"
        >
          <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            Next
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {next.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
