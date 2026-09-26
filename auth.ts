import NextAuth from "next-auth";
import type { NextAuthConfig, User } from "next-auth";
import { getToken } from "next-auth/jwt";
import { randomBytes } from "crypto";
import { isAuthActive, isZitadelConfigured } from "@/lib/auth-mode";
import { validateServerEnv } from "@/lib/env";

// Auth.js's default logger prints `[auth][details]` with the whole error cause:
// for an expired session cookie that is the decrypted session (access, refresh
// and ID tokens); for OIDC callback failures it includes ID-token claims. Server
// output therefore carries only allowlisted identifiers, never payload fields.
const SAFE_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,80}$/;
// Defense in depth for free-text messages: redact anything shaped like a JWT or
// a long opaque credential, and bound the length.
const CREDENTIAL_SHAPED = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]*)?|[A-Za-z0-9+/_=-]{32,}/g;

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value) ? value : undefined;
}

function safeMessage(value: unknown): string {
  return typeof value === "string" ? value.replace(CREDENTIAL_SHAPED, "[redacted]").slice(0, 300) : "";
}

export function describeAuthError(error: Error): string {
  // Auth.js errors carry a class-level `type` (e.g. JWTSessionError).
  const type = safeIdentifier((error as { type?: unknown })?.type) ?? safeIdentifier(error?.name) ?? "Error";
  let line = `${type}: ${safeMessage(error?.message)}`;
  const cause = (error as { cause?: unknown })?.cause;
  const err = cause && typeof cause === "object" && "err" in cause ? (cause as { err: unknown }).err : cause;
  if (err instanceof Error) {
    const detail = [safeIdentifier(err.name), safeIdentifier((err as { code?: unknown }).code)].filter(Boolean);
    const errCause = (err as { cause?: unknown }).cause;
    if (errCause && typeof errCause === "object") {
      // jose claim failures carry {claim, reason, payload}; only the first two are safe.
      const claim = safeIdentifier((errCause as { claim?: unknown }).claim);
      const reason = safeIdentifier((errCause as { reason?: unknown }).reason);
      if (claim) detail.push(`claim=${claim}`);
      if (reason) detail.push(`reason=${reason}`);
    }
    if (detail.length) line += ` (cause: ${detail.join(" ")})`;
  }
  return line;
}

// A stalled issuer must not hold the session request open indefinitely.
const REFRESH_TIMEOUT_MS = 10_000;

