# OntoKit Web — Project Overview

Web frontend for OntoKit, a collaborative OWL ontology curation platform. Built with **Next.js 15 (App Router)** + **React 19** + **TypeScript** (strict). Talks to the `ontokit-api` FastAPI backend.

## Purpose
Provides a browser-based ontology editor with three-panel layout (class tree / detail panel / source view), real-time collaboration, PR workflow, and ontology health linting.

## Genesis
Built to serve two open-source ontology projects:
- **FOLIO** (Free Open Legal Information Ontology) — legal vocabulary
- **Catholic Semantic Canon** (Catholic Digital Commons) — faith vocabulary

Both need grassroots collaborative ontology editing tooling.

## Core Capabilities
- Ontology editor: ClassTree + DetailPanel + Monaco-based Turtle source editor
- Custom Turtle syntax: hover IRI resolution, Ctrl+Click navigation (internal IRIs jump in tree, external open in browser)
- Web Worker (`lib/editor/indexWorker.ts`) for IRI indexing — keeps lint off the UI thread
- Real-time collab via WebSocket
- Pull request workflow (review/merge ontology changes)
- Ontology health checks (20+ semantic linting rules)
- Graph viz (D3.js + @xyflow/react + ELK layout)
- Git-style branch + revision history
- i18n via `next-intl`, dark mode, responsive
- Scalar-based API documentation browser

## Tech Stack
- **Framework**: Next.js 16.x (note: package.json pins ^16.2.4; CLAUDE.md/README still say "Next.js 15")
- **UI**: React 19, Tailwind CSS v4, Radix UI primitives, lucide-react
- **State**: Zustand (client) + TanStack Query (server state) + URL state for editor selection (`classIri` query param)
- **Auth**: NextAuth.js v5 + Zitadel OIDC (token refresh + session in `auth.ts`)
- **Editor**: @monaco-editor/react + monaco-editor with custom Turtle language
- **Validation**: Zod v4
- **Visualization**: D3, @xyflow/react, ELK
- **Testing**: Vitest + @testing-library/react + jsdom
- **Drag/drop**: @dnd-kit

## Engines
Node.js >= 22.13.0 (per package.json). README says >=20.9, package.json is authoritative.

## Repo Location
`/home/johnrdorazio/development/CatholicOS_org/ontokit/ontokit-web`

Companion repo: `ontokit-api` (Python FastAPI backend, sibling directory).
