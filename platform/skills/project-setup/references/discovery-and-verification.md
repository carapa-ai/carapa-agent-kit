# Discovery and Verification

## Initialize missing local Git

Once the repository directory has been selected through project configuration
and is accessible in the sandbox, check Git before configuring worktrees. A
configured directory can contain app files without having Git initialized.

- Use `git -C "$repo_dir" rev-parse --show-toplevel` and inspect existing Git
  metadata. A linked worktree has a `.git` file, so do not test only for a `.git`
  directory. If Git resolves to a parent checkout, report that mismatch instead
  of creating a nested repository. Permission, ownership, and corrupt-metadata
  errors are not evidence that Git is absent.
- Resolve `default_branch` from the selected project's **Project Settings →
  Repository → Default Branch** (`defaultBranch`), falling back to `develop`
  when unset or empty. Board supplies this value as `DEFAULT_BRANCH` in the
  sandbox; use that environment value when it belongs to the selected project.
  In a shared sandbox, do not substitute the owner's branch setting for a
  child's setting. Do not rely on Git's global `init.defaultBranch` or defaults.
- When Git is genuinely absent, run
  `git -C "$repo_dir" init --initial-branch="$default_branch"` yourself as part
  of setup, without another confirmation. Verify that Git resolves to the
  selected repository directory and `git -C "$repo_dir" symbolic-ref --short
HEAD` matches the resolved default branch. Report the branch used and whether
  it came from Project Settings or the `develop` fallback. For an existing
  checkout, report a missing configured default branch instead of silently
  renaming branches or changing project settings.
- Do not initialize the fallback group-data folder merely because it is the
  current working directory. First establish the selected code repository;
  follow the missing-repository handoff if no repository is connected.
- Check `git -C "$repo_dir" rev-parse --verify HEAD` separately. Initialization
  does not create a commit, and worktrees require one. If HEAD is unborn, report
  that separate conversation working copies cannot start until the app has its
  first saved version. Inspect the files and ignore rules, explain what would be
  saved, and request permission to create that first commit if it is not already
  authorized. Do not stage or commit files under setup-only authorization; honor
  existing explicit commit authorization when present. If the running UI has a
  first-commit action and the user wants to do it themselves, give its exact clicks
  and expected result. Keep worktree operations pending until HEAD exists.

## Evidence pass

Inspect enough real implementation and documentation to understand how work is
done, not merely which framework is installed.

1. Read repository-level agent instructions and every relevant `.agent/rules`
   description/body.
2. Read the README, contributing guide, architecture documents, ADRs, and CI
   workflows.
3. Inspect root and workspace manifests, lockfiles, language/build configs,
   generation steps, database/migration tooling, and deployment definitions.
4. Inspect representative entry points and modules across backend, frontend,
   persistence, and tests as applicable.
5. Inspect existing verification, worktree setup/teardown, preview, fixture,
   seeding, authentication, and browser-test scripts.
6. Record only conventions supported by code, documentation, CI, or explicit
   user direction. Do not turn incidental style into a durable rule.

## Canonical verification selection

Prefer, in order:

1. An existing documented `verify`, `check`, or equivalent command matching CI.
2. An existing CI entry point that can safely run locally.
3. A root `verify` package script for a single Node package.
4. `.agent/verify.sh` for workspaces, polyglot repositories, or orchestration
   that does not fit naturally in one manifest.

Use the repository's lockfile to select Yarn, pnpm, npm, or Bun. Do not silently
switch package managers. A project-specific command may resemble:

```json
{
  "scripts": {
    "verify": "yarn --silent lint:js --quiet && yarn --silent generate --quiet --fail-on-error"
  }
}
```

That is an example, not a template: include the checks actually required by the
project.

## Coverage and ordering

Derive coverage from CI and available scripts. Usually run fast deterministic
checks before expensive ones:

1. formatting or lint checks;
2. generated-code/schema consistency;
3. type/static analysis;
4. unit tests;
5. integration tests that need no persistent external service;
6. production build;
7. bounded browser smoke tests when part of the normal gate.

Prefer native check/fail-on-diff modes for generation. If generation necessarily
writes files, document that behavior and fail when it leaves unexpected tracked
changes. Do not reset or discard those changes automatically.

The canonical command must:

- be non-interactive and return nonzero on failure;
- suppress routine noise without hiding actionable failure output;
- avoid installing dependencies;
- avoid watchers and persistent services;
- set flags such as `PLAYWRIGHT_HTML_OPEN=never` when needed;
- preserve project-specific environment and test isolation conventions.

## Baseline failures

Run the command before prompt generation. If it fails, record the command,
failing step, concise evidence, and whether the failure predates setup. Do not
weaken coverage, rewrite unrelated code, or claim the repository is healthy.

## Verification rule

The reflected rule should state:

- the exact canonical command and working directory;
- prerequisites that setup hooks normally provide;
- which checks it covers and meaningful exclusions;
- expected runtime or fast targeted alternatives if evidenced;
- when coding, testing, and review agents must run it;
- known baseline failures, if any.
