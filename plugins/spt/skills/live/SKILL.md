---
name: live
description: |
  Start, resume, or manage a live Self agent with Psyche companion.

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
argument-hint: "<id> [--period <seconds>] | [--auto]"
allowed-tools: [Bash, Read, Monitor]
---

# /spt:live

All commands use `$OWL` and `$LIVE` env vars, auto-injected by the plugin's SessionStart hook. If commands fail with "command not found", restart the Claude Code session so the SessionStart hook re-runs.

> **Output format:** Status messages (ANSI-colored) go to **stderr**. Live agent output is orange. Agents parse `TAG:value` tokens.

> **Identity auto-detection:** For messaging commands (deliver, reply, send, commune, signoff, etc.), your identity is auto-detected from your session. Pass your ID explicitly only if auto-detection fails. Startup commands (`start`, `revive`) always require an explicit ID.

Starting a live agent is a single background task. The Psyche launches as an external process, then the command enters your poll loop.

## Messaging Command Reference

All three commands read the message body from **stdin** (pipe or heredoc).

```bash
# deliver -- fire-and-forget to a target (use when you have your own perch)
$OWL deliver <target> <<'EOF'
message body
EOF

# reply -- respond to whoever messaged you (sugar for deliver with swapped arg names)
$OWL reply <sender> <<'EOF'
response body
EOF

# send -- deliver + create ephemeral reply perch + poll for reply (use when you have NO perch)
$OWL send <target> <<'EOF'
message body
EOF
```

If auto-detection fails, pass your ID explicitly: `$OWL deliver <target> <your-id>`, `$OWL reply <sender> <your-id>`, `$OWL send <target> <your-id>`.

**When to use which:**
- **`deliver`**: You already have a listener. Fire-and-forget, no reply perch created.
- **`reply`**: You received a message and want to respond. Same as deliver, clearer intent.
- **`send`**: You have no listener. Creates a temporary perch, delivers, then polls for the reply.

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

Then surface the "next body of work" to the user. Scan the psyche-download stdout line-by-line for the FIRST line that prefix-matches any of these three exact H2 markers (case-sensitive, prefix match — `## Current Focus (gen 45)` qualifies):

- `## Current Focus`
- `## Next Up`
- `## Next Steps`

**If a match is found**: extract the section starting at the matched line through (but NOT including) the next line that starts with `## ` at column 0, or to EOF if no such line exists. Print the extracted section verbatim to the user under a "Next body of work" heading.

**If no match is found**: synthesize a 1-2 sentence "Here's where we left off; next step looks like X" summary from the psyche-download output (read the whole download, distill the most-recent commitments + pending threads) and print the synthesis under the same heading.

Per CONTEXT D-05 + D-06: the structured-marker scan comes first; Claude synthesis is the fallback. Last-commune content is explicitly NOT used for this surface — it's too noisy and often stale relative to the agent's current intent.

## Step 1: Start in background

```bash
$LIVE start <id> [--period <seconds>]
```

The start command:

1. **Launches the Psyche** as an external `claude` process (wrapper loop that polls owl and feeds messages to `claude -p --resume`)
2. **Enters your poll loop** inline -- emitting one `<EVENT>` envelope line per delivery under stream mode
3. Reports the Psyche's session name and generation number

### Primary (Monitor)

Invoke `$LIVE start <id> [--period <seconds>]` via the Monitor tool with:
- `command: "$LIVE start <id>"`
- `persistent: true`
- `description: "« spt event »"`

