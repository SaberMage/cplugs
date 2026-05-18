---
name: force-stop
description: |
  Force-stop an SPT agent -- plain owl listener or live agent (with its
  Psyche). Use when the user says "stop listening", "stop owl", "kill live
  agent", "force stop", "tear down perch", or "immediately terminate".
  Session-aware: a live session (or a target with `live:true` in info.json)
  routes through `$LIVE stop` (3-step kill including Psyche teardown); a
  plain listener routes through `$OWL stop`.
argument-hint: "[<id>] | --all"
allowed-tools: [Bash]
---

# /spt:force-stop

All commands use `$OWL` / `$LIVE` env vars, auto-injected by the plugin's
SessionStart hook. If commands fail with "command not found", restart the
Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your
> session. Pass your ID explicitly only if auto-detection fails.

## Session-aware branching

Pick ONE branch based on the target:

- **Live session, or target has `live:true` in info.json** -- use `$LIVE stop`:
  ```bash
  $LIVE stop
  $LIVE stop --all
  ```

  `$LIVE stop` performs the full 3-step kill sequence:
  1. Kills the Psyche wrapper process (and child claude/poll processes).
  2. Removes Psyche's perch files and wrapper PID file.
  3. Stops Self via `$OWL stop`.

  `$LIVE stop --all` stops **all** live agents and their Psyches, and also
  cleans orphaned wrapper PID files.

- **Plain listener (non-live)** -- use `$OWL stop`:
  ```bash
  $OWL stop
  $OWL stop --all
  ```

## Explicit ID override

If auto-detection fails, pass the ID explicitly:

```bash
$OWL stop <your-id>
$LIVE stop <your-id>
```

## --all flag

`--all` on either branch stops every listener / every live agent of that
type. Use sparingly -- this tears down sibling agents too.

## Caveat

If you don't know the target ID, check via `/spt:list-agents` first. Do NOT
stop perches with `"mode":"once"` -- they self-clean after their single
delivery.
