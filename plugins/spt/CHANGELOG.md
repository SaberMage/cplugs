# Changelog

All notable changes to the SPT (Spacetime / Sentience Pocket Transacter) plugin are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries authored retroactively from `git log --grep='chore: bump'` at Phase 34 (v1.7.1 milestone).

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
