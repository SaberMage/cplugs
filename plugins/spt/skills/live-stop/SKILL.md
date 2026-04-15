---
name: live-stop
description: |
  Force-stop a live agent and its Psyche. Use when the user says "kill live agent",
  "force stop", or needs to immediately terminate a live session.
argument-hint: [<id>] | --all
allowed-tools: [Bash]
---

# /spt:live-stop

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$LIVE stop
$LIVE stop --all
```

If auto-detection fails: `$LIVE stop <your-id>`

Stops a live agent **and its Psyche**. The stop sequence:
1. Kills the Psyche wrapper process (and child claude/poll processes)
2. Removes Psyche's perch files and wrapper PID file
3. Stops Self via `$OWL stop`

If target is a **plain listener** (not live), suggests using `/spt:listen-stop` instead.

## /spt:live-stop --all

Stops **all** live agents and their Psyches. Also cleans orphaned wrapper PID files.
