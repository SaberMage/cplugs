---
name: revive
description: |
  Restart a live agent with new generation. Use when the user says "revive",
  "restart live agent", or wants to refresh a live agent's session.
argument-hint: "<id> [--period <seconds>] [--pulse-psyche]"
allowed-tools: [Bash, Read, Monitor]
---

# /spt:revive

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** For messaging commands, your identity is auto-detected from your session. The `revive` command itself requires an explicit ID (startup command).

```bash
$LIVE revive <id> [--period <seconds>] [--pulse-psyche]
```

Quick restart for a live agent. Kills existing wrapper, Psyche poll, and Self, then re-runs the live start flow with the same ID. Generation counter increments automatically.

> **8-minute default cadence + opt-in Psyche evaluation** (same default as `$LIVE start`). Bare `$LIVE revive <id>` now wakes the wrapper every **8 minutes (480s)**. By default the cadence wake fires ONLY the background echo-commune gate — the Psyche LLM is NOT prompted on routine cadence wakes. Pass `--pulse-psyche` to restore the legacy "Psyche LLM evaluates on every cadence wake" behavior. Pass `--period <seconds>` (minimum 60) to override the cadence; `--period 0` is accepted as an explicit no-cadence opt-out (disables the echo-gate cadence too). `--period <N>` for `N` in `1..=59` is rejected with `Minimum pulse period is 60 seconds (or 0 to disable)`. Legacy 20-minute Psyche-evaluating cadence: `$LIVE revive <id> --period 1200 --pulse-psyche`.

The REVIVE status includes the spacetime version. Mention this version when telling the user the agent has been revived.

## Messaging Command Reference

All three commands read the message body from **stdin** (pipe or heredoc).

```bash
# deliver -- fire-and-forget to a target (use when you have your own perch)
$OWL deliver <target> <<'EOF'
message body
EOF

# reply -- respond to whoever messaged you (sugar for deliver with swapped arg names)
$OWL reply <sender> <<'EOF'
response body
EOF

# send -- deliver + create ephemeral reply perch + poll for reply (use when you have NO perch)
$OWL send <target> <<'EOF'
message body
EOF
```

If auto-detection fails, pass your ID explicitly: `$OWL deliver <target> <your-id>`, `$OWL reply <sender> <your-id>`, `$OWL send <target> <your-id>`.

**When to use which:**
- **`deliver`**: You already have a listener. Fire-and-forget, no reply perch created.
- **`reply`**: You received a message and want to respond. Same as deliver, clearer intent.
- **`send`**: You have no listener. Creates a temporary perch, delivers, then polls for the reply.

After the revive background task launches, run `$LIVE psyche-download <id>` to retrieve prior context (pass the same ID you used in revive). Evaluate staleness and send a commune if needed.

**Agent-type guard:** Only works on live agents. If target is a plain listener, refuses with: "Only live agents can be revived."

### Primary (Monitor)

Run `$LIVE revive <id>` via the Monitor tool with:
- `command: "$LIVE revive <id>"`
- `persistent: true`
- `description: "« spt event »"`

The revive command kills existing wrapper, Psyche, and Self, then re-enters the poll loop inline. Under stream mode the listener stays alive across messages and emits one `<EVENT>` envelope line per delivery -- no re-register needed.

Do NOT run `$OWL poll` immediately after revive (it will reject with `DUPLICATE`).

### Fallback (Monitor unavailable)

Run `$LIVE revive <id>` via the Bash tool with:
- `run_in_background: true`
- `description: "« spt event »"`

After each delivered message the background task completes. Re-register with a fresh Bash background task:

```bash
$OWL poll <id> listen --live --once
```

Run with `run_in_background: true` and description `« spt event »`. Repeat after every message.

After revive, message handling follows the same dual-path protocol: messages arrive via Monitor stream (primary) or Bash one-shot (fallback) when idle, or via PreToolUse hook injection (when busy). See `/spt:listen` for full details on EVENT envelope parsing.

## Echo-commune brief (post-revive)

A revive at SessionStart may immediately surface an `<EVENT type="echo_commune" from="<your-id>-psyche">` brief — the haiku-summary echo-commune fired by your Psyche wrapper as part of the resume cycle (Phase 29 AUTO-EC). The body is wrapped in the Phase 25 D-10/D-11 two-slice envelope (`<live-context>` plus optionally `<project-context>`); absorb both slices as one continuous resume brief (D-25.1-05). See `/spt:live` for the full echo_commune envelope catalog entry and `/spt:listen` for body-parsing rules.

**Important:** While your perch is active, always launch Agent tool calls with `run_in_background: true`. Foreground agents block your poll loop -- no messages can be delivered until the agent finishes.
