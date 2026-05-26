---
name: live
description: |
  Run a live agent session. For past sessions, restores a summarized context.

  EXPLICIT START phrases (route to /spt:live <id>):
  - "live as"
  - "start live"
  - "go live"
  - "start a live agent"

  AUTO-RESUME phrases (route to /spt:live --auto, resumes most-recently-active live agent):
  - continue live work
  - resume live work
  - continue live agent
  - resume live agent
  - live agent continue
  - live agent resume
  - live work continue
  - live work resume

  Does NOT route here (too ambiguous — require BOTH "live" AND ("agent" or "work")):
  - "keep going"
  - "resume work"
  - "continue" (bare)
argument-hint: "<id> [--period <seconds>] [--pulse-psyche] | [--auto]"
allowed-tools: [Bash, Read, Monitor]
---

# /spt:live

All commands use `$OWL` and `$LIVE` env vars, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Live agent output is orange. Agents parse `TAG:value` tokens.

> **Identity auto-detection:** For messaging commands (send, ring, commune, signoff, etc.), your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails. Startup commands (`start`, `revive`) always require an explicit ID.

Starting a live agent session is a single background task. From then on, the live agent id becomes your name. You have a "Psyche" companion agent. Relative to Psyche, you are referred to as "Self".

## Messaging Command Reference

All three commands read the message body from **stdin** (pipe or heredoc).

```bash
# send -- fire-and-forget to a target (use when you have an active session)
$OWL send <target> <<'EOF'
message body
EOF

# send --reply-to -- respond to whoever messaged you
$OWL send --reply-to <sender> <<'EOF'
response body
EOF

# ring -- send and wait for reply (alias: ask)
$OWL ring <target> <<'EOF'
message body
EOF
```

If auto-detection fails, pass your ID explicitly: `$OWL send <target> <your-id>`, `$OWL send --reply-to <sender> <your-id>`, `$OWL ring <target> <your-id>`.

**When to use which:**
- **`send`**: Fire-and-forget message to a target.
- **`send --reply-to`**: You received a message and want to respond. `from` is auto-set from the original sender.
- **`ring`**: Send and wait for reply. Creates a temporary perch if you have no listener.

## Auto-resume (--auto, SessionStart auto-pick, casual triggers)

Three entry paths converge here. They share ONE dispatch table and ONE uniform AUTO-07 confirmation hop:

