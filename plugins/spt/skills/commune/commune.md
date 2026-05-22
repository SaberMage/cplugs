# Communes

Communes are how you (Self) keep your Psyche informed. They are one-way context flows -- you send them, your Psyche absorbs them silently. Your Psyche never replies to a commune. It uses the accumulated context to judge whether you may have forgotten something, and to provide better nudges during pulses.

## How to Send

Use the **Write tool** to create `.claude/{your_id}-commune.md` with your free-form commune body as its contents. Do not use Bash/heredoc -- Write is the canonical path: no shell escaping, no `EOF` collision risk, and Write auto-creates the `.claude/` parent directory.

Your Self listener notices the file on its next poll iteration, notifies your Psyche wrapper via a file-drop EVENT, and the wrapper ingests the content. On successful absorption (Psyche subprocess exit 0) the wrapper deletes the file. On error (rate limit, etc) the file is retained for retry on the next consume cycle. Writing again before the wrapper consumes is fine -- the latest write wins (last-write-wins overwrite semantics). You do not construct any COMMUNE format manually; the wrapper composes the user-facing `<EVENT type="commune">` envelope from your file body. The body you write MUST itself be wrapped in `<live-context>...</live-context>` and (when in a tracked project) `<project-context>...</project-context>` envelopes -- see `## Two-slice body shape (Phase 25 D-10/D-11)` below for the full contract.

## Two-slice body shape (Phase 25 D-10/D-11)

Every non-empty commune body wraps content in two nested-XML envelopes per Phase 25 D-10/D-11. The taxonomy is defined canonically in `psyche.md` §`<output_envelope>` (lines 282-323) -- that file is the source of truth for what content goes in each slice. This section teaches the routing rules and detection signal you need to apply it correctly.

**Two-slice routing rules (D-25.1-01..03):**

1. **In-project, both slices populated** -- emit `<live-context>...</live-context>` + `<project-context>...</project-context>` (both non-empty bodies). Use for normal mid-project commune activity where you have both role-bound and project-bound updates.
2. **In-project, only role/agent state changed this cycle** -- emit `<live-context>...</live-context>` + `<project-context></project-context>` (empty project body). The empty body is the deliberate "in-project but quiet" signal (D-25.1-02) -- it tells Psyche the project context did not advance this cycle, distinguishable from "no project resolved".
3. **Outside any tracked project** -- emit ONLY `<live-context>...</live-context>`. Do NOT emit an empty `<project-context>` envelope. The MISSING tag is the "no project resolved" signal (D-25.1-03) -- semantically different from an empty body.

**In-project detection rule (D-25.1-04).** Before composing your commune body, run `$LIVE psyche-download <your_id>` and inspect the `<current ... />` tag at the top of the output. The `<current/>` tag carries a `project="..."` attribute whenever any payload is produced — inside a git repo `project` is the repo name; outside a git repo per D-11 `project` is the cwd-basename fallback, which still counts as a project context for routing purposes. `project="..."` populated on `<current/>` → you are inside a tracked project (apply rule 1 or 2). A `psyche-download` invocation that returns no payload at all (NO-CONTEXT exit) → you are outside any tracked project (apply rule 3). The attribute is emitted unconditionally whenever any payload is produced, so this is a deterministic check. Secondary signal: the `<project-context-resolved name="..."/>` sentinel further down the output indicates the project file already has prior content — useful for spotting first-time-in-project pairings, but NOT the routing rule.

**Nested envelopes.** The outer `<EVENT type="commune">` envelope is composed by the `$LIVE commune` runtime from your file body. You NEVER write `<EVENT>` tags in `.claude/{your_id}-commune.md`. You write ONLY the inner two-slice body. The two layers nest: outer EVENT wraps inner two-slice body.

(See `psyche.md` §`<output_envelope>` for the canonical per-slice content taxonomy -- what belongs in `<live-context>` vs `<project-context>`.)

## Memformat Guide

Your Psyche maintains a memformat template that defines topics to cover in communes. Before composing a commune, check the latest memformat by running `$LIVE psyche-download <your_id>` -- the memformat content appears first in the output, wrapped in `<memformat>` tags. Use the listed topics as a guide for what to include in your commune. You don't need to cover every topic every time -- focus on what's relevant to your recent work.

