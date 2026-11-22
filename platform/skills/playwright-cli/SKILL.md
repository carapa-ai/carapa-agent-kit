---
name: playwright-cli
description: Drive a real browser with playwright-cli to test, debug or demo web apps and Board Browser previews. Use for UI checks, smoke/e2e clicks, scripted multi-step flows (one run-code file per scenario), screenshots, login with saved auth, network mocking, tracing, quick recordings, shared browsing and requested external access through CarapaBox routes.
---

# Browser Automation with playwright-cli

When building a web app in CarapaBoard, browser verification and a usable Browser
preview are part of delivery. Read [shared browsing](references/carapa-board.md)
before choosing how to launch it, even for a single HTML file in a fresh folder.
Exercise the main interaction and requested mobile layout; syntax checks alone
do not verify a UI. Leave the app available and tell the user which Browser
session to select. Report a concrete blocker if preview startup fails.

When the user wants a URL to open outside Board, read
[external browser access](references/external-browser-access.md). Discover the
actual CarapaBox route and verify it; a working shared preview alone does not
publish the app. Keep the normal Board preview available while preparing access.

## CarapaBoard sandbox sessions

When Board injects `CARAPA_BROWSER_SESSION_ID`, `CARAPA_BROWSER_RUN_ID`, or
`CARAPA_BROWSER_CONTEXT_FILE`, use bare `playwright-cli` commands and preserve
the injected session, daemon, socket, and registry environment. This applies
with recording disabled too. First inspect `tab-list` and `snapshot` to reuse
the user's current page. Board owns browser cleanup; do not apply the manual
session naming, global cleanup, or installation examples below to its runtime.

Read [CarapaBoard shared browsing](references/carapa-board.md) for collaboration,
persistent sessions, internal URLs, the optional `.agent/start-browser.sh` hook,
and CarapaBoard's own seeded development preview. Recorded stages also leave
video start/stop and finalization to Board.

## Quick start

```bash
# open new browser
playwright-cli open
# navigate to a page
playwright-cli goto https://playwright.dev
# interact with the page using refs from the snapshot
playwright-cli click e15
playwright-cli type "page.click"
playwright-cli press Enter
# take a screenshot (rarely used, as snapshot is more common)
playwright-cli screenshot
# close the browser
playwright-cli close
```

## Gotchas (read once, save a session)

- **Invoke it bare: `playwright-cli <cmd>`.** Prefer a global binary on
  `PATH`. Do **not** prefix it with this skill's `scripts/` directory; that
  directory contains optional workflow helpers, not the CLI. If unsure it
  exists, use `command -v playwright-cli`;
  **`which` is often not installed** in these shells. `npx playwright-cli`
  is a slow last resort (see Installation), not the default.
- **Output files are written relative to the current working directory.**
  `snapshot`, `screenshot`, `pdf`, `eval --filename`, `run-code --filename`
  save under `./.playwright-cli/…` of **wherever the shell's CWD is** (e.g. a
  git worktree root). Read them back from that CWD-relative path — not from a
  hardcoded absolute guess, or you get "File does not exist". Board's persistent
  wrapper pins its working directory to `CARAPA_BROWSER_WORK_DIR`; in that
  context use the CLI-reported evidence path relative to that checkout.
- **`--filename` is only for output commands** (`screenshot`, `pdf`,
  `snapshot`, `eval`, `run-code`). Interaction commands (`click`, `goto`,
  `type`, `fill`, `select`) reject it.
- **Snapshot `.yml` files are large (5–20 KB).** Prefer a scoped
  `playwright-cli snapshot "<css>"`; if you must inspect a saved snapshot,
  `grep -n` it — do not read the whole file into a limited context window.

## Scripted flows

For more than 2-3 interactions, write the scenario as one self-contained
`run-code` callback (`playwright-cli run-code --filename=flow.js`) instead of one
CLI call per click, and keep reusable flows as files. Inside it, use
`page.request` for API and state checks and keep the assertions in the same
process. Synchronize on explicit barriers: await the exact response, and arm a
waiter before the action that triggers it; never sleeps or CLI latency. See
`references/running-code.md`.

`run-code` does not run in plain Node or in the page: `URL`, `setTimeout`,
`process`, `require`, `Buffer` and DOM globals are often not defined, and
`page.request` needs an absolute URL. Use `page.waitForTimeout`, build URLs from
`page.url()` or a value interpolated by the shell, and keep one
`async page => {...}` per file without a trailing `;` or `export`. Details in
`references/running-code.md#execution-context`.

