/**
 * Shared Next.js navigation mock for component tests.
 *
 * Usage in test files:
 *   vi.mock("next/navigation", () => nextNavigationMock());
 *   vi.mock("next/link", () => nextLinkMock);
 *   vi.mock("next-auth/react", () => nextAuthMock());
 */
import { vi } from "vitest";
import React from "react";

export function nextNavigationMock(overrides?: {
  pathname?: string;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
}) {
  const push = vi.fn();
  const replace = vi.fn();
  const back = vi.fn();
  const searchParams = new URLSearchParams(overrides?.searchParams);

  return {
    useRouter: () => ({ push, replace, back, refresh: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => overrides?.pathname ?? "/",
    useParams: () => overrides?.params ?? {},
    useSearchParams: () => searchParams,
    redirect: vi.fn(),
    notFound: vi.fn(),
    // Expose for assertions
    __push: push,
    __replace: replace,
    __back: back,
  };
}

export const nextLinkMock = {
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
};

export function nextAuthMock(overrides?: {
  status?: "loading" | "authenticated" | "unauthenticated";
  user?: { name?: string; email?: string; image?: string };
  accessToken?: string;
}) {
  const status = overrides?.status ?? "authenticated";
  return {
    useSession: () => ({
      data: status === "authenticated"
        ? {
            user: overrides?.user ?? { name: "Test User", email: "test@example.com" },
            accessToken: overrides?.accessToken ?? "test-token",
            expires: "2099-01-01T00:00:00.000Z",
          }
        : null,
      status,
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
}
