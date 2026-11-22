---
trigger: always_on
description: Identifies the group invocation scope and its instruction boundaries.
---

# Instruction scope: group

- This rule applies when an agent harness is invoked from the group directory
  (`<GROUP_DIR>`, normally `/workspace/group`).
- The harness automatically loads its shared home instructions plus this group
  scope. Objective and repository rules are not automatically loaded; inspect
  them before work that concerns those scopes.
- Use this scope for group-level chats, coordination, and fallback behavior.
- `.agent/prompts/` contains group prompt templates. Kanban stage prompts such
  as `stage-testing.md` and `stage-review.md` may also be injected explicitly by
  the board; they are not evidence that objective or repository rules loaded.
- Keep project-specific guidance in that project's repository `.agent` scope
  and objective-specific guidance in that objective's `.agent` scope.
- `~/.agent` is shared across projects and read-only; change shared rules and
  skills only through `propose_changes`. Group-local rules and prompts may be
  edited when the requested change belongs to this group.
