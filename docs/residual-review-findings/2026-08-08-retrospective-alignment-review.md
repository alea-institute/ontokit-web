# U6 — Retrospective Alignment Review (five lenses + orchestrator disposition)

**Date:** 2026-08-08 · **Unit:** U6 (R6, KTD6) · **Scope:** everything built OUTSIDE the CE
harness on 2026-08-08 — the LLM-subsystem fix rounds 1–3 (ontokit-api + ontokit-web) and the
FOLIO DEV infrastructure standup + deploy configuration.

**Method:** five independent Codex reviewers, one per lens, each on a fresh context against a
common evidence pack (`.worker-reports/u6-evidence/`: both repos' fix-round diffs/diffstats/
commits; the running DEV compose with env values withheld and key names only; the traefik route
with the basic-auth hash redacted). Orchestrator (Fable) adversarially verified every P0/P1
before acting. Anti-ratification instruction was binding on all lenses: the plan's endorsement
of already-built work (KD1, KD4) is a decision, not evidence.

Lens reports (full text): `.worker-reports/u6-lens{1,2,3,4,5}.md`.
- Lens 1 — initial-requirements trace (MASTER-OUTLINE consolidation)
- Lens 2 — raw-outline trace (`docs/roundup-2026-08/outlines/`)
- Lens 3 — execution-plan contract trace (R/KD/KTD/Verification/DoD)
- Lens 4 — engineering best-practices + `docs/solutions/` learnings
- Lens 5 — security posture (exposure, secrets, GitHub write-path)

---

## Headline

The out-of-harness fix rounds are a **genuine engineering recovery, not cosmetic ratification**:
across all five lenses they materially satisfy the LLM-integrity intent (R2/R3/KTD8), add real
Postgres + real-git regression coverage, close model-picker/cost/retry/cache-scope gaps at both
producer and consumer boundaries, and introduce a deterministic submit bound. All five lenses
independently reached the same verdict shape: **application-level fixes are careful; the DEV
standup — built with no written requirement — is below the bar for a durable shared environment,
and several DoD items (CI, promotion, Zitadel, IaC) are legitimately still future units.**

The review did its job as a real-data adversary: it drove the discovery/closure of **five live
findings mocks would never surface** (F5 unbounded submit sweep; F6 stale shadow deployment; F7
capabilities-blind UI; F8 empty graph; F9 Docker/ufw bypass) plus the **F9 IPv6 sibling** caught
by lens-4's adversarial pass.

---

## Confirmed & FIXED this session (verified live)

| ID | Severity | Finding | Fix | Verify |
|----|----------|---------|-----|--------|
| F9 | P1 sec | Docker port-publish bypassed ufw → auth-disabled API/web directly internet-reachable on `:8000`/`:3000` | IPv4 DOCKER-USER conntrack rule restricting to proxy IP; persisted `rules.v4` | off-box raw-port refused; proxy authed 200 / unauth 401 |
| F9-v6 | P1 sec | IPv6 sibling — `docker-proxy` on `[::]:3000/8000`, served via userland (bypasses FORWARD/DOCKER-USER) | ip6tables INPUT DROP (`! -i lo`) both ports; persisted `rules.v6` | rule in place; loopback + IPv4 proxy path intact |
| F6 | P2 sec | Stale 2026-07-28 Coolify OntoKit (api+web+worker) serving `ontokit(-api).dev` **ungated** with live cred env | all three stopped, restart disabled (reversible; app records intact) | unauth `/` 200→401; CPX41 bundle now served |

(F1/F3/F4/F5/F7/F8 dispositions are in `docs/roundup-2026-08/DEV-UAT-LOG.md`; they are the
fix-round + Phase-A code work, not infra.)

## Adversarially DOWNGRADED (evidence refuted the lens's severity for the current DEV state)

- **Lens 5 [P1] "GitHub write-path blast radius" → LOW on current DEV.** The reviewer reasoned
  from "PR #3 was opened" that a live GitHub write credential exists. Orchestrator check:
  `github_integrations` count = **0** on the seed project; the api container env holds **no PAT**
  (only `GITHUB_TOKEN_ENCRYPTION_KEY` + `GIT_REPOS_BASE_PATH`); PR #3 returned `pr_url: null`.
  So submit opened a **local bare-repo PR that never reached GitHub** — there is no live GitHub
  credential to abuse on this DEV seed. The *code path* concern is real and is exactly what U9's
  deny-by-default target-authorizer (KTD3-b) addresses; it is **not** a live Phase-A exposure.
  Kept as a design finding routed to U9, not a DEV incident.

## Confirmed, NOT yet fixed — routed to their owning units (not Phase-A-gating, but tracked)

