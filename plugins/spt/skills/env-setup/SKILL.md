---
name: env-setup
description: |
  Write OWL/LIVE env vars via CLAUDE_ENV_FILE (preferred) or fall back to settings.json
  with a warning. Use when spt commands fail with "command not found" or empty variable errors.
allowed-tools: [Bash]
---

# /spt:env-setup

```bash
$OWL env-setup
```

Sets up `OWL` and `LIVE` env vars for the current session. Prefers writing to `CLAUDE_ENV_FILE` (the standard Claude Code env injection mechanism). If `CLAUDE_ENV_FILE` is not available, falls back to writing directly to `~/.claude/settings.json` with a warning -- this pins the binary version and is not recommended for normal use.

This is **not** needed in normal operation -- the plugin's SessionStart hook handles env injection automatically. Only use if commands fail with "command not found" after plugin installation.
