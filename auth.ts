import NextAuth from "next-auth";
import type { NextAuthConfig, User } from "next-auth";
import "next-auth/jwt";
import { randomBytes } from "crypto";
import { isAuthActive, isZitadelConfigured } from "@/lib/auth-mode";
import { validateServerEnv } from "@/lib/env";

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
              }
            );

            const tokens = await response.json();

            if (!response.ok) throw tokens;

            // A successful retry supersedes any earlier failure; a retained error
            // would force re-authentication despite valid renewed credentials.
            const { error: _previousError, ...renewable } = token;
            return {
              ...renewable,
              accessToken: tokens.access_token,
              expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
              refreshToken: tokens.refresh_token ?? token.refreshToken,
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
  };
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
    expiresAt?: number;
    error?: string;
    user?: User;
  }
}
