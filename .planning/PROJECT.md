# OntoKit Web

## What This Is

A Next.js frontend for collaborative OWL ontology editing. Connects to a FastAPI backend (ontokit-api) for ontology operations. Used by both CatholicOS (Catholic Semantic Canon) and ALEA (FOLIO — Free Open Legal Information Ontology).

## Core Value

Enable grassroots-level collaborative ontology editing in a modern, accessible web interface — where subject-matter experts can rapidly improve their ontology with LLM assistance while preserving integrity through human curation.

## Current Milestone: v0.4.0 LLM-Assisted Ontology Improvements

**Goal:** Enable SMEs to rapidly improve their ontology (new classes, new properties, annotations) with LLM assistance, while guaranteeing integrity (no duplicates, no AI slop) through whole-ontology duplicate detection, validation guardrails, and human-curated review.

**Target features:**
- LLM suggestion pipeline (cloud + local via ALEA LLM Client; backend proxy for project keys, BYO-key browser-side)
- Dual UX: inline "✨ Suggest improvements" affordance + flashcard iterator mode
- Whole-ontology duplicate detection (exact + semantic + structural composite scoring)
- Generative FOLIO + folio-python + OpenGloss + OWL reasoner integration
- Hybrid clustering: auto-cluster session suggestions into reviewable PR shards with user review
- Property support (ObjectProperty, DataProperty, AnnotationProperty) alongside classes
- Per-role UX + cost controls (project budget, per-user daily caps, usage dashboard)
- Success: 50+ annotations/hour SME throughput, ≥70% admin acceptance rate, zero duplicates in first month

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Two-mode editor (standard + developer) — v0.2.0
- ✓ Auto-save with draft system — v0.2.0
- ✓ Form-based class editing with Turtle source save — v0.2.0
- ✓ Suggestion workflow for non-editors — v0.2.0
- ✓ Graph visualization (ReactFlow + ELK) — v0.2.0
- ✓ Keyboard shortcuts and accessibility — v0.2.0
- ✓ PostgreSQL ontology index frontend — v0.3.0-dev
- ✓ Upstream source tracking with loop prevention — v0.3.0-dev
- ✓ Projects landing page with tabs — v0.3.0-dev
- ✓ Synced ALEA forks with CatholicOS upstream — v0.3.0
- ✓ Optional auth (AUTH_MODE=required|optional|disabled) — v0.3.0
- ✓ Production deployment (ontokit.openlegalstandard.org) — v0.3.0
- ✓ Anonymous suggestions with credit modal — v0.3.0

### Active

<!-- Current scope — Milestone v0.4.0 LLM-Assisted Ontology Improvements. -->

- [x] LLM abstraction layer (13-provider registry, encryption, SSRF protection, key routing) — Phase 11
- [x] Per-role access model (admin/editor/suggester/anonymous LLM gates) — Phase 11
- [x] Cost controls (project budget, per-user daily caps, usage dashboard, BYO key) — Phase 11
- [ ] Duplicate detection (whole-ontology embeddings index + composite scoring)
- [ ] Suggestion generation (Generative FOLIO integration, prompts, validation)
- [ ] Dual UX modes (inline button + flashcard iterator)
- [ ] Session clustering into reviewable PR shards
- [ ] Property support (ObjectProperty, DataProperty, AnnotationProperty)
- [ ] Pre-submit validation guardrails (parent, label, cycle, namespace)

### Out of Scope

- Full Zitadel deployment on FOLIO server — FOLIO needs read-only public access
- Docker-based deployment — bare metal working fine
- Anonymous LLM access — cost control, not enough abuse signal
- Custom LLM provider abstraction — use ALEA LLM Client (existing)
- Cross-branch suggestion appearance — each suggestion lands in exactly one PR shard
- Real-time collaborative editing — not the bottleneck for ontology quality

## Context

- Production server: AWS Ubuntu 24.04 ARM64 at 54.224.195.12 (ontokit.openlegalstandard.org)
- FOLIO ontology seeded with 18,326 classes in Postgres index
- Running CatholicOS main with AUTH_MODE=optional + anonymous suggestions active
- Two repos (ontokit-web + ontokit-api) synced with CatholicOS upstream
- v0.4.0 feature branch: tested on FOLIO first, then proposed upstream to CatholicOS
- Existing infra to reuse: suggestion sessions, drafts, embeddings API, analytics API, quality API, anonymous tokens

## Constraints

- **LLM cost discipline**: project-owner budget caps, per-user daily limits, BYO-key off project bill
- **Integrity over speed**: must block duplicates (>0.95), warn on similar (>0.80), enforce validation
- **No AI slop**: LLM assists the human; human curates; admin accepts/rejects per-entity
- **Dual deployment**: feature must work on both FOLIO (no auth) and CatholicOS (with Zitadel)
- **Backwards compat**: existing suggestion/editor flows must continue to work
- **Existing tools first**: ALEA LLM Client, Generative FOLIO, folio-python, OpenGloss — don't rebuild

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CatholicOS main is long-term truth | Mike's folio-adapter was a deadline hack | ✓ v0.3.0 |
| Make auth optional via env var | Avoids maintaining two codebases | ✓ v0.3.0 |
| Bare metal deploy (no Docker) | Server already set up this way, working fine | ✓ v0.3.0 |
| 13-provider LLM registry (not ALEA LLM Client) | ALEA LLM Client is Python-only; built OpenAI-compat dispatch in ontokit-api directly | ✓ Phase 11 |
| Project keys via backend proxy, BYO via browser | Protects project owner's bill, simpler client for BYO users | ✓ Phase 11 |
| Whole-ontology duplicate check (not local) | Cross-branch duplicates fragment the ontology | — Pending |
| Hybrid clustering (D+E) with max-50/min-3 shards | Balance reviewer load vs PR churn | — Pending |
| Anonymous users get no LLM access | Cost control, insufficient abuse signal | ✓ Phase 11 |
| Property support in v0.4.0 (not deferred) | Pipeline is uniform at generation; validation diverges cheaply | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after milestone v0.4.0 LLM-Assisted Ontology Improvements start*
