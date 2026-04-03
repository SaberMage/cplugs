# Communes

Communes are how you (Self) keep your Psyche informed. They are one-way context flows -- you send them, your Psyche absorbs them silently. Your Psyche never replies to a commune. It uses the accumulated context to judge whether you may have forgotten something, and to provide better nudges during pulses.

## How to Send

```bash
$LIVE commune <your_id> <message>
```

The subcommand handles formatting and delivery. You do not construct the COMMUNE format manually.

## Memformat Guide

Your Psyche maintains a memformat template that defines topics to cover in communes. Before composing a commune, check the latest memformat by running `$LIVE psyche-download <your_id>` -- the memformat content appears first in the output, wrapped in `<memformat>` tags. Use the listed topics as a guide for what to include in your commune. You don't need to cover every topic every time -- focus on what's relevant to your recent work.

If Psyche sends you a message about memformat updates (via PULSE or INSIGHT), re-read the memformat before your next commune to pick up the latest topic guidance.

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

The goal is not rigid scheduling -- it's awareness. If you're actively communing at natural transition points (per the triggers above), the periodic check will rarely fire. It exists as a safety net for long focused stretches where transitions don't happen naturally.

## What to Include

Communes are free-form reflective journals, not rigid status updates. Write naturally about your recent work and thinking. Good communes include:

- **Notable or unusual events or requests** -- anything out of the ordinary that happened
- **Agent interactions** -- who was involved, their roles, what they contributed or found
- **Reflections and thoughts** on work done since your last commune -- what went well, what was tricky, what you learned
- **Ideas to raise with the user** -- things worth mentioning next time they engage
- **Further improvement ideas** for recent problem spaces -- re-examine the work, think deeper about whether the approach was right
- **Timeline awareness** -- what happened when, anything noteworthy about timing or sequencing

Think of a commune as a journal entry for your Psyche. The richer your context, the better your Psyche can serve you.

## Examples

Basic communes at transition points:

```bash
$LIVE commune waffle "Finished refactoring auth module. Need to update tests next."
$LIVE commune waffle "Waiting for user response on deployment strategy."
$LIVE commune waffle "Completed all three API endpoints. Moving to frontend integration."
```

A reflective journal-style commune with richer context:

```bash
$LIVE commune waffle "Spent the last hour on the caching layer. Had doyle-researcher look into Redis vs in-memory -- went with in-memory for now since we're single-node. The user might want to revisit this when scaling comes up. Also noticed the retry logic in the API client could be simplified -- the exponential backoff is overkill for local calls. Worth bringing up next time."
```