## Commands

### Core

```bash
playwright-cli open
# open and navigate right away
playwright-cli open https://example.com/
playwright-cli goto https://playwright.dev
playwright-cli type "search query"
playwright-cli click e3
playwright-cli dblclick e7
# --submit presses Enter after filling the element
playwright-cli fill e5 "user@example.com"  --submit
playwright-cli drag e2 e8
playwright-cli hover e4
playwright-cli select e9 "option-value"
playwright-cli upload ./document.pdf
playwright-cli check e12
playwright-cli uncheck e12
playwright-cli snapshot
playwright-cli eval "document.title"
playwright-cli eval "el => el.textContent" e5
# get element id, class, or any attribute not visible in the snapshot
playwright-cli eval "el => el.id" e5
playwright-cli eval "el => el.getAttribute('data-testid')" e5
playwright-cli dialog-accept
playwright-cli dialog-accept "confirmation text"
playwright-cli dialog-dismiss
playwright-cli resize 1920 1080
playwright-cli close
```

### Navigation

```bash
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### Keyboard

```bash
playwright-cli press Enter
playwright-cli press ArrowDown
playwright-cli keydown Shift
playwright-cli keyup Shift
```

### Mouse

```bash
playwright-cli mousemove 150 300
playwright-cli mousedown
playwright-cli mousedown right
playwright-cli mouseup
playwright-cli mouseup right
playwright-cli mousewheel 0 100
```

### Save as

```bash
playwright-cli screenshot
playwright-cli screenshot e5
playwright-cli screenshot --filename=page.png
playwright-cli pdf --filename=page.pdf
```

### Tabs

```bash
playwright-cli tab-list
playwright-cli tab-new
playwright-cli tab-new https://example.com/page
playwright-cli tab-close
playwright-cli tab-close 2
playwright-cli tab-select 0
```

### Storage

```bash
playwright-cli state-save
playwright-cli state-save auth.json
playwright-cli state-load auth.json

# Cookies
playwright-cli cookie-list
playwright-cli cookie-list --domain=example.com
playwright-cli cookie-get session_id
playwright-cli cookie-set session_id abc123
playwright-cli cookie-set session_id abc123 --domain=example.com --httpOnly --secure
playwright-cli cookie-delete session_id
playwright-cli cookie-clear

# LocalStorage
playwright-cli localstorage-list
playwright-cli localstorage-get theme
playwright-cli localstorage-set theme dark
playwright-cli localstorage-delete theme
playwright-cli localstorage-clear

# SessionStorage
playwright-cli sessionstorage-list
playwright-cli sessionstorage-get step
playwright-cli sessionstorage-set step 3
playwright-cli sessionstorage-delete step
playwright-cli sessionstorage-clear
```

### Network

```bash
playwright-cli route "**/*.jpg" --status=404
playwright-cli route "https://api.example.com/**" --body='{"mock": true}'
playwright-cli route-list
playwright-cli unroute "**/*.jpg"
playwright-cli unroute
```

### DevTools

```bash
playwright-cli console
playwright-cli console warning
playwright-cli network
playwright-cli run-code "async page => await page.context().grantPermissions(['geolocation'])"
playwright-cli run-code --filename=script.js
playwright-cli tracing-start
playwright-cli tracing-stop
playwright-cli video-start video.webm
playwright-cli video-chapter "Chapter Title" --description="Details" --duration=2000
playwright-cli video-stop
```

## Open parameters
```bash
# Use specific browser when creating session
playwright-cli open --browser=chrome
playwright-cli open --browser=firefox
playwright-cli open --browser=webkit
playwright-cli open --browser=msedge
# Connect to browser via extension
playwright-cli open --extension

# Use persistent profile (by default profile is in-memory)
playwright-cli open --persistent
# Use persistent profile with custom directory
playwright-cli open --profile=/path/to/profile

# Start with config file
playwright-cli open --config=my-config.json

# Close the browser
playwright-cli close
# Delete user data for the default session
playwright-cli delete-data
```

## Snapshots

After each command, playwright-cli provides a snapshot of the current browser state.

```bash
> playwright-cli goto https://example.com
### Page
- Page URL: https://example.com/
- Page Title: Example Domain
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

