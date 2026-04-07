---
phase: 14
slug: inline-suggestion-ux-property-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-00-01 | 00 | 0 | UX-01..06,PROP-01..05 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for suggestion UI hooks (useSuggestionStore, useGenerateSuggestions)
- [ ] Test stubs for property tree integration
- [ ] Test stubs for keyboard shortcut extensions

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sparkle icon visible on suggestion cards | UX-04 | Visual check | Open class detail, click Suggest improvements, verify sparkle icons |
| Skeleton loading animation | UX-01 | Animation check | Click Suggest improvements, verify skeleton placeholders appear |
| Keyboard shortcuts (Tab/Enter/Backspace/E) | UX-04 | Input interaction | Focus suggestion card, verify Tab moves focus, Enter accepts |
| Next/Prev navigation walks branch | UX-02 | Tree navigation | Select branch node, click Next, verify sequential class navigation |
| Property tree tab switching | PROP-01 | Tab interaction | Click Properties tab, verify property tree renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
