---
name: listen
description: |
  Start a background owl listener on a perch. Use when the user says "listen as",
  "start listening", or wants to receive inter-agent messages.
argument-hint: <id> [--reboot] [--block] [--once]
allowed-tools: [Bash, Read]
---

# /spt:listen

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Message content goes to **stdout**. Agents parse `TAG:value` tokens.

> **Identity auto-detection:** Your identity is auto-detected from your session for messaging commands. Pass your ID explicitly only if auto-detection fails.

The `<id>` is a short, single-word identifier (e.g. `deployah`, `waffle`).

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

## First-time setup + poll (single call)

```bash
$OWL poll <id> [mode] --setup
```

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`).

The binary reports its version in the READY status line (e.g., `READY:myid (spt v0.1.0)`). Mention this version when telling the user you're listening.

## Re-poll (after handling a message)

```bash
$OWL poll <id> [mode]
```

No `--setup` needed -- the perch already exists.

## Common rules

Run with `run_in_background: true` and `description: "[INCOMING OWL]"`. Blocks until a message arrives, then outputs it.

- **Default**: Tell the user you're listening, then **return control immediately**. Handle the message when the background task interjects.
- **`--block`**: Tell the user you're waiting. Do nothing else until a message arrives.
- **`--once`**: Same as default, but after handling one message, run `/spt:listen-stop` instead of re-registering.

## Active Listener Checklist

REQUIRED -- these are not suggestions:
- [ ] Launch ALL Agent tool calls with `run_in_background: true` -- foreground agents block your poll loop entirely
- [ ] Go idle after launching background tasks -- idle gaps are when messages arrive instantly
- [ ] Check completed background tasks BEFORE processing new messages
- [ ] Batch independent work into parallel background tasks, not sequential foreground calls

## On message arrival

Messages arrive via TWO paths -- handle both identically:

### Path A: Background poll interject
The `$OWL poll` background task completes and outputs the message.
- Parse the first line: extract `<sender-id>` from `__REPLY_TO__:<sender-id>`. The rest is the message body.

### Path B: Hook-injected XML
When you are busy with a tool call, the PreToolUse hook drains pending messages and injects them as XML in your tool call context:
```xml
<owl_messages>
<owl_message from="sender-id" priority="high">message body</owl_message>
</owl_messages>
```
- The `from` attribute IS the sender ID (no `__REPLY_TO__` parsing needed).
- The message body is inside the tag.
- You may receive a `[OWL SYSTEM - HIGHEST PRIORITY]` directive -- follow it.

### After receiving (either path)
1. If message body is `__EXIT__` -- run `/spt:listen-stop`.
2. **ALL responses go through reply** -- including clarifying questions, status updates, errors, and partial results.
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
   If auto-detection fails, pass your ID explicitly: `$OWL reply <sender-id> <my-id>`
   - **`--once`**: Run `/spt:listen-stop` after replying. Done.
7. Tell the user what happened and resume prior work.

## /spt:listen --reboot

Binary: `$OWL reboot <id>`

Quick restart for a listener. Reads current mode from info.json, stops gracefully, clears the perch, and outputs a `REBOOT_POLL_CMD=` line. Run that command with `run_in_background: true` to re-register.

---

## Active Listener Rules

### Stay idle -- this is mandatory

You MUST stay idle whenever possible. Idle means not executing a tool call -- the background poll delivers messages instantly during idle gaps. When you are busy, messages arrive via the PreToolUse hook but only at the next tool call boundary (delayed).

- **You MUST launch ALL Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **You MUST launch work as background tasks** (`run_in_background: true`) when results are not immediately needed.
- **You MUST go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **You MUST batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first -- required

When your poll interjects with a new message, you MUST check background tasks **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `[INCOMING OWL]` polls from subagents).
3. Then process the new message.

- **Read background task output directly — no `sleep` prefix.** To inspect a completed or in-progress background task, call the Read tool on its output file. Do NOT chain `sleep N && <read>`: the Bash tool blocks sleeps ≥2s chained before other commands, and background-task stdout is flushed promptly, so a plain Read picks up whatever has been written.

---

## Session Auto-Resume

A SessionStart hook runs `$OWL session-resume` on every new session. If it finds a dead listener belonging to this session (matched by `parent_pid`), it outputs an `<owl-auto-resume>` XML tag.

When you see `<owl-auto-resume id="..." live="...">`:
1. Read the `id` and `live` attributes.
2. **Tell the user** you were previously running as `<id>` and ask to resume.
3. If confirmed, follow resume instructions inside the tag.
4. If declined, proceed normally.

**Do not resume automatically.** The tag informs -- the user decides.

**After resuming:** Your perch is active again. From this point, always launch Agent tool calls with `run_in_background: true` so your poll loop stays unblocked and messages can be delivered.
