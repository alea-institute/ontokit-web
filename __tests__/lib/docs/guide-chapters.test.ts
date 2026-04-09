import { describe, expect, it } from "vitest";
import {
  guideChapters,
  getAdjacentChapters,
} from "@/lib/docs/guide-chapters";

describe("guideChapters", () => {
  it("exports a non-empty array of chapters", () => {
    expect(guideChapters.length).toBeGreaterThan(0);
  });

  it("each chapter has required fields", () => {
    for (const ch of guideChapters) {
      expect(ch.slug).toBeTruthy();
      expect(ch.title).toBeTruthy();
      expect(ch.shortTitle).toBeTruthy();
      expect(ch.description).toBeTruthy();
    }
  });

  it("all slugs are unique", () => {
    const slugs = guideChapters.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("getAdjacentChapters", () => {
  it("has at least 3 chapters (precondition for adjacency tests)", () => {
    expect(guideChapters.length).toBeGreaterThanOrEqual(3);
  });

  it("returns null prev for the first chapter", () => {
    const { prev, next } = getAdjacentChapters(guideChapters[0].slug);
    expect(prev).toBeNull();
    expect(next).toEqual(guideChapters[1]);
  });

  it("returns null next for the last chapter", () => {
    const last = guideChapters[guideChapters.length - 1];
    const { prev, next } = getAdjacentChapters(last.slug);
    expect(next).toBeNull();
    expect(prev).toEqual(guideChapters[guideChapters.length - 2]);
  });

  it("returns both prev and next for a middle chapter", () => {
    const { prev, next } = getAdjacentChapters(guideChapters[1].slug);
    expect(prev).toEqual(guideChapters[0]);
    expect(next).toEqual(guideChapters[2]);
  });

  it("returns nulls for unknown slug", () => {
    const { prev, next } = getAdjacentChapters("nonexistent-slug");
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});
