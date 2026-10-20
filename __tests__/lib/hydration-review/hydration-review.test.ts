import { describe, expect, it } from "vitest";
import { BundleError, htmlLang, isRtl, parseBundle, sha256Hex } from "@/lib/hydration-review/bundle";
import { buildExport, EXPORT_SCHEMA, ExportError, parseExport } from "@/lib/hydration-review/exportFormat";
import { drawSample, EMPTY_FILTER, filterRows, matchesStatus, mulberry32, pageOf } from "@/lib/hydration-review/query";
import { emptyReview, formatMaterialRate, isBlank, isComplete, reviewProblems, tallyRates, type Review } from "@/lib/hydration-review/reviews";
import { hasLeakage, segmentScripts } from "@/lib/hydration-review/scripts";
import { createFallbackStore, createMemoryStore, type ReviewStore } from "@/lib/hydration-review/storage";
import { bundleText, makeRows } from "@/__tests__/fixtures/hydrationBundle";

const parsed = () => parseBundle(bundleText(), "sha-test");

describe("parseBundle", () => {
  it("reads header, concepts, rows and exclusions", () => {
    const b = parsed();
    expect(b.rows).toHaveLength(6);
    expect(b.exclusions).toHaveLength(1);
    expect(b.concepts.get("https://folio.example/A")?.existing_definition).toBe("An alpha.");
    expect(b.rowsById.get(b.rows[0].row_id)).toBe(b.rows[0]);
  });

  it("rejects a file whose row count disagrees with its header", () => {
    const text = bundleText().split("\n").filter((l) => !l.includes('"r-de"')).join("\n");
    expect(() => parseBundle(text, "x")).toThrow(/declares 6 rows/);
  });

  it("rejects another schema and invalid JSON", () => {
    expect(() => parseBundle('{"kind":"header","schema":"other"}', "x")).toThrow(BundleError);
    expect(() => parseBundle("{nope", "x")).toThrow(/Line 1/);
  });

  it("rejects an excluded slot that also appears as a row", () => {
    const text = bundleText({ excludedRowId: "r-de" });
    expect(() => parseBundle(text, "x")).toThrow(/also appears/);
  });

  it("hashes bytes like sha256sum", async () => {
    const hex = await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer);
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("knows direction and BCP 47 casing", () => {
    expect(isRtl("he-il")).toBe(true);
    expect(isRtl("hi-in")).toBe(false);
    expect(htmlLang("zh-cn")).toBe("zh-CN");
    expect(htmlLang(null)).toBe("en");
  });
});

describe("filtering, paging and sampling", () => {
  const rows = makeRows();
  const none = new Map<string, Review>();

  it("filters by every dimension and searches label, IRI, value and id", () => {
    expect(filterRows(rows, { ...EMPTY_FILTER, component: "translation:he-il" }, none)).toHaveLength(1);
    expect(filterRows(rows, { ...EMPTY_FILTER, partition: "regenerate" }, none)).toHaveLength(2);
    expect(filterRows(rows, { ...EMPTY_FILTER, branch: "Location" }, none)).toHaveLength(3);
    expect(filterRows(rows, { ...EMPTY_FILTER, q: "אלפא" }, none).map((r) => r.row_id)).toEqual(["r-he"]);
    expect(filterRows(rows, { ...EMPTY_FILTER, q: "folio.example/b" }, none)).toHaveLength(3);
    expect(filterRows(rows, { ...EMPTY_FILTER, q: "r-ja" }, none)).toHaveLength(1);
  });

  it("filters by review state; unreviewed includes drafts without a disposition", () => {
    const draft: Review = { ...emptyReview(rows[0]), classification: "MINOR" };
    const done: Review = { ...emptyReview(rows[1]), classification: "SAME", disposition: "accept" };
    const m = new Map([[draft.row_id, draft], [done.row_id, done]]);
    expect(filterRows(rows, { ...EMPTY_FILTER, status: "unreviewed" }, m)).toHaveLength(5);
    expect(filterRows(rows, { ...EMPTY_FILTER, status: "SAME" }, m)).toHaveLength(1);
    expect(matchesStatus(draft, "MINOR")).toBe(false);
    expect(matchesStatus(undefined, "")).toBe(true);
  });

  it("pages within bounds", () => {
    const p = pageOf([1, 2, 3, 4, 5], 9, 2);
    expect(p).toMatchObject({ page: 2, pages: 3, start: 4, end: 5, items: [5] });
    expect(pageOf([], 0, 50)).toMatchObject({ pages: 1, items: [] });
  });

  it("draws a reproducible sample of distinct members from the whole population", () => {
    const pop = Array.from({ length: 1000 }, (_, i) => ({ ...rows[0], row_id: `id-${String(i).padStart(4, "0")}` }));
    const a = drawSample(pop, 25, 42);
    expect(a).toEqual(drawSample([...pop].reverse(), 25, 42));
    expect(new Set(a).size).toBe(25);
    expect(drawSample(pop, 25, 43)).not.toEqual(a);
    expect(a.some((id) => id > "id-0050")).toBe(true);
    expect(drawSample(pop.slice(0, 3), 10, 1)).toHaveLength(3);
  });

  it("mulberry32 is deterministic", () => {
    const r = mulberry32(1);
    expect([r(), r()]).toEqual([0.6270739405881613, 0.002735721180215478]);
  });
});

describe("review rules and rates", () => {
  const rows = makeRows();
  const byId = new Map(rows.map((r) => [r.row_id, r]));

  it("requires a disposition, forbids accepting a defect, and requires a real correction", () => {
    const base = emptyReview(rows[0]);
    expect(reviewProblems(base, rows[0])).toContain("Choose accept, correct or reject.");
    expect(isComplete({ ...base, disposition: "accept" }, rows[0])).toBe(true);
    expect(reviewProblems({ ...base, disposition: "accept", classification: "MATERIAL" }, rows[0])[0]).toMatch(/cannot be accepted/);
    expect(reviewProblems({ ...base, disposition: "correct" }, rows[0])).toContain("Enter the corrected value.");
    expect(reviewProblems({ ...base, disposition: "correct", corrected_value: rows[0].value }, rows[0])).toContain("The correction equals the original.");
    expect(reviewProblems({ ...base, original_value: "old", disposition: "reject" }, rows[0])[0]).toMatch(/stale/);
    expect(reviewProblems(base, undefined)[0]).toMatch(/not in the loaded bundle/);
  });

  it("tallies with explicit denominators and never counts drafts", () => {
    const reviews: Review[] = [
      { ...emptyReview(rows[0]), classification: "SAME", disposition: "accept" },
      { ...emptyReview(rows[1]), classification: "MATERIAL", disposition: "reject" },
      { ...emptyReview(rows[2]), classification: "MINOR" },
      { ...emptyReview(rows[3]), disposition: "reject" },
    ];
    const cells = tallyRates(reviews, byId, () => "all", { all: 6 });
    expect(cells).toEqual([{ key: "all", population: 6, reviewed: 3, SAME: 1, MINOR: 0, MATERIAL: 1, unclassified: 1 }]);
    expect(formatMaterialRate(cells[0])).toBe("1/2 (50.0%)");
    expect(formatMaterialRate({ SAME: 0, MINOR: 0, MATERIAL: 0 })).toBe("—");
  });
});

describe("export and import", () => {
  const b = parsed();

  it("exports complete reviews and samples, skipping drafts", () => {
    const done: Review = { ...emptyReview(b.rows[0]), classification: "MINOR", disposition: "correct", corrected_value: "Fixed" };
    const draft: Review = { ...emptyReview(b.rows[1]), classification: "SAME" };
    const sample = { sample_id: "s1", seed: 1, size: 1, population: 6, filter: {}, members: [b.rows[0].row_id], created_at: "t" };
    const out = buildExport(b.sha256, "digest-x", [draft, done], [sample], b.rowsById, new Date("2026-10-20T00:00:00Z"));
    expect(out).toMatchObject({ included: 1, skipped: 1 });
    const lines = out.text.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0]).toEqual({ kind: "header", schema: EXPORT_SCHEMA, bundle_sha256: "sha-test", digest_id: "digest-x", exported_at: "2026-10-20T00:00:00.000Z" });
    expect(lines[1]).toMatchObject({ kind: "review", row_id: b.rows[0].row_id, corrected_value: "Fixed", original_value: b.rows[0].value });
    expect(lines[2]).toMatchObject({ kind: "sample", sample_id: "s1" });

    const back = parseExport(out.text, b.sha256);
    expect(back.reviews[0].corrected_value).toBe("Fixed");
    expect(back.samples).toHaveLength(1);
  });

  it("refuses an export from another bundle or another schema", () => {
    const { text } = buildExport("other", "d", [], [], b.rowsById);
    expect(() => parseExport(text, b.sha256)).toThrow(/different bundle/);
    expect(() => parseExport('{"kind":"header"}', b.sha256)).toThrow(ExportError);
    expect(() => parseExport("{", b.sha256)).toThrow(/not valid JSON/);
  });
});

