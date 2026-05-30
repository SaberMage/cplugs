# Changelog

All notable changes to the SPT (Spacetime / Sentience Pocket Transacter) plugin are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries authored retroactively from `git log --grep='chore: bump'` at Phase 34 (v1.7.1 milestone).

## [1.11.22] - 2026-05-30

### Fixed
- **`psyche-sync-setup` failures now show a readable error.** The skill's failure path printed raw Rust debug output (`GitFailed(Nonzero { stderr: "..." })`); it now prints the curated, human-readable error line so you can actually act on it.
- **Live agents in non-git host projects now back up their project context.** Starting a live agent in a directory that is not a git repository previously skipped syncing that project's tracked context (`psyches/tracked/projects/<name>/`) — the project-name resolver returned nothing outside a git repo. It now falls back to the directory's own name (guarded against ref-unsafe characters), so non-git projects get their context worktree, commit, and push like any other.

### Added
- **`$OWL doctor` surfaces partial sync setup.** When a setup pushed to the remote but failed at the final settings write (leaving sync "unset"), doctor previously reported a flat "not configured." It now probes the seed repo for a configured origin plus a reachable remote and shows a Warn row pointing you at the idempotent re-run of `/spt:psyche-sync-setup`.
- **`psyche-sync-setup` skill documents exit code 1 and a recovery path.** The exit-code list now covers code 1 (generic setup failure), and a new "Recovering from a failed setup" section walks through re-run → `$OWL doctor` → `--disable` + re-setup.

### BTS
- Phase 35.3 (v1.8): D-01 `{:?}`→`{}` flip at `psyche_sync_setup.rs` routed through the existing `SyncError`/`GitError` Display impls, locked by no-debug-syntax regression tests in `sync.rs` + `git.rs` (D-12). Issue 7 fix is a localized guarded basename fallback in `project_name_from_cwd_path` (`owlery.rs`), gated by `validate_id_chars` + psyche-dir rejection; the bug-encoding unit test was rewritten and a traversal-guard test added. Doctor partial-state probe (`check_sync_status`) reuses a new timeout-parameterized `run_git_with_timeout_dur`, detects origin via `git config --file --get remote.origin.url`, and gives `ls-remote` a 2s `SYNC_PROBE_TIMEOUT` network budget (code-review WR-03/WR-04/IN-02 follow-ups). No SyncSettings schema change (backward-compat hard constraint). 4 plans / 2 waves; verification 5/5 must-haves; code review 0 blockers.

## [1.11.21] - 2026-05-28

### Fixed
- **`$OWL list` can no longer accidentally delete perch directories.** A read command should never mutate state; before this release, `list` could `rm -rf` an orphan-classified perch dir as a side effect, occasionally taking healthy in-flight psyche perches with it. `list` is now strictly read-only.
- **`$OWL list` no longer mis-classifies in-flight psyche workers as orphans on Windows.** Windows PID recycling could make a live psyche perch's info.json look stale during a poll-rewrite race; `list` now consults wrapper liveness plus a 60-second mtime grace before flagging anything as an orphan.
- **`$OWL doctor --fix` stale-perch sweep no longer demotes healthy live agents.** Previously, the sweep removed the `ready` sentinel from a wrapper-owned psyche perch whose info.json carried a recycled PID, briefly knocking the agent offline. The sweep now skips perches whose wrapper is alive.

### Added
- **`$OWL list` reports orphan-perch count.** When any orphan-perch directories are present, `list` prints a hint suggesting `$OWL doctor --fix` to clean them up. `$LIVE list` does not emit the hint.
- **`$OWL doctor --fix` garbage-collects orphan perch directories.** Nested perch dirs are soft-cleaned (sentinel removed); top-level orphan dirs are hard-deleted. A safety guard refuses to wipe a top-level dir that still hosts non-empty `nested/` children — the cascade-wipe class this release was built to eliminate.

### BTS
- Phase 35.1: 8 production `fs::write(info.json)` sites converted to atomic write (tmp + rename) with a source-order regression test that mechanically prevents reintroduction; new `is_wrapper_alive(self_id)` + `PHASE35_LIST_ORPHAN_GRACE_SECS=60` primitives in `src/common/owlery.rs`; `list_filter::collect` lost its `cleanup_orphans` parameter and gained `orphan_count: usize`; `check_orphan_dirs` walks Layer-1 + Layer-2 with cascade-safe routing; status tag inventory gains `SOFT-CLEANED:id`. 4 plans across 3 waves, 12 code-review fix commits (CR-01 `is_online` no-info short-circuit, CR-02 wrapper-alive bypass parity in `check_stale_perches`, WR-01 drop no-op `Option<Vec>` wrap, WR-03 `check_duplicate_flat_nested` non-empty-nested guard, WR-04 surface `gated_count` in PASS row, WR-05 partial-state stderr detail, WR-06 doc the LIST-NOMUT-01 carve-out, IN-02/IN-04 doc-comment notes, IN-05 reverse `OWL_SESSION_ID` precedence to stdin > env in `hook_subagent_start`). Pre-existing `tests/native_wrapper_state_retry.rs` build error (missing `pulse_psyche` field from pre-35.1 commit `3616ed1`) is not a regression. Code review status: partial — 5 findings skipped per reviewer directive (WR-02 / WR-07 refactor scope, IN-01 / IN-03 / IN-06 cosmetic).

## [1.11.20] - 2026-05-28

### Fixed
- **`p-<project>` branches on `spt-agent-storage` now actually carry project content.** A project's psyche-sync branch (`p-<project>`) had its ref pushed to origin at seed-init time but never advanced past that initial commit — no commune carrying `<project-context>` ever landed on it, so the branch was visually identical to "absent" on the GitHub web UI. Root cause: `route_two_slice` in `src/owl/echo_commune.rs` wrote the project `<agent>.md` file into `psyches/tracked/projects/<name>/` *before* calling `commit_project_payload`, which pre-populated the target directory and made the downstream `git worktree add` (both primary and `branch already exists` fallback) abort with `'<path>' already exists`. The worktree never materialized, no commit fired, and the error was silently swallowed as `(payload on disk)`. Fix reorders all 3 production write-sites in `echo_commune.rs`: `ensure_project_worktree` runs FIRST, then `fs::write`, then `commit_project_payload`. A defense-in-depth salvage path in `src/common/tracked.rs::ensure_worktree` also auto-repairs already-broken installs — when a target dir is non-empty and lacks `.git` and both `worktree add` attempts fail with `'... already exists'`, contents move to `<wt>.salvage-<unix_ts>/`, `worktree add` retries, salvaged files restore into the now-real worktree. Existing broken installs heal on the next commune carrying `<project-context>`; no manual recovery required.

### BTS
- Quick `260527-s8l`: 3 reorder sites in `src/owl/echo_commune.rs` + new salvage branch in `src/common/tracked.rs::ensure_worktree`. Of the 9 grep-matched call sites surveyed across `echo_commune.rs`, `signoff.rs`, `context.rs`, only the 3 in `echo_commune.rs` were production bugs; the rest are test code or read paths (verified before editing). 2 new regression tests (echo_commune reorder RED→GREEN; ensure_worktree salvage round-trip). `cargo build --release` clean; `cargo test --lib` 951 pass / 0 fail / 5 ignored; `cargo test --test handoff_integration` 19/19; `cargo test --test hook_chain` 7/7. Commits `4866fb9`, `2eb23eb`, debug session at `.planning/debug/p-branches-not-pushed-origin.md`.

## [1.11.19] - 2026-05-27

### Fixed
- **`/psyche-sync-setup` no longer aborts on a re-run or against a stale remote.** Two idempotency gaps in the setup flow (`accept_flow`) could leave cross-machine sync un-enableable after any partial first attempt. (a) If a prior run had already wired an `origin` remote — and because git worktrees share one config, a single agent/project worktree wiring it counts — the setup's `git remote add origin <url>` silently no-op'd, so a stale or wrong backup URL survived and the seeding `git push --all` hit `Repository not found` (404) and exited 1. Origin is now wired authoritatively: each worktree gets `remote add` followed by an unconditional `remote set-url`, so the remote always points at the canonical `https://github.com/<user>/spt-agent-storage.git`. (b) If the GitHub repo already existed (a prior run created it but failed before persisting `state=Enabled`), `gh repo create` exited nonzero with "Name already exists" and the whole flow aborted; that stderr is now treated as idempotent success (checked after the unchanged missing-scope / HTTP 403 browser-fallback path), so re-running setup completes instead of dead-ending. Both git calls remain soft-failed; the `$OWL psyche-sync-setup` exit-code contract is unchanged.

### BTS
- Quick `260527-6ah`: `src/common/sync.rs` `accept_flow` Step 1 (case-insensitive `"already exists"` fall-through to success) + Step 4 (add-then-unconditional-`set-url` per worktree). Two new `#[cfg(unix)]` `fake_gh` regression tests (`accept_flow_repo_exists_is_idempotent`, `accept_flow_corrects_stale_worktree_origin`), excluded from Windows CI per existing convention. `cargo build --release` clean; `cargo test --lib common::sync` 23/23. Diagnosed from a live Windows failure where a leftover `origin=https://github.com/u/spt-agent-storage.git` poisoned setup; the affected runtime was recovered out-of-band (origin `set-url` → correct URL, `push --all`, per-branch upstream, `settings.json sync.state=enabled`) and verified via `$OWL doctor`. Commits `b7668dd`, `e4ceca4`.

## [1.11.18] - 2026-05-27

### Fixed
- **Cross-machine sync offer now actually renders.** The session-start prompt that offers to enable Psyche sync ("Enable now / No, never / Remind me in 12h") never appeared — it was written as passive SessionStart context that Claude receives but does not act on. It now arrives as an active in-session message on the live agent's own channel, so the offer surfaces on `$LIVE start`/`revive` and on a `/clear`|`/compact` boundary (live agents only; plain startups stay silent).
- **`$OWL doctor` no longer shows green for a failing sync.** A per-agent sync row with recorded failures could display PASS once its retry backoff window elapsed. Failing rows now read WARN (failures, no active retry) or FAIL (retry pending or hard stop) and surface the failure reason.

### BTS
- Phase 35 SC1 gap-closure (plan 35-10): new `src/owl/sync_prompt.rs` active-delivery module carrying a self-contained `<instructions>` envelope (mirrors the version-change pattern); both triggers rewired through it; the `.sync-prompt-due` sentinel + `queue_sync_prompt_if_due` passive path removed; always-loaded `<spt-psyche-sync-prompt>` handler added to `live/SKILL.md`; render-path test (`tests/sync_prompt_render.rs`) asserts the spool row + envelope content — the test gap that let the defect ship; operator-UAT wording corrected to the active-delivery model. 5 commits. Cross-machine + in-session render validation remains operator UAT (`35-HUMAN-UAT.md`).

## [1.11.17] - 2026-05-26

### Added
- **Cross-machine context sync (opt-in).** A new `/psyche-sync-setup` flow backs up a live agent's context to a private GitHub repo, so the same agent can resume with its history on another machine. On session start, SPT now offers to enable sync if you haven't set it up yet.
- **`$OWL doctor` sync status.** `doctor` now reports a Sync section — whether cross-machine sync is enabled, the backup remote, and any recent sync failures with their retry timing.

### BTS
- Phase 35 implementation: settings.json sync namespace data layer, `src/common/sync.rs` subprocess facade, Unix detached-spawn helper, UserPromptSubmit async-pull dispatch, post-commit pull-then-push + lazy-worktree remote inheritance wired into `tracked.rs`, plus four `cargo test --test sync_*` integration suites and a two-machine operator UAT runbook. 28 commits across 9 plans / 5 waves.
- Published mid-v1.8-milestone (off the normal milestone-close bump cadence) to provide an installable build for the two-machine operator UAT. Cross-machine sync ships in this build but is not yet validated against real GitHub — that is what the UAT covers.

