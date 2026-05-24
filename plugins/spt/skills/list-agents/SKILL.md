---
name: list-agents
description: |
  Unified listing for SPT agents -- ready agents, live agents, and Psyche
  processes. Use when the user says "list agents", "who's live", "who's
  listening", "show psyches", "show active listeners", or wants a roster of
  active perches. Session-aware: defaults to live agents in a live session,
  ready agents otherwise. Pass `--psyches` to list Psyche processes
  instead.
argument-hint: "[--all] [--offline] [--here] [--psyches]"
allowed-tools: [Bash]
---

# /spt:list-agents

All commands use `$OWL` / `$LIVE` env vars, auto-injected by the plugin's
SessionStart hook. If commands fail with "command not found", restart the
Claude Code session so the SessionStart hook re-runs.

## Session-aware branching

Pick ONE command based on session context:

- **Non-live session (default)** -- show ready agents:
  ```bash
  $OWL list
  ```

- **Live session** -- show live agents (those with `live:true` in info.json):
  ```bash
  $LIVE list
  ```

- **`--psyches` flag** (any session) -- show Psyche processes (those with
  `psyche:true` in info.json):
  ```bash
  $LIVE list-psyches
  ```

## Flag passthrough

`--all`, `--offline`, `--here` are forwarded verbatim to the underlying
binary subcommand. Example: `$OWL list --all --offline`.

## Notes

- Stale entries are auto-cleaned by the binary on every list call -- no
  separate sweep step is required.
- Psyche agents are NOT shown by `$LIVE list`; use `--psyches` for those.
- Intended audiences: the user, Self agents checking neighbour status, and
  Touch (health checker).
