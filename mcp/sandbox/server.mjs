#!/usr/bin/env node
/**
 * Sandbox MCP server — a playground Claude can do anything inside.
 *
 * Every tool is jailed to SANDBOX_DIR (default: ./workspace next to this file).
 * Inside it: full read/write/delete/move/search + arbitrary shell + HTTP.
 * Outside it: nothing. Paths are resolved and checked against the jail root,
 * symlinks included.
 *
 * Zero dependencies. Speaks JSON-RPC 2.0 over newline-delimited stdio.
 */

import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.SANDBOX_DIR || path.join(HERE, "workspace"));
const MAX_OUTPUT = Number(process.env.SANDBOX_MAX_OUTPUT || 100_000);
const DEFAULT_TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS || 120_000);

await fs.mkdir(ROOT, { recursive: true });
const REAL_ROOT = await fs.realpath(ROOT);

/* ------------------------------------------------------------------ jail -- */

/** Resolve a user-supplied path inside the jail, or throw. */
async function jail(p = ".") {
  const abs = path.resolve(REAL_ROOT, p);
  // Resolve the deepest existing ancestor so new files are still checked.
  let probe = abs;
  let real;
  for (;;) {
    try {
      real = await fs.realpath(probe);
      break;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      const parent = path.dirname(probe);
      if (parent === probe) { real = probe; break; }
      probe = parent;
    }
  }
  const resolved = path.join(real, path.relative(probe, abs));
  if (resolved !== REAL_ROOT && !resolved.startsWith(REAL_ROOT + path.sep)) {
    throw new Error(`path escapes the sandbox: ${p}`);
  }
  return resolved;
}

const rel = (abs) => path.relative(REAL_ROOT, abs) || ".";

function clip(s) {
  if (s.length <= MAX_OUTPUT) return s;
  return s.slice(0, MAX_OUTPUT) + `\n… [truncated, ${s.length - MAX_OUTPUT} more chars]`;
}

/* ----------------------------------------------------------------- tools -- */

