# Handoff: demo banner restyle and faster class-detail facets

Date: 2026-11-04. Repo: ontokit-web. Code changes go to the alea-institute fork's `dev` branch through feature branches.

## Goal

1. **Demo banner:** today the amber "OntoKit demo: preview how communities build…" strip reads as a warning or error. Make it calm and informational, following UI/UX best practice. Keep the approved copy word for word; any wording change needs Damien's approval in a draft doc first.
2. **Detail speed:** clicking a class takes 1–5 s before the right-side detail facets appear. Target: milliseconds.

## Recommended route

- **Banner:** small and bounded, so go straight to a lightweight ce-plan, then ce-work.
  - **Visual change only:** a neutral or blue "info" treatment, an info icon, and accessible contrast in light and dark.
  - **Before merge:** share before/after screenshots on desktop and phone.
- **Speed:** measure first (in the style of ce-debug or ce-optimize), then plan.
  - **Per-click waterfall:** record the network waterfall of each click: class detail, references, history, similar, translation entity-state, tree.
  - **Server timings:** time each of those requests on the server.
  - **Render time:** measure client render time.
  - **Suspects, unverified:**
    - whole-ontology parsing on each request (translation coverage already parses the full file every time)
    - serial client fetches
    - no cache or prefetch of class detail
    - not using the tree node's known label and IRI as placeholder data
  - **Target:** fields already known from the tree appear instantly and the rest stream in; class-detail server p95 under 200 ms.

## Constraints

- **BAIF demo:** Thursday 2026-11-05. The demo is verified and frozen. Any deploy before the talk must be low-risk and UAT'd on the live site. Restart the worker before building: the 8 GB swapless host thrashed once.
- **Deploys:** use the forced-command deploy (see `docs/handoffs/2026-11-04-baif-demo-site.md`). Verify from running image labels.

## Pointers

- **Banner:** `components/layout/demo-site-banner.tsx`, mounted in `app/layout.tsx` and gated on `NEXT_PUBLIC_DEMO_SITE`.
- **Detail panel:** `components/editor/ClassDetailPanel.tsx` and `components/editor/standard/StandardEditorLayout.tsx`.
- **Hooks:** `lib/hooks/useSimilarEntities.ts`, `useCrossReferences`, `useEntityHistory`.
- **API:** ontokit-api `ontokit/api/routes/projects.py` (class detail), `translation.py`, and the embeddings routes.
- **BAIF state and rules:** `docs/handoffs/2026-11-04-baif-demo-site.md` and `docs/releases/baif-2026-11/README.md`.
