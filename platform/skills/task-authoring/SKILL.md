---
name: task-authoring
description: Write or materially rescope CarapaBoard task cards for coder agents with repo-verified baselines, satisfiable acceptance criteria, a Verify plan and dependency chains. Use to create a card, hand work to the pipeline, split a large change into ordered tasks, or set extra reviewers/testers (co_stages) or A/B variants. Not for implementing or reviewing a card.
---

# Task Authoring

Turn one requested outcome into the smallest coherent task or ordered task chain
that agents can implement, test, and review without discovering the contract as
they go.

Follow the injected task-handoff rules. Inspect the repository and current task
record before mutating the board; a plausible description is not evidence.

## Preflight the contract

1. Verify baseline facts that affect acceptance: existing behavior, counts,
   supported input shapes, lifecycle states, and the real production/test
   boundary. Quote exact facts in the card when later agents need them.
2. Check every pair of requirements for conflict. In particular, reconcile
   preservation language with migrations or count changes, and reconcile hard
   bounds with the amount of information that must be retained.
3. Define the valid production input domain. Do not make malformed,
   unreachable, or unlimited inputs implicit acceptance requirements.
4. Map the outcome to production boundaries and verification surfaces. Keep
   atomic contracts together; identify capabilities that can be implemented and
   validated independently.
5. For every "all", "every", "complete" or "must still be found" guarantee
   whose data passes a bounded sink or scan (logger string/array/record caps,
   column or message size, list limits, scan budgets, timeouts), quote the
   bound from the code, name the inputs that must stay complete, and list under
   accepted limits what happens to all other inputs (counted omission, fail
   closed, fail open). Otherwise a reviewer can build a new near-limit input
   every round.

Resolve contradictions from repository evidence and the user's stated outcome.
Ask only when different resolutions would materially change product behavior or
require authority the user has not granted.

## Verification scope

Default to no new permanent tests, including new cases in existing files. Build
the card's **Verify** plan around existing CI/tests, type/build checks, and
focused runtime or browser verification appropriate to the repository.

Require new tests only when a human explicitly requests them, a new core
capability needs CI protection, or a demonstrated gap leaves a core workflow
unprotected. Cite the human request or name the core behavior and missing
existing coverage. An agent-written acceptance criterion, verification plan, or
review finding does not itself justify adding tests; a generic regression risk
is not enough.

Keep the CI safety net small and durable, protecting core workflows and
rebuild/startup reliability through observable behavior. Prefer the smallest
addition to an existing core workflow test. Do not routinely add regression-test
requirements for individual fixes, helpers, styling changes, or acceptance
criteria, or expand a task with production abstractions solely for unit tests.

Preserve core workflow protection when maintaining tests. Obsolete or brittle
assertions may be simplified, consolidated, updated, or removed; deleting a
low-value test does not require replacement.

## Documentation scope

Every card that changes observable behavior, configuration, settings, API or
tool contracts, stage/lifecycle semantics, or operator workflows must keep the
repository's documentation true. Before creating the card, search the docs
(`README*`, `docs/`, `AGENTS.md`/`CLAUDE.md`, module READMEs) for the affected
behavior and name the exact files and sections to update in the description.
Add the documentation update as an acceptance criterion.

When existing docs already describe the intended behavior and the code
contradicts them, cite that section as baseline evidence. If no documentation
covers the area, name the section where a short description belongs rather
than omitting the requirement. Pure refactors, test-only changes, and internal
fixes with no observable change need no documentation item; say so explicitly
in the card's scope.

## Choose one task or a dependency chain

Use one card when the change has one coherent behavioral contract, even if its
API and UI representations must move together, and it passes the size check
below.

Create an ordered dependency chain when the request contains independent
architectural foundations, migrations, concurrency/recovery protocols, or
follow-on behavior with separate acceptance evidence. Do this autonomously;
decomposition is implementation planning, not a user decision.

Size is a required split check. When a card may exceed 200 changed lines,
write `Expected size: ~N changed lines` (excluding lockfiles, generated files
and fixtures). If N is over 300, split the work into an ordered chain of at
most 4 cards, each expected at 300 or less, foundations first, linked with
`depends_on_ids`, even when it is one behavioral contract. Keep one card only
for a migration that must land whole or a security fix, and write
`Atomic: <reason>`. If 4 cards are not enough, deliver a smaller outcome first.
The size is the author's estimate, not a limit: coders and reviewers must not
reject or revert finished work for exceeding it.

For a chain:

- create only the cards needed to deliver the requested outcome;
- make each card independently understandable, verifiable and mergeable;
- place foundations first and set explicit `depends_on_ids` on consumers;
- keep cross-card integration requirements on the final consuming card;
- do not create separate cards for individual review findings or polish nits.

## Variants and extra reviewers/testers

Set these fields when creating the card (or later, while it is in a queue stage
and not running). Valid ids come from `get_project_setup`; `list_stages` omits
stage alternatives.

- `co_stages` (e.g. `["review.o"]`): extra reviewers or testers that judge the
  same implementation. Entries must be configured alternatives of a review or
  testing stage. Reviewers all run and must all approve; testers run in order
  and the first failure sends the card back.
- `ab_variants` (e.g. `["a", "b"]`): compare different implementations of one
  card. Needs at least 2 variants, a coding alternative for every non-`a`
  variant (e.g. `coding.b`), and a worktree-mode project. The card forks into
  one child per variant; a human picks the winner in the UI, so never plan on
  an agent merging a variant.