`$LIVE start` enters the poll loop inline; the stream stays alive across messages and emits one `<EVENT type="msg|alarm|echo_commune|init_signoff" ...>body</EVENT>` line per delivery. See [On message arrival](#on-message-arrival) for the full envelope-type catalog.

**Important:**
- `$LIVE start` already enters the poll loop — do **not** run `$OWL poll` immediately after start, or it will reject with `DUPLICATE`.
- Do not use `$LIVE start` again after the initial start — it will reject with `COLLISION`.
- Under stream mode you do NOT re-register after each message; the stream stays alive automatically.

### Fallback (Monitor unavailable)

Invoke `$LIVE start <id> [--period <seconds>]` via the Bash tool with:
- `run_in_background: true`
- `description: "« spt event »"`

When a message arrives, the background task completes. Handle the message, then **re-register** with a fresh Bash background task (NOT another `$LIVE start` — that would reject with `COLLISION`):

```bash
$OWL poll <id> listen --live --once
```

Run with `run_in_background: true` and description `« spt event »`. Repeat after every message. The `--once` flag is required so the listener exits after one delivery (matching Bash background-task semantics).

The LIVE-START status includes the spacetime version. Mention this version when telling the user you're live.

## Step 2: Retrieve Psyche context

After launching the background start task:

```bash
$LIVE psyche-download <id>
```

Pass the same `<id>` you used in `$LIVE start`. Auto-detection may fail during startup before the perch is fully registered.

- If content is current, no action needed.
- If context has information you lack (e.g., after `/clear`), absorb it.
- If stale or missing recent work, send a commune to update Psyche.
- If `psyche-download`'s stderr contains the literal substring `NO-CONTEXT:<id>` (hyphen + colon — anchor strictly; the disjoint `NO_CONTEXT:<id>` underscore-form emitted by `$LIVE fork` MUST NOT match), enter the **first-commune flow** below before doing anything else with this agent. This is the FRESH-02 trigger; the same flow is reached from the `kind:"prompt-new"` arm under [ID Recollection Step 2](#step-2-dispatch-on-kind) (FRESH-01). One unified surface, two trigger paths.

<!-- NO-CONTEXT stderr token contract anchor: src/live/context.rs run_download emits
     "NO-CONTEXT:{id} (no stored context)" on stderr (exit 0). The predicate above is
     anchored on the literal "NO-CONTEXT:" hyphen + colon substring. The disjoint
     "NO_CONTEXT:{id}" underscore form lives in src/live/fork.rs (fork failure path)
     and MUST NOT match. If src/live/context.rs's emission text is ever refactored,
     this skill predicate MUST be updated in lockstep. -->

### First-commune flow (FRESH-01 / FRESH-02 / FRESH-03)

When the trigger fires (NO-CONTEXT on `psyche-download`, OR pick-spec returned `kind:"prompt-new"` and the user picked an id), fire a SINGLE `AskUserQuestion` with these fields:

- **header**: `First commune`
- **question**: `Here is a summary of my first context as live agent <agent_id>. Anything I should add, or proceed to init?` (substitute `<agent_id>` from context)
- **options**: exactly one option — `label: "Proceed to init"`, `description: "Start the agent now with the summary above as initial context"`
- **body_addendum**: the `{first commune summary}` string you synthesize per the next bullet. Do NOT add an explicit "Other" option — `AskUserQuestion`'s native free-text "Other" input captures additions.

**Synthesizing `{first commune summary}`**: compose a 4–8 sentence summary combining two sources, in order:

1. **Primary** — this Claude Code session's conversation memory: read your own session context and surface what the user and you have done so far. This IS the agent's first context. (Per Phase 33 CONTEXT D-01.)
2. **Secondary** — a brief project snapshot: read `README.md`, `CLAUDE.md`, and `.planning/STATE.md` (treat any missing file silently — no error to the user). Distill current project state and progress.

The same synthesis path is used regardless of trigger (Phase 33 D-02 — FRESH-01 and FRESH-02 are not differentiated).

**Handling the response**:

- **"Proceed to init"** with no native-Other free-text addition: run `$LIVE start <id>` (or, if Step 1 already ran, proceed in-flow). The first commune is the synthesized summary itself, delivered by the natural state of the agent.
- **"Proceed to init"** with native-Other free-text addition: append the user's free-text to the summary, then run `$LIVE start <id>`, then deliver the augmented summary as the first commune via `$OWL deliver <id> <<'EOF' ... EOF` (or `$LIVE commune <id>` from within the agent's session) after start succeeds.
- **Cancel** (no option chosen): exit silently — matches the existing `kind:"prompt-new"` cancel semantics; do not re-prompt.

## On message arrival

Follow the same message handling protocol as `/spt:listen`. Messages arrive on TWO orthogonal paths:

