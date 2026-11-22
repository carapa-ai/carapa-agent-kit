---
name: smart-objective
description: SMART template and checklist with weak and strong examples to write or audit an objective description and save it via update_objective. Use to check whether an objective is well-defined, sharpen a vague goal, or add measurable targets and milestones.
---

# SMART Objective Template

Use this skill to define or refine an objective using the SMART framework. A well-defined SMART objective is the foundation for meaningful assessments — vague goals produce vague progress.

## The SMART Framework

### Specific
*What exactly needs to happen?*

Describe the outcome in concrete terms. Avoid vague language like "improve" or "better". Name the system, feature, team, or metric being changed.

**Weak:** Improve API performance
**Strong:** Reduce p99 response time on `/api/search` from 800ms to under 200ms

### Measurable
*How will you know it's done?*

Define at least one quantitative metric that signals success. This metric should be observable — something you can read from logs, task completions, test results, or user reports.

**Weak:** Users are happier with onboarding
**Strong:** New-user activation rate (completes first action within 24h) reaches 60%

### Achievable
*Is this realistic given current resources and constraints?*

Consider: team size, timeline, dependencies, technical debt, competing priorities. An objective that's too ambitious sets up failure; one that's too easy adds no value.

Questions to check:
- Do we have the skills and tools to do this?
- Are there hard blockers (waiting on another team, external API, budget approval)?
- Is the scope right for the time available?

### Relevant
*Does this align with broader goals?*

The objective should connect to a higher-level priority. Name the parent goal or business outcome it contributes to.

**Example:** "This supports Q2 growth by reducing drop-off in the trial funnel."

### Time-bound
*When is this due?*

Set a specific deadline (ISO date preferred: `2026-06-30`). If there are intermediate milestones, list them.

---

## Template

Fill in this template when defining a new objective:

```markdown
## Objective: [Short title]

**Specific:** [What exactly needs to happen — name the system, metric, or deliverable]

**Measurable:** [The metric(s) that signal success, with target values]
- Primary metric: [name] → target: [value]
- Secondary metric (optional): [name] → target: [value]

**Achievable:** [Why this is realistic — constraints noted, blockers identified]

**Relevant:** [What higher-level goal this contributes to]

**Time-bound:** Deadline: [YYYY-MM-DD]
Optional milestones:
- [YYYY-MM-DD]: [milestone description]
- [YYYY-MM-DD]: [milestone description]
```

---

## Checklist: Is this objective SMART?

Before saving the objective definition, verify:

- [ ] The outcome is described in concrete, unambiguous terms
- [ ] There is at least one measurable metric with a numeric target
- [ ] The metric is actually observable (you know where to read it)
- [ ] The scope is realistic for the deadline and available resources
- [ ] Blockers and dependencies have been named (not ignored)
- [ ] There is a specific deadline (not "eventually" or "soon")
- [ ] The objective connects to a named higher-level goal

---

## Examples

### Strong SMART objective

> Reduce checkout abandonment rate from 42% to below 30% by 2026-05-31, by fixing the three highest-drop-off steps identified in the June funnel audit. Supports Q2 revenue target.

- **Specific:** checkout abandonment, three specific steps
- **Measurable:** 42% → <30%
- **Achievable:** audit already done, steps identified
- **Relevant:** Q2 revenue
- **Time-bound:** 2026-05-31

### Weak objective (and why)

> Make the app faster and improve user experience by end of quarter.

- **Not specific:** "faster" — which endpoint? which user action?
- **Not measurable:** no numeric target
- **Not achievable to assess:** "user experience" can't be measured from events
- **Not time-bound:** "end of quarter" is ambiguous

---

## Saving the objective

Once the SMART criteria are filled in, save the definition as the objective `description` (and `deadline`) with `mcp__carapa-board__update_objective`, then verify with `mcp__carapa-board__get_objective`. CarapaBoard regenerates `.agent/rules/objective-context.md` from it; never edit that file directly, it is overwritten. It is loaded into context for every assessment, so keep the description concise and factual.
