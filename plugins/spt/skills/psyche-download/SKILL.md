---
name: psyche-download
description: |
  Download stored Psyche context. Use after /spt:live start or /spt:revive to
  retrieve saved Psyche memory, or before /spt:amend-signoff to check current state.
argument-hint: ""
allowed-tools: [Bash]
---

# /spt:psyche-download

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

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
