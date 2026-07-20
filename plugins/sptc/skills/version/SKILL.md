---
name: version
description: |
  Report the spt-core-tracked adapter version (the version-of-truth, not the marketplace plugin
  version). Use when the user asks the spt or adapter version, or runs /sptc:version.
argument-hint: ""
allowed-tools: [Bash]
---

# /sptc:version

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="version">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt --version && spt adapter list` (the cplugs plugin version is NOT the version-of-truth) and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Reports the version-of-truth: the spt-core-tracked binary + adapter manifest.
