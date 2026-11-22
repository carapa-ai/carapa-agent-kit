// src/modules/transcripts/transcripts-cli.ts
import path3 from "node:path";

// src/modules/transcripts/reader-core.ts
import fs2 from "node:fs";
import path2 from "node:path";
import zlib from "node:zlib";

// src/modules/transcripts/transcript-fs-safe.ts
import fs from "node:fs";
import path from "node:path";
function isRealDir(p) {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}
var OPEN_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0);
function descriptorInDir(fd, stat, dir, filePath) {
  const realDir = fs.realpathSync(dir);
  let target = null;
  try {
    target = fs.readlinkSync(`/proc/self/fd/${fd}`);
  } catch {}
  if (target !== null)
    return path.dirname(target) === realDir;
  const expected = fs.lstatSync(path.join(realDir, path.basename(filePath)));
  return expected.dev === stat.dev && expected.ino === stat.ino;
}
function readWindow(size, opts) {
  const { maxBytes } = opts;
  if (maxBytes === undefined || size <= maxBytes) {
    return { start: 0, length: size };
  }
  return opts.tail ? { start: size - maxBytes, length: maxBytes } : null;
}
function trimRead(buf, filled) {
  return filled === buf.length ? buf : buf.subarray(0, filled);
}
function readFully(fd, start, length) {
  const buf = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const n = fs.readSync(fd, buf, filled, length - filled, start + filled);
    if (n === 0)
      break;
    filled += n;
  }
  return trimRead(buf, filled);
}
function openNoFollowSync(dir, filePath) {
  if (!isRealDir(dir))
    return null;
  let fd;
  try {
    fd = fs.openSync(filePath, OPEN_FLAGS);
  } catch {
    return null;
  }
  try {
    const stat = fs.fstatSync(fd);
    if (stat.isFile() && descriptorInDir(fd, stat, dir, filePath)) {
      return { fd, stat };
    }
  } catch {}
  try {
    fs.closeSync(fd);
  } catch {}
  return null;
}
function readBufferNoFollowSync(dir, filePath, opts = {}) {
  const opened = openNoFollowSync(dir, filePath);
  if (!opened)
    return null;
  const { fd, stat } = opened;
  try {
    const window = readWindow(stat.size, opts);
    if (!window)
      return null;
    return { buffer: readFully(fd, window.start, window.length), stat };
  } catch {
    return null;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
  }
}
function readNoFollowSync(dir, filePath, opts = {}) {
  const r = readBufferNoFollowSync(dir, filePath, opts);
  return r ? { content: r.buffer.toString("utf8"), stat: r.stat } : null;
}

