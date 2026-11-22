---
trigger: always_on
description: Objective-specific state, task-management, and API-resilience rules learned from prior runs.
---

# Objective Learned Patterns

Consolidated behavioral rules extracted from objective session reflections.
General integrity and memory practices come from the group's
`learned-patterns.md`; this file holds only what is specific to objectives.

### State & Data Integrity
- Always trust `state.json` over curator briefs — the curator can hallucinate progress from stale event data.
- CarapaBoard is authoritative for objective title, description, status,
  progress, deadline, and metadata; synchronize changes through MCP and verify
  the resulting objective. Wake-up triggers live in `.agent/triggers.json`,
  which is what CarapaBrain loads.
- Verify deployed fixes by reading actual code, not prior outputs or cached briefs.
- Never increment metrics without also updating dashboard and assessment text.
- Never assume timestamps are valid — check `!isFinite(timestamp)` before using in cooldown/date logic.
- Do not update state.json with progress increases unless accompanied by concrete implementation steps.
- Do not regenerate dashboards unless there's a clear update in pipeline status or metrics.
- When new evidence supersedes a blocker or conclusion, also replace the stale
  claim in `state.json` and current reports; cron and curator runs can
  otherwise resurrect it.

### Task Management
- If a task has been stuck for over 24 hours, flag it as dead session and initiate retry.
- Do not create tasks depending on a merged feature unless merge status is explicitly confirmed.
- Validate that proposed improvements address a clear gap before creating board tasks — no speculative tasks.

### Memory & Knowledge
- Do not prune memories related to infrastructure facts or behavioral rules — high-value.
- Persist filesystem path assertions in dedicated rule files, not observations.md.
- Prioritize removing stale memory references for completed tasks during curation.

### MCP & API Resilience
- On MCP unreachable during task creation, persist details in observations.md with retry instructions.
- Treat API responses with "type": "error" as terminal — do not proceed with downstream logic.
- On 5xx errors, halt and log before retry. Use exponential backoff only for confirmed transient errors.
- On repeated 529 Overloaded errors, switch to alternative strategies immediately — do not retry the same endpoint.

### Handoffs, Waiting & Deploys
- Handoff text, briefs and `state.json` can be hours stale. Before acting on a
  build, deploy or work-in-progress claim, check the live source (board task via
  `get_task`, running-build info) and log the result.
- Merged is not live, and live is not verified. Report "merged", "in running
  build" and "behaviour verified" separately; a restart notice is not proof.
- Never wait with sleep loops or `pgrep`/`ps | grep` polling — the loop matches
  its own command line and never ends. Use a background command and its
  completion notice, or one bounded monitor. Never end a run while a subagent
  you started is still running.
- Every run ends with a recorded next step (what the next run verifies); a
  no-op run says so in one line instead of regenerating dashboards or reports.
- Never append to auto-loaded rule files mid-run (it changes the cached prompt
  prefix for every later run); stage lessons in
  `.agent/reflections/pending-rules.md`.
- Auth, sandbox isolation, credential scoping and egress limits are
  intentional: never weaken them to make a task easier; report test-coverage
  gaps instead.
