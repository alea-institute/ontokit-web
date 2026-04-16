import { langToFlag } from "@/lib/utils";

interface LanguageFlagProps {
  lang: string;
  className?: string;
}

/**
 * Renders a country flag emoji for a language tag, with the ISO code as a tooltip.
 * Always occupies a fixed width so rows stay aligned even when no flag is available.
 */
export function LanguageFlag({ lang, className }: LanguageFlagProps) {
  const flag = lang ? langToFlag(lang) : null;

  return (
    <span
      role={flag ? "img" : undefined}
      aria-label={flag ? `Language: ${lang}` : undefined}
      aria-hidden={!flag ? true : undefined}
      title={lang || undefined}
      className={className ?? "inline-flex h-5 w-5 shrink-0 items-center justify-center font-emoji text-sm leading-none"}
    >
      {flag}
    </span>
  );
}
