---
name: assess-progress
description: Structured progress assessment of this objective. Reads state.json, events since the last assessment and the last report, judges against the objective's criteria, updates progress and metrics, writes a report, creates corrective tasks tagged with objective_id, and notifies the user when achieved. Use for cron check-ins, assess or status-check requests, or updating progress.
---

# Assess Progress

Run a complete assessment of this objective's current progress. Follow these steps in order.

## 1. Read current state

Read `state.json` to get the current `status`, `progress`, and `metrics`. This is your baseline — you're looking for what has changed since the last assessment.

## 2. Review recent events

Read the last 50 lines of `events.jsonl`. Look for:
- Task completions or failures (the most direct evidence of progress)
- User messages (objective_message events) — these often carry context or corrections
- Previous assessment completions
- Any cross-objective events

Focus on events since `lastAssessedAt` in `state.json`. Events before that were already factored into the previous assessment.

## 3. Check the most recent report

List `reports/` and read the most recent `.md` file. Understand what conclusions the last assessment reached and what actions were taken. This prevents you from repeating the same analysis or creating duplicate tasks.

## 4. Review SMART criteria

Read `.agent/rules/objective-context.md` (also accessible as `.claude/rules/objective-context.md`). This defines what the objective is, what success looks like, and any deadline. Keep these criteria front of mind as you evaluate.

## 5. Evaluate progress

Assess whether the objective is on track, behind, blocked, or achieved. Ground every conclusion in specific evidence from the event log and task outcomes — avoid speculation. Ask yourself:

- What measurable progress has been made since the last assessment?
- Are there blockers preventing forward motion?
- Is the pace consistent with reaching the goal by the deadline?
- Have any SMART criteria been fully met?

## 6. Update state.json

Write the updated state back to `state.json`. Only modify these fields:

```json
{
  "status": "active",         // active | paused | achieved | failed
  "progress": 55,             // 0–100, based on evidence
  "metrics": {                // update any measurements you tracked
    "tasks_completed": 5,
    "tasks_total": 9
  },
  "lastAssessedAt": "2026-03-14T10:43:21Z"  // current UTC time
}
```

Never modify `projectId`, `agentCmd`, or `agentModel`.

## 7. Write assessment report

Create a new file in `reports/` with an ISO timestamp filename (replace colons with hyphens):

**Filename:** `reports/2026-03-14T10-43-21Z.md`

**Report structure:**
```markdown
# Assessment — 2026-03-14T10:43:21Z

**Status:** active
**Progress:** 55%
**Summary:** One-sentence headline describing the key finding

## Narrative

Detailed analysis with specific evidence. Reference event timestamps, task IDs,
metric values. Explain the reasoning behind the progress estimate.

## Metrics

| Metric | Value |
|--------|-------|
| tasks_completed | 5 |
| tasks_total | 9 |

## Task Actions

- Created task "Fix failing auth tests" (priority 2)
- Closed task "Set up CI pipeline" (already completed)
```

## 8. Dashboard (automatic)

**Do NOT write to `dashboard/index.html` directly.** The dashboard is regenerated automatically by `processor.ts` after your run completes, using `.agent/scripts/gen-dashboard.ts`.

If you need to customize the dashboard layout, edit `.agent/scripts/gen-dashboard.ts` instead — see the `generate-dashboard` skill for details.

You may call `mcp__carapa-board__refresh_dashboard` after updating state if you want the UI to reload sooner, but the processor will also trigger a refresh automatically.

## 9. Take corrective action if behind or blocked

If the objective is behind schedule or blocked:

1. Call `mcp__carapa-board__list_tasks` for this objective's project to see current open tasks — avoid creating duplicates.
2. For each gap in progress, create a focused corrective task via `mcp__carapa-board__create_task` and pass this objective's ID as `objective_id` so its outcome routes back here.
3. Set priority based on urgency (1 = critical, 3 = normal, 5 = background).

Only create tasks that directly address the identified gap. Don't batch unrelated work.

## 10. Notify user if achieved

If `status` is now `achieved`, notify the user via `mcp__carapa-board__notify_user`:

```
mcp__carapa-board__notify_user({
  "kind": "text",
  "summary": "Objective achieved: [Title]",
  "content": "[Title] has reached 100% — [one sentence summary of what was accomplished].",
  "action_path": "/objective/<project-id>/<objective-id>"
})
```

Always pass `action_path` (IDs from `objective-context.md`); without it the notification has no Open or Reply.

## Autonomous work (cron or idle runs)

Things you can do on cron/idle triggers without user input:

### Self-improvement
- **Curate memories** — recall all, prune outdated, consolidate duplicates
- **Revise system prompt** — optimize rule files for clarity and token efficiency
- **Find bugs** in relevant project code — create board tasks for fixes
- **Add features/improvements** — create board tasks via pipeline
- **Reflect on purpose** — am I actually making progress on the objective, or just doing busywork?

### Skill development
- **Search the internet** with the board `web_search` and `web_view` tools for new techniques, patterns, best practices
- **Learn/create skills** — add new `.agent/skills/` workflows; ask user to download if site access needed
- **Image generation** — with the board `generate_image` tool, e.g. for dashboard visuals

### Rules
- Don't try to do everything in one run — use `brain-emit` to chain work across runs
- Token budget is generous — don't be lazy, do real work
- Always verify actual impact — check evals, not just task completion
- Maintain liveness while autonomous work remains possible: objective-tag tasks
  whose outcomes matter, subscribe to their relevant events, and retain a
  focused cron as a backstop. Remove the cron when the objective is terminal,
  paused, or genuinely waiting for an external event.
- When evidence changes, update the authoritative state and current report at
  the source; do not leave superseded blockers for later runs to rediscover.
- A "can't see or verify X" is a gap to close: add a backlog item or card for the
  tool, endpoint, or log field that would make X visible. Exception: when X is
  hidden by a security boundary (auth, sandbox isolation, network egress), the
  limit is intentional; never propose weakening it.

### Ask yourself every run
- What did I learn since last time, and did my rules and memory absorb it?
- Which of my rules is obsolete or contradicts how things work today? Fix it now.
- What am I doing by hand that should be code, a skill, or a trigger?
