"use client";

import { htmlLang, isRtl } from "@/lib/hydration-review/bundle";
import { codePointLabel, segmentScripts } from "@/lib/hydration-review/scripts";
import { cn } from "@/lib/utils";

interface ScriptTextProps {
  value: string;
  lang: string | null;
  className?: string;
}

/**
 * Render a value faithfully in its locale's direction, with foreign-script runs
 * underlined and invisible characters shown as code-point badges. The text is
 * never normalized or reordered; `<bdi>` isolates it from surrounding layout.
 */
export function ScriptText({ value, lang, className }: ScriptTextProps) {
  const segments = segmentScripts(value, lang);
  return (
    <bdi
      dir={isRtl(lang) ? "rtl" : "ltr"}
      lang={htmlLang(lang)}
      className={cn("whitespace-pre-wrap break-words", className)}
    >
      {segments.map((s, i) =>
        s.kind === "plain" ? (
          <span key={i}>{s.text}</span>
        ) : s.kind === "foreign" ? (
          <mark
            key={i}
            title="Script differs from the locale's native script"
            className="rounded-sm bg-amber-100 text-inherit underline decoration-amber-600 decoration-wavy dark:bg-amber-900/40"
          >
            {s.text}
          </mark>
        ) : (
          <span
            key={i}
            dir="ltr"
            title={`Invisible or control character ${codePointLabel(s.text)}`}
            className="mx-0.5 rounded bg-red-100 px-1 font-mono text-[0.7em] text-red-800 dark:bg-red-900/50 dark:text-red-200"
          >
            {codePointLabel(s.text)}
          </span>
        ),
      )}
    </bdi>
  );
}
