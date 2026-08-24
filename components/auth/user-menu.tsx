"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { shouldShowAuthUI } from "@/lib/auth-mode";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";

// Zitadel configuration
const ZITADEL_ISSUER = process.env.NEXT_PUBLIC_ZITADEL_ISSUER || "http://localhost:8080";
const ZITADEL_CLIENT_ID = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || "";

export function UserMenu() {
  const { data: session, status } = useSession();
  // Whether sign-in affordances are shown — shared predicate with header.tsx.
  const showAuthUI = shouldShowAuthUI();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountId = session?.user?.id ?? session?.user?.email ?? null;

  // Bind tab-scoped secrets to the settled account before browser paint. A
  // direct same-tab account replacement (not only this menu's logout path)
  // clears keys when the stable session identity changes.
  useLayoutEffect(() => {
    if (status !== "loading") useByoKeyStore.getState().setOwner(accountId);
  }, [accountId, status]);

  // Handle federated logout (sign out from both NextAuth and Zitadel)
  const handleSignOut = async () => {
    setIsOpen(false);
    // Secrets belong to the current account boundary. Clear synchronously so
    // a same-tab sign-out/sign-in cannot expose them to the next account, even
    // if the federated logout request fails after NextAuth is cleared.
    useByoKeyStore.getState().clearAll();
    // First clear the NextAuth session
    await signOut({ redirect: false });
    // Then redirect to Zitadel's end_session endpoint with client_id for proper redirect
    const postLogoutRedirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `${ZITADEL_ISSUER}/oidc/v1/end_session?client_id=${ZITADEL_CLIENT_ID}&post_logout_redirect_uri=${postLogoutRedirectUri}`;
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
