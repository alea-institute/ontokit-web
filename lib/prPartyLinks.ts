/** The single trust boundary for every API-derived PR Party navigation target. */
export function trustedGitHubUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.includes("\\")) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "github.com"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function isTrustedGitHubLink(value: unknown): value is string {
  return trustedGitHubUrl(value) !== null;
}
