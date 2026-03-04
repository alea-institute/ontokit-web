# OntoKit — Comprehensive Change Summary

> **Scope**: All changes across `ontokit-web` (20 commits, 104 files, +17,590/−924 lines) and `ontokit-api` (5 commits, 31 files, +3,070/−86 lines) since the feature branches diverged from `origin/main`.

---

## Overview

This PR transforms OntoKit from a basic ontology viewer into a full-featured collaborative ontology editor. The changes span both the frontend (Next.js) and backend (FastAPI) and can be grouped into four themes:

**Editing experience** — Users can now create, edit, and reparent ontology entities through structured forms rather than raw Turtle source. A WebProtege-style auto-save system prevents data loss: edits are drafted locally on blur and committed to git on navigation. Classes open read-only by default to prevent accidental changes, with an explicit "Edit Item" button and an optional continuous-editing toggle. Drag-and-drop reparenting supports OWL multi-parent semantics with cycle detection and undo.

**Collaboration** — A new "suggester" role allows non-editors to propose changes. Suggesters edit on dedicated branches; their work is auto-saved via `sendBeacon` and can be submitted as pull requests for editor review. Editors can approve, reject, or request changes through a built-in review page, with notifications keeping everyone informed. New users now default to the suggester role to ensure all initial contributions go through review.

**Visualization & navigation** — An interactive graph view (React Flow + ELK layout) renders entity relationships with expandable nodes and edge-type styling. A shared FOLIO-style tree renderer supports keyboard navigation, filtered search, and multi-level expand/collapse across Classes, Properties, and Individuals. Language tags display as flag emojis for a cleaner, more visual presentation.

**Quality & accessibility** — Both repos gained comprehensive test suites (111 tests total). The frontend added CI/CD, ESLint strict rules, Zod environment validation, error boundaries, and API retry logic. The backend gained lifespan handlers, JWT role extraction, full-text search, rate limiting, security headers, and custom exception types. Accessibility improvements include skip links, ARIA live regions, screen reader announcements for drag-and-drop, keyboard shortcuts, and reduced-motion/high-contrast media queries.

---

## Table of Contents

