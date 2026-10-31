# Ow-4 entity source preview: browser evidence

Captured 2026-10-30 against `drawdown/ow-4` (application source at `241befa2`), with Playwright 1.63.0 and its bundled Chromium, headless.

## Command

```bash
OW4_UI_PORT=9164 npx playwright test --config=playwright.ui.config.ts entity-source-preview-evidence
```

`OW4_UI_PORT` is optional; without it the config picks a free local port. The config starts the real Next.js dev app through `e2e/ui/server.mjs` (`AUTH_MODE=disabled`) and stops it when the run ends. Result: **2 passed** (desktop, mobile).

The spec lives in `e2e/ui/entity-source-preview-evidence.spec.ts`. It shares its fixtures with the acceptance scenario through `e2e/ui/ow4-fixtures.ts`.

## Data and fixtures

- **API:** none. Playwright route mocks answer every `/api/v1/**` read for the synthetic project `11111111-1111-4111-8111-111111111111` ("Entity source demo"). A non-GET request fails the test, and so does an unmapped read.
- **Session:** a synthetic `/api/auth/session` response with an editor role.
- **Ontology:** a 14-line Turtle file, `ontologies/demo.ttl`, holding the class `:Person`, the object property `:hasGuide` and the individual `:alice`.
- **Editor preferences:** Developer mode, set through `localStorage` before the page loads.

These screenshots prove browser rendering only. They do not prove hosted authentication, real API permissions or the BAIF rehearsal.

## Screenshots

Each screenshot captures the viewport with CSS transitions finished (`animations: "disabled"`).

| File | Viewport | What it shows |
|---|---|---|
| `entity-source-preview-desktop.png` | 1440x900, light | Developer › Tree › Properties with "has guide" selected and the **Entity source** tab active and focused. The panel shows the IRI `https://example.org/ow4/hasGuide`, the buffer note, **Copy snippet** and **Open full source**, then the excerpt `# File: ontologies/demo.ttl, line 8` and the four-line `:hasGuide a owl:ObjectProperty ;` statement. |
| `entity-source-preview-desktop-dark.png` | 1440x900, dark | The same state after switching the theme to Dark. Text, buttons and the excerpt block keep readable contrast. |
| `entity-source-preview-mobile.png` | 390x844, light | The same state on a phone-width viewport. The preview tab, IRI, both buttons and the excerpt render, but the editor overflows horizontally: the tree column is clipped on the left and the preview text on the right. See the known issue below. |

## Known issue: narrow viewports

At 390px and 768px the document scrolls horizontally (`scrollWidth` 720 at 390px; 1198 at 768px). The overflow comes from the editor header's action bar (Share, History, Health, PRs), and it measures the same with the **Detail** tab selected, so the preview did not introduce it. Ow-4 did not change that header. At 768px the preview panel itself stays within the viewport, as the acceptance spec asserts. The acceptance spec's full-page assertion (`document.documentElement.scrollWidth <= window.innerWidth`) still fails on this header overflow.