describe("script segmentation", () => {
  it("marks Latin inside Hebrew and keeps the text byte-identical", () => {
    const segs = segmentScripts("pigmentים", "he-il");
    expect(segs).toEqual([{ text: "pigment", kind: "foreign" }, { text: "ים", kind: "plain" }]);
    expect(segs.map((s) => s.text).join("")).toBe("pigmentים");
  });

  it("marks invisible and control characters one at a time", () => {
    const segs = segmentScripts("a‏\u0006b", "en-gb");
    expect(segs.map((s) => s.kind)).toEqual(["plain", "invisible", "invisible", "plain"]);
  });

  it("marks Cyrillic homoglyphs in a Latin locale and CJK leaks in en-gb", () => {
    expect(hasLeakage("Strafmaßnahmе", "de-de")).toBe(true);
    expect(hasLeakage("OASIS 時刻定義", "en-gb")).toBe(true);
    expect(hasLeakage("Strafmaßnahme", "de-de")).toBe(false);
    expect(hasLeakage("plain text", null)).toBe(false);
  });
});

describe("memory store", () => {
  it("keeps reviews per bundle", async () => {
    const s = createMemoryStore();
    const r = emptyReview(makeRows()[0]);
    await s.putReview("a", r);
    await s.putSample("a", { sample_id: "x", seed: 1, size: 0, population: 0, filter: {}, members: [], created_at: "t" });
    expect((await s.load("a")).reviews).toEqual([r]);
    expect((await s.load("a")).samples).toHaveLength(1);
    expect((await s.load("b")).reviews).toEqual([]);
    expect(s.durable).toBe(false);
  });
});