const tools = {
  sandbox_info: {
    description:
      "Where the sandbox lives and what the current limits are. Call this first if unsure.",
    schema: { type: "object", properties: {} },
    async run() {
      const { stdout } = await sh("du -sh . 2>/dev/null | cut -f1", REAL_ROOT, 10_000);
      return [
        `root:        ${REAL_ROOT}`,
        `size:        ${stdout.trim() || "unknown"}`,
        `platform:    ${os.platform()} ${os.release()}`,
        `node:        ${process.version}`,
        `max output:  ${MAX_OUTPUT} chars`,
        `exec timeout default: ${DEFAULT_TIMEOUT_MS} ms`,
        `isolation:   ${ISOLATE ? "bubblewrap (host read-only, only sandbox writable)" : "path jail only (exec can read outside)"}`,
        ``,
        `All paths are relative to root. Anything outside root is refused.`,
      ].join("\n");
    },
  },

  list: {
    description: "List directory entries. Set recursive for a full tree.",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path. Default '.'" },
        recursive: { type: "boolean", description: "Walk subdirectories" },
      },
    },
    async run({ path: p = ".", recursive = false }) {
      const abs = await jail(p);
      const out = [];
      async function walk(dir, depth) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            out.push(`${"  ".repeat(depth)}${e.name}/`);
            if (recursive) await walk(full, depth + 1);
          } else {
            let size = "";
            try { size = ` (${(await fs.stat(full)).size}b)`; } catch {}
            out.push(`${"  ".repeat(depth)}${e.name}${size}`);
          }
        }
      }
      await walk(abs, 0);
      return out.length ? `${rel(abs)}/\n` + out.join("\n") : `${rel(abs)}/ is empty`;
    },
  },

  read: {
    description: "Read a text file. Optionally a line range.",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "number", description: "1-indexed first line" },
        limit: { type: "number", description: "Max lines to return" },
      },
      required: ["path"],
    },
    async run({ path: p, offset, limit }) {
      const abs = await jail(p);
      let text = await fs.readFile(abs, "utf8");
      if (offset || limit) {
        const lines = text.split("\n");
        const start = Math.max(0, (offset ?? 1) - 1);
        text = lines.slice(start, limit ? start + limit : undefined).join("\n");
      }
      return clip(text);
    },
  },

  write: {
    description: "Create or overwrite a file. Parent directories are created.",
    schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    async run({ path: p, content }) {
      const abs = await jail(p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content);
      return `wrote ${rel(abs)} (${Buffer.byteLength(content)} bytes)`;
    },
  },

  append: {
    description: "Append to a file, creating it if missing.",
    schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    async run({ path: p, content }) {
      const abs = await jail(p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.appendFile(abs, content);
      return `appended ${Buffer.byteLength(content)} bytes to ${rel(abs)}`;
    },
  },

  edit: {
    description: "Exact string replacement in a file.",
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old: { type: "string" },
        new: { type: "string" },
        all: { type: "boolean", description: "Replace every occurrence" },
      },
      required: ["path", "old", "new"],
    },
    async run({ path: p, old, new: nu, all = false }) {
      const abs = await jail(p);
      const text = await fs.readFile(abs, "utf8");
      const count = text.split(old).length - 1;
      if (count === 0) throw new Error("old string not found");
      if (count > 1 && !all) throw new Error(`old string appears ${count} times; pass all:true`);
      await fs.writeFile(abs, all ? text.split(old).join(nu) : text.replace(old, nu));
      return `replaced ${all ? count : 1} occurrence(s) in ${rel(abs)}`;
    },
  },

  delete: {
    description: "Delete a file or directory (recursive).",
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    async run({ path: p }) {
      const abs = await jail(p);
      if (abs === REAL_ROOT) throw new Error("refusing to delete the sandbox root itself");
      await fs.rm(abs, { recursive: true, force: true });
      return `deleted ${rel(abs)}`;
    },
  },

  move: {
    description: "Move or rename a path within the sandbox.",
    schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    },
    async run({ from, to }) {
      const a = await jail(from);
      const b = await jail(to);
      await fs.mkdir(path.dirname(b), { recursive: true });
      await fs.rename(a, b);
      return `${rel(a)} -> ${rel(b)}`;
    },
  },

  mkdir: {
    description: "Create a directory (and parents).",
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    async run({ path: p }) {
      const abs = await jail(p);
      await fs.mkdir(abs, { recursive: true });
      return `created ${rel(abs)}/`;
    },
  },

  search: {
    description:
      "Search file contents with a regex (ripgrep if available, else grep). Returns file:line:match.",
    schema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Subdirectory to search. Default '.'" },
        glob: { type: "string", description: "Filename filter, e.g. '*.py'" },
      },
      required: ["pattern"],
    },
    async run({ pattern, path: p = ".", glob }) {
      const abs = await jail(p);
      const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
      const rg = `rg --line-number --no-heading --color never ${glob ? `--glob ${q(glob)} ` : ""}-e ${q(pattern)} .`;
      const gr = `grep -rn ${glob ? `--include=${q(glob)} ` : ""}-E ${q(pattern)} .`;
      const { stdout, stderr, code } = await sh(
        `command -v rg >/dev/null 2>&1 && ${rg} || ${gr}`, abs, 60_000);
      if (!stdout.trim()) return code === 0 ? "(no output)" : "no matches";
      return clip(stdout);
    },
  },

  exec: {
    description:
      "Run any shell command inside the sandbox. cwd is forced to the sandbox; the command itself is unrestricted.",
    schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string", description: "Relative working directory. Default '.'" },
        timeout_ms: { type: "number" },
        stdin: { type: "string" },
      },
      required: ["command"],
    },
    async run({ command, cwd = ".", timeout_ms = DEFAULT_TIMEOUT_MS, stdin }) {
      const abs = await jail(cwd);
      const r = await sh(command, abs, timeout_ms, stdin);
      const parts = [];
      if (r.stdout) parts.push(r.stdout);
      if (r.stderr) parts.push(`[stderr]\n${r.stderr}`);
      parts.push(`[exit ${r.code}${r.timedOut ? " — timed out" : ""}]`);
      return clip(parts.join("\n"));
    },
  },

  fetch: {
    description: "HTTP request. Returns status, headers and body (text).",
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", description: "Default GET" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "string" },
        save_to: { type: "string", description: "Relative path: write the body here instead of returning it" },
      },
      required: ["url"],
    },
    async run({ url, method = "GET", headers = {}, body, save_to }) {
      const res = await fetch(url, { method, headers, body });
      const head =
        `${res.status} ${res.statusText}\n` +
        [...res.headers].map(([k, v]) => `${k}: ${v}`).join("\n");
      if (save_to) {
        const abs = await jail(save_to);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, Buffer.from(await res.arrayBuffer()));
        return `${head}\n\nsaved to ${rel(abs)}`;
      }
      return clip(`${head}\n\n${await res.text()}`);
    },
  },

  note: {
    description:
      "Persistent scratch memory for the sandbox (survives restarts). op: get | set | delete | list.",
    schema: {
      type: "object",
      properties: {
        op: { type: "string", enum: ["get", "set", "delete", "list"] },
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["op"],
    },
    async run({ op, key, value }) {
      const file = path.join(REAL_ROOT, ".sandbox-notes.json");
      let db = {};
      try { db = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
      if (op === "list") return Object.keys(db).length ? Object.keys(db).join("\n") : "(no notes)";
      if (!key) throw new Error("key is required");
      if (op === "get") return key in db ? db[key] : `(no note '${key}')`;
      if (op === "set") { db[key] = value ?? ""; }
      else if (op === "delete") { delete db[key]; }
      else throw new Error(`unknown op '${op}'`);
      await fs.writeFile(file, JSON.stringify(db, null, 2));
      return `${op} ${key}`;
    },
  },
};

const ISOLATE = process.env.SANDBOX_ISOLATE === "1";

/**
 * Build the argv for a command. With SANDBOX_ISOLATE=1 the command runs under
 * bubblewrap: the host filesystem is read-only, /home and the rest of the disk
 * are not mounted, and only the sandbox root is writable — so `cd /` buys
 * nothing. Without it, exec is an ordinary shell that merely *starts* in the
 * sandbox and can read the wider machine.
 */
function argvFor(command, cwd) {
  if (!ISOLATE) return ["bash", ["-lc", command]];
  const inner = path.join("/sandbox", path.relative(REAL_ROOT, cwd));
  // /etc/resolv.conf is often a symlink into /run (systemd-resolved); bind the
  // target too or DNS breaks inside the namespace.
  const dns = existsSync("/run/systemd/resolve")
    ? ["--ro-bind", "/run/systemd/resolve", "/run/systemd/resolve"]
    : [];
  return ["bwrap", [
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/etc", "/etc",
    ...dns,
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    "--symlink", "usr/sbin", "/sbin",
    "--bind", REAL_ROOT, "/sandbox",
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
    "--unshare-all", "--share-net",
    "--die-with-parent", "--new-session",
    "--chdir", inner,
    "bash", "-lc", command,
  ]];
}

/** Run a command under bash with a hard timeout. */
function sh(command, cwd, timeout_ms, stdin) {
  const [bin, args] = argvFor(command, cwd);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, SANDBOX_DIR: REAL_ROOT, PWD: cwd },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout_ms);
    child.stdout.on("data", (d) => { if (stdout.length < MAX_OUTPUT * 2) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < MAX_OUTPUT * 2) stderr += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1, timedOut });
    });
    if (stdin != null) child.stdin.write(stdin);
    child.stdin.end();
  });
}

