---
name: commune
description: |
  Send a communal update to your Psyche. Use when the user says "commune",
  "update psyche", or wants to sync context with their Psyche companion.
argument-hint: <id> <msg>
allowed-tools: [Bash, Read]
---

# /spt:commune

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Calling convention:** `$LIVE commune` takes message as **positional arg**:
> ```bash
> $LIVE commune <id> "message text"
> ```

Send a communal update to your Psyche (Self agents only). Read `commune.md` (in this skill directory) for the full commune protocol -- when to send, what to include, and diligence triggers.

**Agent-type guard:** Only works on live agents. If target is not live, refuses with: "Communes require a live agent with Psyche."