describe("review fixes", () => {
  const rows = makeRows();

  it("uses Python's whitespace set for blank corrections", () => {
    expect(isBlank("\x1f")).toBe(true);
    expect(isBlank("\x85 ")).toBe(true);
    expect(isBlank("\u3000")).toBe(true);
    expect(isBlank("x")).toBe(false);
    expect(isBlank(null)).toBe(true);
  });

  it("rejects imported reviews whose identity or values disagree with the bundle", () => {
    const base = { ...emptyReview(rows[0]), disposition: "reject" as const };
    expect(reviewProblems({ ...base, component: "examples" }, rows[0])[0]).toMatch(/IRI or component/);
    expect(reviewProblems({ ...base, classification: "BAD" as never }, rows[0])[0]).toMatch(/Unknown classification/);
    expect(reviewProblems({ ...base, disposition: "maybe" as never }, rows[0])[0]).toMatch(/Unknown disposition/);
  });

  it("keeps the pinned row visible under a review-state filter", () => {
    const done = { ...emptyReview(rows[0]), disposition: "accept" as const };
    const m = new Map([[done.row_id, done]]);
    const f = { ...EMPTY_FILTER, status: "unreviewed" as const };
    expect(filterRows(rows, f, m).map((r) => r.row_id)).not.toContain("r-de");
    expect(filterRows(rows, f, m, undefined, "r-de").map((r) => r.row_id)).toContain("r-de");
  });

  it("falls back to memory when the primary store fails to open", async () => {
    const broken: ReviewStore = {
      durable: true,
      load: () => Promise.reject(new Error("blocked")),
      putReview: () => Promise.reject(new Error("blocked")),
      putReviews: () => Promise.reject(new Error("blocked")),
      putSample: () => Promise.reject(new Error("blocked")),
    };
    const s = createFallbackStore(() => broken);
    const r = emptyReview(rows[0]);
    await s.putReviews("a", [r]);
    expect((await s.load("a")).reviews).toEqual([r]);
    expect(s.durable).toBe(false);
  });

  it("uses the primary store when it opens", async () => {
    const primary = { ...createMemoryStore(), durable: true };
    const s = createFallbackStore(() => primary);
    await s.load("a");
    expect(s.durable).toBe(true);
  });
});
