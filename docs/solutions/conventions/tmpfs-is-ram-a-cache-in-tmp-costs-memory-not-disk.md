---
title: "/tmp is tmpfs — a 24 GB package cache there costs RAM, and fork() dies before df ever looks alarming"
date: "2026-08-13"
category: conventions
module: home box (damienriehl-IdeaCentre-Mini) / ontokit-api tooling
problem_type: near_miss
component: tooling
symptoms:
  - "every Bash command returned exit 1 with no output, including `echo alive` and `true`"
  - "file reads and writes kept working normally; the Task API kept working; only process spawning failed"
  - "two Codex workers dispatched in parallel both failed instantly with exit 1 and produced no artifacts"
  - "`df -h /` showed 110G free and 76% used — nothing looked wrong"
  - "`ulimit -u` was 250264 against only 696 running processes, so it was not a process-count limit"
related:
  - "docs/handoffs/2026-08-13-annotation-data-loss-361.md"
---

## What happened

Mid-task, the shell stopped working. Not slow — *gone*. `echo alive` returned exit 1 with no
output. So did `true`, `pwd`, and `id -u`. Meanwhile `Read` and `Write` worked perfectly, and
the background-task API still answered.

That split is the whole diagnostic signal: **file I/O worked, process creation did not.** When
`fork()` cannot get memory, that is exactly the shape you see.

The first two hypotheses were both wrong, and both were wrong in the same way:

- **"The disk is full"** — `df -h /` showed 469G total, 335G used, **110G available, 76%**. Fine.
- **"We hit a process limit"** — 696 processes against a `ulimit -u` of **250,264**. Not close.

## The actual cause

```
$ du -xh /tmp --max-depth=2 | sort -rh | head
25G     /tmp
24G     /tmp/ontokit-uv-cache-full/archive-v0
24G     /tmp/ontokit-uv-cache-full
525M    /tmp/pytest-of-damienriehl
```

**`/tmp` on this box is a tmpfs.** tmpfs lives in RAM. So a 24 GB `uv` package cache placed at
`/tmp/ontokit-uv-cache-full` was not consuming disk at all — it was consuming **24 GB of
memory**, permanently, for the lifetime of the mount.

Corroborated exactly by `free -h`:

```
              total   used   free   shared   buff/cache   available
Mem:           61Gi   43Gi   6.9Gi    22Gi         34Gi         17Gi
Swap:         8.0Gi  7.4Gi   569Mi
```

The `shared 22Gi` column *is* the tmpfs. And swap was **93% consumed** (7.4 of 8.0 GiB). With
swap effectively exhausted and a quarter of RAM locked in a cache directory, the kernel could no
longer satisfy `fork()`. Every shell invocation and both Codex dispatches died on it.

## The rule

**A cache directory under `/tmp` is a memory allocation, not a disk allocation, whenever `/tmp`
is tmpfs.** Check `df -h /tmp` and look at the `Filesystem` column — if it says `tmpfs`, every
byte written there is RAM. `UV_CACHE_DIR`, `PIP_CACHE_DIR`, `npm_config_cache`, `GOCACHE`,
`CARGO_HOME`, pytest `--basetemp`, and Docker build contexts all belong on real disk
(`~/.cache/...`), never in a tmpfs `/tmp`.

**Measure the filesystem that ran out, not the one you assumed.** `df -h /` was reassuring and
irrelevant; the exhausted filesystem was `/tmp`, and the exhausted *resource* was RAM. An
absence-of-problem claim is really a claim about where you looked — the same lesson as the
"nothing monitors riehl-dev" near-miss, in a new costume.

**When `fork()` fails but file I/O works, suspect memory before suspecting limits.** The
asymmetry is the tell, and it points at RAM/swap rather than at `ulimit`, disk, or the tool
that happened to fail first.

## Contributing factor worth naming

Two Codex workers were dispatched **in parallel** on a box already 43 GiB into its RAM, after
two `--no-cache` Docker image builds the same session. Any one of those was survivable; the
combination was not. **Dispatch heavy workers serially unless there is headroom to spare** — the
wall-clock saved by parallelism is worthless if it takes out the shell for the rest of the
session.

## Recovery

```
rm -rf /tmp/ontokit-uv-cache-full /tmp/pytest-of-damienriehl /tmp/node-compile-cache
sudo swapoff -a && sudo swapon -a     # swap will not drain on its own once pinned
```

The uv cache is pure derived data — the only cost of deleting it is re-downloading wheels.

## Prevention

Find whatever sets `UV_CACHE_DIR=/tmp/ontokit-uv-cache-full` (likely an ontokit-api
CI-parity full-dependency install) and repoint it to `~/.cache/uv`. Consider capping the tmpfs
size in `/etc/fstab` so a runaway cache fails loudly with ENOSPC instead of quietly eating the
memory the rest of the machine needs.
