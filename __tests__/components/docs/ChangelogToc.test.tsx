import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { ChangelogToc } from "@/components/docs/ChangelogToc";

const entries = [
  { version: "0.3.0", date: "2026-04-09" },
  { version: "0.2.0", date: "2026-03-21" },
  { version: "0.1.0", date: "2026-02-18" },
];

function setScrollState({
  scrollY,
  innerHeight,
  scrollHeight,
}: {
  scrollY: number;
  innerHeight: number;
  scrollHeight: number;
}) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value: scrollY,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: innerHeight,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    writable: true,
    value: scrollHeight,
  });
}

function mountTargets(absoluteTops: Record<string, number>) {
  for (const [id, absoluteTop] of Object.entries(absoluteTops)) {
    const el = document.createElement("div");
    el.id = id;
    el.getBoundingClientRect = () => {
      const top = absoluteTop - (window.scrollY ?? 0);
      return {
        top,
        bottom: top + 100,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: top,
        toJSON: () => undefined,
      } as DOMRect;
    };
    document.body.appendChild(el);
  }
}

afterEach(() => {
  for (const { version } of entries) {
    const id = `v-${version.replace(/\./g, "-")}`;
    const el = document.getElementById(id);
    if (el) el.remove();
  }
});

describe("ChangelogToc", () => {
  it("renders the Releases heading", () => {
    render(<ChangelogToc entries={entries} />);
    expect(screen.getByText("Releases")).toBeDefined();
  });

  it("renders one link per entry with the version label", () => {
    render(<ChangelogToc entries={entries} />);
    for (const { version } of entries) {
      expect(screen.getByText(version)).toBeDefined();
    }
  });

  it("renders the date next to each version", () => {
    render(<ChangelogToc entries={entries} />);
    for (const { date } of entries) {
      expect(screen.getByText(date)).toBeDefined();
    }
  });

  it("links each version to its anchor id", () => {
    render(<ChangelogToc entries={entries} />);
    expect(screen.getByText("0.3.0").closest("a")?.getAttribute("href")).toBe(
      "#v-0-3-0",
    );
    expect(screen.getByText("0.2.0").closest("a")?.getAttribute("href")).toBe(
      "#v-0-2-0",
    );
    expect(screen.getByText("0.1.0").closest("a")?.getAttribute("href")).toBe(
      "#v-0-1-0",
    );
  });

  it("marks the first entry active on initial render", () => {
    render(<ChangelogToc entries={entries} />);
    const first = screen.getByText("0.3.0").closest("a");
    expect(first?.getAttribute("aria-current")).toBe("true");
  });

  it("does not mark non-first entries active on initial render", () => {
    render(<ChangelogToc entries={entries} />);
    const second = screen.getByText("0.2.0").closest("a");
    expect(second?.getAttribute("aria-current")).toBeNull();
  });

  it("renders nothing-breaking when given an empty list", () => {
    render(<ChangelogToc entries={[]} />);
    expect(screen.getByText("Releases")).toBeDefined();
  });

  it("activates the closest section above the scroll probe on mount", () => {
    setScrollState({ scrollY: 0, innerHeight: 800, scrollHeight: 3000 });
    mountTargets({ "v-0-3-0": 50, "v-0-2-0": 1100, "v-0-1-0": 2100 });
    render(<ChangelogToc entries={entries} />);
    expect(
      screen.getByText("0.3.0").closest("a")?.getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByText("0.2.0").closest("a")?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("updates the active section after a scroll event", () => {
    setScrollState({ scrollY: 0, innerHeight: 800, scrollHeight: 3000 });
    mountTargets({ "v-0-3-0": 50, "v-0-2-0": 1100, "v-0-1-0": 2100 });
    render(<ChangelogToc entries={entries} />);

    setScrollState({ scrollY: 1100, innerHeight: 800, scrollHeight: 3000 });
    fireEvent.scroll(window);

    expect(
      screen.getByText("0.2.0").closest("a")?.getAttribute("aria-current"),
    ).toBe("true");
  });

  it("activates the last entry when the page is scrolled to the bottom", () => {
    setScrollState({ scrollY: 0, innerHeight: 800, scrollHeight: 3000 });
    mountTargets({ "v-0-3-0": 50, "v-0-2-0": 1100, "v-0-1-0": 2100 });
    render(<ChangelogToc entries={entries} />);

    // viewportBottom (2200 + 800 = 3000) - docHeight (3000) = 0 < 8 → bottom guard
    setScrollState({ scrollY: 2200, innerHeight: 800, scrollHeight: 3000 });
    fireEvent.scroll(window);

    expect(
      screen.getByText("0.1.0").closest("a")?.getAttribute("aria-current"),
    ).toBe("true");
  });

  it("removes scroll and resize listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    setScrollState({ scrollY: 0, innerHeight: 800, scrollHeight: 3000 });
    mountTargets({ "v-0-3-0": 50, "v-0-2-0": 1100, "v-0-1-0": 2100 });
    const { unmount } = render(<ChangelogToc entries={entries} />);
    unmount();
    const events = removeSpy.mock.calls.map(([type]) => type);
    expect(events).toContain("scroll");
    expect(events).toContain("resize");
    removeSpy.mockRestore();
  });

  it("does not crash when no matching section elements exist", () => {
    setScrollState({ scrollY: 0, innerHeight: 800, scrollHeight: 3000 });
    expect(() => render(<ChangelogToc entries={entries} />)).not.toThrow();
  });
});
