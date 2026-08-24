import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EditorMode = "standard" | "developer";
export type ThemePreference = "light" | "dark" | "system";

const AUTO_SAVE_TOAST_STORAGE_KEY = "ontokit-auto-save-toast-seen";
const AUTO_SAVE_TOAST_LOCK_NAME = "ontokit-auto-save-toast-claim";

interface EditorModeState {
  editorMode: EditorMode;
  theme: ThemePreference;
  /** Auto-save is always on; this controls only the optional immediate-save affordance. */
  showManualSaveButton: boolean;
  /** Persisted so the auto-save teaching toast is shown once per browser profile. */
  hasSeenAutoSaveToast: boolean;
  /** When true, opening an entity in the editor auto-enters edit mode (no extra "Edit Item" click). */
  preferEditMode: boolean;
  setEditorMode: (mode: EditorMode) => void;
  setTheme: (theme: ThemePreference) => void;
  setShowManualSaveButton: (on: boolean) => void;
  claimAutoSaveTeachingToast: () => Promise<boolean>;
  setPreferEditMode: (on: boolean) => void;
}

/**
 * Apply the resolved theme to the <html> element.
 * Called from the inline boot script, store subscriptions, and store actions.
 */
export function applyThemeToDOM(theme: ThemePreference) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system — follow OS preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export const useEditorModeStore = create<EditorModeState>()(
  persist(
    (set, get) => ({
      editorMode: "standard",
      theme: "system",
      showManualSaveButton: true,
      hasSeenAutoSaveToast: false,
      preferEditMode: false,

      setEditorMode: (mode) => set({ editorMode: mode }),

      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme });
      },

      setShowManualSaveButton: (on) => set({ showManualSaveButton: on }),

      claimAutoSaveTeachingToast: async () => {
        const claim = () => {
          let claimedInAnotherTab = false;
          try {
            claimedInAnotherTab = localStorage.getItem(AUTO_SAVE_TOAST_STORAGE_KEY) === "true";
          } catch {
            // Persisted Zustand state remains the fallback when storage is unavailable.
          }

          if (claimedInAnotherTab || get().hasSeenAutoSaveToast) return false;

          try {
            localStorage.setItem(AUTO_SAVE_TOAST_STORAGE_KEY, "true");
          } catch {
            // The in-memory flag still guarantees once-only behavior in this tab.
          }
          set({ hasSeenAutoSaveToast: true });
          return true;
        };

        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request(AUTO_SAVE_TOAST_LOCK_NAME, claim);
        }
        return claim();
      },

      setPreferEditMode: (on) => set({ preferEditMode: on }),
    }),
    {
      name: "ontokit-editor-preferences",
      version: 1,
      migrate: (persistedState) => {
        const legacy = persistedState as Partial<EditorModeState> & {
          hideSaveButton?: boolean;
        };
        const { hideSaveButton, ...current } = legacy;

        return {
          ...current,
          // Existing users keep their chosen button visibility. Blobs that
          // predate the old setting retain its original visible-button default.
          showManualSaveButton:
            typeof legacy.showManualSaveButton === "boolean"
              ? legacy.showManualSaveButton
              : hideSaveButton !== true,
          hasSeenAutoSaveToast: legacy.hasSeenAutoSaveToast ?? false,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDOM(state.theme);
        }
      },
    },
  ),
);

// ── Module-level theme sync ──────────────────────────────────────────
// Runs outside React lifecycle — no hydration timing issues.
// The inline <script> in layout.tsx handles the very first paint.
// These subscriptions handle everything after JS loads.
if (typeof window !== "undefined") {
  // Re-apply after persist finishes hydrating from localStorage
  useEditorModeStore.persist.onFinishHydration(() => {
    applyThemeToDOM(useEditorModeStore.getState().theme);
  });

  // Re-apply whenever theme changes in the store
  useEditorModeStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) {
      applyThemeToDOM(state.theme);
    }
  });

  // Listen for OS preference changes (relevant when theme is "system")
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useEditorModeStore.getState().theme === "system") {
      applyThemeToDOM("system");
    }
  });
}