1. [Infrastructure & Code Quality](#1-infrastructure--code-quality)
2. [Editor Mode System & Theming](#2-editor-mode-system--theming)
3. [Entity Operations & Context Menus](#3-entity-operations--context-menus)
4. [Form-Based Editing](#4-form-based-editing)
5. [Auto-Save System](#5-auto-save-system)
6. [Read-Only Default & Continuous Editing](#6-read-only-default--continuous-editing)
7. [Shared Tree Renderer & Entity Panels](#7-shared-tree-renderer--entity-panels)
8. [Suggestion Workflow](#8-suggestion-workflow)
9. [Drag-and-Drop Class Reparenting](#9-drag-and-drop-class-reparenting)
10. [Graph Visualization](#10-graph-visualization)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Accessibility](#12-accessibility)
13. [UI Polish & Bug Fixes](#13-ui-polish--bug-fixes)
14. [Backend — API Infrastructure](#14-backend--api-infrastructure)
15. [Backend — Suggestion Sessions](#15-backend--suggestion-sessions)
16. [Backend — Bug Fixes & Role Changes](#16-backend--bug-fixes--role-changes)

---

## 1. Infrastructure & Code Quality

**Commit**: `a3c8d33` (web)
**Commit**: `1cab6c0` (api — infrastructure portion)

### Frontend (ontokit-web)

- **CI/CD pipeline** — GitHub Actions workflow (`.github/workflows/ci.yml`): lint → type-check → test → build, runs on push to main and PRs, Node.js 22, cached `node_modules`
- **ESLint flat config** — Migrated to `eslint.config.mjs` with `@typescript-eslint/no-explicit-any: "warn"` and stricter rules
- **Environment validation** — `lib/env.ts` uses Zod to validate required env vars at build time with helpful error messages; separates server-side and client-side vars
- **Test suite** — Vitest configured (`vitest.config.ts`) with `happy-dom`, path aliases, coverage thresholds; **26 tests** covering:
  - Utility functions (`getLocalName`, `getNamespace`, `getPreferredLabel`, `formatDate`, `debounce`, `generateId`)
  - API client (`api.get`, `api.post`, `api.put`, `api.delete`, `ApiError`, query params, empty responses)
  - Component rendering (button, project-card, BranchSelector)
- **Error boundary** — `components/error-boundary.tsx`: React error boundary wrapping the app with a friendly retry UI
- **API retry logic** — `lib/api/client.ts` now has 30s request timeout, retry on 5xx errors (max 2 retries, exponential backoff)
- **i18n locale detection** — `Accept-Language` header detection, cookie-based locale persistence

### Backend (ontokit-api)

- **85 passing tests** across unit and integration suites:
  - `test_auth.py` — Token validation, role extraction, permission checker
  - `test_config.py` — Settings loading, property methods
  - `test_search.py` — Search service methods
  - `test_linter.py` — Individual lint rules
  - `test_ontology_service.py` — RDF graph operations, format conversion
  - `test_projects_routes.py` — Project CRUD endpoints
  - `test_project_workflow.py` — End-to-end: create project → add ontology → create branch → commit → create PR → merge
- **Test fixtures** — `tests/conftest.py`: async test client, mock DB/Redis/MinIO, authenticated user fixture, sample data

---

## 2. Editor Mode System & Theming

**Commit**: `03e2575`

Adds a Standard/Developer mode toggle and full theme support, decomposing the monolithic editor page into mode-specific layouts.

- **Zustand store** (`lib/stores/editorModeStore.ts`) — persists `editorMode` ("standard" | "developer") and `theme` ("light" | "dark" | "system") to localStorage
- **Theme sync** — `useThemeSync()` hook keeps DOM `class` attribute in sync; inline `<script>` in `<head>` prevents flash of unstyled content
- **Dark mode** — Tailwind class-based (`darkMode: "class"`), all components styled with `dark:` variants
- **ThemeToggle** — lives in the global `Header` component, available on all pages
- **ModeSwitcher** — lives in the editor header, toggles between Standard and Developer views
- **Page decomposition**:
  - **Orchestrator** (`app/projects/[id]/editor/page.tsx`, ~850 lines) — owns project loading, auth, branch management, source loading, IRI indexing, entity CRUD, commit flow
  - **Developer layout** (`components/editor/developer/DeveloperEditorLayout.tsx`) — tree/source view switching, search, three-panel layout
  - **Standard layout** (`components/editor/standard/StandardEditorLayout.tsx`) — tree + detail panel with inline editing
- **Settings page** (`app/settings/page.tsx`) — Editor Preferences section for mode and theme

---

## 3. Entity Operations & Context Menus

**Commits**: `4147e40`, `e722205`

### IRI Generation & Entity Creation
- `lib/ontology/iriGenerator.ts` — generates valid IRIs from labels using ontology namespace, handles collisions
- `AddEntityDialog` — modal for creating Classes, Properties, Individuals with parent selection and IRI preview
- Optimistic tree updates — new nodes appear instantly before server confirmation

### Context Menus & Toast System
- **Right-click context menus** on tree nodes via Radix UI (`components/ui/context-menu.tsx`)
  - Add Subclass (Plus icon) — gated on `canEdit`
  - Copy IRI (Copy icon) — always shown
  - View in Source (Code icon) — developer mode only
  - Delete (Trash2 icon) — gated on `canEdit`, styled destructive
- **Toast notification system** — `components/ui/toast-container.tsx` rendering floating notifications (bottom-right, auto-dismiss), wired into `app/providers.tsx`
- **Delete class** — confirmation dialog → optimistic removal from tree → API call → rollback on error
- **Copy IRI** — one-click copy from tree context menu or detail panel header

---

## 4. Form-Based Editing

**Commit**: `108d93b`

Replaces raw Turtle source editing with structured, form-based class editing. All saves route through Turtle source text manipulation since the backend class endpoint only supports GET.

- **ClassDetailPanel** (`components/editor/ClassDetailPanel.tsx`) — structured editing for:
  - Labels (multilingual, with language tags)
  - Comments/definitions
  - Annotations (44 known annotation properties from `lib/ontology/annotationProperties.ts`)
  - Relationships (rdfs:seeAlso, rdfs:isDefinedBy, and other IRI-valued properties)
  - Parent classes (rdfs:subClassOf)
- **InlineAnnotationAdder** — persistent row with property dropdown + value input (replaces popup picker); ghost rows with descriptive placeholders ("Add another Definition — or translation.")
- **RelationshipSection** — dedicated section for IRI-valued properties with entity search
- **Turtle source save** — `lib/ontology/turtleClassUpdater.ts` finds the class block in Turtle text, regenerates it from form data, replaces in source, then saves via `PUT /source`
  - `findBlock` carefully checks continuation lines (`;`/`,`) to avoid matching object references instead of subject definitions
- **ClassUpdatePayload** — preserves `deprecated`, `equivalent_iris`, `disjoint_iris` during form edits
- **ResizablePanelDivider** — draggable tree/detail panel divider in both layouts
- **Entity search combobox** — async label resolution for IRI-valued fields

---

## 5. Auto-Save System

**Commit**: `9925e96`

WebProtege-style auto-save with a two-tier draft/commit model.

- **Draft store** (`lib/stores/draftStore.ts`) — Zustand + localStorage persist (`ontokit-drafts`), keyed by `"projectId:branch:classIri"`
- **useAutoSave hook** (`lib/hooks/useAutoSave.ts`):
  - **Tier 1 (blur)** — field blur writes to draft store instantly; validates labels before saving
  - **Tier 2 (navigate)** — navigating away from a class builds a `ClassUpdatePayload`, calls the source save endpoint, clears the draft
  - `discardDraft()` — clears draft from store, resets status
  - `onError` callback — enables toast notification on failed commits
- **AutoSaveStatusBar** (`components/editor/AutoSaveStatusBar.tsx`) — states: idle (hidden), draft (amber dot), saving (spinner), saved (green check), error (red + retry button); has `role="status"` and `aria-live`
- **Tree badges** — `ClassTree` accepts `draftIris?: Set<string>`, renders amber dot indicator on nodes with unsaved changes

---

## 6. Read-Only Default & Continuous Editing

**Commit**: `a3bf985`

- **Read-only by default** — classes open in read-only view even when the user has edit rights; prevents accidental edits while browsing
- **"Edit Item" button** — explicit entry into edit mode
- **"Cancel" button** — discards draft, reverts to server state, returns to read-only; sets `cancelledIriRef` to prevent auto-re-entry
- **Continuous editing toggle** (`ContinuousEditingToggle`) — persisted boolean in `editorModeStore`
  - When ON: classes auto-enter edit mode when data loads
  - Cancel overrides: prevents re-entry for that specific classIri
  - Available in editor header and settings page
- **Navigate-away behavior** — auto-commits current edits, new class opens read-only (or auto-editable if continuous editing is ON)

---

## 7. Shared Tree Renderer & Entity Panels

**Commits**: `4554022`, `eb36c2a`, `1a2a5d3`, `8b4e347`

### FOLIO-Style Shared Tree Renderer
- **EntityTree** / **EntityTreeNode** (`components/editor/shared/`) — shared tree component used by Classes, Properties, and Individuals
- **Keyboard navigation** — arrow keys for up/down/expand/collapse, Enter/Space to select
- **Filtered search** — type-ahead search with ancestor-path context preservation
- **Expand/collapse controls** — toolbar buttons for all/none/selected
- **Tree node alignment** — leaf dots share chevron column width for consistent indentation; stable selected-node border

### Entity Tabs & Detail Panels
- **Unified entity tabs** — Classes, Properties, Individuals tabs in both Standard and Developer layouts; removed redundant header
- **PropertyDetailPanel** — form-based editing for OWL properties (domain, range, characteristics)
- **IndividualDetailPanel** — form-based editing for OWL individuals (types, property assertions)
- **Aligned column layout** — consistent read-only section formatting across all entity types

---

## 8. Suggestion Workflow

**Commits**: `9e9ee50` (web), `2cd425c` (api)

A complete suggester workflow allowing non-editors to propose changes that go through review.

### Role System
- **"suggester" role** — new role between editor and viewer
  - `canEdit`: owner | admin | editor | superadmin
  - `canSuggest`: canEdit || suggester
  - `isSuggestionMode`: suggester && !canEdit → routes saves to suggestion API
- **Default role for new users** — changed from editor/viewer to suggester

### Frontend (ontokit-web)

- **API client** (`lib/api/suggestions.ts`) — session CRUD, save, submit, discard, beacon flush, and review methods (listPending, approve, reject, requestChanges, resubmit)
- **useSuggestionSession hook** — manages full session lifecycle:
  - Create → save → submit → discard
  - Resume changes-requested sessions (`resumeSession`)
  - Resubmit with incremented revision
  - `isResumed` flag for UI differentiation
- **useSuggestionBeacon hook** — `visibilitychange` + `beforeunload` flush via `navigator.sendBeacon`
- **useAutoSave extension** — `saveMode: "commit" | "suggest"` + `onSuggestSave` callback
- **Notification system**:
  - `lib/api/notifications.ts` — unified notification API (list, markAsRead, markAllAsRead)
  - `useNotifications` hook — 30s polling + event-driven refetch
  - **NotificationBell** (`components/layout/notification-bell.tsx`) — flat list with type-based icons, unread dots, mark-all-as-read
  - Types: suggestion_submitted/approved/rejected/changes_requested/auto_submitted, join_request, pr_opened/merged/review
- **My Suggestions page** (`app/projects/[id]/suggestions/page.tsx`) — lists user's suggestions with status, feedback display, resume button, revision badge, GitHub PR link
- **Review page** (`app/projects/[id]/suggestions/review/page.tsx`) — editors/admins review pending suggestions:
  - Summary and files tabs
  - Inline diff view
  - Approve / reject / request-changes action bar
  - `RejectSuggestionDialog`, `RequestChangesDialog`
- **Editor integration**:
  - "Review Suggestions" button in editor header with pending count badge
  - `?resumeSession={sid}&branch={branch}` query params for auto-resume
  - Resubmit vs Submit button based on `isResumed`

### Backend (ontokit-api)

- **Database model** (`ontokit/models/suggestion_session.py`) — `SuggestionSession` with statuses: active, submitted, auto-submitted, discarded, merged, rejected, changes-requested
- **Service layer** (`ontokit/services/suggestion_service.py`, 537 lines) — create session → save commits to dedicated branch → submit as PR → discard with branch cleanup
- **6 API endpoints** — create, save, submit, list, discard, beacon
- **Beacon token auth** (`ontokit/core/beacon_token.py`) — HMAC-signed JWT for `sendBeacon` authentication (no session cookie needed)
- **Background worker** (`ontokit/worker.py`) — auto-submit stale sessions (>30min inactive) via cron job every 10 minutes
- **Alembic migration** — `suggestion_sessions` table with foreign keys to projects and pull_requests
- **Pydantic schemas** (`ontokit/schemas/suggestion.py`) — request/response models for all endpoints

---

## 9. Drag-and-Drop Class Reparenting

**Commit**: `3494b1c`

- **Library**: `@dnd-kit/core` v6 + `@dnd-kit/utilities`
- **useTreeDragDrop hook** (`lib/hooks/useTreeDragDrop.ts`) — manages drag state, cycle detection, Alt-key tracking, auto-expand timer, undo state
- **MOVE mode** (default) — removes old parent, adds new parent
- **ADD mode** (Alt/Option held) — keeps old parents, adds new parent (OWL multi-parent support)
- **Cycle detection** — client-side tree walk for instant feedback; API ancestor check as fallback for unexpanded subtrees
- **Auto-expand** — 800ms hover on collapsed nodes during drag triggers expansion
- **Root drop zone** — thin dashed bar at top of tree; dropping removes all `rdfs:subClassOf`
- **Undo** — 5-second toast with Undo button; snapshots `oldParentIris` for rollback
- **Multi-parent confirmation** — dialog when moving a class that has multiple parents
- **Edge cases handled**: self-drop rejection, drop-on-descendant prevention, drop-on-current-parent no-op, drag disabled during search, drag disabled on currently-editing node, suggestion mode routing
- **DraggableTreeWrapper** (`components/editor/shared/DraggableTreeWrapper.tsx`) — wraps tree in `DndContext` with pointer + keyboard sensors
- **Screen reader support** — `onAnnounce` callback for drag events via `useAnnounce()`

---

## 10. Graph Visualization

**Commits**: `c24260a`, `4ff1731`, `20f58e7`

Interactive entity relationship graph using React Flow and ELK layout.

- **Dependencies**: `@xyflow/react` v12 + `elkjs` (lazy-loaded via `next/dynamic`)
- **Graph data builder** (`lib/graph/buildGraphData.ts`) — builds graph from `Map<string, OWLClassDetail>`, handles subClassOf / equivalentClass / disjointWith / seeAlso edges, caps children at 20/node, tracks visited set for cycle prevention
- **ELK layout** (`lib/graph/elkLayout.ts`) — layered algorithm, TB/LR direction toggle, 40px node spacing, 80px layer spacing
- **useGraphData hook** (`lib/hooks/useGraphData.ts`) — fetches focus node + depth-2 neighbors, `expandNode()` for on-demand expansion, `resetGraph()`, caps at 100 resolved nodes
- **Custom nodes** (`components/graph/OntologyNode.tsx`) — 5 node type styles (focus, parent, child, equivalent, disjoint) with dark mode support
- **Custom edges** (`components/graph/OntologyEdge.tsx`) — 4 edge type styles (subClassOf, equivalentClass, disjointWith, seeAlso) with hover labels
- **OntologyGraph** (`components/graph/OntologyGraph.tsx`) — ReactFlow canvas + MiniMap + Controls + layout direction toolbar
- **Integration**:
  - Developer layout: "Graph" tab alongside Tree/Source
  - Standard layout: "Graph" button in ClassDetailPanel header row
- **Session expiry guard** — detects `RefreshAccessTokenError` during graph data fetches

---

## 11. Keyboard Shortcuts

**Commit**: `c24260a`

- **useKeyboardShortcuts hook** (`lib/hooks/useKeyboardShortcuts.ts`) — single `keydown` listener with Mac `Cmd`/`Ctrl` compatibility
- **Shortcuts**:
  - `Ctrl+S` / `Cmd+S` — flush current draft to git
  - `Ctrl+N` / `Cmd+N` — open Add Entity dialog
  - `?` — open keyboard shortcuts help dialog
  - `Escape` — close current overlay/dialog
- **Input suppression** — shortcuts disabled inside Monaco editor, text inputs, textareas, dialogs
- **KeyboardShortcutDialog** (`components/editor/KeyboardShortcutDialog.tsx`) — groups shortcuts by category with `<kbd>` badges
- **UI integration** — keyboard icon button in editor header; `Ctrl+K` hint displayed near search icon in toolbar
- **Helpers** — `formatShortcut()` and `isMac()` exported for consistent display

---

## 12. Accessibility

**Commit**: `c24260a`

- **Skip links** — "Skip to main content" link in `app/layout.tsx` with `.skip-link` CSS class
- **Screen reader announcer** (`components/ui/ScreenReaderAnnouncer.tsx`) — `useAnnounce()` hook with polite + assertive ARIA live regions; mounted in `app/providers.tsx`
- **ARIA live regions** — `AutoSaveStatusBar` has `role="status"` + `aria-live` on all status variants
- **Drag-and-drop announce** — `useTreeDragDrop` has `onAnnounce` callback; both layouts pass `announce` from `useAnnounce()`
- **Tree accessibility** — `aria-activedescendant` on tree container, unique `id` on each tree item
- **Icon buttons** — all toolbar icon buttons use `aria-label` instead of `title`
- **Form inputs** — `AnnotationRow` and `InlineAnnotationAdder` inputs have `aria-label`
- **Reduced motion** — `@media (prefers-reduced-motion: reduce)` disables all animations
- **High contrast** — `@media (prefers-contrast: more)` increases focus ring width

---

## 13. UI Polish & Bug Fixes

**Commits**: `1e38288`, `15d9cfa`, `20f58e7`, `bcbfaaf`, `4ff1731`, `9a379b5`

- **Language flags** — replaced language code text badges (e.g., "en", "la") with country flag emojis for a cleaner, more visual presentation
- **Flag alignment fix** — invisible placeholder `div`s ensure consistent row height when a language flag is unavailable
- **Graph button positioning** — moved "Graph" button into `ClassDetailPanel` header row to fix overlap with the "Edit" button
- **Session expiry guard** — detects `RefreshAccessTokenError` and redirects to sign-in instead of showing cryptic errors; added to graph data fetches
- **seeAlso edges in graph** — included `rdfs:seeAlso` relationships in graph visualization
- **Multi-level expand/collapse** — split-button controls: click expands/collapses one level; dropdown arrow offers "Expand All" / "Collapse All"
- **Default suggester role** — new users default to "suggester" instead of "editor", ensuring all contributions go through the review workflow initially

---

## 14. Backend — API Infrastructure

**Commit**: `1cab6c0`

Comprehensive backend improvements covering missing features, code quality, and test coverage.

### Lifespan Handlers (`ontokit/main.py`)
- Async database engine initialization + graceful shutdown
- Redis connection pool startup + cleanup
- MinIO bucket initialization
- Structured startup/shutdown logging

### Authentication & Authorization (`ontokit/core/auth.py`)
- JWT role extraction from Zitadel `urn:zitadel:iam:org:project:roles` claim
- JWKS cache with 1-hour TTL (was previously unbounded)
- Roles field added to `TokenPayload` and `CurrentUser`

### Search Service (`ontokit/services/search.py`)
- Full-text search via PostgreSQL `tsvector`/`tsquery`
- SPARQL query execution via RDFLib (SELECT/ASK/CONSTRUCT)
- Pagination support
- **Wildcard support** (`*` query returns all entities of requested type)

### Rate Limiting
- `slowapi` dependency with per-IP limits (100 req/min default)
- Rate limit headers in responses

### Middleware (`ontokit/core/middleware.py`)
- Request ID middleware (UUID per request in `X-Request-ID` header)
- Access logging (method, path, status code, duration)
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `Content-Security-Policy`

### Code Quality
- Custom exception types (`ontokit/core/exceptions.py`) — `NotFoundError`, `ValidationError`, `ConflictError`, `ForbiddenError` with global handlers
- IRI format validation (Pydantic validators)
- String length limits on text fields

---

## 15. Backend — Suggestion Sessions

**Commit**: `2cd425c`

Full backend implementation of the suggestion workflow (see [Section 8](#8-suggestion-workflow) for the frontend counterpart).

- **Database model** — `SuggestionSession` table with session lifecycle tracking
- **Service layer** (537 lines) — create session → save commits to dedicated branch → submit as PR → discard with branch cleanup
- **6 API endpoints** — create, save, submit, list, discard, beacon
- **Beacon token auth** — HMAC-signed tokens for `navigator.sendBeacon` (tab close/hide)
- **Auto-submit worker** — cron job catches abandoned sessions (>30min) and auto-creates PRs
- **Alembic migration** — `suggestion_sessions` table with proper FKs and constraints

---

## 16. Backend — Bug Fixes & Role Changes

**Commits**: `3fe55df`, `eb8e306`

- **HttpUrl crash fix** — Pydantic v2 `HttpUrl` is not a plain string; wrapped `cls.iri.lower()` in `str()` for class tree sort keys in both `get_root_classes` and `get_class_children`
- **Default suggester role** — `MemberBase` schema default changed from `"viewer"` to `"suggester"`; join request approval assigns `"suggester"` instead of `"editor"`

---

## Stats Summary

| Metric | ontokit-web | ontokit-api | Total |
|--------|-------------|-------------|-------|
| Commits | 20 | 5 | 25 |
| Files changed | 104 | 31 | 135 |
| Insertions | +17,590 | +3,070 | +20,660 |
| Deletions | −924 | −86 | −1,010 |
| Tests added | 26 | 85 | 111 |

### New Dependencies (ontokit-web)
- `@dnd-kit/core`, `@dnd-kit/utilities` — drag-and-drop
- `@xyflow/react`, `elkjs` — graph visualization
- `vitest`, `@vitejs/plugin-react`, `happy-dom` — testing
- `zod` — environment validation

---

## Key Architectural Decisions

1. **Turtle source save** — All entity edits go through Turtle text manipulation + `PUT /source` because the backend class endpoint only supports GET. This enables form-based editing without backend schema changes.
2. **Two-tier auto-save** — Blur saves to localStorage (instant, survives refresh); navigate-away commits to git (batched, no data loss). Modeled after WebProtege.
3. **Suggester role** — Non-destructive contribution path: suggesters propose changes on dedicated branches that go through editor review before merging.
4. **Shared tree renderer** — `EntityTree`/`EntityTreeNode` components reused across Classes, Properties, and Individuals tabs, reducing duplication and ensuring consistent behavior.
5. **Graph lazy loading** — `elkjs` and `@xyflow/react` loaded via `next/dynamic` to avoid bundling heavy visualization libraries for users who don't need them.
