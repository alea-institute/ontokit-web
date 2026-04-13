# Production Login & Page Load Debug — Handoff

**Date:** 2026-04-12  
**Branch:** `llm-helper` (deployed to prod)  
**Server:** `ontokit.openlegalstandard.org` (54.224.195.12)

---

## Completed

### 1. Static Asset Fix (DONE — permanent)
- **Problem:** `output: "standalone"` build doesn't copy `.next/static/` into `.next/standalone/.next/static/`. All JS/CSS chunks existed on disk but returned 404 through Next.js.
- **Fix:** Added two `ExecStartPre` directives to `/etc/systemd/system/ontokit-web.service`:
  ```
  ExecStartPre=/bin/cp -r /home/ubuntu/ontokit-web/.next/static /home/ubuntu/ontokit-web/.next/standalone/.next/static
  ExecStartPre=/bin/bash -c 'if [ -d /home/ubuntu/ontokit-web/public ]; then cp -r /home/ubuntu/ontokit-web/public /home/ubuntu/ontokit-web/.next/standalone/public; fi'
  ```
- **Status:** Permanent. Runs automatically on every `systemctl restart ontokit-web`.

### 2. Login Flow (DONE — working)
- Sign-in page renders correctly at `/auth/signin`
- "Sign in with Zitadel" button redirects to `folio-ontokit-k8huhj.us1.zitadel.cloud`
- OIDC callback works — user confirmed successful login

---

## In Progress: Project Page Crash

### Problem
- `/projects/[id]` crashes with **React error #185: "Maximum update depth exceeded"**
- Infinite re-render loop somewhere in `StandardEditorLayout` or `DeveloperEditorLayout`
- Crashes for BOTH anonymous and authenticated users
- Home page, sign-in page, and all other routes work fine

### Ruled Out
- **NOT the LLM code** — bypassed `useLLMGate` with a static object in both layouts, crash persists
- **NOT the `/llm/status` 403** — crash happens for anonymous users too (where the query never fires)
- **NOT stale chunks** — fresh `rm -rf .next && npm run build` doesn't help
- **NOT `useProjectViewer`** — simplified page rendering only project data (no editor layouts) works perfectly: "FOLIO — 18326 classes"

### Confirmed
- Crash is inside the editor layout components (`StandardEditorLayout` / `DeveloperEditorLayout`)
- Both the viewer page (`/projects/[id]`) and editor page (`/projects/[id]/editor`) crash
- The minified error stack shows only React internals (`rh → rp → aU → aF → iv → up → ud` loop)

### Current Server State
- **Caddy is pointing to dev server (port 3001)** — NOT production!
  - To restore prod: `sudo cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile && sudo systemctl reload caddy`
- Dev server running on port 3001 (background process)
- Production server (`ontokit-web` systemd service) still running on port 3000
- An `error.tsx` error boundary exists at `app/projects/[id]/error.tsx` (can be deleted later)
- Backup of original page at `app/projects/[id]/page.tsx.bak` (can be deleted)
- The `sed` edits to bypass `useLLMGate` were reverted via `git checkout`

### Next Steps
1. **Load the project page through the dev server** (Caddy is currently proxying to 3001) and check Chrome DevTools Console for the full unminified error with component names and line numbers
2. The full error will show which `useEffect` / `useState` is causing the infinite loop
3. Fix the offending hook/component
4. **Restore Caddy to production:** `sudo cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile && sudo systemctl reload caddy`
5. Rebuild production: `cd /home/ubuntu/ontokit-web && npm run build && sudo systemctl restart ontokit-web`
6. Delete temp files: `rm app/projects/[id]/error.tsx app/projects/[id]/page.tsx.bak`

### Key Files
- `app/projects/[id]/page.tsx` — viewer page (renders editor layouts)
- `components/editor/standard/StandardEditorLayout.tsx` — standard mode layout
- `components/editor/developer/DeveloperEditorLayout.tsx` — developer mode layout  
- `lib/hooks/useProjectViewer.ts` — data fetching hook (works fine)
- `lib/hooks/useLLMGate.ts` — LLM status hook (ruled out as cause)
- `/etc/systemd/system/ontokit-web.service` — systemd service (updated with static copy fix)
- `/etc/caddy/Caddyfile` — currently pointing to dev :3001 (backup at `.bak`)

### SSH Access
See project memory for SSH connection details.
