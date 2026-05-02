import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// editorModeStore subscribes to matchMedia at module load — provide a stub
// before the hook (and therefore the store) are imported.
vi.hoisted(() => {
  (globalThis as Record<string, unknown>).matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  // Zustand persist middleware needs a working localStorage at module-load.
  if (
    !globalThis.localStorage ||
    typeof globalThis.localStorage.setItem !== "function"
  ) {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

import { useProjectHomeHref } from "@/lib/hooks/useProjectHomeHref";
import { useSelectionStore } from "@/lib/stores/selectionStore";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";

// next-auth: simple session-with-token mock; individual tests can override.
let mockSession: { accessToken?: string } | null = { accessToken: "tok" };
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession }),
}));

// next/navigation: only useSearchParams is consumed by the hook.
let mockSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

// useProject: mocked so we can dial canSuggest via derivePermissions.
const mockUseProject = vi.fn();
const mockDerivePermissions = vi.fn();
vi.mock("@/lib/hooks/useProject", () => ({
  useProject: (...args: unknown[]) => mockUseProject(...args),
  derivePermissions: (...args: unknown[]) => mockDerivePermissions(...args),
}));

const ENCODED_PERSON = encodeURIComponent("http://example.org/Person");
const ENCODED_HAS_NAME = encodeURIComponent("http://example.org/hasName");
const ENCODED_ALICE = encodeURIComponent("http://example.org/alice");

describe("useProjectHomeHref", () => {
  beforeEach(() => {
    mockSession = { accessToken: "tok" };
    mockSearch = "";
    useSelectionStore.getState().clear();
    useEditorModeStore.setState({ preferEditMode: false });
    mockUseProject.mockReturnValue({ project: { id: "proj-1" } });
    // Default: user can suggest (covers most assertions).
    mockDerivePermissions.mockReturnValue({ canSuggest: true });
  });

  it("returns the bare viewer URL when no selection is set", () => {
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1");
  });

  it("returns the editor URL when preferEditMode is on and user can suggest", () => {
    useEditorModeStore.setState({ preferEditMode: true });
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1/editor");
  });

  it("routes prefer-edit-mode users to the viewer when they cannot suggest", () => {
    useEditorModeStore.setState({ preferEditMode: true });
    mockDerivePermissions.mockReturnValue({ canSuggest: false });
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1");
  });

  it("routes back to the editor when the store records mode='editor', even with preferEditMode off", () => {
    // Regression: preferEditMode false used to force viewer-routing, so a user
    // who switched to the editor mid-session via the switcher would lose the
    // mode on Back-to-project.
    useEditorModeStore.setState({ preferEditMode: false });
    useSelectionStore.getState().setMode("editor");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1/editor");
  });

  it("routes back to the viewer when the store records mode='viewer', even with preferEditMode on", () => {
    useEditorModeStore.setState({ preferEditMode: true });
    useSelectionStore.getState().setMode("viewer");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1");
  });

  it("permission-gates editor routing even when the store says mode='editor'", () => {
    useSelectionStore.getState().setMode("editor");
    mockDerivePermissions.mockReturnValue({ canSuggest: false });
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe("/projects/proj-1");
  });

  it("appends a class IRI selection from the store", () => {
    useSelectionStore.getState().setSelection("http://example.org/Person", "class");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1?classIri=${ENCODED_PERSON}`);
  });

  it("appends a property IRI selection from the store", () => {
    useSelectionStore.getState().setSelection("http://example.org/hasName", "property");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1?propertyIri=${ENCODED_HAS_NAME}`);
  });

  it("appends an individual IRI selection from the store", () => {
    useSelectionStore.getState().setSelection("http://example.org/alice", "individual");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1?individualIri=${ENCODED_ALICE}`);
  });

  it("appends selection to the editor URL when preferEditMode is on", () => {
    useEditorModeStore.setState({ preferEditMode: true });
    useSelectionStore.getState().setSelection("http://example.org/Person", "class");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1/editor?classIri=${ENCODED_PERSON}`);
  });

  it("falls back to URL params when the store is empty", () => {
    mockSearch = `individualIri=${ENCODED_ALICE}`;
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1?individualIri=${ENCODED_ALICE}`);
  });

  it("prefers the store over URL params when both are set (store wins)", () => {
    mockSearch = `classIri=${encodeURIComponent("http://example.org/Stale")}`;
    useSelectionStore.getState().setSelection("http://example.org/hasName", "property");
    const { result } = renderHook(() => useProjectHomeHref("proj-1"));
    expect(result.current).toBe(`/projects/proj-1?propertyIri=${ENCODED_HAS_NAME}`);
  });
});
