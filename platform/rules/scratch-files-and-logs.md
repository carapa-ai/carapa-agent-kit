---
trigger: always_on
description: Where to put logs, scratch scripts, PID files and deliverables so the group checkout stays clean.
---

# Logs and Scratch Files

The group working directory (`<GROUP_DIR>`, normally `/workspace/group`) sits inside a git repository. Do not write logs, PID files, or temporary scripts at its root or in new ad hoc directories there (`tmp-*/`, `val/`, `validation*/`, `.validation/`).

- Write command and validation output that must survive the run to `<GROUP_DIR>/logs/`, named after the task or topic (e.g. `logs/<task-slug>-verify-changed.log`).
- Put throwaway scripts, Playwright `run-code` snippets, request bodies, and PID files under `/tmp/` or a gitignored directory of the worktree (e.g. `.playwright-cli/`). If they must persist across runs, use `<GROUP_DIR>/tmp/<task-slug>/`.
- Delete your scratch files and directories when the task no longer needs them.
- Deliverables for the user go to `<GROUP_DIR>/artifacts/<topic>/` instead (see the chat-artifacts rule).
