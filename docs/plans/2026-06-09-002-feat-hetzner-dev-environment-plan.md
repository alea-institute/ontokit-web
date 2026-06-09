---
title: Hetzner full-stack DEV environment
type: feat
status: active
date: 2026-06-09
---

# 🏗️ Hetzner full-stack DEV environment

Part of the [OntoKit Dev & Rollout Roadmap](2026-06-09-001-ontokit-dev-rollout-roadmap.md) — **P0, the foundation**.

## Overview

Stand up a persistent, reproducible, self-hosted **dev/staging environment on Hetzner** that runs
the **full OntoKit stack** (Next.js web + FastAPI api + all infra) so any feature branch can be
deployed and tested **end-to-end** before a PR. This unblocks testing for every other initiative
(P1, P2, P3) and gives a durable staging box reusable across PRs.

## Problem Statement / Motivation

- The LLM node-expansion and entity-graph features are **frontend branches that are inert without
  the matching backend + infra** (Postgres/pgvector, Redis, worker, MinIO, LLM keys).
- Current AWS prod (`ontokit.openlegalstandard.org`) is a **stripped, bare-metal `folio-adapter`
  build with no Postgres/Zitadel** — it *cannot* run these features. "Replicate prod" is therefore
  not a viable test target.
- The user is often traveling and needs to test from a browser without a local stack.
- A managed PaaS (Railway) was considered but rejected in favor of a **durable, prod-like, reusable**
  dev box ("done right").

## Proposed Solution

A single Hetzner Cloud VM running the full stack via Docker Compose behind a Caddy/Traefik
reverse proxy with automatic TLS, fronted by a dev subdomain, with a one-command branch-deploy
workflow and the compose/proxy/scripts committed to version control (infra-as-code).

## Technical Approach

### Stack to run (from `../ontokit-api` `origin/deploy/llm-helper` inventory)

- **web** — Next.js (this repo), `feat/*` branch, port 3000.
- **api** — FastAPI / uvicorn, Python 3.13, port 8000 (entrypoint runs `alembic upgrade head`).
- **worker** — ARQ worker (same image): index build, lint, normalization, consistency, embeddings,
  `auto_submit_stale_suggestions` cron.
- **postgres** — **`pgvector/pgvector:pg17`** (NOT plain postgres — migrations `CREATE EXTENSION vector`/`pg_trgm`).
- **redis** — Redis 7 (ARQ + progress pub/sub).
- **minio** — S3-compatible object store for OWL import/export.
- **(optional) zitadel + login + mailpit** — only if `AUTH_MODE=required`; skipped at `optional`/`disabled`.
- **persistent volumes** — Postgres data, MinIO data, and `GIT_REPOS_BASE_PATH` (ontology content
  is on-disk git repos, not in Postgres).

### Implementation Phases

#### Phase 1: Provision & harden
- Hetzner Cloud VM — **rec. CPX41 (8 vCPU / 16 GB)**; the stack is ~7 services incl. embeddings
  (`sentence-transformers all-MiniLM-L6-v2`, ~90 MB) and a reasoner. Ubuntu 24.04.
- Cloud firewall: allow 22/80/443 only. Deploy user (non-root), SSH keys, `ufw` + `fail2ban`,
  `unattended-upgrades`.
- Install Docker Engine + Compose plugin.
- **Success:** `docker compose version` works; SSH-key-only login; firewall active.

#### Phase 2: DNS, TLS & reverse proxy
- Point `dev.ontokit.openlegalstandard.org` (zone already owned) at the VM.
- **Caddy** (simplest auto-TLS) or Traefik routing: `/` → web:3000, `/api` + `/ws` → api:8000
  (WebSocket upgrade for collaboration/health). Let's Encrypt certs.
- **Success:** `https://dev.ontokit.openlegalstandard.org` serves the web app over valid TLS.

#### Phase 3: Compose the full stack
- Base on api `compose.yaml`; **swap Postgres image to `pgvector/pgvector:pg17`**; add an
  `ontokit-web` service; set production-ish passwords; mount persistent volumes.
- Wire env (see below). Decide `AUTH_MODE`.
- **Success:** `docker compose up -d` brings all services healthy; `alembic upgrade head` runs clean.

#### Phase 4: Seed, smoke-test & document
- Pre-warm FOLIO (`folio-python`) + embedding model caches (outbound egress required).
- Seed a FOLIO test project (`scripts/seed-project.py`).
- Smoke test: create project, web↔api↔db round-trip, one LLM suggestion round-trip (provider key or Ollama).
- Write a **RUNBOOK** (deploy/restart/logs/reset) and a `deploy <repo> <branch>` script
  (git pull + compose build/up) so switching feature branches is one command.
