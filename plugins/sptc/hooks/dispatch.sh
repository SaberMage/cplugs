#!/bin/sh
# sptc hook dispatch — STATIC-FOREVER (D1, ADR-0006 ask #1 → resolve-not-execute).
#
# This is the ONLY hook shell the cplugs plugin still ships. It carries NO hook logic — that all moved
# into the consolidated `claude-spt` binary (`claude-spt hook <event>`), which rides `spt adapter
# update`. This wrapper only RESOLVES that binary and execs it, so it never needs to change again when
# hook behaviour changes. hooks.json wires every CC event to `sh dispatch.sh <CCEventName>`.
#
# Resolution rides spt-core v0.16.0's two pure primitives (no new spt-core execution): the adapter
# `[strings].hook_cmd = "{adapter_dir}/claude-spt hook"` is lazily {adapter_dir}-substituted at
# `spt adapter get-string` read time → the absolute `<install_dir>/claude-spt hook` command. We resolve
# it ONCE per session (cached in $SPTC_HOOK_BIN via $CLAUDE_ENV_FILE on SessionStart) and reuse it per
# hook. Session-scoped keys (session_id, …) are NOT available via get-string — the binary reads those
# from the CC hook payload on stdin (passed through untouched: this wrapper never reads stdin).
#
# Bootstrap stays HERE, not in the binary: the binary lives in the adapter install dir, which does not
# exist until spt-core + the adapter are installed. So SessionStart installs spt-core on demand first;
# and if the adapter is not yet registered (pre-/sptc:setup), get-string yields nothing and we no-op
# (exit 0) — exactly the pre-readiness no-op the old per-hook wrappers had. [impl->REQ-DIST-HOOK-BINARY]
event="$1"

# Resolve the spt binary (PATH first, then known install locations) — only needed to get-string the
# hook command; the binary itself is resolved from {adapter_dir}, not PATH. `${SPT_HOME:-$HOME/.spt-core}/bin`
# is where `spt install` puts it on Linux (harness-contract/install-on-demand); a daemon-spawned
# session can carry a PATH that lacks it (niskon, 2026-10-05). Prints nothing when spt is nowhere.
# [impl->REQ-HAZARD-DAEMON-PATH-TRIMMED]
spt_bin() {
  if command -v spt >/dev/null 2>&1; then printf 'spt'; return 0; fi
  for p in \
    "${SPT_HOME:-$HOME/.spt-core}/bin/spt" \
    "$HOME/.local/bin/spt" \
    "$LOCALAPPDATA/spt-core/bin/spt.exe" \
    "$HOME/AppData/Local/spt-core/bin/spt.exe"; do
    [ -x "$p" ] && { printf '%s' "$p"; return 0; }
  done
}

# SessionStart only: invisible-installer (install spt-core if absent — no-op when present). Redirect
# stdin from /dev/null so this never consumes the CC hook payload the binary will read.
if [ "$event" = "SessionStart" ]; then
  sh "$CLAUDE_PLUGIN_ROOT/bootstrap.sh" </dev/null >/dev/null 2>&1 || true
fi

# Resolve the binary PATH: cached env first, else the lazily-substituted adapter string.
bin="${SPTC_HOOK_BIN:-}"
if [ -z "$bin" ]; then
  spt=$(spt_bin)
  # spt nowhere → LOUD, never a silent exit 0: every hook (message drain, seals, now-signal) would
  # be dead while the operator believes it is live. Exit 1 makes Claude Code show the stderr as a
  # non-blocking hook error. [impl->REQ-HAZARD-DAEMON-PATH-TRIMMED]
  if [ -z "$spt" ]; then
    echo "sptc: spt not found on PATH or in ${SPT_HOME:-$HOME/.spt-core}/bin — spt hooks are OFF for this session (no messages, no seals)" >&2
    exit 1
  fi
  bin=$("$spt" adapter get-string claude-spt hook_cmd </dev/null 2>/dev/null) || true
fi

# Adapter not registered yet (pre-/sptc:setup) → no perch to serve → no-op.
[ -z "$bin" ] && exit 0

# Normalize to the bare binary PATH: tolerate a manifest value that still carries a trailing ` hook`
# token (older v0.9.0 hook_cmd = "{adapter_dir}/claude-spt hook"); the `hook` subcommand is appended
# below as a literal, so the cached value is JUST the binary path — no embedded space.
bin="${bin% hook}"

# Cache the resolved binary path for later per-prompt hooks (skip get-string). QUOTED — CC sources
# $CLAUDE_ENV_FILE per Bash/hook invocation, so an unquoted value with a space (a path with a space,
# OR the old ` hook` suffix) would be parsed as `VAR=val cmd` → run `cmd` (the v0.9.0 `hook: command
# not found` regression) AND lose the value. Quoting makes it one assignment, space-safe.
if [ "$event" = "SessionStart" ] && [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -z "${SPTC_HOOK_BIN:-}" ]; then
  printf 'SPTC_HOOK_BIN="%s"\n' "$bin" >> "$CLAUDE_ENV_FILE"
fi

# The AGENT's Bash needs bare `spt` too: the briefs teach `... | spt send <target>`. A daemon-spawned
# session can carry a PATH without the install dir, and a non-login, non-interactive shell never runs
# the installer's ~/.bashrc line (SteamOS returns before it; Request #54). When spt is off PATH but
# found in a known install dir, put that dir on PATH for every Bash call via $CLAUDE_ENV_FILE.
# '$PATH' stays literal so it expands when CC sources the file. [impl->REQ-HAZARD-DAEMON-PATH-TRIMMED]
if [ "$event" = "SessionStart" ] && [ -n "${CLAUDE_ENV_FILE:-}" ] && ! command -v spt >/dev/null 2>&1; then
  _s=$(spt_bin)
  [ -n "$_s" ] && printf 'export PATH="%s:$PATH"\n' "${_s%/*}" >> "$CLAUDE_ENV_FILE"
fi

# Exec the binary: `"$bin"` is the program (quoted → space-safe), `hook` the subcommand (literal),
# then the CC event + the seed pid. CC stdin (the hook payload) is inherited untouched — the binary
# reads it directly. $PPID is the seed pid (Rust std has no portable getppid on Windows).
exec "$bin" hook "$event" --host-pid "$PPID"
