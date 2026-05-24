---
name: send
description: |
  Send a message to another owl agent. Use when the user says "send to",
  "message", "tell <agent>", or wants to communicate with another agent.
argument-hint: "<target> [--block]"
allowed-tools: [Bash, Read]
---

# /spt:send

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

## Messaging Command Reference

Both commands read the message body from **stdin** (pipe or heredoc).

```bash
# send -- fire-and-forget to a target (use when you have your own perch)
$OWL send <target> <<'EOF'
message body
EOF

# send --reply-to -- respond to whoever messaged you
$OWL send --reply-to <sender> [your-id] <<'EOF'
response body
EOF

# ask -- deliver + create ephemeral reply perch + poll for reply (use when you have NO perch)
$OWL ask <target> [from] <<'EOF'
message body
EOF
```

If auto-detection fails, pass your ID explicitly: `$OWL send <target> <your-id>`, `$OWL send --reply-to <sender> <your-id>`, `$OWL ask <target> <impromptu-id>`.

**When to use which:**
- **`send`**: You already have a listener. Fire-and-forget, no reply perch created.
- **`send --reply-to`**: You received a message and want to respond. Same as deliver, clearer intent.
- **`ask`**: You have no listener. Creates a temporary perch, delivers, then polls for the reply.

## Pre-checks

- If `<target>` matches this agent's own listener ID, refuse. Self-sends create loops.
- All send/reply-to/ask commands verify the target is alive automatically.

## If you already have a listener

Just send -- no reply perch needed. Run **not** in background:

```bash
$OWL send <target> <<'EOF'
<msg>
EOF
```

## If you have no listener

The `ask` subcommand creates an ephemeral reply perch, delivers, and polls for the reply. Run with `run_in_background: true` (or `false` for `--block`):

```bash
$OWL ask <target> <<'EOF'
<msg>
EOF
```

## On response

**Important:** If you have an active listener perch, always launch Agent tool calls with `run_in_background: true`. Foreground agents block your poll loop -- no messages (including replies to your send) can be delivered until the agent finishes.

When the response arrives, present it to the user. Responses arrive via one of three paths:
- **Background interject** -- the `$OWL ask` background task completes with the reply.
- **Inline** -- if you used `--block`, the reply prints directly.
- **Hook-injected XML** -- if you are mid-tool-call, the reply appears as `<owl_messages>` XML in your tool call context. The `from` attribute is the sender.
