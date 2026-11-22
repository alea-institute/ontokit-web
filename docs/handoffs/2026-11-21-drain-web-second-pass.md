---
session: "d6d275b6-8076-4199-a4a0-677b072910c7"
written_at: "2026-11-22T00:38:34.710Z"
head: "5d2971b6ef42c4ec569e280d2956850057ddccbc"
worktree: "ontokit-web-drain-1120-int"
branch: "drain/1120-integration"
---
# Handoff: OntoKit web drain, second pass (2026-11-21)

## Where it stands

- **Branch:** `drain/1120-integration`, pushed. Nothing merged into `dev`, no pull request, nothing deployed; Damien reviews this stream before anything lands.
- **API used:** `drain/1120-diff-generative` at `11868392`.
- **Gates at head:** Vitest 5,882 of 5,882, type-check clean, lint 0 errors with 21 pre-existing warnings.
- **Full record:** `docs/plans/2026-11-20-1545-feat-diff-and-generative-expansion-plan.md`, section "Second pass (2026-11-21)".

## Done (tasks 1–6 of the second-pass brief)

1. **Review:** eleven defects in the editor layouts, `ClassDetailPanel`, and unrecorded editor files and hooks, each fixed test-first (Source drafts survive accepted suggestions, suggester acceptance gating, stale tree requests, shared bulk/detail batches, late saves across branch switches, Changes cache refresh, unique tree row ids, sibling eligibility, focus after closing bulk review, AI wording on tree markers). Merged from `drain/1120-review-fixes-a` and `drain/1120-review-fixes-b`.
2. **Layout:** "Suggest improvements" no longer overlaps field labels at 1280, 1440, 1920, and 390 px (geometry check plus inspected screenshots on the real stack).
3. **Real-stack acceptance:** bulk "Close review", disabled reasons, grounding copy, the four personas against the API's authorization, and real 429 and 402 refusals. Found and fixed: generation offered to suggesters who cannot accept classes; the wrong lock reason for non-members; vague refusal messages; a monthly-only budget claim after a daily-cap refusal.
4. **Scale:** 7,518 events on 3,018 entities; paging, filters, and digest agree. Found and fixed: a stale cursor on "Load more" blanked the list and blamed the filters.
5. **Wording:** the app ships one locale and no component reads the message catalog, so new strings stay inline like the rest of the app. Origin copy no longer overstates AI's role (provisional; see below).
6. **Plan record:** updated.

## Open for Damien

- **Decision Sheet `ontokit-web-2026-11-21-2211-ai-origin-wording`:** the wording "classes from AI suggestions" / "added from an AI suggestion" is built provisionally and marked; another choice means changing those strings.
- **Earlier open choices** OC1–OC9 in the plan still stand.

## Next, in order

1. **Review and land:** Damien reviews `drain/1120-integration` with the API branch; a pull request into `dev` follows his review.
2. **Author picker:** forty author buttons wrap into a long block; a searchable picker is needed before projects with many authors.
3. **Digest vs net-change totals:** the digest's "modified by people" and the strip's "Modified" differ by design (OC9); decide whether to keep both.
4. **Not walked:** migration downgrade, pull-request merge attribution, remote sync.

## How to rerun the acceptance walk

The walk ran on the repo's isolated harness (`scripts/e2e`, suggestions profile) held open by a small runner, with an OpenAI-compatible stub inside the API container and a SQL seed for scale. Those scratch files are not committed; the private copy of this handoff says where they are.
