# U6 Retrospective Alignment Review — Lens 4: Best-Practices Trace

## Review scope and evidence limits

This review covers the API and web fix-round diffs, their commit/diffstat inventories,
the captured DEV compose/environment and Traefik configuration, the full DEV/UAT log
through F9 and the Phase A status block, and the residual-review dispositions. It does
not re-report F5 or F9. The supplied `*-code.diff` files omit migrations and tests even
though the diffstats list them; I therefore inspected the corresponding read-only API
checkout files to test the live-Postgres claim. No network or live-host probe was used.

The requested `docs/solutions/` corpus is absent from both checked-out repo branches
(`docs/solutions/` in web and `../ontokit-api/docs/solutions/` do not exist). The two
older OntoKit learnings survive only in the web repo's `.worktrees/pr-party/docs/solutions/`.
That absence is itself recorded below; it also means this review cannot honestly claim
that a new F2/F3/F5/F9 learning landed on the docs branch.

## Findings

### [P1] Paid embedding budgets remain check-then-spend and audit-after-spend

**Best practice violated:** a financial/resource limit must reserve capacity atomically
with the actuation it limits; post-hoc logging is observability, not enforcement. This is
also the invariant-scope lesson: “review it as a **coverage set, not a mechanism**”
(`.worktrees/pr-party/docs/solutions/2026-07-28-cross-model-review-invariant-scope.md`,
section 1).

**Evidence:** `../ontokit-api/ontokit/services/embedding_service.py:142-166`
checks the current budget, performs the paid provider operation at line 150, then opens
a separate session and commits the audit row at lines 154-166. The fix-round hunk is
`.worker-reports/u6-evidence/api-fixround-code.diff:527-551`. There is no reservation,
row lock, compare-and-swap, or idempotency key around that sequence.

**Failure mode:** concurrent calls can all observe remaining budget and all spend past
the cap. If provider success is followed by an audit DB failure, the caller/job receives
an error after money was spent; a retry can spend again while the ledger still omits the
first charge. Full-project embedding repeats this sequence per batch
(`api-fixround-code.diff:591-600`), amplifying both races. The change improves accounting
over the original unmetered path but does not make the advertised cap a hard bound.

### [P1] The F9 firewall fix has an unclosed IPv6 sibling path

**Best practice violated:** network containment must cover every published address
family and must be verified at the actual ingress, not inferred from a hostname route.
The project learning says to enumerate every sink and subtract the covered ones
(`.worktrees/pr-party/docs/solutions/2026-07-28-cross-model-review-invariant-scope.md`,
section 1).

**Evidence:** the captured Docker state publishes both services on IPv4 **and IPv6**:
`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:140-141` shows
`0.0.0.0` and `[::]` listeners. F9 documents only an IPv4 `DOCKER-USER` rule with
IPv4 `--ctorigdst 178.156.208.239` and IPv4 proxy source `204.168.246.227`
(`docs/roundup-2026-08/DEV-UAT-LOG.md:150-169`). Neither captured compose nor Traefik
configuration contains an IPv6 bind restriction or ip6tables/nftables equivalent
(`dev-infra-compose-and-env.txt:67,124`; `dev-infra-traefik-route.txt:31-39`).

**Failure mode:** if CPX41 has globally routed IPv6 and Docker's IPv6 forwarding is
enabled, direct `[host-v6]:3000`/`:8000` traffic can bypass Traefik basic auth just as
the IPv4 path did before F9. The evidence does not prove live exploitability (no host
IPv6 state was supplied), but it proves the containment artifact is incomplete and the
published sibling was not verified.

### [P2] The “live-Postgres harness” is real but is not an end-to-end lifecycle harness

**Best practice / learning:** “with isolated workers, per-unit tests certify internal
consistency, and nothing else”; integration inspection is needed at seams
(`.worktrees/pr-party/docs/solutions/2026-07-28-pr-party-fifteen-unit-build.md`,
section 1). The plan's central lesson is that tests mocking every seam prove nothing.

**Evidence:** the API diffstat does contain a 508-line
`tests/integration/test_llm_review_regressions.py`
(`.worker-reports/u6-evidence/api-fixround-diffstat.txt:31-32`), and its tests use a
real SQLAlchemy/Postgres session plus a real `BareGitRepositoryService`
(`../ontokit-api/tests/integration/test_llm_review_regressions.py:49-92`). That is a
substantive improvement, not a mocked-DB relabel. However, the submit regressions mock
the refresh queue and PR-creation seam (`:255,284-286` and `:350-353`), and the semantic
case replaces the embedding provider (`:274-280`). The original residual review asked
for “create session → save → submit → approve against real Postgres + a fake provider”
(`docs/residual-review-findings/2026-08-08-llm-subsystem-review.md`, Test adequacy), but
no supplied evidence demonstrates that full lifecycle, including the real PR service,
terminal status constraint, outcome/trust write, Redis job, and post-merge refresh.

