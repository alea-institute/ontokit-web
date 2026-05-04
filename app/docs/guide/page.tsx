import Link from "next/link";
import { guideChapters } from "@/lib/docs/guide-chapters";

export default function GuideLandingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Guide to Ontologies
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        A beginner-friendly introduction to ontologies, their formats, syntaxes, and the{" "}
        vocabularies that power the Semantic Web.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {guideChapters.map((chapter, i) => (
          <Link
            key={chapter.slug}
            href={`/docs/guide/${chapter.slug}`}
            className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-semibold shrink-0">
                {i + 1}
              </span>
              <div>
                <h2 className="text-lg font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1">
                  {chapter.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {chapter.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
