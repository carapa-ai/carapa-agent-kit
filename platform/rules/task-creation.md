---
trigger: always_on
description: Load task-authoring before creating or rescoping board tasks, route new cards with target_project, and use persistent stage notes for instructions that must survive retries.
---

# Task Creation

- Load the `task-authoring` skill before you create board tasks or rescope one with `update_task`.
- Route each card with `target_project`. `create_task` ignores `project_id` and creates the card in the current project.
- For stage instructions that must survive retries (artifact paths, environment setup, recurring verification requirements), use `add_task_comment` with `persistent: true` on every relevant executable stage. Use a plain comment only for guidance meant for the next run alone.
- A persistent note replaces that stage's existing note. Before updating it, read the current note and carry over every instruction that still applies.
