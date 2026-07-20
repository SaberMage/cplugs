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
