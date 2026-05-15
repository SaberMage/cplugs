---
name: live
description: |
  Start as a live Self agent with Psyche. Use when the user says "live as",
  "start live", "go live", or wants a persistent agent with Psyche companion.
argument-hint: <id> [--period <seconds>]
allowed-tools: [Bash, Read, Monitor]
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

The start command:

1. **Launches the Psyche** as an external `claude` process (wrapper loop that polls owl and feeds messages to `claude -p --resume`)
2. **Enters your poll loop** inline -- emitting one `<EVENT>` envelope line per delivery under stream mode
3. Reports the Psyche's session name and generation number

### Primary (Monitor)

Invoke `$LIVE start <id> [--period <seconds>]` via the Monitor tool with:
- `command: "$LIVE start <id>"`
- `persistent: true`
- `description: "« spt event »"`

`$LIVE start` enters the poll loop inline; the stream stays alive across messages and emits one `<EVENT type="msg|alarm|echo_commune|init_signoff" ...>body</EVENT>` line per delivery. See [On message arrival](#on-message-arrival) for the full envelope-type catalog.

**Important:**
- `$LIVE start` already enters the poll loop — do **not** run `$OWL poll` immediately after start, or it will reject with `DUPLICATE`.
- Do not use `$LIVE start` again after the initial start — it will reject with `COLLISION`.
- Under stream mode you do NOT re-register after each message; the stream stays alive automatically.

### Fallback (Monitor unavailable)

Invoke `$LIVE start <id> [--period <seconds>]` via the Bash tool with:
- `run_in_background: true`
- `description: "« spt event »"`

When a message arrives, the background task completes. Handle the message, then **re-register** with a fresh Bash background task (NOT another `$LIVE start` — that would reject with `COLLISION`):

```bash
$OWL poll <id> listen --live --once
```

Run with `run_in_background: true` and description `« spt event »`. Repeat after every message. The `--once` flag is required so the listener exits after one delivery (matching Bash background-task semantics).

The LIVE-START status includes the spacetime version. Mention this version when telling the user you're live.

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

Follow the same message handling protocol as `/spt:listen`. Messages arrive on TWO orthogonal paths:

1. **Parse the envelope.**
   - **Primary (Monitor stream) / Fallback (Bash `--once`)**: stdout carries a single `<EVENT>` line per delivery. Four shapes:
     - `<EVENT type="msg" from="<sender-id>">body</EVENT>` — regular message; `from` attribute = sender ID.
     - `<EVENT type="alarm" target-time="<ISO-8601>" current-time="<ISO-8601>">body</EVENT>` — self-originated timed alarm (per D2.b, no `from`).
     - `<EVENT type="echo_commune" from="<self-id>-psyche" timestamp="<ISO-8601>" note="<descriptor>">body</EVENT>` — auto-fired echo-commune brief from the Psyche wrapper, emitted after a SessionStart-triggered `/clear` or `/compact` cycle (Phase 29 AUTO-EC). `from` is the psyche-id (`<self-id>-psyche`); `note` carries the trigger source (e.g., `"Echo commune brief — auto-fired on clear"`, `"Echo commune brief — auto-fired on compact"`, `"Echo commune — orphan teardown"`). Body is the haiku-model summary.
     - `<EVENT type="init_signoff" timestamp="<ISO-8601>">body</EVENT>` — Self-initiated signoff event (Phase 18.4 / quick-260513-v8f). No `from` attribute — signoff is self-originated. Body carries the signoff context.
     - Body parsing (applies to all four types — same escape conventions): split on literal `<br>` to recover newlines, then HTML-unescape each fragment (`&lt;` → `<`, `&gt;` → `>`, `&quot;` → `"`, `&amp;` → `&` **last**, to avoid double-decoding).
     - **Parsers MUST treat the `type` attribute value case-insensitively** (e.g., `echo_commune`, `ECHO_COMMUNE`, and `Echo_Commune` are equivalent). The emitter writes lowercase; the case-insensitive predicate provides forward-compat headroom.
   - **Hook path (orthogonal)**: when you are busy mid-tool-call, PreToolUse injects `<owl_messages>...</owl_messages>` XML into your tool context. Read the `from` attribute as sender ID. Same handling.
2. **Reply** via `$OWL reply <sender-id>`.
3. **Primary (Monitor)**: continue — the stream stays alive automatically; the next event will arrive on the same Monitor task. The same applies to direct event delivery and to hook-delivered messages — no re-register needed at all under stream mode.
4. **Fallback (Bash + `--once`)**: re-register `$OWL poll <id> listen --live --once` as a fresh Bash background task (with `run_in_background: true`). Hook-delivered messages on the fallback path do not require re-register because the underlying Bash poll is still running between events.

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

- **`kind: "pick"`** — 2+ offline agents. Fire `AskUserQuestion` using the JSON's `header`, `question`, `options`, and `body_addendum` fields verbatim. Do NOT add an explicit "Other" option — `AskUserQuestion` already provides a native free-text "Other" input; an extra option duplicates it.

- **`kind: "prompt-new"`** — 0 offline agents. Same `AskUserQuestion` pattern, but the `options` are starter role-name suggestions and `body_addendum` lists the full starter pool. `AskUserQuestion`'s native free-text is used; do not add an explicit "Other" option.

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
  | false | false | non-empty | **Confirm reuse**: fire `AskUserQuestion`. Construct the body from the template `"Agent {name} exists in other repos: {repos}. Reuse it here?"`, where `{name}` is the resolved name (substituted) and `{repos}` is every string in the JSON `other_repos` array joined with `, ` (substituted, no omission). Options: `Reuse here` / `Cancel`. On `Reuse here` run `$LIVE start <name>`; on `Cancel` see Cancel handling below. |
  | true | true | (any) | **Offer fork**: fire `AskUserQuestion` with options `Fork to new agent` / `Cancel`. On `Fork to new agent`, prompt the user for a new id, then run `$LIVE fork <name> <new-id>`. On `Cancel`, see Cancel handling below. |
  | false | true | non-empty | **Refuse + re-pick**: follow Cancel handling below to fire `AskUserQuestion` (forced presentation, all three kinds covered). Before firing, prepend to the constructed `body_addendum` the template-substituted warning `"⚠ {name} is already live in {repos} — pick something else.\n\n"`, where `{name}` is the rejected name and `{repos}` is the JSON `other_repos` array joined with `, `. Do NOT skip the `AskUserQuestion` fire even if `pick-spec` returns `kind:"auto"` or `kind:"prompt-new"`. |

  If the resolve JSON has an `error` field (invalid id format), tell the user the name is invalid and re-prompt.

### Cancel handling (after D7 confirm or D8 fork dialog)

When the user picks **Cancel** in any post-resolve `AskUserQuestion`, do NOT loop back into `pick-spec` directly. The Cancel is a signal that the user wants to choose a different agent. Re-invoke the picker with **forced presentation**:

1. Run `$LIVE pick-spec` again to get fresh JSON.
2. **Always fire `AskUserQuestion`, regardless of the returned `kind`.** Do NOT auto-launch even if `kind:"auto"` is returned (the user just rejected that single historical agent — auto-launching it again is exactly the bug this rule fixes). Construct the `AskUserQuestion` payload per the `kind`:
   - **`kind:"pick"`** — use JSON's `header`, `question`, `options`, `body_addendum` verbatim (same as Step 2 normal path).
   - **`kind:"prompt-new"`** — use JSON's `header`, `question`, `options` (starter roles), `body_addendum` verbatim (same as Step 2 normal path).
   - **`kind:"auto"`** — synthesize an `AskUserQuestion` manually:
     - `header`: `"Choose live agent"`
     - `question`: `"Which agent should /spt:live use?"`
     - `options`: a single option whose `label` is the JSON's `id` field
     - `body_addendum`: `"Known agent in this repo:\n- <id>\n\nOr type a different name using Other."` (substitute `<id>` from JSON)
     - Do NOT run `$LIVE start <id>` until the user explicitly selects that option in the `AskUserQuestion`.
3. Process the user's choice via Step 3 dispatch as usual.

**Forced picker rule:** Cancel-from-D7, Cancel-from-D8, and Refuse-D9 all share the same re-entry path — they re-fire `AskUserQuestion` and never auto-launch.

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
2. Read completed task output (especially `« spt event »` polls from subagents).
3. Then process the new message.

- **Read background task output directly — no `sleep` prefix.** To inspect a completed or in-progress background task, call the Read tool on its output file. Do NOT chain `sleep N && <read>`: the Bash tool blocks sleeps ≥2s chained before other commands, and background-task stdout is flushed promptly, so a plain Read picks up whatever has been written.