- **Commit compose + Caddyfile + scripts to version control** (infra-as-code) — the "done right" step.
- **Success:** Branch deploy is one command; RUNBOOK exists; infra is reproducible from git.

## Required environment variables (api)

Source: `../ontokit-api/ontokit/core/config.py`, `.env.example`, `compose.yaml`.

| Var | Purpose | Required? |
|-----|---------|-----------|
| `SECRET_KEY` | app secret; **derives Fernet key encrypting stored LLM/embedding API keys** — must stay stable | yes |
| `DATABASE_URL` | Postgres DSN (asyncpg) | yes |
| `REDIS_URL` | Redis DSN (worker) | yes |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | object storage for imports | for imports |
| `GIT_REPOS_BASE_PATH` | on-disk git repo store (persistent, writable) | yes (default `/data/repos`) |
| `AUTH_MODE` | `required`/`optional`/`disabled` | recommend `optional` |
| `ZITADEL_*` | OIDC issuer/client/service token | only if `AUTH_MODE=required` |
| `CORS_ORIGINS` | JSON array incl. the dev web origin | yes |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Fernet key for GitHub OAuth tokens | for GitHub PR sync |
| `FRONTEND_URL` / `REVALIDATION_SECRET` | sitemap revalidation (must match web) | optional |
| `RUN_MIGRATIONS` | entrypoint runs alembic if `1` | optional |

Web (`.env`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` → the api service; `AUTH_MODE`;
`AUTH_URL`/`AUTH_SECRET`; `ZITADEL_*` (if used); `REVALIDATION_SECRET` (match api).

> **LLM keys are NOT env vars.** They are entered per-project via `PUT /llm/config` (encrypted in
> `project_llm_configs`) or BYO at request time. For testing: stack up + one provider key per project,
> or point a project at a local Ollama via `base_url` (no key).

## Acceptance Criteria

### Functional
- [ ] `https://dev.ontokit.openlegalstandard.org` serves the web app over valid TLS.
- [ ] API healthy at `/api` with migrations applied; worker running.
- [ ] Postgres has `vector` + `pg_trgm` extensions; embeddings table present.
- [ ] A seeded FOLIO project loads; class tree + source render in the editor.
- [ ] One LLM suggestion round-trip succeeds end-to-end (with a provider key or Ollama).
- [ ] Deploying a different feature branch is a single command.

### Non-Functional
- [ ] SSH-key-only; firewall limited to 22/80/443; fail2ban active.
- [ ] Persistent volumes survive `docker compose down && up`.
- [ ] `SECRET_KEY` is stable and stored outside git (encrypted keys remain decryptable).
- [ ] Compose + proxy config + scripts committed (reproducible from git).

## Dependencies & Risks

- **Resource sizing** — embeddings + reasoner are memory-heavy; 16 GB recommended, monitor.
- **Outbound egress** — FOLIO ontology + HuggingFace model download on first use; allow egress or pre-warm a cache volume.
- **Secret management** — generate `SECRET_KEY`, `GITHUB_TOKEN_ENCRYPTION_KEY` (Fernet), `AUTH_SECRET`, `REVALIDATION_SECRET`; keep out of git.
- **Internet-facing** — it is a real server; keep auth/firewall tight even for "dev".
- **`deploy/llm-helper` is two branches** — track `origin/deploy/llm-helper` (has startup-hang fixes + compose/migration set); local is far behind.
- **compose.prod.yaml gap** — it omits api/worker and uses non-pgvector Postgres; do not use as-is.

## Open decisions (lock during discuss-phase)

1. Auth mode on the box — recommend `AUTH_MODE=optional`.
2. LLM provider — cloud key per project vs local Ollama.
3. Compose base — harden `compose.yaml` (recommended) vs extend `compose.prod.yaml`.
4. Box size + dev subdomain name.
5. Where infra-as-code lives — a `deploy/` dir in `ontokit-api`, or a small dedicated `ontokit-infra` repo.

## Sources & References

- Stack inventory: `../ontokit-api` `origin/deploy/llm-helper` — `compose.yaml`, `compose.prod.yaml`,
  `Dockerfile`, `.env.example`, `ontokit/core/config.py`, `ontokit/core/encryption.py`,
  `scripts/{entrypoint.sh,init-db.sh,seed-project.py,setup-zitadel.sh}`,
  `alembic/versions/n2o3p4q5r6s7_add_embedding_tables.py`.
- Prod baseline (for contrast): AWS bare-metal, Caddy→uvicorn+Next via systemd, no Postgres/Zitadel.
- Web auth mode: `lib/auth-mode.ts` on `feat/llm-node-expansion`.
