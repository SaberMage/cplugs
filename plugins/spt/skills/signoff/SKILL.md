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

   **Offline path (no live listener):** If no perch is currently live for your
   agent (no `ready` file under `{SPT_HOME}/owlery/<your-id>/`), the dropped
   `.claude/{your-id}-signoff.md` simply persists on disk. The next time anyone
   runs `$LIVE psyche-download <your-id>`, that signoff body is absorbed into
   the on-disk psyche-context under a `## Pending Signoff (written {mtime})`
   header and the drop file is deleted. This replaces the deprecated
   `/spt:amend-signoff` workflow — there is now ONE way to record
   post-session-end context updates: drop the file with the Write tool, let
   the next `psyche-download` absorb it.

**Signoff vs Stop:**
- **`/spt:signoff`** -- Graceful: INIT_SIGNOFF (with optional final commune) to Psyche first. Use for normal session end.
- **`/spt:force-stop`** -- Force: kills immediately. Use when unresponsive or need immediate kill.

## Envelope shape (Phase 23 v1.8)

As of v1.8 Phase 23, the init_signoff envelope carries a 5-field stamp (`machine`, `project`, `branch`, `head_sha`, `head_subject`) alongside `timestamp`.

```xml
<EVENT type="init_signoff" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="claude_skill_owl" branch="main" head_sha="abc123..." head_subject="subject line">Signoff initiated by Self...</EVENT>
```

With an optional final-commune body (when the signoff drop file is non-empty):

```xml
<EVENT type="init_signoff" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="claude_skill_owl" branch="main" head_sha="abc123..." head_subject="subject line">FINAL COMMUNE: ...body... | Signoff initiated by Self...</EVENT>
```

Outside a git repo (D-11), `branch`, `head_sha`, and `head_subject` are omitted entirely. The wrapper-side `type="init_signoff"` predicate is matched case-insensitively and ignores unknown attrs, so the new stamp fields are forward-compatible with older receivers. For drift detection on resume, see the `live` skill.
