---
name: list-ready
description: |
  Show active owl listeners and clean stale perches. Use when the user asks
  "who's listening", "list agents", or "show active listeners".
allowed-tools: [Bash]
---

# /spt:list-ready

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

```bash
$OWL list
```

Shows active listeners with pending message count. Automatically cleans stale perches.
