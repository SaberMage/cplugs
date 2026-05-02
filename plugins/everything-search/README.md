# everything-search

Claude Code plugin: instant file search via [voidtools Everything 1.5a](https://www.voidtools.com/forum/viewforum.php?f=12) HTTP JSON API.

Ships a single skill (`everything-search`) that teaches Claude how to query the local Everything HTTP server with `curl`. No MCP server, no native deps, no install step.

## Setup

1. Install Everything 1.5a (alpha) and let it index your drives.
2. `Tools → Options → HTTP Server → Enable HTTP server`. Default `127.0.0.1:80`.
3. Install this plugin from the `cplugs` marketplace.

## Custom port / host

Skill defaults to `127.0.0.1:80`. Set in your shell or Claude Code env:

```
EVERYTHING_HOST=127.0.0.1
EVERYTHING_PORT=8080
```

## Usage

Ask Claude things like:
- "find every `tsconfig.json` under `C:\src`"
- "where's that `schema.prisma` file?"
- "biggest 20 mp4s on D:"
- "PDFs modified this week"

Claude invokes the skill and curls the Everything HTTP endpoint directly.

## Why not MCP?

One HTTP GET → JSON. Skill + Bash is simpler to ship, zero deps, zero rebuild loop.
