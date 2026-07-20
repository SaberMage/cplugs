---
name: role
description: |
  Show or edit this endpoint's durable role — its statement of purpose in the mind. Use when the user
  says "show my role", "edit my role", "update my role", or runs /sptc:role. Pass a directive to change
  it in words (e.g. /sptc:role make it senior); a bare /sptc:role opens an in-input-box editor
  round-trip on a live session; add --include-desc to also edit the service description.
argument-hint: "[<directive>] [--include-desc]"
allowed-tools: [Bash]
---

# /sptc:role

> **Skeleton — thin by design.** Operative instructions for this skill are delivered by the
> `sptc` adapter at invocation time. Look out for the UserPromptSubmit additionalContext.
>
> **Operative — ONE tool call, always.** If the injected `<sptc_skill name="role">` block is not
> in this turn's context, do NOT investigate, do NOT read files, and do NOT route to `sptc:setup`.
> Just run `spt endpoint role` to show it; `spt endpoint role --overwrite <file>` to replace it and answer from its output.
>
> Run `/sptc:setup` ONLY if that call comes back saying `spt` itself is missing.

Shows or edits the endpoint's durable role — `spt endpoint role`.
