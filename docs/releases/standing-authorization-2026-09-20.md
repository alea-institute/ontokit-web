# Standing authorization receipt — 2026-09-20

Damien authorized routine pushes, PRs, merges, deployments and disclosure of repository content to Claude/Anthropic for future sessions. The operative wording is in `AGENTS.md`; `CLAUDE.md` follows its existing symlink.

The same preference is installed in this machine’s global Codex `~/.codex/AGENTS.md` and Claude `~/.claude/CLAUDE.md`. Both obsolete CatholicOS push-gate references in the global Claude instructions were superseded. These local global files persist across sessions; another machine needs its own global instructions or the repository copy.

| Repository | Publication | Merged revision | Verification |
|---|---|---|---|
| OntoKit web | [PR47](https://github.com/alea-institute/ontokit-web/pull/47), merged into dev | `85e0a8cc6b6d23cc6622be76322b77aa7cbc428d` | Six required checks passed: build, Docker build, lint, scan, tests, types |
| OntoKit API | [PR47](https://github.com/alea-institute/ontokit-api/pull/47), merged into dev | `39a1fa140af2a6bd2ef547bc69e4664590a5036e` | Six required checks passed: static analysis, build, Docker preflight, lint, pyright, tests |

Each publication changed only its repository’s `AGENTS.md`. The release candidate also marks historical no-publication instructions as superseded. Required checks and protections were retained. No deployment was performed by these documentation changes; D03–D05 and the D02 release acceptance obligations remain tracked in the delivery roadmap.
