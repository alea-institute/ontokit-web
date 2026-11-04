---
title: "fix: demo-site banner reads as informational, not a warning"
date: 2026-11-04
status: active
type: fix
---

# Demo-site banner: informational treatment

## Problem

The demo-site banner (`components/layout/demo-site-banner.tsx`) uses amber
backgrounds and a flask icon. Amber is the conventional warning colour, so the
strip reads as an error or caution notice. The banner only explains what the
demo site is.

## Scope

- Visual change only. `DEMO_SITE_BANNER_COPY` stays byte-identical (approved copy).
- Calm "info" treatment: low-saturation blue/neutral surface, subtle bottom border,
  `Info` icon from lucide-react, text colour that meets WCAG AA (4.5:1) in light
  and dark themes.
- Keep `role="region"` + `aria-label`, non-dismissible behaviour, and the
  `NEXT_PUBLIC_DEMO_SITE` gate.

## Out of scope

- Copy edits (need Damien's draft-doc approval first).
- Dismissal (optional idea; adds state for little gain before the demo).

## Verification

- Unit test `__tests__/components/layout/demo-site-banner.test.tsx` passes and
  asserts the copy is unchanged and the info icon renders.
- `npm run lint`, `npm run type-check`, `npm run test`.
- Screenshots: desktop + phone widths, light + dark, before and after.

## Deploy

Low-risk CSS-only change. Deploy to the BAIF demo before the 2026-11-05 talk only
with live UAT, worker restarted first; otherwise ship after the talk.
