import { describe, expect, it } from "vitest";
import { changelogAnchorId } from "@/lib/docs/changelog";

describe("changelogAnchorId", () => {
  it("prefixes with v- and replaces dots with hyphens", () => {
    expect(changelogAnchorId("0.3.0")).toBe("v-0-3-0");
  });

  it("handles a version with no dots", () => {
    expect(changelogAnchorId("1")).toBe("v-1");
  });

  it("handles a four-segment version", () => {
    expect(changelogAnchorId("1.2.3.4")).toBe("v-1-2-3-4");
  });

  it("preserves pre-release suffixes (no dots inside the suffix)", () => {
    expect(changelogAnchorId("1.0.0-rc1")).toBe("v-1-0-0-rc1");
  });

  it("replaces dots inside pre-release suffixes too", () => {
    expect(changelogAnchorId("1.0.0-rc.1")).toBe("v-1-0-0-rc-1");
  });

  it("returns the same id for the same input (deterministic)", () => {
    expect(changelogAnchorId("0.1.0")).toBe(changelogAnchorId("0.1.0"));
  });
});
