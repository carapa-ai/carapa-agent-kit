# Playwright UI Testing Setup

## Eligibility

Offer this setup when the project has a browser-facing UI, a local preview can
be started in the sandbox, and `command -v playwright-cli` or a project-local
Playwright CLI succeeds. Do not enable recording merely because Playwright is a
dependency.

## Reuse before creating

Prefer existing deterministic launchers, fixtures, seeders, login helpers,
Playwright configuration, and worktree hooks. Extend the established workflow
instead of creating a second preview stack.

When new infrastructure is needed, provide stable agent-facing commands for:

- worktree setup and teardown;
- starting the preview or disposable UI sandbox and waiting for readiness;
- seeding sanitized test data;
- preparing or documenting authentication;
- running bounded smoke tests with `PLAYWRIGHT_HTML_OPEN=never`;
- stopping the launcher and deleting disposable state.

Use `.agent/worktree-setup.sh` and `.agent/worktree-teardown.sh` for worktree
lifecycle, following [worktree-hooks.md](worktree-hooks.md). The runner calls
`sh` with no positional arguments, from the worktree root, and supplies `WT_*`
variables. Setup also runs on reuse/reset; teardown belongs to worktree removal
or reset, not each browser session. For package-based apps, expose concise
package scripts backed by small scripts when lifecycle logic is too complex
for one command.

## On-demand Browser preview

The right-pane Browser viewer uses the sandbox's own browser and networking.
An app on sandbox localhost needs no nginx service, public port, or iframe
header changes. Support both the default checkout and prepared worktrees.

When a preview service is not already available, add `.agent/start-browser.sh`
using the existing launcher. This is a separate hook from worktree setup:

- Board's Start browser helper invokes it with Bash, no positional arguments,
  from the selected checkout. It inherits that context's Playwright environment.
- Start the app in the foreground. Once ready, atomically publish its HTTP/HTTPS
  URL to the supplied `CARAPA_BROWSER_URL_FILE` within 60 seconds. Dynamic
  loopback ports are supported; do not guess or hardcode a test run's old port.
- Keep the hook alive while its app is available; handle SIGTERM to stop owned
  services and clean disposable data. Do not invoke worktree teardown here.
- Repeated Start reuses it. Viewer detach and conversation completion preserve
  it; explicit Close/Restart and sandbox shutdown release its owned processes.
- Automatic navigation prefers an explicit URL, then checkout `.preview-url`,
  then this hook, then `http://nginx/`. Keep existing working nginx previews.
  Only stacks with an nginx sidecar can give each worktree its own
  `.preview-url`; see [worktree-hooks.md](worktree-hooks.md#per-worktree-nginx-preview-nginx-sidecar-stacks-only).

Document the user flow: select Default branch or a prepared conversation
worktree in Browser, leave the URL empty, and click Start browser. Publish any
required login guidance with the launcher. CarapaBoard's own hook reuses its
seeded UI sandbox, chooses loopback ports, and signs in before publishing its
URL. Reuse an existing shared preview when testing; stop only test-owned apps.

## Authentication

- Prefer a deterministic disposable local user and real application login.
- Never hardcode production credentials, tokens, device keys, or storage state.
- Put optional credentials in documented environment variables.
- Document the exact login URL, fixture/seeder command, identity source, and any
  MFA, device-registration, biometric/signature, or callback step.
- A cookie alone may not satisfy systems that require a registered device or
  signed request; exercise the real local authorization path when relevant.
- Save storage state only for a disposable local environment and only under a
  gitignored `.playwright-cli/` path.

## Sessions and evidence

- First detect Board's injected `CARAPA_BROWSER_SESSION_ID`,
  `CARAPA_BROWSER_RUN_ID`, or `CARAPA_BROWSER_CONTEXT_FILE`. In managed runs,
  invoke bare `playwright-cli`, preserve the supplied session and discovery
  directories, and leave browser cleanup to Board, including unrecorded runs.
  Reuse the current page or add tabs; tabs share cookies and storage.
- Recorded stages (`CARAPA_RECORD=1`) also leave capture start/stop and
  finalization to Board. Keep the existing recording behavior when upgrading
  older runtimes that supply recording context without browser markers.
- Outside Board-managed runs, use a semantic named session and include a
  worktree/run discriminator when concurrent checkouts can run together. Close
  that exact session during cleanup.
- Invoke `playwright-cli` directly when global; use the verified project-local
  command only as fallback.
- Output paths are relative to the CLI working directory. Persistent Board
  sessions pin that directory to `CARAPA_BROWSER_WORK_DIR`; use reported paths.
- Keep snapshots, traces, console/network captures, video, and storage state in
  `.playwright-cli/` or another ignored disposable path.
- Treat output containing `### Error` as failure even if exit status is zero.
- Prefer scoped snapshots and stable role/test-id locators.

## Lifecycle

1. For a worktree, confirm provisioning is ready. If setup has not run or needs
   repair, invoke it using the documented hook environment. Use the documented
   seed step for a fresh preview.
2. Reuse a shared preview if already available; otherwise start the documented
   launcher in a terminal/session that remains open.
3. Wait for an explicit readiness/health check.
4. Open Playwright and complete the documented login. Use the board-provided
   session in a managed run; otherwise open the documented named session.
5. Exercise the smallest meaningful workflow; inspect console and network output.
6. Save only evidence needed for the task.
7. Outside a managed run, close the owned named browser session. Leave managed
   browser cleanup and recording finalization to Board.
8. Stop only a test-owned launcher through its supported signal/command and wait
   for clean exit. Leave a shared hook-owned app available for collaboration.
9. Clean test-owned disposable UI state and confirm no owned preview process,
   temporary UI root, credential, or tracked browser artifact remains. Invoke worktree teardown
   manually only when retiring an owned disposable checkout; an active task
   worktree may still need its provisioned resources for later stages.

Closing the browser is not a substitute for stopping the application launcher.
Do not excuse a teardown error because browser assertions passed.

## Reflected UI rule

Create or update a focused model-decision rule containing actual commands,
URLs, readiness checks, login steps, the shared Browser/startup hook and managed
session behavior versus ordinary session naming, evidence paths, cleanup, and
limitations. Describe local sandbox verification accurately; never claim it tested
production, real container orchestration, credentials, or integrations that
were not exercised.
