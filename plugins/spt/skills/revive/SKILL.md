---
name: revive
description: |
  Restart a live agent with new generation. Use when the user says "revive",
  "restart live agent", or wants to refresh a live agent's session.
argument-hint: <id> [--period <seconds>]
allowed-tools: [Bash, Read]
---

# /spt:revive

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE revive <id> [--period <seconds>]
```

Quick restart for a live agent. Kills existing wrapper, Psyche poll, and Self, then re-runs the live start flow with the same ID. Generation counter increments automatically.

After the revive background task launches, run `$LIVE psyche-download <id>` to retrieve prior context. Evaluate staleness and send a commune if needed.

**Agent-type guard:** Only works on live agents. If target is a plain listener, refuses with: "Only live agents can be revived."
