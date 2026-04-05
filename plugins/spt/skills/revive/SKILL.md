---
name: revive
description: |
  Restart a live agent with new generation. Use when the user says "revive",
  "restart live agent", or wants to refresh a live agent's session.
argument-hint: <id> [--period <seconds>]
allowed-tools: [Bash, Read]
---

# /spt:revive

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE revive <id> [--period <seconds>]
```

Quick restart for a live agent. Kills existing wrapper, Psyche poll, and Self, then re-runs the live start flow with the same ID. Generation counter increments automatically.

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

After the revive background task launches, run `$LIVE psyche-download <id>` to retrieve prior context. Evaluate staleness and send a commune if needed.

**Agent-type guard:** Only works on live agents. If target is a plain listener, refuses with: "Only live agents can be revived."

Run revive with `run_in_background: true` and description `[INCOMING OWL]`. After revive, message handling follows the same dual-path protocol: messages arrive via background poll (when idle) or PreToolUse hook injection (when busy). See `/spt:listen` for full details.

**Important:** While your perch is active, always launch Agent tool calls with `run_in_background: true`. Foreground agents block your poll loop — no messages can be delivered until the agent finishes.
