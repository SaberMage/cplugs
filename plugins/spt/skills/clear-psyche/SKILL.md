---
name: clear-psyche
description: |
  Clear stored Psyche context. Use when the user says "clear psyche",
  "reset psyche context", or wants to wipe a Psyche's saved state.
argument-hint: <id>
allowed-tools: [Bash]
---

# /spt:clear-psyche

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE clear-psyche <id>
```

Deletes stored Psyche context at `~/.claude/psyche-contexts/{id}.md`. Use when a Self agent is permanently stopped and context is no longer needed.
