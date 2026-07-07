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

/** Whether Zitadel OIDC is configured (server-side check). Both issuer AND
 *  client id are needed for a working provider — keep this predicate identical
 *  to the client flag in next.config.ts (NEXT_PUBLIC_ZITADEL_CONFIGURED). */
export function isZitadelConfigured(): boolean {
  return !!(process.env.ZITADEL_ISSUER && process.env.ZITADEL_CLIENT_ID);
}

/** Whether auth is required (must sign in to use the app) */
export function isAuthRequired(): boolean {
  return getAuthMode() === "required";
}

/**
 * Whether the Zitadel OIDC provider is actually usable — i.e. real authenticated
 * sessions can be minted right now. True unless auth is disabled or Zitadel is
 * unconfigured. This is the single server-side predicate that gates the NextAuth
 * provider list, token refresh, and custom auth pages (they must all agree).
 */
export function isAuthActive(): boolean {
  return getAuthMode() !== "disabled" && isZitadelConfigured();
}

/**
 * Client-safe mirror of {@link isAuthActive} for React components. Reads the
 * build-time NEXT_PUBLIC_* flags (set in next.config.ts) rather than server env,
 * so it is safe to call in the browser. Gates whether sign-in affordances
 * (Sign in button, UserMenu, NotificationBell) are shown.
 */
export function shouldShowAuthUI(): boolean {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE || "required";
  const zitadelConfigured = process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED === "true";
  return mode !== "disabled" && zitadelConfigured;
}
