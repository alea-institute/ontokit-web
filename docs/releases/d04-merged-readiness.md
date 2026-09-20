# D04 integrated verification

[API PR48](https://github.com/alea-institute/ontokit-api/pull/48) merged into API `dev` at `c6e552c844f315987f4eb614d04527c4c4a5e5af` on 2026-09-20 at 17:19:20 UTC. Reviewed head: `a2b981f5128ff61676f7e64a75daa860a1bf7d08`.

The repair prevents restricted actors from minting named typed individuals across all four public suggestion-save paths. Existing identities and trusted creation remain supported. The independent review found all six requirements met, no primary/actionable defects, and one pre-existing schema-taxonomy follow-up retained under B14.

All 3,243 local tests pass with no skips and 87% combined coverage. Locked Python 3.11 Ruff/mypy/pyright checks pass. CI passed lint, Semgrep, pyright, tests, package build and Docker preflight. Six conditional automation/publishing checks were skipped by their workflow conditions; those are not additional verification passes. The bounded CE PR monitor returned success with no feedback or fixes, no residual decisions and current-base mergeability proved.

[Plan and detailed evidence](https://github.com/alea-institute/ontokit-api/blob/c6e552c844f315987f4eb614d04527c4c4a5e5af/docs/releases/d04-individual-mint-readiness.md). No deployment or live persona acceptance is claimed. D05 submission errors, the B14 taxonomy follow-up, and D02 release acceptance remain.
