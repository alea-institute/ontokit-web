# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Development Server Management Script

Use the `axigraph-web.sh` script to manage the development server:

```bash
./axigraph-web.sh start    # Start the dev server (runs in background)
./axigraph-web.sh stop     # Stop the running server
./axigraph-web.sh restart  # Restart the server
./axigraph-web.sh status   # Check if server is running
```

**Important usage notes:**
- Always use this script instead of `npm run dev` directly for background server management
- The script handles port conflicts interactively (kill blocking process, use random port, or quit)
- When running non-interactively, first kill any process on port 3000, then run `start`:
  ```bash
  lsof -ti:3000 | xargs -r kill -9; sleep 2; ./axigraph-web.sh start
  ```
- To clear Next.js cache before starting: `rm -rf .next && ./axigraph-web.sh start`
- Log file: `.axigraph-web.log`
- PID file: `.axigraph-web.pid`
- Environment variable `PORT` can override default port 3000

## Architecture Overview

Axigraph Web is a Next.js 15 frontend for collaborative OWL ontology editing. It connects to a FastAPI backend (axigraph-api) for ontology operations.

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
