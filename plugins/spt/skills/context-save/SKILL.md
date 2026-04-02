---
name: context-save
description: |
  Save Psyche context summary to persistent file. Primarily used by Psyche internally
  but available for manual context saves when needed.
argument-hint: <self_id> <summary>
allowed-tools: [Bash]
---

# /spt:context-save

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE context-save <self_id> <summary>
```

Save Psyche context summary to `~/.claude/psyche-contexts/{self_id}.md`. Overwrites the previous summary. Keep it concise — the Psyche prompt instructs when and what to save.

This is primarily used by the Psyche process internally. Manual use is available when you need to seed or correct context outside the normal Psyche lifecycle.
