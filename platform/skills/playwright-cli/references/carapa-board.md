# Shared browsing in CarapaBoard

Board's right-pane **Browser** tab streams the actual sandbox browser. The user
can navigate, type, click, and change tabs in the same session as the agent.
It works with internal URLs such as `http://nginx:8082/` and
`http://127.0.0.1:3000/`; the app needs no public port, DNS entry, or iframe header
changes. The user's host DevTools inspect the viewer, so use Playwright for
the app's DOM, console, and network inspection.

## Reuse the assigned session

Board injects `CARAPA_BROWSER_SESSION_ID` for a persistent context,
`CARAPA_BROWSER_RUN_ID` for a run, and sometimes `CARAPA_BROWSER_CONTEXT_FILE`
for a reused daemon. The canonical `playwright-cli` wrapper resolves the active
context on every command. Preserve these variables and the supplied Playwright
session, daemon, socket, and registry paths. Do not replace them, add `-s` or
`--session`, invoke the underlying package directly, or attach to another
project's registry.

Start by inspecting the page the user may already be working on:

```sh
playwright-cli tab-list
playwright-cli snapshot
playwright-cli eval '() => location.href'
```

Use `goto` to navigate, `tab-new <url>` for an additional page, and `tab-select`
to switch. A persistent context reuses its browser on `open`; opening with a URL
navigates the current tab. Tabs share cookies and storage. Separate conversation
contexts and the project's default context have separate browsers and sessions;
changing the Board dropdown selects which context the user views, not which
session an existing agent controls.

User input does not pause automation. Refresh the snapshot after user changes
before acting on element refs. Keep the browser available for collaboration:
viewer disconnect and conversation turn completion do not close a persistent
browser. Board's explicit Close/Restart controls own that lifecycle. Task-run
browsers are cleaned up after the run and any recording finalization.

Live viewing does not require recording. When the stage sets `CARAPA_RECORD=1`,
the wrapper starts capture and Board finalizes it. Do not call `video-start`,
`video-stop`, `close`, or global cleanup to finish that recording. Treat CLI
output containing `### Error` as failure even if the exit code is zero.

## Find or start the project app

Use the current tab's URL, the checkout's `.preview-url`, or the documented
launcher readiness output. Test servers often choose dynamic loopback ports
and stop during test teardown; an old test URL may no longer serve an app.

The user can select **Default branch**, leave the URL empty, and click **Start
browser**, without starting an agent run. A prepared conversation worktree can
use the same control. Automatic URL selection prefers an explicit URL, then
`.preview-url`, then the optional project hook, then `http://nginx/`.

Projects without an existing preview service can provide
`.agent/start-browser.sh`. Board's helper runs this fixed hook with Bash from the
selected checkout and supplies `CARAPA_BROWSER_URL_FILE`. The hook starts the
app in the foreground, waits for readiness, and atomically writes its HTTP/HTTPS
URL to that file within 60 seconds. It handles SIGTERM for cleanup and keeps
running while its app is available. Reuse the project's established launcher,
seed data, and login flow. Worktree setup prepares the checkout; this hook
starts its preview on demand, including on the default branch.

Repeated Start reuses the hook, or recovers it after an app failure. Viewer
detach and conversation completion preserve the app; explicit Close/Restart
and sandbox shutdown release it. Do not launch the hook directly without its
Board-supplied environment or stop an existing shared app during test cleanup.

## Deliver a new app from an empty workspace

No Git history, nginx configuration, or published port is required. Inspect the
actual checkout and existing preview first. Put `.agent/start-browser.sh` at the
selected checkout root, even when the app lives in a subdirectory. For a plain
HTML/CSS/JS app, copy [the static preview hook](../assets/start-static-browser.sh)
there and change its `web_root` to the app's public directory. The hook requires
Python 3, serves the selected directory, chooses a free loopback port, and
publishes it after the server binds. For a
framework or full-stack app, adapt its established launcher to the hook
contract instead. Start the services the UI needs, wait for their readiness,
and publish the frontend URL only when the user workflow is usable. Keep
required service processes under the hook's lifecycle and document any local
sign-in or initial data needed. Reuse existing configuration and keep credentials
out of generated files and user-facing URLs.
Avoid serving the whole checkout or agent home. Keep ephemeral URLs out of
version control; a stale `.preview-url` takes precedence over the hook.

In a persistent conversation, start the configured preview yourself:

```sh
browser-open "$CARAPA_BROWSER_SESSION_ID" start
playwright-cli tab-list
playwright-cli snapshot
```

Invoke this from the selected checkout root; do not substitute another context
ID. The helper supervises the hook so the app survives your turn. An existing
browser keeps its current page unless the app had to start or recover; inspect
its actual URL before navigating. `playwright-cli open <url>` alone does not
start the app or invoke the hook. Task-only contexts have no persistent session
ID: use the project's test launcher for that run and leave a working hook for
the user's **Default branch** or prepared conversation checkout. Task browsers
end with the run; do not promise they remain available.

Verify the principal interaction, console errors, and the requested viewport
sizes in the assigned Playwright session. Leave a usable page open after tests.
Tell the user: “Open this conversation's **Browser** tab and select its
**Shared with agent** session.” For an idle preview, include **Start browser**
with the URL field empty. Distinguish opening the sandbox browser from selecting
the user's Board pane; do not claim to have changed their pane automatically.
Never hand off a host-IP placeholder or present a sandbox loopback address as
a link the user's phone can reach. A separately published app URL requires an
actual configured ingress route. For a requested URL to open in another browser,
follow [external browser access](external-browser-access.md).

## Demonstrations and collaboration

Use the conversation's persistent browser for a requested demonstration. Inspect
the existing tabs and state, perform the requested actions with Playwright, and
leave the result visible. Do not reset the app or replace a user's tab just to
replay setup.

For interactive collaboration, agree which actions belong to the user and
which belong to the agent. Inspect the current state before each action,
refresh after user input, and use the app's real UI rather than rewriting its
internal state. Preserve the same tab between chat turns and avoid taking over
the user's actions. Use this for guided workflows, shared editing, or turn-based
interaction without adding app-specific rules to the runtime.

Browser clicks do not themselves send a new chat message or wake an idle agent.
For ordinary chat, ask the user to send a message when ready for the next agent
action; then inspect the page and respond. If actively waiting for input, use a
bounded observable state wait. Do not promise continuous interaction after the
agent turn has ended.

## Working on CarapaBoard itself

CarapaBoard's `.agent/start-browser.sh` reuses `scripts/ui-sandbox/start.ts`.
It starts the real UI and backend with disposable seeded data and simulated
integrations, chooses free loopback ports, signs in through the real login and
device-approval flow, and publishes the ready URL. This is a development preview.

Reuse it if the user already started it. For a separate test-owned preview, the
repository's `npm run ui:sandbox` prints its URL and exact browser command. In a
managed run that command retains the shared Board session. Read the checkout's
`scripts/ui-sandbox/README.md` and applicable UI-testing rule for fixtures,
verification, and cleanup. Stop only the launcher and temporary data your test
owns; keep Board's persistent browser and hook-owned preview available.