**Failure mode:** cross-seam defects can still green the suite—especially merge side
effects followed by DB commit failure, enqueue/audit partial failure, and retry/idempotency
behavior. The correct claim is “real Postgres + real git regression tests,” not “an
end-to-end live harness.”

### [P2] The active-job migration silently terminates valid in-flight work

**Best practice violated:** data migrations should avoid silently rewriting operational
state; when deduplicating active work, deployment must quiesce workers or preserve and
explicitly reconcile the chosen survivor/losers.

**Evidence:** `../ontokit-api/alembic/versions/z3a4b5c6d7e8_cap_active_embedding_jobs_per_project.py:18-41`
ranks every pending/running job per project, marks all but one `failed`, and immediately
creates the unique partial index. Selection is based on status/start time/id, not queue
ownership, provider request state, or worker liveness. The compose starts migrations as
part of API startup according to the environment log
(`docs/roundup-2026-08/DEV-UAT-LOG.md:10-12`) while a separately restarting worker is
configured (`dev-infra-compose-and-env.txt:80-107`); no quiescence/rollback procedure is
captured.

**Failure mode:** during upgrade, a legitimately executing paid embedding job can be
marked failed while its worker continues spending/writing. A later retry can duplicate
provider cost and race stale writes. The unique index is good steady-state protection;
the unsafe part is the uncoordinated cleanup used to make it installable.

### [P2] DEV uses shared default infrastructure credentials and a flat trust network

**Best practice violated:** secrets must be unique, non-default, least-privilege, and
kept out of declarative config; internal network location is not an authentication
boundary.

**Evidence:** Postgres is configured with `postgres/postgres`
(`.worker-reports/u6-evidence/dev-infra-compose-and-env.txt:5-9`), MinIO root with
`minio/minio123` (`:35-38`), and those MinIO root credentials are repeated in API and
worker environment blocks (`:58-60,90-93`). Redis has no authentication (`:20-29,
57,89`). All six services share one bridge (`:18,29,44,75,103,125,127-128`). The
withheld `.env` key inventory contains only application encryption/auth keys
(`:134-137`), so the captured deployment has no evidence of distinct datastore secrets.

**Failure mode:** compromise of the public-facing web/API container, an SSRF reaching
service DNS, or any future container added to the bridge yields predictable root access
to object storage and database/queue access, expanding a single service defect into
ontology, credential-ciphertext, queue, and repository compromise. This is a sibling of
F9's “inside one assumed boundary, outside the real one” class, not a re-report of F9.

### [P2] The DEV deployment is mutable and resource-unbounded

**Best practice violated:** deployment artifacts should be reproducible and workloads
must have explicit CPU, memory, PID, disk/log, and job-size bounds. F5's lesson is that
apparently valid per-entity work becomes an outage when the collection is unexpectedly
large.

**Evidence:** MinIO uses the mutable `latest` tag
(`dev-infra-compose-and-env.txt:31-33`); API/web images use mutable local `:dev` tags and
build directly from working directories (`:46-48,109-117`). No service has CPU, memory,
PID, log-rotation, or volume-growth limits anywhere in the complete compose snapshot
(`:1-133`). The worker healthcheck only tests that `/proc/1/cmdline` contains `arq`
(`:97-102`), not queue progress. F6 already demonstrated stale parallel deployments and
cached bundles serving the wrong backend (`DEV-UAT-LOG.md:104-120,187-195`).

**Failure mode:** rebuilds with the same tag can silently change dependencies or retain
stale application assets; an RDF parse/embed/index task can exhaust host memory, CPU,
logs, or persistent disk and take down every service on the shared host. A wedged worker
continues to report healthy. These are resource-bound siblings of F5.

### [P2] The out-of-harness DEV standup has no durable requirement or owned deployment artifact

**Best practice / anti-ratification:** deployed infrastructure needs an explicit owner,
threat model, acceptance checks, rollback, and version-controlled source of truth; the
fact that it worked once is not a specification.

**Evidence:** the plan explicitly describes the DEV infrastructure standup as work for
which “no requirement was ever written” and requires it be flagged
(`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:219`). The supplied
compose and Traefik files are evidence snapshots under `.worker-reports`, while F9 says
the live firewall rule must later be encoded by U12 (`DEV-UAT-LOG.md:166-169`). F6's
stale Coolify deployment also remains a reversible stop pending a decommission/keep
decision (`DEV-UAT-LOG.md:187-195`).

**Failure mode:** host rebuild, operator cleanup, Docker/network recreation, or a second
deployment tool can restore an insecure/stale topology with no authoritative drift
check or rollback procedure. This is scope that must be recorded, not retroactively
ratified by UAT success.

