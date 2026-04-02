---
name: messaging
description: |
  Spacetime agent messaging for Claude Code. Commands: `/spt:listen`, `/spt:send`,
  `/spt:list-ready`, `/spt:listen-stop`, `/spt:live`, `/spt:commune`, `/spt:list-live`,
  `/spt:live-stop`. Use when the user says "listen as", "send to", "live agent",
  "live as", or any inter-agent communication task.
---

# Spacetime Agent Messaging

All messaging operations use `$OWL` and live agent operations use `$LIVE`. These environment variables are **auto-injected** by the spt plugin's SessionStart hook via `CLAUDE_ENV_FILE`. Always use `$OWL` and `$LIVE` -- never call the binary by path.

If a command fails with "command not found" or empty variable error, run `/spt:env-setup` as a manual fallback to write `OWL` and `LIVE` to `~/.claude/settings.json`.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Messaging output is cyan; live agent output is orange. Message content goes to **stdout**. Agents parse `TAG:value` tokens (e.g., `SENT:targetid`).

---

## Calling Convention

- **`$OWL send`, `$OWL deliver`, `$OWL reply`** read message body from **stdin**:
  ```bash
  echo 'msg' | $OWL send <target> <from>
  # or heredoc:
  $OWL send <target> <from> <<'EOF'
  message body
  EOF
  ```
- **`$LIVE` subcommands** (`commune`, `context-save`, `amend-signoff`) take message as **positional args**:
  ```bash
  $LIVE commune <id> "message text"
  ```

---

## Command Reference

| Command | Purpose |
|---|---|
| `/spt:listen <id>` | Start a background listener, interjects on message |
| `/spt:listen <id> --reboot` | Tear down and re-register a listener |
| `/spt:listen-stop <id>` | Stop a listener (if live agent, suggests `/spt:live-stop`) |
| `/spt:listen-stop --all` | Stop all listeners |
| `/spt:send <target> <from>` | Send a message (msg via stdin), async response |
| `/spt:send <target> <from> --block` | Send message, wait for response inline |
| `/spt:list-ready` | Show active listeners, clean stale ones |
| `/spt:list-live` | Show active live agents |
| `/spt:list-psyche` | Show Psyche processes |
| `/spt:live <id>` | Start as live Self agent with Psyche |
| `/spt:live <id> --period <s>` | Start with custom pulse period (default 1200s, min 60s) |
| `/spt:revive <id>` | Restart a live agent with new generation |
| `/spt:commune <id> <msg>` | Send communal update to your Psyche |
| `/spt:signoff <id>` | Graceful stop: STASH_FINAL to Psyche then teardown |
| `/spt:live-stop <id>` | Stop a live agent and its Psyche |
| `/spt:live-stop --all` | Stop all live agents |
| `/spt:clear-psyche <id>` | Clear Psyche context file |
| `/spt:env-setup` | Manual fallback: write OWL/LIVE to settings.json |

---

## `/spt:listen <id>`

The `<id>` is a short, single-word identifier (e.g. `deployah`, `waffle`).

### First-time setup + poll (single call)

