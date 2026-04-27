# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in OntoKit, **please do not open a
public GitHub issue**. We treat security reports privately so we can ship a
fix before details become public.

Two ways to report, in order of preference:

1. **GitHub Security Advisory** (preferred) — open a private report at
   <https://github.com/CatholicOS/ontokit-web/security/advisories/new> (or the
   equivalent path on `ontokit-api` if the bug is server-side). This keeps the
   report in GitHub's secure channel and gives us a structured place to
   coordinate fixes, CVE assignment, and disclosure.

2. **Email** — `priest@johnromanodorazio.com` if GitHub Advisories aren't
   suitable (e.g., you can't sign in or the issue spans multiple
   non-CatholicOS repos).

We'll acknowledge receipt within **5 business days** and aim to provide an
initial assessment within **10 business days**. Coordinated disclosure
timelines are negotiated case-by-case based on severity.

## Supported Versions

OntoKit is pre-1.0. Security fixes are applied to:

| Version          | Status                                |
| ---------------- | ------------------------------------- |
| `main`           | Latest tagged release                 |
| `dev`            | In-progress next release              |
| Older releases   | Not supported — please upgrade        |

There is no LTS line yet. Once OntoKit reaches 1.0 this section will be
expanded.

## Security Tooling

Both `ontokit-web` and `ontokit-api` are scanned on every PR and on every push
to `main` / `dev` by **[Semgrep](https://semgrep.dev)** (Pro engine, server-
side AppSec policy). The scan workflow lives at
`.github/workflows/semgrep.yml` and covers ~98,000 rules per scan.

### Enforcement modes

The org-wide policy at
<https://semgrep.dev/orgs/priest-johnromanodorazio-com/policies> applies the
following modes to the rulesets we explicitly enable on top of Semgrep's Pro
Rules baseline:

| Ruleset            | Mode      | Why                                                                |
| ------------------ | --------- | ------------------------------------------------------------------ |
| `p/owasp-top-ten`  | **Block** | High-confidence, well-vetted findings; PRs cannot merge if these fire |
| `p/jwt`            | **Block** | Targeted JWT-handling pitfalls; we use Zitadel JWTs everywhere      |
| `p/javascript`     | Comment   | Broad language pack; surfaces findings as PR comments without blocking |
| `p/typescript`     | Comment   | Same                                                               |
| `p/react`          | Comment   | Framework patterns                                                 |
| `p/nextjs`         | Comment   | Same                                                               |
| `p/python`         | Comment   | (api repo) Same as language packs above                            |
| `p/fastapi`        | Comment   | (api repo) Framework patterns                                      |

In addition, the Pro Rules baseline (~3,000 code rules) runs in **Monitor**
mode — findings are visible in the dashboard but don't post PR comments or
block merging. We promote individual rules to Comment or Block as we triage
them.

### What contributors see

- A **CI check** named `Semgrep` (or `Static analysis` on the api repo) on
  every PR. It fails when a Block-mode finding lands in the diff.
- **Inline PR comments** from `semgrep-app[bot]` for Comment-mode findings
  (only when the GitHub App is installed on the org — see
  <https://github.com/apps/semgrep>). These are advisory and don't block
  merge.
- A link from the check's "Details" page to the matching dashboard view at
  semgrep.dev for triage history.

### Suppressing false positives

If a Semgrep finding is a confirmed false positive, suppress it inline:

```python
# nosemgrep: <rule-id>  Reason: <why it's safe in this context>
foo()
```

```typescript
// nosemgrep: <rule-id>  Reason: <why it's safe in this context>
foo();
```

The `Reason:` is required — bare `nosemgrep` comments without justification
will be rejected at code review. For repository-wide exclusions (build output,
test fixtures, generated files), edit `.semgrepignore`.

### Local Semgrep recipe

See `CLAUDE.md` for the equivalent `semgrep` invocation contributors can run
locally before pushing. Both the Pro and the OSS-engine fallback are
documented there.

## Out of Scope

The following are **not** considered security vulnerabilities:

- Findings in code that lives under `__tests__/`, `tests/`, `docs/`,
  `.planning/`, or other paths excluded via `.semgrepignore`. Those locations
  are intentionally permissive (test fixtures use insecure patterns
  deliberately).
- Issues in unsupported third-party services we integrate with (Zitadel,
  GitHub, Cloudflare). Report those upstream.
- DoS via rate-limiting or unauthenticated endpoint flooding — we rely on
  reverse-proxy / WAF layers for those, not application code.
- Self-XSS or attacks that require an attacker to already control the
  victim's browser session.

## Disclosure Coordination

Once a fix is shipped, we'll publish a GitHub Security Advisory (with the
reporter credited unless they request anonymity) and request a CVE if the
issue warrants one. Please don't disclose details publicly — including via
social media, blog posts, or conference talks — until the advisory is
published.
