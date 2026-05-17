# Changelog

All notable changes to the SPT (Spacetime / Sentience Pocket Transacter) plugin are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries authored retroactively from `git log --grep='chore: bump'` at Phase 34 (v1.7.1 milestone).

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
- Skill descriptions use guillemets (`Â« spt event Â»`) for the description chip â€” consistent visual marker across listener/revive surfaces.

## [1.10.2] - 2026-05-14

### Changed
- Renamed `[INCOMING OWL]` â†’ `<< spt event >>` in listener skill descriptions.

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
- Psyche-wrapper inner poll now receives TCP wake by passing `--once` to the inner `owl poll` subprocess; collapses commune â†’ psyche.md latency from the pulse-cadence bound (~20min) to sub-second.

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
- `$LIVE pick-spec` subcommand (Phase 26-03) â€” emits structured pick-spec JSON for `/spt:live` to interpret.
- `$LIVE fork <src> <new_id>` primitive (Phase 26-04) â€” copies an existing live agent's identity to a new ID with collision rejection.
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
- Phase 18.8: full rewrite of echo-commune â€” stderr capture, fresh `claude` session, jsonl excerpt extraction. Eliminates the Self-jsonl write-contention class and surfaces previously-silent subprocess failures.
- `common::owlery` cursor helpers (`now_secs`, `write_last_commune_epoch`).
- Phase 18.7: listener-owned timed-alarm firing (renamed `/spt:timed-pulse` â†’ `/spt:new-alarm`). Scheduler bumps a wake sentinel after persist; wrapper compose_passive_context filters to `epoch > now`.
- Phase 18.7.1 hotfix: mid-iteration alarm-fire regression closed (F3 spool-direct write, F4 SPT_TRACE gating, F5 panic-logging, cache-mtime guard fix).

### Removed
- `src/live/timed_pulse.rs`, `wrapper/scheduler.rs`, `reload_timed_pulses`, `TimedPulseOutcome` â€” wrapper is now read-only over pulse state.

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
- Phase 18.5: handoff bug fixes â€” listener argv rewrite via `poll.rs` (not a new subcommand), duplicate-check bypass via `OWL_HANDOFF_CHILD`, wrapper consumes inner-poll exit code 2 as a handoff defer signal.
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
- Phase 18.2 (Spacetime Reliability & DX): security threat verification artifact (13/13 closed); UAT â€” 8 passed, 0 issues.

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
- `-Bump` flag on `DEPLOY.ps1` (quick-260416-vbf) â€” single-step plugin.json + Cargo.toml version bump with atomic commit.

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
- Renamed `STASH_FINAL` â†’ `INIT_SIGNOFF` across codebase.

### Fixed
- Poll-loop spool drain-respool race vs hook; removed subagent idle-ready clearing on parent perch (quick-260414-4dl).
- Stripped MCP transport layer; restored CLI-first spacetime model (quick-260414-28p). Spool/hook/rename improvements kept.
- Wired deferred delivery into `SubagentStart` hook messages.
- `DEPLOY.md` `gitCommitSha` refresh step after cache wipe.

## [1.5.4] - 2026-04-03

### Added
- Initial public version-bump checkpoint. Plugin migrated to the `/spt` namespace, shipped via the `cplugs` marketplace. Spacetime filesystem under `%LOCALAPPDATA%\spt` / `~/.spt` with `SPT_HOME` override. Persistent offline perches + indefinite queueing + reconnection. Memformat-driven Psyche brainstorming + INSIGHT messages. `PerchState` enum, `owl doctor`, session detection, optional `agent_id`. Test artifacts added.
## [1.10.11] - 2026-05-17

- TODO: changelog entry
