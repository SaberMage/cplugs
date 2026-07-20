---
name: force-stop
description: |
  Force-stop an SPT agent — a ready agent, or a live agent and its Psyche. Use when the user
  says "stop listening", "kill live agent", "force stop", or "tear down perch". Session-aware: a
  live target tears its Psyche down too.
argument-hint: "[<id>]"
allowed-tools: [Bash]
---

# /sptc:force-stop

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="force-stop">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt endpoint shutdown --id <id>` (graceful, saves context) — or `spt endpoint stop --id <id>` for the lighter no-save stop and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Tears down an agent's endpoint (graceful shutdown, or a lighter stop).
