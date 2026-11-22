# Worktree Setup and Teardown Contract

Read this before creating, changing, or manually validating worktree hooks.
This reference supplies the CarapaBox contract even when the project sandbox
cannot access the CarapaBox repository. Do not ask the user for runner source
merely because it is absent from the project checkout.

## Invocation and environment

CarapaBox runs the hook from the selected worktree's root, inside the selected
sandbox service (normally `agent`), using:

```sh
sh .agent/worktree-setup.sh
# or
sh .agent/worktree-teardown.sh
```

- No positional arguments are passed: `$#` is zero. Do not expect `$1` to be
  a path, branch, action, or main checkout.
- Use POSIX `sh` syntax. A Bash shebang does not select Bash because the runner
  explicitly invokes `sh`. If Bash is necessary and available, use a POSIX
  wrapper that explicitly invokes a separate Bash helper.
- Only file presence is checked (`-f`); an executable bit is not required.
  Missing hooks are skipped. The copy in the target worktree is used, so
  uncommitted hook edits in a different checkout are not automatically present.
- Hooks run synchronously without a TTY. Return after bounded provisioning or
  cleanup; do not leave a foreground development server waiting indefinitely.
- The normal container environment is available, augmented with the variables
  below. The runner does not source the project's `.env` or inherit variables
  exported only in an agent's separate interactive shell.

| Variable | Contract |
| --- | --- |
| `WT_PATH` | Absolute worktree path **inside the sandbox**, also the hook CWD. |
| `WT_BRANCH` | Branch supplied to the lifecycle operation. |
| `WT_SLUG` | Branch lowercased, runs outside `[a-z0-9_]` replaced by `_`, leading/trailing underscores removed, then truncated to 40 characters. This is not a collision-free ID. |
| `WT_ACTION` | Setup: `add`, `reuse`, or `reset`. Teardown: `remove`, `reset`, or the branch cleanup action such as `merge`, `archive`, or `cleanup`. |
| `PROVISION_*` | Optional operator-provided provisioning variables, forwarded through environment rather than positional arguments. Their names and requirements are project-specific. |

Branch operations additionally supply `WT_BASE_BRANCH` and `WT_COMMIT_MESSAGE`;
ordinary worktree add/remove/reset do not. There is no provided main-checkout
variable. If needed, discover it with `git worktree list --porcelain` and handle
its path correctly; do not assume `../..` or a fixed `/workspace` layout.

Provisioning values come from the CarapaBox process environment (highest
priority), provisioner files under `/etc/carapa-box` (project overrides global),
and stack `.env` values as a compatibility fallback. The operator can relocate
the provisioner directory with `CARAPA_BOX_PROVISIONER_ENV_DIR`. Do not copy
provisioning secrets into repository files, logs, or command arguments. Manual
agent-shell execution does not automatically receive this provisioning overlay.

## Execution timing

