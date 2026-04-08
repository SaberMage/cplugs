---
name: clear-psyche
description: |
  Clear stored Psyche context. Use when the user says "clear psyche",
  "reset psyche context", or wants to wipe a Psyche's saved state.
argument-hint: ""
allowed-tools: [Bash]
---

# /spt:clear-psyche

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$LIVE clear-psyche
```

If auto-detection fails: `$LIVE clear-psyche <your-id>`

Deletes stored Psyche context at `~/.claude/psyche-contexts/{id}.md`. Use when a Self agent is permanently stopped and context is no longer needed.
