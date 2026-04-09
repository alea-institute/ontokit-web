import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { ToastProvider, useToast } from "@/lib/context/ToastContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ToastProvider, null, children);
}

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("throws when useToast is used outside ToastProvider", () => {
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider"
    );
    spy.mockRestore();
  });

  it("starts with an empty toast list", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toEqual([]);
  });

  describe("convenience methods", () => {
    it("success() adds a success toast", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.success("Done", "Saved successfully");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe("success");
      expect(result.current.toasts[0].title).toBe("Done");
      expect(result.current.toasts[0].description).toBe("Saved successfully");
    });

    it("error() adds an error toast", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.error("Failed");
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe("error");
      expect(result.current.toasts[0].title).toBe("Failed");
    });

    it("warning() adds a warning toast", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.warning("Caution");
      });

      expect(result.current.toasts[0].type).toBe("warning");
    });

    it("info() adds an info toast", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.info("FYI", "Some details");
      });

      expect(result.current.toasts[0].type).toBe("info");
      expect(result.current.toasts[0].description).toBe("Some details");
    });
  });

  describe("addToast", () => {
    it("returns a unique id string", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      let id1: string = "";
      let id2: string = "";
      act(() => {
        id1 = result.current.addToast({ type: "info", title: "A" });
        id2 = result.current.addToast({ type: "info", title: "B" });
      });

      expect(typeof id1).toBe("string");
      expect(id1).not.toBe(id2);
    });

    it("adds multiple toasts", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.success("First");
        result.current.error("Second");
        result.current.info("Third");
      });

      expect(result.current.toasts).toHaveLength(3);
    });
  });

  describe("removeToast", () => {
    it("removes a toast by id", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      let id: string = "";
      act(() => {
        id = result.current.success("To remove");
        result.current.info("To keep");
      });

      expect(result.current.toasts).toHaveLength(2);

      act(() => {
        result.current.removeToast(id);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe("To keep");
    });

    it("does nothing when removing a non-existent id", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.success("Existing");
      });

      act(() => {
        result.current.removeToast("nonexistent-id");
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe("clearToasts", () => {
    it("removes all toasts", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.success("A");
        result.current.error("B");
        result.current.warning("C");
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.clearToasts();
      });

      expect(result.current.toasts).toEqual([]);
    });
  });

  describe("auto-removal", () => {
    it("auto-removes toast after the default duration (5000ms)", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.success("Temporary");
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it("auto-removes toast after a custom duration", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.addToast({ type: "info", title: "Quick", duration: 1000 });
      });

      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.toasts).toHaveLength(0);
    });

    it("does not auto-remove when duration is 0", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.addToast({ type: "error", title: "Sticky", duration: 0 });
      });

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });
});
