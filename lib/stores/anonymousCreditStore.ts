/**
 * Anonymous suggestion stores
 *
 * Two persisted Zustand stores for anonymous suggestion sessions:
 *
 * 1. useAnonymousCreditStore — remembers submitter name/email in localStorage
 *    so repeat anonymous contributors don't have to retype their info.
 *
 * 2. useAnonymousTokenStore — persists the anonymous session token, sessionId,
 *    branch, and 24-hour lifetime per projectId in sessionStorage so the
 *    session survives page navigations without surviving the browser tab.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// --- Credit store ---

interface AnonymousCreditState {
  name: string | null;
  email: string | null;
  setCredit: (name: string | null, email: string | null) => void;
  clearCredit: () => void;
  hasCredit: () => boolean;
}

/**
 * Persisted store for optional submitter credit info (name + email).
 * Pre-fills the CreditModal on subsequent submissions.
 * Stored under localStorage key "ontokit-anonymous-credit".
 */
export const useAnonymousCreditStore = create<AnonymousCreditState>()(
  persist(
    (set, get) => ({
      name: null,
      email: null,

      setCredit: (name, email) => set({ name, email }),

      clearCredit: () => set({ name: null, email: null }),

      hasCredit: () => {
        const { name, email } = get();
        return !!(name || email);
      },
    }),
    {
      name: "ontokit-anonymous-credit",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// --- Anonymous token store ---

export const ANONYMOUS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS_TOKEN_STORAGE_KEY = "ontokit-anonymous-token";

function anonymousTokenStorage(): Storage {
  if (typeof window === "undefined") throw new Error("Browser storage is unavailable");
  // This key used to live in durable localStorage. Remove that legacy bearer
  // token while selecting the tab-scoped replacement.
  try {
    window.localStorage.removeItem(ANONYMOUS_TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be disabled; createJSONStorage already degrades gracefully.
  }
  return window.sessionStorage;
}

interface AnonymousTokenEntry {
  token: string;
  sessionId: string;
  branch: string;
  issuedAt: number;
  expiresAt: number;
}

interface AnonymousTokenState {
  tokens: Record<string, AnonymousTokenEntry>;
  setToken: (
    projectId: string,
    token: string,
    sessionId: string,
    branch: string,
    issuedAt?: number,
  ) => void;
  getToken: (projectId: string) => AnonymousTokenEntry | null;
  clearToken: (projectId: string) => void;
}

/**
 * Persisted store for anonymous session tokens, keyed by projectId.
 * Allows resuming an in-progress anonymous session after page reload/navigation.
 * Stored under sessionStorage key "ontokit-anonymous-token". Entries without
 * lifetime metadata (including legacy persisted entries) are not restorable.
 */
export const useAnonymousTokenStore = create<AnonymousTokenState>()(
  persist(
    (set, get) => ({
      tokens: {},

      setToken: (projectId, token, sessionId, branch, issuedAt = Date.now()) => {
        const normalizedIssuedAt = Number.isFinite(issuedAt) ? issuedAt : Date.now();
        set((state) => ({
          tokens: {
            ...state.tokens,
            [projectId]: {
              token,
              sessionId,
              branch,
              issuedAt: normalizedIssuedAt,
              expiresAt: normalizedIssuedAt + ANONYMOUS_TOKEN_TTL_MS,
            },
          },
        }));
      },

      getToken: (projectId) => {
        const entry = get().tokens[projectId];
        if (!entry) return null;

        if (
          !Number.isFinite(entry.issuedAt) ||
          !Number.isFinite(entry.expiresAt) ||
          entry.expiresAt <= entry.issuedAt ||
          entry.expiresAt <= Date.now()
        ) {
          set((state) => {
            const { [projectId]: _, ...rest } = state.tokens;
            return { tokens: rest };
          });
          return null;
        }

        return entry;
      },

      clearToken: (projectId) =>
        set((state) => {
          const { [projectId]: _, ...rest } = state.tokens;
          return { tokens: rest };
        }),
    }),
    {
      name: ANONYMOUS_TOKEN_STORAGE_KEY,
      storage: createJSONStorage(anonymousTokenStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        for (const projectId of Object.keys(state.tokens)) state.getToken(projectId);
      },
    },
  ),
);