| Operation | Order |
| --- | --- |
| Fresh worktree add | Create checkout → provision configured shared-file symlinks → setup with `WT_ACTION=add` → synchronize optional nginx preview and write `.preview-url` (see [nginx preview](#per-worktree-nginx-preview-nginx-sidecar-stacks-only)). |
| Reuse of an existing tracked worktree | Re-provision configured symlinks → setup with `WT_ACTION=reuse` → refresh optional preview. |
| Reset of an existing worktree | Teardown with `WT_ACTION=reset` → reset/clean checkout → re-provision symlinks → setup with `WT_ACTION=reset` → refresh optional preview. If reset creates a missing worktree, there is no prior teardown. |
| Removal or branch cleanup | Teardown while worktree files and CWD still exist → remove the worktree. Strict teardown failure blocks removal. |

These are worktree lifecycle hooks, not per-stage entry/exit hooks or stack
`before-start.sh`/`after-stop.sh` hooks. Do not assume teardown runs after every
agent or browser session. Keep preview launcher/session cleanup explicit.
Setup must tolerate reuse and partial previous execution. Teardown must tolerate
already-absent resources and affect only resources owned by this worktree.
Configured shared files may be symlinks: inspect before writing so provisioning
does not accidentally change the main checkout's `.env` or another shared file.
Do not require a newly generated `.preview-url` during setup; it is written later.

## Per-worktree nginx preview (nginx-sidecar stacks only)

This applies only when the project's sandbox stack has an `nginx` sidecar
service. Without one, there is no per-worktree preview: use
`.agent/start-browser.sh` or the project's test launcher instead.

- The operator enables it per stack with `nginx-wt.conf.tmpl` and a writable
  `nginx-wt/` directory mounted at `/etc/nginx/conf.d/wt`. Both are stack files
  the sandbox cannot see. The template's server `root` must match this
  project's repository path; only `__BRANCH__` and `__PORT__` are substituted.
- When enabled, CarapaBox writes `http://nginx:<port>/` (port 8081–8980) to the
  worktree's `.preview-url` and the `sandbox_worktree` response carries
  `preview_port=<port>`; CarapaBoard adds that URL to the task prompt. The main
  checkout has no `.preview-url`; its site is `http://nginx/`.
- `.preview-url` must be gitignored.
- Evidence it works: a `.preview-url` in a Board-created worktree that serves
  that worktree's code (for example a page changed only there). Without that
  evidence, report the preview as unverified operator configuration; do not
  claim it is missing or working.

## Shared resources

A worktree isolates tracked code only. Identify what every worktree shares with
the main checkout and with other worktrees: databases and other services named
in `.env`, packages linked from outside the repository (for example Composer
`path` repositories with `symlink: true`, `npm link`, workspace symlinks), and
uploads or storage that setup links. A shared database is acceptable; do not
add per-worktree databases unless the user asks. Record each shared resource in
a project rule: changes to it take effect for the main checkout and every
running task at once, and edits to a linked package land in that package's own
repository, not in the task's diff or merge.

## Failure and validation

Exit zero on success and nonzero on failure. Output is captured and logged;
setup/teardown need no special stdout or JSON format. Failures are best-effort
by default, so a successful lifecycle tool response alone does not prove setup
succeeded. Operator stack setting `WORKTREE_HOOKS_STRICT=1` (also `true`, `yes`,
or `on`, case-insensitive) makes failures fatal. Do not silently change that
setting. The hook runner itself defines no hook-specific timeout; bound network
operations and readiness waits in project helpers.

Validate shell syntax with `sh -n`. In an authorized disposable checkout, use
the actual lifecycle tool when available. Otherwise emulate the invocation from
that checkout with explicit non-secret coordinates, for example:

```sh
WT_PATH="$PWD" WT_BRANCH=setup-smoke WT_SLUG=setup_smoke WT_ACTION=add \
  sh .agent/worktree-setup.sh
WT_PATH="$PWD" WT_BRANCH=setup-smoke WT_SLUG=setup_smoke WT_ACTION=reuse \
  sh .agent/worktree-setup.sh
WT_PATH="$PWD" WT_BRANCH=setup-smoke WT_SLUG=setup_smoke WT_ACTION=remove \
  sh .agent/worktree-teardown.sh
```

Use coordinates that match the disposable checkout and inspect its hooks before
running them. Supply required provisioning variables only through an authorized
source; if unavailable, report that specific validation prerequisite. Check
observable readiness, repeated setup, and repeated cleanup. Manual execution
validates script behavior, not CarapaBox's symlink, preview, or Git lifecycle.
Do not run destructive worktree reset/removal merely to test documentation.

## Maintainer source pointers

Contract checked against CarapaBox source on 2026-09-07:

- `src/tools/register.ts`: `runWorktreeHook`, `runWorktreeSetup`,
  `runWorktreeTeardown`, `buildProvisionEnv`, `worktreeSlug`,
  `strictWorktreeHooksEnabled`, and `sandbox_worktree` / `sandbox_branch` callers.
- `src/compose/client.ts`: `execInService` (container shell/environment transport).
- `docs/git-worktrees.md`: Worktree Hooks and Provisioning environment.

These are maintainer pointers, not required files in the agent's project.
Additional linked-repository commit/inspect/pre-merge/merge hooks have separate
contracts; do not introduce them for ordinary setup/teardown or infer their
behavior from these two hooks. If runtime evidence contradicts this reference,
report the specific mismatch and check the deployed runner version.
