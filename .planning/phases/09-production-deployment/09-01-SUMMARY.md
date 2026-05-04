# Plan 09-01: Production Deployment — Summary

## Result: SUCCESS

**Deployed CatholicOS main to https://ontokit.openlegalstandard.org**

### Tasks Completed

| Task | What was done |
|------|---------------|
| 1. PostgreSQL | Installed PostgreSQL 16 + pgvector extension, created `ontokit` database and user |
| 2. Switch repos | Both repos switched from `feature/folio-adapter` to `main`, deps installed, frontend built |
| 3. Configure env + migrate | API `.env` with DATABASE_URL + AUTH_MODE=optional, web `.env.local` updated, 25 alembic migrations applied, systemd updated with EnvironmentFile |
| 4. Start + verify | Both services running, public URL returns 200, API returns JSON, visual verification confirmed |

### Post-deployment fixes

- **Missing DB columns** — `suggestion_sessions` needed `is_anonymous`, `submitter_name`, `submitter_email`, `client_ip` (added migration + manual ALTER TABLE)
- **SECRET_KEY** — Anonymous token HMAC signing requires a proper secret (added to server `.env`)
- **AUTH_TRUST_HOST=true** — NextAuth v5 requires this behind Caddy reverse proxy
- **showAuthUI build-time inlining** — Moved check inside React component for correct env var evaluation
- **Redis + arq worker** — Installed Redis, created `ontokit-worker.service` for background jobs
- **FOLIO seeded** — 18,326 classes imported via `seed-project.py`, ontology index built, upstream sync configured for `alea-institute/FOLIO`
- **Index translations fix** — `skos:altLabel` entries were excluded from annotations response
- **Dedup fix** — Label property IRIs excluded from annotations query to prevent double-rendering

### Infrastructure on server (54.224.195.12)

| Service | Status | Config |
|---------|--------|--------|
| PostgreSQL 16 | active | `ontokit` database, `ontokit` user, pgvector extension |
| Redis | active | Default config, used by arq worker |
| ontokit-api | active | systemd, uvicorn :8000, AUTH_MODE=optional |
| ontokit-web | active | systemd, next start :3000, AUTH_MODE=optional |
| ontokit-worker | active | systemd, arq worker for background jobs |
| Caddy | active | Auto-SSL, reverse proxy to API + Web |

### Key files created/modified

- `/home/ubuntu/ontokit-api/.env` — DATABASE_URL, AUTH_MODE, SECRET_KEY, GIT_REPOS_BASE_PATH
- `/home/ubuntu/ontokit-web/.env.local` — API URL, auth secrets, AUTH_MODE, AUTH_TRUST_HOST
- `/etc/systemd/system/ontokit-api.service` — Updated with EnvironmentFile + postgresql dependency
- `/etc/systemd/system/ontokit-worker.service` — New: arq worker service
- FOLIO project: `db045aca-a6ce-4f1d-b06c-5fbe475c9e08` with upstream sync to `alea-institute/FOLIO`
