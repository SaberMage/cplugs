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

The `<id>` is a short, single-word identifier (e.g. `deployah`, `waffle`).

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

## First-time setup + poll (single call)

```bash
$OWL poll <id> [mode] --setup
```

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`).

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
   $OWL reply <sender-id> <my-id> <<'EOF'
   <response>
   EOF
   ```
   - **`--once`**: Run `/spt:listen-stop` after replying. Done.
7. Tell the user what happened and resume prior work.

## /spt:listen --reboot

Binary: `$OWL reboot <id>`

Quick restart for a listener. Reads current mode from info.json, stops gracefully, clears the perch, and outputs a `REBOOT_POLL_CMD=` line. Run that command with `run_in_background: true` to re-register.

---

## Listener Best Practices

### Propagate perches to subagents

When you have an active perch and spawn a non-Psyche subagent (via Agent tool):
1. **Assign an owl ID** using `{your-id}-{subagent-name}` convention.
2. **Instruct it to listen** -- include: "Run `/spt:listen <id>` as a background task."
3. **Instruct it to stop** -- include: "Run `$OWL stop <id>` before you return."

### Stay idle for fastest delivery

Messages arrive fastest when you are **idle** (not executing a tool call) -- the background poll delivers them instantly. When you are busy, messages still arrive via the PreToolUse hook but with slight delay (next tool call boundary).

- **Always launch Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely — no messages can be delivered until the agent finishes.
- **Launch work as background tasks** (`run_in_background: true`) when results aren't immediately needed.
- **Go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **Batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first

When your poll interjects with a new message, **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `[INCOMING OWL]` polls from subagents).
3. Then process the new message.

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
