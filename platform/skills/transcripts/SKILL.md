---
name: transcripts
description: Browse, search and summarize board agent transcripts (chat and task logs, incl. archived) across group projects. Use whenever asked what happened, what an agent did, recent activity, why a task failed, to open a task or conversation ID, search past conversations, or read a tool call's full output. Not for raw Claude/Codex/Gemini/Cursor CLI histories.
---

# Transcripts

Use the bundled script at `~/.agent/skills/transcripts/scripts/transcripts.mjs` to read and format JSONL transcript data from registered group projects. It is a self-contained bundle: run it with `bun` (or `node`); there is nothing to install.

Transcripts are normally available in the workspace-wide directory `/workspace/group/transcripts/`. The script uses that shared directory automatically and also supports the older nested layout `/workspace/group/{project}/transcripts/`. The files contain conversation logs between users and AI agents working in chat or on kanban tasks. Task transcripts (`*.jsonl`), chat transcripts (`*.output.jsonl`) and older provider output are all read together; tool calls are hidden unless requested. Transcripts the board has archived (`transcripts/archive/*.tar.gz`) are read in memory, never extracted.

## Commands

Replace `{project}` with the actual project or group name; do not include the braces. In the shared layout, use `shared` unless `TRANSCRIPTS_PROJECT` identifies the mounted project. Other project names require their own nested transcript directory; the script never relabels the current mount as another project.

```bash
# Open a transcript by its full or partial task or conversation ID, in whichever project has it
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs show {task_or_conv_id}

# Summarize all projects: transcript counts, latest activity, and agents used
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs summary

# Summarize one project
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs summary --group {project}

# List transcripts for one project, including dates, message counts, and task titles
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs list {project}

# Show the five most recent messages in the latest transcript for one project
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs show {project} --last 5

# Show a transcript selected by a full or partial task ID or conversation ID (task-..., conv-...)
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs show {project} {task_or_conv_id}

# Show the latest transcript without truncating messages
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs show {project} --full

# Read tool call #7 of a transcript (numbers come from `show --tools`) with its complete input and output
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs result {task_or_conv_id} 7 --max-bytes 20000

# Search all projects
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs search "{keyword}"

# Search one project
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs search "{keyword}" --group {project}

# Search all projects and return full matching messages
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs search "{keyword}" --full

# Only recent user messages, including older archived transcripts, as JSON
bun ~/.agent/skills/transcripts/scripts/transcripts.mjs search "{keyword}" --since 2026-09-01 --role user --archive --json
```

## Options

Options work on every command.

- `--since YYYY-MM-DD`: only transcripts active on or after the date, and messages dated on or after it. Archives are read automatically when the date reaches before the oldest live transcript.
- `--role user|assistant`: only messages from that role.
- `--tools`: include tool calls as `TOOL #n name: input → size` lines (`→ failed: reason` for failures). By default `show` replaces each run of tool calls with a `[N tool calls; --tools shows them]` line (`hiddenToolCalls` in `--json`). Tool inputs are cut to 160 characters unless `--full` is given, which prints the complete input as JSON. Outputs are never listed; read one with `result`.
- `--max-bytes N`: `result` prints at most the first N bytes of the output and says when it cut it.
- `--archive`: also read `archive/*.tar.gz` (slower; archives are decompressed in memory). Without it, `show` reports when an ID may be in an archive.
- `--json`: machine-readable output instead of text. Message content is truncated like the text output unless `--full` is given.
- `--limit N`: `search` shows at most N matches (default 50) and always prints the total; `list` shows the newest N transcripts.
- Environment overrides: `TRANSCRIPTS_GROUP_ROOT` (default `/workspace/group`), `TRANSCRIPTS_DIR` (shared directory), `TRANSCRIPTS_PROJECT` (name of the shared project, default `shared`).

## Workflow

- When the user gives a task or conversation ID, run `show {task_or_conv_id}` directly; no project name, search, or file lookup is needed.
- A board run ID (`run-<13 digits>-<6 chars>`, from Run History) works the same way: `show {run_id}` opens its task transcript limited to that run. `result` numbers tool calls across the whole transcript. Run IDs resolve only for task runs.
- For a broad status or recent-activity request, run `summary`.
- For a project-specific status request, run `summary --group {project}`; use `list {project}` when more detail is needed.
- To explain what happened in a project, run `list {project}` to identify the relevant transcript, then `show {project} {task_or_conv_id}`.
- To find a topic, error, person, agent, or artifact, run `search "{keyword}"`, optionally scoped with `--group {project}`; add `--since` to keep it fast and relevant.
- To see what a tool call returned, run `show {task_or_conv_id} --tools` (or `search "{keyword}" --tools`, which numbers its tool hits the same way), pick the call number, then `result {task_or_conv_id} {n}`. The listing shows each output's size; pass `--max-bytes` for large ones instead of loading them whole. A task's tool calls are logged in its `{id}.output` transcript; `show` and `result` point there when given the task's message log.
- Use `--full` only when complete message content is necessary; default output truncates long messages to roughly 200 characters. `show` never truncates the final agent reply, which usually holds the outcome. With `--full`, nothing is truncated, including tool inputs.
- Summarize findings in your own words rather than dumping raw output. Include project names, task IDs, and timestamps when they help the user verify the result.

Task and conversation IDs support partial matching. Use `--last N` to inspect only the end of a conversation.
