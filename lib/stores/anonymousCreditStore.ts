/**
 * Anonymous suggestion stores
 *
 * Two persisted Zustand stores for anonymous suggestion sessions:
 *
 * 1. useAnonymousCreditStore — remembers submitter name/email in localStorage
 *    so repeat anonymous contributors don't have to retype their info.
 *
 * 2. useAnonymousTokenStore — persists the anonymous session token, sessionId,
 *    and branch per projectId so the session survives page navigations.
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

interface AnonymousTokenEntry {
  token: string;
  sessionId: string;
  branch: string;
}

interface AnonymousTokenState {
  tokens: Record<string, AnonymousTokenEntry>;
  setToken: (
    projectId: string,
    token: string,
    sessionId: string,
    branch: string,
  ) => void;
  getToken: (projectId: string) => AnonymousTokenEntry | null;
  clearToken: (projectId: string) => void;
}

/**
 * Persisted store for anonymous session tokens, keyed by projectId.
 * Allows resuming an in-progress anonymous session after page reload/navigation.
 * Stored under localStorage key "ontokit-anonymous-token".
 */
export const useAnonymousTokenStore = create<AnonymousTokenState>()(
  persist(
    (set, get) => ({
      tokens: {},

      setToken: (projectId, token, sessionId, branch) =>
        set((state) => ({
          tokens: {
            ...state.tokens,
            [projectId]: { token, sessionId, branch },
          },
        })),

      getToken: (projectId) => get().tokens[projectId] ?? null,

      clearToken: (projectId) =>
        set((state) => {
          const { [projectId]: _, ...rest } = state.tokens;
          return { tokens: rest };
        }),
    }),
    {
      name: "ontokit-anonymous-token",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
