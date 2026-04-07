# Phase 15: Session Clustering & Batch Submit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 15-session-clustering-batch-submit
**Areas discussed:** Clustering Algorithm, Shard Preview UX, Git Mechanics, Submit Flow Lifecycle

---

## Clustering Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level branches | Each top-level class under owl:Thing gets its own PR | |
| Two levels deep | Split at the second level of the taxonomy | |
| Dynamic by density | Auto-detect the deepest level where PRs stay under threshold | ✓ |

**User's choice:** Dynamic by density
**Notes:** Adaptive approach — finds the deepest level where PRs stay under ~10 shards / ~50 suggestions.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-form own shard | Cross-cutting changes automatically become their own shard | ✓ |
| Prompt user to assign | Ask user which PR/shard to place it in | |
| Always miscellaneous | All cross-cutting changes go into Miscellaneous shard | |

**User's choice:** Auto-form own shard
**Notes:** No user prompt — preview shows the result and user can adjust there.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip clustering, single PR | If total suggestions ≤ threshold, skip clustering | ✓ |
| Always cluster | Run clustering regardless of session size | |
| Single commit, no shard | One commit with no shard structure at all | |

**User's choice:** Skip clustering, single PR
**Notes:** Avoids overhead for small sessions.

---

| Option | Description | Selected |
|--------|-------------|----------|
| First parent wins | Use first declared parent (rdfs:subClassOf order) | |
| Larger shard wins | Assign to whichever subtree has more suggestions | ✓ |
| User chooses in preview | Flag ambiguous assignments for user to resolve | |

**User's choice:** Larger shard wins
**Notes:** Keeps shards balanced, less predictable than declaration order but more practical.

---

## Shard Preview UX

| Option | Description | Selected |
|--------|-------------|----------|
| Nested tree | Two-level tree: PR groupings → shard-commits → entity list | ✓ |
| Flat grouped list | Flat list of shards with PR badge/tag | |
| Card grid | Each shard as a card with drag between PR groups | |

**User's choice:** Nested tree
**Notes:** Mirrors the ontology hierarchy. Visual and informative.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button-based actions | ⋮ menu with Merge, Split, Rename; "Move to..." dropdown | |
| Drag-and-drop | Drag entities between shards, shards between PRs | |
| Both (buttons + drag) | Drag-and-drop primary with button fallbacks | ✓ |

**User's choice:** Both (buttons + drag)
**Notes:** Best UX with accessibility fallback. More implementation effort accepted.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Entity names + counts | Label, entity count, collapsible entity name list | ✓ |
| Inline diff previews | Mini-diff per entity (added labels, new parents) | |
| Names + provenance badges | Entity names plus provenance tags | |

**User's choice:** Entity names + counts
**Notes:** Compact and scannable. No inline diffs in preview.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both editable | PR titles and commit messages inline-editable | |
| PR titles only | PR titles editable, commit messages locked | |
| No renaming | Everything auto-generated | ✓ |

**User's choice:** No renaming — but user can add notes/descriptions
**Notes:** Titles/messages auto-generated. User-added notes become commit body and PR description. Clean separation of auto vs user content.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen modal | Modal overlay like EntityGraphModal | ✓ |
| Side panel | Slides in alongside editor | |
| Dedicated page | Navigates to /projects/[id]/submit | |

**User's choice:** Full-screen modal
**Notes:** Existing pattern in codebase. Focused review before submitting.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, top summary bar | Compact bar: "12 suggestions → 4 shards → 2 PRs" | ✓ |
| No summary bar | Jump straight into the tree | |

**User's choice:** Yes, top summary bar
**Notes:** Instant orientation before diving into details.

---

## Git Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Descriptive with ancestor path | Human-readable subject with ancestor context | ✓ (combined) |
| Conventional commits, minimal | Short conventional commit format | |
| Structured metadata format | Machine-readable YAML-like body | ✓ (combined) |

**User's choice:** Both — descriptive subject line for humans + structured metadata in body for tooling
**Notes:** Best of both worlds. Subject line is human-scannable, body is machine-parseable.

---

| Option | Description | Selected |
|--------|-------------|----------|
| suggest/{session}/{subtree-slug} | Namespaced by session and subtree | |
| suggest/{user}/{timestamp} | User-oriented, unique by time, suffixed with index | ✓ |
| Reuse session branch | Keep existing session branch | |

**User's choice:** suggest/{user}/{timestamp}
**Notes:** e.g., suggest/damien/20260407-2100-1. Suffixed with PR index for multi-PR sessions.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + entity list + user notes | Auto-generated summary + full entity list + user descriptions | ✓ |
| Minimal with link to session | Brief summary with link back to OntoKit | |
| Template with provenance table | Includes provenance breakdown table | |

**User's choice:** Summary + entity list + user notes
**Notes:** Reviewers get full context. User notes appended as a separate section.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete after all PRs created | Clean up immediately | |
| Keep as archive | Keep as historical record | |
| Delete after all PRs resolved | Keep until merged or rejected | ✓ |

**User's choice:** Delete after all PRs are either merged or rejected
**Notes:** Safety net during review period.

---

| Option | Description | Selected |
|--------|-------------|----------|
| From main, replay changes | Create PR branch from main, apply shard as single commit | ✓ |
| From session branch, cherry-pick | Cherry-pick from session branch | |
| From session branch, filter | Git filter for relevant changes | |

**User's choice:** From main, replay changes
**Notes:** Clean diff against main. Backend assembles Turtle source per shard.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel | All PRs concurrently | |
| Sequential | One at a time | |
| Parallel with conflict check | Parallel, serialize on file conflicts | ✓ |

**User's choice:** Parallel with conflict check
**Notes:** Serialize only when two PRs would touch the same file.

---

## Submit Flow Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side | Backend computes clustering with full ontology tree | ✓ |
| Client-side | Frontend computes using loaded tree data | |
| Hybrid | Backend provides ancestor paths, frontend groups | |

**User's choice:** Server-side
**Notes:** Backend has full ontology tree (18K+ classes) and ancestor path queries.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step progress bar | Multi-step: Clustering → Creating branches → Opening PRs → Done | ✓ |
| Simple spinner with status text | Single spinner with rotating text | |
| Background with notification | Background job, notification when done | |

**User's choice:** Step-by-step progress bar
**Notes:** Shows which step is active. User knows exactly where the process is.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Partial success + retry failed | Show successful PRs + offer retry for failed | ✓ |
| Rollback all on any failure | Close all PRs if any fails | |
| Auto-retry with backoff | Auto-retry up to 3 times | |

**User's choice:** Show partial success + retry failed
**Notes:** No rollback of successful PRs. Retry button for failed ones.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Success summary with PR links | Modal shows PR links, shard counts, Done button | ✓ |
| Auto-close modal, show toast | Modal closes, toast with PR links | |
| Redirect to review page | Navigate to suggestions review page | |

**User's choice:** Success summary with PR links
**Notes:** User can click through to GitHub to review each PR.

---

## Claude's Discretion

- Exact threshold for "small session" clustering bypass
- Animation/transition effects in the shard preview modal
- ELK/layout algorithm for nested tree rendering
- Progress bar integration with modal
- Conflict check implementation details
- Summary bar animation during shard adjustments

## Deferred Ideas

None — discussion stayed within phase scope
