---
name: objective-triggers
description: Read, write and adapt this objective's wake-up triggers in .agent/triggers.json - cron, task_event, objective_event and manual - including trigger context prompts, task events such as task_completed and task_question, per-trigger models, and objective_id on cronjobs and dataset tasks. Check the file with brain-triggers check. Use to change when or why the objective wakes up, tighten or remove a cron, react to task events, or route cheap runs to a smaller model.
---

# Objective Triggers

Triggers control when *you* wake up. They are different from board mechanisms: cronjobs create kanban tasks on a schedule, and scheduled tasks run chat prompts on a schedule (`scheduling` skill). When an objective needs recurring board work, prefer a cronjob owned by this objective over creating tasks by hand every run.

## triggers.json format

`triggers.json` lives at `.agent/triggers.json` inside the objective folder. You can read and modify it to adjust when you get woken up.

```json
{
  "triggers": [
    {
      "type": "cron",
      "expression": "0 9 * * 1",
      "priority": 5,
      "context": "Run the weekly objective review. Inspect state.json, recent events, and current board tasks. Update progress only from evidence, refresh the dashboard, and report blockers."
    },
    {
      "type": "task_event",
      "event": "task_completed",
      "filter": { "project_id": "carapa-board" },
      "priority": 3,
      "context": "Assess the completed task's impact on this objective. Verify its output, update objective state and dashboard when warranted, then choose the next concrete action."
    },
    {
      "type": "task_event",
      "event": "task_question",
      "priority": 2,
      "context": "Inspect why the monitored task entered Question. Resolve safe internal blockers, update task instructions when they are stale, and ask the user only for a genuinely external action."
    },
    { "type": "objective_event", "source_objective_id": "obj-xxx", "event": "progress_updated", "priority": 2 }
  ]
}
```

### Trigger prompts: use `context`

`context` is the trigger's execution prompt. It is not passive metadata. When
that trigger fires, CarapaBrain passes the string to you as the user prompt for
that run. If the curator produces a history brief, the brief is prepended and
your `context` appears under `## Trigger Prompt`.

There is no separate `prompt` field. Put trigger-specific instructions in
`context`. Write them as a self-contained imperative: say what evidence to
inspect, what decision to make, what artifacts may be updated, and what outcome
to produce. The string is literal; `${...}` placeholders are not interpolated.
For event triggers, inspect the current event and `events.jsonl` for dynamic
details such as the task ID, title, result, or error.

Use a standing rule in `.agent/rules/` for behavior that applies to every run.
Use trigger `context` for behavior that applies only to one wake-up route.
Board scheduled tasks and cronjobs are separate mechanisms; do not use them
just to attach instructions to an objective trigger.

If a recurring board cronjob creates tasks that this objective owns, call
`create_cronjob` with this objective's `objective_id`. Board persists that
ownership on the cronjob and copies it to every scheduled or manually spawned
task, allowing task lifecycle events to route back to this objective.

For dataset-backed work, call `create_dataset_task` with this objective's
`objective_id`. Board copies it to every generated row task, including rows
created after completion, resume, recovery, or restart.

Board starts objective-owned tasks, scheduled cron occurrences, and automatic
dataset rows only while the objective status is `active`. Other objective
statuses suppress new background starts without terminating work already
running. Explicit user “run now” actions remain manual overrides.

### Trigger types

| Type | When it fires | Key fields |
|------|---------------|------------|
| `cron` | On a UTC schedule | `expression` (5-field cron) |
| `task_event` | When a board event matches | `event` + optional `filter` |
| `objective_event` | When another objective emits a named event | `source_objective_id` + `event` |
| `manual` | Never; runs started from Board or chat need no trigger. A lone `manual` entry only marks an objective that runs on request | — |

All trigger types support `context`, plus optional `agent_cmd`, `agent_model`,
`skip_eval`, and `disabled`.

Use `agent_model` to route cheap runs (e.g. verify-and-log on `task_completed`)
to a smaller model and analysis runs to a stronger one. Model IDs are
harness-specific: when the objective's runtime harness changes, update or remove
every `agent_model` in `triggers.json` in the same change.

Available task events include `task_completed`, `task_failed`,
`task_question`, `objective_message`, `objective_created`,
`objective_updated`, `webhook_received`, and `self_reminder`. Do not add a
`self_reminder` trigger: `brain-emit` reminders reach this objective without
one and take their priority from `brain-emit -p`.

`task_question` is emitted only when an objective-owned task transitions into
Question. It is routed using the task's persisted `objective_id`; untagged
tasks are dropped and repeated same-stage updates are suppressed. The payload
includes a `source` describing whether the transition came from an agent,
manual/bulk UI move, review no-progress pause, or merge conflict, plus an
optional redacted `reason`.

### Modifying your triggers

Edit `.agent/triggers.json` directly, then run `brain-triggers check` from the
objective folder. It reads the file the way CarapaBrain does and lists each
trigger with its next cron runs. Fix every `error` line: CarapaBrain silently
skips an invalid entry, or the whole file if it is not valid JSON. `warn` lines
name entries that do nothing or behave unexpectedly, such as a cron that repeats
less than once a year, which CarapaBrain deletes after it fires.

CarapaBrain reloads the file after every run of this objective, and the cron
schedule is re-read every minute, so your edit applies from the next wake-up.
No restart or `brain-emit` is needed.

### Adapting triggers over time

Your triggers should evolve with the objective:
- **Active autonomous work** → combine objective-owned tasks, relevant
  `task_completed`/`task_failed`/`task_question` triggers, and a focused cron
  whose `context` names the evidence to inspect and the next decision to make.
  Task events provide fast reaction; the cron is a liveness backstop for missed,
  delayed, or non-task events.
- **Fast-moving work** → tighten the focused cron and keep relevant task-event triggers
- **Steady long-term goal** → weekly cron is enough
- **Genuinely blocked on an external event** → remove cron and rely on the
  matching event trigger so repeated runs cannot make busywork
- **Achieved or failed** → remove all cron triggers; keep only a `manual` entry to mark it as run-on-request
