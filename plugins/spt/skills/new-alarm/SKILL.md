---
name: new-alarm
description: |
  Schedule a one-shot timed alarm delivered as TIMED PULSE. Use when the user
  says "remind me", "check back in", "set an alarm", "wake me when", or wants a
  delayed notification.
argument-hint: <time_spec> -- <message>
allowed-tools: [Bash]
---

# /spt:new-alarm

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Renamed 2026-04 (Phase 18.7):** previously `/spt:timed-pulse` /
> `$LIVE timed-pulse`. All existing pulse files under `pulses/<id>.json`
> continue to work — only the CLI + skill surface renamed. The message
> body delivered to Self is still formatted as `TIMED PULSE ({timestamp}): ...`.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

## Quick form

```bash
$OWL new-alarm <time_spec> -- <message>
```

If auto-detection fails: `$OWL new-alarm <your-id> <time_spec> -- <message>`

Schedule a one-shot timed alarm. The message is delivered to Self as a `TIMED PULSE` when the specified time arrives.

**Time formats:**

- `+30m` -- 30 minutes from now
- `+2h` -- 2 hours from now
- `+1h30m` -- 1 hour 30 minutes from now
- ISO-8601 absolute -- e.g., `2026-03-30T15:00:00`

Example:

```bash
$OWL new-alarm +30m -- Check if CI pipeline finished
```

## Messages containing slash-prefixed commands

On Windows under Git Bash / MSYS, any argument starting with `/` is silently rewritten to an absolute Windows path before the binary sees it. This corrupts alarm bodies like `/gsd-plan-phase 19`. The scheduler detects the shapes caused by this rewriting and rejects them with guidance, but use one of the safe transports below to avoid the error entirely.

### Option A (recommended): stdin

```bash
echo "/gsd-plan-phase 19 --research --auto" | $OWL new-alarm +1h
```

When no positional message is provided, `new-alarm` reads the body from stdin. Immune to shell path conversion.

### Option B: --message-file

```bash
printf '%s' "/gsd-plan-phase 19 --research --auto" > /tmp/alarm.txt
$OWL new-alarm +1h --message-file /tmp/alarm.txt
```

Reads the file verbatim. Trailing newlines are trimmed.

### Option C: MSYS escape

If you must use the positional form in a MSYS shell:

```bash
MSYS_NO_PATHCONV=1 $OWL new-alarm +1h -- /gsd-plan-phase 19 --research --auto
```

Or double the leading slash, which MSYS leaves alone:

```bash
$OWL new-alarm +1h -- //gsd-plan-phase 19 --research --auto
```

(The receiver can strip the extra leading slash when interpreting the reminder.)

## Persistence

Alarms are persisted to `%LOCALAPPDATA%\spt\pulses\<id>.json` (Windows)
or `~/.spt/pulses/<id>.json` (Unix). They survive listener restarts and
binary handoffs: on listener startup any expired entries fire to Self
inline (no stale-age filter — every expired alarm fires when a Self
listener next runs). Pending entries are re-read each poll iteration
when the pulse file's mtime changes. File schema is unchanged from the
prior `timed-pulse` surface, so any entries scheduled under the old
CLI continue to work after the rename.

Firing: when a Self listener is running (`$OWL poll <id> listen --live`
or `$LIVE start <id>` which spawns one), alarms fire within one blocking-
wait slice of the target epoch (sub-second in practice). When no listener
is running the alarm sits in the file and fires the next time a Self
listener starts.

The message body delivered to Self is formatted as
`TIMED PULSE ({timestamp}): {message}` — this internal body string is
unchanged from the prior surface (only the CLI + skill rename applies).
