---
session: "8b933b67-126d-48ff-98ce-771967010cbe"
written_at: "2026-11-04T21:39:04.581Z"
head: "661de93e38b68a3b9c96546d651bb32cedcd261f"
worktree: "/home/damienriehl/Coding Projects/ontokit-web"
branch: "docs/d01-release-readiness-20260920"
---
# Handoff: BAIF demo site, 2026-11-04 (evening refresh)

The demo is live at `https://ontokit-demo.damienriehl.com` and ready for BAIF (Thursday, 2026-11-05). **Freeze it:** no deploys or ZITADEL changes before the talk unless something breaks. Full evidence is in `docs/releases/baif-2026-11/README.md`.

## State

- **Deployed:** API `fd52eff6`, web `09f68ff9` (2026-11-04, 21:35 UTC; api #82 entity-state speedup, web #82 banner restyle), both from the alea-institute forks' `dev` branches. Rollback pair: API `751c3509`, web `0df6e7ec`.
- **Merged PRs:** web #77–#81 and api #78–#81.
- **Projects:** both are public. The Catholic Semantic Canon and FOLIO each push to their `*-ontokit-demo` fork with no-reply commit authors. Embeddings are at 100%, and LLM assist (Anthropic, $25/month cap) works for admins only.
- **Sign-in:**
  - **Methods:** Google, GitHub, and email/password, with self-registration on and email-code verification on.
  - **Auto-linking:** the IdPs link by email; this is safe only because verification is on.
  - **Email:** delivered by Resend (EU) over SMTP port 587.
  - **Organizations:** OntoKit, ALEA / FOLIO, and CDCF. The recipe is in `docs/runbooks/identity-hub.md`.
- **Privacy policy:** live at `/privacy`. Google's consent screen is published but not brand-verified, so it shows "damienriehl.com".
- **ZITADEL masterkey:** rotated 2026-11-04 and now supplied through an environment variable (`docs/runbooks/zitadel-masterkey/`).

## Operating rules

- **Restart the worker before any deploy.** It holds the embedding model (about 2.5 GB), and the 8 GB box has no swap. A deploy build otherwise thrashes the host.
- **Edit ZITADEL IdPs safely.** Never build an update from the v1 template search: send the full option set and verify via `GET /v2/idps/{id}` (see `docs/solutions/integration-issues/zitadel-idp-update-resets-provider-options.md`).
- **Don't edit an ontology while embeddings run.** The job aborts with "branch changed".
- **Use a browser-like User-Agent for scripted API calls.** Cloudflare blocks Python's default client.

## Next (after BAIF)

1. **Deploy memory guard:** make deploys memory-safe, with the deploy script freeing memory before building, or with images built in CI and only pulled on the box.
2. **riehl-dev:** investigate the saturated `riehl-dev` box (cockpit services).
3. **Production:** plan a CDCF/ALEA domain, a dedicated Google project with brand verification, and a production ZITADEL.
4. **Small follow-ups:**
   - **Mobile edge cases:** hash links and device rotation.
   - **Tree reload:** a rare tree reload when the URL is replaced.
   - **Coverage cache:** a per-commit cache for translation coverage.
5. **ce-compound:** done. The two learnings are in `docs/solutions/integration-issues/`: the ZITADEL IdP options trap and Hetzner's SMTP 25/465 block. The other candidates are already covered by code, tests, or runbooks.
