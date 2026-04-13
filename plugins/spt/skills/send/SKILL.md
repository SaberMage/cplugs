---
name: send
description: |
  Send a message to another owl agent. Use when the user says "send to",
  "message", "tell <agent>", or wants to communicate with another agent.
argument-hint: <target> [--block]
allowed-tools: [Bash, Read]
---

# /spt:send

## MCP-First Messaging

The `spacetime_send` MCP tool is the primary way to send messages. It delivers a message to a target agent (fire-and-forget). The MCP server handles identity resolution, liveness checks, and delivery automatically.

Use MCP tools for all operations except the CLI-only command below.

## CLI-Only Command

### ring -- Send message and wait for reply

The `ring` command has no MCP equivalent because it blocks waiting for a reply (creates an ephemeral perch, delivers, and polls).

```bash
$OWL ring <target> <<'EOF'
message body
EOF
```

Run with `run_in_background: true` and `description: "[INCOMING OWL]"`. The command creates an ephemeral reply perch, delivers the message, and blocks until the target replies. Your identity is auto-detected from the session.

If auto-detection fails, pass your ID explicitly: `$OWL ring <target> <your-id>`

**When to use ring vs spacetime_send:**
- **`spacetime_send`** (MCP tool): Fire-and-forget delivery. Use when you have an active listener and will receive the reply via your poll loop or hook injection. No blocking.
- **`ring`** (CLI): Synchronous request-response. Use when you have no active listener and need to send a message and wait for the reply in one operation. Blocks until reply arrives.

## Pre-checks

- If `<target>` matches this agent's own ID, refuse. Self-sends create loops.
- All send commands verify the target is alive automatically -- no manual liveness check needed.

## On Response

When the response arrives (from `ring` background task or hook-injected XML), present it to the user.

**Important:** If you have an active listener perch, always launch Agent tool calls with `run_in_background: true`. Foreground agents block your poll loop -- no messages (including replies) can be delivered until the agent finishes.
