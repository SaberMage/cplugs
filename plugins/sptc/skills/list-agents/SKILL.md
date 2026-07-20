---
name: list-agents
description: |
  List SPT agents and endpoints reachable from this node. Use when the user says "list agents",
  "who's live", "who's listening", or wants a roster of active perches.
argument-hint: "[--show-all] [--workers] [--detail]"
allowed-tools: [Bash]
---

# /sptc:list-agents

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="list-agents">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt endpoint list` and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Shows the roster of spt endpoints, with this session's own pinned distinctly.
