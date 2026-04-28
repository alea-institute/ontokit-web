# Codebase Structure — ontokit-web

## Top-level layout
```
ontokit-web/
├── app/                  # Next.js App Router pages
├── components/           # React components by domain
├── lib/                  # Clients, hooks, stores, helpers
├── messages/             # i18n translation files (next-intl)
├── public/               # Static assets
├── __tests__/            # Vitest test suites (separate from app/components)
├── scripts/              # Release + version mgmt scripts
├── docs/                 # Project docs
├── .planning/            # Local planning docs
├── auth.ts               # NextAuth.js config (root-level), token refresh + session
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── postcss.config.js
├── package.json / package-lock.json
├── .env.example / .env.local
├── ontokit-web.sh        # dev server lifecycle wrapper (start/stop/restart/status)
├── Dockerfile
└── CLAUDE.md / AGENTS.md / README.md / SECURITY.md / RELEASING.md
```

## app/ (Next.js App Router)
- `[locale]/` — internationalized routes
- `api/` — BFF API routes
- `api-docs/` — API documentation browser (Scalar)
- `auth/` — auth pages
- `docs/` — documentation pages
- `projects/` — project listing + per-project pages
  - `projects/[id]/editor/page.tsx` — main ontology editor (three-panel layout)
- `settings/` — user settings

## components/ (organized by domain)
- `ui/` — reusable Radix-based UI primitives
- `editor/` — ontology editor (ClassTree, ClassDetailPanel, TurtleEditor, …)
- `pr/` — pull request workflow
- `revision/` — branch + revision history
- `graph/` — ontology graph visualization
- `diff/` — diff viewer
- `collab/` — collaboration indicators
- `layout/` — header / sidebar
- `projects/` — project listing
- `suggestions/` — suggestion UI
- `docs/` — documentation rendering
- `icons/` — custom SVGs
- `auth/` — auth components

## lib/
- `api/` — type-safe API clients
  - `client.ts` — base `api.get/post/...` + `ApiError`
  - Domain APIs: `ontologyApi`, `classApi`, `projectOntologyApi`, plus `projects`, `revisions`, `lint`, `pullRequests` clients
- `editor/` — Monaco support: `languages/turtle.ts`, `indexWorker.ts` (Web Worker for IRI indexing)
- `ontology/` — `types.ts` with OWL entity types (`OWLClass`, `OWLProperty`, …)
- `collab/` — WebSocket collab client
- `graph/` — graph data structures
- `git-graph/` — git history graph rendering
- `hooks/` — custom React hooks (e.g. `useOntologyTree`)
- `stores/` — Zustand stores
- `context/` — React contexts
- `i18n/` — internationalization plumbing
- `docs/` — docs utilities
- `utils.ts` — `cn()`, `getLocalName(iri)`, `getPreferredLabel(labels, lang)`

## Editor architecture (`app/projects/[id]/editor/page.tsx`)
- Three-panel: Class tree (left) / Detail panel (right) / Source + Health tabs (bottom)
- Tree state: `useOntologyTree` hook with lazy loading
- Source view: Monaco + custom Turtle language
- Lint indexing offloaded to Web Worker

## Tests
`__tests__/` (Vitest, jsdom env, @testing-library/react)

## TypeScript paths
- `"@/*": ["./*"]` — root-level alias
