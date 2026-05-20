---
name: commune
description: |
  Send a communal update to your Psyche. Use when the user says "commune",
  "update psyche", or wants to sync context with their Psyche companion.
argument-hint: ""
allowed-tools: [Bash, Read, Write]
---

# /spt:commune

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

## Flow

1. **Download current Psyche context** to see what Psyche already knows:
   ```bash
   $LIVE psyche-download <your-id>
   ```

2. **Compare** the downloaded context against your current knowledge. Identify what's missing or stale -- new work completed, decisions made, context shifts, intentions formed since the last commune. If the download includes a `<memformat>` section, use it as a guide for what topics to cover in your commune. The download output may also include a `## Pending Commune (uncommitted)` section if a previous commune is still in flight -- that body is queued for the next Psyche consume and you do NOT need to re-send it.

3. **Commune only the delta** -- use the **Write tool** to create
   `.claude/{your-id}-commune.md` with the delta body as its contents.
   Do not use Bash/heredoc -- Write is the canonical path: no shell escaping,
   no `EOF` collision risk, and Write auto-creates the `.claude/` parent
   directory.

   Your Self listener detects the file on its next poll iteration, notifies
   your Psyche wrapper, and the wrapper ingests the content via the existing
   Psyche session. On success (subprocess exit code 0) the wrapper deletes the
   file. On error (token rate limit, etc) the file is retained and retried on
   the next consume cycle. If you write again before the wrapper consumes, the
   latest write wins (last-write-wins overwrite semantics).

If Psyche's context is already current, no commune is needed. Say so and move on.

Read `commune.md` (in this skill directory) for the full commune protocol -- when to send, what to include, and diligence triggers.

**Agent-type guard:** Only works on live agents. If target is not live, refuses with: "Communes require a live agent with Psyche."

## Envelope shape (Phase 23 v1.8)

As of v1.8 Phase 23, commune deliveries are wrapped in a typed EVENT envelope carrying a 5-field stamp (`machine`, `project`, `branch`, `head_sha`, `head_subject`); the prose `COMMUNE (timestamp): body` form is gone.

```xml
<EVENT type="commune" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="claude_skill_owl" branch="main" head_sha="abc123..." head_subject="subject line capped at 72 chars">body</EVENT>
```

Outside a git repo (D-11), `branch`, `head_sha`, and `head_subject` are omitted entirely (not empty-string-set):

```xml
<EVENT type="commune" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="cwd-basename">body</EVENT>
```

`$LIVE commune` composes this envelope automatically — Self does NOT manually construct EVENT XML. The wrapper-side parser ignores unknown attrs, so the stamp fields are forward-compatible with older receivers. For drift detection on resume, see the `live` skill.
