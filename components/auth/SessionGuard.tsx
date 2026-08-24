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
      // Refresh token is dead — force a fresh OIDC sign-in. The callbackUrl is
      // what brings the user back to the page they were on: a forced re-auth
      // that lands them on the home page loses whatever they had open (an
      // expanded PR Party card, a half-typed question), and the loss is
      // invisible to them because they never chose to sign out.
      signIn("zitadel", { callbackUrl: window.location.href });
    }
  }, [session?.error]);

  return null;
}
