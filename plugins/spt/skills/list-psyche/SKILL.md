---
name: list-psyche
description: |
  Show active Psyche processes. Use when the user asks "list psyches",
  "show psyches", or wants to check Psyche status.
allowed-tools: [Bash]
---

# /spt:list-psyche

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE list-psyches
```

Shows Psyche agents (those with `psyche:true` in info.json). Intended for the user, Self agents checking Psyche status, and Touch (health checker).
