# E2E Testing Plan

## Motivation

All existing tests in ontokit-web (756 test files) rely on mocked dependencies — `fetch` is stubbed via `mockFetch`, WebSocket is replaced with `MockWebSocket`, and contexts are provided via test wrappers. While these unit and component tests are valuable for verifying isolated logic, they cannot catch:

- **Integration failures** between frontend and backend (schema drift, auth token handling, HTTP error codes)
- **WebSocket lifecycle issues** (connection handshake, reconnection after server restart, message ordering)
- **Real authentication flows** (Zitadel OIDC redirect, token refresh, session expiry)
- **End-to-end workflows** (create project -> edit ontology -> create PR -> merge)

This plan introduces Playwright-based e2e tests that exercise the full stack against a real running backend.

## Framework Choice: Playwright

**Why Playwright over Cypress:**
- Native WebSocket interception and inspection (`page.on('websocket')`)
- Multi-browser support (Chromium, Firefox, WebKit) out of the box
- Built-in API request context (`request.newContext()`) for direct API testing alongside browser tests
- Better async/await model aligning with the project's async-first patterns
- Parallel test execution with worker isolation

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Playwright Tests                        │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ API Tests    │  │ WebSocket    │  │ UI Workflow   │  │
│  │ (no browser) │  │ Tests        │  │ Tests         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│              Docker Compose Test Stack                    │
│                                                          │
│  Next.js dev server ──► FastAPI ──► PostgreSQL + Redis   │
│         :3000              :8000                          │
└─────────────────────────────────────────────────────────┘
```

### Test Categories

#### 1. API Integration Tests (no browser needed)

Use Playwright's `APIRequestContext` to call the backend directly and verify contracts.

**Scope:**
- Project CRUD (`POST/GET/PUT/DELETE /api/v1/projects/`)
- Ontology operations (class tree, property listing, source read/write)
- Branch operations (create, list, switch)
- Pull request lifecycle (create, diff, merge)
- Lint endpoint (`POST /api/v1/projects/{id}/lint`)
- Index status endpoint
- Search endpoints
- Auth token validation and refresh behavior
- Error responses (401, 403, 404, 422) match expected schemas

**Example test outline:**
```typescript
test('project CRUD lifecycle', async ({ request }) => {
  // Create project
  const create = await request.post('/api/v1/projects/', { data: { name: 'Test Ontology' } });
  expect(create.ok()).toBeTruthy();
  const project = await create.json();

  // Read project
  const get = await request.get(`/api/v1/projects/${project.id}`);
  expect(await get.json()).toMatchObject({ name: 'Test Ontology' });

  // Update project
  await request.put(`/api/v1/projects/${project.id}`, { data: { name: 'Renamed' } });

  // Delete project
  const del = await request.delete(`/api/v1/projects/${project.id}`);
  expect(del.ok()).toBeTruthy();
});
```

#### 2. WebSocket Tests

Test the collaboration WebSocket at `ws://localhost:8000/api/v1/collab/ws` with real connections.

**Scope:**
- Connection establishment and authentication handshake
- Join/leave room notifications
- Multi-user presence (user list updates, cursor broadcasts)
- Operation send/acknowledge flow
- Sync request/response
- Reconnection after server-side disconnect
- Concurrent edits from multiple clients
- Index status WebSocket (`/api/v1/projects/{id}/index-status/ws`)

**Approach — two strategies:**

**(a) Raw WebSocket (for protocol-level tests):**
```typescript
import WebSocket from 'ws';

test('collab authentication handshake', async () => {
  const ws = new WebSocket('ws://localhost:8000/api/v1/collab/ws');
  
  await new Promise(resolve => ws.on('open', resolve));
  ws.send(JSON.stringify({ type: 'authenticate', token: accessToken }));
  
  const msg = await nextMessage(ws);
  expect(msg.type).toBe('authenticated');
});
```

**(b) Browser WebSocket (for integration with UI):**
```typescript
test('collaboration presence in editor', async ({ page }) => {
  await page.goto('/projects/test-project/editor');
  
  // Intercept WebSocket
  const wsPromise = page.waitForEvent('websocket');
  // ... trigger connection
  const ws = await wsPromise;
  
  // Verify frames
  const frame = await ws.waitForEvent('framesent');
  expect(JSON.parse(frame.payload)).toMatchObject({ type: 'join' });
});
```

#### 3. UI Workflow Tests (full browser)

End-to-end user journeys through the application.

**Scope:**
- **Authentication flow**: Login via Zitadel, session persistence, logout
- **Project management**: Create project, invite member, configure settings
- **Ontology editing**: Navigate class tree, open detail panel, edit Turtle source, save
- **Branch workflow**: Create branch, make edits, create PR, view diff, merge
- **Health check**: Run lint, view results in health tab
- **Search**: Search for classes/properties, navigate to result
- **Editor features**: Ctrl+Click IRI navigation, hover tooltips, syntax highlighting validation

**Example test outline:**
```typescript
test('edit ontology source and create PR', async ({ page }) => {
  await page.goto('/projects/test-project/editor');

  // Switch to source tab
  await page.getByRole('tab', { name: 'Source' }).click();

  // Create a branch
  await page.getByRole('button', { name: /branch/i }).click();
  await page.getByPlaceholder('Branch name').fill('add-new-class');
  await page.getByRole('button', { name: 'Create' }).click();

  // Edit in Monaco
  const editor = page.locator('.monaco-editor');
  await editor.click();
  // ... type Turtle content

  // Save
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  // Create PR
  await page.getByRole('button', { name: /pull request/i }).click();
  await page.getByPlaceholder('Title').fill('Add Person class');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Pull request created')).toBeVisible();
});
```

