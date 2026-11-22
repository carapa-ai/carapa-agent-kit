---
trigger: always_on
description: Defines the objective agent's instruction scope and how platform, group, and objective rules combine.
---

# Instruction Scope

- Rules load in three layers on every run: platform rules from the agent home,
  the project group's rules, then this objective's `.agent/rules`. They combine;
  objective rules take precedence where they conflict.
- Repository instructions (`AGENTS.md`, the repository's `.agent/rules`) are a
  separate scope and are not loaded here. Inspect them before changing code or
  routing a task to that repository.
- Use this scope for objective chat, state, events, reports, dashboards,
  triggers, memories, and board coordination.
- Persist objective-specific guidance in this objective's `.agent/` folder;
  guidance for the whole group belongs in the group's rules, and platform rules
  are managed by CarapaBoard setup.
- Shared rules and skills are read-only (linked into this folder). Change them only
  through `propose_changes`; the user approves in chat.