- `stage_variant` (e.g. `"b"`): run this one card on the `*.b` alternatives
  instead of comparing.

Do not use `ab_variants` for review/testing alternatives; use `co_stages`.

## Create or update

Before calling a task mutation tool, confirm that each card has:

- a short outcome title;
- verified current and target behavior;
- bounded, jointly satisfiable acceptance criteria;
- one coherent scope and explicit out-of-scope neighbors;
- a credible production-boundary verification plan;
- the documentation files and sections to update, or an explicit statement
  that no documentation is affected;
- dependencies needed to make its starting state true.

For an active task, update its description only for same-boundary corrections.
Deliver the clarification to the active stage as well as future stages. If new
work is independently implementable, create a dependent card instead of
expanding the running contract.

After mutation, reread the created or updated cards and verify titles, stages,
dependencies, and descriptions. Correct malformed handoffs immediately.

## Board mechanics

- Route with `target_project`, not `project_id`: `create_task` silently ignores `project_id` and creates the card in the current project, where the intended team may not see it. Group chat can coordinate several projects, but each card targets its owning project.
- `create_task` returns only `{id, title, status}`. Confirm the card landed in the intended project with `get_task` or `list_tasks`.
- There is no MCP delete for kanban tasks: a misrouted card can only be parked in a terminal stage and renamed, or deleted from the UI.
- Before creating cards, list the target project's existing tasks; do not duplicate work a prior run already carded.
- Always pass the full task ID to `get_task`, `update_task` and other single-task tools.

## Card content

- Each coder sandbox sees exactly one repository. Never mix code from two projects in one card; split it, one card per project.
- Never point a card at files outside its repository (other repos, group files, `/tmp`). Embed the needed text, excerpts and evidence, or commit a reproduction into the repo.
- Read the relevant code first if this sandbox can see the repository; otherwise state the baseline as unverified and make confirming it the card's first step.
- Never reference cards by ordinal ("task #2"). Use real task IDs, or describe the file, function or endpoint the dependency produces.
- Verification runs inside the card's own sandbox (tests, in-process checks). Never write "reproduce against the running service" into Verify: the Testing stage is read-only and blocks on it.
- Take verification commands from the repository's own instructions (`AGENTS.md`, `.agent/rules/`), not from memory.
- Script every workflow bullet that Testing must exercise (browser, chat/MCP, live-data run): numbered steps, the fixture or seed it needs, and the expected persisted result, with each failure, disabled or rejected path as its own step. A card whose acceptance depends on a long-running job or live fetch is split into a code card and a run/report card, or states that Testing verifies a finished artifact and never waits on a running job.
- An acceptance check that must change state outside the card's worktree (shared module or library repos, the main checkout's refs or branches, a shared database) is refused by read-only Testing, and the card lands in Question. Either have the coder run it and save the log at a named path that Testing reads, or authorize it in Verify and in a persistent Testing note: the disposable probe, the refs or databases it may create, the before/after snapshot that must match, and its cleanup. Testing then blocks only on a real command error.
- Check the gate that will judge the card before writing it. Read the target project's worker/testing prompt (`get_project_setup`) and carry its constraints into the acceptance bullets (e.g. a prompt that forbids tests passing on the base commit cannot sit next to "behaviour unchanged" bullets that need exactly such tests). When the card embeds content for a validated write path (proposal files, config, schema), read the validator first and include what it requires (frontmatter, entry file). A bullet the gate rejects returns the card as a Question or rejection.
- Destructive maintenance cards (deletes, sweeps, migrations) must fail closed on a query error or an empty result and cap how much one pass may change.
- An audit finding becomes a card only with an incident, or a deterministic reproduction plus a reachable live caller; otherwise record it as backlog or accepted risk.
- If the target repository keeps a story backlog (e.g. `.agent/stories/{role}/{slug}.md`, see the `stories` skill if installed), put the repo-relative story path at the top of the description, e.g. `Story: .agent/stories/patient/booking.md`. If no story exists for the work, say so in the card.

## Running tasks and Question

- Never edit the title or description of a running task; the board refuses it and the executing agent keeps the original. Create a follow-up task, or stop the task first and then replace its scope.
- To correct a running task within its scope, send a one-shot `add_task_comment` on its current stage (default mode, not persistent). The live run receives it at once; the result reports `delivery: "steered"`. Persistent notes reach only later runs, never the one already in progress.
- To stop a running task and replace its scope, move it to a backlog stage with `update_task`. This stops the run, which may take up to about 30 seconds. Then edit the description and move the card back to its stage; the next run resumes with the new description. `pause_task` and `resume_task` manage scheduled chat tasks, not board cards.
- Put stage instructions that must survive retries (artifact paths, environment setup, recurring verification requirements) in a persistent note: `add_task_comment` with `persistent: true` on each relevant executable stage. A persistent note replaces that stage's previous note, so carry forward what still applies. Use the default one-shot mode only for guidance meant for a single run.
- Treat Question as temporary routing when the blocker is recoverable: resolve reversible internal blockers within the authorized scope, add the answer or evidence to the task, and return it to an executable stage.
- Leave a task in Question only when it genuinely needs external information, authority, credentials or a user decision. State the exact requirement and notify the user when appropriate.
