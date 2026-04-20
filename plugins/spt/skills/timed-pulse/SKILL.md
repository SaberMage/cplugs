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

## Quick form

```bash
$LIVE timed-pulse <time_spec> -- <message>
```

If auto-detection fails: `$LIVE timed-pulse <your-id> <time_spec> -- <message>`

Schedule a one-shot timed reminder. The message is delivered to Self as a `TIMED PULSE` when the specified time arrives.

**Time formats:**

- `+30m` -- 30 minutes from now
- `+2h` -- 2 hours from now
- `+1h30m` -- 1 hour 30 minutes from now
- ISO-8601 absolute -- e.g., `2026-03-30T15:00:00`

Example:

```bash
$LIVE timed-pulse +30m -- Check if CI pipeline finished
```

## Messages containing slash-prefixed commands

On Windows under Git Bash / MSYS, any argument starting with `/` is silently rewritten to an absolute Windows path before the binary sees it. This corrupts pulse bodies like `/gsd-plan-phase 19`. The scheduler detects the shapes caused by this rewriting and rejects them with guidance, but use one of the safe transports below to avoid the error entirely.

### Option A (recommended): stdin

```bash
echo "/gsd-plan-phase 19 --research --auto" | $LIVE timed-pulse +1h
```

When no positional message is provided, `timed-pulse` reads the body from stdin. Immune to shell path conversion.

### Option B: --message-file

```bash
printf '%s' "/gsd-plan-phase 19 --research --auto" > /tmp/pulse.txt
$LIVE timed-pulse +1h --message-file /tmp/pulse.txt
```

Reads the file verbatim. Trailing newlines are trimmed.

### Option C: MSYS escape

If you must use the positional form in a MSYS shell:

```bash
MSYS_NO_PATHCONV=1 $LIVE timed-pulse +1h -- /gsd-plan-phase 19 --research --auto
```

Or double the leading slash, which MSYS leaves alone:

```bash
$LIVE timed-pulse +1h -- //gsd-plan-phase 19 --research --auto
```

(The receiver can strip the extra leading slash when interpreting the reminder.)

## Persistence

Pulses are persisted to `%LOCALAPPDATA%\spt\pulses\<id>.json` (Windows) or `~/.spt/pulses/<id>.json` (Unix). They survive wrapper restarts: on wrapper startup, any expired entries fire to Self inline (dropped silently if >1h stale), and pending entries remain scheduled.
