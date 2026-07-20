---
name: live
description: |
  Run a live agent session. For past sessions, restores a summarized context.

  EXPLICIT START phrases (route to /sptc:live <id>):
  - "live as"
  - "start live"
  - "go live"
  - "start a live agent"

  AUTO-RESUME phrases (route to /sptc:live --auto, resumes most-recently-active live agent):
  - continue live work
  - resume live work
  - continue live agent
  - resume live agent
  - live agent continue
  - live agent resume
  - live work continue
  - live work resume

  Does NOT route here (too ambiguous — require BOTH "live" AND ("agent" or "work")):
  - "keep going"
  - "resume work"
  - "continue" (bare)
argument-hint: "[<id>] [--auto]"
allowed-tools: [Bash, Monitor, Read]
---

# /sptc:live

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="live">` block is not in
> this turn's context, do NOT investigate, do NOT read files, do NOT run `spt` status probes, and do
> NOT route to `sptc:setup`. Bring the session live with the single call below; it is the whole skill.
>
> - **Monitor** tool — `persistent: true` · `description: "« spt event »"` · `command` (one line):
>   `spt api seed --pid $SPT_HOST_PID --session-id $OWL_SESSION_ID && spt api --adapter claude-spt listen <id> --parent-pid $SPT_HOST_PID`
> - `<id>` = the id the user gave, else the id in your SessionStart brief.
> - Every flag is load-bearing (the Monitor's `bash` child breaks by-pid adapter and seed resolution).
>   If `$SPT_HOST_PID` is empty or `1`, resolve the real `claude`/`claude.exe` pid from the process
>   tree and substitute the number — never run the chain with an empty `--pid`.
> - Already spt-hosted (SessionStart brief present + perch already bound)? You are live already — do
>   NOT arm a listener. Say so and stop: zero tool calls.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Upgrades THIS session to a LiveAgent (Psyche-backed).

<!-- [doc->REQ-DIST-SKELETON-THIN] The DURABLE half of the live skill lives here by design (amended
     2026-07-19): concepts, reply mechanics, and the user-facing output block carry no CLI surface, so
     they need not ride `spt adapter update` — and keeping them here buys the injected half enough
     additionalContext headroom to arrive INLINE. Everything version-coupled (the relay command, the
     resume pull, the substrate faults, the wake marker) stays adapter-side. -->

## What going live means

You become a **LiveAgent** — a reachable agent whose context is backed by a **Psyche**, a
daemon-managed companion that briefs your resume across `/clear` and compact via commune deltas.
This upgrades the session you are in right now; Claude Code does not restart.

## Replying

Inbound messages — including replies to messages YOU send — arrive as
`<EVENT type="msg" from="<sender>">body</EVENT>` (body HTML-escaped, newlines `<br>`) on the ONE
relay you armed at bringup, or, on an spt-hosted session, as the `<sptc_messages>` the hook injects
on your turn. To reply, pipe the message body as stdin to `spt send <sender-id>`, then continue.
**Do NOT arm a SECOND Monitor or poll to wait for a reply** — your existing delivery pipe already
carries it.

## Across boundaries — commune and signoff

These apply to you the moment you are live. The operative mechanics (markers, commands) arrive with
the injected instructions or your SessionStart brief; the concepts are here:

- **Commune** — after a significant body of work, and before a `/clear` or `/compact`, write
  `.claude/<id>-commune.md` in ONE atomic write: a concise context DELTA (current task and status,
  decisions since the last commune, immediate next steps), NOT a transcript. The daemon ingests it
  asynchronously — fire-and-forget. Write it and continue; do NOT watch for the file to disappear or
  poll for confirmation, as its vanishing is not a reliable success signal. This is what rebuilds you
  after a reset, so make it complete.
- **Commune across** — a commune that ALSO clears your context window and rebuilds it from that
  commune (the agent-driven `/clear`, no operator). It does **NOT** take your perch or Psyche down:
  you stay live and reachable throughout. It frees a bloated, degrading context window and restores
  your durable context, so you come back lean and keep working — never avoid it for fear of losing
  your perch. It is the OPPOSITE of signoff. When the operator says "commune across", "commune to
  next session", "save and clear", or "compact and continue", they mean THIS. (Claude Code's own
  `/checkpoint` command is an unrelated feature — never conflate the two.)
- **Sign off** — when you are done: stop the listener, save final context, and take your Psyche down.
  `/sptc:ready` or `/sptc:live` brings you back.

## Output — what the user sees

The relay emits machine markers (`BOUND:<id>`, `READY:<id>`, raw tokens). **Read them to drive
bringup; never echo them to the user.** The only user-facing surface is the LIVE block below — emit
it verbatim (substituting `<id>`), and nothing else from bringup:

```
**LIVE.** Now running as `<id>`.
- Reachable — other agents reach me with `/sptc:send <id>`.
- Inbound — messages arrive via the Monitor.
- Across resets — `/sptc:commune` before a `/clear`/`/compact`; `/sptc:signoff` to go offline.
```

If bringup fails, report a short plain-language failure and the likely cause (run `/sptc:setup`),
still without dumping the raw markers.
<!-- [doc->REQ-SKILL-LIVE] -->

