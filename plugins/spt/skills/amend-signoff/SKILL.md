---
name: amend-signoff
description: |
  Patch Psyche context after signoff with additional notes. Use when you performed
  work after /spt:signoff and need to update the context for the next Psyche incarnation.
argument-hint: <message>
allowed-tools: [Bash]
---

# /spt:amend-signoff

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$LIVE amend-signoff "message"
```

If auto-detection fails: `$LIVE amend-signoff <your-id> "message"`

Patch Psyche's stored context file after signoff. The Psyche is gone, but the context file at `~/.claude/psyche-contexts/{self_id}.md` persists. This command appends a timestamped "Post-Signoff Amendment" section so the next Psyche incarnation inherits the updated context.

### Steps

1. **Read the current context first** -- run `$LIVE psyche-download` and compare what Psyche knows against what happened since signoff. Only amend with information that is missing or different.
2. **Run the amend command** with the delta:

```bash
$LIVE amend-signoff "Committed and pushed bugfixes for pending count and anonymous delivery after signoff."
```

The amendment is git-committed to the context repo for audit trail. Use this instead of manually editing the context file.