You can also take a snapshot on demand using `playwright-cli snapshot` command. All the options below can be combined as needed.

```bash
# default - save to a file with timestamp-based name
playwright-cli snapshot

# save to file, use when snapshot is a part of the workflow result
playwright-cli snapshot --filename=after-click.yaml

# snapshot an element instead of the whole page
playwright-cli snapshot "#main"

# limit snapshot depth for efficiency, take a partial snapshot afterwards
playwright-cli snapshot --depth=4
playwright-cli snapshot e34
```

## Targeting elements

By default, use refs from the snapshot to interact with page elements.

```bash
# get snapshot with refs
playwright-cli snapshot

# interact using a ref
playwright-cli click e15
```

You can also use css selectors or Playwright locators.

```bash
# css selector
playwright-cli click "#main > button.submit"

# role locator
playwright-cli click "getByRole('button', { name: 'Submit' })"

# test id
playwright-cli click "getByTestId('submit-button')"
```

## Browser Sessions

These named-session and cleanup examples are for unmanaged CLI use. In Board,
keep the injected session and use `tab-new` for another page in that browser.

```bash
# create new browser session named "mysession" with persistent profile
playwright-cli -s=mysession open example.com --persistent
# same with manually specified profile directory (use when requested explicitly)
playwright-cli -s=mysession open example.com --profile=/path/to/profile
playwright-cli -s=mysession click e6
playwright-cli -s=mysession close  # stop a named browser
playwright-cli -s=mysession delete-data  # delete user data for persistent session

playwright-cli list
# Close all browsers
playwright-cli close-all
# Forcefully kill all browser processes
playwright-cli kill-all
```

## Installation

Inside a managed CarapaBoard sandbox, retain the supplied wrapper and matched
Playwright runtime. Report a missing or incompatible CLI for stack repair;
installing a different backend can break the embedded viewer.

If global `playwright-cli` command is not available, try a local version via `npx playwright-cli`:

```bash
npx --no-install playwright-cli --version
```

When local version is available, use `npx playwright-cli` in all commands. Otherwise, install `playwright-cli` as a global command:

```bash
npm install -g @playwright/cli@latest
```

## Record a browser workflow

When `CARAPA_RECORD=1`, Board already owns capture and finalization. Use ordinary
navigation and interaction commands; skip this helper and manual start/stop.

Use the bundled helper when a task needs a video recording. Pass the URL
explicitly; the optional output directory defaults to a timestamped directory
under `.playwright-cli/recordings/`.

```bash
~/.agent/skills/playwright-cli/scripts/begin.sh https://example.com
~/.agent/skills/playwright-cli/scripts/begin.sh https://example.com ./artifacts/demo

# Perform interactions, then stop and close the browser.
playwright-cli video-stop
playwright-cli close
```

## Example: Form submission

```bash
playwright-cli open https://example.com/form
playwright-cli snapshot

playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "<password>"
playwright-cli click e3
playwright-cli snapshot
playwright-cli close
```

## Example: Multi-tab workflow

```bash
playwright-cli open https://example.com
playwright-cli tab-new https://example.com/other
playwright-cli tab-list
playwright-cli tab-select 0
playwright-cli snapshot
playwright-cli close
```

## Example: Debugging with DevTools

```bash
playwright-cli open https://example.com
playwright-cli click e4
playwright-cli fill e7 "test"
playwright-cli console
playwright-cli network
playwright-cli close
```

```bash
playwright-cli open https://example.com
playwright-cli tracing-start
playwright-cli click e4
playwright-cli fill e7 "test"
playwright-cli tracing-stop
playwright-cli close
```

## Specific tasks

* **Running and Debugging Playwright tests** [references/playwright-tests.md](references/playwright-tests.md)
* **Request mocking** [references/request-mocking.md](references/request-mocking.md)
* **Running Playwright code** [references/running-code.md](references/running-code.md)
* **Browser session management** [references/session-management.md](references/session-management.md)
* **Storage state (cookies, localStorage)** [references/storage-state.md](references/storage-state.md)
* **Test generation** [references/test-generation.md](references/test-generation.md)
* **Tracing** [references/tracing.md](references/tracing.md)
* **Video recording** [references/video-recording.md](references/video-recording.md)
* **Inspecting element attributes** [references/element-attributes.md](references/element-attributes.md)
