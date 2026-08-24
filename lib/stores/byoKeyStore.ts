import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// BYO provider API keys are user secrets. They are deliberately NOT sent to our
// backend for storage (they are billed directly to the user and used only via
// the ephemeral X-BYO-API-Key request header). Client-side we hold them in
// sessionStorage, NOT localStorage: sessionStorage is cleared when the tab
// closes, so a key does not persist across sessions or outlive sign-out on a
// shared machine. This narrows the exposure window while keeping the key
// available across in-session navigations (settings → editor).

interface BYOKeyEntry {
  provider: string;
  key: string;
  validatedAt: string | null; // ISO timestamp of last successful validation
}

interface BYOKeyState {
  /** Account that owns every entry in this tab; null is the anonymous scope. */
  ownerId: string | null;
  entries: Record<string, BYOKeyEntry>; // keyed by projectId
  setOwner: (ownerId: string | null) => void;
  setKey: (projectId: string, provider: string, key: string) => void;
  markValidated: (projectId: string) => void;
  clearKey: (projectId: string) => void;
  clearAll: () => void;
  getKey: (projectId: string) => string | null;
  getEntry: (projectId: string) => BYOKeyEntry | null;
}

export const useByoKeyStore = create<BYOKeyState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      entries: {},

      setOwner: (ownerId) =>
        set((state) =>
          state.ownerId === ownerId ? state : { ownerId, entries: {} },
        ),

      setKey: (projectId, provider, key) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [projectId]: { provider, key, validatedAt: null },
          },
        })),

      markValidated: (projectId) =>
        set((s) => {
          const entry = s.entries[projectId];
          if (!entry) return s;
          return {
            entries: {
              ...s.entries,
              [projectId]: { ...entry, validatedAt: new Date().toISOString() },
            },
          };
        }),

      clearKey: (projectId) =>
        set((s) => {
          const entries = { ...s.entries };
          delete entries[projectId];
          return { entries };
        }),

      clearAll: () => set({ entries: {} }),

      getKey: (projectId) => get().entries[projectId]?.key ?? null,

      getEntry: (projectId) => get().entries[projectId] ?? null,
    }),
    {
      name: "ontokit-byo-keys",
      // sessionStorage (not localStorage): keys are cleared when the tab closes
      // and never persist across browser sessions or survive sign-out.
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
