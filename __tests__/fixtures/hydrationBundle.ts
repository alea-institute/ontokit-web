import type { BundleRow } from "@/lib/hydration-review/bundle";

const A = "https://folio.example/A";
const B = "https://folio.example/B";

export function makeRows(): BundleRow[] {
  const row = (row_id: string, iri: string, component: string, value: string, extra: Partial<BundleRow> = {}): BundleRow => {
    const lang = component.startsWith("translation:") ? component.split(":")[1] : null;
    const predicate = component === "definition" ? "skos:definition" : component === "examples" ? "skos:example" : "skos:altLabel";
    return {
      row_id, iri, label: iri === A ? "Alpha" : "Beta", branch: iri === A ? "Status" : "Location",
      component, predicate, lang, value, partition: "keep", failed_gates: {}, ...extra,
    };
  };
  return [
    row("r-de", A, "translation:de-de", "Alpha-DE"),
    row("r-he", A, "translation:he-il", "אלפא"),
    row("r-def", A, "definition", "An alpha is a test.", {
      partition: "regenerate",
      failed_gates: { "G1-grounding": "generated definitions are ungrounded by construction" },
    }),
    row("r-ja", B, "translation:ja-jp", "ベータ"),
    row("r-ex", B, "examples", "A beta example.", {
      recognition_strip: { rules: ["federally recognized"], original_value: "A federally recognized beta example." },
    }),
    row("r-fr", B, "translation:fr-fr", "Bêta", { partition: "regenerate", failed_gates: { "G1-grounding": "x" } }),
  ];
}

export function bundleText({ excludedRowId = "x-ja", rows = makeRows(), includeExclusions = true }: {
  excludedRowId?: string;
  rows?: BundleRow[];
  includeExclusions?: boolean;
} = {}): string {
  const countBy = (key: "partition" | "component" | "branch") => {
    const values = [...new Set(rows.map((r) => r[key]))];
    if (key === "branch") values.sort();
    return Object.fromEntries(values.map((value) => [value, rows.filter((r) => r[key] === value).length]));
  };
  const header = {
    kind: "header", schema: "folio-review-bundle/1", digest_id: "digest-test", writes_to_folio: false,
    counts: {
      rows: rows.length,
      by_partition: countBy("partition"),
      by_component: countBy("component"),
      by_branch: countBy("branch"),
      concepts: 2, exclusions: includeExclusions ? 1 : 0,
      exclusions_by_reason: includeExclusions ? { locale_prescreen_rejected: 1 } : {},
    },
    digest_manifest: { accepted_total: rows.length, prescreen_rejected_items: includeExclusions ? 2 : 0 },
  };
  const concepts = [
    { kind: "concept", iri: A, label: "Alpha", branch: "Status", existing_definition: "An alpha." },
    { kind: "concept", iri: B, label: "Beta", branch: "Location", existing_definition: null },
  ];
  const exclusion = {
    kind: "exclusion", row_id: excludedRowId, iri: B, label: "Beta", branch: "Location",
    component: "translation:ja-jp", lang: "ja-jp", reason: "locale_prescreen_rejected", value: "ベータtest",
  };
  return [header, ...concepts, ...rows.map((r) => ({ kind: "row", ...r })), ...(includeExclusions ? [exclusion] : [])]
    .map((r) => JSON.stringify(r)).join("\n") + "\n";
}
