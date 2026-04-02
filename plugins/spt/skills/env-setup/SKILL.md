---
name: env-setup
description: |
  Manual fallback to write OWL/LIVE env vars to settings.json. Use when spt commands
  fail with "command not found" or empty variable errors.
allowed-tools: [Bash]
---

# /spt:env-setup

```bash
$OWL env-setup
```

Manual fallback for environments where `CLAUDE_ENV_FILE` is broken (known issues: `anthropics/claude-code#16564` VSCode extension, `anthropics/claude-code#19357` CLAUDE_ENV_FILE inconsistency). Writes `OWL` and `LIVE` env vars directly to `~/.claude/settings.json`.

This is **not** needed in normal operation -- the plugin's SessionStart hook handles env injection automatically. Only use if commands fail with "command not found" after plugin installation.