## Test Infrastructure

### Directory Structure

```
e2e/
├── playwright.config.ts       # Playwright configuration
├── global-setup.ts            # Start services, seed test data
├── global-teardown.ts         # Stop services, clean up
├── fixtures/
│   ├── auth.fixture.ts        # Authenticated page/request fixtures
│   ├── project.fixture.ts     # Test project creation/teardown
│   └── test-ontology.ttl      # Sample Turtle file for tests
├── api/
│   ├── projects.spec.ts       # Project API tests
│   ├── ontology.spec.ts       # Ontology CRUD API tests
│   ├── branches.spec.ts       # Branch API tests
│   ├── pull-requests.spec.ts  # PR lifecycle API tests
│   ├── lint.spec.ts           # Lint API tests
│   └── search.spec.ts         # Search API tests
├── websocket/
│   ├── collab.spec.ts         # Collaboration WebSocket tests
│   ├── presence.spec.ts       # Multi-user presence tests
│   ├── index-status.spec.ts   # Index status WebSocket tests
│   └── reconnection.spec.ts   # Reconnection behavior tests
└── workflows/
    ├── auth.spec.ts           # Login/logout/session flows
    ├── project-management.spec.ts
    ├── ontology-editing.spec.ts
    ├── branch-and-pr.spec.ts
    ├── health-check.spec.ts
    └── search.spec.ts
```

### Playwright Configuration

```typescript
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'api', testDir: './api', use: { /* no browser needed */ } },
    { name: 'websocket', testDir: './websocket' },
    { name: 'chromium', testDir: './workflows', use: { browserName: 'chromium' } },
    { name: 'firefox', testDir: './workflows', use: { browserName: 'firefox' } },
  ],

  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

### Authentication Fixture

Since tests need real auth tokens, use a reusable fixture:

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test';

type AuthFixtures = {
  authedRequest: APIRequestContext;
  accessToken: string;
};

export const test = base.extend<AuthFixtures>({
  accessToken: async ({}, use) => {
    // Obtain token via Zitadel machine-to-machine client credentials
    // or via a test-specific service account
    const token = await getTestAccessToken();
    await use(token);
  },

  authedRequest: async ({ playwright, accessToken }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'http://localhost:8000',
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });
    await use(ctx);
    await ctx.dispose();
  },
});
```

**Authentication strategy options:**
1. **Service account** (preferred for CI): Create a dedicated Zitadel service account with client credentials grant. No browser login needed.
2. **Stored auth state**: Use `storageState` to persist browser login across tests during local development.
3. **Test-only bypass**: Add a `X-Test-Auth` header that the backend accepts only when `TESTING=true` env is set. Simplest, but diverges from production auth.

### Test Data Management

- **Global setup** seeds a test project with a known ontology (from `fixtures/test-ontology.ttl`)
- **Each test suite** creates its own project via the API to avoid cross-test contamination
- **Global teardown** cleans up all test-created projects
- Test project names use a `e2e-` prefix for easy identification and cleanup

### Docker Compose for CI

```yaml
# docker-compose.e2e.yml
services:
  api:
    build: ../ontokit-api
    environment:
      DATABASE_URL: postgresql+asyncpg://ontokit:ontokit@db:5432/ontokit_test
      REDIS_URL: redis://redis:6379/1
      TESTING: "true"
    ports: ["8000:8000"]
    depends_on: [db, redis]

  db:
    image: postgres:17
    environment:
      POSTGRES_DB: ontokit_test
      POSTGRES_USER: ontokit
      POSTGRES_PASSWORD: ontokit

  redis:
    image: redis:7-alpine

  web:
    build: ../ontokit-web
    environment:
      NEXT_PUBLIC_API_URL: http://api:8000
    ports: ["3000:3000"]
    depends_on: [api]
```

## npm Scripts

```json
{
  "test:e2e": "playwright test --config e2e/playwright.config.ts",
  "test:e2e:api": "playwright test --config e2e/playwright.config.ts --project=api",
  "test:e2e:ws": "playwright test --config e2e/playwright.config.ts --project=websocket",
  "test:e2e:ui": "playwright test --config e2e/playwright.config.ts --project=chromium",
  "test:e2e:report": "playwright show-report"
}
```

## Implementation Phases

### Phase 1 — Foundation (API tests)
- Install Playwright, set up config and fixtures
- Implement auth fixture with service account
- Write API integration tests for project CRUD and ontology operations
- Set up CI workflow with docker-compose.e2e.yml

### Phase 2 — WebSocket tests
- Raw WebSocket tests for collab handshake and message protocol
- Index status WebSocket tests
- Multi-client presence and operation acknowledgment tests
- Reconnection and error recovery tests

### Phase 3 — UI workflow tests
- Authentication flow (login, session, logout)
- Project creation and management workflow
- Ontology editing in Monaco (source tab)
- Branch creation, editing, and PR workflow

### Phase 4 — CI hardening
- Multi-browser matrix (Chromium + Firefox)
- Flaky test detection and retry policy
- Test parallelization tuning
- Trace and screenshot artifacts on failure
- GitHub Actions workflow for e2e on PR

## Open Questions

1. **Auth strategy for CI**: Service account vs test bypass header — depends on whether a Zitadel instance is available in CI.
2. **Test database seeding**: Should we use Alembic migrations + SQL fixtures, or seed via API calls in global setup?
3. **Scope boundary**: Should e2e tests live in ontokit-web, or in a top-level `e2e/` directory in the monorepo (since they span both frontend and backend)?
4. **MinIO in tests**: Do any workflows under test require object storage, or can we skip MinIO for the initial phases?
