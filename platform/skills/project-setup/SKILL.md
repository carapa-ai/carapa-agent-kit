---
name: project-setup
description: Set up or improve the current CarapaBoard project from its repo, covering the verify command, app startup and Browser preview hooks, Playwright UI testing, worktree and checkout mode, .agent/rules, pipeline stages (incl. A/B alternatives) and coding, testing and review prompts. Use to initialize or onboard a project, configure its pipeline or prompts, add verification, or make a repo ready for agents.
---

# Project Setup

Configure the current project from evidence in its repository. Work in phases:
understand the project, make it verifiable, reflect durable rules, then generate
the pipeline and prompts. Do not generate prompts from a shallow manifest-only
scan.

The invocation authorizes initializing missing local Git metadata in the already
selected repository, plus uncommitted edits needed for rules, verification, and
an accepted UI-testing setup. It does not authorize choosing or replacing a
repository, committing, pushing, merging, or creating board tasks.

## Explain setup without assuming computer experience

Assume the user has never used a PC. Speak respectfully to an adult; do not
describe the user as a beginner or make them learn development tools to proceed.
Lead with whether the thing they asked for works now, what prevents it, and the
next concrete action. Explain any necessary technical term on first use: a Git
commit is a saved version of the app; a worktree is a separate working copy for
a conversation. Raw Git errors, paths, and command names are supporting evidence,
not an explanation or an actionable handoff by themselves.

Do the technical work already authorized. If user action is necessary, give short
numbered steps with the exact screen, button/field label, value to enter, and
expected result. Verify controls exist in the running version before directing
the user to them. Do not hand over unexplained terminal commands or ask the user
to choose implementation details you can resolve from project settings.

When a required action needs permission, prepare and describe the actual change
and ask for that permission in plain language. For example, after reviewing the
files: "New conversations with their own working copy cannot start yet. The app
needs its first saved version. I have checked the files to include: [brief list].
May I save that first version now?" Explain what it affects and why permission is
needed. Do not merely say "an initial commit is required" and stop. Distinguish
scripts passing manual checks from the requested workflow actually working; keep
the unresolved blocker prominent instead of declaring setup done.

## Operating constraints

- Default to the project named by the injected `AGENT_CONTEXT`. In a parent chat,
  the user may explicitly name one authorized direct child; resolve its folder
  through project metadata, never from a repository path. Never accept a
  repository URL, grant, or credential.
- Always pass the selected project folder as `target_project` to every setup
  tool. This is required because child projects can run inside a shared sandbox
  whose MCP credential belongs to the parent. Confirm the returned `projectId`
  matches before continuing.
- Call `get_project_setup` first. `codeEnabled: false` means a chat-and-artifact
  project; a missing repository is intentional, not a setup failure. Main agents
  default to this mode. Skip Git initialization, code verification, worktree
  hooks, and coding/testing pipeline recommendations; continue only the requested
  chat, artifact, or prompt configuration using the project's group files. If the
  user wants to start building an app instead, explain **Project Settings →
  General → Code project** and have them enable it before repository setup.
- For code projects, if `repository.connected` is false, pause
  repository-dependent setup and follow
  [references/missing-repository.md](references/missing-repository.md). Inspect
  the current project's accessible workspace read-only and give concrete
  recovery steps; do not end with only "connect a repository and retry."
- Preserve existing configuration until its corresponding proposal is approved.
- Ask for one approval at a time. A refusal skips that step without ending the
  rest of the setup.
- Keep every repository change uncommitted. Never run commit, push, merge, or
  destructive cleanup commands unless the user explicitly asks later.
- Use the revision returned by `get_project_setup`, `set_project_stages`, or
  any other setup mutation for the next mutation. On a revision conflict,
  reread the setup and regenerate the affected proposal.

## Phase 1: Understand the repository

Read [references/discovery-and-verification.md](references/discovery-and-verification.md)
and follow its local Git initialization and discovery guidance. Initialize Git
when missing in the selected repository instead of handing that step back to
the user. Inspect actual code and documentation, not
only filenames. Include existing `.agent/rules`, agent instructions, manifests,
lockfiles, CI, tests, build/generation configuration, worktree hooks, and UI
preview infrastructure. Before inspecting or changing worktree hooks, read
[references/worktree-hooks.md](references/worktree-hooks.md) for the bundled
runner contract: arguments, environment, execution timing, and failure handling.

Summarize the evidenced stack, architecture, conventions, commands, and current
setup. Clearly distinguish facts from recommendations and pre-existing failures.

## Phase 2: Establish verification

