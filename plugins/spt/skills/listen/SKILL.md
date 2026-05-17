---
name: listen
description: |
  Start a background owl listener on a perch. Use when the user says "listen as",
  "start listening", or wants to receive inter-agent messages.
argument-hint: "<id> [--reboot] [--block] [--once]"
allowed-tools: [Bash, Read, Monitor]
---

# /spt:listen

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Message content goes to **stdout** (one `<EVENT>` line per delivery under stream mode). Agents parse `TAG:value` tokens on stderr and `<EVENT>` envelopes on stdout.

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

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`). Under stream mode (default, no `--once`) the listener stays alive across messages and emits one `<EVENT>` envelope line per delivery to stdout.

The binary reports its version in the READY status line (e.g., `READY:myid (spt v0.1.0)`). Mention this version when telling the user you're listening.

## Re-poll (after handling a message)

### Primary (Monitor stream)

No re-register needed. Under stream mode the Monitor task running `$OWL poll <id>` stays alive across messages and emits one `<EVENT>` envelope line per delivery. Continue idling; the next event will arrive on the same stream.

### Fallback (Bash + `--once`)

If the Monitor tool is unavailable and you are running via Bash `run_in_background: true` with `--once`, the background task exits after each delivered message. You MUST re-register with:

```bash
$OWL poll <id> [mode] --once
```

Run with `run_in_background: true` and `description: "« spt event »"`. Omit `--setup` -- the perch already exists.

## Common rules

### Primary (Monitor)

Invoke `$OWL poll <id> [mode] [--setup]` via the Monitor tool with:
- `command: "$OWL poll <id> [mode] [--setup]"`
- `persistent: true`
- `description: "« spt event »"`

Each delivered event arrives as a single stdout line containing one `<EVENT>` envelope. The stream stays alive across messages -- you do NOT re-register after each event.

### Fallback (Bash)

Invoke `$OWL poll <id> [mode] --once` via the Bash tool with:
- `run_in_background: true`
- `description: "« spt event »"`

Append `--once` to the command. The background task exits after the first message -- re-register per the [Fallback section above](#fallback-bash---once) after every event.

- **Default**: Tell the user you're listening, then **return control immediately**. Handle the message when the background task interjects.
- **`--block`**: Tell the user you're waiting. Do nothing else until a message arrives.
- **`--once`**: Same as default, but after handling one message, run `/spt:listen-stop` instead of re-registering. This is the legacy one-shot mode; Bash fallback callers must pass `--once` explicitly.

## Active Listener Checklist

REQUIRED -- these are not suggestions:
- [ ] Launch ALL Agent tool calls with `run_in_background: true` -- foreground agents block your poll loop entirely
- [ ] Go idle after launching background tasks -- idle gaps are when messages arrive instantly
- [ ] Check completed background tasks BEFORE processing new messages
- [ ] Batch independent work into parallel background tasks, not sequential foreground calls

## On message arrival

Messages arrive via TWO orthogonal paths -- handle both identically:

### Path A (primary): Monitor stream EVENT envelope

Your Monitor-tool task running `$OWL poll <id>` emits one stdout line per delivery. Four envelope shapes:

**Regular message:**
```
<EVENT type="msg" from="<sender-id>">body</EVENT>
```
- `from` attribute = sender ID (no `__REPLY_TO__` parsing needed).
- Body is between the tags.

**Self-originated timed alarm:**
```
<EVENT type="alarm" target-time="<ISO-8601 target>" current-time="<ISO-8601 fire>">body</EVENT>
```
- No `from` attribute -- alarm is self-originated.
- `target-time` = when the alarm was scheduled to fire (ISO-8601).
- `current-time` = the instant the listener actually fired it (ISO-8601). Drift = current − target.
- Body is the alarm message text.

**Auto-fired echo-commune brief (Phase 29 AUTO-EC):**
```
<EVENT type="echo_commune" from="<self-id>-psyche" timestamp="<ISO-8601>" note="<descriptor>">body</EVENT>
```
- `from` = psyche-id (`<self-id>-psyche`) — the Psyche wrapper authored the brief.
- `timestamp` = ISO-8601 instant the brief was composed.
- `note` carries the trigger source: `"Echo commune brief — auto-fired on clear"`, `"Echo commune brief — auto-fired on compact"`, or `"Echo commune — orphan teardown"`.
- Body is the haiku-model summary of recent COMMUNE activity. Receivers (Self listeners + Psyche-inbox absorption) parse it identically to other envelopes.

**Self-initiated signoff:**
```
<EVENT type="init_signoff" timestamp="<ISO-8601>">body</EVENT>
```
- No `from` attribute -- signoff is self-originated (Phase 18.4 / quick-260513-v8f).
- `timestamp` = ISO-8601 instant the signoff was emitted.
- Body carries the signoff context (final context-save trigger for the Psyche wrapper).

**Body parsing rules (apply to ALL four envelopes):**
1. Split the body on the literal `<br>` token to recover newlines.
2. HTML-unescape each fragment in this order: `&lt;` → `<`, then `&gt;` → `>`, then `&quot;` → `"`, then `&amp;` → `&` **last** (so embedded `&amp;lt;` sequences don't double-decode into `<`).

**Parsers MUST treat the `type` attribute value case-insensitively** (e.g., `echo_commune`, `ECHO_COMMUNE`, and `Echo_Commune` are equivalent). The emitter writes lowercase; the case-insensitive predicate provides forward-compat headroom.

The stream stays alive across deliveries -- do not re-register.

### Path A (fallback): Bash `--once` EVENT envelope

If you launched via the Bash fallback with `--once`, you receive the **same** `<EVENT>` envelope on stdout (per the wire-format invariant: `--once` is purely an exit gate, not a format gate). Parse it identically to the primary path above. The only difference: the process exits after one event, so you MUST re-register a fresh background task (see [Common rules / Fallback](#fallback-bash)).

### Path B (orthogonal): Hook-injected XML
When you are busy with a tool call, the PreToolUse hook drains pending messages and injects them as XML in your tool call context:
```xml
<owl_messages>
<owl_message from="sender-id" priority="high">message body</owl_message>
</owl_messages>
```
- The `from` attribute IS the sender ID (no `__REPLY_TO__` parsing needed).
- The message body is inside the tag.
- You may receive a `[OWL SYSTEM - HIGHEST PRIORITY]` directive -- follow it.

### After receiving (any path)
1. If message body is `__EXIT__` -- run `/spt:listen-stop`.
2. **ALL responses go through reply** -- including clarifying questions, status updates, errors, and partial results.
3. Reply:
   ```bash
   $OWL reply <sender-id> <<'EOF'
   <response>
   EOF
   ```
   If auto-detection fails, pass your ID explicitly: `$OWL reply <sender-id> <my-id>`
4. **Primary (Monitor stream)**: Continue -- the stream stays alive automatically; the next event will arrive on the same Monitor task.
5. **Fallback (Bash `--once`)**: Re-register the same command (with `--once`) as a fresh background task. If the original was `--block`, re-register and wait again. If the original was the explicit one-shot `--once` flow, run `/spt:listen-stop` instead.
6. Tell the user what happened and resume prior work.

## /spt:listen --reboot

The reboot flow is now its own skill -- see `plugin/spt/skills/reboot/SKILL.md` (extracted per D8, Phase 27). Use `/spt:reboot <id>` to restart a listener.

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
2. Read completed task output (especially `« spt event »` polls from subagents).
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