```bash
$OWL poll <id> [mode] --setup
```

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`).

### Re-poll (after handling a message)

```bash
$OWL poll <id> [mode]
```

No `--setup` needed -- the perch already exists.

### Common rules

Run with `run_in_background: true` and `description: "[INCOMING OWL]"`. Blocks until a message arrives, then outputs it.

- **Default**: Tell the user you're listening, then **return control immediately**. Handle the message when the background task interjects.
- **`--block`**: Tell the user you're waiting. Do nothing else until a message arrives.
- **`--once`**: Same as default, but after handling one message, run `/spt:listen-stop` instead of re-registering.

### On message arrival

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

### `/spt:listen <id> --reboot`

Binary: `$OWL reboot <id>`

Quick restart for a listener. Reads current mode from info.json, stops gracefully, clears the perch, and outputs a `REBOOT_POLL_CMD=` line. Run that command with `run_in_background: true` to re-register.

---

## `/spt:send <target> <from>`

### Pre-checks

- If `<target>` matches this agent's own listener ID, refuse. Self-sends create loops.
- All send/deliver/reply commands verify the target is alive automatically.
- Determine your return address (`MY_ID`):
  1. **You ran `/spt:listen` earlier** -- your ID is that listener ID.
  2. **You sent earlier and already have a reply perch** -- reuse that `MY_ID`.
  3. **Neither** -- pick `MY_ID="reply-$$-$RANDOM"`.

### If you already have a listener (cases 1 or 2)

Just deliver -- no reply perch needed. Run **not** in background:

```bash
$OWL deliver <target> <MY_ID> <<'EOF'
<msg>
EOF
```

### If you have no listener (case 3)

The `send` subcommand creates an ephemeral reply perch, delivers, and polls for the reply. Run with `run_in_background: true` (or `false` for `--block`):

```bash
$OWL send <target> <MY_ID> <<'EOF'
<msg>
EOF
```

**Remember `MY_ID`** -- reuse it for subsequent sends.

### On response

When the response arrives (background interject or inline), present it to the user.

---

## `/spt:list-ready`

```bash
$OWL list
```

Shows active listeners with pending message count. Automatically cleans stale perches.

---

## `/spt:listen-stop <id>`

```bash
$OWL stop <id>
$OWL stop --all
```

If target is a **live agent** (has `live:true` in info.json), output suggests using `/spt:live-stop` instead. See [Agent-Type-Aware Fallback](#agent-type-aware-fallback).

If you don't know the ID, check via `/spt:list-ready` and stop those with `"mode":"listen"` or `"mode":"wait"`. Don't stop `"mode":"once"` -- they self-clean.

---

## `/spt:live <id>`

Starting a live agent is a single background task. The Psyche launches as an external process, then the command enters your poll loop.

### Step 1: Start in background

```bash
$LIVE start <id> [--period <seconds>]
```

Run with `run_in_background: true` and description `[INCOMING OWL]`. The start command:

1. **Launches the Psyche** as an external `claude` process (wrapper loop that polls owl and feeds messages to `claude -p --resume`)
2. **Enters your poll loop** inline -- blocking until a message arrives
3. Reports the Psyche's session name and generation number

When a message arrives, the background task completes. Handle the message, then **re-register**:

```bash
$OWL poll <id> listen --live
```

Run with `run_in_background: true` and description `[INCOMING OWL]`. Repeat after each message.

**Important:** Only use `$LIVE start` for the initial start. To re-register after handling a message, use `$OWL poll` directly -- `$LIVE start` will reject with `COLLISION`.

### Step 2: Retrieve Psyche context

After launching the background start task:

```bash
$LIVE psyche-download <id>
```

- If content is current, no action needed.
- If context has information you lack (e.g., after `/clear`), absorb it.
- If stale or missing recent work, send a commune to update Psyche.
- If `NO-CONTEXT`, both starting fresh.

---

## `/spt:revive <id>`

```bash
$LIVE revive <id> [--period <seconds>]
```

Quick restart for a live agent. Kills existing wrapper, Psyche poll, and Self, then re-runs `/spt:live` with the same ID. Generation counter increments automatically.

After the revive background task launches, run `$LIVE psyche-download <id>` to retrieve prior context. Evaluate staleness and send a commune if needed.

**Agent-type guard:** Only works on live agents. If target is a plain listener, refuses. See [Agent-Type-Aware Fallback](#agent-type-aware-fallback).

---

## `/spt:commune <id> <msg>`

```bash
$LIVE commune <id> <msg>
```

Send a communal update to your Psyche (Self agents only). Read `commune.md` for the full commune protocol -- when to send, what to include, and diligence triggers.

**Agent-type guard:** Only works on live agents. If target is not live, refuses with explanation. See [Agent-Type-Aware Fallback](#agent-type-aware-fallback).

---

## `/spt:signoff <id>`

```bash
$LIVE signoff <id> [true|false]
```

Graceful shutdown. If second argument is `true`, sends STASH_FINAL commune to Psyche before teardown so Psyche can do a final context save. Then tears down both Self and Psyche perches.

**Signoff vs Stop:**
- **`/spt:signoff`** -- Graceful: STASH_FINAL to Psyche first. Use for normal session end.
- **`/spt:live-stop`** -- Force: kills immediately. Use when unresponsive or need immediate kill.

---

## `/spt:live-stop <id>`

```bash
$LIVE stop <id>
$LIVE stop --all
```

Stops a live agent **and its Psyche**. The stop sequence:
1. Kills the Psyche wrapper process (and child claude/poll processes)
2. Removes Psyche's perch files and wrapper PID file
3. Stops Self via `$OWL stop`

If target is a **plain listener** (not live), output suggests using `/spt:listen-stop` instead. See [Agent-Type-Aware Fallback](#agent-type-aware-fallback).

### `/spt:live-stop --all`

Stops **all** live agents and their Psyches. Also cleans orphaned wrapper PID files.

---

## `/spt:list-live`

```bash
$LIVE list
```

Shows active live agents (those with `live:true` in info.json). Cleans stale entries. Psyche agents not shown -- use `/spt:list-psyche`.

---

## `/spt:list-psyche`

```bash
$LIVE list-psyches
```

Shows Psyche agents (those with `psyche:true` in info.json). Intended for the user, Self agents checking Psyche status, and Touch (health checker).

---

## `/spt:clear-psyche <id>`

```bash
$LIVE clear-psyche <id>
```

Deletes stored Psyche context at `~/.claude/psyche-contexts/{id}.md`. Use when a Self agent is permanently stopped and context is no longer needed.

---

## `/spt:env-setup`

```bash
$OWL env-setup
```

Manual fallback for environments where `CLAUDE_ENV_FILE` is broken (known issues: `anthropics/claude-code#16564` VSCode extension, `anthropics/claude-code#19357` CLAUDE_ENV_FILE inconsistency). Writes `OWL` and `LIVE` env vars directly to `~/.claude/settings.json`.