### [P3] The promised solutions capture is not present on either reviewed branch

**Best practice violated:** durable learnings must be stored where future work actually
discovers them. A handoff assertion is not the artifact.

**Evidence:** the handoff says the lesson “landed in the UAT log + a `docs/solutions/`
capture” (`docs/handoffs/2026-08-08-roundup-phase-a-handoff.md:61`), and the plan's U18
verification requires that learning to exist and link the review/dispositions
(`docs/plans/2026-08-08-001-feat-ontokit-roundup-execution-plan.md:296-300`). Yet neither
reviewed repo branch contains a `docs/solutions/` directory. Only older July learnings
exist in `.worktrees/pr-party/docs/solutions/`.

**Failure mode:** subsequent agents cannot discover the asserted F2/F3 lesson from the
documented path, and KTD6's instruction to evaluate against “the two `docs/solutions/`
learnings” is non-reproducible from the branch being reviewed.

## Sibling-risk register

| Class | Sibling risk | Evidence | Status |
|---|---|---|---|
| F5 — unbounded work | Paid full-project embedding iterates batches with only a non-atomic dollar check; compose has no host resource limits | `api-fixround-code.diff:591-600`; `dev-infra-compose-and-env.txt:1-133` | Open; findings 1 and 6 |
| F5 — unbounded work | Worker health proves process name, not forward progress or queue age | `dev-infra-compose-and-env.txt:97-102` | Open; finding 6 |
| F9 — alternate ingress | IPv6 ports are published, while the documented firewall repair is IPv4-specific | `dev-infra-compose-and-env.txt:140-141`; `DEV-UAT-LOG.md:158-166` | Open/conditional on routed IPv6; finding 2 |
| F9 — assumed boundary | Predictable datastore/root credentials are reachable from every container on the flat bridge | `dev-infra-compose-and-env.txt:5-9,20-44,56-62,88-95,127-128` | Open; finding 5 |
| F9 — config drift | Firewall fix and stale-deployment shutdown are live host state, not owned compose/IaC | `DEV-UAT-LOG.md:166-169,187-195` | Open; finding 7 |

## Solutions honored

- **Real seams are now exercised.** The new integration suite uses real Postgres and
  real bare-git for save/path/constraint behavior
  (`tests/integration/test_llm_review_regressions.py:49-92,97-144`). This materially
  honors “per-unit tests certify internal consistency, and nothing else,” although it
  stops short of the complete lifecycle.
- **Invariant coverage improved at both serialization boundaries.** Unsafe Turtle IRIs
  are rejected server-side and in the web serializer
  (`api-fixround-code.diff:1069-1114`; `web-fixround-code.diff:661-690`), honoring the
  learning to enumerate sinks rather than bless one guard.
- **Paid-model pricing fails closed.** Generation resolves pricing before provider
  actuation and returns 503 when it cannot be trusted
  (`api-fixround-code.diff:119-130`); transient pricing failures are negatively cached
  (`:841-901`). This correctly traces the mitigation to the spending mechanism.
- **Actuations disable transport retries.** Generation and suggestion mutations set
  `retryOn5xx: false` (`web-fixround-code.diff:256,299-380`), honoring the learning that
  the retry mechanism lives in the shared API client, not React Query.
- **Cross-project UI state is scoped by the full identity tuple.** Suggestion keys now
  contain project and branch (`web-fixround-code.diff:705-813`), a sound invariant-scope
  correction.
- **F5 produced a genuine bound.** Current submit validation rejects more than
  `MAX_NEW_ENTITIES_PER_SUBMISSION` before semantic calls
  (`../ontokit-api/ontokit/services/suggestion_service.py:262-269`), and the integration
  test asserts the duplicate service was never invoked
  (`tests/integration/test_llm_review_regressions.py:174-205`).

## Verdict

The out-of-harness fix rounds are a meaningful engineering recovery, not cosmetic
ratification: they added real Postgres/git coverage, closed multiple API/web contract
gaps, introduced deterministic submit bounds, improved fail-closed pricing, and applied
several invariants at both producer and consumer boundaries. However, the body of work
is not yet operationally robust. Its highest residual risks are exactly at cross-system
boundaries: paid work is not atomically budgeted, the deployment's IPv6 containment is
unproven, the migration can race live jobs, and the DEV topology relies on mutable host
state, default internal credentials, mutable images, and no resource ceilings. The
integration harness should be described accurately as real-Postgres/real-git regression
coverage, not a full end-to-end proof. Overall engineering quality is **mixed but
improving: application-level fixes are generally careful; deployment and lifecycle
engineering remain below the bar for a durable shared DEV environment.**
