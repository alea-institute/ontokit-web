import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EditorMode = "standard" | "developer";
export type ThemePreference = "light" | "dark" | "system";

interface EditorModeState {
  editorMode: EditorMode;
  theme: ThemePreference;
  setEditorMode: (mode: EditorMode) => void;
  setTheme: (theme: ThemePreference) => void;
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
    (set) => ({
      editorMode: "standard",
      theme: "system",

      setEditorMode: (mode) => set({ editorMode: mode }),

      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme });
      },
    }),
    {
      name: "ontokit-editor-preferences",
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
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (useEditorModeStore.getState().theme === "system") {
        applyThemeToDOM("system");
      }
    });
}
