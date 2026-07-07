import NextAuth from "next-auth";
import type { NextAuthConfig, User } from "next-auth";
import "next-auth/jwt";
import { randomBytes } from "crypto";
import { isAuthActive, isZitadelConfigured } from "@/lib/auth-mode";

// NextAuth needs a signing secret to boot. Only auto-supply one when Zitadel is
// NOT configured — in that case no real OIDC sessions exist, so there is nothing
// to protect. When Zitadel IS configured (in ANY auth mode, including "optional"),
// a real NEXTAUTH_SECRET is mandatory (enforced by lib/env.ts): otherwise a
// known/committed secret would let anyone forge a valid session JWT and
// impersonate a signed-in user. The fallback is randomized per process so it is
// never a replayable value.
if (!isZitadelConfigured() && !process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
}

// Zitadel provider configuration
const zitadelProvider = {
  id: "zitadel",
  name: "Zitadel",
  type: "oidc" as const,
  issuer: process.env.ZITADEL_ISSUER || "http://localhost:8080",
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

export const authConfig: NextAuthConfig = {
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
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          user,
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

          return {
            ...token,
            accessToken: tokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
            refreshToken: tokens.refresh_token ?? token.refreshToken,
          };
        } catch (error) {
          console.error("Error refreshing access token", error);
          return { ...token, error: "RefreshAccessTokenError" };
        }
      }

      return token;
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

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
