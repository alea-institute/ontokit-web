"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { guideChapters } from "@/lib/docs/guide-chapters";
import { cn } from "@/lib/utils";

export function GuideSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-4 space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 px-3">
          Ontology Guide
        </h3>
        {guideChapters.map((chapter, i) => {
          const href = `/docs/guide/${chapter.slug}`;
          const isActive = pathname === href;
          return (
            <Link
              key={chapter.slug}
              href={href}
              className={cn(
                "flex items-start gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium shrink-0 mt-0.5",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                )}
              >
                {i + 1}
              </span>
              <span>{chapter.shortTitle}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
