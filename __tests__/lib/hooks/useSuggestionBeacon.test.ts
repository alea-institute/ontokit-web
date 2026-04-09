import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSuggestionBeacon } from "@/lib/hooks/useSuggestionBeacon";

// Mock the suggestionsApi module
vi.mock("@/lib/api/suggestions", () => ({
  suggestionsApi: {
    beacon: vi.fn(),
  },
}));

import { suggestionsApi } from "@/lib/api/suggestions";

const mockedBeacon = suggestionsApi.beacon as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSuggestionBeacon", () => {
  it("registers beforeunload and visibilitychange listeners when enabled", () => {
    const addDocSpy = vi.spyOn(document, "addEventListener");
    const addWinSpy = vi.spyOn(window, "addEventListener");

    const { unmount } = renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "content",
        enabled: true,
      }),
    );

    expect(addDocSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(addWinSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    unmount();
  });

  it("does not register listeners when disabled", () => {
    const addDocSpy = vi.spyOn(document, "addEventListener");
    const addWinSpy = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "content",
        enabled: false,
      }),
    );

    const visibilityCalls = addDocSpy.mock.calls.filter(
      (c) => c[0] === "visibilitychange",
    );
    const beforeunloadCalls = addWinSpy.mock.calls.filter(
      (c) => c[0] === "beforeunload",
    );

    expect(visibilityCalls).toHaveLength(0);
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it("removes listeners on unmount", () => {
    const removeDocSpy = vi.spyOn(document, "removeEventListener");
    const removeWinSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "content",
        enabled: true,
      }),
    );

    unmount();

    expect(removeDocSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(removeWinSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("sends beacon on beforeunload when session is active", () => {
    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "turtle content",
        enabled: true,
      }),
    );

    window.dispatchEvent(new Event("beforeunload"));

    expect(mockedBeacon).toHaveBeenCalledWith("proj-1", "sess-1", "turtle content", "tok-1");
  });

  it("does not send beacon when sessionId is null", () => {
    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: null,
        beaconToken: null,
        getCurrentContent: () => "content",
        enabled: true,
      }),
    );

    window.dispatchEvent(new Event("beforeunload"));

    expect(mockedBeacon).not.toHaveBeenCalled();
  });

  it("does not send beacon when getCurrentContent returns null", () => {
    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => null,
        enabled: true,
      }),
    );

    window.dispatchEvent(new Event("beforeunload"));

    expect(mockedBeacon).not.toHaveBeenCalled();
  });

  it("sends beacon on visibilitychange to hidden", () => {
    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "content",
        enabled: true,
      }),
    );

    // Simulate visibility change to hidden
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockedBeacon).toHaveBeenCalledWith("proj-1", "sess-1", "content", "tok-1");

    // Restore
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
  });

  it("does not send beacon on visibilitychange to visible", () => {
    renderHook(() =>
      useSuggestionBeacon({
        projectId: "proj-1",
        sessionId: "sess-1",
        beaconToken: "tok-1",
        getCurrentContent: () => "content",
        enabled: true,
      }),
    );

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockedBeacon).not.toHaveBeenCalled();
  });

  it("uses latest ref values without re-registering listeners", () => {
    const { rerender } = renderHook(
      ({ sessionId, getCurrentContent }) =>
        useSuggestionBeacon({
          projectId: "proj-1",
          sessionId,
          beaconToken: sessionId,
          getCurrentContent,
          enabled: true,
        }),
      {
        initialProps: {
          sessionId: "sess-1" as string | null,
          getCurrentContent: (() => "old content") as () => string | null,
        },
      },
    );

    // Update to new values
    rerender({
      sessionId: "sess-2",
      getCurrentContent: () => "new content",
    });

    window.dispatchEvent(new Event("beforeunload"));

    expect(mockedBeacon).toHaveBeenCalledWith("proj-1", "sess-2", "new content", "sess-2");
  });
});
