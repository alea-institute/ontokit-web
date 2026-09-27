# Handoff — D09 auth-mode matrix: disabled-mode re-scope (2026-09-27)

## Where things stand
- **D08 is complete:** merged as `cc64c02b` (PR #53) with docs PR #55, and deployed to DEV along with #51/#52. DEV web is `cc64c02b`, API `13ad2f35`.
- **D09 is PR #57** (draft), branch `test/d09-auth-mode-matrix-20260925`. CI was green before the decision.
  - **Delivered and staying:** U1 (mode profiles and the web/API mode gate), U2 (seeding), U3 (honest sign-in UI, including PR Party, auth-error and the trust explainer), U5 cases 1–9, U6 evidence (receipts v3, exact service sets, `--fail-at` allowlist), and the review fixes.
  - **Real-stack evidence:** all ten cases passed once on real stacks at `b6b5f8e2`. The final two-run acceptance has not run yet.
- **Decision:** Damien answered the disabled-mode ask **"Read and suggest only"**. The plan's "Decision update — 2026-09-27" section defines the re-scope of R9, U4 and case 10.

## Next actions (in order)
1. **API (ontokit-api):** refuse the anonymous identity on write routes in disabled mode with 403. Keep reads and anonymous suggestions. Characterize first; the change goes in a new API PR.
2. **Web:** revert `22088c0d` and the tokenless-write parts of the follow-ups, restore U3's disabled copy, and replace case 10 with API 403 probes plus unavailable copy. Update `MODE_CASES`.
3. **Acceptance:** rerun the harness against the new API revision. Each new profile runs twice, and baseline and lifecycle once each. Also run the mismatch probes and compare the neighbouring Docker resources before and after.
4. **Ship:** merge the API and web PRs, deploy the pair to DEV, and write `docs/releases/d09-auth-mode-matrix-readiness.md`. Update the roadmap: D09 row and Resume here, with B13 CI, the non-loopback warning, #54 and #56 carried forward.

## Gotchas
- **Background waits:** never use `pgrep -f "scripts/e2e/run.mjs"` in a wait loop. It matches the waiting shell itself and deadlocks. Match `^node .*scripts/e2e/run.mjs` instead.
- **Concurrent edits:** the harness copies the working-tree bytes of tracked files, so don't run acceptance while workers are editing.
- **Worker routing:** the Opus-worker override expired at midnight 2026-09-25. Use Codex workers per standing policy.
