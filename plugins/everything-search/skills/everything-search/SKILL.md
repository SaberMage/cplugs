---
name: everything-search
description: Instantly search files and folders on Windows via voidtools Everything 1.5a HTTP JSON API. Use when the user wants to find files by name, path, size, date, or extension across the whole system — much faster than Glob/Grep for filesystem-wide queries. Triggers on "find file", "where is", "locate", "search my drive", "find all .ext files", "everything search".
---

# Everything Search

Query the locally running voidtools **Everything 1.5a** via its HTTP JSON API. Returns file/folder metadata in milliseconds even across millions of items.

## Prerequisites

Everything 1.5a must be running with HTTP server enabled:
`Tools → Options → HTTP Server → Enable HTTP server`. Default bind: `127.0.0.1:80`.

If port 80 is taken, user picks another (commonly 8080). Honor `EVERYTHING_HOST` / `EVERYTHING_PORT` env vars if set, else default `127.0.0.1:80`.

## How to call

Use Bash with `curl`. Always `--get` + `--data-urlencode` for the search string (handles spaces, quotes, operators).

```bash
curl -sS --get \
  --data-urlencode "search=<QUERY>" \
  "http://127.0.0.1:80/?json=1&path_column=1&size_column=1&date_modified_column=1&count=100"
```

Response shape:
```json
{
  "totalResults": 12345,
  "results": [
    {"type":"file","name":"foo.ts","path":"C:\\src\\foo","size":"4096","date_modified":"133..."}
  ]
}
```

`size` is bytes as string. `date_modified` / `date_created` are Windows FILETIME (100ns ticks since 1601-01-01 UTC). Convert if user needs human time:
`unix_seconds = (filetime / 10000000) - 11644473600`.

## Useful URL params (Everything 1.5a)

| Param | Effect |
|-------|--------|
| `search=` | query (Everything syntax) |
| `json=1` | JSON output (vs HTML) |
| `count=N` | max results (default 32, cap reasonably e.g. 100–500) |
| `offset=N` | pagination |
| `sort=` | `name` `path` `size` `date_modified` `date_created` `extension` `type` `attributes` `run_count` `date_run` `date_recently_changed` |
| `ascending=1` / `0` | sort direction |
| `path_column=1` | include parent path |
| `size_column=1` | include size |
| `date_modified_column=1` | include mtime |
| `date_created_column=1` | include ctime |
| `attributes_column=1` | include Win attributes |
| `match_case=1` | case sensitive |
| `match_whole_word=1` | whole word |
| `match_path=1` | match against full path, not just name |
| `regex=1` | treat search as regex |

## Everything search syntax (cheat sheet)

- `foo bar` — both substrings, any order
- `"exact phrase"` — literal
- `!foo` — exclude
- `foo|bar` — OR
- `ext:ts;tsx` — extension filter
- `path:C:\src` — restrict to path
- `parent:C:\src` — direct children only
- `size:>10mb`, `size:1kb..1mb`
- `dm:today`, `dm:thisweek`, `dm:2025`, `dm:2025-01-01..2025-02-01`
- `dc:` for created
- `folder:`, `file:`, `audio:`, `video:`, `pic:`, `doc:`, `zip:`, `exec:`
- `regex:<pattern>` — inline regex
- `case:`, `wholeword:`, `wfn:` (whole filename)
- `count:N` — limit (in-query alternative to URL `count`)

## Recipes

**Find a file by name:**
```bash
curl -sS --get --data-urlencode "search=schema.prisma" \
  "http://127.0.0.1:80/?json=1&path_column=1&count=50"
```

**All TS/TSX in a folder, biggest first:**
```bash
curl -sS --get \
  --data-urlencode "search=path:C:\\src ext:ts;tsx" \
  "http://127.0.0.1:80/?json=1&path_column=1&size_column=1&sort=size&ascending=0&count=100"
```

**Recently modified PDFs:**
```bash
curl -sS --get \
  --data-urlencode "search=ext:pdf dm:thisweek" \
  "http://127.0.0.1:80/?json=1&path_column=1&date_modified_column=1&sort=date_modified&ascending=0&count=50"
```

**Regex (find numbered backups):**
```bash
curl -sS --get \
  --data-urlencode 'search=regex:.*\.bak\d+$' \
  "http://127.0.0.1:80/?json=1&path_column=1&count=100"
```

## Output to user

After the curl, parse JSON (use `python -c` or `node -e` or `jq` if available). Show `path\name` joined with backslash, plus size/date when relevant. Report `totalResults` so user knows if results were truncated by `count`.

## Failure modes

- `curl: (7) Failed to connect` → Everything not running OR HTTP server disabled OR wrong port. Tell user to enable HTTP server and confirm port.
- `401 Unauthorized` → user set HTTP username/password in Everything. Use `curl -u user:pass ...`.
- Empty `results` with `totalResults: 0` → query syntax may be wrong; suggest dropping operators.
- Non-Windows host → Everything is Windows-only. Skill is a no-op elsewhere.

## Don't

- Don't use this for content search inside files — Everything indexes names/metadata only. Use Grep for content.
- Don't run without `--data-urlencode` — operators like `&`, `|`, `:` will break the URL.
- Don't request unbounded result sets. Always pass `count=`.