// Runs `operation` with an abort signal and rejects with a TimeoutError after
// `ms`, even if the aborted operation never settles.
async function withTimeout<T>(ms: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const reason = Object.assign(new Error(`Timed out after ${ms}ms`), { name: "TimeoutError" });
      controller.abort(reason);
      reject(reason);
    }, ms);
  });
  try {
    return await Promise.race([operation(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

function createAuthLogger(debugEnabled: boolean): NonNullable<NextAuthConfig["logger"]> {
  return {
    error(error) {
      console.error(`[auth][error] ${describeAuthError(error)}`);
    },
    warn(code) {
      console.warn(`[auth][warn][${safeIdentifier(code) ?? "unknown"}]`);
    },
    // Debug metadata includes provider responses and tokens; emit messages only.
    debug(message) {
      if (debugEnabled) console.log(`[auth][debug] ${safeMessage(message)}`);
    },
  };
}

// Build imports must not require credentials or create a process signing secret.
// Auth.js calls this factory when an authentication operation actually runs.
export function createAuthConfig(): NextAuthConfig {
  const serverEnvironment = validateServerEnv();

  // Preserve anonymous-only fallback eligibility after validating the mode.
  // Configured providers must use the operator's stable signing secret.
  if (!isZitadelConfigured() && !process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
  }

  // Zitadel provider configuration
  const zitadelProvider = {
    id: "zitadel",
    name: "Zitadel",
    type: "oidc" as const,
    issuer: serverEnvironment.ZITADEL_ISSUER,
    clientId: process.env.ZITADEL_CLIENT_ID || "",
    clientSecret: process.env.ZITADEL_CLIENT_SECRET || "",
    authorization: {
      params: {
        scope: "openid profile email offline_access",
      },
    },
    profile(profile: Record<string, unknown>) {
      return {
        id: profile.sub as string,
        name: (profile.name || profile.preferred_username) as string,
        email: profile.email as string,
        image: profile.picture as string | undefined,
      };
    },
  };

  return {
    providers: isAuthActive() ? [zitadelProvider] : [],
    events: {
      async signOut(_message) {
        // This event fires after local session is cleared
        // The actual redirect to Zitadel's end_session happens in the component
      },
    },
    callbacks: {
      async jwt({ token, account, user }) {
        // Initial sign in
        if (account && user) {
          // Auth.js gives user.id a generated ID. The backend identifies people
          // by the verified Zitadel subject retained in providerAccountId.
          const sessionUser = account.provider === "zitadel"
            ? { ...user, id: account.providerAccountId }
            : user;
          return {
            ...token,
            sub: sessionUser.id,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            // Retained server-side (encrypted cookie only) as the end-session
            // id_token_hint; the session callback never exposes it.
            idToken: account.id_token,
            expiresAt: account.expires_at,
            user: sessionUser,
          };
        }

        // Skip token refresh when the OIDC provider isn't active (disabled mode or
        // Zitadel unconfigured) — no Zitadel token endpoint to call.
        if (!isAuthActive()) {
          return token;
        }

        // Return previous token if the access token has not expired yet
        if (Date.now() < ((token.expiresAt as number) ?? 0) * 1000) {
          return token;
        }

        // Access token has expired, try to refresh it
        if (token.refreshToken) {
          try {
            // The timeout bounds both the request and the body read.
            const { response, tokens } = await withTimeout(REFRESH_TIMEOUT_MS, async signal => {
              const response = await fetch(
                `${process.env.ZITADEL_ISSUER}/oauth/v2/token`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({
                    client_id: process.env.ZITADEL_CLIENT_ID || "",
                    client_secret: process.env.ZITADEL_CLIENT_SECRET || "",
                    grant_type: "refresh_token",
                    refresh_token: token.refreshToken as string,
                  }),
                  signal,
                }
              );
              return { response, tokens: await response.json() };
            });

            if (!response.ok) throw tokens;

            // A successful retry supersedes any earlier failure; a retained error
            // would force re-authentication despite valid renewed credentials.
            const { error: _previousError, ...renewable } = token;
            return {
              ...renewable,
              accessToken: tokens.access_token,
              expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
              refreshToken: tokens.refresh_token ?? token.refreshToken,
              idToken: tokens.id_token ?? token.idToken,
            };
          } catch (error) {
            console.error("Error refreshing access token", error);
            return { ...token, error: "RefreshAccessTokenError" };
          }
        }

        // Expired without a refresh credential: nothing can renew it, so surface
        // the same error that makes SessionGuard force a fresh sign-in rather than
        // presenting the expired access token as usable.
        return { ...token, error: "RefreshAccessTokenError" };
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken as string;
        session.error = token.error as string | undefined;
        if (token.user) {
          Object.assign(session.user, token.user);
        }
        return session;
      },
    },
    // Custom sign-in/error pages apply whenever sign-in is actually available
    // (required mode, or optional mode with Zitadel configured) — not just required.
    pages: isAuthActive()
      ? { signIn: "/auth/signin", error: "/auth/error" }
      : {},
    debug: process.env.NODE_ENV === "development",
    logger: createAuthLogger(process.env.NODE_ENV === "development"),
  };
}

const SESSION_COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

/**
 * Builds the provider's RP-initiated logout URL for the browser that sent
 * `request`. The retained ID token becomes `id_token_hint`, so the provider ends
 * the session without asking the user to choose it. The token never enters the
 * client session JSON; it leaves the server only inside this provider URL.
 * Returns null when no provider is active or the request has no usable origin.
 */
export async function federatedLogoutUrl(request: Request): Promise<string | null> {
  if (!isAuthActive()) return null;
  // Same issuer string the browser build compiles in (validateServerEnv enforces it).
  const issuer = process.env.ZITADEL_ISSUER!;
  const clientId = process.env.ZITADEL_CLIENT_ID!;

  let postLogoutRedirectUri: string;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return null;
    postLogoutRedirectUri = origin.origin;
  } catch {
    return null;
  }

  let idToken: string | undefined;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  // Only the cookie header is consulted, so no Authorization bearer fallback applies.
  const cookieOnly = { headers: { cookie: request.headers.get("cookie") ?? "" } };
  if (secret) {
    for (const cookieName of SESSION_COOKIE_NAMES) {
      const token = await getToken({ req: cookieOnly, secret, cookieName, salt: cookieName, secureCookie: cookieName.startsWith("__Secure-") });
      if (token) {
        if (typeof token.idToken === "string" && token.idToken) idToken = token.idToken;
        break;
      }
    }
  }

  const params = new URLSearchParams();
  if (idToken) params.set("id_token_hint", idToken);
  params.set("client_id", clientId);
  params.set("post_logout_redirect_uri", postLogoutRedirectUri);
  return `${issuer}/oidc/v1/end_session?${params.toString()}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => createAuthConfig());

// Extend the types
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
    error?: string;
    user?: User;
  }
}
