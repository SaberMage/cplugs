---
name: psyche-sync-setup
description: |
  Enable cross-machine Psyche context sync via a private GitHub repo
  (spt-agent-storage). Drives install + auth checks for the `gh` CLI,
  creates the repo via `gh repo create --private`, wires it as the
  `origin` remote for every existing agent/project worktree, and
  seeds the remote with `git push --all`. Idempotent — running again
  when already enabled reports current status.

  Use when the user says "enable cross-machine sync", "set up psyche
  sync", "back up my agent context to GitHub", or runs the skill
  directly via /spt:psyche-sync-setup.
argument-hint: "[--disable]"
allowed-tools: [Bash, AskUserQuestion]
---

# /spt:psyche-sync-setup

All commands use `$OWL` env vars, auto-injected by the plugin's SessionStart
hook. If commands fail with "command not found", restart the Claude Code
session so the SessionStart hook re-runs.

This skill enables **cross-machine Psyche context backup**. One private
GitHub repo (`spt-agent-storage`) backs every machine that runs SPT: each
agent's tracked context and each project's tracked context live on their own
branch, pushed to and pulled from that single repo. A ready agent, a live
agent, and its psyche-wrapper all share the same backing remote — so context
follows you from machine to machine.

**Trust model:** `gh` is used for **setup only** (creating the repo and wiring
the git credential helper once). Runtime sync afterward uses plain `git`
push/pull against `origin` (D-16) — `gh` is never on the hot path.

## Prerequisites

Probe for the GitHub CLI:

```bash
gh --version
```

If this exits non-zero (gh not installed), fire `AskUserQuestion`:

> **Question:** "The `gh` CLI is required to set up cross-machine sync but
> isn't installed. How would you like to install it?"
>
> Options:
> - **winget** — run `winget install GitHub.cli` (Windows)
> - **brew** — run `brew install gh` (macOS)
> - **apt** — run `sudo apt install gh` (Debian/Ubuntu)
> - **Show download URL** — open https://cli.github.com/ and install manually
> - **Cancel** — stop setup

After the user picks an install method, run the chosen command via Bash, then
re-probe `gh --version` before continuing. If the user cancels, stop here.

## Authentication

Probe authentication status:

```bash
gh auth status
```

If this exits non-zero (not authenticated), instruct the user to authenticate
with the `repo` scope:

```bash
gh auth login
```

During the `gh auth login` prompts the user MUST select **'repo' (full control
of private repositories)** so the binary can create the private repo. This is
an interactive Bash step the user drives. If the user declines to
authenticate, halt skill execution — sync cannot be enabled without auth.

## Run setup

With `gh` installed and authenticated, hand off to the binary, which creates
the repo, wires the credential helper once, adds `origin` to every existing
agent/project worktree, and seeds the remote:

```bash
$OWL psyche-sync-setup
```

Interpret the exit code:

- **0** — success. Surface the `sync enabled; remote=...` line to the user.
- **1** — generic setup failure (`accept_flow` errored). The binary prints a
  human-readable error line (no longer a raw Debug struct). Surface that error
  line to the user verbatim, then offer to run `$OWL doctor` for diagnostics.
  See **Recovery** below for the ordered next steps.
- **5** — the gh token is missing the `repo` scope. The binary prints a manual
  browser-create URL. Fire `AskUserQuestion`:

  > **Question:** "Your `gh` token can't create private repos (missing 'repo'
  > scope). How do you want to proceed?"
  >
  > Options:
  > - **Refresh scope** — run `gh auth refresh --scopes repo`, then re-run this skill
  > - **Create in browser** — open https://github.com/new?name=spt-agent-storage&visibility=private, then re-run this skill
  > - **Cancel** — stop setup

- **2 / 3 / 4** — gh missing / not authenticated / user unresolved. Re-run the
  Prerequisites and Authentication steps above, then retry.

## Already enabled?

`$OWL psyche-sync-setup` is idempotent (D-13 step 5). If sync is already
enabled, it exits 0 with a line like:

```
sync already enabled; remote=https://github.com/<user>/spt-agent-storage.git acked=<timestamp>
```

Surface that line and stop — no re-creation happens. Re-running is always safe.

## To disable

To turn sync off (D-19 user-driven hard stop):

```bash
$OWL psyche-sync-setup --disable
```

This flips the sync state so `$OWL doctor` reports `state=failing` (with reason
`user-disabled`). Re-run the skill **without** `--disable` to re-enable.

## Recovering from a failed setup

If setup fails (e.g. exit 1) or sync later breaks, work through these in order —
each is safe and most failures clear at step 1:

1. **Re-run `/spt:psyche-sync-setup`.** Setup is idempotent (D-13): re-running
   converges partial state and re-attempts whatever step failed. Try this first.
2. **Run `$OWL doctor`.** It inspects partial state and surfaces a partial-setup
   Warn row plus any per-branch sync failure reason, so you can see what's wrong
   before doing anything else.
3. **Disable, then re-enable.** Run `$OWL psyche-sync-setup --disable` to clear
   the sync state (escape hatch), then re-run the skill **without** `--disable`
   to set it up fresh.

If divergence still persists after that, inspect `seed/` under the spt runtime
root and resolve manually with `git rebase` — this is rare, because Phase 35.2's
per-ref dispatcher reports each branch's outcome (`PUSHED` / `RECONCILED` /
`DIVERGED` / `PUSH_FAILED` / `PROBE_FAILED`), and the old
`git update-ref`-against-the-bare-repo workaround is obsolete.

## Caveats

- **Repo deleted on GitHub (404, D-17):** if the remote repo is later deleted,
  runtime sync flips to a `failing` state. Re-run this skill to re-create the
  repo and resume.
- **Transient-failure backoff (D-18):** repeated push/pull failures schedule an
  escalating retry delay (60s → 5m → 15m → 1h → 6h → 24h cap). `$OWL doctor`
  displays the active retry-after window. A successful sync resets it.
- Newly-created agent and project worktrees (created lazily on first write per
  D-16) inherit `origin` automatically — no need to re-run this skill per agent.
