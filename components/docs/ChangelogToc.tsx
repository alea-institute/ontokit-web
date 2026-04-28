"use client";

import { useEffect, useState } from "react";
import { changelogAnchorId } from "@/lib/docs/changelog";
import { cn } from "@/lib/utils";

interface TocEntry {
  version: string;
  date: string;
}

export function ChangelogToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string | null>(
    entries[0] ? changelogAnchorId(entries[0].version) : null,
  );

  useEffect(() => {
    const ids = entries.map(({ version }) => changelogAnchorId(version));
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const update = () => {
      const scrollY = window.scrollY;
      const viewportBottom = scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (docHeight - viewportBottom < 8) {
        setActive(targets[targets.length - 1].id);
        return;
      }

      const probe = scrollY + 120;
      let current = targets[0].id;
      for (const el of targets) {
        const top = el.getBoundingClientRect().top + scrollY;
        if (top <= probe) current = el.id;
        else break;
      }
      setActive(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [entries]);

  return (
    <nav className="hidden lg:block w-48 shrink-0" aria-label="Releases">
      <div className="sticky top-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 px-3">
          Releases
        </h3>
        <ul className="space-y-0.5">
          {entries.map(({ version, date }) => {
            const id = changelogAnchorId(version);
            const isActive = active === id;
            return (
              <li key={version}>
                <a
                  href={`#${id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "block px-3 py-1.5 rounded-md transition-colors border-l-2",
                    isActive
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800",
                  )}
                >
                  <span className="block font-mono text-sm">{version}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {date}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
