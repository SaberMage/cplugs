---
name: subnet
description: |
  Manage subnet membership — create a subnet, show a pairing code to invite a machine, or join
  an existing one. Use when the user wants to pair machines, set up a subnet, or reach agents
  across machines. Cross-machine /sptc:send and live agents depend on it.
argument-hint: "[status|create|show-code|join]"
allowed-tools: [Bash]
---

# /sptc:subnet

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="subnet">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt subnet --help`, then the one subcommand the user asked for (create / invite / join) and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Pairs machines into a private network so agents reach each other across nodes.
