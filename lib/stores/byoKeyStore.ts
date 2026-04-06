import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface BYOKeyEntry {
  provider: string;
  key: string;
  validatedAt: string | null; // ISO timestamp of last successful validation
}

interface BYOKeyState {
  entries: Record<string, BYOKeyEntry>; // keyed by projectId
  setKey: (projectId: string, provider: string, key: string) => void;
  markValidated: (projectId: string) => void;
  clearKey: (projectId: string) => void;
  getKey: (projectId: string) => string | null;
  getEntry: (projectId: string) => BYOKeyEntry | null;
}

export const useByoKeyStore = create<BYOKeyState>()(
  persist(
    (set, get) => ({
      entries: {},

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

      getKey: (projectId) => get().entries[projectId]?.key ?? null,

      getEntry: (projectId) => get().entries[projectId] ?? null,
    }),
    {
      name: "ontokit-byo-keys",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
