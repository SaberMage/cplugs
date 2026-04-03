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

## Flow

1. **Download current Psyche context** to see what Psyche already knows:
   ```bash
   $LIVE psyche-download <id>
   ```

2. **Compare** the downloaded context against your current knowledge. Identify what's missing or stale — new work completed, decisions made, context shifts, intentions formed since the last commune. If the download includes a `<memformat>` section, use it as a guide for what topics to cover in your commune.

3. **Commune only the delta** — the points Psyche doesn't already have:
   ```bash
   $LIVE commune <id> "the missing context here"
   ```

If Psyche's context is already current, no commune is needed. Say so and move on.

Read `commune.md` (in this skill directory) for the full commune protocol — when to send, what to include, and diligence triggers.

**Agent-type guard:** Only works on live agents. If target is not live, refuses with: "Communes require a live agent with Psyche."
