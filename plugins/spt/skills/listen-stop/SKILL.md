---
name: listen-stop
description: |
  Stop an owl listener or all listeners. Use when the user says "stop listening",
  "stop owl", or wants to tear down a perch.
argument-hint: [<id>] | --all
allowed-tools: [Bash]
---

# /spt:listen-stop

All commands use `$OWL` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

```bash
$OWL stop
$OWL stop --all
```

If auto-detection fails, pass your ID explicitly: `$OWL stop <your-id>`

If target is a **live agent** (has `live:true` in info.json), suggest using `/spt:live-stop` instead.

If you don't know the ID, check via `/spt:list-ready` and stop those with `"mode":"listen"` or `"mode":"wait"`. Don't stop `"mode":"once"` -- they self-clean.
