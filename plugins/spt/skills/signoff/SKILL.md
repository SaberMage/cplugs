---
name: signoff
description: |
  Graceful live agent shutdown with final Psyche context save. Use when the user
  says "sign off", "graceful stop", or wants to cleanly end a live session.
argument-hint: <id> [true|false]
allowed-tools: [Bash]
---

# /spt:signoff

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

## Flow

1. **Download current Psyche context** to check what's missing:
   ```bash
   $LIVE psyche-download <id>
   ```

2. **Compare** the downloaded context against your current knowledge. Identify any missing points — work completed, decisions made, context changes since the last commune.

3. **Sign off with or without a final commune:**

   If Psyche context is current (nothing missing):
   ```bash
   $LIVE signoff <id> true
   ```

   If Psyche context is missing points, bundle a final commune with signoff:
   ```bash
   $LIVE signoff <id> true -m "the missing context here"
   ```
   The `-m` flag appends a `FINAL COMMUNE:` section to the STASH_FINAL message. Psyche absorbs it before doing its final context save — one message, no gap.

The second argument (`true`/`false`) controls whether STASH_FINAL is sent to Psyche. Always use `true` for live agents with Psyche.

**Signoff vs Stop:**
- **`/spt:signoff`** -- Graceful: STASH_FINAL (with optional final commune) to Psyche first. Use for normal session end.
- **`/spt:live-stop`** -- Force: kills immediately. Use when unresponsive or need immediate kill.
