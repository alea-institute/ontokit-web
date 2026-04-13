# Human UAT Checklist — v0.4.0 Milestone

**Generated:** 2026-04-08
**Prerequisite:** Start both servers before testing:
```bash
# Backend (in ontokit-api directory)
AUTH_MODE=optional uvicorn ontokit.main:app --reload --port 8000

# Frontend
cd ~/Coding\ Projects/ontokit-web && ./ontokit-web.sh start
# Open http://localhost:53000
```

---

## Phase 10: Anonymous Suggestions

- [ ] **Anonymous proposal flow (12-step E2E)**
  - Open editor in **incognito window** (not signed in)
  - Navigate to a class in the ontology tree
  - Verify **"Propose Edit" button** (emerald green) appears on ClassDetailPanel
  - If Zitadel configured, verify "Sign in for full editing" appears alongside it
  - Click "Propose Edit" — verify edit mode activates (form fields become editable)
  - Make a change to a label or annotation
  - Click "Submit Proposal" — verify **credit modal** appears: "Want credit for your suggestions?"
  - Enter a name and email, click "Save" — verify submission succeeds (toast confirmation)
  - Open review page as signed-in admin/editor
  - Verify anonymous suggestion appears with provided name, or "Anonymous" if skipped
  - In separate test: sign in as editor — verify you see **"Edit Item"** (not "Propose Edit")

---

## Phase 11: Roles, LLM Abstraction & Cost Controls

- [ ] **LLM Settings section rendering**
  - Navigate to a project's **Settings** page, scroll to "AI / LLM" section
  - Verify provider dropdown shows **13 options** with provider icons
  - Verify API key field has **password type** with Eye/EyeOff toggle
  - Verify model tier shows **Quality/Cheap** radio buttons
  - Switch to Ollama — verify API key field hides and **Endpoint URL** field appears with `http://localhost:11434` default

- [ ] **Editor LLM role badge**
  - Open the ontology editor as a user with **editor** role
  - Verify **"Editor — 500/day"** badge visible in editor toolbar
  - Verify badge is **not** visible when viewing as anonymous

- [ ] **Member list self-merge toggle**
  - Open **Members** section of a project as admin
  - Verify **"Structural self-merge" toggle** appears next to editor role rows only
  - Verify toggle is **not** shown for viewer/suggester/admin/owner rows

---

## Phase 12: Toolchain Integration & Duplicate Detection

- [ ] **ANN index performance under load**
  - With production-scale `entity_embeddings` table (18K+ entities), run `semantic_search_all_branches()` queries
  - Verify **HNSW index scan** used (not seqscan) via `EXPLAIN ANALYZE`
  - Verify query time **under 200ms**

- [ ] **GitHub webhook merge trigger**
  - Merge a real test PR on a project with EmbeddingConfig
  - Within 30 seconds, inspect Redis queue
  - Verify `run_embedding_generation_task` job appears with correct `project_id` and `branch`

---

## Phase 15: Session Clustering & Batch Submit

- [ ] **Shard preview modal opens on submit**
  - Open editor in suggestion mode with **>5 accepted suggestions**
  - Click "Submit Suggestions"
  - Verify cluster API call in network tab
  - Verify shard preview modal opens with PR groups and shards organized by ancestor

- [ ] **Drag-and-drop entity movement**
  - In the shard preview modal, **drag an entity** from one shard to another
  - Verify entity moves to target shard
  - Verify **summary bar counts** update immediately

- [ ] **Submit progress and completion**
  - Click Submit in the modal
  - Verify **progress steps** animate through
  - Verify completion screen shows **PR links** (success) or error rows with retry

- [ ] **Dark mode visual check**
  - Toggle dark mode
  - Inspect all shard preview components
  - Verify backgrounds, text, badges, borders, and input fields display properly

---

## Phase 16: Reviewer Enhancements

- [ ] **Provenance badges on diff lines**
  - Open review page, select a pending session, click "Files" tab
  - Verify **✨ (llm-proposed)**, **✏️ (user-edited)**, **👤 (user-written)** icons appear on addition lines
  - Verify **confidence percentages** display inline (green >=80%, amber >=60%, red <60%)

- [ ] **Shard tab navigator**
  - For a batch-submitted session, verify **shard tab bar** appears above the diff
  - Verify "All" tab + per-shard tabs with entity counts
  - Click a shard tab — verify diff **filters to that shard's entities only**

- [ ] **Similar entities panel**
  - For entities with duplicate candidates, verify **"Similar existing entities (N)"** collapsible appears
  - Click a candidate — verify **two-column comparison** (labels, comments, parents) loads

- [ ] **Per-shard approve/reject**
  - Verify **"Approve shard" / "Reject shard"** buttons below active shard's diff
  - Mark a shard — verify **colored dot** appears on its tab
  - Verify **"Create PR from approved shards"** button appears when at least one shard is rejected

- [ ] **Shard mark persistence**
  - Mark shards, click to a **different session**, click back
  - Verify shard marks **survive** the round-trip (Pitfall 4)

- [ ] **Main actions still work**
  - Verify **Approve / Reject / Request Changes** buttons still function correctly with shard marks

---

## Notes

- **Phases 16 provenance/shard items** require a batch-submitted session with enriched metadata from the backend. If the backend doesn't yet return this data, the UI degrades gracefully (components don't render) — this is expected.
- **Phase 12 items** require production infrastructure (PostgreSQL with pgvector, Redis, GitHub webhooks).
- **Phase 15 shard rename** was previously a gap but has been **closed and verified** in code — not listed above.
- Items marked with `[ ]` are unchecked. Check them off as you verify each one.
