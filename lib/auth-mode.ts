/**
 * Centralized auth mode configuration.
 *
 * AUTH_MODE controls authentication behavior:
 * - "required" (default): Zitadel OIDC, must sign in to use app
 * - "optional": Browse anonymously, sign in available if Zitadel configured
 * - "disabled": No auth at all, anonymous browsing only
 */

export type AuthMode = "required" | "optional" | "disabled";

/** Server-side auth mode (reads process.env directly) */
export function getAuthMode(): AuthMode {
  const mode = process.env.AUTH_MODE?.toLowerCase();
  if (mode === "optional" || mode === "disabled") return mode;
  return "required";
}

/** Whether Zitadel OIDC is configured (server-side check) */
export function isZitadelConfigured(): boolean {
  return !!(process.env.ZITADEL_ISSUER && process.env.ZITADEL_CLIENT_ID);
}

/** Whether auth is required (must sign in to use the app) */
export function isAuthRequired(): boolean {
  return getAuthMode() === "required";
}