| Finding (lens) | Severity | Owner | Note |
|----------------|----------|-------|------|
| Paid embedding budget is check-then-spend / audit-after-spend (no atomic reserve) — race + retry double-spend (L4 #1) | P1 | new issue (LLM subsystem) | Not live on DEV (paid embeddings are BYOK/off); real cost-correctness bug. File as ontokit-api issue. |
| Default DB/MinIO creds (`postgres`/`minio123`), Redis no-auth, flat bridge (L4 #5, L5 #2) | P1 | U12 (IaC) | Not host-published (5432/6379/9000/9001 externally blocked — verified); rotate + least-priv + network-split in IaC. |
| Ingress controls are live hotfixes; fail-open on rebuild/drift (L5 #3, L3 R13) | P1 | U12 (IaC) | DOCKER-USER + basic-auth + F9-v6 rules must become versioned IaC with a boot-time off-box probe. |
| Active-embedding-jobs migration can mark live jobs failed (no quiesce) (L4 #4) | P2 | new issue (ontokit-api) | Steady-state unique index is good; the one-shot cleanup races a running worker. |
| Mutable image tags (`:dev`, MinIO `:latest`), no resource limits (L4 #6, F5-class) | P2 | U12 | Pin digests; add CPU/mem/PID/log/volume ceilings; real worker-progress healthcheck. |
| Stale Coolify triad still reversible; retained cred env needs rotation/decommission (L5 #4, F6) | P2 | **Damien decision @ gate** | Decommission vs bring-under-gate; rotate `ZITADEL_SERVICE_TOKEN`/`GITHUB_TOKEN_ENCRYPTION_KEY`/DB/MinIO that lived in it. |
| WS `/ws` route broad; CSP/security-header posture unproven (L5 #6) | P2 | U7/U12 | Narrow `/ws`; assert CSP/HSTS/frame-ancestors at one layer; auth every WS handshake. |
| Full two-box listener inventory not captured (L5 #5) | P2 | U12 | `ss`/`iptables-save`/`ip6tables-save`/`docker ps` on both boxes into the runbook. |
| Integration suite is real-PG/real-git **regression** coverage, not full lifecycle E2E (L4 #3) | P2 | U5 | U5's live approve→merge→trust is the missing end-to-end proof; don't over-claim the harness. |

## Anti-ratification findings (built with no written requirement — recorded as scope, per KTD6)

1. **The entire DEV standup had no authored requirement** (all five lenses). The plan itself says
   so (`…execution-plan.md:219`) and retroactively introduces R13/U12. Closes only when committed
   IaC matches the running server and hand-rolled state is retired (DoD).
2. **KD1's ratification of `commit_identity.py` + `mirror_credential.py` lacks independent
   attribution evidence** (L1, L3, L5). No supplied diff shows `mirror_credential.py` or an
   attributed *merge* commit (contributor author + bot committer). **U5 is the ratification gate** —
   its git-log assertion must actually observe the attributed merge, or KD1 is unproven.

## Consolidation / plan-absorption errors the lenses caught (worth a plan erratum)

- **R6 under-scopes its own review** — U6 reviews "deploy configuration" + a 5th security lens that
  R6's text doesn't name (L3). Harmless here (we did the broader review) but the Product Contract
  should say so.
- **KTD2/DoD overstate the historical gate** — "network-gated for its full duration" was only ever
  *hostname*-gated; F9/F9-v6 proved raw-port and IPv6 ingress were open until today (L3, L4, L5).
  The plan should distinguish "hostname gated" from "all ingress paths gated."
- **Consolidation losses** (L2) — five raw-outline intents not carried anywhere: user-configurable
  N-day auto-accept; explicit Google/other-SSO evaluation; "then-current credentials" submission
  metadata; the Generative-FOLIO/folio-python/folio-api/OWL tool-choice evaluation; translations as
  a first-class suggested annotation. Surface to Damien; some may be intentionally dropped.
- **The `docs/solutions/` learning the handoff promised isn't on the docs branch yet** (L4) — it's
  the U18/closeout `ce-compound` capture; legitimately still to be written. Not a defect, but the
  handoff over-claimed it as done.

## Verdict

**Conditionally aligned.** The fix rounds satisfy R2/R3/KTD8 and are sound application engineering;
the live P1 security exposures the review surfaced are closed and verified; the residual risk is
concentrated exactly where the plan already routes it — U12 (IaC/secrets/ingress-as-code), U7
(auth-on terminal), U9 (GitHub target-authorizer), and U5 (the KD1 attribution proof + true E2E).
No confirmed finding blocks proceeding, provided the auth-disabled window stays behind the now-
verified multi-path gate and the routed items are tracked. The one item needing **Damien's decision
at the phase gate** is the stale Coolify triad: decommission vs bring-under-gate, plus rotation of
the credentials that lived in it.
