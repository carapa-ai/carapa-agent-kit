# External browser access through CarapaBox

Use this workflow when the user asks to open an app outside Board's shared
Browser, on another device, or through a port or subdomain. It applies to any
browser-facing app. A request to build an app alone uses the Board preview;
external publication follows the user's requested network and hostname scope.

## Publish through Board

Discover the available tools. For a Board-managed project, use `get_published_app`
to inspect its existing publication. When the user requests external access, start
the app on a fixed nonprivileged port and call `publish_app` with
`enabled: true`, `targetPort`, and an optional `hostname` (a hostname, not a URL).
Board selects the project's sandbox and service; do not supply container IDs,
IPs, or controller credentials. Shared-sandbox publishing requires permission on
the owning project as well as the child. The same controls are in **Project
Settings → Sandbox → External app access** and apply immediately. The selected
project’s published link also appears in the sidebar’s sandbox panel.

Use the returned `url`. If Box's nginx integration is configured, Box generates
an HTTPS hostname or uses the requested hostname; otherwise it returns the
configured ingress host and a reserved HTTP port. `ready` means the ingress
proxy acknowledged the route, not that the app, DNS, or certificate works.
Call `publish_app` with `enabled: false` to revoke access. A failed request can
leave saved publication intent; inspect it and retry disabling when cleanup is
needed. Disable before changing the project's sandbox identity.

For authorized direct controller operation, `sandbox_publish_app` accepts
`name`, `instance`, a stable `id`, and `action` (`publish`, `status`, `unpublish`).
Publishing also takes `service`, `targetPort`, and an optional `hostname`.
It uses the existing isolated ingress proxy, including on an agent-only stack;
it does not require a project nginx container or edit source Compose ports.
Ports are 1024–65535 excluding the managed SSH port 2222. Existing static routes
cannot be repurposed as app publications. `sandbox_ps` still reports ordinary
stack routes; use publication status for the app's exact URL.

If these tools are unavailable, prepare the app and report that Board/Box needs
an upgrade or operator configuration. Never invent a tool, request controller
credentials, or call Docker from the agent. Keep the Board preview available.

An ingress address may be LAN-only or restricted to the external nginx proxy.
Publication does not establish internet or phone access. Never derive a public
URL from a container IP, guessed domain, or the app's internal port.

## Prepare the app for the approved endpoint

Reuse the project's launcher and the approved stack's routing contract. If an
nginx service already serves the app's public directory, use that configured
document root. If nginx proxies to an app server, use its configured upstream.
If ingress or nginx connects from another container, the app must listen on
the reachable container interface (typically `0.0.0.0`) at the declared target
port. Binding only to `127.0.0.1` does not work across containers. Binding to
`0.0.0.0` by itself does not publish a port.

The bundled static Board preview hook intentionally uses a dynamic loopback
port. Do not advertise that as a stable external endpoint. Use an existing
service launcher or adapt the app launcher to the approved fixed upstream,
preserving ownership and cleanup. Explain if closing the Board browser stops
the hook-owned app; durable hosting needs a lifecycle independent of that preview.
A background child launched with `nohup ... &` can still be cleaned up by the
agent harness. A foreground command kept open by a tool can also end when the
turn finishes; neither proves that hosting lasts as long as the sandbox. Reuse
the project's `.agent/after-start.sh` for apps that should start with the sandbox, as
described below. Check the endpoint from a subsequent tool call after the startup
call has returned. Leave a reusable startup command and state its actual lifetime.

If `playwright-cli tab-list` reports that the injected browser is not open,
use bare `playwright-cli open <url>` in that same managed session, then inspect
and interact. Do not keep issuing `tab-new` or `snapshot` against a closed browser.

Check the app's allowed hosts, public/base URL, asset paths, API URLs, redirects
and WebSocket connections against the chosen external origin. Keep existing
authentication and configure exact required origins/hosts rather than disabling
those checks. Serve the app's intended public content, not the repository root.

## Start apps with the sandbox

Create or update `.agent/after-start.sh` in the sandbox service's configured
project checkout. CarapaBox automatically discovers it after `sandbox_start`,
including Board-managed restarts, and runs it inside the selected service after
controller setup. It uses `sh`, no arguments, the service's working directory,
configured user, and existing container environment. It does not receive
controller secrets or worktree provisioning variables. Missing hooks are skipped.

For an existing Bash launcher, the project hook can be:

```sh
#!/bin/sh
exec bash scripts/start-external.sh
```

- Reuse the project's launcher. The hook is repository-owned, like
  `.agent/worktree-setup.sh`; no controller stack edit or Docker access is needed.
  In a shared sandbox, only the service's configured checkout is inspected. Its
  hook can launch intended child apps; child repos and worktrees are not scanned.
- Start the app independently of the agent turn and browser session, with a
  stable port, logs, and a stop command. Make repeated startup safe: reuse an
  already healthy app rather than creating duplicate processes. The hook must
  finish within CarapaBox's 120-second timeout; do not leave the foreground app
  attached to the hook's output pipes. Return failure when readiness fails.
  A present hook failure makes `sandbox_start` report an error; the sandbox
  remains running for diagnosis. Inspect the hook output and app logs.
- The sandbox image needs `sh` and `timeout` (GNU coreutils or BusyBox). If the
  controller predates project-hook support, report that it needs an upgrade.
  Do not substitute a controller-owned `stacks/<stack>/after-start.sh` or claim
  a project hook works without verifying the managed startup path.
- Verify app readiness after a CarapaBox-managed start/restart when within the
  authorized scope, then verify the published URL separately. A saved ingress
  route does not start the app. Record any restart verification still pending.

This hook covers CarapaBox-managed starts/restarts. It does not run on automatic
Docker restarts or host reboots, and does not restart a crashed app by itself.
State that scope when handing off; keep any existing stack service manager.

## Hostnames and operator prerequisites

Box's isolated ingress proxy must be configured and the sandbox migrated to it.
HTTPS additionally needs Box's nginx integration, DNS, and certificate coverage.
The publication tools configure routing; they do not provision DNS, certificates,
external tunnels, client allowlists, or app authentication. The app is accessible
to clients allowed by the configured network policy, independently of Board login.

For an existing primary stack nginx route, `sandbox_proxy_aliases` and Board's
**Proxy Hostname Aliases** setting still add names to that existing route. They
do not select an app backend; use app publishing for a new service port.

If infrastructure is missing, provide the operator with the controller,
stack/instance, app service, bind address, target port, startup/readiness command,
desired hostname and intended client network. Keep stack/network changes inside
the operator/CarapaBox boundary; do not edit generated routes or ingress state,
add ad hoc tunnels, or broaden source allowlists to bypass a failed connection.

## Verify and hand off

Verify the external URL from an authorized client on the intended network:
DNS resolution, trusted TLS when using HTTPS, the actual app page, and a main
interaction including relevant API/assets/WebSockets. An HTTP 200 from a default
nginx page is insufficient. Sandbox agent networks are deliberately denied by
ingress before its client allowlist; a failed external probe from inside the
sandbox does not by itself show that the user's route is broken. Report external
access as unverified if no suitable client is available.

Give the exact verified URL, network scope (such as LAN), required login and app
lifetime. An external browser has its own cookies, storage and page state. It
does not share the agent's live Board tab; collaboration across separate
browsers requires support from the app itself.
