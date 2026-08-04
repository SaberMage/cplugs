---
name: knock
description: |
  Ask another endpoint to let you reach it, and answer the asks you receive — spt's access control
  (per-endpoint grants over messaging and terminal surfaces). Use when the user wants permission to
  message or view an agent, wants to see or answer pending requests, or has an invite code to mint
  or redeem. Distinct from /sptc:subnet, which pairs machines.
argument-hint: "[<target>|list|approve|deny|new-code|redeem]"
allowed-tools: [Bash]
---

# /sptc:knock

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="knock">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt knock --help`, then the one subcommand the user asked for (send / list / approve /
> deny / new-code / redeem) and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Asks an endpoint for permission to reach it, and answers the asks that arrive for you.
<!-- [impl->REQ-SKILL-KNOCK] The skeleton half: frontmatter + argument-hint + the one-tool-call
     operative note. The body is `[strings.skills].knock` in adapter/claude-spt.toml, UPS-injected
     at invocation, and the skill id is in SPTC_SKILLS so the bare `/knock` shortname resolves. -->
<!-- [impl->REQ-SKILL-ARG-HINT] -->
<!-- [impl->REQ-DIST-SKELETON-THIN] -->
