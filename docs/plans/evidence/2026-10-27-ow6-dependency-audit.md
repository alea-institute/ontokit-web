# OW-6 dependency audit — 2026-10-27 plan

Execution date: **2026-10-28 UTC**. Scope: U3 / R4, R6 and R7 of [the ow-6 plan](../2026-10-27-0933-test-ow6-rehearsal-hygiene-plan.md).

The final audit remains **unresolved: 26 affected package entries, including one critical entry**. The production-only report remains at 16 entries. The compatible Vitest test-tool update removes three moderate package entries covering two distinct advisories. This is an audit receipt, not a clean-security or deployment-acceptance claim.

## Inputs and method

- Baseline: committed `3759ab87` manifests, unchanged from the implementation base `43783d39`; the working tree already contained partial ow-6 dependency changes when this build resumed. Baseline audits used copies of the committed manifests, not the partially changed lockfile.
- Baseline `package-lock.json` SHA-256: `2b04f15d60a1db69df729f34530067152f878a9104f860815c14cfbde37d4a6f`.
- Final `package-lock.json` SHA-256: `995f91ee6b71f9df76e2dafe2133f021f2c66b4f8da44d911079cc1fdc7d2842`.
- Runtime: Node `22.22.1`; npm `9.2.0`; lockfile v3; audit report v2. The repository permits Node >=22.13.0; CI uses Node 24. This receipt does not imply a Node 24 run.
- Complete-tree command: `npm audit --package-lock-only --json --include=dev`.
- Production-subset command: `npm audit --package-lock-only --json --omit=dev`.
- Both commands ran against each lockfile. The saved JSON reports contain `metadata` and `vulnerabilities`, with no `error` field. Registry findings are reported as returned; package reachability and exploitability were not independently demonstrated.
- Raw JSON/stderr remain in ignored runner storage. This public receipt contains package metadata and advisory identifiers only.

| Lockfile / mode | Exit | Critical | High | Moderate | Low | Total affected package entries |
|---|---:|---:|---:|---:|---:|---:|
| baseline-full | 1 | 1 | 15 | 5 | 8 | 29 |
| baseline-production | 1 | 1 | 7 | 1 | 7 | 16 |
| final-full | 1 | 1 | 15 | 2 | 8 | 26 |
| final-production | 1 | 1 | 7 | 1 | 7 | 16 |

Counts are npm package-entry counts, including propagated vulnerability entries; they are not counts of independent exploits. The final reports contain 80 distinct directly identified advisory URLs. The production result uses npm’s production classification and is not a runtime-exploitability assessment. The report’s dependency totals describe the locked graph and must not be treated as the installed production package count.

## Applied dependency changes