/* ------------------------------------------------------------- transport -- */

const LOG = process.env.SANDBOX_LOG ? createWriteStream(process.env.SANDBOX_LOG, { flags: "a" }) : null;
const log = (...a) => LOG?.write(`${new Date().toISOString()} ${a.join(" ")}\n`);

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => send({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sandbox", version: "1.0.0" },
        instructions:
          `A sandbox rooted at ${REAL_ROOT}. You have full read/write/exec freedom inside it ` +
          `and no access outside it. Paths are relative to the root.`,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications carry no id — no response

    case "ping":
      return reply({});

    case "tools/list":
      return reply({
        tools: Object.entries(tools).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: t.schema,
        })),
      });

    case "tools/call": {
      const tool = tools[params?.name];
      if (!tool) return fail(-32602, `unknown tool: ${params?.name}`);
      try {
        const text = await tool.run(params.arguments ?? {});
        return reply({ content: [{ type: "text", text: String(text ?? "(no output)") }] });
      } catch (e) {
        log("tool error", params.name, e.stack || e.message);
        return reply({
          content: [{ type: "text", text: `Error: ${e.message}` }],
          isError: true,
        });
      }
    }

    default:
      if (id === undefined) return; // unknown notification
      return fail(-32601, `method not found: ${method}`);
  }
}

readline.createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return log("bad json", line); }
  try { await handle(msg); } catch (e) {
    log("fatal", e.stack);
    if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: e.message } });
  }
});

process.on("uncaughtException", (e) => log("uncaught", e.stack));
log(`sandbox mcp started, root=${REAL_ROOT}`);
