"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { shouldShowAuthUI } from "@/lib/auth-mode";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

// Zitadel configuration
const ZITADEL_ISSUER = process.env.NEXT_PUBLIC_ZITADEL_ISSUER;
const ZITADEL_CLIENT_ID = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || "";

const FEDERATED_LOGOUT_PATH = "/api/auth/federated-logout";
// A stalled server call must not leave the user signed in without feedback.
const FEDERATED_LOGOUT_TIMEOUT_MS = 5_000;

async function requestHintedUrl(endSession: string, fallback: string, signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch(FEDERATED_LOGOUT_PATH, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { url?: unknown } | null;
    const url = body?.url;
    // Only ever navigate to the configured issuer's end-session endpoint.
    if (typeof url === "string" && url.startsWith(`${endSession}?`)) return url;
  } catch {
    // Network, abort or parse failure: the client-only URL still ends the provider session.
  }
  return fallback;
}

// Prefer the server-built URL carrying id_token_hint; fall back to the
// client_id-only URL (the provider then asks which session to end). The
// request and body read are bounded; on timeout the fallback wins the race even
// if the aborted request never settles.
async function resolveEndSessionUrl(issuer: string): Promise<string> {
  const endSession = `${issuer}/oidc/v1/end_session`;
  const postLogoutRedirectUri = encodeURIComponent(window.location.origin);
  const fallback = `${endSession}?client_id=${ZITADEL_CLIENT_ID}&post_logout_redirect_uri=${postLogoutRedirectUri}`;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(fallback);
    }, FEDERATED_LOGOUT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([requestHintedUrl(endSession, fallback, controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export function UserMenu() {
  const { data: session, status } = useSession();
  // Whether sign-in affordances are shown — shared predicate with header.tsx.
  const showAuthUI = shouldShowAuthUI();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Handle federated logout (sign out from both NextAuth and Zitadel)
  const handleSignOut = async () => {
    setIsOpen(false);
    // Secrets belong to the current account boundary. Clear synchronously so
    // a same-tab sign-out/sign-in cannot expose them to the next account, even
    // if the federated logout request fails after NextAuth is cleared.
    useByoKeyStore.getState().clearAll();
    if (!ZITADEL_ISSUER) {
      await signOut({ redirect: false });
      console.error(
        "Cannot complete federated logout: NEXT_PUBLIC_ZITADEL_ISSUER is not configured",
      );
      return;
    }
    // The server builds the end-session URL with id_token_hint while the session
    // cookie still exists, so the provider ends its session without a chooser.
    const endSessionUrl = await resolveEndSessionUrl(ZITADEL_ISSUER);
    // Then clear the NextAuth session and leave through the provider.
    await signOut({ redirect: false });
    window.location.href = endSessionUrl;
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
    );
  }

  if (!session) {
    if (!showAuthUI) return null;
    return (
      <button
        onClick={() => signIn("zitadel")}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
            {session.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {session.user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {session.user?.email}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="block w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
