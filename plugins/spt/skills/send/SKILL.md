---
name: send
description: |
  Send a message to another owl agent. Use when the user says "send to",
  "message", "tell <agent>", or wants to communicate with another agent.
argument-hint: <target> <from> [--block]
allowed-tools: [Bash, Read]
---

# /spt:send

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Calling convention:** `$OWL send`, `$OWL deliver`, `$OWL reply` read message body from **stdin**:
> ```bash
> echo 'msg' | $OWL send <target> <from>
> # or heredoc:
> $OWL send <target> <from> <<'EOF'
> message body
> EOF
> ```

## Pre-checks

- If `<target>` matches this agent's own listener ID, refuse. Self-sends create loops.
- All send/deliver/reply commands verify the target is alive automatically.
- Determine your return address (`MY_ID`):
  1. **You ran `/spt:listen` earlier** -- your ID is that listener ID.
  2. **You sent earlier and already have a reply perch** -- reuse that `MY_ID`.
  3. **Neither** -- pick `MY_ID="reply-$$-$RANDOM"`.

## If you already have a listener (cases 1 or 2)

Just deliver -- no reply perch needed. Run **not** in background:

```bash
$OWL deliver <target> <MY_ID> <<'EOF'
<msg>
EOF
```

## If you have no listener (case 3)

The `send` subcommand creates an ephemeral reply perch, delivers, and polls for the reply. Run with `run_in_background: true` (or `false` for `--block`):

```bash
$OWL send <target> <MY_ID> <<'EOF'
<msg>
EOF
```

**Remember `MY_ID`** -- reuse it for subsequent sends.

## On response

When the response arrives (background interject or inline), present it to the user.
