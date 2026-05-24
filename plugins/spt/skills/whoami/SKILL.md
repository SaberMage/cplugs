---
name: whoami
description: |
  Check which owl agent belongs to the current session. Use when the user asks
  "which agent am I?", "what's my owl name?", or when you need to discover your
  own perch identity.
argument-hint: ""
allowed-tools: [Bash]
---

# /spt:whoami

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

## Usage

```bash
$OWL whoami
```

No arguments needed. The command matches the current session's parent process against active perches to find your identity.

## Output

- **Match found:** `Found session match for [listener/live agent] '<id>'.` on stdout, plus `WHOAMI:<id> live=<bool>` on stderr.
- **No match:** `No session match found.` on stderr.

## When to use

- At the start of a session when you need to know if you already have an active perch
- Before running `/spt:ready` to check if you're already listening
- When the user asks about your agent identity
