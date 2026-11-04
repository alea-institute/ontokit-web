# Handoff: BAIF demo site, 2026-11-04

The demo is live at `https://ontokit-demo.damienriehl.com` and has passed hosted UAT. The receipt with full evidence is at `docs/releases/baif-2026-11/README.md`, and the plan at `docs/plans/2026-11-03-1846-feat-baif-ontokit-demo-site-plan.md`.

## State

- **Deployed:** API `0c8289d4`, web `65ae751c`, both from the alea-institute forks' `dev` branches. Six PRs are merged: web #77–#79 and api #78–#80.
- **Projects:** both are public. The Catholic Semantic Canon and FOLIO each push to their `*-ontokit-demo` fork, and embeddings are at 100%.
- **Labels:** the rehearsal labels are reverted ("Holy See", "Canon Law"), so the stage edits can repeat.

## Operating rules

- **Restart the worker before deploying.** It holds the embedding model (about 2.5 GB), and the box has no swap. A deploy that builds while the model is loaded thrashed the host on 2026-11-04.
- **Don't edit an ontology while embeddings run.** The job aborts with "branch changed". A full run takes about 16 minutes.
- **Use a browser-like User-Agent for scripted API calls.** Cloudflare blocks the default Python client (error 1010).

## Next

1. **LLM:** configure LLM assist (Anthropic key, $25/month cap) for both projects once Damien provides the key. Then verify it in a browser as an admin.
2. **Sign-in:** Damien signs in once on the demo host.
3. **PR mirroring (optional):** grant the push token Pull requests write.
4. **Follow-ups:**
   - Mobile tab-jump and hardware Back behaviors.
   - A per-commit graph cache for translation coverage.
   - A harmless 404 when the graph includes an external-IRI node.
