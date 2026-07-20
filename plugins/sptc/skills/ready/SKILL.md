---
name: ready
description: |
  Make this Claude Code session reachable for inter-agent messages (register a perch and
  listen). Use when the user says "listen as", "ready as", or wants to receive messages from
  other agents.
argument-hint: "[<id>] [--once]"
allowed-tools: [Bash, Read, Monitor]
---

# /sptc:ready

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="ready">` block is not in
> this turn's context, do NOT investigate, do NOT read files, do NOT run `spt` status probes, and do
> NOT route to `sptc:setup`. Bring the perch up with the single call below; it is the whole skill.
>
> - **Monitor** tool — `command: "spt ready <id>"` · `persistent: true` · `description: "« spt event »"`
> - `<id>` = the id the user gave, else the id in your SessionStart brief. Only if you have neither,
>   `spt whoami` first.
> - Already spt-hosted (SessionStart brief present + perch already bound)? You are reachable already —
>   do NOT arm a listener. Say so and stop: zero tool calls.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Registers a perch and listens, so other agents can reach this session.
