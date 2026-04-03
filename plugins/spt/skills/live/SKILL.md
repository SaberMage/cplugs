---
name: live
description: |
  Start as a live Self agent with Psyche. Use when the user says "live as",
  "start live", "go live", or wants a persistent agent with Psyche companion.
argument-hint: <id> [--period <seconds>]
allowed-tools: [Bash, Read]
---

# /spt:live

All commands use `$OWL` and `$LIVE` env vars, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Live agent output is orange. Agents parse `TAG:value` tokens.

Starting a live agent is a single background task. The Psyche launches as an external process, then the command enters your poll loop.

## Step 1: Start in background

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

## Step 2: Retrieve Psyche context

After launching the background start task:

```bash
$LIVE psyche-download <id>
```

- If content is current, no action needed.
- If context has information you lack (e.g., after `/clear`), absorb it.
- If stale or missing recent work, send a commune to update Psyche.
- If `NO-CONTEXT`, both starting fresh.

## On message arrival

Follow the same message handling protocol as `/spt:listen`:
1. Parse `__REPLY_TO__:<sender-id>` from the first line.
2. Re-register poll FIRST.
3. Process the message.
4. Reply via `$OWL reply <sender-id> <my-id>`.

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
- **INSIGHT messages from Psyche**: `INSIGHT ({timestamp}): {observation}` -- high-priority observation about your work. Psyche only sends INSIGHTs for contradictions between stated intentions and actions, forgotten commitments, reasoning gaps, or extended time without progress. Read carefully and adjust if warranted. If the INSIGHT seems incorrect or confused, reply to clarify so you and your Psyche stay on the same page.
- **Generation tracking**: Each start/revive increments counter in `~/.claude/owlery/.psyche-gen-{id}`.

---

## Listener Best Practices

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
