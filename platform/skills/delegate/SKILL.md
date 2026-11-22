---
name: delegate
description: Run a one-shot subagent on any harness (Claude, Codex, pi, others) through the CarapaBox runtime, with the model picked by tier (fast, balanced, frontier) from the board. Use when a skill or rule says to spawn a subagent, independent reviewer, critic, grader or parallel reader and this harness has no subagent tool, or when the subagent must run on another harness or tier.
---

# Delegate

`carapa-delegate` (on PATH: `/usr/local/ai-cli-bin/carapa-delegate`, next to `run-agent.sh`) starts one child agent run and waits for it. It works the same under every harness because it uses the sandbox runtime (`/usr/local/ai-cli-bin/run-agent.sh`) and the board's tier mapping, not a harness feature.

## When to use it

1. The harness has its own subagent tool (Claude Code: the Agent/Task tool): use that, it is faster and shares context handling. Map tiers to its models (Claude: fast = haiku, balanced = sonnet, frontier = opus).
2. No subagent tool (pi, some ACP harnesses), or the subagent must run on a different harness or tier: use this script.
3. Neither works (`carapa-delegate` missing on an older sandbox image, board unreachable): do the work inline and say that the independent step did not run. Never present an inline pass as an independent review.

## Usage

```bash
carapa-delegate --tier frontier --prompt-file review-prompt.md --out review.md
echo "Summarize the failing test in logs/x.log in 5 lines" | carapa-delegate --tier fast --prompt-file -
```

- stdout (or `--out FILE`): the child's final answer. stderr: one JSON line with `harness`, `model`, `steps`, `toolCalls`, `costUsd`, `durationMs`, `exitCode`, `runDir`.
- Exit codes: child's exit code; 2 usage or tier resolution error; 3 privacy refusal (the project may not use that runtime: do not work around it); 124 timeout (the child is stopped).
- Options: `--timeout SEC` (default 900), `--cwd DIR` (default: a fresh temp dir outside `/workspace`, so the child does not load the parent's project or objective CLAUDE.md, AGENTS.md or `.agent` rules, which harnesses read upward from their cwd; platform and group rules from the agent home still load), `--reasoning LEVEL`, `--keep` (keep the run dir after success), `--project P`, `--objective O` / `--no-objective`, `--harness H` (tiers from that harness's map; default: the parent run's harness).
- Test override without tier lookup: `--agent-cmd pi --model llama-proxy/qwen3.8`.

## How the tier is resolved

Scope, first match wins: flags, `DELEGATE_PROJECT` / `DELEGATE_OBJECTIVE`, the parent run's `args.json` (session `active_run` pointer, else `CARAPA_AGENT_RUN_ID`), the nearest `obj-*` objective folder above the current directory. With an objective it calls `GET /api/projects/P/objectives/O/runtime-tiers` (the objective's event harness); otherwise `GET /api/projects/P/runtime-tiers?harness=H`. The board applies project and objective runtime settings and privacy mode, and returns the full launch contract (harness, model, reasoning, env).

## Writing the child prompt

- The child starts with no conversation context. Put the task, the evidence (or exact file paths) and the expected return format in the prompt, and ask for a compact answer (a word limit or JSON).
- For independent review, give the code and the claim to check, not your conclusion.
- Tell it what not to do: no file edits unless intended, no background commands, no waiting loops.
- Board tools in the child depend on the harness: a Claude child inherits the board MCP server, a pi child has none. Do not rely on board tools in the child; embed what it needs.
- Never put secrets or tokens in the prompt file. The child inherits the parent's environment (including its board token), so it has the same access as you; delegate only work you could do yourself.

## Costs and limits

- The child spends quota on the provider its tier resolves to; frontier runs cost about as much as a normal frontier turn.
- One child per call, run synchronously. For parallel readers, run them in one foreground shell command and wait in the same command, e.g. `( carapa-delegate --tier fast --prompt-file a.md --out a.out & carapa-delegate --tier fast --prompt-file b.md --out b.out & wait )`. Some harnesses (pi) have no background shell, so never leave children running after the command returns.
- Run dirs go to `$DELEGATE_RUN_ROOT`, else `/workspace/group/tmp/delegate`, else `${TMPDIR:-/tmp}/delegate`. They are deleted after success unless `--keep`, and kept on failure for inspection (`agent-stderr.log`, `output.v1.jsonl`, `metrics.json`). Delete kept dirs when done.
