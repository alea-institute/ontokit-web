"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/editor/ThemeToggle";
import { cn } from "@/lib/utils";
import { shouldShowAuthUI } from "@/lib/auth-mode";
import { usePRPartyCapabilities } from "@/lib/hooks/usePRPartyCapabilities";

const navLinks: { href: string; label: string; reviewerOnly?: boolean }[] = [
  { href: "/", label: "Projects" },
  // The first role-gated nav entry. Hidden while the capability query is in
  // flight as well as for non-reviewers: `isReviewer` fails closed, so a link
  // into a 403 can never flash on screen ahead of the permission behind it.
  { href: "/pr-party", label: "Review", reviewerOnly: true },
  { href: "/info", label: "Info" },
  { href: "/docs", label: "Documentation" },
  { href: "/api-docs", label: "API Reference" },
];

export function Header() {
  const pathname = usePathname();
  // Whether to show sign-in affordances (client-safe, reads build-time
  // NEXT_PUBLIC_* flags). Shared predicate with UserMenu to avoid drift.
  const showAuthUI = shouldShowAuthUI();
  const { isReviewer } = usePRPartyCapabilities();
  const visibleLinks = navLinks.filter((link) => !link.reviewerOnly || isReviewer);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm supports-backdrop-filter:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              OntoKit
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {visibleLinks.map(({ href, label }) => {
              const isActive = href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "text-sm font-medium transition-colors px-3 py-1.5 rounded-md",
                    isActive
                      ? "bg-blue-100! text-blue-900! dark:bg-blue-900/50! dark:text-blue-100!"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {showAuthUI && <NotificationBell />}
          {showAuthUI && <UserMenu />}
        </div>
      </div>
    </header>
  );
}
