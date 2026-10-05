#!/bin/sh
# sptc SessionStart bootstrap (POSIX) — install spt-core on demand if absent.
# Verbatim against the published contract: spt-releases harness-contract/install-on-demand.md.
# The invisible-installer pattern: a user who installs the sptc plugin gets spt-core for free.
# [impl->REQ-DIST-BOOTSTRAP-INSTALL]
set -eu

# A trimmed PATH (daemon-spawned session) must not read as "absent": probe the documented install
# dir before reinstalling, or every SessionStart re-runs the installer. [impl->REQ-HAZARD-DAEMON-PATH-TRIMMED]
HOME_SPT="${SPT_HOME:-$HOME/.spt-core}/bin/spt"
if command -v spt >/dev/null 2>&1; then
  SPT="spt"
elif [ -x "$HOME_SPT" ]; then
  SPT="$HOME_SPT"
elif [ -x "$HOME/.local/bin/spt" ]; then
  SPT="$HOME/.local/bin/spt"
else
  echo "spt-core not found - installing..." >&2
  curl -fsSL https://sabermage.github.io/spt-releases/install.sh | sh
  # PATH is not yet reloaded in this shell — use the absolute install path for the first call.
  SPT="$HOME_SPT"
  [ -x "$SPT" ] || SPT="$HOME/.local/bin/spt"
fi

"$SPT" --version
# After this initial bootstrap, `spt update` handles signed self-updates automatically.
