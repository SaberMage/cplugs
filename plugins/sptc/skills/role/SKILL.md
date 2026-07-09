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
> **Operative.** If injection ever no-ops (spt absent / adapter unregistered), check
> SPT's installation status using the skill `sptc:setup`. Otherwise, avoid additional steps.

Shows or edits the endpoint's durable role — `spt endpoint role`.
