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

The background task outputs the message directly. Read the background task output.

1. Parse the first line: extract `<sender-id>` from `__REPLY_TO__:<sender-id>`. The rest is the message body.
2. If message body is `__EXIT__` -- run `/spt:listen-stop`.
3. **ALL responses go through the reply** -- including clarifying questions, status updates, errors, and partial results. The sender is waiting for a reply via their inbox.
4. Follow steps 5-8 below in order.
5. **Re-register the poll FIRST** -- before replying, before telling the user, before anything else.
   - **`--once`**: Skip -- you'll run `/spt:listen-stop` after replying.
   - **`--block`**: Re-register and wait again.
6. Process the message -- do whatever work is needed.
7. Reply:
   ```bash
   $OWL reply <sender-id> <my-id> <<'EOF'
   <response>
   EOF
   ```
   - **`--once`**: Run `/spt:listen-stop` after replying. Done.
8. Tell the user what happened and resume prior work.

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

### Stay idle to stay reachable

Messages can only be delivered when you are **idle** -- not executing any tool call.

- **Launch work as background tasks** (`run_in_background: true`) when results aren't immediately needed.
- **Go idle after launching.** The idle gap is when messages get delivered.
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
