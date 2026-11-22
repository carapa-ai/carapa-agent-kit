# Project Prompt Contracts

Generate compact prompts from repository evidence and reflected `.agent/rules`.
Every stage prompt should state purpose, inputs, required actions, verification,
evidence, human-input conditions, and completion conditions without repeating
the shared worker prompt. Claude, Codex, and other CLI harnesses automatically
inject applicable project rules. Never instruct task agents to locate, open,
read, or load `.agent/rules` files.

## Question handoff contract

Include this behavior in the shared worker prompt whenever the pipeline has a
`question` or equivalent human-input queue:

1. Call `add_task_comment` first with the current `task_id`, the current
   executable `stage_id` supplied by CarapaBoard's task-management guidance,
   `persistent: false`, and a self-contained explanation of the missing
   decision, work attempted, concrete options and consequences, and a supported
   recommendation.
2. After the comment succeeds, call `update_task` with the same `task_id` and
   `status: "question"` (or the exact configured human-input queue ID).
3. Verify both tool responses, then stop without implementing an unapproved
   option.

Do not use `send_message` for this handoff and do not target the queue stage in
`add_task_comment`; comments target the executable stage so the explanation is
visible and is available when the task resumes.

## Shared worker prompt

Direct every worker to inspect the task, follow the automatically injected
project guidance, preserve scope, respect repository safety boundaries, use the
canonical verification entry point, and report concrete evidence. Keep
architecture details in rules instead of copying them here. Do not require a
`git status` preflight; isolated tasks already start in a dedicated worktree.

## Coding prompt

Tailor the implementation stage to the repository:

- trace the affected behavior and tests before editing;
- follow the injected architecture, dependency, migration, generated-code, and
  UI conventions;
- before relying on an unfamiliar or version-sensitive third-party API, check
  it against the installed version as described in the injected project
  guidance instead of relying on recall;
- when worktree isolation is enabled, assume the task starts in its dedicated
  worktree and branch;
- assess verification needs proportionately; add or update automated tests
  only when the task requires them or a concrete material regression risk is
  not credibly covered by existing tests or other verification;
- run targeted checks while iterating and the canonical verification command
  before completion;
- distinguish newly introduced failures from documented baseline failures;
- report changed behavior, verification evidence, and unresolved blockers;
- request human input when product intent, credentials, destructive changes, or
  authority outside the task is required.

## Testing prompt

Testing is independent verification, not a repetition of the coder's claims.
Tailor it to the available test surfaces:

- inspect the task, relevant diff, injected project guidance, and previous
  evidence;
- run the canonical verification command and focused regression tests;
- reproduce user-visible workflows for UI changes;
- follow the reflected UI launcher, login, evidence, and cleanup lifecycle when
  Playwright applies; retain CarapaBoard's injected session in all managed runs
  and preserve a shared Browser preview during cleanup. Recorded Testing also
  leaves capture and video finalization to Board;
- check console/network failures and treat `### Error` as failure;
- identify baseline versus regression failures without weakening checks;
- state a clear pass, repairable failure, or blocker with evidence.

Testing must make one comprehensive pass over the applicable acceptance
boundary. Finding one defect is not a reason to stop inspecting. Report every
independent, reproducible, in-scope failure visible in the current checkout,
grouping multiple symptoms of one root cause. Require production reachability
or an explicitly supported input; do not fail speculative, malformed-input, or
adjacent behavior that the task does not claim to support.

Do not require a new automated test for every code change. Existing tests,
type/build checks, and focused runtime or browser verification may provide
sufficient evidence. Because Testing is read-only, do not fail solely because
no test file changed. Treat missing new coverage as a failure only when the task
explicitly requires it or when the absence prevents credible validation of a
specific material behavior. Name that behavior and risk; never report a generic
“missing tests” issue.

Do not copy CarapaBoard's built-in read-only testing lifecycle or verdict wire
format. The platform always supplies the `pass | fail | blocked` JSON contract
at runtime; this project prompt contains only repository-specific testing
guidance.

## Review prompt

Embed the useful project-detection and review-criteria behavior of the existing
review-prompt workflow, but omit its standalone JSON output block because
CarapaBoard always supplies the `approve | reject` JSON contract and review
lifecycle at runtime. Store project-specific review criteria only in
`stage-<review-stage-id>.md`; never create or propose
`.agent/prompts/review.md`.

Start from the task, the relevant task/base diff, injected project guidance,
and verification evidence. Do not require `git status` as a preflight; an
isolated review worktree may be clean after the task lifecycle committed its
changes. Review against universal criteria:

When the selected pipeline includes an enabled testing stage, keep review
focused on code inspection and the adequacy of the testing evidence. Do not
instruct the reviewer to rerun lint, typecheck, build, unit, integration,
end-to-end, or browser tests; CarapaBoard also enforces this separation in its
runtime review prompt. Missing or inadequate evidence is a review issue, not a
reason for the reviewer to repeat the testing stage. When the pipeline has no
testing stage, include proportionate validation in the review guidance.

- correctness and full task coverage;
- scope discipline and absence of unrelated refactors;
- simple, maintainable design without needless abstraction;
- reuse of existing utilities without harmful duplication;
- clean code without debug output, dead code, or unexplained TODOs;
- dependency changes only when necessary and justified;
- verification evidence proportionate to the change. New automated regression
  coverage is expected only when the task explicitly requires it or a concrete,
  durable risk is not credibly covered by existing tests or other verification;
  never reject merely because no test file changed;
- security, privacy, authorization, and secret-handling boundaries.

Calibrate rejection to material production risk. A blocker must violate an
acceptance criterion, break a valid production path, create a credible
security/data-integrity/concurrency failure, or leave required verification
inadequate. State the valid input and reachable control path. Defensive
hardening for malformed or unreachable inputs, stylistic preferences, and
adjacent improvements are non-blocking unless the task explicitly requires
them.

Require one comprehensive pass and all currently visible independent blockers
in one verdict. On re-review, verify prior findings, the acceptance criteria,
and the repair delta against the last reviewed content. Inspect newly affected
boundaries when a repair changes them, but do not restart open-ended edge-case
discovery across unchanged code or silently expand the task contract.

## Autonomous recovery entry prompts

When a queue entry hook handles repeated Testing or Review failures, keep
technical recovery autonomous. It should cluster the history by underlying
invariant, identify why the previous strategy failed, choose a materially
different strategy, leave one self-contained implementation handoff, and resume
the first executable stage. Do not merely reset counters and replay equivalent
instructions. Reserve human-input queues for product intent, authority,
credentials, destructive choices, or unavailable external dependencies.

Add only evidenced stack-specific criteria, for example:

- TypeScript: sound exported types; no unexplained `any` or assertions hiding
  errors.
- React/UI: design-system consistency, accessibility, responsive behavior,
  stable inspectable selectors, and browser verification.
- API/backend: validation, authorization, status/error contracts, logging, and
  database failure handling.
- Python: public type hints, specific exception handling, and project import
  conventions.
- Go: wrapped errors, context propagation, and public documentation conventions.
- Rust: justified panic/unwrap behavior, appropriate error types, and ownership
  discipline.
- PHP: strict types, parameterized queries, and project style rules.
- Docker/infra: no embedded secrets, correct health/lifecycle behavior, and
  least privilege.

Use the repository's actual framework, persistence layer, design tokens, and
rules. Do not apply frontend criteria to a backend-only project or invent a
design system.

## System prompt

Keep the project system prompt stable and high level: project purpose,
architecture boundaries, rule-loading convention, safety constraints, and key
terminology. Volatile commands and detailed implementation conventions belong in
rules and stage prompts.