## [1.11.16] - 2026-05-25

- **Live psyche poll stability fix.** Wrapper-owned psyche poll (the `psyche && parent.is_some()` path, spawned every wrapper iteration) now skips the DUPLICATE listener guard and writes a schema-minimal `{"pid": <int>}` info.json. Fixes a Windows PID-recycling false positive that tripped the 3-consecutive-empty-exit backstop and crashed the live wrapper (debug session `echo-gate-poll-exit-sentinel-triad`, Symptom 2), and stops a cross-session `OWL_SESSION_ID` inheritance leak into the nested psyche perch. `get_pid_from_info` / `get_parent_pid_from_info` migrated to `serde_json::Value` lookups so both legacy and minimal info.json shapes parse. No change to Self / Listener / Live / Spine / Touch / Working perches. Commit `6342852`.
- **Echo-commune forensic resume.** Dropped `--no-session-persistence` from echo-commune haiku fires — each fire stays a fresh session (no `--resume`), but the jsonl now persists under the psyche projects root so operators can `claude --resume <session_uuid>` post-hoc for debugging. Test F flipped from "MUST be in argv" to "MUST NOT be in argv". Commit `0c9233e`.
- **Skill doc prune.** Trimmed verbose and redundant prose from three skill manifests — `plugin/spt/skills/{live,ready,send}/SKILL.md` — for clarity at skill-discovery time. 154 deletions / 45 insertions; no behavioral or command-surface change. Commit `5b9a77b`.

## [1.11.15] - 2026-05-24

- **SPT taxonomy + verb scrub triple-header.** Three coordinated quick tasks land the canonical agent-kind vocabulary established by the 2026-05-24 ling /grill-with-docs session (alongside the new root-level `CONTEXT.md` glossary and `docs/adr/0001-0005`). (a) `260524-2wo` — verb scrub: stale `$OWL deliver` / `$OWL reply` user-facing strings retired from `src/owl/{resume,hook_check,hook_subagent_start}.rs` and `plugin/spt/skills/{live,listen,revive,send}/SKILL.md`; "formerly deliver" / "formerly send/ask" provenance comments dropped from `src/owl/{send,ring,mod}.rs`, `src/cli.rs`, `src/common/outcomes.rs`, `src/live/commune.rs`; back-compat alias surface (`alias = "deliver"`, `alias = "ask"`, hidden `Reply` variant) preserved. (b) `260524-3p3` — "plain owl listener" / "plain listener" → "ready agent" rename across `src/owl/resume.rs` reorientation prose and `plugin/spt/skills/{force-stop,list-agents,revive}/SKILL.md`; `CONTEXT.md` `_Avoid_` glossary entry left intact. (c) `260524-436` — `/spt:listen` skill renamed to `/spt:ready` for taxonomy symmetry with `/spt:live` (matching `live agent` / `ready agent` agent-kind pair): folder `git mv plugin/spt/skills/listen → plugin/spt/skills/ready` (history-preserving), SKILL.md frontmatter/H1/H2 retargeted, cross-references in `plugin/spt/skills/{whoami,live,revive}/SKILL.md` + runtime resume hints in `src/owl/resume.rs` + code-comment file-path refs in `src/owl/poll.rs` + `docs/DEPLOY.md` example all updated. `/spt:ready` SKILL.md frontmatter description sharpened to "Start a ready agent (poll listener serving a perch)" for taxonomy alignment at skill discovery. CLI `poll <id> listen` mode-arg namespace (distinct from the skill name) left untouched. `/spt:listen` becomes hard-404 after `/reload-plugins`. Quick tasks `260524-2wo`, `260524-3p3`, `260524-436`.

## [1.11.14] - 2026-05-24

- **Psyche prompt now recognizes typed `<EVENT type="commune">` envelopes as canonical commune-class triggers, and prose-style prohibitions throughout `psyche.md` have been globally rewritten as positive directives.** Decision tree entry 1 (the first classifier hop) used to match only the legacy prose form `COMMUNE ({timestamp}):` from `{{self_id}}`; the canonical Phase 29 typed envelope (`<EVENT type="commune" from="{{self_id}}" timestamp="..." [note="..."]>{body}</EVENT>`) fell through to `<self_request>` and the LLM hallucinated a need to use Bash / `$OWL deliver` to "reply" — despite `<tool_access>` denying Bash. Two coordinated fixes: (a) decision-tree entry 1, `<commune>` handler header, and `<self_request>` Critical-note now all match the typed envelope (case-insensitive on the `type` attribute) and route to the `<commune>` handler; the legacy prose form is kept as a one-line fallback under the same handler; (b) prohibition prose dropped from 31 occurrences to 3 (only the permitted safety-clause exceptions in `<passive_context_protocol>`, `<absorption>` rule 5 encoding contract, and `<absorption>` rule 6 parse-failure guarantee remain). Wrapper marker tokens `[REPLY]` (7 occurrences) / `[NOTIFY]` (4) / `[COMMUNE]` (3) preserved verbatim — `src/live/wrapper/mod.rs::parse_markers` behavior unchanged. Prevents the `ling.log:43` regression scenario observed during v1.11.13 UAT. Quick task `260524-02w`.

## [1.11.13] - 2026-05-23

- **Fresh live agent flow now announces "Fresh live agent. Preparing for init." before the multi-second first-commune synthesis pause.** When `/spt:live <new-id>` triggers the FRESH-01 (`kind:"prompt-new"`) or FRESH-02 (`psyche-download` returns `NO-CONTEXT:<id>`) path, the agent previously went silent for several seconds while it synthesized the `{first commune summary}` from session memory + README.md + CLAUDE.md + STATE.md before firing the first-commune `AskUserQuestion`. The dead pause looked like a hang. The `### First-commune flow (FRESH-01 / FRESH-02 / FRESH-03)` section in `plugin/spt/skills/live/SKILL.md` now instructs the agent to emit the announcement at the converged trigger site, covering both paths with a single DRY edit. Quick task `260523-vk1`; commit `381593b`.

## [1.11.12] - 2026-05-23

- **Phase 25.4-07 follow-up: version-change emission no longer short-circuits the Stop hook.** `src/owl/hook_idle.rs::run` had an early return after Phase 34's `maybe_emit_version_change_block` returned `Emitted` (REVIEW-FIX #2 + hotfix-260517-6om), citing an "ordering invariant" against the Stop hook being silent on stdout. But the two downstream calls — `set_idle_ready` and `spawn_echo_commune_if_live` — are pure filesystem sentinel writes (`.idle-ready` and `.more-done`); neither touches stdout. The early return was over-broad and dropped the `.more-done` sentinel write for one Stop fire per version transition, silently killing the wrapper echo-commune fire on the version-change turn. Surfaced during Plan 25.4-07 reprobe on `probetest`: after deploy of v1.11.11 the `.more-done` did not land on the first Stop hook fire (version-change emission consumed it); second Stop fire wrote the sentinel correctly once the version was already acknowledged. Fix: fall through unconditionally. Return value retained as `let _` to preserve REVIEW-FIX #2 compile-time VersionPrompt type pin (`version_changelog.rs::tests::review_fix_2`). Unused `VersionPrompt` import dropped. All 7 `owl::hook_idle` tests still pass. Source: `src/owl/hook_idle.rs` commit `72b4263`.

## [1.11.11] - 2026-05-23

- **Phase 25.4 follow-up: `.more-done` echo-commune sentinel fires again after nested-perch migration.** Plan 25.4-04 migrated the writer destination at `src/owl/hook_idle.rs:153` to `perch_path::resolve_perch_path(psyche_id, ParentHint::Explicit(owl_id))` but missed the gate predicate two lines above it (`src/owl/hook_idle.rs:137`), which still consulted `owlery::ready_file(psyche_id)` at the flat path. Post-25.4 the flat ready file never exists for any agent (all psyche perches are NESTED-only), so the gate always returned early and `.more-done` was silently never written — wrapper `echo_fire.rs` consumed no sentinel, echo-commune fires were dead. Surfaced by Plan 25.4-07 operator smoke probe: `probetest` had no `.more-done` at either flat or nested path after Stop hook fired multiple times. Fix uses the SAME resolver hint as the writer (`Explicit(owl_id)`). Test helper `touch_psyche_ready` updated to write the ready sentinel at the nested path the new gate consults. All 7 `owl::hook_idle` tests pass; landmine/`poll_nested_psyche`/`perch_path_no_flat_{psyche,worker}` regression suites unchanged. Source: `src/owl/hook_idle.rs` commit `48b61be`.

## [1.11.10] - 2026-05-23

### Fixed
- **Binary handoff from v1.11.8 wrappers to v1.11.10+ binaries no longer dies before logging.** Corrects `[1.11.9]`, which added `pulse_psyche` as a REQUIRED clap positional on the hidden `_psyche-wrapper` subcommand without a `default_value`. v1.11.8 wrappers build the handoff argv with only 4 positionals (`<id> <period> <gen> <session_name>`) and exec the new binary; clap rejected the 5-arg invocation with `the following required arguments were not provided: <PULSE_PSYCHE>` and exited before reaching `WrapperState::new` — no log line, perch went stale, listener orphan-detected on next iteration and died too. State-file backward-compat alone was insufficient because state restoration runs AFTER argv parse: `WrapperHandoffState`'s `#[serde(default)]` on `pulse_psyche` was never reached. Fix: `#[arg(default_value = "0")]` on `Commands::PsycheWrapper::pulse_psyche` in `src/cli.rs`. v1.11.8 wrappers now land in the new binary with `pulse_psyche="0"`, the state-file then wins per D-07 lifecycle precedence — net behavior identical to a fresh `$LIVE start` without `--pulse-psyche`. v1.11.9+ wrappers (which always emit the explicit 6th arg) are unaffected.

### BTS
- **Quick 260523-7zy (corrects [1.11.9]):** single-line clap attribute addition (`#[arg(default_value = "0")]`) above the `pulse_psyche: String` field inside `Commands::PsycheWrapper` at `src/cli.rs:196`. No other code changed — wrapper-side dispatch (`arg == "1"` truthiness) flows defaulted `"0"` through the "off" branch, exactly matching legacy v1.11.8 behavior. Regression guard `tests/handoff_integration.rs::psyche_wrapper_5arg_argv_backward_compat` locks both shapes via in-process clap parse: 5-arg argv parses with `pulse_psyche="0"`, 6-arg argv preserves the explicit `"1"`. Full `cargo test --test handoff_integration` suite green (19/19, 1 pre-existing ignored). Plugin version bump (1.11.9 → 1.11.10) done by hand; `docs/DEPLOY.ps1` is the operator's manual follow-up. Source: `.planning/quick/260523-7zy-fix-v1-11-9-handoff-argv-backward-compat/`. Root cause: `.planning/debug/binary-handoff-defer-todlando.md`.

## [1.11.9] - 2026-05-23

### Changed
- **`$LIVE start` / `revive` / `fork` default `--period` is now 480 seconds (8 minutes), and a new `--pulse-psyche` flag (default `false`) gates whether routine cadence wakes invoke the Psyche LLM.** Corrects `[1.10.26]`, which defaulted `--period` to `0` (no cadence wake) — that over-correction silently disabled the wrapper's background `fire_echo_commune_if_due` cadence for every bare-start agent. The new default brings the cadence wake back at 8-minute intervals while keeping the Psyche LLM poke (formerly fired by every PULSE_TRIGGER) opt-in. Bare `$LIVE start <id>` now wakes every 8 minutes to fire the echo-commune gate only; pass `--pulse-psyche` to restore the legacy behavior where every cadence wake invokes the Psyche LLM resume turn (Psyche evaluates and may nudge Self). `--period 0` is still accepted as the explicit no-cadence opt-out (also disables the echo-gate cadence since the wrapper never wakes on a timer). `--period <N>` for `N` in `1..=59` is still rejected with `Minimum pulse period is 60 seconds (or 0 to disable)`. **Migration recipe** for callers who relied on the v1.10.x 20-minute LLM-evaluating cadence: `$LIVE start <id> --period 1200 --pulse-psyche`. Source: `.planning/quick/260523-648-default-period-8m-pulse-psyche/`.

