import { langToFlag } from "@/lib/utils";

interface LanguageFlagProps {
  lang: string;
  className?: string;
}

/**
 * Renders a country flag emoji for a language tag, with the ISO code as a tooltip.
 * Falls back to a grey text badge for unmappable codes.
 */
export function LanguageFlag({ lang, className }: LanguageFlagProps) {
  if (!lang) return null;

  const flag = langToFlag(lang);

  if (flag) {
    return (
      <span
        role="img"
        aria-label={`Language: ${lang}`}
        title={lang}
        className={className ?? "shrink-0 text-sm leading-none"}
      >
        {flag}
      </span>
    );
  }

  // Fallback: grey text badge for unmappable codes
  return (
    <span
      className={className ?? "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"}
      title={lang}
    >
      {lang}
    </span>
  );
}
