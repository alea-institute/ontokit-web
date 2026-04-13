import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract the local name from an IRI
 * e.g., "http://example.org/ontology#Person" -> "Person"
 */
export function getLocalName(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  if (hashIndex !== -1) {
    return iri.substring(hashIndex + 1);
  }
  const slashIndex = iri.lastIndexOf("/");
  if (slashIndex !== -1) {
    return iri.substring(slashIndex + 1);
  }
  return iri;
}

/**
 * Get the namespace from an IRI
 * e.g., "http://example.org/ontology#Person" -> "http://example.org/ontology#"
 */
export function getNamespace(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  if (hashIndex !== -1) {
    return iri.substring(0, hashIndex + 1);
  }
  const slashIndex = iri.lastIndexOf("/");
  if (slashIndex !== -1) {
    return iri.substring(0, slashIndex + 1);
  }
  return "";
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string with time
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get the preferred label from a list of localized strings
 */
export function getPreferredLabel(
  labels: { value: string; lang: string }[],
  preferredLang = "en"
): string {
  if (!labels.length) return "";

  // Try to find the preferred language
  const preferred = labels.find((l) => l.lang === preferredLang);
  if (preferred) return preferred.value;

  // Fall back to first label
  return labels[0].value;
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Map bare language codes to their default country code for flag rendering */
const LANG_TO_COUNTRY: Record<string, string> = {
  en: "US",
  la: "VA",
  ja: "JP",
  ko: "KR",
  zh: "CN",
  hi: "IN",
  ur: "PK",
  bn: "BD",
  ta: "IN",
  te: "IN",
  mr: "IN",
  gu: "IN",
  kn: "IN",
  ml: "IN",
  pa: "IN",
  vi: "VN",
  uk: "UA",
  el: "GR",
  he: "IL",
  ar: "SA",
  fa: "IR",
  cs: "CZ",
  da: "DK",
  sv: "SE",
  nb: "NO",
  nn: "NO",
  et: "EE",
  sl: "SI",
  sq: "AL",
  ms: "MY",
  ga: "IE",
  cy: "GB",
  eu: "ES",
  ca: "ES",
  gl: "ES",
  sw: "KE",
  af: "ZA",
  zu: "ZA",
};

/**
 * Convert an ISO language tag to a flag emoji.
 * - `xx-YY` → uses YY country code
 * - `xx` bare code → lookup table or self-mapping heuristic (e.g. `de`→`DE`)
 * Returns null if the code can't be mapped.
 */
export function langToFlag(lang: string): string | null {
  if (!lang) return null;
  const normalized = lang.trim().toLowerCase();
  if (!normalized) return null;

  let countryCode: string | undefined;

  if (normalized.includes("-")) {
    const parts = normalized.split("-");
    countryCode = parts[parts.length - 1].toUpperCase();
  } else {
    countryCode = LANG_TO_COUNTRY[normalized] ?? normalized.toUpperCase();
  }

  if (!countryCode || countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
    return null;
  }

  const flag = String.fromCodePoint(
    ...countryCode.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
  return flag;
}
