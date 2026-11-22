---
name: evaluate-proposal
description: Builder/Critic/Operator gate for a change you identified yourself (feature, refactor, research idea, external tool, bug fix) before carding it. Checks the measured gap, duplicates, prior rejections, whether an existing skill, stage or process already covers it, cheaper alternatives, fix completeness, security and a success metric. Use to decide if an idea is new or worth a card. Skip for cards the user asked for.
---

# Evaluate Proposal (v2)

Run this gate BEFORE creating any board task for a change you identified yourself. Cards the user wrote or explicitly requested are exempt. Throughput pressure is never a reason to skip it. Use the compact tier instead.

## 0. Pick the tier

| Tier | When | Form |
|---|---|---|
| **Compact** | Bug with verified evidence (reproduced, or confirmed in logs/code with file:line) and size S | One line per angle, plus pre-checks and metric |
| **Full** | Features, refactors, research applications, size M, or bugs inferred only from reading code | All checklist items |
| **Full + independent critic** | Size L, architectural or cross-repo changes, anything touching auth, credentials, billing, production infra or data migration | Full; after Builder passes, the Critic is run by a separate subagent that gets only the proposal and evidence, not your reasoning (the harness subagent tool, else the `delegate` skill at tier frontier) |

## 1. Pre-checks (all tiers — answer each with a reference)

- **Duplicate / in flight?** Search the decision backlog and log (e.g. `decisions/`), open board cards in the target project, and recent merges (`git log --oneline -30`). If it already exists, stop and link it.
- **Previously rejected?** If yes, name the new evidence that changes the verdict. Without new evidence, REJECT.
- **Files touched and conflicts:** list the files. If an open card touches the same files, set `depends_on_ids` or merge the scope.
- **Already covered?** Does an existing pipeline stage (e.g. Testing, review), skill, tool or process (check skill bodies, not just descriptions) already check this? If yes, stop and name it.
- **Cheaper alternative?** Could a setting, config or env change, a docs fix, or doing nothing solve it? If yes, prefer that and say so.

## 2. Proposal

- **What:** one sentence.
- **Why:** the gap it closes.
- **Where:** repo and files (one repo per card).
- **Evidence:** concrete references only, e.g. log lines, task IDs, metric values, `file:line`, eval scores, user statements. "Probably" is not evidence.
- **Success metric:** name, how to measure it (query, command or file), current baseline, target, and when to re-measure (e.g. 2 days after merge).

## 3. Angles — score PASS / FAIL / CONDITIONAL

Score the angles in order and stop early. If a pre-check stops the gate, or Builder is FAIL, the verdict is REJECT: write the Builder line, write `Critic: skipped (Builder FAIL)` and `Operator: skipped (Builder FAIL)`, and do not research them. Score Critic and Operator only after Builder is PASS or CONDITIONAL.

### Builder — is it worth building?
- Does it close a **measured** gap, with evidence cited above?
- Is the impact greater than the cost (coder and review runs, context, maintenance)?
- Is the success metric measurable with existing data, or does the card produce it?

### Critic — what breaks, what is wasted?
- **Strongest argument against:** write it in one or two sentences. If you cannot find one, you have not looked hard enough.
- **Confirmed cause?** For a bug tied to an incident, show from that incident's own data (affected instance or target, timestamps, status output) that this cause produced it. "The code allows this failure" is not enough. (Example: a restart race was blamed for a failed deploy, but the restart had hit a different sandbox.)
- **Complete fix?** Trace the whole path end to end. Does this change alone produce the outcome, or is another blocker downstream? (Example: removing an event gate while a stale setting still drops the event.)
- **Who sees the result?** Trace where the output ends up (a view, an alert, a log) and confirm someone actually reads it there. Make sure an error is handled as its own outcome, not counted as a "no". (Example: a stale-deploy alarm was written to the ledger but hidden by the open-items view, and a git error was reported as "not deployed".)
- **Testable as written?** For each acceptance bullet, name the test and how it reaches that code path (exported function, injected dependency, child process). A bullet no test can reach gets rewritten or dropped before carding.
- **Shared-path side effects?** If the change adds an always-on wait, gate or check to a shared path, list the existing mocks and fixtures that must change with it.
- **Siblings and numbers?** Check every sibling variant of the touched thing (labels, notice types, eval vs prod groups), that numbers the tests assert follow from the stated formula, and that the Verify commands run as written (including needed env).
- **Weakens security?** Does it widen access or weaken a security boundary (auth, sandbox isolation, network egress, secrets)? If yes, FAIL unless the user explicitly asked for it. A limit you cannot see past is often there on purpose.
- New config, state, failure modes or ongoing LLM cost? Effect on prompt caching or hot paths?
- Could it become dead code, i.e. built but never used or measured?
- Right problem, or just the most interesting one?

### Operator — can it ship safely?
- Are the required services, endpoints and permissions available inside the sandbox constraints?
- Is it testable with in-process tests using the project's own verify commands (see the project rules), with no running-API reproduction?
- Is there a rollback path (revert, flag, config)?
- Does it respect in-flight work and guardrails (owner's branches, infra the agent must not rewire)?

## 4. Decision rules

- **3× PASS** → CREATE. Put the verdict summary and success metric in the task description.
- **Any FAIL** → REJECT (a Builder FAIL ends the gate; later angles are `skipped`). Log the proposal, the failing angle and "what would change the verdict" in the decision log (e.g. `decisions/log.md`). Do not use a curated file like `observations.md`.
- **CONDITIONAL** → CREATE only if every condition is met inside the task scope (a flag, a dependency, an ordering). A condition such as "needs new infrastructure" means REJECT for now.
- **Calibration:** if more than 90% of your last 20 verdicts were CREATE, you are rubber-stamping. Raise the bar and use the independent-critic tier more often.

## 5. Output

Write to the reports folder (objective `reports/evaluate-<decision-id>.md`, or the project's `artifacts/reports/`) before acting:

```
## Proposal: <title>  (tier: compact|full|full+critic)
Pre-checks: duplicate <none|link> · prior rejection <none|id + new evidence> · files <list> · conflicts <none|depends_on ids> · cheaper alternative <none|what>
What / Why / Where / Evidence: ...
Success metric: <name> · measure: <how> · baseline <x> · target <y> · re-measure <when>
Builder: PASS|FAIL|CONDITIONAL — <rationale>
Critic: PASS|FAIL|CONDITIONAL — strongest argument against: <...>; confirmed cause: <evidence|n/a>; complete fix: <yes|no + what else>; result seen by: <where/who>
Operator: PASS|FAIL|CONDITIONAL — <rationale>
Verdict: CREATE|REJECT|CONDITIONAL — <conditions or what would change it>
```