Choose one canonical verification entry point using the precedence and coverage
rules in the discovery reference.

- Reuse an adequate existing command.
- For a single Node package, add or improve the root `verify` package script.
- For a monorepo, polyglot repository, or multi-step lifecycle, create
  `.agent/verify.sh`.
- Preserve the detected package manager and existing CI semantics.
- Make the command non-interactive. It must not install dependencies or leave
  persistent services running.

Run the command. If it fails on the starting tree, capture the exact baseline;
do not remove useful checks to force a pass.

### Apps that should start with the sandbox

For an app intended to stay available between agent sessions and start again
when CarapaBox starts the sandbox, create or update `.agent/after-start.sh` in the
sandbox service's configured project checkout. CarapaBox automatically runs it
inside that service after each managed start; no controller hook edit is needed.
Follow the distributed Playwright skill's
[app startup contract](../playwright-cli/references/external-browser-access.md#start-apps-with-the-sandbox).
Reuse or prepare the project's startup command, fixed port, readiness check,
logs, and stop command. The hook runs with `sh` and must return after readiness;
use `bash` explicitly when calling an existing Bash launcher. A shared sandbox
runs only its configured checkout's hook, not each child repository's hook.
Keep on-demand `.agent/start-browser.sh` previews separate, and do not publish
external access unless requested. Report an older controller as needing an
upgrade rather than requesting a custom stack hook.

## Phase 3: Offer browser-testing setup

Read [references/ui-testing.md](references/ui-testing.md). When the repository
contains a browser UI with a viable local preview, offer the UI setup once.

If accepted, reuse or create the smallest coherent set of worktree hooks,
launcher/seeder/login helpers, an on-demand `.agent/start-browser.sh` when needed,
package scripts, ignored evidence paths, shared Board session and recording
guidance, and teardown that preserves shared resources. Use named sessions only outside
Board-managed runs. Apply those repository edits without asking for approval
file by file; CarapaBoard already shows the working-tree diff. Validate startup,
authentication, a small browser smoke flow, and clean teardown when the
environment permits.

If declined or infeasible, record why and continue without enabling recording.

## Phase 4: Configure task isolation

Read `taskCheckout.mode` from the setup snapshot. For projects where agents
modify code, recommend `worktree` mode when parallel isolated execution is
desired; `shared` and `branch` modes serialize access to the repository's main
checkout and conversations may wait for its lease.

It is safe to call `set_project_task_checkout_mode` only after explicit user
approval. Pass the selected `target_project` and latest revision. Do not
silently change the mode or unrelated sandbox, branch, push, parallelism, or
repository settings.

For a project with a browser UI, a working worktree preview is a precondition
of `worktree` mode, not a follow-up. Before switching, confirm in a prepared
task worktree that the preview starts (`.agent/start-browser.sh`, or a
per-worktree `.preview-url` on nginx-sidecar stacks), that the Testing prompt
you will write uses it, and, only when the app has a login, that a test user
exists in the worktree's own data. An app without authentication needs only the
preview: say "no login" in the Testing prompt so Testing does not look for one.
When login is added later, the card that adds it also seeds the worktree test
user and updates the Testing prompt. When any of these is missing, build it
first (Phase 3), or tell the user
in one sentence that every UI card will be blocked in Testing until it exists
and switch only if they still want to. Never note "no preview yet" and switch
anyway.

Generated worker/stage prompts must reflect the final setting. When isolation is
enabled, assume the task already starts in its isolated worktree; never require
`git status` as a preflight. When isolation is disabled, do not invent a generic
`git status` requirement either—state only evidenced project safeguards.

## Phase 5: Reflect durable project rules

Load the installed `reflect` skill and follow its apply behavior. Reconcile the
new evidence with `.agent/rules/`; do not duplicate or broadly overwrite existing
rules.

At minimum ensure there is discoverable guidance for:

- the canonical verification command, prerequisites, coverage, expected runtime,
  and known baseline failures;
- architecture and repository conventions that future agents must follow;
- the UI launcher, login/session lifecycle, evidence locations, cleanup, and
  verification boundary when browser testing was configured;
- the project's `.agent/after-start.sh`, app startup/readiness and stop commands,
  logs, and verified restart scope when persistent app startup was configured.
- what task worktrees share with the main checkout and each other (database,
  externally linked packages, linked uploads), following
  [references/worktree-hooks.md](references/worktree-hooks.md#shared-resources);
- how to check third-party APIs against the installed version when the
  repository has third-party dependencies: the lockfile that pins versions
  (for example `bun.lock`, `package-lock.json`, `composer.lock`,
  `poetry.lock`), where installed package sources and type definitions live
  (for example `node_modules/<pkg>`, `vendor/<vendor>/<pkg>`, a virtualenv's
  `site-packages`), and whether a fresh task worktree has them (shared,
  symlinked, or installed by worktree setup). When they may be absent, record
  the fallback: take the version from the lockfile and consult that version's
  upstream documentation. Record only locations and behavior evidenced in the
  repository; name no ecosystem the project does not use.

Use valid flat CarapaBoard frontmatter. Run reflection after the final commands
and scripts are known so the rules never point at drafts.

## Phase 6: Choose a pipeline profile

Only now offer these profiles:

1. **Preserve and improve** — keep current stages and propose targeted changes.
2. **Recommended** — replace stages with a topology derived from the project.
3. **Minimal** — queue, implementation, done, and failure handling only.

For a typical UI application, recommend queue/question, implementation, testing,
review, completed, and failed stages. Omit testing or review only when there is a
clear project-specific reason. Enable recording only after deterministic preview
and authentication were validated. Add a testing stage that runs browser checks only
once the worktree preview precondition in Phase 4 holds.

Stage execution semantics are independent of stage type: passive/queue stages
may set `runOnEntry` to enable a one-shot agent entry hook. This runs once when
a task enters that stage and does not make the stage a normal executable worker
stage or change the stage's passive behavior. When proposing or reviewing stage
topologies, preserve this distinction and describe any configured entry hooks
alongside the stage order and runtime settings.

Configure a prompt-backed passive entry hook in two explicit steps. To enable
one, first use `set_project_stages` with `runOnEntry: true`, then use
`set_project_prompt` with `prompt_type: "stage"`, the passive stage ID, and its
prompt content. To remove and disable one, clear its prompt with `content: null`
while `runOnEntry` is still enabled, then use `set_project_stages` with
`runOnEntry: false`. A stage prompt never enables the hook implicitly, and
inactive, unknown, or non-opted-in passive stages cannot receive stage prompts.

Stage alternatives let a project run the same stage with a different run
configuration. Define one as a stage with id `<base>.<suffix>` (for example
`coding.b`, `review.o`, `testing.u`) through `set_project_stages`; the base must
be an active, testing, or review stage. An alternative overrides only run config
(runtime, sandbox, persona, recording, stall timeouts), never appears as a
board column, and is used by tasks through `stage_variant`, `ab_variants`
(coding alternatives), or `co_stages` (review/testing alternatives). Give an
alternative its own prompt with `set_project_prompt` using the alternative id as
`stage_id`; without one it uses the base stage prompt. Add alternatives only
when the user wants to compare or double-check work with another runtime.

Present stage order, type, runtime selection, and recording flags together. Call
`set_project_stages` only after approval and pass the same `target_project`.

## Phase 7: Generate prompts one at a time

Read [references/prompt-contracts.md](references/prompt-contracts.md). Generate
prompts from the reflected `.agent/rules`, canonical verification command, and
selected topology. CLI harnesses inject applicable project rules automatically:
never tell task agents to find, open, read, or load `.agent/rules` files.

Propose and apply in this order, asking separately for each:

1. shared `worker.md`;
2. coding-stage prompt;
3. testing-stage prompt;
4. review-stage prompt;
5. any evidenced specialist-stage prompt;
6. `system.md`.

Use `set_project_prompt` only after the corresponding approval and pass the same
`target_project`. Project worker guidance is composed before stage guidance by
CarapaBoard, so stage prompts should specialize rather than restate it. Testing
and review prompts must contain only project-specific guidance: CarapaBoard
always supplies their lifecycle instructions and required JSON response formats
at runtime. Never write or propose a project `.agent/prompts/review.md`; review
customization belongs in `stage-<review-stage-id>.md`. When the topology has an
enabled testing stage, keep the review prompt focused on code inspection and
the adequacy of testing evidence; do not ask Review to rerun validation.

## Phase 8: Validate and report

- Reread the setup and confirm stage order, prompt presence, runtime choices,
  recording flags, and revision.
- Rerun the canonical verification command after repository edits.
- If UI setup was accepted, verify ordinary named-session cleanup or
  CarapaBoard-owned recorded-session finalization, as applicable, and confirm
  that no tracked credentials, storage state, snapshots, traces, or recordings
  were created.
- Run `git status --short` and explicitly confirm that nothing was committed.
- Report applied, declined, failed, and outstanding recommendations. Do not
  create a board task for follow-up work.
