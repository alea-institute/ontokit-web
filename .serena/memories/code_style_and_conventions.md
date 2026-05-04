# Code Style & Conventions — ontokit-web

## TypeScript
- **Strict mode** enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2022, module: esnext, moduleResolution: bundler
- `jsx: "react-jsx"` (no React-in-scope import needed)
- `incremental: true`, `noEmit: true` (build is via Next, type-check via `tsc --noEmit`)
- Path alias: `"@/*": ["./*"]` — root-relative imports

## ESLint (flat config, eslint.config.mjs)
Extends:
- `eslint-config-next/core-web-vitals`
- `eslint-config-next/typescript`

Custom rules:
- `react-hooks/set-state-in-effect`: warn (TODO: address)
- `react-hooks/immutability`: warn (TODO: address)
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: error, but `_`-prefixed args/vars are ignored

Ignored paths: `node_modules/**`, `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.

## Architectural patterns
- **API client**: all backend communication goes through `lib/api/client.ts`
  - Type-safe methods: `api.get`, `api.post`, etc.
  - Domain APIs: `ontologyApi`, `classApi`, `projectOntologyApi`
  - Errors wrapped via `ApiError`
  - Auth: access tokens passed via `session.accessToken` (NextAuth)
- **Auth**: NextAuth.js v5 (`auth.ts` at root). Zitadel OIDC. Token refresh handled there.
- **State boundaries**:
  - Server state → TanStack Query (`@tanstack/react-query`)
  - Client UI state → Zustand stores (`lib/stores/`)
  - Editor selection → URL state (`classIri` query param)
- **Web Workers**: heavy lifting (IRI indexing for lint) goes through workers — do NOT block the main thread
- **Monaco/Turtle**:
  - Custom language in `lib/editor/languages/turtle.ts`
  - Internal vs external IRIs distinguished via `commonPrefixes`
  - Hover provider resolves full IRIs; Ctrl+Click navigates internal / opens external
- **i18n**: `next-intl`; routes under `app/[locale]/`

## Styling
- **Tailwind CSS v4** (PostCSS plugin)
- `cn()` helper in `lib/utils.ts` for class merging (clsx + tailwind-merge)

## Validation
- **Zod v4** for runtime schema validation

## Testing conventions
- **Vitest** + jsdom + `@testing-library/react`
- Tests live in `__tests__/` (separate from source)
- Coverage via `@vitest/coverage-v8`

## Naming / file conventions
- React components: PascalCase `.tsx`, one component per file
- Hooks: `useXxx.ts(x)` in `lib/hooks/`
- Stores: Zustand stores in `lib/stores/`
- API clients: per-domain modules in `lib/api/`

## Doc files in repo
`CLAUDE.md`, `AGENTS.md` give Claude/agent guidance.
`PLAN-ontology-atomization.md` + critical analysis are local planning docs (likely .gitignored or repo-local).
