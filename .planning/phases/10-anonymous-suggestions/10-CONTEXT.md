# Phase 10: Anonymous Suggestions - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow anonymous users to propose edits on public projects without signing in. After submitting, optionally collect name and email for admin follow-up. Signed-in users with editor+ role keep existing "Edit Item" flow. When Zitadel/OAuth is configured, show "Sign in for full editing" alongside the proposal button.

</domain>

<decisions>
## Implementation Decisions

### Edit Affordance
- **D-01:** Anonymous visitors see a **"Propose Edit"** button on ClassDetailPanel (same position as "Edit Item" for editors)
- **D-02:** Button appears on **ClassDetailPanel only** — no toolbar or header CTA
- **D-03:** When Zitadel is configured, show **"Sign in for full editing"** link alongside "Propose Edit" (progressive disclosure — start immediately or upgrade)
- **D-04:** Signed-in users with editor+ role see "Edit Item" (unchanged). Signed-in suggesters see "Suggest Changes" (unchanged).

### Submission Flow
- **D-05:** After clicking "Submit Proposal", a **modal** appears: "Want credit for your suggestions?" with optional name and email fields
- **D-06:** If user provides name/email, system **remembers it in localStorage** for future proposals in the same browser — they don't get asked again
- **D-07:** Anonymous users can **batch multiple edits** across multiple classes before submitting (same as authenticated suggestion session flow)
- **D-08:** Each batch submission is a single review item for the admin

### Spam Protection
- **D-09:** **Rate limiting** — max 5 proposals per IP per hour (server-side)
- **D-10:** **Invisible honeypot field** in the credit modal — catches bots without adding friction for humans
- **D-11:** No captcha — all anonymous proposals already go through the moderation/review queue

### API Auth Bypass
- **D-12:** Server generates a **short-lived anonymous session token** on first proposal action
- **D-13:** Token stored in **localStorage**, used for subsequent API calls (save, submit, discard) within the session
- **D-14:** Backend tracks anonymous suggestion sessions by this token — no Zitadel needed
- **D-15:** Existing authenticated suggestion flow remains unchanged (uses Bearer token from Zitadel)

### Claude's Discretion
- Anonymous token expiration duration (suggest: 24 hours)
- Exact rate limiting implementation (middleware vs per-endpoint)
- localStorage key naming for anonymous token and cached name/email
- Whether the honeypot field is in the credit modal or the submit form

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Suggestion System
- `lib/api/suggestions.ts` — Full suggestion API client (createSession, save, submit, discard, review methods)
- `lib/hooks/useSuggestionSession.ts` — Session lifecycle management hook
- `lib/hooks/useSuggestionBeacon.ts` — Visibility/beforeunload flush via sendBeacon
- `components/suggestions/RejectSuggestionDialog.tsx` — Review dialog patterns
- `components/suggestions/RequestChangesDialog.tsx` — Review dialog patterns

### Permission Model
- `app/projects/[id]/editor/page.tsx` lines 242-264 — canEdit, canSuggest, isSuggestionMode logic
- `components/editor/ClassDetailPanel.tsx` lines 574-606 — canEnterEdit and edit button rendering

### Auth System
- `lib/auth-mode.ts` — getAuthMode(), isZitadelConfigured(), isAuthRequired()
- `auth.ts` — NextAuth config with conditional Zitadel provider

### API Routes (ontokit-api)
- `ontokit/api/routes/suggestions.py` — Suggestion API endpoints (all require RequiredUser today)
- `ontokit/core/auth.py` — RequiredUser, OptionalUser, ANONYMOUS_USER definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSuggestionSession` hook — manages full session lifecycle; can be extended for anonymous sessions with a different token source
- `suggestionsApi` client — all methods accept a token param; anonymous token can slot in
- `SuggestionSessionSummary` type — has `submitter` field; extend with `submitter_name`/`submitter_email`
- `useSuggestionBeacon` — uses sendBeacon with query param token; works without Bearer header

### Established Patterns
- Suggestion flow: create session → save changes → submit with summary → admin reviews
- All suggestion API calls pass `token: string` as a parameter — swapping in an anonymous token requires no structural changes
- `isSuggestionMode` flag drives the UI between edit/suggest modes in the editor page

### Integration Points
- ClassDetailPanel: add "Propose Edit" button where `showSignInToEdit` currently lives
- Editor page: new `isAnonymousProposalMode` flag alongside `isSuggestionMode`
- Suggestion API: new endpoints or modified auth for anonymous session creation
- Review page: display `submitter_name`/`submitter_email` from session metadata

</code_context>

<specifics>
## Specific Ideas

- "Want credit for your suggestions?" (plural) — exact wording for the post-submit modal
- Name and email are optional, not required — can submit fully anonymously
- localStorage persistence: remember name/email across proposals within same browser session
- The proposal flow should feel like the existing suggestion flow but without requiring sign-in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-anonymous-suggestions*
*Context gathered: 2026-04-03*