// src/modules/transcripts/reader-core.ts
var MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
var TOOL_INPUT_MAX = 160;
function parseTimestamp(value) {
  if (!value)
    return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatTime(dt) {
  if (!dt)
    return "?";
  return dt.toISOString().replace("T", " ").slice(0, 16);
}
function truncate(text, maxLen = 200) {
  if (!text)
    return "";
  const collapsed = text.split(/\s+/).join(" ").trim();
  if (collapsed.length <= maxLen)
    return collapsed;
  return collapsed.slice(0, maxLen) + "...";
}
function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}
function transcriptId(fileName) {
  return fileName.replace(/\.output\.jsonl$/, "").replace(/\.jsonl$/, "");
}
function timeFromFileName(fileName) {
  const epoch = fileName.match(/(\d{13})/);
  if (epoch) {
    const d = new Date(parseInt(epoch[1], 10));
    if (!Number.isNaN(d.getTime()))
      return d;
  }
  const prefix = fileName.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (prefix) {
    const ms = parseDateOnly(prefix[1]);
    if (ms !== null)
      return new Date(ms);
  }
  return null;
}
function fileActivityMs(file) {
  return Math.max(file.nameTime?.getTime() ?? 0, file.mtimeMs);
}
var BLOCKS = [
  { open: "[CARAPABOT CONTEXT", close: "[/CARAPABOT CONTEXT]" },
  { open: "<system-reminder>", close: "</system-reminder>" },
  { open: "[INHERITED GROUP RULES]", close: "[END INHERITED GROUP RULES]" }
];
function cleanUserContent(content) {
  if (typeof content !== "string")
    return content;
  const cleaned = [];
  let closeMarker = null;
  for (const line of content.split(`
`)) {
    const trimmed = line.trim();
    if (closeMarker) {
      if (trimmed.includes(closeMarker))
        closeMarker = null;
      continue;
    }
    if (trimmed.startsWith("[CURRENT HUMAN CONTEXT]"))
      break;
    if (trimmed.startsWith("[AGENT_CONTEXT") || trimmed.startsWith("[INSTRUCTION:") || trimmed.startsWith("[CHANNEL:") || trimmed.startsWith("[Shared browser:")) {
      continue;
    }
    const block = BLOCKS.find((b) => trimmed.includes(b.open));
    if (block) {
      const afterOpen = trimmed.slice(trimmed.indexOf(block.open) + block.open.length);
      if (!afterOpen.includes(block.close))
        closeMarker = block.close;
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join(`
`).trim();
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
function toolInput(input, full) {
  let text = "";
  if (typeof input === "string") {
    text = input;
  } else if (full) {
    text = input === undefined ? "" : JSON.stringify(input);
  } else if (input && typeof input === "object") {
    const rec = input;
    const key = [
      "command",
      "file_path",
      "path",
      "pattern",
      "query",
      "url",
      "description",
      "prompt"
    ].find((k) => typeof rec[k] === "string" && rec[k]);
    text = key ? String(rec[key]) : JSON.stringify(input);
  }
  return full ? text.trim() : truncate(text, TOOL_INPUT_MAX);
}
function toolMessage(name, input, full, created_at, agent_name, toolId) {
  const detail = toolInput(input, full);
  return {
    role: "assistant",
    content: detail ? `TOOL ${name}: ${detail}` : `TOOL ${name}`,
    created_at,
    agent_name,
    kind: "tool",
    toolId: toolId || undefined,
    toolName: name,
    toolInput: input,
    toolDetail: detail
  };
}
function toolResult(toolId, name, output, failed, created_at, agent_name) {
  return {
    role: "assistant",
    content: "",
    created_at,
    agent_name,
    kind: "tool_result",
    toolId: toolId || undefined,
    toolName: name,
    result: { text: outputText(output), failed }
  };
}
function outputText(output) {
  if (typeof output === "string")
    return output;
  if (output === undefined || output === null)
    return "";
  const content = output.content;
  if (!Array.isArray(output) && Array.isArray(content)) {
    return outputText(content);
  }
  if (Array.isArray(output)) {
    return output.map((b) => b?.type === "text" && typeof b.text === "string" ? b.text : b?.type === "image" ? "[image]" : JSON.stringify(b)).join(`
`);
  }
  return JSON.stringify(output);
}
function formatBytes(n) {
  if (n < 1024)
    return `${n} B`;
  if (n < 1024 * 1024)
    return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
var resultBytes = (r) => Buffer.byteLength(r.text);
function numberedToolLine(msg) {
  const head = `TOOL #${msg.toolNo} ${msg.toolName}`;
  let line = msg.toolDetail ? `${head}: ${msg.toolDetail}` : head;
  if (msg.result) {
    line += msg.result.failed ? ` → failed: ${truncate(msg.result.text, 80)}` : ` → ${formatBytes(resultBytes(msg.result))}`;
  }
  return line;
}

class ToolPairing {
  count = 0;
  byId = new Map;
  accept(msg) {
    if (msg.kind === "message")
      return msg;
    const call = msg.toolId ? this.byId.get(msg.toolId) : undefined;
    if (msg.kind === "tool_result") {
      if (call) {
        call.result = msg.result;
        return null;
      }
      msg = { ...msg, kind: "tool", content: `TOOL ${msg.toolName}` };
    } else if (call) {
      return null;
    }
    msg.toolNo = ++this.count;
    if (msg.toolId)
      this.byId.set(msg.toolId, msg);
    return msg;
  }
}
function normalizeEntry(entry, full = false) {
  if (!entry || typeof entry !== "object")
    return [];
  const e = entry;
  const type = asString(e.type);
  const created_at = asString(e.timestamp) || asString(e.created_at);
  const agent_name = asString(e.agent_name);
  if (type === "" || type === "message") {
    const role = asString(e.role);
    if (!role || typeof e.content !== "string" || !e.content)
      return [];
    const content = role === "user" ? cleanUserContent(e.content) : e.content.trim();
    if (!content)
      return [];
    return [{ role, content, created_at, agent_name, kind: "message" }];
  }
  if (type === "assistant") {
    const msg = e.message;
    if (!msg || typeof msg !== "object" || !Array.isArray(msg.content)) {
      return [];
    }
    const model = asString(msg.model) || asString(e.model) || agent_name;
    const out = [];
    const text = msg.content.filter((p) => p?.type === "text" && typeof p.text === "string").map((p) => p.text).join(`
`).trim();
    if (text) {
      out.push({
        role: "assistant",
        content: text,
        created_at,
        agent_name: model,
        kind: "message"
      });
    }
    for (const p of msg.content) {
      if (p?.type === "tool_use") {
        out.push(toolMessage(asString(p.name) || "unknown", p.input, full, created_at, model, asString(p.id)));
      }
    }
    return out;
  }
  if (type === "user") {
    const content = e.message?.content;
    if (!Array.isArray(content))
      return [];
    return content.filter((p) => p?.type === "tool_result").map((p) => toolResult(asString(p.tool_use_id), "unknown", p.content, p.is_error === true, created_at, agent_name));
  }
  if (type === "text") {
    const content = asString(e.text) || asString(e.content);
    return content ? [
      {
        role: "assistant",
        content,
        created_at,
        agent_name: asString(e.model) || agent_name,
        kind: "message"
      }
    ] : [];
  }
  if (type === "tool_call") {
    const name = asString(e.name) || "unknown";
    const id = asString(e.id);
    if (e.input !== undefined) {
      return [toolMessage(name, e.input, full, created_at, agent_name, id)];
    }
    if (e.status === "failed") {
      const detail = asString(e.error?.message) || "failed";
      return [toolResult(id, name, detail, true, created_at, agent_name)];
    }
    if (e.status === "completed") {
      return [toolResult(id, name, e.output, false, created_at, agent_name)];
    }
    return [];
  }
  if (type === "tool_use") {
    const name = asString(e.part?.tool) || asString(e.tool) || "unknown";
    const id = asString(e.part?.id);
    const state = e.part?.state;
    const out = [
      toolMessage(name, state?.input ?? e.input, full, created_at, agent_name, id)
    ];
    if (state?.status === "completed" || state?.status === "error") {
      out.push(toolResult(id, name, state.output, state.status === "error", created_at, agent_name));
    }
    return out;
  }
  if (type === "compaction_marker") {
    return [
      {
        role: "system",
        content: `[CONTEXT COMPACTED: ${asString(e.content)}]`,
        created_at,
        agent_name: "",
        kind: "message"
      }
    ];
  }
  return [];
}
function keep(msg, opts) {
  if (msg.kind === "tool" && !opts.includeTools)
    return false;
  if (opts.role && msg.role !== opts.role)
    return false;
  if (opts.sinceMs !== undefined) {
    const ts = parseTimestamp(msg.created_at);
    if (ts && ts.getTime() < opts.sinceMs)
      return false;
  }
  return true;
}
function* lines(text) {
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf(`
`, start);
    if (end === -1)
      end = text.length;
    const line = text.slice(start, end).trim();
    start = end + 1;
    if (line)
      yield line;
  }
}
function runStartId(line) {
  if (!line.includes('"run_start"'))
    return;
  try {
    const entry = JSON.parse(line);
    return entry?.entry_type === "run_start" ? asString(entry.run_id) : undefined;
  } catch {
    return;
  }
}
function parseLine(line, full = false) {
  try {
    const entry = JSON.parse(line);
    const ts = entry && typeof entry === "object" ? asString(entry.timestamp) || asString(entry.created_at) : "";
    return { ts, messages: normalizeEntry(entry, full) };
  } catch {
    return { ts: "", messages: [] };
  }
}

class TimestampCarry {
  last = "";
  see(ts) {
    if (ts)
      this.last = ts;
  }
  fill(msg) {
    return msg.created_at || !this.last ? msg : { ...msg, created_at: this.last };
  }
}
function parseTranscriptText(text, opts = {}) {
  const out = [];
  const carry = new TimestampCarry;
  const tools = new ToolPairing;
  let inRun = opts.runId === undefined;
  for (const line of lines(text)) {
    if (opts.runId !== undefined) {
      const startedRun = runStartId(line);
      if (startedRun !== undefined)
        inRun = startedRun === opts.runId;
    }
    const parsed = parseLine(line, opts.full);
    carry.see(parsed.ts);
    for (const raw of parsed.messages) {
      const msg = tools.accept(carry.fill(raw));
      if (msg && inRun && keep(msg, opts))
        out.push(msg);
    }
  }
  for (const msg of out) {
    if (msg.kind === "tool")
      msg.content = numberedToolLine(msg);
  }
  return out;
}
var SAFE_TERM = /^[a-z0-9 _.:/@#-]+$/;
function normalizeSearchTerms(terms) {
  const seen = new Set;
  const out = [];
  for (const term of Array.isArray(terms) ? terms : [terms]) {
    if (!term.trim())
      continue;
    const key = term.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}
function searchTranscriptText(text, terms, opts = {}) {
  const normalized = normalizeSearchTerms(terms);
  const needles = normalized.map((t) => t.toLowerCase());
  const prefilter = !opts.includeTools && needles.every((n) => SAFE_TERM.test(n));
  const out = [];
  const carry = new TimestampCarry;
  const tools = new ToolPairing;
  for (const line of lines(text)) {
    if (prefilter) {
      const lower = line.toLowerCase();
      if (!needles.some((n) => lower.includes(n))) {
        if (line.includes('"timestamp"') || line.includes('"created_at"')) {
          carry.see(parseLine(line).ts);
        }
        continue;
      }
    }
    const parsed = parseLine(line, opts.full);
    carry.see(parsed.ts);
    for (const raw of parsed.messages) {
      const msg = tools.accept(carry.fill(raw));
      if (msg && keep(msg, opts)) {
        const content = msg.content.toLowerCase();
        const matchedTerms = normalized.filter((_, i) => content.includes(needles[i]));
        if (matchedTerms.length > 0)
          out.push({ msg, matchedTerms });
      }
    }
  }
  for (const hit of out) {
    if (hit.msg.kind === "tool")
      hit.msg.content = numberedToolLine(hit.msg);
  }
  return out;
}
var SKIP_CHILD_DIRS = new Set(["objectives", "transcripts", "logs"]);
var PROJECT_DIRS_FILE = "project-dirs.json";
function readProjectDirs(root) {
  const text = readNoFollowSync(root, path2.join(root, PROJECT_DIRS_FILE));
  if (!text)
    return null;
  let projects;
  try {
    projects = JSON.parse(text.content)?.projects;
  } catch {
    return null;
  }
  if (!projects || typeof projects !== "object" || Array.isArray(projects))
    return null;
  const dirs = new Map;
  for (const [name, rel] of Object.entries(projects)) {
    if (typeof rel !== "string")
      continue;
    const parts = rel.split("/");
    if (parts.some((p) => p === "" || p === "." || p === ".."))
      continue;
    dirs.set(name, path2.join(root, ...parts));
  }
  return dirs.size > 0 ? dirs : null;
}
function isDir(p) {
  try {
    return fs2.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function subdirs(dir) {
  try {
    return fs2.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name).filter((name) => isDir(path2.join(dir, name)));
  } catch {
    return [];
  }
}
function discoverGroups(root, opts = {}) {
  const found = new Map;
  const add = (name, dir) => {
    if (!found.has(name) && isDir(dir))
      found.set(name, dir);
  };
  const projectDirs = readProjectDirs(root);
  if (projectDirs) {
    for (const [name, dir] of projectDirs)
      add(name, path2.join(dir, "transcripts"));
  } else {
    for (const top of subdirs(root)) {
      if (top === "objectives" || top === "transcripts")
        continue;
      const topPath = path2.join(root, top);
      add(top, path2.join(topPath, "transcripts"));
      for (const child of subdirs(topPath)) {
        if (child.startsWith(".") || SKIP_CHILD_DIRS.has(child))
          continue;
        add(child, path2.join(topPath, child, "transcripts"));
      }
    }
  }
  const objectivesDir = path2.join(root, "objectives");
  for (const obj of subdirs(objectivesDir)) {
    add(obj, path2.join(objectivesDir, obj, "transcripts"));
  }
  if (opts.sharedName) {
    const shared = opts.sharedDir ?? path2.join(root, "transcripts");
    add(opts.sharedName, shared);
  }
  return [...found.entries()].map(([name, dir]) => ({ name, dir })).sort((a, b) => a.name.localeCompare(b.name));
}
var lastArchive = null;
function cString(buf, start, length) {
  const slice = buf.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString("utf8");
}
function octal(buf, start, length) {
  if (buf[start] & 128)
    return null;
  const text = cString(buf, start, length).trim();
  if (!/^[0-7]*$/.test(text))
    return null;
  return text === "" ? 0 : parseInt(text, 8);
}
function parseTar(data) {
  const members = [];
  let pos = 0;
  let longName = null;
  let paxPath = null;
  while (pos + 512 <= data.length) {
    if (data.subarray(pos, pos + 512).every((b) => b === 0))
      break;
    const size = octal(data, pos + 124, 12);
    if (size === null || pos + 512 + size > data.length)
      break;
    const mtime = octal(data, pos + 136, 12) ?? 0;
    const type = String.fromCharCode(data[pos + 156] || 48);
    const prefix = cString(data, pos + 345, 155);
    const base = cString(data, pos, 100);
    const body = pos + 512;
    if (type === "L") {
      longName = cString(data, body, size);
    } else if (type === "x") {
      const m = data.subarray(body, body + size).toString("utf8").match(/\d+ path=([^\n]*)\n/);
      paxPath = m ? m[1] : null;
    } else if (type === "g") {} else {
      if (type === "0" || type === "\x00") {
        const name = paxPath ?? longName ?? (prefix ? `${prefix}/${base}` : base);
        if (isTranscriptName(name)) {
          members.push({ name, mtimeMs: mtime * 1000, offset: body, size });
        }
      }
      longName = null;
      paxPath = null;
    }
    pos = body + Math.ceil(size / 512) * 512;
  }
  return members;
}
function loadArchive(archivePath) {
  if (lastArchive?.path === archivePath)
    return lastArchive;
  try {
    const raw = readBufferNoFollowSync(path2.dirname(archivePath), archivePath);
    if (!raw)
      return null;
    const data = zlib.gunzipSync(raw.buffer, {
      maxOutputLength: MAX_ARCHIVE_BYTES
    });
    lastArchive = { path: archivePath, data, members: parseTar(data) };
    return lastArchive;
  } catch {
    return null;
  }
}
function safeMemberName(name) {
  return name.replace(/[\u0000-\u001f\u007f]/g, "?");
}
function archiveFiles(archivePath) {
  const archive = loadArchive(archivePath);
  if (!archive)
    return [];
  const archiveName = path2.basename(archivePath);
  return archive.members.map((m) => {
    const fileName = safeMemberName(m.name);
    return {
      id: transcriptId(fileName),
      fileName,
      nameTime: timeFromFileName(path2.basename(fileName)),
      mtimeMs: m.mtimeMs,
      archived: true,
      archiveName,
      readText: () => {
        const a = loadArchive(archivePath);
        const member = a?.members.find((x) => x.offset === m.offset && x.name === m.name);
        return member ? a.data.toString("utf8", member.offset, member.offset + member.size) : "";
      }
    };
  });
}
var isTranscriptName = (name) => name.endsWith(".jsonl") && !name.endsWith(".stream.jsonl");
function listLiveFiles(dir) {
  if (!isRealDir(dir))
    return [];
  let names;
  try {
    names = fs2.readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const fileName of names) {
    if (!isTranscriptName(fileName))
      continue;
    const filePath = path2.join(dir, fileName);
    let st;
    try {
      st = fs2.lstatSync(filePath);
    } catch {
      continue;
    }
    if (!st.isFile())
      continue;
    files.push({
      id: transcriptId(fileName),
      fileName,
      nameTime: timeFromFileName(fileName),
      mtimeMs: st.mtimeMs,
      archived: false,
      readText: () => readNoFollowSync(dir, filePath)?.content ?? ""
    });
  }
  return files;
}
function hasArchives(dir) {
  return archiveNames(dir).length > 0;
}
function archiveNames(dir) {
  if (!isRealDir(dir) || !isRealDir(path2.join(dir, "archive")))
    return [];
  try {
    return fs2.readdirSync(path2.join(dir, "archive")).filter((n) => n.endsWith(".tar.gz")).sort().reverse();
  } catch {
    return [];
  }
}
function listTranscriptFiles(dir, opts = {}) {
  const live = listLiveFiles(dir);
  let files = live;
  let withArchive = opts.archive === true;
  if (opts.archive === "auto" && opts.sinceMs !== undefined) {
    const oldest = live.length ? Math.min(...live.map((f) => f.nameTime?.getTime() ?? f.mtimeMs)) : Infinity;
    withArchive = opts.sinceMs < oldest;
  }
  if (withArchive) {
    const seen = new Set(live.map((f) => f.fileName));
    files = [...live];
    for (const name of archiveNames(dir)) {
      for (const f of archiveFiles(path2.join(dir, "archive", name))) {
        if (seen.has(f.fileName))
          continue;
        seen.add(f.fileName);
        files.push(f);
      }
    }
  }
  const plainIds = new Set(files.filter((f) => !f.fileName.endsWith(".output.jsonl")).map((f) => f.id));
  for (const f of files) {
    if (f.fileName.endsWith(".output.jsonl") && plainIds.has(f.id)) {
      f.id = `${f.id}.output`;
    }
  }
  if (opts.sinceMs !== undefined) {
    const since = opts.sinceMs;
    files = files.filter((f) => fileActivityMs(f) >= since);
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// src/modules/transcripts/reader-commands.ts
var DEFAULT_SEARCH_LIMIT = 50;
function resolveOptions(opts) {
  if (opts.since === undefined)
    return {};
  const sinceMs = parseDateOnly(opts.since);
  return sinceMs === null ? { error: `Invalid --since '${opts.since}'; expected YYYY-MM-DD.` } : { sinceMs };
}
function invalid(error) {
  return { text: error, data: { error } };
}
function filesFor(source, opts, sinceMs) {
  return listTranscriptFiles(source.dir, {
    archive: opts.archive ? true : "auto",
    sinceMs
  });
}
function readFile(file, opts, sinceMs, runId) {
  return parseTranscriptText(file.readText(), {
    includeTools: opts.tools,
    full: opts.full,
    role: opts.role,
    sinceMs,
    runId
  });
}
function formatMessage(msg, full, fallback) {
  const ts = parseTimestamp(msg.created_at) || fallback;
  const role = msg.role.toUpperCase();
  const who = msg.agent_name ? `${role} (${msg.agent_name})` : role;
  return `[${formatTime(ts)}] ${who}: ${displayContent(msg, full)}`;
}
function displayContent(msg, full) {
  return full || msg.kind === "tool" ? msg.content : truncate(msg.content);
}
function messageData(msg, full) {
  const { role, created_at, agent_name, kind, toolNo } = msg;
  return {
    role,
    content: displayContent(msg, full),
    created_at,
    agent_name,
    kind,
    ...toolNo === undefined ? {} : { toolNo }
  };
}
var fileTime = (f) => f.nameTime ?? new Date(f.mtimeMs);
function summaryCommand(ctx, group, opts = {}) {
  const { sinceMs, error } = resolveOptions(opts);
  if (error)
    return invalid(error);
  const groups = group ? [ctx.resolveGroup(group)] : ctx.listGroups();
  if (groups.length === 0) {
    return { text: "No groups found.", data: { groups: [] } };
  }
  let text = `=== Transcript Summary ===

`;
  const data = [];
  for (const source of groups) {
    const files = filesFor(source, opts, sinceMs);
    if (files.length === 0) {
      text += `  ${source.name}: (no transcripts)
`;
      data.push({ group: source.name, transcripts: 0 });
      continue;
    }
    let totalMessages = 0;
    const agents = new Set;
    let latest = null;
    const recentTasks = [];
    let archived = 0;
    for (const f of files) {
      if (f.archived)
        archived++;
      const messages = readFile(f, opts, sinceMs);
      totalMessages += messages.length;
      for (const msg of messages) {
        if (msg.agent_name)
          agents.add(msg.agent_name);
        const ts = parseTimestamp(msg.created_at) || fileTime(f);
        if (!latest || ts > latest)
          latest = ts;
      }
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser && recentTasks.length < 3) {
        recentTasks.push(truncate(firstUser.content, 60));
      }
    }
    const agentList = [...agents].sort();
    text += `  ${source.name}:
`;
    text += `    Transcripts: ${files.length}${archived ? ` (${archived} archived)` : ""}  |  Messages: ${totalMessages}
`;
    text += `    Last activity: ${formatTime(latest)}
`;
    text += `    Agents: ${agentList.join(", ") || "none"}
`;
    if (recentTasks.length > 0) {
      text += `    Recent tasks:
`;
      for (const t of recentTasks)
        text += `      • ${t}
`;
    }
    text += `
`;
    data.push({
      group: source.name,
      transcripts: files.length,
      archived,
      messages: totalMessages,
      lastActivity: latest ? latest.toISOString() : null,
      agents: agentList,
      recentTasks
    });
  }
  return { text, data: { groups: data } };
}
function listCommand(ctx, group, opts = {}) {
  const { sinceMs, error } = resolveOptions(opts);
  if (error)
    return invalid(error);
  const source = ctx.resolveGroup(group);
  const all = filesFor(source, opts, sinceMs);
  if (all.length === 0) {
    return {
      text: `No transcripts found for group '${group}'.`,
      data: { group, transcripts: [] }
    };
  }
  const files = opts.limit && opts.limit > 0 ? all.slice(0, opts.limit) : all;
  let text = `=== Transcripts for '${group}' (${all.length} files${files.length < all.length ? `, showing ${files.length}` : ""}) ===

`;
  const data = [];
  for (const f of files) {
    const messages = readFile(f, opts, sinceMs);
    let first = null;
    let title = "";
    const agents = new Set;
    for (const msg of messages) {
      if (msg.role === "user" && !title)
        title = truncate(msg.content, 80);
      const ts = parseTimestamp(msg.created_at) || fileTime(f);
      if (!first || ts < first)
        first = ts;
      if (msg.agent_name)
        agents.add(msg.agent_name);
    }
    const agentList = [...agents];
    text += `  ${f.id}${f.archived ? " (archived)" : ""}
`;
    text += `    Date: ${formatTime(first)}  |  Messages: ${messages.length}${agentList.length ? ` [${agentList.join(", ")}]` : ""}
`;
    if (title)
      text += `    Task: ${title}
`;
    text += `
`;
    data.push({
      id: f.id,
      archived: f.archived,
      date: first ? first.toISOString() : null,
      messages: messages.length,
      agents: agentList,
      task: title
    });
  }
  return { text, data: { group, total: all.length, transcripts: data } };
}
var rawOutputHint = (raw, command) => `[Tool calls are logged in '${raw.id}': ${command}]`;
var RUN_ID = /^run-(\d{13})-[a-z0-9]{6}$/;
var RUN_MTIME_SLACK_MS = 60000;
var isRawOutput = (f) => f.fileName.endsWith(".output.jsonl");
var rawOutputOf = (files, target) => target.id.endsWith(".output") ? undefined : files.find((f) => f.id === `${target.id}.output`);
function locateRun(ctx, group, runId, opts, sinceMs) {
  const needle = `"run_id":"${runId}"`;
  const minMtimeMs = Number(RUN_ID.exec(runId)[1]) - RUN_MTIME_SLACK_MS;
  const sources = group === undefined ? ctx.listGroups() : [ctx.resolveGroup(group)];
  for (const source of sources) {
    const files = filesFor(source, opts, sinceMs);
    const target = files.filter((f) => f.mtimeMs >= minMtimeMs).sort((a, b) => Number(isRawOutput(a)) - Number(isRawOutput(b))).find((f) => f.readText().includes(needle));
    if (target) {
      return {
        group: source.name,
        target,
        rawOutput: rawOutputOf(files, target),
        runId
      };
    }
  }
  const hint = !opts.archive && (group === undefined || hasArchives(sources[0].dir)) ? " Archives were not searched; pass --archive." : "";
  const text = `Run '${runId}' not found in any task transcript${group === undefined ? "" : ` in group '${group}'`}.${hint} Run IDs resolve only for task runs.`;
  return {
    error: {
      text,
      data: { group: group ?? null, id: null, error: text, messages: [] }
    }
  };
}
function locate(ctx, group, id, opts, sinceMs) {
  if (id && RUN_ID.test(id))
    return locateRun(ctx, group, id, opts, sinceMs);
  if (group === undefined) {
    const found = ctx.listGroups().find((g) => filesFor(g, opts, sinceMs).some((f) => f.id.includes(id ?? "")));
    if (!found) {
      const text = `Transcript '${id}' not found in any group.${opts.archive ? "" : " Archives were not searched; pass --archive."}`;
      return {
        error: {
          text,
          data: { group: null, id: null, error: text, messages: [] }
        }
      };
    }
    group = found.name;
  }
  const source = ctx.resolveGroup(group);
  const files = filesFor(source, opts, sinceMs);
  if (files.length === 0) {
    return {
      error: {
        text: `No transcripts found for group '${group}'.`,
        data: { group, id: null, messages: [] }
      }
    };
  }
  const matches = id ? files.filter((f) => f.id.includes(id)) : files;
  const target = matches.find((f) => !f.id.endsWith(".output")) ?? matches[0];
  if (!target) {
    const hint = !opts.archive && hasArchives(source.dir) ? " Archives were not searched; pass --archive." : "";
    const text = `Task '${id}' not found in group '${group}'.${hint}`;
    return {
      error: { text, data: { group, id: null, error: text, messages: [] } }
    };
  }
  return { group, target, rawOutput: rawOutputOf(files, target) };
}
function showCommand(ctx, group, id, last, opts = {}) {
  const { sinceMs, error } = resolveOptions(opts);
  if (error)
    return invalid(error);
  const located = locate(ctx, group, id, opts, sinceMs);
  if (located.error)
    return located.error;
  const { target, runId } = located;
  group = located.group;
  let messages = readFile(target, { ...opts, tools: true }, sinceMs, runId);
  const isShown = (m) => !!opts.tools || m.kind !== "tool";
  if (last && last > 0) {
    const shownAt = messages.flatMap((m, i) => isShown(m) ? [i] : []);
    if (shownAt.length > last) {
      messages = messages.slice(shownAt[shownAt.length - last]);
    }
  }
  const shown = messages.filter(isShown);
  const lastReply = [...shown].reverse().find((m) => m.role === "assistant" && m.kind === "message");
  const fullFor = (m) => !!opts.full || m === lastReply;
  const title = runId ? `${target.id} · run ${runId}` : target.id;
  let text = `=== ${title} (${shown.length} messages) ===

`;
  let hiddenRun = 0;
  const flushHidden = () => {
    if (hiddenRun === 0)
      return;
    text += `  [${hiddenRun} tool call${hiddenRun === 1 ? "" : "s"}; --tools shows them]

`;
    hiddenRun = 0;
  };
  for (const msg of messages) {
    if (!isShown(msg)) {
      hiddenRun++;
      continue;
    }
    flushHidden();
    text += formatMessage(msg, fullFor(msg), fileTime(target)) + `

`;
  }
  flushHidden();
  const pointRaw = opts.tools && located.rawOutput && !messages.some((m) => m.kind === "tool");
  if (pointRaw)
    text += `  ${rawOutputHint(located.rawOutput, `show ${located.rawOutput.id} --tools`)}

`;
  return {
    text,
    data: {
      group,
      id: target.id,
      ...runId ? { runId } : {},
      archived: target.archived,
      ...pointRaw ? { toolCallsIn: located.rawOutput.id } : {},
      ...opts.tools ? {} : { hiddenToolCalls: messages.length - shown.length },
      messages: shown.map((m) => messageData(m, fullFor(m)))
    }
  };
}
function cutAtBytes(text, max) {
  const buf = Buffer.from(text);
  let end = max;
  while (end > 0 && (buf[end] & 192) === 128)
    end--;
  const prefix = buf.subarray(0, end).toString("utf8");
  const space = prefix.search(/\s\S*$/);
  return space >= prefix.length / 2 ? prefix.slice(0, space) : prefix;
}
function resultCommand(ctx, group, id, n, opts = {}) {
  const located = locate(ctx, group, id, opts);
  if (located.error)
    return located.error;
  const { target } = located;
  const call = parseTranscriptText(target.readText(), {
    includeTools: true,
    full: true
  }).find((m) => m.toolNo === n);
  if (!call) {
    const hint = located.rawOutput ? ` ${rawOutputHint(located.rawOutput, `result ${located.rawOutput.id} ${n}`)}` : "";
    return invalid(`Tool call #${n} not found in '${target.id}'.${hint}`);
  }
  const result = call.result;
  const bytes = result ? resultBytes(result) : 0;
  let text = result?.text ?? "";
  const truncated = opts.maxBytes !== undefined && opts.maxBytes > 0 && bytes > opts.maxBytes;
  if (truncated)
    text = cutAtBytes(text, opts.maxBytes);
  const input = typeof call.toolInput === "string" ? call.toolInput : JSON.stringify(call.toolInput ?? null, null, 2);
  const status = !result ? "no result logged" : result.failed ? "failed" : "ok";
  let out = `=== ${target.id} tool call #${n} ===

`;
  out += `${formatMessage({ ...call, content: `TOOL ${call.toolName}` }, true, fileTime(target))}

`;
  out += `Input:
${input}

`;
  out += `Result (${status}, ${bytes} bytes):
${text}
`;
  if (truncated) {
    out += `
[truncated: first ${Buffer.byteLength(text)} of ${bytes} bytes; raise --max-bytes to see more]
`;
  }
  return {
    text: out,
    data: {
      group: located.group,
      id: target.id,
      n,
      name: call.toolName,
      created_at: call.created_at,
      agent_name: call.agent_name,
      input: call.toolInput ?? null,
      result: result ? { failed: result.failed, bytes, truncated, text } : null
    }
  };
}
function searchCommand(ctx, query, group, opts = {}) {
  const { sinceMs, error } = resolveOptions(opts);
  if (error)
    return invalid(error);
  const terms = normalizeSearchTerms(query);
  const label = terms.join(" | ");
  const quoted = terms.map((t) => `'${t}'`).join(" | ");
  const multi = terms.length > 1;
  const groups = group ? [ctx.resolveGroup(group)] : ctx.listGroups();
  const limit = opts.limit && opts.limit > 0 ? opts.limit : DEFAULT_SEARCH_LIMIT;
  let total = 0;
  const termTotals = {};
  for (const term of terms)
    termTotals[term] = 0;
  const shown = [];
  for (const source of groups) {
    for (const f of filesFor(source, opts, sinceMs)) {
      const hits = searchTranscriptText(f.readText(), terms, {
        includeTools: opts.tools,
        role: opts.role,
        sinceMs
      });
      for (const hit of hits) {
        total++;
        for (const term of hit.matchedTerms)
          termTotals[term]++;
        if (shown.length < limit) {
          shown.push({
            group: source.name,
            id: f.id,
            archived: f.archived,
            msg: hit.msg,
            fallback: fileTime(f)
          });
        }
      }
    }
  }
  if (total === 0) {
    return {
      text: `No results found for ${quoted}.`,
      data: {
        query: label,
        ...multi ? { terms, termTotals } : {},
        total: 0,
        shown: 0,
        results: []
      }
    };
  }
  let text = `=== Search results for ${quoted} (${total} matches) ===
`;
  if (multi) {
    text += `Per term: ${terms.map((t) => `${t} ${termTotals[t]}`).join(", ")}
`;
  }
  text += `
`;
  for (const r of shown) {
    text += `  [${r.group}] ${r.id}${r.archived ? " (archived)" : ""}
`;
    text += `    ${formatMessage(r.msg, !!opts.full, r.fallback)}

`;
  }
  if (shown.length < total) {
    text += `Showing the first ${shown.length} of ${total} matches; use --limit N to show more.
`;
  }
  return {
    text,
    data: {
      query: label,
      ...multi ? { terms, termTotals } : {},
      total,
      shown: shown.length,
      results: shown.map((r) => ({
        group: r.group,
        id: r.id,
        archived: r.archived,
        message: messageData(r.msg, !!opts.full)
      }))
    }
  };
}

// src/modules/transcripts/transcripts-cli.ts
var USAGE = `Usage:
  transcripts.mjs summary [--group G]
  transcripts.mjs list <group>
  transcripts.mjs show <task_or_conv_or_run_id> [--last N] [--full]
  transcripts.mjs show <group> [task_or_conv_id] [--last N] [--full]
  transcripts.mjs search <term> [<term>...] [--group G] [--full]
  transcripts.mjs result [group] <task_or_conv_id> <n> [--max-bytes N]

Options: --since YYYY-MM-DD  --role user|assistant  --tools  --archive
         --json  --limit N (search default 50)
show --tools numbers tool calls (#n); result prints call #n with its output.
A run ID (run-<13 digits>-<6 chars>, from Run History) opens its task transcript;
show limits it to that run, result numbers tools across the whole transcript.
search with several terms ORs them in one pass and reports per-term counts.
Environment: TRANSCRIPTS_GROUP_ROOT, TRANSCRIPTS_DIR, TRANSCRIPTS_PROJECT`;

class UsageError extends Error {
}
var VALUE_FLAGS = new Set([
  "--group",
  "-g",
  "--last",
  "-n",
  "--since",
  "--role",
  "--limit",
  "--max-bytes"
]);
function positiveInt(flag, value) {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new UsageError(`${flag} expects a positive integer, got '${value}'.`);
  }
  return Number(value);
}
function parseArgs(args) {
  const parsed = { positional: [], json: false, options: {} };
  for (let i = 0;i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-") || arg === "-") {
      parsed.positional.push(arg);
      continue;
    }
    let flag = arg;
    let value;
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq !== -1) {
      flag = arg.slice(0, eq);
      value = arg.slice(eq + 1);
    }
    if (VALUE_FLAGS.has(flag)) {
      if (value === undefined) {
        value = args[++i];
        if (value === undefined)
          throw new UsageError(`${flag} needs a value.`);
      }
    }
    switch (flag) {
      case "--group":
      case "-g":
        parsed.group = value;
        break;
      case "--last":
      case "-n":
        parsed.last = positiveInt(flag, value);
        break;
      case "--limit":
        parsed.options.limit = positiveInt(flag, value);
        break;
      case "--max-bytes":
        parsed.maxBytes = positiveInt(flag, value);
        break;
      case "--since":
        parsed.options.since = value;
        break;
      case "--role":
        if (value !== "user" && value !== "assistant") {
          throw new UsageError(`--role expects user or assistant.`);
        }
        parsed.options.role = value;
        break;
      case "--full":
      case "-f":
        parsed.options.full = true;
        break;
      case "--tools":
        parsed.options.tools = true;
        break;
      case "--archive":
        parsed.options.archive = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      default:
        throw new UsageError(`Unknown option '${arg}'.`);
    }
  }
  return parsed;
}
function contextFromEnv(env) {
  const root = env.TRANSCRIPTS_GROUP_ROOT || "/workspace/group";
  const sharedDir = env.TRANSCRIPTS_DIR || path3.join(root, "transcripts");
  const sharedName = env.TRANSCRIPTS_PROJECT || "shared";
  const groups = () => discoverGroups(root, { sharedName, sharedDir });
  return {
    listGroups: groups,
    resolveGroup: (name) => groups().find((g) => g.name === name) ?? {
      name,
      dir: path3.join(root, name, "transcripts")
    }
  };
}
function runCli(argv, env = {}) {
  try {
    const [command, ...rest] = argv;
    if (!command || command === "--help" || command === "-h") {
      return { stdout: USAGE + `
`, code: command ? 0 : 1 };
    }
    const p = parseArgs(rest);
    const ctx = contextFromEnv(env);
    let result;
    switch (command) {
      case "summary":
        result = summaryCommand(ctx, p.group, p.options);
        break;
      case "list":
        if (!p.positional[0])
          throw new UsageError("list needs <group>.");
        result = listCommand(ctx, p.positional[0], p.options);
        break;
      case "show": {
        const [first, second] = p.positional;
        if (!first)
          throw new UsageError("show needs <id> or <group>.");
        const isGroup = second !== undefined || ctx.listGroups().some((g) => g.name === first);
        result = isGroup ? showCommand(ctx, first, second, p.last, p.options) : showCommand(ctx, undefined, first, p.last, p.options);
        break;
      }
      case "result": {
        const args = p.positional;
        if (args.length < 2 || args.length > 3) {
          throw new UsageError("result needs [group] <id> <n>.");
        }
        const n = positiveInt("result <n>", args[args.length - 1]);
        const [group, id] = args.length === 3 ? args : [undefined, args[0]];
        result = resultCommand(ctx, group, id, n, {
          ...p.options,
          maxBytes: p.maxBytes
        });
        break;
      }
      case "search": {
        const terms = normalizeSearchTerms(p.positional);
        if (terms.length === 0)
          throw new UsageError("search needs <keyword>.");
        result = searchCommand(ctx, terms, p.group, p.options);
        break;
      }
      default:
        throw new UsageError(`Unknown command '${command}'.`);
    }
    const out = p.json ? JSON.stringify(result.data, null, 2) : result.text;
    return { stdout: out.endsWith(`
`) ? out : out + `
`, code: 0 };
  } catch (err) {
    if (err instanceof UsageError) {
      return { stdout: `${err.message}

${USAGE}
`, code: 1 };
    }
    throw err;
  }
}

// src/modules/transcripts/transcripts-main.ts
var { stdout, code } = runCli(process.argv.slice(2), process.env);
process.stdout.write(stdout);
process.exitCode = code;