### BTS
- **Quick 260523-648 (corrects [1.10.26]):** new `pulse_psyche: bool` field added to `WrapperState` (`src/live/wrapper/mod.rs`) and `WrapperHandoffState` (`src/common/wrapper_state.rs`, `#[serde(default)]` for backward compat with v1.11.8 on-disk state files); threaded through argv as a new positional slot (`[&str; 5]` → `[&str; 6]` at three sites: cold-start `run`, cold-start `live_start_result`, handoff re-emit `perform_wrapper_handoff`); CLI surface gains `--pulse-psyche` flag on `LiveCommands::{Start, Revive, Fork}` (three independent clap derive arg additions); hidden `Commands::PsycheWrapper` subcommand gains a 5th positional slot parsed as `"1"`/`"0"`; wrapper outer loop (`src/live/wrapper/mod.rs` PULSE_TRIGGER intercept site) `continue`s past `resume_session_checked` when `pulse_psyche == false`, so the echo gate at the top of the next iteration still fires while the Psyche LLM resume turn is skipped; orphan detection, handoff detection, ready-file check, 24h refresh, and `next_pulse_override` all unaffected. Sentinel-0 mechanics from `[1.10.26]` preserved verbatim — only `unwrap_or(0)` → `unwrap_or(480)` at two sites in `src/live/start.rs` (`run` and `live_start_result`); the `period > 0 && period < 60` guard shape, error wording, conditional argv omission in `poll_psyche`, `init_session` banner branches, `build_agents_json` substitution, and `psyche.md` content are all UNCHANGED. Tests: 4 new `tests/cli_parse.rs` `--pulse-psyche` parse guards + renamed `live_start_default_period_is_480` regression guard; 2 new focused `src/common/wrapper_state.rs` tests (`pulse_psyche_true_roundtrips` + `missing_pulse_psyche_field_defaults_false` — the latter pins the `#[serde(default)]` backward-compat contract). Plugin version bump (1.11.8 → 1.11.9) deferred to user-run `DEPLOY.ps1 -Bump patch`.

## [1.11.8] - 2026-05-23

### Fixed
- **Malformed `live_context.md` from the Psyche LLM now triggers a one-shot self-heal respawn.** When the wrapper's post-LLM route hook (introduced in v1.11.7 / Plan 25.3-05) reads `agents/<id>/live_context.md` and finds the project slice missing — AND the project is resolvable — AND the prompt that turn carried a `CURRENT_PROJECT_CONTEXT` block — the wrapper now respawns the Psyche session ONCE via `resume_session_with_exit` with a corrective prompt anchored on `did not honor the two-slice envelope contract`. On retry exhaustion the wrapper logs `[LIVE-CONTEXT-MALFORMED] retry_exhausted` and continues without further action. Single retry cap; no infinite respawn loops. Defect G2 from `.planning/debug/todlando-project-context-not-persisted.md`.

