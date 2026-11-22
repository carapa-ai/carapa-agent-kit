---
name: objective-setup
description: Define or rework an objective with the user. Pick a format (goal plus deadline, SMART, OKR, free-form), save title, description and deadline via update_objective, seed state.json, propose triggers.json with context prompts, and hand off to a first assessment. Use to set a goal, change an objective's description or deadline, or configure its triggers.
---

# Objective Setup

Guide the user through defining their objective. The goal is to capture enough context for meaningful future assessments — not to force them through a rigid framework.

## Step 1: Understand their intent

Start with a single open question:

> "What are you trying to achieve with this objective?"

Let the user respond freely. From their answer, you'll know how much structure they want. Listen for:
- Vague aspiration → they probably want lightweight or simple format
- Specific outcome with metrics → SMART may be natural
- KR-style list → suggest OKR format
- Deadline-driven delivery → simple goal + deadline works

## Step 2: Offer format options (only if unclear)

If the user's answer doesn't make the format obvious, offer:

> "How much detail would you like to track?"
> - **Simple** — just a goal and a deadline
> - **SMART** — full breakdown: Specific, Measurable, Achievable, Relevant, Time-bound
> - **OKR-style** — Objective + 2–3 key results with targets
> - **Lightweight** — free-form description, no fixed structure

Pick the format that matches their answer — don't ask if it's already clear.

## Step 3: Gather the details

Ask only what you need for the chosen format. Keep it conversational — one or two questions at a time, not a form.

### Simple format
- What exactly needs to be done or achieved? (one sentence)
- What's the deadline?
- How will you know it's done? (optional success signal)

### SMART format
Use the `smart-objective` skill for this. It walks through each criterion with examples and a completeness checklist.

### OKR format
- What is the high-level objective? (qualitative, inspiring)
- What are 2–3 key results? (each with a measurable target and deadline)

### Lightweight format
- Describe the goal in your own words
- Any deadline or time constraint?
- Anything you'd want to check periodically?

## Step 4: Save the objective on CarapaBoard

CarapaBoard is authoritative for the objective definition. It regenerates
`.agent/rules/objective-context.md` (accessible as `.claude/rules/objective-context.md`)
whenever the objective changes, so never write that file yourself — local edits
are overwritten.

Read the Project ID and Objective ID from `objective-context.md`, then call
`mcp__carapa-board__update_objective` with:
- `group_folder`: the Project ID
- `objective_id`: the Objective ID
- `title`: the objective title
- `description`: the chosen format's content as Markdown — goal, success
  criteria or key results, and any context the user mentioned (team, project,
  constraints)
- `deadline`: ISO 8601 date, when the user gave one
- `metadata`: optional JSON string for structured fields (e.g. `{"format":"okr"}`)
- `status`: `active`

Verify with `mcp__carapa-board__get_objective`, then re-read
`objective-context.md` before relying on it.

**Example description — simple format:**
```markdown
**Goal:** Complete Stripe payment flow end-to-end — card entry, charge, confirmation email.

**Done when:** Users can complete a purchase without errors in staging and production.
```
(title: `Ship the payments integration`, deadline: `2026-04-30`)

**Example description — OKR format:**
```markdown
**Objective:** Make the product irresistible to new users in Q2.

**Key Results:**
- Activation rate (completes first action within 24h) reaches 60% by 2026-06-30
- Trial-to-paid conversion reaches 18% by 2026-06-30
- Support ticket volume drops below 50/week by 2026-05-31
```
(title: `Q2 Growth`, deadline: `2026-06-30`)

## Step 5: Seed state.json

If `state.json` doesn't already have meaningful values, update it with:
```json
{
  "status": "active",
  "progress": 0,
  "metrics": {},
  "lastAssessedAt": null
}
```
Do not overwrite `projectId`, `agentCmd`, or `agentModel` — those are set at initialization.

## Step 6: Configure triggers

Triggers live only in `.agent/triggers.json` — CarapaBrain loads that file and ignores the board objective's `trigger_config`. The `objective-triggers` skill has the full format. Read it if it exists. If it's empty or missing triggers, propose a sensible default based on the objective type:

- **Weekly review** for long-running goals: `{ "type": "cron", "expression": "0 9 * * 1", "priority": 5, "context": "Run the weekly objective review. Inspect recent evidence and board state, update progress and dashboard only when warranted, and report blockers and next actions." }`
- **Task-event driven** for delivery objectives: `{ "type": "task_event", "event": "task_completed", "priority": 3, "context": "Assess the completed task's impact on this objective. Verify the output, update objective artifacts when warranted, and choose the next concrete action." }`
- **Manual only** if the user prefers to trigger assessments themselves: `{ "type": "manual", "priority": 1 }`

Treat `context` as the per-trigger execution prompt. Add it whenever a wake-up
route should do more than the generic fallback assessment. Keep it actionable
and self-contained. Do not invent a `prompt` field; the supported field is
`context`, and its value is delivered to the agent when that trigger fires.

Ask the user if the proposed trigger schedule looks right before writing. After writing, run `brain-triggers check` and fix any `error` line.

## Step 7: Confirm and hand off to initial assessment

Send a brief confirmation. If the user set the objective up in chat, say it in your reply; otherwise use `mcp__carapa-board__notify_user` with `action_path: "/objective/<project-id>/<objective-id>"`:

> "✅ Objective set up: [title]. I'll assess progress [trigger description]. Use the chat to check in or update me anytime."

Then use `brain-emit` to split the work — setup is done, let a follow-up run handle the initial assessment, dashboard generation, and task creation:

```bash
brain-emit "Objective just set up — run initial assessment, generate dashboard, and create first tasks"
```

This keeps the setup run focused on gathering intent and writing config, while the follow-up run handles the heavier work of assessing, creating tasks, and generating the dashboard.

## Integrity checks

- CarapaBoard is authoritative for objective title, description, metadata,
  deadline, progress, and status. Synchronize setup changes through MCP and
  verify the resulting objective before reporting success.
- Wake-up triggers come only from `.agent/triggers.json`; CarapaBrain loads
  that file and does not read the board objective's `trigger_config`.
- A changed local rule, state file, or dashboard does not prove that board
  configuration was updated.
- After a board objective update, expect `objective-context.md` to be
  regenerated. Re-read it before editing and keep detailed behavior in
  dedicated rules rather than generated context.
- Before asking the user how existing platform behavior works, inspect the
  implementation, documentation, and current UI wiring. Ask only for decisions
  that available evidence cannot answer.
- Resolve symlinks before naming an owning repository or routing coding work.
  Reference the canonical source path and note consumer links when useful.
- When a correction supersedes an earlier statement, update every
  authoritative source future runs inspect instead of relying on chat history.
