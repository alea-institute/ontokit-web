# Ow-16 dependency audit continuation

The build starts from `dde11d3f49f44161b06711fab4d5715b4eceb80a` on `drawdown/ow-16`. The lockfile SHA-256 is `995f91ee6b71f9df76e2dafe2133f021f2c66b4f8da44d911079cc1fdc7d2842`, unchanged from the ow-6 final audit. There is no remote or local `dev` ref. The chief campaign document is absent from this clone; the controller retains campaign/base reconciliation and publication.

## Baseline, 2026-11-21

The public npm registry returned valid full and production lockfile audits using Node 24.22.3 and npm 11.19.1. Both commands exited 1 because findings remain. See [full report](baseline-full.json), [production report](baseline-production.json), and their `-meta.json` command/identity records. No credentials or user npm configuration were used.

| Snapshot | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Historical ow-6 full | 1 | 15 | 2 | 8 | 26 |
| Fresh baseline full | 1 | 14 | 10 | 8 | 33 |
| Historical ow-6 production | 1 | 7 | 1 | 7 | 16 |
| Fresh baseline production | 1 | 6 | 2 | 7 | 16 |

Counts are affected package entries, including propagated entries, not independent exploits. DOMPurify's severity is now moderate. Fresh minimatch/TypeScript ESLint findings and six additional Next advisory IDs are tracked separately from dependency changes. All 26 historical entries remain represented in the baseline.

The baseline clean install passed. Eleven focused existing test files passed 230 tests. An initial test command incorrectly supplied optional-auth build settings to the environment tests; its one failure disappeared after using the test environment. No assertion changed. The default host Node 22.22.1 is too old for JSDOM 30.0.1; Node 24.22.3 was downloaded from nodejs.org and its archive SHA-256 checked against the published sums.

## Acceptance boundary

Implementation and audit accounting are in progress. Chromium must not launch in this socket-denied lane. Browser screenshots, genuine rehearsal, Docker/Node 22 Alpine image validation and controller security/Astra/Fable gates remain pending. No historical screenshot or hosted acceptance is reused as current proof.
