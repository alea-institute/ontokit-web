import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const media = vi.hoisted(() => {
  const query = Object.assign(new EventTarget(), { matches: false, media: "(prefers-color-scheme: dark)" });
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return query;
});
import { ThemeToggle } from "@/components/editor/ThemeToggle";
import { useEditorModeStore } from "@/lib/stores/editorModeStore";

beforeEach(() => { media.matches = false; localStorage.clear(); useEditorModeStore.getState().setTheme("light"); });
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.classList.remove("dark"); });
afterAll(() => vi.unstubAllGlobals());
function osTheme(dark: boolean) {
  act(() => { media.matches = dark; media.dispatchEvent(new Event("change")); });
}

describe("theme toggle, persisted preference and operating-system events", () => {
  it("follows OS changes only in system mode without replacing the persisted preference", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    osTheme(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "System" }).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("ontokit-editor-preferences")!).state.theme).toBe("system");
    osTheme(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    osTheme(false);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    osTheme(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(JSON.parse(localStorage.getItem("ontokit-editor-preferences")!).state.theme).toBe("light");
  });
});
