import { describe, expect, it, beforeEach, vi } from "vitest";

// The store subscribes to matchMedia at module load time.
vi.hoisted(() => {
  const mockMatchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  (globalThis as Record<string, unknown>).matchMedia = mockMatchMedia;

});

import { useEditorModeStore, applyThemeToDOM } from "@/lib/stores/editorModeStore";

describe("applyThemeToDOM", () => {
  let addSpy: ReturnType<typeof vi.fn>;
  let removeSpy: ReturnType<typeof vi.fn>;
  let toggleSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSpy = vi.fn();
    removeSpy = vi.fn();
    toggleSpy = vi.fn();
    Object.defineProperty(document.documentElement, "classList", {
      value: { add: addSpy, remove: removeSpy, toggle: toggleSpy },
      writable: true,
      configurable: true,
    });
  });

  it("adds 'dark' class for dark theme", () => {
    applyThemeToDOM("dark");
    expect(addSpy).toHaveBeenCalledWith("dark");
  });

  it("removes 'dark' class for light theme", () => {
    applyThemeToDOM("light");
    expect(removeSpy).toHaveBeenCalledWith("dark");
  });

  it("toggles 'dark' class based on OS preference for system theme", () => {
    // Mock matchMedia to return prefersDark = true
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      writable: true,
      configurable: true,
    });

    applyThemeToDOM("system");
    expect(toggleSpy).toHaveBeenCalledWith("dark", true);
  });

  it("toggles off 'dark' class when OS prefers light", () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: false }),
      writable: true,
      configurable: true,
    });

    applyThemeToDOM("system");
    expect(toggleSpy).toHaveBeenCalledWith("dark", false);
  });
});

describe("useEditorModeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorModeStore.setState({
      editorMode: "standard",
      theme: "system",
      showManualSaveButton: true,
      hasSeenAutoSaveToast: false,
      preferEditMode: false,
    });
  });

  describe("defaults", () => {
    it("has correct initial state", () => {
      const state = useEditorModeStore.getState();
      expect(state.editorMode).toBe("standard");
      expect(state.theme).toBe("system");
      expect(state.showManualSaveButton).toBe(true);
      expect(state.hasSeenAutoSaveToast).toBe(false);
      expect(state.preferEditMode).toBe(false);
      expect("hideSaveButton" in state).toBe(false);
      expect("autoSaveEnabled" in state).toBe(false);
    });
  });

  describe("setEditorMode", () => {
    it("switches to developer mode", () => {
      useEditorModeStore.getState().setEditorMode("developer");
      expect(useEditorModeStore.getState().editorMode).toBe("developer");
    });

    it("switches back to standard mode", () => {
      useEditorModeStore.getState().setEditorMode("developer");
      useEditorModeStore.getState().setEditorMode("standard");
      expect(useEditorModeStore.getState().editorMode).toBe("standard");
    });
  });

  describe("setTheme", () => {
    beforeEach(() => {
      // Stub classList to avoid errors in applyThemeToDOM
      Object.defineProperty(document.documentElement, "classList", {
        value: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
        writable: true,
        configurable: true,
      });
    });

    it("sets the theme to dark and adds 'dark' class", () => {
      useEditorModeStore.getState().setTheme("dark");
      expect(useEditorModeStore.getState().theme).toBe("dark");
      expect(document.documentElement.classList.add).toHaveBeenCalledWith("dark");
    });

    it("sets the theme to light and removes 'dark' class", () => {
      useEditorModeStore.getState().setTheme("light");
      expect(useEditorModeStore.getState().theme).toBe("light");
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith("dark");
    });
  });

  describe("setShowManualSaveButton", () => {
    it("hides the optional manual save button without disabling auto-save", () => {
      useEditorModeStore.getState().setShowManualSaveButton(false);
      expect(useEditorModeStore.getState().showManualSaveButton).toBe(false);
      expect("autoSaveEnabled" in useEditorModeStore.getState()).toBe(false);
    });

    it("shows the save button again", () => {
      useEditorModeStore.getState().setShowManualSaveButton(false);
      useEditorModeStore.getState().setShowManualSaveButton(true);
      expect(useEditorModeStore.getState().showManualSaveButton).toBe(true);
    });

    it("persists the preference through the real localStorage layer", async () => {
      useEditorModeStore.getState().setShowManualSaveButton(false);
      expect(JSON.parse(localStorage.getItem("ontokit-editor-preferences")!).state.showManualSaveButton).toBe(false);

      const persisted = localStorage.getItem("ontokit-editor-preferences")!;
      useEditorModeStore.setState({ showManualSaveButton: true });
      localStorage.setItem("ontokit-editor-preferences", persisted);
      await useEditorModeStore.persist.rehydrate();

      expect(useEditorModeStore.getState().showManualSaveButton).toBe(false);
    });

    it("migrates a legacy hidden-button blob to safe auto-save-only state", async () => {
      localStorage.setItem("ontokit-editor-preferences", JSON.stringify({
        state: { editorMode: "standard", theme: "system", hideSaveButton: true, preferEditMode: false },
        version: 0,
      }));

      await useEditorModeStore.persist.rehydrate();

      const state = useEditorModeStore.getState();
      expect(state.showManualSaveButton).toBe(false);
      expect("hideSaveButton" in state).toBe(false);
      expect("autoSaveEnabled" in state).toBe(false);
    });

    it("migrates a blob predating hideSaveButton to the visible legacy default", async () => {
      localStorage.setItem("ontokit-editor-preferences", JSON.stringify({
        state: { editorMode: "developer", theme: "dark" },
        version: 0,
      }));

      await useEditorModeStore.persist.rehydrate();

      expect(useEditorModeStore.getState().showManualSaveButton).toBe(true);
    });
  });

  describe("claimAutoSaveTeachingToast", () => {
    it("uses the dedicated storage marker to coordinate across stale tabs", async () => {
      localStorage.setItem("ontokit-auto-save-toast-seen", "true");
      useEditorModeStore.setState({ hasSeenAutoSaveToast: false });

      await expect(useEditorModeStore.getState().claimAutoSaveTeachingToast()).resolves.toBe(false);
      expect(useEditorModeStore.getState().hasSeenAutoSaveToast).toBe(false);
    });
  });

  describe("setPreferEditMode", () => {
    it("turns on the prefer-edit-mode preference", () => {
      useEditorModeStore.getState().setPreferEditMode(true);
      expect(useEditorModeStore.getState().preferEditMode).toBe(true);
    });

    it("turns the preference back off", () => {
      useEditorModeStore.getState().setPreferEditMode(true);
      useEditorModeStore.getState().setPreferEditMode(false);
      expect(useEditorModeStore.getState().preferEditMode).toBe(false);
    });
  });
});
