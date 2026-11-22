---
name: reflect
description: Turn recent user corrections, preferences, project constraints and reusable lessons into .agent/rules files with valid frontmatter, merging with existing rules and removing superseded ones. Use for /reflect (preview) or /reflect apply, or when the user says remember this, from now on, or save this as a rule. Also load before adding, trimming or replacing anything in .agent/rules. Not for SKILL.md files.
---

# Reflect

Convert evidence from recent interactions into concise operational rules that future agents can follow. Write rules to `.agent/rules/*.md`, the canonical location consumed by CarapaBoard DirectLLM agents and compatible CLI agents.

## Command behavior

- Treat `/reflect` as preview-only. Propose changes without writing files.
- Treat `/reflect apply` as authorization to apply the proposed changes.
- If the user explicitly asks to create or update the rules now, apply the changes without requiring a second confirmation.
- Keep all other reflection requests preview-only when the requested action is ambiguous.

## CarapaBrain objective folders

In an objective folder (one with `state.json` and `.agent/triggers.json`):

- An explicit `/reflect apply` or "save this as a rule" in chat is a deliberate edit: write it now. Do not stage it in `.agent/reflections/pending-rules.md`. Staging is for unattended runs.
- Put each lesson where the run that needs it reads it:
  - what a trigger run does goes in that trigger's `context` in `.agent/triggers.json`;
  - the objective's procedure and guardrails go in the objective description, via `update_objective` (the board regenerates `objective-context.md`; never edit that file);
  - everything else goes in a rule file in `.agent/rules/`.
- Keep one copy of each instruction across this folder's triggers, description and rule files. Where another of them needs it, point to that copy instead of repeating it. A matching shared board memory is not such a copy (see "What earns a rule").
- Before writing, read `pending-rules.md`. Run reflections append to it automatically, so remove entries the user rejected and drop duplicates of what you just wrote.
- If the user asks when a staged lesson takes effect: the reflector folds `pending-rules.md` into `.agent/rules/session-reflections.md` at the end of a run, once the file has at least 30 lines and 6 hours have passed since the last fold (Brain defaults). An LLM condenses the text.

## Select durable evidence

Review the relevant conversation history and retain only information likely to improve future work:

- explicit user corrections and stable preferences;
- settled architectural or product decisions;
- recurring coding, testing, review, or communication conventions;
- durable constraints, safety requirements, and reusable lessons from failures.

Exclude transient task state, completed one-off actions, guesses, generic advice, duplicated rules, secrets, credentials, and sensitive personal data. Do not turn a single unexplained choice into a permanent preference. Preserve the user's meaning without inventing rationale or widening its scope.

## Reconcile with existing rules

1. Locate the `.agent/rules/` directory for the current group, project, or objective. Do not write to a parent, sibling, or unrelated scope unless the user explicitly requests it.
2. Inspect filenames, frontmatter, and relevant existing content before proposing a change.
3. Merge with the closest existing rule when the topic already exists. Create a new focused file only when no suitable file exists.
4. Replace or remove obsolete guidance when newer evidence clearly supersedes it. Do not leave contradictory versions active.
5. Use a lowercase kebab-case filename, optionally with the repository's existing numeric ordering prefix, for example `typescript-style.md` or `04-debugging-and-verification.md`.

Prefer `.agent/rules/` over `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` for reflected rules. CarapaBoard injects or advertises `.agent/rules/*.md` to DirectLLM agents; the other files are not a reliable DirectLLM discovery mechanism.

## Write CarapaBoard rule frontmatter

Start every created or rewritten rule file with this exact flat YAML structure:

```yaml
---
trigger: model_decision
description: Use when changing TypeScript models, public types, or serialization boundaries.
---
```

Follow these requirements:

- Put the opening `---` at the first byte of the file with no preceding text or blank line.
- Use only `trigger` and `description` in rule frontmatter. Never add `alwaysApply`: for OMP the runtime already generates one always-applied rule from every `always_on` file, and OMP also reads `.agent/rules` itself, so `alwaysApply: true` would load the rule twice.
- Keep each key and value on one line. Do not use multiline YAML, lists, nested objects, or duplicate keys.
- Set `trigger` to exactly `model_decision` or `always_on`.
- Default to `model_decision` for topic-specific rules. CarapaBoard lists the file and its description so a DirectLLM agent can read it on demand.
- Use `always_on` only for short instructions that genuinely apply to nearly every task. CarapaBoard injects the entire body of every `always_on` rule into every DirectLLM system prompt, and Claude loads every rule file in full whatever its `trigger`.
- Write a specific, retrieval-oriented `description`. For `model_decision`, start with `Use when ...` and name concrete tasks, files, systems, or failure modes that should cause the agent to load the rule.
- End the frontmatter with a closing `---`, followed by the Markdown body.

Use this frontmatter for an always-on rule:

```yaml
---
trigger: always_on
description: Applies to every agent task in this scope.
---
```

A file without valid leading frontmatter is treated as `model_decision` with `No description provided.`, which makes it effectively undiscoverable to DirectLLM agents.

The `SKILL.md` file itself has a different frontmatter contract: it must begin with single-line `name` and `description` fields. Keep `name` equal to the skill directory name (`reflect`), and put all trigger phrases and usage contexts in the one-line `description`; CarapaBoard uses those two fields for skill and slash-command discovery.

## Write the rule body

- Use a clear topic heading and concise, actionable instructions.
- State what to do, when to do it, and any important exception.
- Include examples only when they remove real ambiguity.
- Keep narrow context out of `always_on` files.
- Preserve unrelated content and existing project terminology when editing a file.

## Keep rule files lean

### Cache stability

- Auto-loaded rules form the cached prompt prefix. Keep them byte-stable between runs; a one-line edit invalidates the cache for every following run.
- Volatile notes (timestamps, costs, counters, pending actions) go to memory or reports, never to `.agent/rules/`.
- Do not edit auto-loaded rules mid-conversation for a passing lesson; batch durable lessons into one deliberate edit.

### What earns a rule

- A user correction, or the same mistake seen twice. One-off observations stay in logs or memory.
- When the user confirms a different approach, replace the old rule and the old memory in the same turn; do not leave the superseded version in either place.
- Adding a rule is no reason to invalidate a memory that states the same lesson. Rule files load only in their own scope, while the main agent and child-project agents can recall shared board memory, so keep both unless the memory is wrong or superseded. When you later change the rule, supersede the memory too.
- When a rule contradicts how the system works today, fix or delete it in the same run.

### Size

- Keep always-on rules small (target ≤15 KB per file). Claude loads every rule file in full, whatever its `trigger`; put situational guidance longer than a few lines in a skill instead, which every harness loads only when needed. Move detail to a reference file outside `rules/` (e.g. `.agent/reference/<name>.md`) and leave a one-line pointer.
- Archive the original before trimming (e.g. `.agent/archive/`); keep no `.bak` files in `rules/` (they are auto-loaded too).

### Editing

- Back up a rule file before a substantial edit.
- Keep the YAML frontmatter at the very start of the file.
- Write permanent lessons to a dedicated rule file, not `observations.md` (it is curated and trimmed externally).
