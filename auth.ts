import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

// Zitadel provider configuration
const zitadelProvider = {
  id: "zitadel",
  name: "Zitadel",
  type: "oidc" as const,
  issuer: process.env.ZITADEL_ISSUER,
  clientId: process.env.ZITADEL_CLIENT_ID,
  clientSecret: process.env.ZITADEL_CLIENT_SECRET,
  authorization: {
    params: {
      scope: "openid profile email offline_access",
    },
  },
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name || profile.preferred_username,
      email: profile.email,
      image: profile.picture,
    };
  },
};

export const authConfig: NextAuthConfig = {
  providers: [zitadelProvider],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Extend the session type to include accessToken
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}
