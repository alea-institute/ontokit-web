# Mock-LLM tests with invented fixtures mask total feature non-function

**Date:** 2026-07-07 · **Context:** ontokit PR-5 (core suggestion generation) /ce:review · **Severity class:** BLOCKER-that-tests-called-green

## What happened

The suggestion-generation pipeline parsed every LLM response with a single generic
`raw.get("label", "")`, but two of the five prompt templates never emit a `label` key:

- `prompts/edges.py` emits `{target_label, target_iri, relationship_type, explanation, confidence}`
- `prompts/annotations.py` emits `{property_iri, value, lang, confidence}`

So `edges` and `annotations` — 2 of 5 advertised suggestion types — returned **empty,
validation-failing stubs with their entire semantic payload silently dropped**. Yet the
suite was green: the test fixtures fed the mocked provider a hand-written
`{"label": ..., "definition": ...}` shape for *all five* types, so parser and fixture
agreed with each other and both disagreed with reality. A second instance in the same
slice: `parents` fixtures also used the invented shape, hiding an inverted IS-A +
duplicate-mint bug.

A sibling bug on the web side rhymed: `onAddSuggestedProperty` was wired as an alias of
`onAddSuggestedChild` in both editor layouts, so accepting a suggested sub-property wrote
`a owl:Class ; rdfs:subClassOf` into the ontology. Component tests passed because they
asserted the callback *fired*, not what it *emitted*.

## The rule

**When a parser consumes machine-generated output (LLM, external API, file format), its
test fixtures must be derived from the producer's actual output contract — copy the
schema from the prompt/spec into the fixture, never write the fixture from the parser.**
Fixtures written by reading the parser reproduce the parser's assumptions and can only
ever confirm them.

Checklist that would have caught both:
1. For each output *variant* (here: 5 prompt templates), one test whose fixture is the
   verbatim example schema from that template's `Output schema:` line.
2. Assert the **payload round-trips** (every type-specific field appears on the response
   object), not just count/type-tag.
3. For accept/persist flows, assert the **emitted artifact** (the Turtle text, the request
   body), not that a handler was invoked.
4. Reviewer heuristic: when one parse path serves N producer variants, diff the parse
   keys against each producer's schema line — 5 minutes, found both blockers here.

## Fixes

- api `f5c7bb7`: per-type `_parse_typed` dispatch + real-shape fixtures + payload
  round-trip assertions (`tests/unit/test_suggestion_generation.py`).
- web `058ccf7`: distinct property handler + Turtle-emission regression test
  (`__tests__/lib/ontology/turtleSnippetGenerator.test.ts`).
