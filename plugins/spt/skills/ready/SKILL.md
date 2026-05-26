---
name: ready
description: |
  Enable inter-agent messaging for the current session.
  Use when the user says "listen as", "ready as", or wants to receive inter-agent messages.
argument-hint: "<id> [--reboot] [--block] [--once]"
allowed-tools: [Bash, Read, Monitor]
---

# /spt:ready

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Message content goes to **stdout** (one `<EVENT>` line per delivery under stream mode). Agents parse `TAG:value` tokens on stderr and `<EVENT>` envelopes on stdout.

> **Identity auto-detection:** Your identity is auto-detected from your session for messaging commands. Pass your ID explicitly only if auto-detection fails.

Starting a ready agent session is a single background task. From then on, the ready agent id becomes your name.

## Messaging Command Reference

All three commands read the message body from **stdin** (pipe or heredoc).

```bash
# send -- fire-and-forget to a target (use when you have an active session)
$OWL send <target> <<'EOF'
message body
EOF

# send --reply-to -- respond to whoever messaged you
$OWL send --reply-to <sender> <<'EOF'
response body
EOF

# ring -- send and wait for reply (alias: ask)
$OWL ring <target> <<'EOF'
message body
EOF
```

If auto-detection fails, pass your ID explicitly: `$OWL send <target> <your-id>`, `$OWL send --reply-to <sender> <your-id>`, `$OWL ring <target> <your-id>`.

**When to use which:**
- **`send`**: Fire-and-forget message to a target.
- **`send --reply-to`**: You received a message and want to respond. `from` is auto-set from the original sender.
- **`ring`**: Send and wait for reply. Creates a temporary perch if you have no listener.

## First-time setup + poll (single call)

```bash
$OWL poll <id> [mode] --setup
```

The `--setup` flag creates the perch (inbox, ready file) before polling. Use on the **first** call. Mode: `listen` (default), `wait` (for `--block`), `once` (for `--once`). Under stream mode (default, no `--once`) the listener stays alive across messages and emits one `<EVENT>` envelope line per delivery to stdout.

### Invocation (Monitor)

Invoke `$OWL poll <id> --setup` via the Monitor tool with:
- `command: "$OWL poll <id> --setup"`
- `persistent: true`
- `description: "« spt event »"`

`$OWL poll` enters the poll loop inline; the stream stays alive across messages and emits one `<EVENT type="msg" ...>body</EVENT>` line per delivery. See [On message arrival](#on-message-arrival) for the full envelope-type catalog.

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
- `from` attribute = sender ID.
- Body is between the tags.

**Chunked deliveries (EVENT-PART):**

Bodies exceeding the per-event display cap (~500 chars on the Claude Code Monitor harness) arrive as **N consecutive lines** of shape:

```
<EVENT-PART seq="K/M" id="<8-hex-nonce>" [type="..." from="..." timestamp="..." note="..."]>chunk-of-body</EVENT-PART>
```

- `seq="K/M"` — 1-indexed sequence; K runs 1..M; M is the total part count.
- `id="<8-hex-nonce>"` — short hex id (8 chars from `next_event_part_id` in `src/owl/poll.rs`) that groups parts of one logical event. Appears on EVERY part.
- The original envelope attributes (`type`, `from`, `timestamp`, `note` — whichever applied to the un-chunked envelope) appear **ONLY on `seq="1/M"`**. Subsequent parts (K>1) carry only `seq` and `id` to save bytes.

**Reassembly rules (REQUIRED):**

1. Collect all parts sharing the same `id`. Order them by the numerator of `seq` (K). Verify the count of parts equals the denominator (M).
2. Concatenate the chunk contents in seq order (K=1, K=2, …, K=M) to recover the **escaped** body.
3. Apply the existing body parsing rules (split on `<br>`, then HTML-unescape `&lt;`/`&gt;`/`&quot;`/`&amp;` LAST) to the **reassembled** body — never to individual chunks. An escape sequence like `&amp;` may straddle a chunk boundary; the chunker does not align boundaries to escape edges.
4. Then process the message as if it had arrived as a single `<EVENT type="<seq-1-type>" ...>reassembled-body</EVENT>` envelope (regular msg, alarm, echo_commune, file_drop, or init_signoff per the seq=1 `type` attribute).

**Orphan-part rule:** If `seq="K/M"` arrives **without** a matching `seq="1/M"` carrying the same `id` (because earlier parts were lost across a session boundary, listener restart, or binary handoff), **drop the orphan parts silently**. Do NOT attempt partial delivery — a truncated body is worse than no body. Optionally surface a single stderr-side warning for diagnostics.

If `N...[end]` EVENT-PARTs are missing, you must use the Task Output tool to check for the rest.

**Adjacency assumption:** In Monitor stream mode all parts of one `id` are emitted in a single `println!` loop on the sender side with no thread sleep between them — they arrive within a few hundred ms. A receiver that has buffered some parts with the same `id` for ≥5 seconds without seeing all M can safely treat the missing parts as orphaned.

**Body parsing rules (apply to ALL four envelopes AND to reassembled EVENT-PART bodies):**
1. Split the body on the literal `<br>` token to recover newlines.
2. HTML-unescape each fragment in this order: `&lt;` → `<`, then `&gt;` → `>`, then `&quot;` → `"`, then `&amp;` → `&` **last** (so embedded `&amp;lt;` sequences don't double-decode into `<`).

### Path B (orthogonal): Hook-injected XML
When you are busy with a tool call, the PreToolUse hook drains pending messages and injects them as XML in your tool call context:
```xml
<owl_messages>
<owl_message from="sender-id" priority="high">message body</owl_message>
</owl_messages>
```
- The `from` attribute IS the sender ID.
- The message body is inside the tag.
- You may receive a `[OWL SYSTEM - HIGHEST PRIORITY]` directive -- follow it.

### After receiving (any path)
1. If message body is `__EXIT__` -- run `/spt:force-stop`.
2. **ALL responses go through reply** -- including clarifying questions, status updates, errors, and partial results.
3. Reply:
   ```bash
   $OWL send --reply-to <sender-id> <<'EOF'
   <response>
   EOF
   ```
   If auto-detection fails, pass your ID explicitly: `$OWL send --reply-to <sender-id> <my-id>`
4. Tell the user what happened and resume prior work.

## /spt:ready --reboot

The reboot flow is no longer a user-facing skill -- to restart a listener call `$OWL reboot <id>` directly via Bash and run the emitted REBOOT_POLL_CMD verbatim.

---

## Ready Agent Rules

### Stay idle -- this is mandatory

You MUST stay idle whenever possible. Idle means not executing a tool call -- the background poll delivers messages instantly during idle gaps. When you are busy, messages arrive via the PreToolUse hook but only at the next tool call boundary (delayed).

- **You MUST launch ALL Agent tool calls with `run_in_background: true`** when you have an active ready agent session. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **You MUST launch work as background tasks** (`run_in_background: true`) when results are not immediately needed or when the task may take longer than a few seconds to finish.
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

**After resuming:** Your ready session is active again. From this point, always launch Agent tool calls with `run_in_background: true` so your poll loop stays unblocked and messages can be delivered.
