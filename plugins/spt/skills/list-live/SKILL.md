---
name: list-live
description: |
  Show active live agents. Use when the user asks "list live agents",
  "who's live", or "show live".
allowed-tools: [Bash]
---

# /spt:list-live

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE list
```

Shows active live agents (those with `live:true` in info.json). Cleans stale entries. Psyche agents not shown -- use `/spt:list-psyche`.
