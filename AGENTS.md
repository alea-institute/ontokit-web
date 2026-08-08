# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Relationship and Remotes

This local checkout is the **FOLIO/Alea downstream fork** of CatholicOS OntoKit Web. It is
one working directory with two Git remotes, not a separate clone for each organization:

- `origin` — FOLIO/Alea downstream: `https://github.com/alea-institute/ontokit-web.git`
- `catholicos` — authoritative CatholicOS upstream:
  `https://github.com/CatholicOS/ontokit-web.git`

Agents should push FOLIO work and feature branches to `origin`. Treat `catholicos` as the
source for upstream changes; do not push to it unless the user explicitly requests that
specific action and confirms authorization. Before syncing or publishing, verify the
configuration with `git remote -v` rather than inferring a remote from the repository name.

To incorporate upstream changes into the downstream default branch, fetch `catholicos`,
fast-forward or merge its default branch into the local downstream branch as appropriate,
and then push the result to `origin`. Inspect branch names and divergence first; do not
assume both repositories currently use a branch named `main`.

### BAU Upstream Contribution Workflow

FOLIO/Alea is the working downstream where Damien builds features and fixes problems.
CatholicOS is the upstream project to which suitable improvements are proposed. The normal
business-as-usual correlation between them is:

1. Develop and validate the feature or fix in the FOLIO/Alea downstream repository.
2. Before opening an upstream PR, create an issue in the corresponding CatholicOS repository
   describing the problem, need, or desired feature to be solved. The issue establishes the
   upstream problem independently of FOLIO's implementation.
3. Open a CatholicOS PR as a **potential solution** to that issue, and explicitly link the PR
   to the issue. Do not present the downstream implementation as an assumed upstream decision.

Agents preparing CatholicOS contributions should preserve this issue-first ordering and the
problem/solution distinction. Do not open an upstream PR without first identifying or creating
its CatholicOS issue, unless the user explicitly directs otherwise.

## Build & Development Commands

```bash
npm run dev          # Start development server at http://localhost:3000
npm run build        # Build for production
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking
npm run test         # Run tests with Vitest
npm run test:coverage # Run tests with coverage
```

### Local Semgrep scan

CI runs `semgrep ci` (diff-aware against the PR baseline). For local one-shot
scans you have two options depending on whether you've signed up for Semgrep
Pro:

**With Pro entitlement** — runs the same engine as CI, including taint analysis
and the curated Pro rule pack. Requires `pipx install semgrep` and a one-time
`semgrep login`.

```bash
semgrep --pro \
  --config p/default \
  --config p/owasp-top-ten \
  --config p/javascript \
  --config p/typescript \
  --config p/react \
  --config p/nextjs \
  --config p/jwt
```

**Without Pro (community fallback)** — drop `--pro`. You get the same rule
packs but only the OSS engine; some advanced cross-file taint findings won't
surface. Useful for forks and external contributors.

```bash
semgrep \
  --config p/default \
  --config p/owasp-top-ten \
  --config p/javascript \
  --config p/typescript \
  --config p/react \
  --config p/nextjs \
  --config p/jwt
```

## Development Server Management Script

Use the `ontokit-web.sh` script to manage the development server:

```bash
./ontokit-web.sh start    # Start the dev server (runs in background)
./ontokit-web.sh stop     # Stop the running server
./ontokit-web.sh restart  # Restart the server
./ontokit-web.sh status   # Check if server is running
```

**Important usage notes:**
- Always use this script instead of `npm run dev` directly for background server management
- The script handles port conflicts interactively (kill blocking process, use random port, or quit)
- **Non-interactive mode is auto-detected** when stdin is not a terminal — the script automatically enables `--force` mode, killing any blocking process without prompting
- You can also explicitly use `--force` / `-f` to force-kill blocking processes:
  ```bash
  ./ontokit-web.sh restart --force
  ```
- To clear Next.js cache before starting: `rm -rf .next && ./ontokit-web.sh start`
- Log file: `.ontokit-web.log`
- PID file: `.ontokit-web.pid`
- Environment variable `PORT` can override default port 3000

## Architecture Overview

OntoKit Web is a Next.js 15 frontend for collaborative OWL ontology editing. It connects to a FastAPI backend (ontokit-api) for ontology operations.

### Key Architectural Patterns

**Authentication Flow**: Uses NextAuth.js v5 with Zitadel OIDC provider. The `auth.ts` file at root handles token refresh and session management. Access tokens are passed to API calls via `session.accessToken`.

**API Client Pattern**: All backend communication goes through `lib/api/client.ts` which provides:
- Type-safe API methods (`api.get`, `api.post`, etc.)
- Domain-specific APIs: `ontologyApi`, `classApi`, `projectOntologyApi`
- Automatic query parameter handling and error wrapping via `ApiError`

**Ontology Editor Architecture** (`app/projects/[id]/editor/page.tsx`):
- Three-panel layout: Class tree (left), Detail panel (right), Source/Health tabs (bottom)
- Tree state managed by `useOntologyTree` hook with lazy loading
- Source view uses Monaco editor with custom Turtle language support
- Web Worker (`lib/editor/indexWorker.ts`) handles IRI indexing for linting without blocking UI

**Monaco Editor Integration** (`components/editor/TurtleEditor.tsx`):
- Custom Turtle syntax highlighting in `lib/editor/languages/turtle.ts`
- Hover provider shows full IRI resolution
- Ctrl+Click navigation: internal ontology IRIs navigate to tree, external vocabulary IRIs open in browser
- Distinguishes internal vs external namespaces by checking against `commonPrefixes`

### Directory Structure Highlights

- `lib/api/` - Backend API clients (projects, revisions, lint, pullRequests)
- `lib/editor/` - Monaco editor support (languages, Web Worker indexing)
- `lib/ontology/types.ts` - OWL entity type definitions (OWLClass, OWLProperty, etc.)
- `components/editor/` - Ontology editor components (ClassTree, ClassDetailPanel, TurtleEditor)
- `components/pr/` - Pull request workflow components
- `components/revision/` - Branch and revision history components

### State Management

- **React Query** (`@tanstack/react-query`) for server state
- **Zustand** for client-side state
- **URL state** for selected class (`classIri` query param)

### Environment Variables

Required for development:
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:8000)
- `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` - Auth provider
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` - NextAuth.js configuration

### Utility Functions

`lib/utils.ts` provides:
- `cn()` - Tailwind class merging
- `getLocalName(iri)` - Extract local name from IRI (after # or last /)
- `getPreferredLabel(labels, lang)` - Get label in preferred language
