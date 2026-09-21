# D08 authentication lifecycle plan review

Date: 2026-09-21. Target: `docs/plans/2026-09-21-0727-test-required-auth-lifecycle-plan.md`.

## Method and limits

Applied `ce-plan`, `ce-doc-review` and `ce-noslop`. Reviewed the current roadmap in the root checkout and D06 source at Web `83eaf957`. Six native lenses (coherence, feasibility, security, design, scope and adversarial) ran serially through one reused reviewer because agent capacity prevented separate reviewers. These are distinct lenses, not independent native votes. Three tool-less cross-model jobs reviewed the complete sanitized plan: security, adversarial and whole-document; the runner verified each used Claude Opus 5 with high effort and an independent serving family. No credentials or unrelated files were supplied.

This is a planning review, not implementation acceptance. No full-stack tests, production edits, identity changes or hosted acceptance occurred.

## Applied findings

Native adversarial P2: a null session after changing the Next clock could result from a generic decoder failure. U1/U3 now require the same captured, genuine cookie to authenticate just before its expiry boundary and reject beyond expiry plus verifier tolerance. A renewed response cookie cannot replace the specimen. This makes a broken clock instrument fail the proof.

Final native source reconciliation also found a concrete logout wiring uncertainty: the user menu reads `NEXT_PUBLIC_ZITADEL_CLIENT_ID`, while the isolated build and `next.config.ts` do not provide it. The plan now permits focused user-menu/configuration repairs only if the genuine logout case fails, and explicitly allows the U3 characterization → U2 repair → U3 acceptance loop. It does not declare provider logout broken before reproduction. The stale Goal Capsule reference now includes KTD5. The native reviewer confirmed the applied expiry correction resolves its finding.

## Cross-model dispositions

| Candidate concern | Source-grounded disposition |
| --- | --- |
| Clock preload unverified; require a maxAge fallback | Retain explicit U1 preflight and fail-closed stop. A production auth configuration hook would change the selected means and add a new code path merely to guarantee acceptance. Unsupported instrumentation requires revised evidence, not silently substituted proof. |
| Shared clock may overlap parallel cases | `playwright.config.ts` already specifies `workers: 1` and `fullyParallel: false`; sources also require serialized proof. Preserve this prerequisite. |
| Bootstrap credentials expire under short OIDC lifetimes | `bootstrap-identity.mjs` uses a private bootstrap PAT with a one-day expiration, not a short-lived OIDC access token. No new admin credential mechanism is needed. |
| Federated logout may not exist | `components/auth/user-menu.tsx` already clears NextAuth state then redirects to Zitadel end-session with client ID and post-logout URL. Characterize the existing behavior; final native reconciliation identified missing public client-ID wiring and the plan now permits a demonstrated repair. Do not prescribe unsupported ID-token exposure. |
| Failure artifacts could leak credentials | Existing Playwright configuration disables traces, screenshots and video; outputs remain private. R7 and verification permit only sanitized evidence. Do not enable artifact collection to satisfy this speculative concern. |
| Reload may cause concurrent refresh grants | No evidence of an actual race was provided. Preserve the explicit reproduced-blocker rule; a single-tab failure cannot be dismissed as deferred multi-tab work. |
| Copied-cookie invalidation after logout | Native source review confirms the acceptance concerns browser clearing and provider end-session. Stateless-cookie replay revocation would require a separate server-side revocation design; it is not acceptance here. R4 leaves production lifetime unchanged. |
| U2/U3 sequencing | Native review found no dependency cycle: repair integration precedes acceptance, not browser characterization. Added an explicit loop for executor clarity. |
| NODE_OPTIONS, callback validation, production bearer lifetime | Existing authority/security boundaries remain applicable; no new capability or demonstrated defect was identified. These do not expand this deliverable. |

## Execution prerequisites and remaining boundaries

The process-clock instrument remains unimplemented and must prove the actual Next/Auth.js verifier path, not merely a helper. Provider lifetime values and constraints must be read back against pinned disposable images. Failures remain blockers to acceptance. Preserve all 21 D06 mandatory cases and separate profile receipts; lifecycle evidence cannot close optional/disabled auth modes, hosted B02/B03, contributor suggestion review, B12 or B13. No essential product question requires user clarification before implementation.

Review outcome: ready for bounded implementation, with no unresolved review decision. Local document checks only; runtime verification belongs to U1–U4. Repository publication is outside this planning handoff.
