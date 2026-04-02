# cplugs

Private Claude Code plugin marketplace.

## Plugins

| Name | Description |
|------|-------------|
| spt  | Spacetime agent messaging and live agent system |

## Installation

```
/plugin install spt@cplugs
```

After installing, build the binary from the [source repo](https://github.com/SaberMage/claude_skill_owl) and copy it into the plugin cache:

```bash
cargo build --release
cp target/release/owl.exe ~/.claude/plugins/cache/cplugs/spt/1.5.0/
```

The marketplace distributes skill files and hooks only. The binary is platform-specific and must be built locally.
