---
name: listen
description: |
  Start a background owl listener on a perch. Use when the user says "listen as",
  "start listening", or wants to receive inter-agent messages.
argument-hint: <id> [--reboot] [--block] [--once]
allowed-tools: [Bash, Read]
---

# /spt:listen

## MCP-First Messaging

MCP tools and resources are the primary interface for messaging in Claude Code sessions. The spacetime MCP server is auto-started by the plugin and provides:

**Tools:**
- `spacetime_send` -- send a message to a target agent
- `spacetime_list` -- list active perches
- `spacetime_whoami` -- show your current agent identity
- `spacetime_doctor` -- diagnose messaging health
- `spacetime_commune` -- send a communal update to your Psyche
- `spacetime_live_start` -- start as a live agent with Psyche
- `spacetime_live_stop` -- stop a live agent
- `spacetime_live_list` -- list live agents
- `spacetime_live_signoff` -- graceful live agent shutdown
- `spacetime_live_revive` -- restart a live agent
- `spacetime_live_list_psyches` -- list Psyche agents
- `spacetime_live_timed_pulse` -- schedule a timed reminder

**Resources:**
- `spt://inbox` -- your pending messages
- `spt://perches` -- active perch directory
- `spt://psyches` -- active Psyche agents
- `spt://context` -- your Psyche's stored context
- `spt://memformat` -- Psyche memory format template

Use MCP tools for all operations except the two CLI-only commands below.

## CLI-Only Commands

These commands have no MCP equivalent because they require blocking the process (long-running foreground/background tasks that wait for events).

### poll -- Blocking message listener

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

The `<id>` is a short, single-word identifier (e.g. `deployah`, `waffle`).

#### First-time setup + poll

```bash
$OWL poll <id> [mode] --setup
```

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`).

#### Re-poll

```bash
$OWL poll <id> [mode]
```

No `--setup` needed -- the perch already exists.

#### Common rules

Run with `run_in_background: true` and `description: "[INCOMING OWL]"`. Blocks until a message arrives, then outputs it.

- **Default**: Tell the user you're listening, then **return control immediately**. Handle the message when the background task interjects.
- **`--block`**: Tell the user you're waiting. Do nothing else until a message arrives.
- **`--once`**: Same as default, but after handling one message, run `/spt:listen-stop` instead of re-registering.

**When NOT to use poll:**
- Psyche agents must NOT use poll (the psyche wrapper handles message reception).
- In future capsule sessions (v1.9), message delivery uses sendkeys instead of poll.

## /spt:listen --reboot

```bash
$OWL reboot <id>
```

Quick restart for a listener. Reads current mode from info.json, stops gracefully, clears the perch, and outputs a `REBOOT_POLL_CMD=` line. Run that command with `run_in_background: true` to re-register.

## On Message Arrival

Messages arrive via TWO paths -- handle both identically:

### Path A: Background poll interject
The `$OWL poll` background task completes and outputs the message.
- Parse the first line: extract `<sender-id>` from `__REPLY_TO__:<sender-id>`. The rest is the message body.

### Path B: Hook-injected XML
When you are busy with a tool call, the PreToolUse hook delivers pending messages as XML in your tool call context:
```xml
<owl_messages>
<owl_message from="sender-id" priority="high">message body</owl_message>
</owl_messages>
```
- The `from` attribute IS the sender ID (no `__REPLY_TO__` parsing needed).
- The message body is inside the tag.
- You may receive a `[OWL SYSTEM - HIGHEST PRIORITY]` directive -- follow it.

### Wake Sentinels

A prompt starting with `--- [INCOMING]` triggers an immediate message check. This pattern is injected by capsule sendkeys delivery. If unread messages exist, they are injected into additionalContext as `<owl_message>` XML. If no messages are pending, you receive an explicit "no messages" notice.

### After receiving

1. If message body is `__EXIT__` -- run `/spt:listen-stop`.
2. **ALL responses go through reply** (use `spacetime_send` MCP tool or `$OWL reply`) -- including clarifying questions, status updates, errors, and partial results.
3. Follow steps 4-7 below in order.
4. **Re-register the poll FIRST** (Path A only -- if message arrived via hook, poll is still running).
   - **`--once`**: Skip -- you'll run `/spt:listen-stop` after replying.
   - **`--block`**: Re-register and wait again.
5. Process the message -- do whatever work is needed.
6. Reply:
   ```bash
   $OWL reply <sender-id> <<'EOF'
   <response>
   EOF
   ```
   - **`--once`**: Run `/spt:listen-stop` after replying. Done.
7. Tell the user what happened and resume prior work.

## Active Listener Checklist

REQUIRED -- these are not suggestions:
- [ ] Launch ALL Agent tool calls with `run_in_background: true` -- foreground agents block your poll loop entirely
- [ ] Go idle after launching background tasks -- idle gaps are when messages arrive instantly
- [ ] Check completed background tasks BEFORE processing new messages
- [ ] Batch independent work into parallel background tasks, not sequential foreground calls

## Active Listener Rules

### Stay idle

You MUST stay idle whenever possible. Idle means not executing a tool call -- the background poll delivers messages instantly during idle gaps. When you are busy, messages arrive via the PreToolUse hook but only at the next tool call boundary (delayed).

- **You MUST launch ALL Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **You MUST launch work as background tasks** (`run_in_background: true`) when results are not immediately needed.
- **You MUST go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **You MUST batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first

When your poll interjects with a new message, you MUST check background tasks **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `[INCOMING OWL]` polls from subagents).
3. Then process the new message.

## Session Auto-Resume

A SessionStart hook runs `$OWL session-resume` on every new session. If it finds a dead listener belonging to this session (matched by `parent_pid`), it outputs an `<owl-auto-resume>` XML tag.

When you see `<owl-auto-resume id="..." live="...">`:
1. Read the `id` and `live` attributes.
2. **Tell the user** you were previously running as `<id>` and ask to resume.
3. If confirmed, follow resume instructions inside the tag.
4. If declined, proceed normally.

**Do not resume automatically.** The tag informs -- the user decides.

After `/clear` or `/compact`, the SessionStart hook injects a `<spacetime-reorientation>` tag reminding you of your identity and active perch state. This ensures continuity across context resets.
