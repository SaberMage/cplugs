---
name: signoff
description: |
  Graceful live agent shutdown with final Psyche context save. Use when the user
  says "sign off", "graceful stop", or wants to cleanly end a live session.
argument-hint: ""
allowed-tools: [Bash, Write]
---

# /spt:signoff

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

## Flow

1. **Download current Psyche context** to check what's missing:
   ```bash
   $LIVE psyche-download <your-id>
   ```

2. **Compare** the downloaded context against your current knowledge. Identify any missing points -- work completed, decisions made, context changes since the last commune.

3. **Sign off** -- use the **Write tool** to create
   `.claude/{your-id}-signoff.md`. Do not use Bash/heredoc -- Write is the
   canonical path: no shell escaping, no `EOF` collision risk, and Write
   auto-creates the `.claude/` parent directory.

   - **Plain signoff** (no final commune body): Write the file with an empty
     string as its contents.
   - **Signoff with a FINAL COMMUNE body**: Write the file with the final
     commune body as its contents. That body is prepended to INIT_SIGNOFF
     when Psyche absorbs it.

   Your Self listener detects the file, sends a file-drop notification to your
   Psyche wrapper, prints `STOP:{your-id} (signoff dropped)`, and exits cleanly
   (code 0 — so Claude Code does not surface the listener termination as
   "failed"). The Psyche wrapper independently consumes the file, composes an
   INIT_SIGNOFF envelope (with FINAL COMMUNE if the body is non-empty), runs
   its final Psyche session, and tears itself down.

**Signoff vs Stop:**
- **`/spt:signoff`** -- Graceful: INIT_SIGNOFF (with optional final commune) to Psyche first. Use for normal session end.
- **`/spt:live-stop`** -- Force: kills immediately. Use when unresponsive or need immediate kill.
