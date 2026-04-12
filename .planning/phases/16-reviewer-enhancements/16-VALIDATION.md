---
phase: 16
slug: reviewer-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | REVIEW-01 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | REVIEW-02, REVIEW-03, REVIEW-04 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | REVIEW-05 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/components/suggestions/ProvenanceBadge.test.tsx` — provenance icon + confidence rendering
- [ ] `__tests__/components/suggestions/SimilarEntitiesPanel.test.tsx` — duplicate candidates display
- [ ] `__tests__/components/suggestions/ShardTabNavigator.test.tsx` — shard tab filtering
- [ ] `__tests__/lib/api/suggestions.test.ts` — enriched session endpoint types

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provenance badges render in correct color | REVIEW-03 | Visual verification | Open review page, verify ✨/✏️/👤 icons with correct colors |
| Side-by-side comparison layout | REVIEW-02 | Visual layout check | Click duplicate candidate, verify two-column layout |
| Shard tab filtering hides/shows correct hunks | REVIEW-05 | Diff rendering visual | Click shard tabs, verify diff content changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
