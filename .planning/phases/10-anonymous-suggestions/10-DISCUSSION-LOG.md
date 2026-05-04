# Phase 10: Anonymous Suggestions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 10-anonymous-suggestions
**Areas discussed:** Edit affordance, Submission flow, Spam protection, API auth bypass

---

## Edit Affordance

### Q1: What button should anonymous visitors see?

| Option | Description | Selected |
|--------|-------------|----------|
| Suggest Changes | Same label as authenticated suggesters | |
| Propose Edit | Softer language, implies review needed | ✓ |
| Edit (suggest mode) | Uses "Edit" with badge indicating review | |

**User's choice:** Propose Edit
**Notes:** Distinct from the authenticated "Suggest Changes" flow — different wording signals different level of access.

### Q2: Where should the button appear?

| Option | Description | Selected |
|--------|-------------|----------|
| ClassDetailPanel only | Next to class name header | ✓ |
| Both panel + header | Two entry points | |
| Panel + global banner | Button + dismissible banner | |

**User's choice:** ClassDetailPanel only
**Notes:** Focused — user picks a class first, then proposes.

### Q3: Sign-in link alongside?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, alongside | "Propose Edit" + smaller "Sign in for full editing" link | ✓ |
| Yes, in header only | Separation of concerns | |
| No sign-in upsell | Simplest UI | |

**User's choice:** Yes, alongside
**Notes:** Progressive disclosure — users can start immediately or upgrade.

---

## Submission Flow

### Q4: When should the credit modal appear?

| Option | Description | Selected |
|--------|-------------|----------|
| After submit click | Two-step: confirm changes, then optionally identify | ✓ |
| Before submit | Inline fields in submit panel | |
| After submission | Toast/banner after submit completes | |

**User's choice:** After submit click
**Notes:** System remembers name/email in localStorage for future proposals — only asks once.

### Q5: One at a time or batch?

| Option | Description | Selected |
|--------|-------------|----------|
| One class at a time | Simple, separate review items | |
| Batch multiple edits | Edit multiple classes, submit all at once | ✓ |

**User's choice:** Batch multiple edits
**Notes:** Same flow as authenticated suggestion sessions — batch is a single review item.

---

## Spam Protection

### Q6: Level of protection?

| Option | Description | Selected |
|--------|-------------|----------|
| Rate limit only | Max 5/IP/hour, no captcha | |
| Rate limit + honeypot | Invisible honeypot catches bots, no friction | ✓ |
| Rate limit + captcha | Most protection, adds friction | |
| Moderation queue only | Admin handles spam manually | |

**User's choice:** Rate limit + honeypot
**Notes:** No captcha — all anonymous proposals already go through the review queue.

---

## API Auth Bypass

### Q7: How to handle anonymous sessions?

| Option | Description | Selected |
|--------|-------------|----------|
| Anonymous token | Server-generated short-lived token, stored in localStorage | ✓ |
| Cookie-based session | httpOnly cookie, needs CSRF protection | |
| Tokenless endpoints | New /proposals/* endpoints, duplicates API surface | |

**User's choice:** Anonymous token
**Notes:** Token slots into existing suggestion API (all methods accept token param). No structural changes needed.

---

## Claude's Discretion

- Anonymous token expiration duration
- Rate limiting implementation details
- localStorage key naming
- Honeypot field placement

## Deferred Ideas

None
