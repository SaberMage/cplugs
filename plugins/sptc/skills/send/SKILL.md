---
name: send
description: |
  Send a message to another SPT agent. Use when the user says "send to", "message",
  "tell <agent>", or when you need to reach or reply to another agent yourself.
argument-hint: "<target>"
allowed-tools: [Bash]
---

<!-- [doc->REQ-DIST-SKELETON-THIN] [doc->REQ-SKILL-ARG-HINT] -->

# /sptc:send

Deliver a message to another agent (**body read from stdin**). The operative reach is delivered by the
adapter, not baked here (thin skeleton — the prose rides `spt adapter update`): a perched session
already carries send/reply in its **SessionStart brief** (the `messaging-perch` block). In short:

- **Send:** `printf '%s' "<body>" | spt send <target>` — `SENT` = live, `QUEUED` = spooled (success, do
  not retry).
- **Reply:** `printf '%s' "<body>" | spt send <sender>` (sender = the `from` on the `<EVENT>` you got).
- No perch yet? `/sptc:ready` (or `/sptc:live`) first, or send-and-wait without one via
  `printf '%s' "<body>" | spt ring <target> --timeout 60`.

## Shortform — best for fan-out to many agents

<!-- [doc->REQ-TAG-PEER-MESSAGING] -->

A perched agent can message peers by embedding a tag in its **own turn output** — no `spt send`, no
Bash tool:

- **Peer message:** `@<t1,t2,t3 body @>` — `@<` opens; the comma-separated target list runs to the
  first space (no spaces inside the list); the body runs to the first `@>`. The adapter sends `body`
  to each target and confirms back into your context (which delivered, which had no perch). Multiple
  `@<…@>` blocks in one output all fire. A bare `@@id` does nothing (only the explicit block sends).

**Use the tag as the primary way to send the SAME message to several agents at once** (comma-separate
the ids). For a single-target send, prefer the `printf … | spt send <target>` CLI above when you have
the Bash tool — it is more direct.

To commune, use `/sptc:commune` (or write `.claude/<id>-commune.md`) — the reliable path.

Full guidance: `spt how-to send`.