### BTS
- **Plan 25.3-06 (Defect G2 self-heal):** new `pub(crate) trait ResumeRespawnDispatcher` (`src/live/wrapper/mod.rs:538`) decouples the respawn dispatcher from `WrapperState` so the helper is testable without spawning real Psyche processes — production impl on `WrapperState`, mock `TestResumeRespawn` for inline tests; `RouteLiveCtxOutcome` extended with `Respawned(Box<...>)` and `MalformedRetryExhausted` variants; `route_live_context_md_if_changed` signature extended with `last_prompt: Option<&str>` and `dispatcher: &D` parameters; three hook sites in `src/live/wrapper/claude.rs` (init / resume / final) updated to pass `(prompt|None, self)`; corrective-prompt anchor literal locked at `mod.rs:752` and asserted by test at `mod.rs:4245`; 4 new inline G2 tests cover fire / no-fire-on-rule-6 / respawn-routed / retry-exhausted paths; 2 Plan 25.3-05 tests updated to the new signature. Full wrapper-module suite 121 tests green (117 from v1.11.7 + 4 new G2 guards); `cargo build --release` clean. Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-06-PLAN.md`.

## [1.11.7] - 2026-05-23

### Fixed
- **`psyche-download` no longer races and deletes inbound commune drop files.** When the LLM commune handoff finished, `psyche-download` would `fs::remove_file()` the drop file the wrapper had just routed — racing the wrapper's direct-write path and surfacing a confusing `(file gone)` symptom in live UAT. Drop files are now treated as wrapper-owned single-writer artifacts: `psyche-download` is read-only over them, and the wrapper's `process_file_drop` remains the sole deleter. Documented in `plugin/spt/skills/live/SKILL.md` as a Rule-3 deviation (relocated from the deleted `psyche-download/SKILL.md`).
- **Wrapper poll-stderr logs no longer leak ANSI CSI escape sequences.** Status output emitted by `owl.exe poll` reached the wrapper log with raw `\x1b[...m` bytes interleaving the visible text. A new `strip_ansi` helper in `src/common/output.rs` scrubs CSI escapes at both Unix and Windows poll-stderr write sites in `src/live/wrapper/mod.rs`.
- **Post-LLM `live_context.md` now replicates to disk under the resolved project.** When the Psyche LLM emits a two-slice envelope into `agents/<id>/live_context.md`, the wrapper now routes the project slice through `route_two_slice_with_precedence` into `projects/<resolved_project>/<self_id>.md` IMMEDIATELY after the LLM exits — no waiting for the next cadence-driven echo_commune. New `RouteLiveCtxOutcome` enum + `ReentrancyGuardSentinel` (Drop-based) prevent recursive route re-entry; new `live_ctx_route_in_flight: RefCell<bool>` field tracks the guard. Three call sites in `src/live/wrapper/claude.rs` (init / resume / final) invoke the helper. Defect G HAPPY-PATH from `.planning/debug/todlando-project-context-not-persisted.md`.

### BTS
- **Plan 25.3-05 (Defects E + F + G HAPPY-PATH + ANSI):** new `pub fn strip_ansi` (`src/common/output.rs`) with two inline tests; `route_live_context_md_if_changed` helper (`src/live/wrapper/mod.rs:639`) is the single post-LLM hook entrypoint; new `RouteLiveCtxOutcome` enum + `ReentrancyGuardSentinel` Drop sentinel guarantee single-flight route execution; line-615 destructive `fs::remove_file` in `src/live/context.rs` removed (D-E-01 single-writer contract); 4 inline `src/live/context.rs` tests flipped to assert append-then-persist (drop file survives append); `psyche.md` absorption rule 4 tightened with explicit prohibition against direct `projects/` writes — guarded by new `psyche_md_forbids_projects_write_tool_calls` static test in `tests/native_owl.rs`; B1 invariant test `route_two_slice_with_precedence_llm_after_llm_writes_both` in `src/owl/echo_commune.rs` locks the LLM-after-LLM idempotent precedence path; `tests/file_drop_integration.rs` Tests 5 + 6 flipped to assert single-writer behavior. Full wrapper-module suite green (117 tests including 4 new HAPPY-PATH guards: Test A live→live persists, Test E live→llm precedence honored). G2 self-heal (respawn on malformed live_context.md) SPLIT OUT to Plan 25.3-06 per cycle-3 plan-checker recommendation. Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-05-PLAN.md`.

## [1.11.6] - 2026-05-23

### Fixed
- **Inbound `<project-context>` envelopes now persist synchronously to disk.** A commune file_drop carrying `<project-context>...</project-context>` used to be fed only to the Psyche LLM, which sometimes dropped the slice from its reply — leaving `projects/<resolved_project>/<self_id>.md` never written. The Psyche wrapper now routes inbound commune bodies through the two-slice writer BEFORE the LLM handoff, so the project slice reaches disk regardless of what the LLM does. Combined with the v1.11.5 fixes (resolver correctness, encoding contract, absorption rules), inbound `<project-context>` envelopes now materialize on disk within seconds of arrival rather than after a round-trip-via-LLM dance.
- **Stale-LLM-emit no longer overwrites freshly routed direct writes.** When the wrapper writes an inbound envelope directly, a subsequent Psyche-LLM emit (cadence-driven echo_commune) could clobber the just-written body with a slightly older snapshot. The two-slice writer now stamps every write with an out-of-band `<!-- spt:source=direct|llm spt:routed_at=... -->` precedence marker; LLM writes within a configurable protection window (`.planning/config.json` `route_guard_window_secs`, default 60) after a recent direct write are SUPPRESSED with a `[ROUTE-GUARD] decision=SUPPRESS` log line. Direct writes always proceed and update the marker.
- **Signoff route now uses the same shared resolver as commune.** Previously `route_two_slice_signoff` resolved the project via process cwd (`derive_current_repo_names`) while commune used Self's perch info.json — disagreement was possible when the signoff caller ran from a different cwd than the commune-fire wrapper. Both paths now consume `resolve_self_project_name_via_info_cwd`, return granular `RouteOutcome`, and write through the precedence-aware helper.

### BTS
- **Plan 25.3-04 (Defect A — wrapper-direct inbound routing, Option 1 LOCKED):** new `pub(crate) fn route_inbound_commune_body(self_id, body, source)` testable seam in `src/live/wrapper/mod.rs`; `process_file_drop`'s `commune` arm calls it BEFORE composing the LLM envelope. New `RouteOutcome` + `SliceWriteState` enums (`Written`, `SkippedNoSlice`, `SkippedNoProjectName`, `IoError(String)`) in `src/owl/echo_commune.rs` propagate granular per-slice state — no false `project_routed: true` when the project slice silently skipped (cycle-3 HIGH 1). `route_two_slice_outcome` uses ONLY `resolve_self_project_name_via_info_cwd` — no `derive_current_repo_names` fallback (cycle-4 HIGH 2). `route_two_slice_with_precedence` adds YAML-front-matter-aware precedence marker placement: marker AFTER closing `\n---\n` fence when YAML present (preserves `parse_yaml_frontmatter` byte-0 contract at `src/live/context.rs:197`), line 1 otherwise (cycle-5 HIGH 1). Outbound `run_echo_commune` rewired to `route_two_slice_with_precedence(..., source="llm")`. `route_two_slice_signoff` in `src/live/signoff.rs` refactored to parity (cycle-4 HIGH 3). New `read_context_body_stripped` helper in `src/common/owlery.rs` strips the precedence marker from BOTH the post-YAML position AND line 1 before context bodies reach the Psyche LLM prompt (cycle-4 HIGH 1 + cycle-5 HIGH 1). All known prompt-builder read sites converted: `build_current_context_blocks` (echo_commune.rs:488 + :515), `download_payload` (context.rs:421 + :464; cycle-5 HIGH 2), `compose_init_signoff_payload` (transparently via the shared builder). New `read_route_guard_window_secs` reads the configurable suppression window (cycle-4 MEDIUM); deployed-wrapper cwd-relative-config caveat documented as known follow-up.
- 30+ new INLINE tests across `src/common/owlery.rs`, `src/owl/echo_commune.rs`, `src/live/wrapper/mod.rs`, `src/live/signoff.rs`, and `src/live/context.rs`. Highlights: `read_context_body_stripped` 12 unit tests covering all three site layouts (line-1, post-YAML, no-marker, YAML-malformed, YAML-over-cap); `prepend_precedence_marker` + `parse_precedence_marker` 10 placement + parser tests; `route_two_slice_with_precedence_llm_suppressed_when_recent_direct_exists` validates the SUPPRESS path; `precedence_marker_after_yaml_frontmatter_preserves_psyche_stamp_parsing` (cycle-5 HIGH 1 back-compat) asserts `parse_yaml_frontmatter` + `strip_file_head_frontmatter` + `download_payload` all remain functional with a marker present; `marker_invisible_in_all_known_read_sites` (cycle-5 HIGH 2 behavioral) asserts marker absent from `download_payload`, `build_current_context_blocks`, and `compose_init_signoff_payload`. Phase-level invariant test `phase_25_3_invariant_inbound_two_slice_envelope_persists_correctly` covers Defects A + B2 + C + D end-to-end. Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-04-PLAN.md`.

## [1.11.5] - 2026-05-23

### Fixed
- **Psyche project-context envelopes now persist to disk for tracked agents.** A todlando-style agent could receive a commune body containing `<project-context>...</project-context>`, send it through Psyche, and never see `projects/<project>/<self_id>.md` materialize. Three compounding defects closed together: (a) the Psyche haiku's prompt-builder was resolving the project name from process cwd (which equals `psyches/tracked` for haiku invocations), so the prompt was keyed on the wrong project — fixed by reading Self's perch `info.json` `cwd` field instead; (b) the body shown to the Psyche LLM had asymmetric encoding (outer `<EVENT>` framing visible, inner `<live-context>` entity-encoded as `&lt;live-context&gt;`) — fixed by introducing a wrapper LLM-stdin boundary helper that extracts and decodes the body before stdin write, so the LLM sees a natural-language prompt with literal envelope tags; (c) `psyche.md` only taught emission of two-slice envelopes — there was no explicit rule for ABSORBING inbound `<project-context>` envelopes — fixed by a new `<absorption>` section that teaches inbound-merge + re-emit on the next context-save cadence. After this deploy, an inbound `<project-context>` envelope reaches disk after one round-trip through the Psyche LLM.

### BTS
- **Plan 25.3-01 (Defect B2 — project-name resolver):** new `pub(crate)` helpers `project_name_from_cwd_path` and `resolve_self_project_name_via_info_cwd` in `src/common/owlery.rs` follow a STRICT git-ancestor-or-None contract (no synthetic projects for nonexistent paths or non-git dirs). `build_current_context_blocks` + `resolve_self_project_stamp` rewired through the shared helper. `CURRENT_PROJECT_CONTEXT` prompt header now carries `(name=<X>)` debug-visible token for verification. Belt-and-braces `tracked` filter at all three resolver layers; layer-2 legacy-perch field context-sensitized via cwd peek. Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-01-PLAN.md`.
- **Plan 25.3-03 (Defect C — encoding contract):** new `pub(crate)` helpers `event_body_unescape` (inverse of `event_body_escape`) and `compose_llm_prompt_from_envelope` (wrapper LLM-stdin boundary). Boundary helper applied INSIDE `resume_session_with_exit` + `final_session` — single edit point catches all current and future callers; idempotent fallthrough makes raw `PULSE_TRIGGER` paths safe. Single 80-line ENCODING CONTRACT doc block at top of `src/owl/poll.rs` covering producer encode sites, transport invariants, consumer decode sites, and the LLM-stdin boundary as sole body-decode site. 16 new INLINE tests: 9 in `src/owl/poll.rs::mod tests` (round-trip + EVENT-PART chunk boundaries with literal `</EVENT>`, `<br>`, and `&amp;` entities at split points; dual-`<br>` round-trip preserving user prose); 7 in `src/live/wrapper/mod.rs::mod tests` (4 boundary-helper tests + 2 encoding-chain scenarios + 1 exactly-once-encoding guard). Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-03-PLAN.md`.
- **Plan 25.3-02 (Defect D — psyche.md absorption rules):** new `<absorption>` section in `psyche.md` (rules 1-6: live + project absorption, baseline-not-required, SPT-routes-you-emit, encoding assumption referencing 25.3-03 DECODED-at-LLM-stdin contract, defensive parse). Stale `<cwd_project>` phrasing in `<output_envelope>` replaced — receivers split by tag name; SPT resolves the destination project via Self's perch info.json (25.3-01). `commune.md` + `signoff/SKILL.md` cross-aligned with the same "emit this envelope; SPT routes it to disk" phrasing and explicit `projects/<resolved_project>/<self_id>.md` schema (correcting the user's mistaken flat-layout expectation). Two static prompt-contract tests in `tests/native_owl.rs`: `psyche_md_contains_25_3_absorption_section` (cycle-2 MEDIUM) + `skill_files_have_no_project_context_name_attr` extending the Option-A no-name guard to commune.md + signoff/SKILL.md (cycle-3 MEDIUM). Tests use only `include_str!` + `std::fs::read_to_string` — no `pub(crate)` calls — so integration-crate placement is correct (cycle-4 HIGH 4 N/A). Source: `.planning/phases/25.3-project-context-envelope-persistence-encoding-defects/25.3-02-PLAN.md`.
- Consolidated deploy: Plans 25.3-01 + 25.3-03 + 25.3-02 ship together in v1.11.5. `psyche.md` is `include_str!`-embedded into the binary; the rebuild ships the new teaching automatically. Plan 25.3-04 (wrapper-side `route_inbound_commune_body` + precedence marker + signoff-path refactor) is a separate subsequent deploy.

## [1.11.4] - 2026-05-22

### Fixed
- **Pending signoffs no longer get silently eaten by `$LIVE start` or `$LIVE revive`.** A signoff body written while the agent was offline used to be printed to the terminal and then deleted, with no copy reaching the Psyche. Fresh signoffs are now forwarded to the Psyche as a "latent signoff" event, and the signoff file is removed only after the body is queued.
- **`$LIVE revive` no longer drops boot rows on cold-start.** The wrapper-state read budget extended from 2 seconds to 20 seconds, matching the worst-case cold-start window. Routine warm-cache reads still resolve in well under a second; only slow boots benefit.
- **Stale `index.lock` files no longer block sessions-log seal.** A crashed `git` process used to leave a 0-byte lock that wedged every subsequent commit for that agent. The next `$LIVE` boot now clears the abandoned lock automatically (any live `git` process is left alone).
- **Wrapper poll loop now sees its own Psyche perch under the nested layout.** After v1.11.0 moved Psyche perches under `owlery/<agent>/nested/`, the wrapper was still looking at the old flat location and exiting its poll loop one iteration in. The wrapper now resolves the correct nested location, falling back to the flat location for legacy agents that have not relocated yet.
- **`git -C <tracked-root> status` no longer reports ghost-repo noise.** A leftover `tracked/.git/` directory from earlier deploy layouts is now cleaned up the next time the binary starts. Idempotent — once gone, stays gone.

### BTS
- Wrapper-state retry budget unified across boot and signoff trigger paths through a single shared helper + const (`WRAPPER_STATE_MAX_ATTEMPTS = 80`); every successful read emits an elapsed-ms diagnostic line for future drift detection.
- New `wrapper_state_path_resolved(self_id, psyche_id)` helper added to `src/common/wrapper_state.rs`; tries the nested perch path first, then falls back to the flat path. When both files exist it prefers the fresher mtime (tie-breaking to nested). Writer call sites keep the inline flat join with a migration-window comment, deferring a writer-side flip to a future phase. 8 wrapper-side production call sites swapped to the resolver; Self-side call sites (`echo_fire.rs`, `orphan.rs`) intentionally left on the flat path.
- Stale-lock probe gates on `len() == 0 && mtime > 60s` to preserve any live `git` commit (which holds either non-zero contents or a sub-60s timestamp). Best-effort `fs::remove_file` per the established soft-fail idiom.
- Latent-signoff forward routes through the existing `send::deliver_body_anonymous` TCP-first / spool-fallback path and the existing `event_attr_escape` / `event_body_escape` helpers. Envelope shape is `<EVENT type="latent signoff" from="..." written_at="..." cleared_from="...">BODY</EVENT>` — disjoint from `is_init_signoff_envelope`'s predicate by construction, so wrapper-side `drain_stale_init_signoffs` does not eat it. `LATENT-SIGNOFF-FORWARDED` status line gated behind the delivered-Ok arm so the success message does not fire on the panic-preserve path.
- Ghost `tracked/.git/` cleanup added to `migrate_legacy_if_needed`; sentinel-free unconditional `remove_dir_all` after `exists()` short-circuit. Existing `migrate_legacy_dot_git_left_in_place` test inverted to `migrate_legacy_removes_ghost_dot_git` + idempotency companion.
- `next_generation` dropped a redundant intermediate binding (`clippy::let_and_return`).
- 17 new integration tests (`tests/native_tracked_stale_lock.rs`, `tests/native_wrapper_state_retry.rs`, `tests/native_wrapper_path_resolver.rs`, `tests/native_latent_signoff_deliver_then_die.rs`) plus 1 in-module unit test pinning the envelope-shape disjointness invariant. Source: `.planning/phases/25.2-doyle-cluster-fix-candidates-blast-radius-sanity-check-acros/`.

## [1.11.3] - 2026-05-22

### Fixed
- **First-commune-in-project no longer silently routes project-bound work into the live slice.** The Psyche haiku's `CURRENT_PROJECT_CONTEXT` prompt block was being omitted entirely whenever the per-project context file did not yet exist on disk — which is always the case on a brand-new agent/project pairing. Combined with the haiku rule "omit `<project-context>` if no `CURRENT_PROJECT_CONTEXT` block in the prompt", this created a chicken-and-egg: the file never gets written because the haiku never emits the envelope, and the haiku never emits the envelope because the file does not exist. Now the prompt block is keyed on the cwd resolving to a project name, not on file existence — first-time-in-project pairings receive the block with a literal `(none — first commune in project)` body, the haiku emits `<project-context>` correctly, and the receiving side writes the per-project file. Subsequent communes inherit the populated file via the existing path. Mirrors the v1.11.2 Self-side detection-rule fix on the haiku side; closes the bootstrap loop end-to-end.

### BTS
- `src/owl/echo_commune.rs::build_current_context_blocks` now emits `CURRENT_PROJECT_CONTEXT` whenever `derive_current_repo_names().first()` resolves, regardless of whether `projects/<cwd_project>/<self_id>.md` exists; missing file renders as the literal `(none — first commune in project)`. Signoff inherits via the shared helper. `psyche.md` `<output_envelope>` rule 2, `<init_signoff>`, and `<context_save>` sections rewritten to teach that the first-commune literal counts as the block being PRESENT — emit both envelopes. `psyche.md` is `include_str!`'d into the binary, so the rebuild ships the new teaching automatically. Two pre-existing unit tests that asserted the buggy "omit-on-missing-file" behavior flipped to assert the new contract; 10/10 prompt tests, 70/70 echo_commune tests, 52/52 signoff tests pass. `Cargo.lock` owl crate version bumped from 1.11.1 → 1.11.2 (missed from the v1.11.2 deploy commit). Debug session `.planning/debug/sentinel-bootstrap-gap.md` archived to `resolved/`. Source: `.planning/quick/260522-9zk-haiku-bootstrap-fix-key-project-block-on-cwd/`.

## [1.11.2] - 2026-05-22

### Changed
- **`/spt:commune` and `/spt:signoff` skill docs clarify the in-project detection rule.** The detection signal for "am I in a tracked project?" now keys on the `<current ... project="..."/>` tag's `project` attribute, which `$LIVE psyche-download` emits unconditionally whenever any payload is produced. The previous detection rule keyed on the `<project-context-resolved name="..."/>` sentinel, which fires only when the project's context file already has prior content — so first-time-in-project agents had no sentinel and routed project-bound work into `<live-context>` even though the project clearly resolved. The sentinel is now described as a secondary "project file has prior content" indicator. Three routing rules (D-25.1-01..03) and worked examples preserved; symmetric wording applied to `commune/SKILL.md`, `commune/commune.md`, and `signoff/SKILL.md`.

## [1.11.1] - 2026-05-22

### Changed
- **Commune / signoff / live / revive skill docs teach the Phase 25 two-slice envelope contract.** The Self-authored side (`/spt:commune`, `/spt:signoff`) now spells out that commune and FINAL-COMMUNE bodies must wrap content in `<live-context>` and (when in a tracked project) `<project-context>` slices. The receive side (`/spt:live` echo_commune catalog, `/spt:revive`) now explains that an `EVENT type="echo_commune"` brief carries those two slices and that both absorb as a single SessionStart resume brief. `commune.md` gains three worked examples covering the in-project-both / in-project-empty-project / outside-project branches; the Memformat Guide is reframed to decouple topic-content (what to think about) from envelope-routing (where it goes).

### BTS
- New deterministic, grep-able sentinel `<project-context-resolved name="..."/>` is emitted by `download_payload()` in `src/live/context.rs` (line 465) when a project context resolves, gated by all three guards (cwd_project + file exists + read success). Self agents can now detect in-project status from `$LIVE psyche-download` output without LLM-judgment heuristics, symmetric with the existing `<psyche-stamp/>` / `<current/>` markers. Two new unit tests cover the positive and negative branches; `live::context::tests` 56/56 pass. Source: `.planning/phases/25.1-revise-commune-signoff-skill-docs-echo-commune-instruction-t/`.

## [1.11.0] - 2026-05-21

### Added
- **Nested perch layout for Psyche and worker perches.** Psyche perches now live under `owlery/<agent>/nested/<agent>-psyche/` instead of as siblings of the Self perch. Worker perches similarly nest under `owlery/<agent>/nested/<agent>-w<N>/`. Legacy flat perches auto-relocate to the nested layout on first start under the new binary, so existing agents keep working without manual intervention. Stale legacy entries that can't be safely relocated (e.g., live pid in flat slot) are surfaced by `$OWL doctor` rather than silently overwritten.
- **Project-aware Psyche context downloads and routing.** `$LIVE psyche-download` is now cwd-aware: when invoked inside a known project, it appends a `<project-context>` slice (sourced from Phase 24's forked-repo layout under `psyches/tracked/projects/<cwd_project>/`) on top of the cross-project `<live-context>` slice. Outside any known project, falls back to live-context only. Communes and signoffs route project-scoped payloads to per-project storage based on cwd, while cross-project entries continue to update the agent's general `live_context.md`.
- **`$OWL doctor` surfaces nested-layout health.** New checks: duplicate detection when the same id appears at BOTH the legacy flat path AND the nested path (D-17); orphan-psyche detection for nested Psyche perches without a live parent (D-18); orphan-worker count (D-21); OFFLINE Self/Psyche perches with grace-window persistence (D-05). Doctor's output now reports per-perch parent/child relationships.
- **Tree-shape rendering in `$OWL list` and `$LIVE list-psyches`.** The nested perch hierarchy is rendered visually: parent perch row, indented `└─` Psyche row, indented `├─`/`└─` worker rows. The terse one-line-per-agent rollup from v1.10.23 still applies at the top level.
- **Two-slice envelope for haiku-model output.** The Psyche's haiku child model is now taught a `<live-context>` + `<project-context>` envelope so its commune/signoff output can be routed to the correct storage slice. The contract: omit `<project-context>` when the prompt had no project block, and merge (don't overwrite) on the receiving side. `psyche.md` is rebuilt into the binary via a new `build.rs` `cargo:rerun-if-changed=psyche.md` directive.

### BTS
- New foundation in `src/common/owlery.rs`: `nested_perch_dir(parent, child_id)` composes the nested path; `is_worker_perch_path` / `is_psyche_perch_path` are path-aware predicates that supersede the prior name-pattern checks; `enumerate_perches` is recursive (descends into `nested/` subdirs); `safe_to_remove` grace boundary is `>= grace` (Wave 2 deviation Rule 1). Plus `sweep_own_orphaned_workers` + `is_perch_online_at(&Path)` for per-perch liveness.
- New module `src/common/envelope.rs` — `TwoSlicePayload` + `parse_two_slice` + `extract_tag` parser, consumed by `src/owl/echo_commune.rs::route_two_slice` (commune write path) and `src/live/signoff.rs::route_two_slice_signoff` (signoff write path; wired into `run()` and `signoff_result()`).
- `src/live/start.rs` gains D-16 psyche relocate + nested-perch spawn; pre-relocate COLLISION check honors Pitfall #4 pid-dead precondition (Wave 2 deviation Rule 2). `src/live/signoff.rs` gains D-20 sweep call after signoff write. `src/owl/hook_subagent_start.rs` migrates SubagentStart-hook worker spawn to the nested layout (B1).
- 4 new integration tests: `tests/handoff_integration.rs::{nested_psyche_layout, psyche_relocate_on_start}`, `tests/native_owl.rs::{nested_worker_layout, sweep_own_orphaned_workers_e2e}`. Plus 21 new unit tests across owlery, envelope parser, haiku-prompt builders, and signoff prompt composers; full lib suite 768/769 pass (the 1 failure is a pre-existing debug-only test unrelated to this phase). Source: `.planning/phases/25-perch-nesting-psyche-workers-wire-psyche-download-to-forked-/`.

## [1.10.26] - 2026-05-21

### Changed
- **`$LIVE start` no longer schedules a Psyche pulse by default.** Previously, `$LIVE start <id>` (no `--period`) ran the Psyche on a 1200-second (20-minute) pulse cadence, burning a Claude resume turn every 20 minutes whether or not the agent needed a nudge. The new default is **no scheduled pulse**: the wrapper still wakes on real events (messages, alarms, communes, file-drops, INIT_SIGNOFF, echo-commune cadence) — pulses just stop firing on a timer. Pulses are now opt-in via `$LIVE start <id> --period <seconds>` (or `--period 1200` to restore the prior 20-minute cadence). `$LIVE start <id> --period 0` is also accepted as an explicit no-pulse opt-in. `--period 1..=59` is still rejected with the new wording: `Minimum pulse period is 60 seconds (or 0 to disable)`. `$LIVE revive` follows the same default. Skill docs (`/spt:live`, `/spt:revive`) now describe pulses as opt-in.

### BTS
- Internal representation: `period: u64` with `0` as the no-pulse sentinel. `start::run` and `live_start_result` flip `period.unwrap_or(1200)` to `period.unwrap_or(0)`; minimum-60 guard relaxes to `period > 0 && period < 60` (allows 0, still rejects 1..=59). `WrapperState.poll_psyche` switches argv from a fixed `[&str; 7]` to a `Vec<&str>` and conditionally omits `--pulse-interval` when `period == 0` — NEVER passes literal `--pulse-interval 0`, which would cause `Instant::now() + Duration::from_secs(0)` to already be past and tight-loop `PULSE_TRIGGER` on every iteration. `build_agents_json` substitutes the full segment `{{period}} seconds` in `psyche.md` so the identity-block line reads `Pulse period: disabled (no scheduled pulses; event-driven wake only)` in opt-out mode. Two regression tests added in `tests/cli_parse.rs`. Source: `.planning/quick/260521-oyi-update-live-start-to-have-default-period/`.

## [1.10.25] - 2026-05-21

### Removed
- **`$LIVE context-save` subcommand removed.** Saving the Psyche's context is now done exclusively by the Psyche LLM itself (it writes `live_context.md` directly via the Write tool on its own cadence — first invocation, INIT_SIGNOFF, and during context-save events). The operator-callable shortcut was a footgun: a smoke-test invocation such as `$LIVE context-save doyle "ping"` would overwrite a rich, hard-earned context with a 228-byte stub. The live-agent skill banner no longer advertises the command. If you previously scripted `$LIVE context-save`, the call now fails with `unrecognized subcommand`; let the Psyche save its own context. See `.planning/debug/doyle-fresh-ctx-after-v1-10-16.md` for the incident that motivated removal.

## [1.10.24] - 2026-05-21

### Fixed
- **Psyche pulses no longer waste context on chunk reassembly.** When the wrapper polled the Psyche perch for a long message, it was receiving the same `<EVENT-PART>` chunks meant for the live-agent's terminal stream — forcing the Psyche session to spend tokens stitching them back together for zero benefit (its input pipe has no per-notification cap). Long messages now arrive at the Psyche as a single envelope; live-agent terminal delivery still chunks as before.

## [1.10.23] - 2026-05-21

### Added
- **Per-agent activity index that survives across sessions.** Each tracked agent now has its own `info.json` at `%LOCALAPPDATA%\spt\psyches\tracked\agents\<id>\info.json` recording when it last ran, on which machine, and in which project — so `$LIVE doctor` and future cross-session lookups can answer "where did I leave off?" without crawling per-perch state. The file is updated on boot, commune, and signoff.
- **`$LIVE doctor` shows per-agent activity sub-lines.** Under each tracked-agent row, two indented lines now report `last_started=…, last_machine=…, last_project=…` and the on-disk `path=…info.json`, so a glance at the doctor output tells you which agents are stale vs. fresh and where their state lives.
- **Project history rows now carry a `branch` field.** Each `project_history` entry on both perch-side and tracked-side records `{name, branch, first_seen, last_seen}` instead of just a project name, so the history captures which git branch the agent was on when it touched a repo.
- **Legacy agents are auto-migrated, idempotently.** Pre-existing agents that pre-date the tracked-agents index get their `info.json` synthesized on first boot under the new binary. Re-running boot is a no-op — the file is not rewritten if already present.

### Changed
- **`$OWL list` and `$LIVE list` default to a terse one-line-per-agent rollup.** Output now shows `ACTIVE:{id}` / `OFFLINE:{id}` for owls and `LIVE:{id}` / `OFFLINE:{id}` for live agents. Pass `--verbose` to restore the previous full dump (pending count + `info.json` body + stale suffix), byte-identical to prior output.

### BTS
- New crate-wide `src/common/time.rs::now_iso_utc()` RFC-3339 UTC timestamp helper; promoted `src/common/git.rs::hostname()` to `pub(crate)` and added `head_branch_or_empty(cwd)` for cross-module identity and branch resolution.
- `InfoJson.project_history` ships with a legacy-compatible deserializer accepting both `Vec<String>` and `Vec<ProjectHistoryEntry>` shapes; mixed-shape inputs are normalized via a two-pass `retain_mut` dedup so a legacy file carrying both String and Object forms for the same project collapses to a single Object (Plan 24.1-05 Rule 1 hardening of `normalize_legacy_strings_to_objects`).
- 5 production `bump_tracked_agent_info` call sites wired across `src/owl/poll.rs`, `src/live/start.rs`, `src/live/wrapper/claude.rs`, `src/owl/echo_commune.rs`, `src/live/signoff.rs`; commit-funnel amendment also wired in `src/live/context.rs` (`run_save` + `run_amend_signoff`) and `src/live/fork.rs`. Each write is guarded by pre/post `Value` byte-equality so identical-payload bumps are short-circuited.
- 33 new lib tests added across the phase (foundation primitives, owlery helpers, migrate synthesis, doctor sub-lines, mixed-shape dedup); full lib suite 703 passed / 0 failed / 3 ignored.
- Phase 24.1 (tracked-dir / forked-repo layout follow-up to Phase 24) closed under this version.

## [1.10.22] - 2026-05-20

### Fixed
- **Subagent spawn no longer wakes your live-agent stream.** When a subagent created its working perch, the `[WORKING_PERCH_NOTICE]` was leaking through to the active listener as a real-time message — interrupting the agent's idle posture for a non-actionable notice. The notice is now suppressed on the stream as originally intended; it still arrives through the hook channel where it belongs.

### BTS
- Three of four spool-drain sites in `src/owl/poll.rs` still called unfiltered `drain_all`/`drain_all_with_metadata` (startup, 5-min timeout, idle-mode TCP-wake), letting deferred rows leak whenever real traffic or the D-09 timeout fired. All three swapped to deferred-skipped variants; new helper `spool::drain_non_deferred_with_metadata` introduced.
- Added a belt-and-suspenders hard-gate in `emit_event_line` that drops informational bodies (`is_informational(body)`) from non-self senders, so any future regression that reintroduces an unfiltered drain still cannot leak info bodies as `<EVENT type="msg">` on stdout. Self-originated alarms and typed envelopes bypass the gate.
- Two regression tests added in `src/common/spool.rs` covering the new deferred-skipped drain helper.
- Debug session archived to `.planning/debug/resolved/working-perch-notice-priority-leak.md`. Closes the regression tracked in the project memory doc.

## [1.10.21] - 2026-05-20

First version authored under the new four-bucket discipline (Added / Changed / Fixed / BTS). BTS content is for recordkeeping only and is filtered out of the version-change prompt surfacing.

### Changed
- **Update prompt now hides internal-only changes.** When you say "Yes, full changelog" or "Yes, highlights only" at the post-update prompt, behind-the-scenes work (repo plumbing, refactors, test-only changes, deploy mechanics, commit reverts) no longer appears — you only see what actually changed about how SPT looks, runs, or behaves.

### BTS
- Added a `### Bucket discipline for stub fill-in` subsection to `docs/DEPLOY.md` defining the four buckets and the UX-language rule for stub authors.
- Reworded the resolved-branch AUQ `<instructions>` in `src/owl/version_changelog.rs` so both "Yes, full changelog" and "Yes, highlights only" instruct the rendering session to OMIT `### BTS` sections. Raw-string delimiter escalated to `r####"..."####` to embed `### BTS` literals safely.
- Pinned `### BTS` + `behind-the-scenes` invariants in `tests/version_changelog.rs::block_reason_matches_reference_invariants`; dropped the now-stale "Pick 2-5 most impactful" assertion in the inline resolved-branch test.
- Added `branch` field to `project_history` entries in Phase 24.1 planning docs.
- Pre-v1.10.21 CHANGELOG entries left as-is; the BTS-skip filter is a no-op on entries without a `### BTS` section.

## [1.10.20] - 2026-05-20

### Fixed
- **Version-change owl message routed via TCP-first `deliver_body`.**
  `src/owl/version_changelog.rs` was constructing the `<spt-version-changelog>`
  payload and writing it straight to the recipient's spool, bypassing the
  conventional TCP-first delivery path used by every other owl message.
  Net effect: when a Stop-hook fired the version-change notice into a live
  agent's perch, delivery skipped the listener's TCP fast-path and landed
  only on disk; the receiver did not observe the message until its next
  spool poll tick, and `priority="high"` HIGHEST PRIORITY banner ordering
  could lose to later TCP-delivered messages racing into the EVENT stream.
  Fix: payload now goes through `deliver_body` like any other owl message
  — TCP attempt first, spool fallback on connect failure or peer absence.
  Behavior matches the rest of the messaging surface; version-change
  notices arrive in-line with the high-priority banner the receiver
  expects.

### Reverted
- **WORKING_PERCH_NOTICE TCP-first flip (260520-tge-01).** Both commits
  from the quick task (`refactor` flipping `hook_subagent_start` to
  TCP-first, plus its companion doc-comment cleanup) reverted after
  regression surfaced — the working-perch notice is a deferred-delivery
  surface by design, and the TCP-first flip caused it to wake Self's
  poll listener mid-turn (the regression already tracked in
  `feedback_working_perch_notice_deferred_regression`). The deferred
  semantics are restored; the broader fix for the wake-on-deferred
  behavior remains tracked separately.

## [1.10.19] - 2026-05-20

Two unrelated fixes bundled.

### Fixed
- **psyche.md path drift after Phase 24 D-13 migration.** The Psyche LLM
  prompt template still told the Claude session to read/write
  `{{self_id}}.md` as a relative path, while Phase 24 had migrated the
  Rust-side writers/readers to `agents/{id}/live_context.md`. The wrapper
  spawns Psyche with `current_dir = psyches/tracked/` (the flat-layout
  root), so the LLM's relative-path I/O resolved to the legacy
  `psyches/tracked/{id}.md` location. Self-clobbering loop: LLM reads
  legacy path Ã¢â€ â€™ "starting fresh" Ã¢â€ â€™ writes fresh-init skeleton to legacy
  path Ã¢â€ â€™ next `ensure_seed()` orphan-recovery pass renames that skeleton
  into the worktree, OVERWRITING the canonical context file. User-visible
  symptom: every `/live` invocation reported "Fresh spawn, Generation N"
  even after many prior generations of accumulated context.
  Fix: all five `{{self_id}}.md` references in `psyche.md` replaced with
  `agents/{{self_id}}/live_context.md`. Wrapper cwd intentionally left at
  `psyches/tracked/` (Phase 25 will need Psyche to write under both
  `tracked/projects/` and `tracked/agents/` from the same cwd). After
  the fix, LLM read/write resolves directly into the per-agent worktree;
  orphan-recovery has nothing to clobber.
  Operator note: agents already corrupted before this fix (worktree
  `live_context.md` is a fresh-init skeleton) must be recovered out of
  band via `git checkout <last-rich-commit> -- live_context.md` inside
  the agent's worktree under `$SPT_HOME/psyches/tracked/agents/{id}/`.

### Reverted
- **n4b defect 2 (owl-message priority `high` Ã¢â€ â€™ `info` for version-change).**
  Reverted back to `priority="high"`. The original n4b rationale (the
  HIGHEST PRIORITY banner misleads Claude into treating the changelog AUQ
  as urgent inter-agent communication) does not apply because the
  payload is generated as the agent's turn is ending. Stop hook is the
  only emission site; "STOP your current task" is structurally a no-op
  for the receiving agent. Demoting to info hid the version transition.
  `is_informational` no longer matches `<spt-version-changelog>`;
  hook_output tests inverted to assert priority=high + HIGHEST PRIORITY
  banner. n4b SUMMARY.md marked defect 2 as N/A; defects 1 and 3 still
  in force.

## [1.10.18] - 2026-05-20

Quick task 260520-r2f: fresh-init + resume commune references pointed at wrong
write path. Three doc/context drifts (one skill, two embedded context strings)
told the orchestrator to deliver the first commune via channels that bypass the
v1.8 commune EVENT envelope. Aligned all three with the canonical Write-tool
path documented by `/spt:commune`.

### Fixed
- `plugin/spt/skills/live/SKILL.md:220` (FRESH-01/02 native-Other branch) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  removed `$OWL deliver` (plain owl messaging bypasses commune consume path)
  and `$LIVE commune` heredoc (forbidden by `/spt:commune` skill). Replaced
  with: `$LIVE start <id>` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Write tool to `.claude/<id>-commune.md` with
  augmented summary body. Listener picks up file-drop, wrapper composes v1.8
  EVENT envelope and ingests.
- `src/owl/resume.rs` resume_xml live branch (L59) and print_skill_context
  live Self perch (L107) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â both drifted strings naming `$LIVE commune <id>
  <message>` as the Psyche-update path. Replaced with `/spt:commune` pointer
  + `.claude/<id>-commune.md` hint. Format-string `{}` placeholder counts
  unchanged.

### Out of scope (intentionally left)
- `src/live/commune.rs` impl comment and `src/live/mod.rs` CLI usage hint:
  CLI still works for tooling, only skill-facing references corrected.
- `psyche.md:42` Psyche-outbound rule: orthogonal to fresh-init/resume path.

## [1.10.17] - 2026-05-20

Quick task 260520-pzs: poll-listener events get truncated by Claude Code Monitor
tool at 500 chars per notification block. Fix via `<EVENT-PART>` chunking emitted
when wire-line exceeds threshold; receiver reassembles by `id` + `seq` and applies
existing `<br>`/HTML-entity decode rules to the joined body.

### Added
- `src/owl/poll.rs::chunk_if_oversized` and `EVENT_LINE_THRESHOLD = 400` const ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  any emitted wire line over the threshold splits into N
  `<EVENT-PART seq="K/M" id="<8hex>" ...>` lines. First part carries full attrs
  (type / from / timestamp / note); continuation parts carry only `seq` + `id`.
  Chunk boundaries use `char_indices` for UTF-8 safety. Applies uniformly across
  the regular-msg, alarm, and typed-envelope (`echo_commune` / `file_drop` /
  `init_signoff`) emit branches.
- 4 unit tests in `src/owl/poll.rs` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â short body unchanged single `<EVENT>`,
  long body N `<EVENT-PART>` chunks, typed-envelope long body chunks correctly,
  UTF-8 boundary safety on chunk split.
- `plugin/spt/skills/listen/SKILL.md` and `src/owl/resume.rs`
  spacetime-reorientation block ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â added `<EVENT-PART>` reassembly contract:
  buffer by `id`, concatenate `seq=1..M` in order, then decode; drop orphan
  parts (`seq=K/M` with no prior `seq=1/M`) with a single stderr warning.

### Validated
- M0 empirical measurement (`.planning/quick/260520-pzs-*/260520-pzs-M0-FINDINGS.md`)
  pinned cap at exactly 500 wire chars per Monitor notification (envelope + body
  inclusive). Two probes with varying `from` attr length both truncated at 500.
  Threshold = 400 leaves 100-char (20%) headroom.

### Backward compat
- Bodies under threshold emit byte-identical `<EVENT>` lines as before. All five
  existing envelope shapes (`msg`, `alarm`, `echo_commune`, `file_drop`,
  `init_signoff`) preserved when short. Bash `--once` fallback emits same wire
  format (chunked or not) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `--once` remains a pure exit gate.

## [1.10.16] - 2026-05-20

## [1.10.16] - 2026-05-20

Phase 24 (v1.8 Psyche Restructure): forked-repo layout under `psyches/tracked/` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â
bare seed + per-agent + per-project worktrees; per-fire commits carry the Phase 23
Stamp as commit-message trailers; per-agent sessions audit log with truncate-on-rollover.

### Added
- `src/common/tracked.rs` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â bare-seed lifecycle (`ensure_seed`), lazy worktree
  creation (`ensure_agent_worktree` / `ensure_project_worktree`), write-path
  pipeline (`commit_payload` / `commit_agent_payload` /
  `commit_agent_payload_with_timeout`), sessions log writer
  (`append_session_entry` with D-18 dedup contract), generation seal-on-rollover
  (`seal_and_rotate_sessions_log`), migration (`migrate_legacy_if_needed`),
  doctor data-source (`doctor_status_rows`).
- `src/common/git.rs::Stamp::commit_trailers(scope)` + `TrailerScope { Agent,
  Project }` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â renders the Phase 23 5-field stamp as a `\n`-joined `Key: value`
  trailer block; agent scope = 5 trailers (Machine / Project / Branch / Head-SHA
  / Head-Subject), project scope = 4 (Project omitted ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â implied by path).
  Folds [SEED-004](.planning/seeds/SEED-004-stamp-params-in-psyche-commit-messages.md).
- `src/common/wrapper_state.rs` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â non-destructive `read_wrapper_state(agent_id)`
  reader + persistent `write_wrapper_state(agent_id, &state)` writer (sibling to
  the existing destructive `load_and_delete`). Powers external emitters'
  `session_uuid` source for sessions-log boot/signoff rows.
- Path helpers in `src/common/owlery.rs`: `tracked_root`, `seed_path`,
  `agent_worktree_path`, `project_worktree_path`, `agent_branch`, `project_branch`.
- `$LIVE doctor` per-worktree status surface: emits
  `[PASS|WARN|FAIL] tracked:{scope}:{name} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ {branch} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ {state}` rows; reports
  orphan worktree metadata; `--fix` runs `git worktree prune --expire=now`.
- Sessions audit log `agents/{id}/sessions.log` (JSONL, 3 locked-order fields:
  `ts`, `session_uuid`, `trigger`). Triggers: `boot`, `pulse`, `commune`,
  `signoff`. Dedup contract: one row per `(session_uuid, trigger)` pair per
  generation; repeated fires update `ts` in place.

### Changed
- `psyches/tracked/{id}.{log,md,xml}` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `psyches/tracked/agents/{id}/{daemon.log,live_context.md,memformat.xml}`
  (file renames per SC4-5).
- Every commune/signoff/echo/memformat write produces a git commit on the agent
  branch `a-{id}` with subject
  `{kind}: {self_id} {payload-type} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â {short}` (D-07) plus the 5-line Stamp
  trailer block (D-08).
- `src/live/context.rs::git_commit_context` retired to a no-op shim ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â replaced
  by `tracked::commit_agent_payload`.
- Wrapper resume + 24h-refresh paths in `src/live/wrapper/claude.rs` +
  `src/live/wrapper/mod.rs` emit `pulse` (or `boot` for fresh sessions) sessions
  log rows on every cycle.
- Migration commits use the 2000ms extended timeout
  (`commit_agent_payload_with_timeout`); standard pulse / commune / signoff
  writers keep the 500ms Phase 23 D-13 budget.

### Migrated
- Existing flat-layout files (`tracked/{id}.log`, `tracked/{id}.md`,
  `tracked/{id}-memformat.xml`) auto-migrate to the new agent worktree
  structure on first boot of v1.8. Stderr summary line:
  `migrated N agents to forked layout`. Idempotent + handoff-race tolerant
  (orphan-recovery pass on every `ensure_seed` call).
- Phase 23 era `psyches/tracked/.git/` (if present) is left in place untouched ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â
  forensic resource only; no longer written to.

### Deferred to Phase 25
- **SC3 (project worktree lazy creation):** The `ensure_project_worktree(name)`
  primitive ships in Phase 24 (Plan 24-02) with full unit-test coverage
  (`ensure_project_worktree_creates_p_prefix_branch`), but **no caller invokes
  it in v1.8**. The first observable lazy-creation event lands in Phase 25 when
  the project-scoped write path is wired. Operators upgrading to v1.8 will not
  see `projects/{name}/` directories appear on disk yet ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â this is expected and
  not a bug.

### Deferred to Phase 35
- `git push` step. Phase 24 commits land directly in `seed/.git/objects/` via
  the shared worktree object DB (no push needed against the local bare). Phase
  35 adds the GitHub remote + push.

## [1.10.15] - 2026-05-20

Phase 23 (v1.8 Psyche Restructure): commune + signoff payloads now stamp
project root and HEAD SHA so resumed agents can detect repo drift since
their last session.

### Added
- `src/common/git.rs` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `Stamp { machine, project, branch?, head_sha?, head_subject? }`
  produced by `stamp()`; every git subprocess bounded by a 500ms soft
  timeout (timeouts/git-missing yield `None` with one-line rate-limited
  warning). `Stamp::event_attrs()` renders EVENT-envelope attrs;
  `Stamp::yaml_frontmatter()` renders fenced YAML for file headers.
  Helpers `commits_since(stored_sha)` and `commits_unpulled()` via
  `git rev-list --count`. Hostname via `$COMPUTERNAME`/`$HOSTNAME` with
  `hostname` CLI fallback.
- `$LIVE suppress-drift` subcommand ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â writes per-(self_id, project)
  marker at `$SPT_HOME/suppressions/{self_id}__{project}.marker` so the
  drift directive is silenced for the chosen agent+project pair.
- `psyche-download` payload emits `<psyche-stamp/>` (when stored) and
  `<current/>` (always, with `commits_since` + `commits_unpulled`)
  blocks, plus a same-project drift directive (AskUserQuestion with 3
  rendered options; 4th `Peek at peer contexts` option stays hidden
  pending Phase 25) when stored vs current `head_sha` diverges.

### Changed
- Plain commune cut over to EVENT envelope (D-06): replaces the prose
  `COMMUNE (ts): body` shape with `<EVENT type="commune" ... />`.
- `init_signoff`, `echo_commune`, and wrapper `file_drop` payloads
  carry the 5 stamp attrs (`machine`, `project`, `branch`, `head_sha`,
  `head_subject`); absent optionals omit entirely (D-11).
- `context-save` writes the YAML stamp as file-head front-matter; each
  `amend-signoff` post-signoff section writes its own YAML block
  inside the section.
- `psyche-download` strips file-head front-matter from the surfaced
  body region; suppression-marker read short-circuits the directive.
- `commune`, `signoff`, and `live` SKILL.md updated with the new
  envelope shape, drift-directive option-to-action mapping, and
  suppress-drift teaching block.

### Notes
- Non-git directories: all five stamp fields except `machine` and
  `project` gracefully omit. Composers and writers stay green.
- Phase 23 verification: 4/4 success criteria PASS, 551/551 lib tests
  pass under `--test-threads=1`, release build green.

## [1.10.14] - 2026-05-18

### Changed
- Skill consolidation (quick-260518-2d6): `/spt:list-live`, `/spt:list-psyche`,
  `/spt:list-ready` replaced by unified `/spt:list-agents` (session-aware:
  `$OWL list` for plain listeners, `$LIVE list` in live sessions, `--psyches`
  flag invokes `$LIVE list-psyches`). `/spt:listen-stop` and `/spt:live-stop`
  replaced by unified `/spt:force-stop` (session-aware branching on
  `live:true` in info.json). Binary subcommands unchanged.

### Removed
- Skill manifests for `/spt:context-save`, `/spt:psyche-download`, and
  `/spt:reboot` deleted from the user-facing surface. Underlying binary
  subcommands (`$LIVE context-save`, `$LIVE psyche-download`, `$OWL reboot`)
  remain reachable ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â they are internal to Psyche wrapper, SessionStart hook,
  and listener reboot flows, not user-invoked slash commands.

### Fixed
- `src/owl/resume.rs` auto-resume banner copy updated to reference
  `/spt:force-stop` instead of the deleted `/spt:listen-stop` and
  `/spt:live-stop` slash commands.

## [1.10.13] - 2026-05-17

### Fixed
- Version-change Stop hook `<step_count>` no longer renders `0` for real
  version transitions. Floors at `1` when CHANGELOG.md is missing the
  new-version H2 (degraded path); inclusive-high `old < v <= new` range
  matches "Yes, full changelog" rendering semantics.
- Version-change owl messages now classify as `info` priority (was
  `high`). They no longer surface the "STOP your current task" HIGHEST
  PRIORITY banner ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â they ride the existing informational spool-drain
  channel.

### Changed
- `DEPLOY.ps1 -Bump` now enforces a curation gate (Phase 34 D-08 round 2,
  post-UAT clarification): the bump aborts and seeds a `TODO`-stub H2
  when the new version's CHANGELOG entry is absent. The user fills the
  curated body and commits as `docs(NN): fill vX.Y.Z CHANGELOG entry`;
  the next `-Bump` proceeds. Bump commit no longer carries `CHANGELOG.md`
  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â it stages `plugin.json` + `Cargo.toml` only. Cache always ships a
  curated entry for the released version.

## [1.10.12] - 2026-05-17

### Fixed
- Version-change Stop hook no longer surfaces as a "Stop hook blocking
  error". The `<spt-version-changelog>` payload now enqueues as an owl
  message on Self's perch and surfaces silently via the existing
  UserPromptSubmit spool drain.

### Changed
- AskUserQuestion for version-change updates reduced from 4 options to 3.
  "Remind me later" removed ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â it rolled the sentinel back, causing the
  next Stop hook to re-fire immediately (infinite-loop pathology
  confirmed during Phase 34 UAT).
- `owl version-remind <old>` subcommand hidden from `--help`. Still
  callable for any in-flight invocations from older block payloads.

## [1.10.11] - 2026-05-17

### Added
- Phase 34 (Plan 02) version-change detection: Stop hook compares
  `env!("CARGO_PKG_VERSION")` against `$SPT_HOME/last-seen-version.json`
  and emits a `<spt-version-changelog>` payload on mismatch via the
  `decision:"block"` envelope. CHANGELOG.md is parsed (Keep-a-Changelog
  1.1.0) for step-count + date metadata. First install / malformed
  sentinel paths stay silent and silently rewrite the sentinel.
- `owl version-remind <old>` subcommand for the AUQ's "Remind me later"
  option ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â atomic sentinel rollback for next-Stop re-fire.

## [1.10.10] - 2026-05-16

### Fixed
- Wrapper now matches `INIT_SIGNOFF` by envelope shape instead of substring, eliminating false positives when commune bodies legitimately contain the token.

## [1.10.9] - 2026-05-16

### Fixed
- Position-independent drain of stale `INIT_SIGNOFF` envelopes in the wrapper; previously a stale signoff queued behind an `echo_commune` would leak past the break-loop predicate.

## [1.10.8] - 2026-05-15

### Changed
- `$LIVE psyche-download` now destructively consumes `.claude/{id}-{commune,signoff}.md` drop files into on-disk psyche-context with mtime-stamped headers (retain-on-error). The `/spt:amend-signoff` skill is deprecated (binary preserved); the offline-persist-until-absorbed path for `/spt:signoff` is documented.

## [1.10.7] - 2026-05-15

### Fixed
- Binary handoff no longer leaks parent processes. Sentinel-exit-and-respawn now propagates correctly across multi-deploy chains; resolved a chain-growth regression where each handoff added an extra parent process.

## [1.10.6] - 2026-05-15

### Fixed
- Stale `.claude/{id}-signoff.md` no longer kills fresh `$LIVE start`. Listener spawn now surfaces and clears stale signoff sentinels.
- `FileDropOutcome::BreakLoop` now propagates through the file-drop signoff path so wrapper-side signoff cleanly tears down the inner-poll loop.

## [1.10.5] - 2026-05-15

### Changed
- Commune and signoff skills now instruct agents to write drop files via the Write tool rather than Bash heredocs (avoids MSYS path mangling and quoting hazards on Windows).

## [1.10.4] - 2026-05-15

### Added
- Phase 30: full commune/signoff file-drop flow. Agents write `.claude/{agent_id}-{commune|signoff}.md`; the listener forwards drops to the psyche wrapper, which composes EVENT envelopes, resumes Psyche, and appends Pending sections during `$LIVE psyche-download`.

### Changed
- Replaced bare `return;` paths in `poll.rs` (drain-once + PULSE_TRIGGER) with explicit `std::process::exit(0)` so listener exit codes accurately reflect intent.
- Refactored `resume_session_checked` to delegate to a sibling `resume_session_with_exit` that exposes the exit code without breaking existing call sites.

## [1.10.3] - 2026-05-14

### Changed
- Skill descriptions use guillemets (`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« spt event ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â»`) for the description chip ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â consistent visual marker across listener/revive surfaces.

## [1.10.2] - 2026-05-14

### Changed
- Renamed `[INCOMING OWL]` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ `<< spt event >>` in listener skill descriptions.

## [1.10.1] - 2026-05-14

### Fixed
- Tightened the wrapper's `FIRE_ECHO_COMMUNE_NOW` classifier with a parse-miss fallthrough so unrecognized envelope shapes no longer trigger unintended fires.
- `emit_event_line` now passes through pre-formed EVENT envelopes verbatim instead of double-wrapping.

## [1.10.0] - 2026-05-14

### Added
- Phase 29: auto-fire echo-commune on `/clear`, `/compact`, and orphan boundaries. New typed `<EVENT type="echo_commune">` envelope cuts over from legacy ECHO_COMMUNE prose.
- `_echo-commune --force` and `--forward-to-self` flags.
- `parse_fire_echo_commune_now` with UUID/source validation; `compose_echo_commune_payload` helper.

### Changed
- SessionStart dispatches `FIRE_ECHO_COMMUNE_NOW` after the Phase 28 reorientation block.
- Snapshot prior `info.json.session_id` before refresh so we can attribute fires across rotation.

## [1.9.15] - 2026-05-13

### Added
- Echo-commune gate now logs a per-poll-iteration heartbeat for observability when idle.

## [1.9.14] - 2026-05-13

### Fixed
- EVENT envelope blast-radius cleanup: wrapper `REPLY` now routes via the EVENT `from=` attribute; `boot_spine` `PSYCHE_DEAD` detection accepts the EVENT envelope shape; `PULSE_TRIGGER` raw-emit contract is pinned by test.
- Wired orphan return value to the wrapper's inner-poll break path; structured `INIT_SIGNOFF` envelope with legacy token preserved for backward compat.

## [1.9.13] - 2026-05-13

### Fixed
- Psyche-wrapper inner poll now receives TCP wake by passing `--once` to the inner `owl poll` subprocess; collapses commune ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ psyche.md latency from the pulse-cadence bound (~20min) to sub-second.

## [1.9.12] - 2026-05-13

### Added
- Phase 28: SessionStart injects `<psyche-context>` into live-listener perches on `/clear` and `/compact`, plus the fresh-session emit path.
- Subprocess integration tests for clear/compact emit ordering; integration tests for `download_payload_for_injection` with visibility promotions.

### Fixed
- Phase 28 code-review pass: removed dead code, restored visibility on internal helpers, fixed `parent_pid` reference, and stripped a stale moved-test reference.

## [1.9.10] - 2026-05-10

### Fixed
- `DEPLOY.ps1` hardening (quick-260510-vng): atomic rename-first prune to prevent half-pruned cache dirs; explicit `installed_plugins.json` patch instead of trusting `claude` CLI no-op; post-deploy pointer assertion that exits non-zero on drift.

### Added
- `$LIVE pick-spec` prompt-new path now repo-prefixes starter agent IDs.

## [1.9.9] - 2026-05-10

### Changed
- Phase 26-06 UAT gap closure: D9 refuse now routes through Cancel handling per the forced-picker rule; D7 row uses template substitution for `other_repos`; dropped explicit Other option from pick + prompt-new (native AUQ Other field covers it); dropped `--json` flag reference from LIVE-PICK-03.

## [1.9.8] - 2026-05-10

### Added
- `$LIVE pick-spec` subcommand (Phase 26-03) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â emits structured pick-spec JSON for `/spt:live` to interpret.
- `$LIVE fork <src> <new_id>` primitive (Phase 26-04) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â copies an existing live agent's identity to a new ID with collision rejection.
- Phase 26-02 activity bumps: cwd populated uniformly at every `InfoJson::new` site.

### Changed
- `/spt:live` skill rewritten around pick-spec dispatch (Phase 26-05); ID Recollection section updated to match new flow.

## [1.9.7] - 2026-04-21

### Fixed
- Phase 18.8.1: SessionStart now refreshes `info.json.session_id` so commune delivery survives Claude Code session rotation.

### Added
- `claude_projects_root()` helper centralizes the Claude projects-dir lookup (CCS-aware via `CLAUDE_CONFIG_DIR`); routes echo-commune through it.
- `ExcerptSource` enum + `excerpt_frame_fields` for observable frame headers; `should_bump_cursor` predicate gates the step-9 cursor bump.
- Crate-wide audit test forbidding hardcoded `.claude/projects` literals.

## [1.9.5] - 2026-04-21

### Fixed
- Phase 18.8 code-review fixes: panic-safe commune delivery (`catch_unwind`), RAII guard for excerpt file cleanup, char-boundary safety in `extract_session_uuid`, object-shaped user content support in `keep_line`, dropped-errors counter on `extract_excerpt` I/O failures, wait-fail logging, clock-regression-safe cursor bump using `fire_epoch`.
- Constants: `UUID_LEN`, `SESSION_ID_KEY` replace magic numbers.

### Added
- Reorientation primer now includes a poll-revival section.

## [1.9.2] - 2026-04-21

### Added
- Phase 18.8: full rewrite of echo-commune ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â stderr capture, fresh `claude` session, jsonl excerpt extraction. Eliminates the Self-jsonl write-contention class and surfaces previously-silent subprocess failures.
- `common::owlery` cursor helpers (`now_secs`, `write_last_commune_epoch`).
- Phase 18.7: listener-owned timed-alarm firing (renamed `/spt:timed-pulse` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ `/spt:new-alarm`). Scheduler bumps a wake sentinel after persist; wrapper compose_passive_context filters to `epoch > now`.
- Phase 18.7.1 hotfix: mid-iteration alarm-fire regression closed (F3 spool-direct write, F4 SPT_TRACE gating, F5 panic-logging, cache-mtime guard fix).

### Removed
- `src/live/timed_pulse.rs`, `wrapper/scheduler.rs`, `reload_timed_pulses`, `TimedPulseOutcome` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â wrapper is now read-only over pulse state.

## [1.8.11] - 2026-04-20

### Fixed
- SessionEnd `cleanup-session` now skips psyche perches (was incorrectly tearing them down on parent session end).

## [1.8.10] - 2026-04-20

### Added
- Phase 18.6: scheduled-pulses refactor. Wrapper now delivers to Self (not Psyche); Psyche gains passive awareness via composed routine stdin only. `compose_passive_context` helper wired into all three `claude --resume` sites. Psyche.md gains a Passive Context Protocol section.
- MSYS hardening for `timed-pulse`: three-transport body intake (positional > `--message-file` > stdin); `is_msys_mangled` guard with actionable error.

### Changed
- `reload_timed_pulses` now fires inline to Self; MISSED_PULSES batch-to-Psyche path deleted.

## [1.8.9] - 2026-04-19

### Fixed
- Echo-commune subprocess hardening (quick-260419-pwy): drop `--dangerously-skip-permissions`, add `--allowed-tools` whitelist + `--disable-slash-commands`, set CWD to psyche_dir.
- Echo-commune no longer overrides `current_dir`; uses `--add-dir` with an absolute path.

## [1.8.8] - 2026-04-19

### Fixed
- Phase 18.5 closeout: handoff bugs #10/#11/#12 closed end-to-end (UAT Test 2 green).
- Sync `Cargo.toml` version to 1.8.7; add `Cargo.toml` bump to `DEPLOY.ps1`.

## [1.8.7] - 2026-04-19

### Fixed
- Phase 18.5: handoff bug fixes ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â listener argv rewrite via `poll.rs` (not a new subcommand), duplicate-check bypass via `OWL_HANDOFF_CHILD`, wrapper consumes inner-poll exit code 2 as a handoff defer signal.
- `spawn_and_wait_inherit_stdio` extended with env overrides; handoff child/wrapper env constants added.

## [1.8.6] - 2026-04-19

### Added
- Phase 18.4: seamless binary handoff for long-running spt processes. Listeners stdio-relay across the handoff; wrappers detach + rehydrate from `wrapper-state.json` when `installed_plugins.json` flips. Handoff integration test suite (parallel-safe E2E) covers trampoline, in-loop detection, wrapper rehydration, and Windows `STARTUPINFOEX` spawn.

### Fixed
- Phase 18.4 code review: platform-aware `env_key_eq` for env retain; document single-threaded `set_var` assumption in poll; corrected `is_same_file` doc comment.

## [1.8.5] - 2026-04-18

### Fixed
- Phase 18.3 amendment (quick-260418-nt3): gate echo-commune staleness on `.more-done` sentinel CREATION time, not psyche-context mtime. Fire-delete-recreate now resets the clock as expected.

## [1.8.4] - 2026-04-18

### Fixed
- SubagentStart `[WORKING_PERCH_NOTICE]` no longer wakes the poll listener (quick-260418-n7k). Added deferred-delivery column + spool helpers; wired deferred variants into send + poll idle-drain.

## [1.8.3] - 2026-04-18

### Added
- Phase 18.3: echo-commune time-gating. `should_fire` gate predicate, `fire_echo_commune_if_due` wired into the wrapper run loop, `FireDecision` enum, `next_pulse_override` field.
- Dynamic short-pulse override in Psyche wrapper for ctx-fresh echo-gate rejections (quick-260418-mni).

## [1.8.2] - 2026-04-18

### Added
- Wrapper auto-commit for psyche-context changes (quick-260418-7k9): `git_commit_context` wired at three call sites.

## [1.8.1] - 2026-04-18

### Added
- Phase 18.2 (Spacetime Reliability & DX): security threat verification artifact (13/13 closed); UAT ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â 8 passed, 0 issues.

## [1.8.0] - 2026-04-18

### Changed
- Phase 18.2: relocated spacetime runtime root from `~/.claude/spacetime` to `%LOCALAPPDATA%\spt` / `~/.spt` (Psyche `Write` permission blocker workaround). New `spt_home()` resolver with three-tier resolution (`SPT_HOME` env > platform default > panic). Test harness uses per-test `SPT_HOME` for isolation. Robocopy migration with 973-entry parity; old tree hard-deleted.

### Fixed
- `DEPLOY.ps1`: use `claude plugin install` to refresh state instead of fragile JSON patching.

## [1.7.5] - 2026-04-18

### Fixed
- Skills: quote `argument-hint` values that contain leading brackets or pipe characters (YAML safety).
- `DEPLOY.ps1`: write native Windows backslashes in `installPath`; strip `GetNewClosure()` to unbreak dry-run / non-Bump invocations; auto-clean rogue manual-install dir to prevent `/plugin not-installed` confusion.

## [1.7.4] - 2026-04-18

### Added
- `-Bump` flag on `DEPLOY.ps1` (quick-260416-vbf) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â single-step plugin.json + Cargo.toml version bump with atomic commit.

### Fixed
- Wrapper loop tolerates empty poll stdout (defensive backstop); stop poll subprocess being killed at 5min by the host job-object on Windows (quick-260416-aaa).

## [1.7.3] - 2026-04-16

### Fixed
- Stop-hook hang on Windows via raw `CreateProcessW` with `bInheritHandles=FALSE` (quick-260416-uz8).
- Fixed Psyche permission on context/memformat files by setting the claude subprocess cwd to the tracked dir and correcting `psyche.md` paths (quick-260416-4y2).
- Replaced WMIC/tasklist with Win32 API + echo-commune recursion guard.
- Eliminated all `taskkill` subprocess calls from the codebase (quick-260416-1lc); migrated remaining killers to `TerminateProcess`.
- `DEPLOY.ps1`: use `JavaScriptSerializer` for PowerShell 5.1 compat.

## [1.7.2] - 2026-04-15

### Added
- SessionStart hook syncs `$OWL` / `$LIVE` into `settings.json` (mitigates Anthropic #27987 on Windows).
- UserPromptSubmit drains the spool universally and injects pending messages on every prompt (quick-260414-9an).
- `info` priority for informational owl messages.

### Changed
- Phase 18.1: deferred delivery flag; TCP spool timeout (D-09); orphan detection via `parent_pid` (D-08); `PULSE_TRIGGER` 3-tier recovery; psyche tool restrictions + marker protocol; echo-commune mechanism (D-07).
- Removed `env-setup` skill and subcommand.
- Renamed `STASH_FINAL` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ `INIT_SIGNOFF` across codebase.

### Fixed
- Poll-loop spool drain-respool race vs hook; removed subagent idle-ready clearing on parent perch (quick-260414-4dl).
- Stripped MCP transport layer; restored CLI-first spacetime model (quick-260414-28p). Spool/hook/rename improvements kept.
- Wired deferred delivery into `SubagentStart` hook messages.
- `DEPLOY.md` `gitCommitSha` refresh step after cache wipe.

## [1.5.4] - 2026-04-03

### Added
- Initial public version-bump checkpoint. Plugin migrated to the `/spt` namespace, shipped via the `cplugs` marketplace. Spacetime filesystem under `%LOCALAPPDATA%\spt` / `~/.spt` with `SPT_HOME` override. Persistent offline perches + indefinite queueing + reconnection. Memformat-driven Psyche brainstorming + INSIGHT messages. `PerchState` enum, `owl doctor`, session detection, optional `agent_id`. Test artifacts added.