1. **Parse the envelope.**
   - **Primary (Monitor stream) / Fallback (Bash `--once`)**: stdout carries a single `<EVENT>` line per delivery. Four shapes:
     - `<EVENT type="msg" from="<sender-id>">body</EVENT>` — regular message; `from` attribute = sender ID.
     - `<EVENT type="alarm" target-time="<ISO-8601>" current-time="<ISO-8601>">body</EVENT>` — self-originated timed alarm (per D2.b, no `from`).
     - `<EVENT type="echo_commune" from="<self-id>-psyche" timestamp="<ISO-8601>" note="<descriptor>">body</EVENT>` — auto-fired echo-commune brief from the Psyche wrapper, emitted after a SessionStart-triggered `/clear` or `/compact` cycle (Phase 29 AUTO-EC). `from` is the psyche-id (`<self-id>-psyche`); `note` carries the trigger source (e.g., `"Echo commune brief — auto-fired on clear"`, `"Echo commune brief — auto-fired on compact"`, `"Echo commune — orphan teardown"`). Body is the haiku-model summary.
     - `<EVENT type="init_signoff" timestamp="<ISO-8601>">body</EVENT>` — Self-initiated signoff event (Phase 18.4 / quick-260513-v8f). No `from` attribute — signoff is self-originated. Body carries the signoff context.
     - Body parsing (applies to all four types — same escape conventions): split on literal `<br>` to recover newlines, then HTML-unescape each fragment (`&lt;` → `<`, `&gt;` → `>`, `&quot;` → `"`, `&amp;` → `&` **last**, to avoid double-decoding).
     - **Parsers MUST treat the `type` attribute value case-insensitively** (e.g., `echo_commune`, `ECHO_COMMUNE`, and `Echo_Commune` are equivalent). The emitter writes lowercase; the case-insensitive predicate provides forward-compat headroom.
   - **Hook path (orthogonal)**: when you are busy mid-tool-call, PreToolUse injects `<owl_messages>...</owl_messages>` XML into your tool context. Read the `from` attribute as sender ID. Same handling.
2. **Reply** via `$OWL reply <sender-id>`.
3. **Primary (Monitor)**: continue — the stream stays alive automatically; the next event will arrive on the same Monitor task. The same applies to direct event delivery and to hook-delivered messages — no re-register needed at all under stream mode.
4. **Fallback (Bash + `--once`)**: re-register `$OWL poll <id> listen --live --once` as a fresh Bash background task (with `run_in_background: true`). Hook-delivered messages on the fallback path do not require re-register because the underlying Bash poll is still running between events.

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

- This flow REPLACES the old `sleep 10 [ID SELECT TIMER]` race. There is no auto-pick-on-timer.
- The `pick-spec` command is **read-only** — invoking it does not bump activity timestamps. Only `start`, `revive`, `commune`, `echo-commune`, and SessionStart re-attach do.
- The explicit-id path (`/spt:live <id>`) bypasses this flow entirely and behaves exactly as documented in Step 1 above.

---

## Edge Cases

- **Duplicate `/spt:live`**: Rejects with `COLLISION`. Check `/spt:list-agents` first, or use `/spt:revive`.
- **Psyche process dies**: Perch becomes stale. `/spt:list-agents --psyches` cleans it. Use `/spt:revive` to restart.
- **Psyche spawn failure**: Start command logs error but continues. Listener works without pulse nudges.
- **Pulse timer**: Integrated into `$OWL poll` via `--pulse-interval <seconds>`. Emits `PULSE_TRIGGER` on expiry.
- **Psyche messages to Self**: `PULSE ({timestamp}): {reminders}` -- contextual nudges, not commands.
- **INSIGHT messages from Psyche**: `INSIGHT ({timestamp}): {observation}` -- high-priority observation about your work. Psyche only sends INSIGHTs for contradictions between stated intentions and actions, forgotten commitments, reasoning gaps, or extended time without progress. Read carefully and adjust if warranted. If the INSIGHT seems incorrect or confused, reply to clarify so you and your Psyche stay on the same page.
- **Generation tracking**: Each start/revive increments a counter file inside the owlery dir (`{SPT_HOME}/owlery/.psyche-gen-{id}`); resolved at runtime by `owl.exe` via `owlery::owlery_dir()`.

---

## Listener Best Practices

### Stay idle for fastest delivery

Messages arrive fastest when you are **idle** (not executing a tool call) -- the background poll delivers them instantly. When you are busy, messages still arrive via the PreToolUse hook but with slight delay (next tool call boundary).

- **Always launch Agent tool calls with `run_in_background: true`** when you have an active perch. Foreground agents block your poll loop entirely -- no messages can be delivered until the agent finishes.
- **Launch work as background tasks** (`run_in_background: true`) when results aren't immediately needed.
- **Go idle after launching.** The idle gap is when poll-path messages get delivered instantly.
- **Batch independent work into parallel background tasks** rather than sequential foreground calls.

### Check background tasks first

When your poll interjects with a new message, **before processing it**:
1. Check if other background tasks have completed.
2. Read completed task output (especially `« spt event »` polls from subagents).
3. Then process the new message.

- **Read background task output directly — no `sleep` prefix.** To inspect a completed or in-progress background task, call the Read tool on its output file. Do NOT chain `sleep N && <read>`: the Bash tool blocks sleeps ≥2s chained before other commands, and background-task stdout is flushed promptly, so a plain Read picks up whatever has been written.
