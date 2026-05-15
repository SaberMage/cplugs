---
name: reboot
description: |
  Quick restart for an owl listener. Use when the user says "reboot listener",
  "restart poll", or "poll has gone stale". Reads the current mode from info.json,
  stops the listener gracefully, clears the perch, and emits a REBOOT_POLL_CMD line
  on stdout for the agent to re-register the poll.
argument-hint: <id>
allowed-tools: [Bash, Read, Monitor]
---

# /spt:reboot

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. The emitted poll command line goes to **stdout**.

The `<id>` is the short, single-word identifier of an existing perch (e.g. `deployah`, `waffle`).

## Command summary

```bash
$OWL reboot <id>
```

Reads the current mode from `info.json`, stops the listener gracefully (kill_process), clears the perch (ready file, info.json, .msg files), then prints

```
REBOOT_POLL_CMD=$OWL poll <id> <mode> --setup [--live|--psyche]
```

on **stdout** and emits a `READY:REBOOT:<id>` status line on **stderr**. The emitted command is stream-default — running it brings the listener back online with the original mode and agent-type flags preserved.

## Primary path (Monitor)

After `$OWL reboot <id>` returns, run the emitted REBOOT_POLL_CMD value **verbatim** via the Monitor tool with:

- `persistent: true`
- `description: "« spt event »"`

The stream-default behavior of `$OWL poll` means the listener stays alive and emits EVENT envelopes per delivery — there is no re-register loop and no need for `--once`. The Monitor stream surfaces each delivery as an event line.

## Fallback path (Monitor unavailable)

If the Monitor tool is unavailable, run the emitted REBOOT_POLL_CMD via Bash with `run_in_background: true`, **appending `--once` to the command** before launching. After each delivered message, re-register the same command (without `--setup`) as a fresh Bash background task. This is the legacy one-shot pattern — it works but requires explicit re-registration after every message.

## Edge cases

- **`NO_PERCH:<id>` on stderr** — the perch has no `info.json`, so it was never set up. Run `/spt:listen <id>` or `/spt:live <id>` instead.
- **`DUPLICATE` on the new poll** — the kill_process call did not fully release the TCP port. Wait a few seconds and retry the REBOOT_POLL_CMD; the OS will release the socket shortly.
- **Stale mode in info.json** — if reboot picks up an unexpected mode, inspect `info.json` in the perch directory before re-issuing.
