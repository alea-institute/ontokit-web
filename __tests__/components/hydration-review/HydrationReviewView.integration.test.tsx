import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HydrationReviewView } from "@/components/hydration-review/HydrationReviewView";
import { RowDetail } from "@/components/hydration-review/RowDetail";
import { ScriptText } from "@/components/hydration-review/ScriptText";
import { reviewLabel } from "@/components/hydration-review/StatusBadge";
import { createMemoryStore, type ReviewStore } from "@/lib/hydration-review/storage";
import { emptyReview } from "@/lib/hydration-review/reviews";
import { bundleText, makeRows } from "@/__tests__/fixtures/hydrationBundle";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

afterEach(cleanup);

async function load(store: ReviewStore, download = vi.fn(), text = bundleText()) {
  render(<HydrationReviewView createStore={() => store} download={download} />);
  const file = new File([text], "bundle.jsonl", { type: "application/x-ndjson" });
  fireEvent.change(screen.getByLabelText("Review bundle file"), { target: { files: [file] } });
  await screen.findByRole("tablist");
  return download;
}

function rowButton(label: string, nth = 0) {
  return screen.getAllByRole("button", { name: label })[nth];
}

describe("HydrationReviewView", () => {
  it("announces file loading and disables the picker until saved reviews finish restoring", async () => {
    let finishLoad!: (value: Awaited<ReturnType<ReviewStore["load"]>>) => void;
    const store = { ...createMemoryStore(), load: () => new Promise<Awaited<ReturnType<ReviewStore["load"]>>>((resolve) => { finishLoad = resolve; }) };
    render(<HydrationReviewView createStore={() => store} />);
    const picker = screen.getByLabelText("Review bundle file") as HTMLInputElement;
    fireEvent.change(picker, { target: { files: [new File([bundleText()], "review.jsonl")] } });
    expect((await screen.findByRole("status")).textContent).toContain("Reading review.jsonl");
    expect(picker.disabled).toBe(true);
    await waitFor(() => expect(finishLoad).toBeTypeOf("function"));
    finishLoad({ reviews: [], samples: [] });
    await screen.findByRole("tablist");
  });

  it("restores a usable picker after invalid data and accepts a valid retry", async () => {
    render(<HydrationReviewView createStore={createMemoryStore} />);
    const picker = screen.getByLabelText("Review bundle file") as HTMLInputElement;
    fireEvent.change(picker, { target: { files: [new File(["{}"], "invalid.jsonl")] } });
    await screen.findByRole("alert");
    expect(picker.disabled).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.change(picker, { target: { files: [new File([bundleText()], "valid.jsonl")] } });
    await screen.findByRole("tablist");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains an empty bundle and cannot draw a sample from it", async () => {
    const store = createMemoryStore();
    const saveSample = vi.spyOn(store, "putSample");
    await load(store, vi.fn(), bundleText({ rows: [], includeExclusions: false }));
    expect(screen.getByRole("heading", { name: "No proposed rows in this bundle" })).toBeTruthy();
    expect(screen.queryByText("No rows match these filters")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Samples" }));
    const draw = screen.getByRole("button", { name: /Draw sample/ }) as HTMLButtonElement;
    expect(draw.disabled).toBe(true);
    fireEvent.click(draw);
    expect(saveSample).not.toHaveBeenCalled();
    expect(screen.getByText(/There are no proposed rows to sample/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Rates" }));
    expect(screen.getByText(/This bundle has no proposed rows to review/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review rows" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Exclusions/ }));
    expect(screen.getByRole("heading", { name: "No excluded rows" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("retains separately recorded prescreen counts when no excluded rows are bundled", async () => {
    const text = bundleText({ includeExclusions: false }).replace('"prescreen_rejected_items":0', '"prescreen_rejected_items":2');
    await load(createMemoryStore(), vi.fn(), text);
    fireEvent.click(screen.getByRole("tab", { name: /Exclusions/ }));
    expect(screen.getByRole("heading", { name: "No excluded rows" })).toBeTruthy();
    expect(screen.getByText(/separately records 2 items/)).toBeTruthy();
  });

  it("clears filters without losing a selected correction draft, note, saved reviews or samples", async () => {
    const store = createMemoryStore();
    await load(store);
    fireEvent.click(rowButton("Alpha"));
    fireEvent.click(within(screen.getByRole("region", { name: "Row detail" })).getByRole("button", { name: "Accept as proposed" }));
    fireEvent.click(screen.getByRole("tab", { name: "Samples" }));
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Draw sample/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Rows" }));
    fireEvent.click(rowButton("Alpha", 1));
    const detail = screen.getByRole("region", { name: "Row detail" });
    fireEvent.change(within(detail).getByLabelText("Corrected value"), { target: { value: "טיוטה" } });
    fireEvent.change(within(detail).getByLabelText("Note (optional)"), { target: { value: "Keep my note" } });
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "Location" } });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "no-matching-value" } });
    expect(await screen.findByRole("heading", { name: "No rows match these filters" })).toBeTruthy();
    expect(screen.getByText(/This row is outside the current filters/)).toBeTruthy();
    expect(within(detail).queryByRole("button", { name: "Next row" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await screen.findByText(/1–6 of 6 matching rows/);
    expect(screen.getByRole("region", { name: "Row detail" })).toBe(detail);
    expect((within(detail).getByLabelText("Corrected value") as HTMLTextAreaElement).value).toBe("טיוטה");
    expect((within(detail).getByLabelText("Note (optional)") as HTMLInputElement).value).toBe("Keep my note");
    expect(within(detail).getByRole("button", { name: "Next row" })).toBeTruthy();
    expect(screen.queryByText(/This row is outside the current filters/)).toBeNull();
    expect((screen.getByLabelText("Search") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Branch") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("unclassified · accepted")).toBeTruthy();
    expect((await store.load(await currentSha())).samples).toHaveLength(1);
  });

  it("returns to the first page when filters are cleared", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ ...makeRows()[0], row_id: `many-${i}`, label: `Concept ${i}` }));
    await load(createMemoryStore(), vi.fn(), bundleText({ rows }));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Concept" } });
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    expect(await screen.findByText(/51–60 of 60 matching rows/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText(/1–50 of 60 matching rows/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous", exact: true }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains unsampled and unreviewed states, and samples despite an empty text search", async () => {
    await load(createMemoryStore());
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "no-matching-value" } });
    await screen.findByRole("heading", { name: "No rows match these filters" });
    fireEvent.click(screen.getByRole("tab", { name: "Samples" }));
    expect(screen.getByText(/No samples saved yet/)).toBeTruthy();
    const draw = screen.getByRole("button", { name: /Draw sample/ }) as HTMLButtonElement;
    expect(draw.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "7" } });
    fireEvent.click(draw);
    expect(await screen.findByText(/6 of 6 · seed 7 · whole bundle/)).toBeTruthy();
    expect(screen.queryByText(/No samples saved yet/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Rates" }));
    expect(screen.getByText(/No completed reviews yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review rows" }));
    expect(screen.getByRole("tab", { name: "Rows" }).getAttribute("aria-selected")).toBe("true");
  });

  it("disables sampling for an empty dimension intersection and recovers when filters clear", async () => {
    await load(createMemoryStore());
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "Location" } });
    fireEvent.change(screen.getByLabelText("Component"), { target: { value: "translation:he-il" } });
    fireEvent.click(screen.getByRole("tab", { name: "Samples" }));
    expect((screen.getByRole("button", { name: /Draw sample/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No rows match the branch, component and partition/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((screen.getByRole("button", { name: /Draw sample/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("states that nothing writes to FOLIO before and after loading", async () => {
    render(<HydrationReviewView createStore={createMemoryStore} />);
    expect(screen.getByText(/Nothing on this page writes to FOLIO/)).toBeTruthy();
  });

  it("shows a clear error for a file that is not a bundle", async () => {
    render(<HydrationReviewView createStore={createMemoryStore} />);
    fireEvent.change(screen.getByLabelText("Review bundle file"), { target: { files: [new File(["{}"], "x.jsonl")] } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/unknown kind/);
  });

  it("lists every row with counts, filters, and opens a row's diff", async () => {
    await load(createMemoryStore());
    expect(screen.getByText(/1–6 of 6 matching rows/)).toBeTruthy();
    expect(screen.getAllByText("Unreviewed", { selector: "span" }).length).toBe(6);

    fireEvent.change(screen.getByLabelText("Component"), { target: { value: "translation:he-il" } });
    await screen.findByText(/1–1 of 1 matching rows/);
    fireEvent.click(rowButton("Alpha"));
    const detail = screen.getByRole("region", { name: "Row detail" });
    expect(within(detail).getByText(/Empty slot/)).toBeTruthy();
    expect(within(detail).getByText(/skos:altLabel "אלפא"@he-il/)).toBeTruthy();
    expect(within(detail).getByText("An alpha.")).toBeTruthy();
    expect((within(detail).getByLabelText("Corrected value")).getAttribute("dir")).toBe("rtl");
    expect((within(detail).getByLabelText("Corrected value")).getAttribute("lang")).toBe("he-IL");
  });

  it("classifies, corrects, persists and exports a review", async () => {
    const store = createMemoryStore();
    const download = await load(store);
    fireEvent.click(rowButton("Alpha"));
    const detail = screen.getByRole("region", { name: "Row detail" });
    fireEvent.click(within(detail).getByRole("button", { name: "MATERIAL" }));
    expect((within(detail).getByRole("button", { name: "Accept as proposed" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(detail).getByLabelText("Corrected value"), { target: { value: "Alpha (DE)" } });
    fireEvent.click(within(detail).getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(screen.getAllByText("MATERIAL · corrected").length).toBeGreaterThan(0));

    const saved = (await store.load(await currentSha())).reviews;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ classification: "MATERIAL", disposition: "correct", corrected_value: "Alpha (DE)", original_value: "Alpha-DE" });

    fireEvent.click(screen.getByRole("button", { name: /Export reviews/ }));
    const [filename, text] = download.mock.calls[0];
    expect(filename).toMatch(/^review-digest-test-/);
    const lines = text.trim().split("\n").map((l: string) => JSON.parse(l));
    expect(lines[0].schema).toBe("folio-review-export/1");
    expect(lines[1]).toMatchObject({ kind: "review", corrected_value: "Alpha (DE)" });

    fireEvent.click(screen.getByRole("tab", { name: "Rates" }));
    expect(screen.getAllByText("1/1 (100.0%)").length).toBeGreaterThan(0);
  });

  it("restores saved reviews when the same bundle is opened again", async () => {
    const store = createMemoryStore();
    const sha = await currentSha();
    const row = makeRows()[0];
    await store.putReview(sha, { ...emptyReview(row), classification: "SAME", disposition: "accept" });
    await load(store);
    expect(screen.getByText(/Restored 1 saved reviews/)).toBeTruthy();
    expect(screen.getAllByText("SAME · accepted").length).toBe(1);
  });

  it("draws a seeded sample from the filtered population and navigates it", async () => {
    await load(createMemoryStore());
    fireEvent.click(screen.getByRole("tab", { name: "Samples" }));
    fireEvent.change(screen.getByLabelText("Partition"), { target: { value: "keep" } });
    fireEvent.change(screen.getByLabelText("Sample size"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Draw sample/ }));
    expect(await screen.findByText(/3 of 4 · seed 7 · partition=keep · 0\/3 reviewed/)).toBeTruthy();
    expect(screen.getByText(/sample result — not a population rate/)).toBeTruthy();
    const detail = screen.getByRole("region", { name: "Row detail" });
    expect(within(detail).getByText(/1 of 3/)).toBeTruthy();
    fireEvent.click(within(detail).getByRole("button", { name: "Next row" }));
    expect(within(screen.getByRole("region", { name: "Row detail" })).getByText(/2 of 3/)).toBeTruthy();
  });

  it("shows exclusions read-only with reasons", async () => {
    await load(createMemoryStore());
    fireEvent.click(screen.getByRole("tab", { name: /Exclusions/ }));
    expect(screen.getByText(/cannot be reviewed or accepted here/)).toBeTruthy();
    expect(screen.getAllByText("locale_prescreen_rejected").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Accept as proposed" })).toBeNull();
  });

  it("imports a review file only when it matches the bundle", async () => {
    await load(createMemoryStore());
    const sha = await currentSha();
    const row = makeRows()[1];
    const good = [
      JSON.stringify({ kind: "header", schema: "folio-review-export/1", bundle_sha256: sha }),
      JSON.stringify({ kind: "review", ...emptyReview(row), classification: "SAME", disposition: "accept" }),
    ].join("\n");
    fireEvent.change(screen.getByLabelText("Review export file"), { target: { files: [new File([good], "r.jsonl")] } });
    expect(await screen.findByText(/Imported 1 reviews/)).toBeTruthy();

    const bad = JSON.stringify({ kind: "header", schema: "folio-review-export/1", bundle_sha256: "nope" });
    fireEvent.change(screen.getByLabelText("Review export file"), { target: { files: [new File([bad], "r.jsonl")] } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/different bundle/);
  });

  it("keeps prev/next working while reviewing the unreviewed queue", async () => {
    await load(createMemoryStore());
    fireEvent.change(screen.getByLabelText("Review state"), { target: { value: "unreviewed" } });
    fireEvent.click(rowButton("Alpha"));
    const detail = () => screen.getByRole("region", { name: "Row detail" });
    fireEvent.click(within(detail()).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(within(detail()).getByText(/rejected/)).toBeTruthy());
    expect(within(detail()).getByRole("button", { name: "Next row" })).toBeTruthy();
  });

  it("does not let an older import overwrite a newer local review", async () => {
    const store = createMemoryStore();
    const sha = await currentSha();
    const row = makeRows()[0];
    await store.putReview(sha, { ...emptyReview(row), classification: "MATERIAL", disposition: "reject", reviewed_at: "2026-10-20T12:00:00Z" });
    await load(store);
    const old = [
      JSON.stringify({ kind: "header", schema: "folio-review-export/1", bundle_sha256: sha }),
      JSON.stringify({ kind: "review", ...emptyReview(row), classification: "SAME", disposition: "accept", reviewed_at: "2026-10-01T00:00:00Z" }),
    ].join("\n");
    fireEvent.change(screen.getByLabelText("Review export file"), { target: { files: [new File([old], "r.jsonl")] } });
    expect(await screen.findByText(/kept 1 newer local reviews/)).toBeTruthy();
    expect((await store.load(sha)).reviews[0].classification).toBe("MATERIAL");
  });

  it("searches the full corpus", async () => {
    await load(createMemoryStore());
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "ベータ" } });
    await screen.findByText(/1–1 of 1 matching rows/);
  });
});

describe("RowDetail", () => {
  it("shows failed gates and the pre-strip value", () => {
    const rows = makeRows();
    render(<RowDetail row={rows[4]} concept={undefined} review={undefined} onChange={() => {}} />);
    expect(screen.getByText(/Recognition claim stripped/)).toBeTruthy();
    cleanup();
    render(<RowDetail row={rows[2]} concept={undefined} review={undefined} onChange={() => {}} />);
    expect(screen.getByText("G1-grounding")).toBeTruthy();
  });

  it("clears an accept when the row is reclassified as a defect", () => {
    const row = makeRows()[0];
    const onChange = vi.fn();
    render(<RowDetail row={row} concept={undefined} review={{ ...emptyReview(row), classification: "SAME", disposition: "accept" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "MINOR" }));
    expect(onChange.mock.calls[0][0]).toMatchObject({ classification: "MINOR", disposition: null });
  });

  it("rejects with a note", () => {
    const row = makeRows()[0];
    const onChange = vi.fn();
    render(<RowDetail row={row} concept={undefined} review={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "wrong sense" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onChange.mock.calls[0][0]).toMatchObject({ disposition: "reject", note: "wrong sense", corrected_value: null });
  });
});

describe("ScriptText and labels", () => {
  it("renders leakage marks and code-point badges without altering text", () => {
    const { container } = render(<ScriptText value={"pigmentים‏"} lang="he-il" />);
    expect(container.querySelector("mark")?.textContent).toBe("pigment");
    expect(screen.getByText("U+200F")).toBeTruthy();
    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("rtl");
  });

  it("labels drafts and unreviewed rows honestly", () => {
    const row = makeRows()[0];
    expect(reviewLabel(undefined).text).toBe("Unreviewed");
    expect(reviewLabel({ ...emptyReview(row), classification: "MINOR" }).text).toBe("MINOR · draft");
    expect(reviewLabel({ ...emptyReview(row), disposition: "reject" }).text).toBe("unclassified · rejected");
  });
});

async function currentSha(): Promise<string> {
  const bytes = new TextEncoder().encode(bundleText());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
