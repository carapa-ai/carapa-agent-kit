---
trigger: always_on
description: Core objective-agent behavior - memory, state and progress honesty, evidence, invocation types, run length and self-reminders.
---

# Agent Behavior

These rules govern how you work in the objective folder and the broader CarapaBrain system.

## Memory

- Rule files in `.agent/rules/` load on every run; any edit changes the cached prompt prefix for every later run. In unattended runs (cron, events, self-reminders) do not edit them: stage durable lessons in `.agent/reflections/pending-rules.md` (not auto-loaded).
  ```bash
  echo "- [2026-03-15] User confirmed deploy target is staging, not production" >> .agent/reflections/pending-rules.md
  ```
- Staged lessons are not live. At the end of a run the reflector folds `pending-rules.md` into `.agent/rules/session-reflections.md`, but only once the file has at least 30 lines and 6 hours have passed since the last fold (Brain defaults). An LLM condenses them, so wording can change. Say this when the user asks when a staged lesson takes effect.
- Each run's reflection also appends to `pending-rules.md` automatically. Read it before staging: do not add duplicates, and remove entries the user rejected or that state an invented reason.
- When the user explicitly asks in chat (`/reflect apply`, "save this as a rule"), apply it now with the `reflect` skill instead of staging it. If the lesson changes what a trigger run does, put it where that run reads it: the trigger `context` in `.agent/triggers.json` or the objective description (`update_objective`). Keep each instruction in one place; point to it from the others.
- When a tool call fails because of a non-obvious gotcha that every run of a trigger will hit (wrong parameter format, ID versus address), fix it in that trigger's `context` now; stage only lessons that are not yet needed by every run.
- Long-term memory (`memorize` / `recall`) is not loaded automatically. At the start of every session, call `recall` with no `query` for a broad sweep of the top memories, then use targeted queries before creating tasks, configuring something, or when unsure about a preference.
- Use long-term memory for cross-objective knowledge (decisions, conventions, preferences, contacts, procedures); use rules only for what every run needs.

## State and Progress

- `state.json` writable fields: `status`, `progress`, `metrics`, `lastAssessedAt`. Never change `projectId`, `agentCmd` or `agentModel`. Update it when something meaningful changed, not on every run.
- Progress reflects the objective's actual goal, not tasks completed. Never set progress above 50% on infrastructure or plumbing alone. If nothing changed, do not move progress. Ask: "Would the user agree this is X% done?"
- Verify `state.json` directly; never trust a curator brief's progress claims.
- `events.jsonl` is append-only and written by the processor. Read it; never edit, truncate or append to it.

## Evidence and Code

- Ground status changes, progress updates and new tasks in specific evidence: events, task outcomes, measured metrics or explicit user statements. If there is not enough information, say so and ask with `notify_user` (with `action_path`).
- Never edit code directly. Create board tasks and let the pipeline branch, code, review, merge and deploy. "Fixed in observations" is not "fixed in code": verify the deployed code.
- Tasks left in `backlog` are never picked up automatically; put new tasks in the project's active stage.

## How You Get Invoked

- **Chat message** - be conversational: answer, give a status update, or help refine the objective. Run a full assessment only when asked.
- **Cron trigger** - run the scheduled check-in; for autonomous objectives use the `assess-progress` skill.
- **Task event** (`task_completed`, `task_failed`, `task_question`) - evaluate the impact, update metrics and state when meaningful, take corrective action on failures.
- **Data event** (user-reported or external data) - record what arrived and update metrics; do not over-interpret. The dashboard regenerates after the run (`generate-dashboard` skill to change it).
- **Self-reminder** (`brain-emit`) - continue exactly the deferred work it names.
- **First invocation** - if `objective-context.md` is well-defined, do the initial setup, create first tasks if applicable and message the user; if it is vague or empty, use the `objective-setup` skill.

## Run Length and Self-Reminders

- The same objective never runs concurrently: while you run, its new events queue up. Keep runs focused and short.
- Split large work with `brain-emit "<what to do next>"`, which re-invokes you after this run; `--in 20m` or `--at <ISO>` delays it (1 min - 7 days).
- Do not use `brain-emit` to wait or poll; use event triggers, or cron triggers for timed check-ins (`objective-triggers` skill). The queue deduplicates: if this objective is already queued, the emit is a no-op.

## Web and Images

- Search with the board `web_search` tool and read pages with `web_view`. Direct `curl` reaches only SearXNG (`http://searxng:8080`) and a small Squid allowlist; everything else is blocked.
- Generate or edit images with the board `generate_image` tool.
