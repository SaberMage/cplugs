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

## Messaging Command Reference

All three commands read the message body from **stdin** (pipe or heredoc).

```bash
# deliver — fire-and-forget to a target (use when you have your own perch)
$OWL deliver <target> <from> <<'EOF'
message body
EOF

# reply — respond to whoever messaged you (sugar for deliver with swapped arg names)
$OWL reply <sender> <my-id> <<'EOF'
response body
EOF

# send — deliver + create ephemeral reply perch + poll for reply (use when you have NO perch)
$OWL send <target> <from> <<'EOF'
message body
EOF
```

**When to use which:**
- **`deliver`**: You already have a listener. Fire-and-forget, no reply perch created.
- **`reply`**: You received a message and want to respond. Same as deliver, clearer intent.
- **`send`**: You have no listener. Creates a temporary perch, delivers, then polls for the reply.

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

**Important:** If you have an active listener perch, always launch Agent tool calls with `run_in_background: true`. Foreground agents block your poll loop — no messages (including replies to your send) can be delivered until the agent finishes.

When the response arrives, present it to the user. Responses arrive via one of three paths:
- **Background interject** -- the `$OWL send` background task completes with the reply.
- **Inline** -- if you used `--block`, the reply prints directly.
- **Hook-injected XML** -- if you are mid-tool-call, the reply appears as `<owl_messages>` XML in your tool call context. The `from` attribute is the sender.
