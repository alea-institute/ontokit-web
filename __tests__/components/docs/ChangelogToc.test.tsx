import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { ChangelogToc } from "@/components/docs/ChangelogToc";

const entries = [
  { version: "0.3.0", date: "2026-04-09" },
  { version: "0.2.0", date: "2026-03-21" },
  { version: "0.1.0", date: "2026-02-18" },
];

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
});
