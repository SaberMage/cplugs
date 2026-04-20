---
name: amend-signoff
description: |
  Patch Psyche context after signoff with additional notes. Use when you performed
  work after /spt:signoff and need to update the context for the next Psyche incarnation.
argument-hint: <your-id> <message>
allowed-tools: [Bash]
---

# /spt:amend-signoff

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Always pass your agent_id explicitly.** This command is almost exclusively used after the perch is offline (signed off or stopped). Auto-detection resolves by environment/ready-file and will pick the wrong identity (e.g. a subagent working-perch) when the real perch's `ready` file is gone.

```bash
$LIVE amend-signoff <your-id> "message"
```

Patch Psyche's stored context file after signoff. The Psyche is gone, but the context file at `{SPT_HOME}/psyches/tracked/{self_id}.md` persists. This command appends a timestamped "Post-Signoff Amendment" section so the next Psyche incarnation inherits the updated context.

### Steps

1. **Read the current context first** -- run `$LIVE psyche-download <your-id>` and compare what Psyche knows against what happened since signoff. Only amend with information that is missing or different.
2. **Run the amend command** with your id and the delta:

```bash
$LIVE amend-signoff doyle "Committed and pushed bugfixes for pending count and anonymous delivery after signoff."
```

The amendment is git-committed to the context repo for audit trail. Use this instead of manually editing the context file.
