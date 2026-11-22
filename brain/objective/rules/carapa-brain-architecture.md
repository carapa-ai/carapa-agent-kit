---
trigger: always_on
description: Core CarapaBrain runtime - how runs are started, the objective folder, state.json, communication channels and the run handoff.
---

# CarapaBrain Architecture

## How a run starts

An event reaches the Brain (`POST /events`), is matched against this objective's triggers, and queues the objective. The processor then spawns you inside the objective folder with the triggering event, waits for you to finish, saves the state and moves to the next item.

## Objective folder

```
{GROUP_DIR}/{projectId}/objectives/{objectiveId}/
├── .agent/
│   ├── rules/          ← loaded every run: links to the shared objective template plus
│   │                     local files such as objective-context.md (title, ID, deadline)
│   ├── skills/         ← shared template skills (links) plus local skills
│   ├── prompts/        ← per-objective pipeline prompts (tune-brain-prompts skill)
│   ├── reflections/    ← pending-rules.md and session reflections (not auto-loaded)
│   └── triggers.json   ← when you wake up (objective-triggers skill)
├── .claude -> .agent
├── decisions/          ← open.md, generated from decisions.jsonl (decision-loop skill)
├── reports/            ← your timestamped assessment reports
├── assets/             ← uploaded files
├── dashboard/          ← regenerated after every run (generate-dashboard skill)
├── events.jsonl        ← append-only event log, read-only for you
└── state.json          ← current objective state
```

Links in `.agent/rules` and `.agent/skills` point to shared content you cannot edit; propose changes with the board's `propose_changes` tool.

## state.json

```json
{
  "projectId": "carapa-board",
  "status": "active",
  "progress": 45,
  "metrics": { "tasks_completed": 3, "tasks_total": 8 },
  "lastAssessedAt": "2026-03-14T10:43:21Z",
  "agentCmd": "project-default-agent",
  "agentModel": "configured-model"
}
```

- Writable: `status` (`draft | active | paused | achieved | failed`), `progress` (0-100), `metrics` (any key-value measurements), `lastAssessedAt`.
- Read-only: `projectId`, `agentCmd`, `agentModel`.
- Board starts objective-owned tasks, cron occurrences and dataset rows only while `status` is `active`.

## Communication Channels

- **Inbound:** the triggering event payload, passed by the processor.
- **To the board:** `mcp__carapa-board__*` tools only; never touch the board database.
- **To the user:** `notify_user` with `action_path` (not `send_message`).
- **To yourself:** `brain-emit` for deferred follow-up.
- **To other objectives:** `brain-emit -t objective_event`.

## Run prompt handoff

Every run prompt ends with a `## Handoff` section generated from `decisions.jsonl` (the same view as `decisions/open.md`), whatever the trigger and whether the curator ran. `open.md` is generated; never edit it by hand. Record intentions with `brain-decision action add`.
