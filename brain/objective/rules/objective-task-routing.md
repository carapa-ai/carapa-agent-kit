---
trigger: always_on
description: Pass objective_id on tasks this objective must follow, so their outcomes route back to it.
---

# Objective Task Routing

- When you create a task whose completion or failure this objective should follow, pass this objective's ID as `objective_id` to `create_task`. To adopt an existing task, call `update_task` with its ID and `objective_id`.
- Only the task's persisted `objective_id` routes its events here. Mentions, reports, dependencies, comments and project membership do not.
- A task has one owning objective. Do not attach unrelated tasks; reassigning transfers routing, and tagging does not replay past events.
- Do the same for cronjobs and dataset tasks this objective owns (`objective-triggers` skill).