Memformat topics inform CONTENT (what to think about and report on). Envelope routing (`<live-context>` vs `<project-context>`) is INDEPENDENT -- the same topic may land in either slice depending on whether the captured information is role-bound (you, your interactions, your evolving stance) or project-bound (work done in this codebase, project state, project-scoped decisions). When composing a commune, first decide what to report based on memformat topics, then route each piece of content to the appropriate slice per `## Two-slice body shape` above.

If Psyche sends you a message about memformat updates (via PULSE or INSIGHT), re-read the memformat before your next commune to pick up the latest topic guidance.

## Visibility of Pending Communes

`$LIVE psyche-download <your_id>` appends a `## Pending Commune (uncommitted)` section to its output whenever a `.claude/{your_id}-commune.md` file exists but has not yet been consumed by the wrapper. This is how you can see your own in-flight commune body even before Psyche absorbs it -- there is no risk of forgetting what you wrote.

## When to Send COMMUNEs

Send a commune when:

- **You shift focus** to a significantly different task
- **You are about to wait** for user input (idle period)
- **You complete a significant task** or milestone
- **You mention an intention** ("I need to check X", "I should update Y")

Do **not** commune after every small action. Only major transitions and intentions.

## Commune Diligence

Stay aware of how recently your Psyche has heard from you. Two triggers should prompt you to evaluate whether a commune is due:

**On Psyche message:** When you receive any message from your Psyche (a pulse, a nudge, a reminder), ask yourself: has it been a while since my last commune? If your Psyche is reaching out and you haven't sent context recently, send a commune now so it has fresh information to work with.

**Periodic self-check:** Every 30-60 minutes of significant work, pause and consider whether your Psyche has recent context. If you've been heads-down on a stretch of work without communing, send one. Your Psyche can't help you remember things it doesn't know about.

The goal is not rigid scheduling -- it's awareness. If you're actively communing at natural transition points (per the triggers above), the periodic check will rarely fire. It exists as a backstop for long focused stretches where transitions don't happen naturally.

## What to Include

Communes are free-form reflective journals, not rigid status updates. Write naturally about your recent work and thinking. Good communes include:

- **Notable or unusual events or requests** -- anything out of the ordinary that happened
- **Agent interactions** -- who was involved, their roles, what they contributed or found
- **Reflections and thoughts** on work done since your last commune -- what went well, what was tricky, what you learned
- **Ideas to raise with the user** -- things worth mentioning next time they engage
- **Further improvement ideas** for recent problem spaces -- re-examine the work, think deeper about whether the approach was right
- **Timeline awareness** -- what happened when, anything noteworthy about timing or sequencing

Routing: each item above can land in either `<live-context>` or `<project-context>` depending on whether it is role-bound or project-bound. Notable user requests and your reflections on them often land in `<live-context>`; concrete work done in the codebase, decisions about the project's direction, and project-state shifts land in `<project-context>`. When unsure, consult `psyche.md` §`<output_envelope>` for the canonical per-slice taxonomy.

Think of a commune as a journal entry for your Psyche. The richer your context, the better your Psyche can serve you.

## Examples

Each example below is a complete commune body. To send one, invoke the Write tool with `file_path` = `.claude/waffle-commune.md` and `content` set to the body shown.

**Example 1 -- In-project, both slices populated.** Typical mid-project commune where role-bound and project-bound updates both have something to report.

```
<live-context>
Picked up phase 25.1 doc revision work. Coordinating with researcher and
plan-checker. User wants three worked examples in commune.md.
</live-context>
<project-context>
Wrote sentinel emission code at src/live/context.rs:449 and unit test for it.
Next: rewrite the five skill doc touchpoints to teach the two-slice contract.
</project-context>
```

**Example 2 -- In-project, empty project slice.** You are inside a tracked project but nothing project-bound advanced this cycle. The empty `<project-context></project-context>` is the deliberate "in-project but quiet" signal (D-25.1-02).

```
<live-context>
Spent the last 20 minutes catching up on the broader project landscape with
the user. No new project work yet -- just orientation.
</live-context>
<project-context></project-context>
```

**Example 3 -- Outside any tracked project.** `$LIVE psyche-download` returned no payload (NO-CONTEXT exit — no `<current/>` tag, no `project="..."` attribute), so emit ONLY the live slice. Do NOT include an empty `<project-context>` envelope -- the missing tag is the "no project resolved" signal (D-25.1-03).

```
<live-context>
Helped the user write a one-off shell script in ~/scratch. Not tied to any
tracked project. May resurface a similar pattern in real project work later.
</live-context>
```
