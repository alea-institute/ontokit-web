"use client";

import { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";

/**
 * Watches the session for token refresh errors and forces re-authentication.
 * When the Zitadel refresh token expires, NextAuth sets session.error to
 * "RefreshAccessTokenError". Without this guard, the user appears signed in
 * but every API call fails with "Signature has expired".
 */
export function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      // Refresh token is dead — force a fresh OIDC sign-in
      signIn("zitadel");
    }
  }, [session?.error]);

  return null;
}
