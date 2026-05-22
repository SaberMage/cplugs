---
name: commune
description: |
  Send a communal update to your Psyche. Use when the user says "commune",
  "update psyche", or wants to sync context with their Psyche companion.
argument-hint: ""
allowed-tools: [Bash, Read, Write]
---

# /spt:commune

All commands use `$LIVE` env var, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Identity auto-detection:** Your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails.

## Flow

1. **Download current Psyche context** to see what Psyche already knows:
   ```bash
   $LIVE psyche-download <your-id>
   ```

2. **Compare** the downloaded context against your current knowledge. Identify what's missing or stale -- new work completed, decisions made, context shifts, intentions formed since the last commune. If the download includes a `<memformat>` section, use it as a guide for what topics to cover in your commune. The download output may also include a `## Pending Commune (uncommitted)` section if a previous commune is still in flight -- that body is queued for the next Psyche consume and you do NOT need to re-send it.

3. **Commune only the delta** -- use the **Write tool** to create
   `.claude/{your-id}-commune.md` with the two-slice body as its contents
   (see `## Two-slice body shape (Phase 25 D-10/D-11)` below for the required
   envelope wrapping). Do not use Bash/heredoc -- Write is the canonical path:
   no shell escaping, no `EOF` collision risk, and Write auto-creates the
   `.claude/` parent directory.

   Your Self listener detects the file on its next poll iteration, notifies
   your Psyche wrapper, and the wrapper ingests the content via the existing
   Psyche session. On success (subprocess exit code 0) the wrapper deletes the
   file. On error (token rate limit, etc) the file is retained and retried on
   the next consume cycle. If you write again before the wrapper consumes, the
   latest write wins (last-write-wins overwrite semantics).

If Psyche's context is already current, no commune is needed. Say so and move on.

Read `commune.md` (in this skill directory) for the full commune protocol -- when to send, what to include, and diligence triggers.

**Agent-type guard:** Only works on live agents. If target is not live, refuses with: "Communes require a live agent with Psyche."

## Two-slice body shape (Phase 25 D-10/D-11)

The body you write in `.claude/{your-id}-commune.md` MUST itself be wrapped in two-slice envelopes per Phase 25 D-10/D-11. The taxonomy — what belongs in `<live-context>` vs `<project-context>` — is defined canonically in `psyche.md` §`<output_envelope>` (lines 282–323). Read that section as the source of truth; this skill doc teaches only when and how to apply it.

**In-project detection rule (D-25.1-04).** Before composing your commune body, run `$LIVE psyche-download <your-id>` (Step 1 of `## Flow` above) and inspect the `<current ... />` tag at the top of the output. The `<current/>` tag carries a `project="..."` attribute whenever any payload is produced — its presence means you are inside a tracked project (inside a git repo, `project` is the repo name; outside a git repo per D-11, `project` is the cwd-basename fallback, which still counts as a project context for routing purposes). A `psyche-download` invocation that returns no payload at all (NO-CONTEXT exit) means no project resolved. So: `project="..."` populated on `<current/>` → emit BOTH envelopes (apply rule 1 or 2 below); no payload at all → emit ONLY `<live-context>` (rule 3). Secondary signal: the `<project-context-resolved name="..."/>` sentinel further down the output indicates the project file already has prior content — useful for spotting first-time-in-project pairings, but NOT the routing rule.

**Three rules (D-25.1-01..03):**

- **In-project, both slices populated** (marker present, you have project-specific content this cycle): emit `<live-context>...</live-context>` AND `<project-context>...</project-context>`, both with non-empty bodies.
- **In-project, no project-specific update this cycle** (marker present, but nothing project-bound to report): emit `<live-context>...</live-context>` AND `<project-context></project-context>` (empty body — the deliberate "in-project but quiet" signal per D-25.1-02). Distinguishable from "no project resolved".
- **Outside any tracked project** (marker absent): emit ONLY `<live-context>...</live-context>`. Do NOT emit an empty `<project-context>` envelope (missing tag means "no project resolved" per D-25.1-03).

**Nested envelopes.** The Phase 23 `<EVENT type="commune">` envelope (see `## Envelope shape (Phase 23 v1.8)` below) is composed by `$LIVE commune` automatically — you NEVER write `<EVENT>` tags. You write ONLY the inner two-slice body. The two envelope layers nest: outer EVENT wraps inner two-slice body.

(See `psyche.md` §`<output_envelope>` for the canonical taxonomy and per-slice content rules.)

## Envelope shape (Phase 23 v1.8)

As of v1.8 Phase 23, commune deliveries are wrapped in a typed EVENT envelope carrying a 5-field stamp (`machine`, `project`, `branch`, `head_sha`, `head_subject`); the prose `COMMUNE (timestamp): body` form is gone.

```xml
<EVENT type="commune" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="claude_skill_owl" branch="main" head_sha="abc123..." head_subject="subject line capped at 72 chars">body</EVENT>
```

Outside a git repo (D-11), `branch`, `head_sha`, and `head_subject` are omitted entirely (not empty-string-set):

```xml
<EVENT type="commune" timestamp="2026-05-20T06:00:00-07:00" machine="hostname" project="cwd-basename">body</EVENT>
```

`$LIVE commune` composes this envelope automatically — Self does NOT manually construct EVENT XML. The `body` placeholder in the example above is the two-slice body (see `## Two-slice body shape (Phase 25 D-10/D-11)` above); the two envelope layers nest. The wrapper-side parser ignores unknown attrs, so the stamp fields are forward-compatible with older receivers. For drift detection on resume, see the `live` skill.
