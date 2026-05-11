---
name: live
description: |
  Start as a live Self agent with Psyche. Use when the user says "live as",
  "start live", "go live", or wants a persistent agent with Psyche companion.
argument-hint: <id> [--period <seconds>]
allowed-tools: [Bash, Read]
---

# /spt:live

All commands use `$OWL` and `$LIVE` env vars, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Live agent output is orange. Agents parse `TAG:value` tokens.

> **Identity auto-detection:** For messaging commands (deliver, reply, send, commune, signoff, etc.), your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails. Startup commands (`start`, `revive`) always require an explicit ID.

Starting a live agent is a single background task. The Psyche launches as an external process, then the command enters your poll loop.

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

## Step 1: Start in background

```bash
$LIVE start <id> [--period <seconds>]
```

Run with `run_in_background: true` and description `[INCOMING OWL]`. The start command:

1. **Launches the Psyche** as an external `claude` process (wrapper loop that polls owl and feeds messages to `claude -p --resume`)
2. **Enters your poll loop** inline -- blocking until a message arrives
3. Reports the Psyche's session name and generation number

The LIVE-START status includes the spacetime version. Mention this version when telling the user you're live.

When a message arrives, the background task completes. Handle the message, then **re-register**:

```bash
$OWL poll <id> listen --live
```

Run with `run_in_background: true` and description `[INCOMING OWL]`. Repeat after each message.

**Important:**
- `$LIVE start` already enters the poll loop — do **not** run `$OWL poll` immediately after start, or it will reject with `DUPLICATE`.
- Only use `$OWL poll` to **re-register** after handling a received message.
- Do not use `$LIVE start` again after the initial start — it will reject with `COLLISION`.

## Step 2: Retrieve Psyche context

After launching the background start task:

```bash
$LIVE psyche-download <id>
```

Pass the same `<id>` you used in `$LIVE start`. Auto-detection may fail during startup before the perch is fully registered.

- If content is current, no action needed.
- If context has information you lack (e.g., after `/clear`), absorb it.
- If stale or missing recent work, send a commune to update Psyche.
- If `NO-CONTEXT`, both starting fresh.

## On message arrival

Follow the same message handling protocol as `/spt:listen`:
1. Parse `__REPLY_TO__:<sender-id>` from the first line.
2. Re-register poll FIRST.
3. Process the message.
4. Reply via `$OWL reply <sender-id>`.

Messages may also arrive as `<owl_messages>` XML injected by the PreToolUse hook when you are mid-tool-call. Same handling: read the `from` attribute as sender ID, process, and reply. No re-register needed for hook-delivered messages (poll is still running).

---

## ID Recollection (no-arg `/spt:live`)

When the user says `/spt:live` with **no ID**, run the auto-pick flow.

### Step 1: Ask the picker for a spec

```bash
$LIVE pick-spec
```

This emits a single JSON object on stdout. Parse it and dispatch on the `kind` field.

### Step 2: Dispatch on `kind`

- **`kind: "auto"`** — exactly one offline agent in this repo's history. Run:
  ```bash
  $LIVE start <id>
  ```
  where `<id>` is the JSON's `id` field. Tell the user: *"Auto-launching `<id>` (only known agent in this repo)."*

- **`kind: "pick"`** — 2+ offline agents. Fire `AskUserQuestion` using the JSON's `header`, `question`, `options`, and `body_addendum` fields verbatim. Add a 4th option `Other (type a different name)` with free-text input.

- **`kind: "prompt-new"`** — 0 offline agents. Same `AskUserQuestion` pattern, but the `options` are starter role-name suggestions and `body_addendum` lists the full starter pool. 4th option is free-text as above.

### Step 3: Handle the user's choice

- **If the user picked one of the listed options** (`label` from the JSON), run:
  ```bash
  $LIVE start <picked-label>
  ```

- **If the user typed a name into the free-text field**, resolve it first:
  ```bash
  $LIVE pick-spec --resolve <name>
  ```
  The output JSON has fields `in_this_repo_history`, `live`, and `other_repos` (an array of repo basenames). Dispatch:

  | in_this_repo_history | live | other_repos | Action |
  |---|---|---|---|
  | true | false | (any) | **Silent reuse**: `$LIVE start <name>` |
  | false | false | empty | **Fresh init**: `$LIVE start <name>` |
  | false | false | non-empty | **Confirm reuse**: fire `AskUserQuestion` listing the repo basenames; on `Reuse here` run `$LIVE start <name>`; on `Cancel` go back to Step 2 |
  | true | true | (any) | **Offer fork**: fire `AskUserQuestion` with options `Fork to new agent` / `Cancel`. On fork, prompt the user for a new id, then run `$LIVE fork <name> <new-id>` |
  | false | true | non-empty | **Refuse**: re-fire the original picker (Step 2) with the body addendum prepended by `⚠ <name> is already live in <other-repo> — pick something else.` |

  If the resolve JSON has an `error` field (invalid id format), tell the user the name is invalid and re-prompt.

### Notes

- This flow REPLACES the old `sleep 10 [ID SELECT TIMER]` race. There is no auto-pick-on-timer.
- The `pick-spec` command is **read-only** — invoking it does not bump activity timestamps. Only `start`, `revive`, `commune`, `echo-commune`, and SessionStart re-attach do.
- The explicit-id path (`/spt:live <id>`) bypasses this flow entirely and behaves exactly as documented in Step 1 above.

---

## Edge Cases

- **Duplicate `/spt:live`**: Rejects with `COLLISION`. Check `/spt:list-live` first, or use `/spt:revive`.
- **Psyche process dies**: Perch becomes stale. `/spt:list-psyche` cleans it. Use `/spt:revive` to restart.
- **Psyche spawn failure**: Start command logs error but continues. Listener works without pulse nudges.
- **Pulse timer**: Integrated into `$OWL poll` via `--pulse-interval <seconds>`. Emits `PULSE_TRIGGER` on expiry.
- **Psyche messages to Self**: `PULSE ({timestamp}): {reminders}` -- contextual nudges, not commands.
- **INSIGHT messages from Psyche**: `INSIGHT ({timestamp}): {observation}` -- high-priority observation about your work. Psyche only sends INSIGHTs for contradictions between stated intentions and actions, forgotten commitments, reasoning gaps, or extended time without progress. Read carefully and adjust if warranted. If the INSIGHT seems incorrect or confused, reply to clarify so you and your Psyche stay on the same page.
- **Generation tracking**: Each start/revive increments a counter file inside the owlery dir (`{SPT_HOME}/owlery/.psyche-gen-{id}`); resolved at runtime by `owl.exe` via `owlery::owlery_dir()`.

---

## Listener Best Practices

### Stay idle for fastest delivery

Messages arrive fastest when you are **idle** (not executing a tool call) -- the background poll delivers them instantly. When you are busy, messages still arrive via the PreToolUse hook but with slight delay (next tool call boundary).

- **Always launch Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **Launch work as background tasks** (`run_in_background: true`) when results aren't immediately needed.
- **Go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **Batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first

When your poll interjects with a new message, **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `[INCOMING OWL]` polls from subagents).
3. Then process the new message.

- **Read background task output directly — no `sleep` prefix.** To inspect a completed or in-progress background task, call the Read tool on its output file. Do NOT chain `sleep N && <read>`: the Bash tool blocks sleeps ≥2s chained before other commands, and background-task stdout is flushed promptly, so a plain Read picks up whatever has been written.
