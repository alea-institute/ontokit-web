import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isMobileDetailEntry,
  isSinglePaneViewport,
  MOBILE_DETAIL_HISTORY_KEY,
  pushMobileDetailEntry,
  mobilePaneVisibility,
  mobileSelectionKey,
  resolveMobilePane,
} from "@/lib/editor/mobilePane";

describe("resolveMobilePane", () => {
  const key = mobileSelectionKey("classes", "http://example.org/A");

  it("shows the tree when nothing is selected", () => {
    expect(resolveMobilePane({ selectedIri: null, selectionKey: mobileSelectionKey("classes", null) })).toBe("tree");
    expect(resolveMobilePane({ selectedIri: undefined, selectionKey: "classes:" })).toBe("tree");
  });

  it("shows the detail panel when an entity is selected", () => {
    expect(resolveMobilePane({ selectedIri: "http://example.org/A", selectionKey: key })).toBe("detail");
  });

  it("shows the tree after the visitor backs out of the current selection", () => {
    expect(resolveMobilePane({ selectedIri: "http://example.org/A", selectionKey: key, dismissedKey: key })).toBe("tree");
  });

  it("returns to the detail panel once the selection changes", () => {
    const next = mobileSelectionKey("classes", "http://example.org/B");
    expect(resolveMobilePane({ selectedIri: "http://example.org/B", selectionKey: next, dismissedKey: key })).toBe("detail");
  });

  it("treats the graph as part of the detail pane", () => {
    expect(resolveMobilePane({ selectedIri: null, selectionKey: "classes:", showGraph: true })).toBe("detail");
  });

  it("keys selections per tab", () => {
    expect(mobileSelectionKey("classes", "x")).not.toBe(mobileSelectionKey("properties", "x"));
  });
});

describe("mobilePaneVisibility", () => {
  it("hides only the inactive pane, and only below md", () => {
    expect(mobilePaneVisibility("tree")).toEqual({ tree: "", detail: "max-md:hidden" });
    expect(mobilePaneVisibility("detail")).toEqual({ tree: "max-md:hidden", detail: "" });
  });
});

describe("isSinglePaneViewport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the md media query", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    expect(isSinglePaneViewport()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(width < 48rem)");
  });

  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isSinglePaneViewport()).toBe(false);
  });
});

describe("mobile detail history entries", () => {
  afterEach(() => {
    window.history.replaceState(null, "");
  });

  it("recognises only entries it marked", () => {
    expect(isMobileDetailEntry(null)).toBe(false);
    expect(isMobileDetailEntry("detail")).toBe(false);
    expect(isMobileDetailEntry({ __NA: true })).toBe(false);
    expect(isMobileDetailEntry({ [MOBILE_DETAIL_HISTORY_KEY]: "detail" })).toBe(true);
  });

  it("pushes one same-URL entry that keeps the router's state", () => {
    window.history.replaceState({ __NA: true, tree: "t" }, "", "/projects/p?classIri=x");
    const before = window.history.length;
    const href = window.location.href;

    expect(pushMobileDetailEntry()).toBe(true);
    expect(window.history.length).toBe(before + 1);
    expect(window.location.href).toBe(href);
    expect(window.history.state).toEqual({ __NA: true, tree: "t", [MOBILE_DETAIL_HISTORY_KEY]: "detail" });

    // Already on a detail entry: no second push.
    expect(pushMobileDetailEntry()).toBe(false);
    expect(window.history.length).toBe(before + 1);
  });
});
