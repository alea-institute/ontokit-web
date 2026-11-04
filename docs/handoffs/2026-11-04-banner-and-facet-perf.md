---
session: "8b933b67-126d-48ff-98ce-771967010cbe"
written_at: "2026-11-04T21:39:22.350Z"
head: "661de93e38b68a3b9c96546d651bb32cedcd261f"
worktree: "/home/damienriehl/Coding Projects/ontokit-web"
branch: "docs/d01-release-readiness-20260920"
---
# Handoff: demo banner restyle and faster class-detail facets

Date: 2026-11-04 (refreshed after delivery). Repo: ontokit-web. Code changes go to the alea-institute fork's `dev` branch through feature branches.

## Done and deployed (2026-11-04, 21:35 UTC)

- **Banner (web #82):** a calm blue info strip with an Info icon replaces the amber one; the copy stays word for word. Live screenshots checked on desktop and phone, in light and dark.
- **Entity-state speedup (api #82):** `translation/entity-state` parsed the whole ontology on the event loop for every click. That took 4.6–7.5 s and blocked the class-detail request behind it. It now skips the parse unless the entity has a verified record, and any parse runs in a thread.
- **Measured on live, signed-in owner:** the detail heading fell from 4.7–7.5 s to 0.38–1.17 s, and all facets now settle in 0.78–1.91 s. Evidence is in `docs/releases/baif-2026-11/README.md`.
- **Deployed pair:** API `fd52eff6`, web `09f68ff9`. Rollback pair: API `751c3509`, web `0df6e7ec`.

## Remaining (after the BAIF talk; target is milliseconds)

1. **Serial facet round trip (web):** references, history and similar start only after class detail returns, which adds about 350–800 ms. Their panels mount inside the loaded detail view (`CrossReferencesPanel.tsx`, `EntityHistoryTab.tsx`, `SimilarConceptsPanel.tsx`). Fire them on selection, keyed by IRI, in parallel with class detail.
2. **Instant header (web):** render the label and IRI the tree already knows as React Query placeholder data, then stream in the rest.
3. **Lockstep responses (API, to investigate):** concurrent per-click requests still finish within a few milliseconds of each other, at 0.4–1.2 s. Anonymous single requests take about 0.2 s. Suspects include another synchronous step on the loop (for example `_ontology_filename` → `list_files`, or the lint and class-detail paths) or worker-level serialization. Measure server timings per route first.
4. **Prefetch (web):** prefetch class detail on tree hover or keyboard focus.

## How to measure

Reuse the Playwright approach from this session: sign in as the owner persona, open each demo project's editor, click four top-level classes, and record `requestfinished` timings plus the moment the detail heading appears (MutationObserver). Compare before and after any change.

## Constraints

- **BAIF demo:** Thursday 2026-11-05. Do not deploy again before the talk unless something breaks. Restart the worker before any build (8 GB host, no swap).
- **Deploys:** use the forced-command deploy (see `docs/handoffs/2026-11-04-baif-demo-site.md`). Verify from running image labels.
