---
name: list-live
description: |
  Show active live agents. Use when the user asks "list live agents",
  "who's live", or "show live".
argument-hint: "[--all] [--offline] [--here]"
allowed-tools: [Bash]
---

# /spt:list-live

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

```bash
$LIVE list
```

Shows active live agents (those with `live:true` in info.json). Cleans stale entries. Psyche agents not shown -- use `/spt:list-psyche`.