| Change | Evidence and disposition |
|---|---|
| `vitest` and `@vitest/coverage-v8` 4.1.10 → 4.1.12, pinned together | Same-minor patch repair; `@vitest/mocker` also resolves to 4.1.12. Removes [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (affected <4.1.11) and [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) (affected <4.1.12) from this locked graph. `vitest`, `@vitest/mocker` and the propagated coverage entry are absent from the final audit. These findings concern test/mock tooling, not an application security-settings change. |
| Add `@axe-core/playwright` 4.14.0 | Explicit development dependency required by U1; resolves `axe-core` 4.11.2 → 4.14.0. Existing Playwright remains 1.63.0. The adapter declares `playwright-core >=1.0.0`; browser execution remains an independent acceptance gate. |

Associated Vitest packages (`expect`, `mocker`, `pretty-format`, `runner`, `snapshot`, `spy`, `utils`) also advance from 4.1.10 to 4.1.12. Compatible-range test dependencies change: `chai` 6.2.2 → 6.3.0; `expect-type` 1.3.0 → 1.4.0; `obug` 2.1.1 → 2.2.1; `std-env` 4.0.0 → 4.3.0; `tinyexec` 1.0.4 → 1.3.1; `tinyrainbow` 3.1.0 → 3.2.0; nested `picomatch` 4.0.4 → 4.0.7. The duplicate `next-intl`-nested `@swc/helpers` 0.5.23 entry is deduplicated to the existing root 0.5.23. No production package version is upgraded by this repair.

All existing overrides remain: `dompurify`, the two `minimatch` majors and `ajv@8`. No `audit fix --force`, major framework migration, suppression or new outside service is included. Regression/build results and unavailable browser evidence are recorded in [the implementation receipt](2026-10-27-ow6-rehearsal-hygiene.md); removal from an audit report alone does not establish behavioral compatibility.

## Remaining findings and disposition

Every entry below is **UNRESOLVED**. “Yes” means npm reports a fix, not that a particular upgrade was validated. Runtime/framework repairs need their relevant auth, suggestions and rehearsal profiles on a permitted runner with matching API source. Other development-tool repairs remain separate compatible-update work; this bounded change does not use an unverified blanket upgrade to obtain a clean count. The controller should prioritize the critical Next entry and production high findings before claiming release readiness. No finding is waived based on a presumed unused path.

Usage was traced from the lockfile and repository imports: Next serves the application and `components/auth/user-menu.tsx` uses `next/image`; Scalar is imported by `app/api-docs/page.tsx`; Monaco supplies the editor; `lib/env.ts` imports Zod; `next.config.ts` imports the Codecov bundler plugin. Transitive usage below describes dependency ownership, not proof that a vulnerable function runs.

| Package | Locked versions | Severity | In production audit | npm fix available | Dependency ownership / usage |
|---|---|---|---|---|---|
| `@ai-sdk/gateway` | 3.0.13 | low | Yes | Yes | Scalar API reference → agent-chat → ai → gateway. |
| `@ai-sdk/provider-utils` | 4.0.5 | low | Yes | Yes | Scalar API reference → agent-chat → AI SDK; API documentation dependencies. |
| `@ai-sdk/vue` | 3.0.33 | low | Yes | Yes | Scalar API reference → agent-chat → AI SDK Vue integration. |
| `@babel/core` | 7.29.0 | low | No | Yes | ESLint React hooks / Vite React plugin; lint and test transforms. |
| `@codecov/bundler-plugin-core` | 2.0.1 | high | No | No | @codecov/webpack-plugin → core → nested Zod 3; build coverage plugin. |
| `@codecov/webpack-plugin` | 2.0.1 | high | No | No | Direct development dependency; next.config.ts build plugin. |
| `@humanfs/node` | 0.16.7 | moderate | No | Yes | ESLint filesystem operations. |
| `@scalar/agent-chat` | 0.12.26 | low | Yes | Yes | @scalar/api-reference-react → @scalar/api-reference → agent-chat. |
| `@scalar/api-reference` | 1.65.1 | low | Yes | Yes | @scalar/api-reference-react → API documentation UI. |
| `@scalar/api-reference-react` | 0.9.63 | low | Yes | Yes | Direct production dependency; app/api-docs/page.tsx. |
| `@vue/server-renderer` | 3.5.41 | high | Yes | Yes | Scalar API reference → Vue → server renderer. |
| `ai` | 6.0.33 | low | Yes | Yes | Scalar API reference → agent-chat → AI SDK. |
| `baseline-browser-mapping` | 2.10.14 | moderate | Yes | Yes | Next/browser tooling → browser compatibility metadata. |
| `brace-expansion` | 1.1.18, 5.0.9 | high | No | Yes | ESLint/config-array/eslintrc/plugins and TypeScript ESLint → minimatch; lint file matching. |
| `browserslist` | 4.28.2 | high | No | Yes | Webpack via Codecov and other build tooling; browser target selection. |
| `dompurify` | 3.3.3 | high | Yes | Yes | Monaco editor → DOMPurify; existing override retains 3.3.3. |
| `fast-uri` | 3.1.5 | high | No | Yes | Webpack schema-utils / AJV; build schema validation. |
| `js-yaml` | 4.3.1 | high | No | Yes | ESLint configuration parsing. |
| `nanoid` | 3.3.17 | high | Yes | Yes | Next → its nested PostCSS → nanoid. |
| `next` | 16.3.1 | critical | Yes | Yes | Direct application framework; runtime, rendering, caching, image and development-server surfaces. |
| `sharp` | 0.35.3 | high | Yes | Yes | Next image processing. |
| `source-map-js` | 1.2.1 | high | Yes | Yes | PostCSS and other runtime/build dependencies; source-map processing. |
| `undici` | 6.28.0, 8.10.0 | high | No | Yes | JSDOM and Codecov → GitHub Actions libraries; development HTTP clients. |
| `vite` | 8.0.16 | high | No | Yes | Vitest / Vite React plugin; test and development tooling. |
| `vue` | 3.5.41 | high | Yes | Yes | Scalar API-reference UI dependencies. |
| `zod` | 3.25.76, 4.4.3 | high | Yes | No (full tree); Yes (root, production report) | Root 4.4.3 (lib/env.ts) and Codecov core’s nested 3.25.76; validation. |

The Zod distinction is material: the production report offers a root-package repair, while the complete tree includes Codecov’s nested Zod 3 and reports no fix. `@codecov/bundler-plugin-core` and `@codecov/webpack-plugin` inherit that no-fix finding. Upgrading root Zod alone would not resolve the complete-tree finding.

### Exact affected lockfile locations

These are the `nodes` returned by the final complete-tree audit, with versions read from the final lockfile.

- **@ai-sdk/gateway:** `node_modules/@ai-sdk/gateway` (3.0.13).

- **@ai-sdk/provider-utils:** `node_modules/@ai-sdk/provider-utils` (4.0.5).

- **@ai-sdk/vue:** `node_modules/@ai-sdk/vue` (3.0.33).

- **@babel/core:** `node_modules/@babel/core` (7.29.0).

- **@codecov/bundler-plugin-core:** `node_modules/@codecov/bundler-plugin-core` (2.0.1).

- **@codecov/webpack-plugin:** `node_modules/@codecov/webpack-plugin` (2.0.1).

- **@humanfs/node:** `node_modules/@humanfs/node` (0.16.7).

- **@scalar/agent-chat:** `node_modules/@scalar/agent-chat` (0.12.26).

- **@scalar/api-reference:** `node_modules/@scalar/api-reference` (1.65.1).

- **@scalar/api-reference-react:** `node_modules/@scalar/api-reference-react` (0.9.63).

- **@vue/server-renderer:** `node_modules/@vue/server-renderer` (3.5.41).

- **ai:** `node_modules/ai` (6.0.33).

- **baseline-browser-mapping:** `node_modules/baseline-browser-mapping` (2.10.14).

- **brace-expansion:** `node_modules/@eslint/config-array/node_modules/brace-expansion` (1.1.18); `node_modules/@eslint/eslintrc/node_modules/brace-expansion` (1.1.18); `node_modules/brace-expansion` (5.0.9); `node_modules/eslint-plugin-import/node_modules/brace-expansion` (1.1.18); `node_modules/eslint-plugin-jsx-a11y/node_modules/brace-expansion` (1.1.18); `node_modules/eslint-plugin-react/node_modules/brace-expansion` (1.1.18); `node_modules/eslint/node_modules/brace-expansion` (1.1.18).

- **browserslist:** `node_modules/browserslist` (4.28.2).

- **dompurify:** `node_modules/dompurify` (3.3.3).

- **fast-uri:** `node_modules/fast-uri` (3.1.5).

- **js-yaml:** `node_modules/js-yaml` (4.3.1).

- **nanoid:** `node_modules/next/node_modules/nanoid` (3.3.17).

- **next:** `node_modules/next` (16.3.1).

- **sharp:** `node_modules/sharp` (0.35.3).

- **source-map-js:** `node_modules/source-map-js` (1.2.1).

- **undici:** `node_modules/@actions/github/node_modules/undici` (6.28.0); `node_modules/@actions/http-client/node_modules/undici` (6.28.0); `node_modules/undici` (8.10.0).

- **vite:** `node_modules/vite` (8.0.16).

- **vue:** `node_modules/vue` (3.5.41).

- **zod:** `node_modules/@codecov/bundler-plugin-core/node_modules/zod` (3.25.76); `node_modules/zod` (4.4.3).

### Advisory inventory

The following direct advisories remain in the final reports. Ranges are copied from the registry report; repeated package/range entries for the same advisory are consolidated. All have the unresolved disposition above. Entries in the preceding table with only propagated findings are linked immediately below this inventory.

| Package | Advisory | Affected range(s) reported |
|---|---|---|
| `@ai-sdk/provider-utils` | [GHSA-866g-f22w-33x8](https://github.com/advisories/GHSA-866g-f22w-33x8) | `>=4.0.0-beta.10 <4.0.33` |
| `@babel/core` | [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | `<=7.29.0` |
| `@humanfs/node` | [GHSA-p498-v437-472g](https://github.com/advisories/GHSA-p498-v437-472g) | `<0.16.8` |
| `@vue/server-renderer` | [GHSA-g2v6-rqmx-r4w6](https://github.com/advisories/GHSA-g2v6-rqmx-r4w6) | `<3.5.42` |
| `baseline-browser-mapping` | [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | `>=2.0.0 <2.11.0` |
| `brace-expansion` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `<1.1.21`; `>=4.0.0 <5.0.12` |
| `brace-expansion` | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `<1.1.20`; `>=4.0.0 <5.0.11` |
| `brace-expansion` | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `<1.1.19`; `>=4.0.0 <5.0.10` |
| `browserslist` | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | `<=4.28.6` |
| `browserslist` | [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | `<=4.28.6` |
| `dompurify` | [GHSA-h7mw-gpvr-xq4m](https://github.com/advisories/GHSA-h7mw-gpvr-xq4m) | `<3.4.0` |
| `dompurify` | [GHSA-crv5-9vww-q3g8](https://github.com/advisories/GHSA-crv5-9vww-q3g8) | `>=1.0.10 <3.4.0` |
| `dompurify` | [GHSA-v9jr-rg53-9pgp](https://github.com/advisories/GHSA-v9jr-rg53-9pgp) | `>=3.0.1 <3.4.0` |
| `dompurify` | [GHSA-hpcv-96wg-7vj8](https://github.com/advisories/GHSA-hpcv-96wg-7vj8) | `<=3.4.5` |
| `dompurify` | [GHSA-r47g-fvhr-h676](https://github.com/advisories/GHSA-r47g-fvhr-h676) | `<=3.4.5` |
| `dompurify` | [GHSA-rp9w-3fw7-7cwq](https://github.com/advisories/GHSA-rp9w-3fw7-7cwq) | `<=3.4.6` |
| `dompurify` | [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) | `<=3.4.10` |
| `dompurify` | [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) | `<3.4.9` |
| `dompurify` | [GHSA-gvmj-g25r-r7wr](https://github.com/advisories/GHSA-gvmj-g25r-r7wr) | `>=3.0.0 <=3.4.7` |
| `dompurify` | [GHSA-x4vx-rjvf-j5p4](https://github.com/advisories/GHSA-x4vx-rjvf-j5p4) | `<=3.4.6` |
| `dompurify` | [GHSA-76mc-f452-cxcm](https://github.com/advisories/GHSA-76mc-f452-cxcm) | `<3.4.7` |
| `dompurify` | [GHSA-39q2-94rc-95cp](https://github.com/advisories/GHSA-39q2-94rc-95cp) | `<=3.3.3` |
| `dompurify` | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | `<=3.4.12` |
| `dompurify` | [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | `<=3.4.11` |
| `dompurify` | [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) | `<=3.4.15` |
| `dompurify` | [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) | `<=3.4.16` |
| `dompurify` | [GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) | `<=3.4.16` |
| `fast-uri` | [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | `>=3.1.3 <3.1.6` |
| `fast-uri` | [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | `>=3.0.0 <3.1.6` |
| `fast-uri` | [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | `>=3.1.2 <3.1.6` |
| `fast-uri` | [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | `>=3.0.0 <3.1.6` |
| `fast-uri` | [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | `>=3.0.0 <3.1.7` |
| `fast-uri` | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | `>=3.0.0 <3.1.8` |
| `fast-uri` | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | `>=3.0.0 <3.1.9` |
| `fast-uri` | [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) | `>=3.0.0 <3.1.9` |
| `fast-uri` | [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) | `>=3.1.3 <3.1.9` |
| `fast-uri` | [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) | `>=3.0.0 <3.1.9` |
| `js-yaml` | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | `>=4.0.0 <4.3.2` |
| `nanoid` | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `<3.3.18` |
| `next` | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) | `>=16.0.0 <16.3.3` |
| `next` | [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) | `>=16.0.0 <16.3.3` |
| `next` | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | `>=16.2.0 <16.3.6` |
| `next` | [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) | `>=16.3.0 <16.3.8` |
| `next` | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | `>=16.0.0 <16.3.8` |
| `next` | [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) | `>=16.0.0 <16.3.8` |
| `next` | [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | `>=16.0.0 <16.3.8` |
| `next` | [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | `>=16.0.0 <16.3.8` |
| `next` | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | `>=16.0.0 <16.3.8` |
| `next` | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | `>=16.0.0 <=16.4.0` |
| `next` | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | `>=16.0.0 <=16.4.0` |
| `next` | [GHSA-h694-7cp9-m8p3](https://github.com/advisories/GHSA-h694-7cp9-m8p3) | `>=16.3.0 <16.3.8` |
| `next` | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | `>=16.0.0 <=16.4.0` |
| `sharp` | [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | `<0.35.4` |
| `sharp` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `<0.35.5` |
| `source-map-js` | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `>=1.0.0 <1.2.2` |
| `undici` | [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) | `>=8.1.0 <8.10.2`; `>=6.25.0 <6.28.1` |
| `undici` | [GHSA-pmjh-fq2x-6v4x](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | `>=8.0.0 <8.10.2`; `<6.28.1` |
| `undici` | [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | `>=8.0.0 <8.10.2`; `>=6.7.0 <6.28.1` |
| `undici` | [GHSA-3xpg-4rpp-hhhm](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-2jfj-6hjv-fm6j](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-2gqq-gqf2-x968](https://github.com/advisories/GHSA-2gqq-gqf2-x968) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-8436-99hf-9mmv](https://github.com/advisories/GHSA-8436-99hf-9mmv) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-vp8m-p9jh-q5pm](https://github.com/advisories/GHSA-vp8m-p9jh-q5pm) | `>=8.10.0 <8.10.2` |
| `undici` | [GHSA-rx4f-c7p8-82vq](https://github.com/advisories/GHSA-rx4f-c7p8-82vq) | `>=8.0.0 <8.10.2` |
| `undici` | [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | `>=8.0.0 <8.12.2`; `>=6.5.0 <6.29.1` |
| `undici` | [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472) | `>=8.0.0 <8.12.2` |
| `undici` | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | `>=8.0.0 <8.12.2`; `>=6.23.0 <6.29.1` |
| `undici` | [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26) | `>=8.0.0 <8.12.2` |
| `undici` | [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | `>=8.0.0 <8.12.2`; `>=4.0.0 <6.29.1` |
| `undici` | [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | `>=8.0.0 <8.12.2`; `>=4.2.1 <6.29.1` |
| `undici` | [GHSA-9fm3-97px-rjf6](https://github.com/advisories/GHSA-9fm3-97px-rjf6) | `>=8.0.0 <8.12.2`; `>=5.15.0 <6.29.1` |
| `undici` | [GHSA-55wc-3pg8-jfw6](https://github.com/advisories/GHSA-55wc-3pg8-jfw6) | `>=8.0.0 <8.12.2` |
| `vite` | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | `>=8.0.0 <=8.1.5` |
| `vite` | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | `>=8.0.0 <=8.1.5` |
| `vite` | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `>=8.0.0 <=8.1.5` |
| `vite` | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | `>=8.0.0 <=8.1.5` |
| `vite` | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | `>=8.0.0 <=8.1.5` |
| `zod` | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | `<4.6.6` |

Propagated edges reported by npm (package → affected dependency):

- `@ai-sdk/gateway` → `@ai-sdk/provider-utils`.
- `@ai-sdk/vue` → `@ai-sdk/provider-utils`, `ai`.
- `@codecov/bundler-plugin-core` → `zod`.
- `@codecov/webpack-plugin` → `@codecov/bundler-plugin-core`.
- `@scalar/agent-chat` → `@ai-sdk/vue`, `ai`.
- `@scalar/api-reference` → `@scalar/agent-chat`.
- `@scalar/api-reference-react` → `@scalar/api-reference`.
- `ai` → `@ai-sdk/gateway`, `@ai-sdk/provider-utils`.
- `vue` → `@vue/server-renderer`.

## Acceptance boundary and next action

The full and production audits succeeded as requests and returned nonzero vulnerability results. They establish the locked graph’s reported findings at the stated time; they do not establish that every affected path is reachable or that remaining findings are safe. The build has no matching API checkout or usable isolated Docker stack. Local browser captures using fixture HTTP responses, if recorded in the implementation receipt, do not replace real full-stack rehearsal or hosted DEV acceptance. Current DEV acceptance is therefore unknown.

The controller can use these exact lockfile digests to reproduce the audit, schedule compatible updates by owning subsystem, and run the existing release gates plus relevant auth/suggestions/rehearsal profiles. A fresh audit is required after any lockfile change. No credential, security-setting, spend or Damien-only decision was introduced by U3.
