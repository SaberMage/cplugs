---
name: timed-pulse
description: |
  Schedule a one-shot timed reminder delivered as TIMED PULSE. Use when the user
  says "remind me", "check back in", or wants a delayed notification.
argument-hint: <time_spec> -- <message>
allowed-tools: [Bash]
---

# /spt:timed-pulse

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$LIVE timed-pulse <time_spec> -- <message>
```

If auto-detection fails: `$LIVE timed-pulse <your-id> <time_spec> -- <message>`

Schedule a one-shot timed reminder. The message will be delivered to Self as a `TIMED PULSE` when the specified time arrives.

**Time formats:**
- `+30m` -- 30 minutes from now
- `+2h` -- 2 hours from now
- `+1h30m` -- 1 hour 30 minutes from now
- ISO-8601 absolute -- e.g., `2026-03-30T15:00:00`

Example:

```bash
$LIVE timed-pulse +30m -- Check if CI pipeline finished
```

Timed pulses are persisted to disk so they survive wrapper restarts. The Psyche wrapper checks for pending pulses on each poll cycle.