1. **Bare `--auto` flag**: user invoked `/spt:live --auto` (no positional id). Run `$LIVE pick-spec` to get pick JSON.
2. **SessionStart `<spt-live-auto-pick>` XML block** present in your context: parse the inner JSON as the pick-spec result; do NOT re-invoke `$LIVE pick-spec` (the JSON is already provided).
3. **Casual-language trigger** (the 8 AUTO-RESUME phrases in this skill's description frontmatter, e.g. "continue live work", "resume live agent"): treat as the bare `--auto` path — run `$LIVE pick-spec` to get pick JSON.

> The AUTO-02 next-work surfacing in Step 3 below ALSO runs at the end of the standard `/spt:live <id>` flow (after `$LIVE psyche-download <id>` in Step 2 retrieves context), not just under --auto. This keeps the "what's next" pane as a one-stop surface independent of entry path.

### Step 1 (Auto-resume): Get pick JSON

If no `<spt-live-auto-pick>` XML block is already in your context with the pick JSON, run:

```bash
$LIVE pick-spec
```

Parse the JSON; dispatch on the `kind` field per Step 2 below.

### Step 2 (Auto-resume): Dispatch on `kind`

**AUTO-07 (uniform confirmation rule):** EVERY successful Auto-resume launch — including `kind:"auto"` — fires an `AskUserQuestion` BEFORE any `$LIVE start` invocation. Dispatcher false-positives (e.g., a phrase like "let me continue the live demo" routing here unintentionally) get a clean Cancel exit, never a silent agent launch.

- **`kind:"auto"`** — exactly one offline agent in this repo's history.
  - Fire `AskUserQuestion` with:
    - `header`: `"Resume agent"`
    - `question`: `"Resume <id>?"` (substitute `<id>` from JSON)
    - `options`: a single option `label: "Resume <id>"`, `description: "Continue this agent's prior session"`
    - `body_addendum`: `"Auto-resume: <id> is the only offline agent in this repo."`
  - On `Resume <id>` selected: `$LIVE start <id>`.
  - On Cancel (no option chosen): exit silently. Do NOT loop into the normal ID Recollection Step 2 — the user explicitly declined the most-recent agent.

- **`kind:"pick"`** — 2+ offline agents. `options[0]` is the most-recently-active per Phase 31 D-12 sort order (`last_active desc, then id asc`).
  - Fire `AskUserQuestion` with:
    - `header`: `"Resume agent"`
    - `question`: `"Resume <options[0].label>?"` (substitute the label of `options[0]`)
    - `options`: two options — `label: "Resume <options[0].label>"` (description: `"Continue the most-recently-active agent"`) AND `label: "Pick a different agent"` (description: `"Show the full picker"`)
    - `body_addendum`: `"Auto-resume offers the most-recently-active agent. Choose 'Pick a different agent' for the full list."`
  - On `Resume <options[0].label>`: `$LIVE start <options[0].label>`.
  - On `Pick a different agent`: fall through to the normal [ID Recollection Step 2](#step-2-dispatch-on-kind) `kind:"pick"` dispatch (existing flow). Emit a `AUTO_FALLTHROUGH:pick-deferred` stderr breadcrumb for diagnosis: `echo "AUTO_FALLTHROUGH:pick-deferred" >&2`.
  - On Cancel (no option chosen): exit silently.

- **`kind:"prompt-new"`** — 0 known agents. D-09 no-op enhancement: fall through to the normal [ID Recollection Step 2](#step-2-dispatch-on-kind) `kind:"prompt-new"` dispatch (which already wires FRESH-01 first-commune via the existing flow). Emit a stderr breadcrumb: `echo "AUTO_FALLTHROUGH:prompt-new" >&2`. No AUTO-07 confirmation here — the existing `kind:"prompt-new"` `AskUserQuestion` IS the confirmation; double-prompting would be noise.

- **`kind:"all-live"`** — every known agent is currently live. D-09 no-op enhancement: fall through to the normal [ID Recollection Step 2](#step-2-dispatch-on-kind) `kind:"all-live"` dispatch (Fork-each `AskUserQuestion`). Emit a stderr breadcrumb: `echo "AUTO_FALLTHROUGH:all-live" >&2`. No AUTO-07 confirmation here — the existing all-live dispatch IS the confirmation.

The `AUTO_FALLTHROUGH:{kind}` stderr lines are debug breadcrumbs only — not user-visible; they aid post-hoc diagnosis of which arm fell through.

### Step 3 (Auto-resume, post-start): AUTO-02 next-work surfacing

ONLY if `$LIVE start <id>` succeeded above (NOT on Cancel, NOT on fall-through to normal flow), run:

```bash
$LIVE psyche-download <id>
```

> **Output truncation.** If the Bash tool reports `Output too large (N KB)` and saves the full result to a `tool-results/<id>.txt` file, use the `Read` tool on that saved path to access the full content. Do NOT re-run `psyche-download` to grep/awk out sections — repeated invocations re-download the same context, waste tokens, and may duplicate `## Pending Commune` sections in `live_context.md` per the §"Drop file lifecycle" contract below.

Then surface the "next body of work" to the user. Scan the psyche-download stdout line-by-line for the FIRST line that prefix-matches any of these three exact H2 markers (case-sensitive, prefix match — `## Current Focus (gen 45)` qualifies):

- `## Current Focus`
- `## Next Up`
- `## Next Steps`

**If a match is found**: extract the section starting at the matched line through (but NOT including) the next line that starts with `## ` at column 0, or to EOF if no such line exists. Print the extracted section verbatim to the user under a "Next body of work" heading.

**If no match is found**: synthesize a 1-2 sentence "Here's where we left off; next step looks like X" summary from the psyche-download output (read the whole download, distill the most-recent commitments + pending threads) and print the synthesis under the same heading.

The structured-marker scan comes first; Claude synthesis is the fallback. Last-commune content is explicitly NOT used for this surface — it's too noisy and often stale relative to the agent's current intent.

## Step 1: Start in background

```bash
$LIVE start <id> [--period <seconds>] [--pulse-psyche]
```

> **8-minute default period** Period defines how often a context summary is generated in the background via "echo communes". Pass `--period <seconds>` (minimum 60) to override the cadence; `--period 0` is accepted as an explicit no-cadence opt-out.

The start command:

1. **Launches your Psyche** as an external process
2. **Enters your poll loop** inline -- emitting one `<EVENT>` envelope line per message delivery
3. Reports the Psyche's session name and generation number

### Invocation (Monitor)

Invoke `$LIVE start <id>` via the Monitor tool with:
- `command: "$LIVE start <id>"`
- `persistent: true`
- `description: "« spt event »"`

`$LIVE start` enters the poll loop inline; the stream stays alive across messages and emits one `<EVENT type="msg|alarm|echo_commune|init_signoff" ...>body</EVENT>` line per delivery. See [On message arrival](#on-message-arrival) for the full envelope-type catalog.

## Step 2: Retrieve Psyche context

After launching the background start task:

```bash
$LIVE psyche-download <id>
```

> **Output truncation.** If the Bash tool reports `Output too large (N KB)` and saves the full result to a `tool-results/<id>.txt` file, use the `Read` tool on that saved path to access the full content.

Pass the same `<id>` you used in `$LIVE start`. Auto-detection may fail during startup before the perch is fully registered.

- If content is current, no action needed.
- If context has information you lack, absorb it.
- If stale or missing recent work, send a commune to update Psyche.
- If `psyche-download`'s stderr contains the literal substring `NO-CONTEXT:<id>`, enter the **first-commune flow** below before doing anything else with this agent. This is the FRESH-02 trigger; the same flow is reached from the `kind:"prompt-new"` arm under [ID Recollection Step 2](#step-2-dispatch-on-kind) (FRESH-01). One unified surface, two trigger paths.

### First-commune flow (FRESH-01 / FRESH-02 / FRESH-03)

When the trigger fires (NO-CONTEXT on `psyche-download`, OR pick-spec returned `kind:"prompt-new"` and the user picked an id):

**Announce first** (before synthesizing): emit `Fresh live agent. Preparing for init.` to the user as a plain one-line message (no formatting, no code fence). The `{first commune summary}` synthesis below reads session memory + `README.md` + `CLAUDE.md` + `.planning/STATE.md` and takes several seconds — without this announcement the user sees a silent dead pause between trigger and the AskUserQuestion. Then synthesize the summary and fire the AskUserQuestion below.

Fire a SINGLE `AskUserQuestion` with these fields:

- **header**: `First commune`
- **question**: `Here is a summary of my first context as live agent <agent_id>. Anything I should add, or proceed to init?` (substitute `<agent_id>` from context)
- **options**: exactly one option — `label: "Proceed to init"`, `description: "Start the agent now with the summary above as initial context"`
- **body_addendum**: the `{first commune summary}` string you synthesize per the next bullet.

Note: `AskUserQuestion`'s native free-text "Other" input captures additions.

**Synthesizing `{first commune summary}`**: compose a 4–8 sentence summary combining two sources, in order:

1. **Primary** — this Claude Code session's conversation memory: read your own session context and surface what the user and you have done so far. This IS the agent's first context. (Per Phase 33 CONTEXT D-01.)
2. **Secondary** — a brief project snapshot: read `README.md`, `CLAUDE.md`, and `.planning/STATE.md` (treat any missing file silently — no error to the user). Distill current project state and progress.

The same synthesis path is used regardless of trigger (Phase 33 D-02 — FRESH-01 and FRESH-02 are not differentiated).

**Handling the response**:

- **"Proceed to init"** Run `$LIVE start <id>` (or, if Step 1 already ran, proceed in-flow). If there is any native-Other free-text addition, synthesize the user's free-text into the summary. Then — after start succeeds — use the **Write tool** to create `.claude/<id>-commune.md` with the augmented summary as its body. This is the canonical first-commune path (see `/spt:commune`): Psyche absorbs the file, which is then deleted on successful ingest.
- **Cancel** (no option chosen): exit silently — matches the existing `kind:"prompt-new"` cancel semantics; do not re-prompt.

### Drift detection (Phase 23 v1.8)

`$LIVE psyche-download <id>` may emit a `<psyche-stamp/>` block (5 fields) and ALWAYS emits a `<current/>` block (live stamp values plus `commits_since` and `commits_unpulled` deltas). When `<current project>` equals `<psyche-stamp project>` AND any of `branch` / `head_sha` / `machine` differ, an HTML-comment ATTENTION SELF directive is appended instructing you to fire `AskUserQuestion`.

The directive text emitted:

```text
<!-- ATTENTION SELF: this project has advanced since your last commune/signoff.
Compare <psyche-stamp/> against <current/> above.
Fire AskUserQuestion with:
  header: "Project drift"
  question: "This project has advanced since my involvement. Should I catch up?"
  multiSelect: true
  options:
    - "Observe new commits"
    - "Skip for now"
    - "Don't ask again"
-->
```

When you see this comment, fire `AskUserQuestion` with the header / question / multiSelect / options exactly as quoted, then dispatch on the user's selection(s):

- **`Observe new commits`** → run `git log <psyche-stamp head_sha>..HEAD` to surface what changed to the user. No system action; no marker write; no commune fire.
- **`Skip for now`** → no-op. The directive will re-appear on the next `$LIVE psyche-download` if drift still applies.
- **`Don't ask again`** → invoke the write-side suppression subcommand:
  ```bash
  $LIVE suppress-drift <self_id> <project>
  ```
  where `<self_id>` is your own owl ID and `<project>` is the value from the `<current project="...">` attribute. Subsequent psyche-downloads for the same `(self_id, project)` pair will skip the directive.

**Cross-project resume (D-10):** when `<current project>` differs from `<psyche-stamp project>`, the ATTENTION SELF directive is NOT emitted (silent by design). You should still NOTICE the project mismatch by reading the two blocks, but do not prompt the user.

## On message arrival

Follow the same message handling protocol as `/spt:ready`. Messages arrive on TWO orthogonal paths:

1. **Parse the envelope.**
   - stdout carries a single `<EVENT>` line per delivery. Four shapes:
     - `<EVENT type="msg" from="<sender-id>">body</EVENT>` — regular message; `from` attribute = sender ID.
     - `<EVENT type="alarm" target-time="<ISO-8601>" current-time="<ISO-8601>">body</EVENT>` — self-originated timed alarm.
     - `<EVENT type="echo_commune" from="<self-id>-psyche" timestamp="<ISO-8601>" note="<descriptor>">body</EVENT>` — auto-fired echo-commune brief from your Psyche, emitted after a SessionStart-triggered `/clear` or `/compact` cycle. `note` carries the trigger source. Body is your context summary wrapped in a two-slice envelope: `<live-context>...</live-context>` plus (when the Psyche resolved a tracked project) `<project-context>...</project-context>`. After `<br>`-split and HTML-unescape per `/spt:ready` body-parsing rules, the two slices form a single SessionStart resume brief — absorb both as one continuous context.
     - Body parsing: split on literal `<br>` to recover newlines, then HTML-unescape each fragment (`&lt;` → `<`, `&gt;` → `>`, `&quot;` → `"`, `&amp;` → `&` **last**, to avoid double-decoding).
   - **Hook path (orthogonal)**: when you are busy mid-tool-call, PreToolUse injects `<owl_messages>...</owl_messages>` XML into your tool context. Read the `from` attribute as sender ID. Same handling.
2. **Reply** via `$OWL send --reply-to <sender-id>`.

---

## ID Recollection (no-arg `/spt:live`)

When the user says `/spt:live` with **no ID**, run the auto-pick flow.

### Step 1: Ask the picker for a spec

```bash
$LIVE pick-spec
```

This emits a single JSON object on stdout. Parse it and dispatch on the `kind` field.

### Step 2: Dispatch on `kind`

- **`kind: "auto"`** — exactly one offline agent in this repo's history. Run:
  ```bash
  $LIVE start <id>
  ```
  where `<id>` is the JSON's `id` field. Tell the user: *"Auto-launching `<id>` (only known agent in this repo)."*

- **`kind: "pick"`** — 2+ offline agents. Fire `AskUserQuestion` using the JSON's `header`, `question`, `options`, and `body_addendum` fields verbatim. Do NOT add an explicit "Other" option — `AskUserQuestion` already provides a native free-text "Other" input; an extra option duplicates it.

- **`kind: "prompt-new"`** — 0 offline agents. Same `AskUserQuestion` pattern, but the `options` are starter role-name suggestions and `body_addendum` lists the full starter pool. `AskUserQuestion`'s native free-text is used; do not add an explicit "Other" option.
  - **FRESH-01: first-commune before start.** When the user picks a new id (whether from a starter option or by typing into native Other), **BEFORE** running `$LIVE start <id>`, fire the [first-commune flow](#first-commune-flow-fresh-01--fresh-02--fresh-03) — the same single `AskUserQuestion` shape (header / question / options / body_addendum) defined under Step 2's NO-CONTEXT bullet. Use the FRESH-03 verbatim template, synthesize `{first commune summary}` per the D-01 source priority, and only on `Proceed to init` proceed with `$LIVE start <chosen-id>`. On cancel: silent exit (matches existing `kind:"prompt-new"` cancel semantics).

- **`kind: "all-live"`** — every known agent in this repo is currently live. Fire `AskUserQuestion` using the JSON's `header`, `question`, and `options` fields verbatim. There is NO `body_addendum` on this kind. Each option's `label` is `Fork <id>` (exactly one space after `Fork`).
  - **Fork `<id>` selected**: strip the leading `Fork ` prefix (exactly 5 characters including the trailing space) to recover `<id>`. Prompt the user as plain text for the new agent id, then run `$LIVE fork <id> <new-id>`. Mirrors the existing D8 fork flow in Step 3.
  - **Free-text typed into the native Other field**: route through `$LIVE pick-spec --resolve <name>` and dispatch via the Step 3 resolve table below (`in_this_repo_history` / `live` / `other_repos`) — same path as the free-text Other under `kind:"pick"`. Preserves the cross-repo collision guard.
  - **Cancel**: terminate silently. Do NOT loop back into `pick-spec`. This is distinct from the forced-picker rule (Cancel-from-D7 / D8 / D9 in the Step 3 Cancel-handling block) — `all-live` Cancel is a clean exit signal, not a re-pick.

### Step 3: Handle the user's choice

- **If the user picked one of the listed options** (`label` from the JSON), run:
  ```bash
  $LIVE start <picked-label>
  ```

- **If the user typed a name into the free-text field**, resolve it first:
  ```bash
  $LIVE pick-spec --resolve <name>
  ```
  The output JSON has fields `in_this_repo_history`, `live`, and `other_repos` (an array of repo basenames). Dispatch:

  | in_this_repo_history | live | other_repos | Action |
  |---|---|---|---|
  | true | false | (any) | **Silent reuse**: `$LIVE start <name>` |
  | false | false | empty | **Fresh init**: `$LIVE start <name>` |
  | false | false | non-empty | **Confirm reuse**: fire `AskUserQuestion`. Construct the body from the template `"Agent {name} exists in other repos: {repos}. Reuse it here?"`, where `{name}` is the resolved name (substituted) and `{repos}` is every string in the JSON `other_repos` array joined with `, ` (substituted, no omission). Options: `Reuse here` / `Cancel`. On `Reuse here` run `$LIVE start <name>`; on `Cancel` see Cancel handling below. |
  | true | true | (any) | **Offer fork**: fire `AskUserQuestion` with options `Fork to new agent` / `Cancel`. On `Fork to new agent`, prompt the user for a new id, then run `$LIVE fork <name> <new-id>`. On `Cancel`, see Cancel handling below. |
  | false | true | non-empty | **Refuse + re-pick**: follow Cancel handling below to fire `AskUserQuestion` (forced presentation, all three kinds covered). Before firing, prepend to the constructed `body_addendum` the template-substituted warning `"⚠ {name} is already live in {repos} — pick something else.\n\n"`, where `{name}` is the rejected name and `{repos}` is the JSON `other_repos` array joined with `, `. Do NOT skip the `AskUserQuestion` fire even if `pick-spec` returns `kind:"auto"` or `kind:"prompt-new"`. |

  If the resolve JSON has an `error` field (invalid id format), tell the user the name is invalid and re-prompt.

### Cancel handling (after D7 confirm or D8 fork dialog)

When the user picks **Cancel** in any post-resolve `AskUserQuestion`, do NOT loop back into `pick-spec` directly. The Cancel is a signal that the user wants to choose a different agent. Re-invoke the picker with **forced presentation**:

1. Run `$LIVE pick-spec` again to get fresh JSON.
2. **Always fire `AskUserQuestion`, regardless of the returned `kind`.** Do NOT auto-launch even if `kind:"auto"` is returned (the user just rejected that single historical agent — auto-launching it again is exactly the bug this rule fixes). Construct the `AskUserQuestion` payload per the `kind`:
   - **`kind:"pick"`** — use JSON's `header`, `question`, `options`, `body_addendum` verbatim (same as Step 2 normal path).
   - **`kind:"prompt-new"`** — use JSON's `header`, `question`, `options` (starter roles), `body_addendum` verbatim (same as Step 2 normal path).
   - **`kind:"auto"`** — synthesize an `AskUserQuestion` manually:
     - `header`: `"Choose live agent"`
     - `question`: `"Which agent should /spt:live use?"`
     - `options`: a single option whose `label` is the JSON's `id` field
     - `body_addendum`: `"Known agent in this repo:\n- <id>\n\nOr type a different name using Other."` (substitute `<id>` from JSON)
     - Do NOT run `$LIVE start <id>` until the user explicitly selects that option in the `AskUserQuestion`.
3. Process the user's choice via Step 3 dispatch as usual.

**Forced picker rule:** Cancel-from-D7, Cancel-from-D8, and Refuse-D9 all share the same re-entry path — they re-fire `AskUserQuestion` and never auto-launch.

### Notes

- The explicit-id path (`/spt:live <id>`) bypasses this flow entirely and behaves exactly as documented in Step 1 above.

---

## Edge Cases

- **Duplicate `/spt:live`**: Rejects with `COLLISION`. Check `/spt:list-agents` first, or use `/spt:revive`.
- **Psyche process dies**: Use `/spt:revive` to restart.
- **Psyche spawn failure**: Start command logs error but continues. Listener poll runs without your Psyche.
- **INSIGHT messages from Psyche**: `INSIGHT ({timestamp}): {observation}` -- high-priority observation about your work. Psyche only sends INSIGHTs for contradictions between stated intentions and actions, forgotten commitments, reasoning gaps, or extended time without progress. Read carefully and adjust if warranted. If the INSIGHT seems incorrect or confused, reply to clarify so you and your Psyche stay on the same page.

---

## Live Agent Best Practices

### Stay idle for fastest delivery

Messages arrive fastest when you are **idle** (not executing a tool call) -- the background poll delivers them instantly. When you are busy, messages still arrive via the PreToolUse hook but with slight delay (next tool call boundary).

- **Always launch Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **Launch work as background tasks** (`run_in_background: true`) when results aren't immediately needed or when the task may take longer than a few seconds to finish.
- **Go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **Batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first

When your poll interjects with a new message, **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `« spt event »` polls from subagents).
3. Then process the new message.

- **Read background task output directly — no `sleep` prefix.** To inspect a completed or in-progress background task, call the Read tool on its output file. Do NOT chain `sleep N && <read>`: the Bash tool blocks sleeps ≥2s chained before other commands, and background-task stdout is flushed promptly, so a plain Read picks up whatever has been written.