This is **not** needed in normal operation -- the plugin's SessionStart hook handles env injection automatically. Only use if commands fail with "command not found" after plugin installation.

---

## Agent-Type-Aware Fallback

Commands know which agent type they apply to. Wrong type produces a helpful redirect:

| Command | On wrong type | Suggestion |
|---|---|---|
| `/spt:listen-stop <id>` | Target is live agent | "Use `/spt:live-stop <id>` instead" |
| `/spt:live-stop <id>` | Target is plain listener | "Use `/spt:listen-stop <id>` instead" |
| `/spt:revive <id>` | Target is not live | Refuses: "Only live agents can be revived" |
| `/spt:commune <id> <msg>` | Target is not live | Refuses: "Communes require a live agent with Psyche" |

The binary checks `info.json` for the `live:true` flag to determine agent type.

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

---

## ID Recollection

When the user says `/spt:live` with **no ID**:
1. Read `.claude/LIVE_AGENT_IDS.json` from the project root (format: `{"ids":["waffle","scout"],"last_used":"waffle"}`)
2. Check active IDs via `/spt:list-live`
3. Present unused IDs as a numbered list
4. Start `sleep 10` background task with description `[ID SELECT TIMER]`
5. **Race**: user responds before timer -- use their choice; timer fires -- auto-select topmost unused ID
6. If all active, generate a new short single-word ID
7. On new ID, update `.claude/LIVE_AGENT_IDS.json`

---

## Edge Cases

- **Duplicate `/spt:live`**: Rejects with `COLLISION`. Check `/spt:list-live` first, or use `/spt:revive`.
- **Psyche process dies**: Perch becomes stale. `/spt:list-psyche` cleans it. Use `/spt:revive` to restart.
- **Psyche spawn failure**: Start command logs error but continues. Listener works without pulse nudges.
- **Pulse timer**: Integrated into `$OWL poll` via `--pulse-interval <seconds>`. Emits `PULSE_TRIGGER` on expiry.
- **Psyche messages to Self**: `PULSE ({timestamp}): {reminders}` -- contextual nudges, not commands.
- **Generation tracking**: Each start/revive increments counter in `~/.claude/owlery/.psyche-gen-{id}`.
