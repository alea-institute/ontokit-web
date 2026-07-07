/**
 * Bridge between accepted LLM suggestions and the PROV-O snippet emission
 * (q9 decision: PROV-O is the provenance persistence vocabulary).
 *
 * Scope note (domain-modeling decision, recorded on PR-6):
 * - NEW entities minted from an accepted suggestion (children, sub-properties)
 *   are stamped `prov:wasGeneratedBy` — semantically exact.
 * - Value-level accepts on EXISTING entities (annotations, parents, edges)
 *   are NOT stamped: statement-level provenance is not expressible in plain
 *   Turtle without reification/RDF-star, and stamping the whole pre-existing
 *   entity would assert something false. Their provenance stays in the
 *   suggestion session + audit log (D-08).
 */

import type { GeneratedSuggestion } from "@/lib/api/generation";
import type { SnippetProvenance } from "@/lib/ontology/turtleSnippetGenerator";

/** Provenance payload threaded through the accept callbacks (no prefix concern). */
export type AcceptedSuggestionProvenance = Omit<SnippetProvenance, "declarePrefix">;

/**
 * Build the persistable provenance for an accepted suggestion, or undefined
 * when nothing should be persisted.
 *
 * Rules:
 * - `llm-proposed` and `user-edited-from-llm` both originated from the model,
 *   so both are stamped (a human edit doesn't erase the AI origin).
 * - `user-written` suggestions carry no AI provenance — never stamped.
 * - A missing/empty model id means we cannot make a truthful PROV-O claim —
 *   skip persistence rather than stamp an anonymous agent.
 */
export function provenanceFromSuggestion(
  suggestion: Pick<GeneratedSuggestion, "provenance" | "model" | "prompt_template">,
): AcceptedSuggestionProvenance | undefined {
  if (suggestion.provenance === "user-written") return undefined;
  if (!suggestion.model) return undefined;
  return {
    model: suggestion.model,
    promptTemplate: suggestion.prompt_template ?? undefined,
  };
}
