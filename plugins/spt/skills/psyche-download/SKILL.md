---
name: psyche-download
description: |
  Download stored Psyche context. Use after /spt:live start or /spt:revive to
  retrieve saved Psyche memory. Destructively absorbs any pending
  .claude/{id}-{commune|signoff}.md drop files into the on-disk context.
argument-hint: ""
allowed-tools: [Bash]
---

# /spt:psyche-download

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$LIVE psyche-download <your-id>
```

Always pass your ID explicitly — auto-detection may fail during startup before the perch is fully registered.

Returns the stored Psyche context on stdout, or `NO-CONTEXT` status if none exists. Self calls this after `/spt:live` start or `/spt:revive` to retrieve saved context directly. There is no async context message from Psyche -- Self pulls context explicitly.

When memformat exists for the agent, `psyche-download` outputs the memformat content first (wrapped in `<memformat>` XML tags), followed by the stored context. The memformat defines topics Psyche wants covered in your communes -- review it before composing your next commune.

If context is returned, evaluate it:
- **Current** (matches your knowledge) -- no action needed.
- **Contains info you lack** (e.g., after /clear or revive) -- absorb it.
- **Stale or missing recent work** -- send a commune to update Psyche.

## Pending drop-file consumption (destructive)

When `.claude/{your-id}-commune.md` or `.claude/{your-id}-signoff.md` exists in the current working directory, `psyche-download`:

1. **Reads** the drop file body.
2. **Appends** a section to the on-disk psyche-context file (`{SPT_HOME}/psyches/tracked/{your-id}.md`) under a header `## Pending Commune (written {mtime})` or `## Pending Signoff (written {mtime})`. The `{mtime}` is the drop file's modification time, stamped in local-zone ISO-8601 (e.g. `2026-05-15T08:42:13-07:00`). The on-disk file is created if absent.
3. **Deletes** the drop file from `.claude/`.
4. **Prints** the appended section on stdout as part of the normal context output.

This is the canonical path for updating Psyche context when no live listener is running. It replaces the deprecated `/spt:amend-signoff` workflow — drop the file with the Write tool, then run `psyche-download` (or wait for the next SessionStart-injection auto-fire) to absorb it.

Both invocation paths perform the same destructive consume:
- **CLI:** `$LIVE psyche-download <your-id>`
- **SessionStart hook:** auto-fires `psyche-download` during plugin session-start to inject the context.

**Retry safety:** if the on-disk append fails (disk full, permission error, etc.), the drop file is **retained** — a `psyche-download: failed to append pending ...` error is logged to stderr and the next invocation will retry the same content. No data is silently lost.

**One-shot per drop:** the pending section is now part of the persisted context body. Re-running `psyche-download` immediately after will **not** re-print the section unless you write a fresh drop file. This is the behavior change vs. the pre-destructive output-only append.
