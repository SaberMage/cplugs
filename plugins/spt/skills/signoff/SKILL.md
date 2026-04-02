---
name: signoff
description: |
  Graceful live agent shutdown with final Psyche context save. Use when the user
  says "sign off", "graceful stop", or wants to cleanly end a live session.
argument-hint: <id> [true|false]
allowed-tools: [Bash]
---

# /spt:signoff

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", run `/spt:env-setup`.

```bash
$LIVE signoff <id> [true|false]
```

Graceful shutdown. If second argument is `true`, sends STASH_FINAL commune to Psyche before teardown so Psyche can do a final context save. Then tears down both Self and Psyche perches.

**Signoff vs Stop:**
- **`/spt:signoff`** -- Graceful: STASH_FINAL to Psyche first. Use for normal session end.
- **`/spt:live-stop`** -- Force: kills immediately. Use when unresponsive or need immediate kill.
