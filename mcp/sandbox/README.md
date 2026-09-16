# Sandbox MCP

A single-file, zero-dependency MCP server that gives Claude a playground it can do
anything inside — and nothing outside.

```
node server.mjs          # stdio MCP server
```

## Tools

| Tool | What it does |
|---|---|
| `sandbox_info` | Root path, size, limits, isolation mode |
| `list` | Directory listing, optionally recursive |
| `read` | Read a text file, optional line range |
| `write` / `append` | Create, overwrite, or append |
| `edit` | Exact string replacement |
| `delete` / `move` / `mkdir` | Filesystem manipulation |
| `search` | Regex content search (ripgrep, falls back to grep) |
| `exec` | Arbitrary shell command |
| `fetch` | HTTP request; can stream the body straight to a file |
| `note` | Persistent key/value scratch memory across restarts |

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `SANDBOX_DIR` | `./workspace` | The sandbox root. Everything happens here. |
| `SANDBOX_ISOLATE` | unset | `1` runs `exec` under bubblewrap (see below) |
| `SANDBOX_MAX_OUTPUT` | `100000` | Chars before tool output is truncated |
| `SANDBOX_TIMEOUT_MS` | `120000` | Default `exec` timeout |
| `SANDBOX_LOG` | unset | Path to an append-only debug log |

## Two levels of containment

**Path jail (always on).** Every path argument is resolved — symlinks included —
and refused if it lands outside the root. This fully covers the file tools.

**bubblewrap (`SANDBOX_ISOLATE=1`).** The path jail cannot constrain `exec`: a
shell that merely *starts* in the sandbox can still `cd /` and read your home
directory. With isolation on, the command runs in a mount namespace where `/usr`
and `/etc` are read-only, your home and the rest of the disk are not mounted at
all, and the sandbox is the only writable place (as `/sandbox`). Network stays
available. Requires `bwrap` on `PATH`.

Use isolation if you want the sandbox to be a real boundary. Leave it off if you
want Claude to be able to read the wider machine and only *write* in one place.

## Register with Claude Code

```bash
claude mcp add sandbox --scope user -e SANDBOX_ISOLATE=1 -- node "$PWD/server.mjs"
```

Then `/mcp` inside Claude Code to confirm it connected. To let Claude use it
without a prompt per call, allow the whole server in settings:

```json
{ "permissions": { "allow": ["mcp__sandbox"] } }
```
