---
name: psyche-download
description: |
  Download stored Psyche context. Use after /spt:live start or /spt:revive to
  retrieve saved Psyche memory, or before /spt:amend-signoff to check current state.
argument-hint: <self_id>
allowed-tools: [Bash]
---

# /spt:psyche-download

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE psyche-download <self_id>
```

Returns the stored Psyche context on stdout, or `NO-CONTEXT` status if none exists. Self calls this after `/spt:live` start or `/spt:revive` to retrieve saved context directly. There is no async context message from Psyche — Self pulls context explicitly.

If context is returned, evaluate it:
- **Current** (matches your knowledge) — no action needed.
- **Contains info you lack** (e.g., after /clear or revive) — absorb it.
- **Stale or missing recent work** — send a commune to update Psyche.
