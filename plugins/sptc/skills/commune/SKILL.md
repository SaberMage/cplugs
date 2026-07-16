---
name: commune
description: |
  Push a context update to your Psyche so it can brief your resume across a reset. Use when the
  user says "commune" or "update psyche", or — as a live agent — after a significant body of work,
  before a /clear or /compact. Pass --across when the user asks you to commune across (or "commune
  to next session"): the commune ALSO auto-clears and wakes you from it, carrying you across to the
  next session (an agent-driven context reset, no operator needed).
argument-hint: "[--across]"
allowed-tools: [Bash, Write]
---

<!-- [doc->REQ-DIST-CHECKPOINT-COMMUNE] [doc->REQ-DIST-SKELETON-THIN] [doc->REQ-SKILL-ARG-HINT] -->

# /sptc:commune

**Live agents only.** No perch (`spt whoami` is empty)? Run **`/sptc:live`** first — a ready agent has
no Psyche and nothing to rebuild from.

The operative commune + `--across` mechanics are delivered by the adapter (thin skeleton — the
prose rides `spt adapter update`; ADR-0001/ADR-0006), not baked here: a live agent already carries them
in its **SessionStart brief** (the `live-ops` block) and in the **`/sptc:live` go-live body**. In short:
write `.claude/<id>-commune.md` as one atomic context delta (task + status, decisions, next steps);
add the `!!wake!!` trigger to also self-reset (a PAIR of markers brackets the wake message the next
session opens with). Claude Code's own `/checkpoint` command is unrelated — never conflate the two.
