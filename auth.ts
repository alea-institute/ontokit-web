import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import "next-auth/jwt";

// Simple credentials provider for FOLIO (no external OIDC needed)
const credentialsProvider = Credentials({
  name: "FOLIO",
  credentials: {
    username: { label: "Username", type: "text", placeholder: "guest" },
  },
  async authorize(credentials) {
    // Accept any login for the FOLIO viewer
    const username = (credentials?.username as string) || "guest";
    return {
      id: "folio-user",
      name: username,
      email: `${username}@folio.local`,
    };
  },
});

export const authConfig: NextAuthConfig = {
  providers: [credentialsProvider],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        // No real access token needed - API is open
        token.accessToken = "folio-open-access";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      if (token.user) {
        Object.assign(session.user, token.user);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
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
    user?: import("next-auth").User;
  }
}
