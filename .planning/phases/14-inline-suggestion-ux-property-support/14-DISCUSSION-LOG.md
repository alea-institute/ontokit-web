# Phase 14: Inline Suggestion UX & Property Support - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 14-inline-suggestion-ux-property-support
**Areas discussed:** Suggestion card design, Flashcard iterator flow, Property tree integration, Session state & counters, Two-stage class workflow details, Loading & error states, Keyboard shortcuts for suggestions

---

## Suggestion Card Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline below each section | Suggestions appear below their respective sections (children below children, etc.) | ✓ |
| Dedicated suggestions section at bottom | All suggestions grouped in one collapsible section | |
| Slide-out side panel | Separate narrow panel slides out from right | |

**User's choice:** Inline below each section
**Notes:** Keeps context close to what suggestions augment

## Card Action Buttons

| Option | Description | Selected |
|--------|-------------|----------|
| Icon buttons inline | Check, X, pencil icons on right side of each card row | ✓ |
| Action bar on hover/focus | Floating toolbar appears on hover | |
| Swipe-style cards | Mobile-inspired swipe gestures | |

**User's choice:** Icon buttons inline
**Notes:** Compact, matches existing annotation row patterns

## Confidence Score Display

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle badge + color coding | Small % badge with green/amber/red background | ✓ |
| Progress bar + detail tooltip | Thin horizontal bar with breakdown tooltip | |
| You decide | Claude picks | |

**User's choice:** Subtle badge + color coding

## Suggestion Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| One button, all types at once | Single button fires all suggestion types in parallel | |
| Per-section suggest buttons | Each section gets its own suggest button | |
| Button with type picker dropdown | One button opens dropdown for type selection | |

**User's choice:** Custom — Two-stage workflow:
- IF additions = Class: (1) Suggest classes only → (2) user curates → (3) system auto-populates annotations
- IF additions = Annotations: system populates for (a) that class, (b) siblings, or (c) descendants
**Notes:** This fundamentally shaped the phase's approach — the user's mental model is "concepts first, then details about each concept"

## Flashcard Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Tab replaces tree panel | Flashcard tab alongside Tree/Graph with compact progress + navigation | |
| Full-screen overlay | Flashcard takes over entire editor area | |
| No separate mode (user's counter-proposal) | Populate existing edit view with sparkle-tagged suggestions + Next/Prev navigation | ✓ |

**User's choice:** No separate flashcard mode — just use the existing edit view
**Notes:** "Do we even NEED a flashcard mode? Can't the system simply populate the Edit mode?" — major scope simplification. The "iterator" is just sequential tree navigation with Next/Prev buttons, not a mode switch.

## Stage 2 Auto-Annotation Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-trigger immediately | Annotations fire as soon as a class is accepted | ✓ |
| Batch after all classes reviewed | User reviews all classes first, then triggers annotation batch | |
| Per-class trigger | Each accepted class gets a manual trigger button | |

**User's choice:** Auto-trigger immediately

## New Class Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Appear in tree immediately | Accepted classes show in tree with sparkle badge | ✓ |
| Staged in pending section | Accepted classes go to temporary list | |

**User's choice:** Appear in tree immediately

## Annotation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Inline radio/toggle on button | Scope selector next to suggest button: This class / Siblings / Descendants | ✓ |
| Dropdown menu from button | Button opens dropdown with scope options | |
| Right-click context menu | Context menu on tree node | |

**User's choice:** Inline radio/toggle

## Batch Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by class, collapsible | Results grouped under class names in collapsible sections | ✓ |
| Flat list with class labels | Single scrollable list with class tags | |
| Flashcard one-at-a-time | Step through suggestions one by one | |

**User's choice:** Grouped by class, collapsible

## All Annotations at Once

| Option | Description | Selected |
|--------|-------------|----------|
| All annotations at once | After class approval, fire all annotation types in parallel | ✓ |
| Progressive (definitions first) | Generate definitions, then translations after approval | |
| You decide | | |

**User's choice:** All annotations at once

## Property Tree Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tab alongside class tree | Tabs: Classes / Properties. PropertyTree.tsx exists | ✓ |
| Combined tree with type icons | Single tree with C/P icons | |
| Separate properties page | Properties on own route | |

**User's choice:** Tab alongside class tree

## Property Detail Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Adapted sections | Same skeleton, sections adapt (Domain/Range for ObjectProperty) | ✓ |
| Completely separate panel | New PropertyDetailPanel component | |
| You decide | | |

**User's choice:** Adapted sections

## Session Counter

| Option | Description | Selected |
|--------|-------------|----------|
| Pending count only | Small "✨ 5" badge in header | ✓ |
| Accepted/Pending/Rejected breakdown | "12 ✓ | 5 ✨ | 2 ✗" display | |
| You decide | | |

**User's choice:** Pending count only

## Navigation Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Persist until session ends | Suggestions stay in session state across navigation | ✓ |
| Auto-reject on navigate away | Leaving auto-rejects unreviewed suggestions | |
| Prompt before navigating | Confirmation dialog before leaving with pending suggestions | |

**User's choice:** Persist until session ends

## Loading States

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton placeholders in-section | Shimmer/skeleton rows in relevant section | ✓ |
| Spinner overlay on section | Small spinner overlay | |
| You decide | | |

**User's choice:** Skeleton placeholders in-section

## Error States

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error banner in section | Error replaces skeletons with message + Retry | ✓ |
| Toast notification | Error as snackbar at bottom | |
| You decide | | |

**User's choice:** Inline error banner in section

## Keyboard Shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal set | Tab/Shift+Tab, Enter, Backspace, E | ✓ |
| Vim-style | j/k, y, n, e | |
| No shortcuts | Mouse-only | |
| You decide | | |

**User's choice:** Minimal set (Tab/Shift+Tab, Enter, Backspace/Delete, E)

## Claude's Discretion

- Animation/transition effects for suggestion appear/accept/reject
- Skeleton placeholder count and sizing
- Next/Prev interaction with tree expansion
- Accepted suggestion flash effect
- Property detail panel section ordering
- Default annotation scope selection

## Deferred Ideas

None — discussion stayed within phase scope
