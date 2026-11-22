---
name: decision-loop
description: Record and query your own changes in the decision ledger (decisions.jsonl) via the brain-decision CLI. Add with a success metric, mark tasked/merged/live/verified, reject with a reopen condition, show a decision's state, add or close user actions, regenerate open.md, lint. Use whenever you propose, card, merge or deploy your own change or need a visible ask for the user.
---

# Decision Loop

The ledger is `decisions.jsonl`. `decisions/open.md` is a generated view of it. For how the view reaches your run prompt, see the "Run prompt handoff" section of `.agent/rules/carapa-brain-architecture.md`.

## Rules

- Write only through `brain-decision`. Never `echo` into the jsonl; hand-written lines (e.g. an unknown kind such as `add`) are silently ignored.
- Never hand-edit `decisions/open.md`; edits are overwritten. Regenerate with `brain-decision open --write`.

## Query the ledger

Never fold `decisions.jsonl` by hand (the path is `<objective>/decisions.jsonl`, not `decisions/decisions.jsonl`); the CLI folds updates, drops unknown kinds and applies the verdict/reject rules for you.

```bash
brain-decision show D-1 D-2              # folded state of one or more decisions
brain-decision list --status merged --project carapa-board
```

`show` prints the status, tasks, merge, live, verified, verdict and metric of each id; `list` prints the decisions matching `--status` / `--project` (add `--json` for machine-readable output). Action records (`A-*`) are not decisions and never show up here.

## Record an ask or intention for the user

Make it a visible action:

```bash
brain-decision action add "<context>" --waiting-on user --ask "<one imperative step for the user>" --due <ISO> --task <task-id> --decision <D-id>
brain-decision action done <A-id>
brain-decision action drop <A-id>
```

`--ask` is required with `--waiting-on user` and is the one thing the user has to do; put your own follow-up in a separate non-user action.

Close every action once it is resolved or no longer relevant.

## Decision lifecycle

Merged is not live, and live is not measured. Advance one step at a time:

1. Evaluate first: for a change you identified yourself, run the shared `evaluate-proposal` skill (by name, do not copy it) before creating a task. Log rejections with `--status rejected --rationale "<failing angle; reopen condition>"`. When the reopen condition is a literal log line, prefer `brain-decision reject <id> --reason R --reopen C --watch-file <log path> --watch-text "<literal msg>"`: open.md "Reopen watches" then flags it automatically, so no run re-checks by hand. Before re-evaluating a rejected idea, read open.md "Reopen watches" and "Recently rejected".
2. `brain-decision add <id> --project <P> --title "<T>" --hypothesis "<H>" --metric-name "<N>" --baseline "<B>" --target "<X>" --status accepted`
   Define the success metric (name, baseline, target) now, not later.
3. `brain-decision update <id> --status tasked --task <task-id>`, then after the merge `brain-decision update <id> --status merged --merged-at <ISO> --merge-commit <SHA>`. `--task` appends; use `--replace-tasks` only to correct a wrong ID.
   For a non-code change (prompt, KPI, config) use `brain-decision update <id> --status applied` instead: it is live immediately. Valid statuses: candidate, accepted, rejected, tasked, merged, applied, kept, iterate, reverted, superseded; unknown values raise a ledger anomaly.
4. `brain-decision live <id>` only when the change is actually deployed. Never bulk-stamp with `live --project <P> --merged-before <ISO>` unless you verified every matching decision is deployed.
5. After it is live, exercise the change yourself (trigger the path, read the output/log) and record it with `brain-decision verified <id> --note "<what you exercised and saw>"`.
   Record `brain-decision verdict <id> iterate|reverted --measured … --note …` only when that check shows it did not work. Outcome KPIs are reviewed in aggregate weekly; there is no scheduled per-decision re-measure.

## IDs

- Re-read the highest existing id right before `add` to avoid collisions, or let the CLI choose: `brain-decision add --auto-id D --project <P> ...` (the CLI adds the `-` itself, giving D-6 after D-5; never pass `D-`).

## End of run

If the run wrote to the ledger, run `brain-decision lint` and fix every anomaly it reports (unknown kinds, id collisions) through the CLI.
