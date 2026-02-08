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
