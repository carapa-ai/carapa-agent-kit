---
name: generate-dashboard
description: Customize the objective dashboard, which regenerates after every run. Edit .agent/scripts/gen-dashboard.ts for static sections (progress, timeline, events, run stats, charts) or dashboard/app.ts for API routes and server-rendered pages. Use to add a metric, section or chart, or when the dashboard looks wrong or stale. Never hand-write index.html.
---

# Generate Dashboard

Dashboards are generated **automatically** — you don't write HTML directly. Instead, you customize the per-objective script that produces it, and optionally the Hono server that serves it.

## How Dashboards Work

After every agent run, `processor.ts` regenerates the dashboard by running:

```
bun .agent/scripts/gen-dashboard.ts <objectivePath>
```

The default script does two things:

1. **Calls `generateDashboard()`** from `/app/src/dashboard.ts` to regenerate `dashboard/index.html` (static HTML).
2. **Writes `dashboard/app.ts`** — a self-contained Hono server — but only on the first run. Subsequent runs never overwrite `app.ts`, preserving any customisations you make.

**To customize the static HTML, edit `.agent/scripts/gen-dashboard.ts` inside your objective folder — no code deploy needed.** The processor picks up your changes on the next run.

**To add dynamic routes or server-rendered pages, edit `dashboard/app.ts`.**

If the script exits with a non-zero code, the processor falls back to the built-in generator automatically, so a broken script won't leave the dashboard permanently broken.

## Two-Layer Architecture

Dashboards use a two-layer system:

```
Layer 1 — Static HTML        dashboard/index.html   (written by gen-dashboard.ts)
Layer 2 — Dynamic server     dashboard/app.ts        (Hono server, write-once then yours)
```

The board accesses the dashboard through a double-proxy chain:

```
CarapaBoard  →  Brain API  →  Hono app (dashboard/app.ts)
```

The Brain API receives the dashboard request and proxies it to the per-objective Hono server. The Hono server's default `GET /` route reads and serves `dashboard/index.html` on every request, so static HTML regenerations take effect immediately without restarting the server.

## Default Hono Routes

The default `dashboard/app.ts` exposes:

| Route | Description |
|-------|-------------|
| `GET /` | Serves `dashboard/index.html` (re-read on every request) |
| `GET /logs` | Returns `events.jsonl` as a JSON array |
| `GET /runs` | Returns `run-stats.jsonl` as a JSON array |
| `GET /transcripts/:runId` | Returns `reports/{runId}.json` |
| `GET /assets/*` | Serves files from `assets/` |
| `GET /*.{css,js,json,svg,png,jpg,ico}` | Serves static files from `dashboard/` |

## Available Template Renderers

All importable from `/app/src/templates/`:

| Renderer | Import | Description |
|----------|--------|-------------|
| `renderPage` | `/app/src/templates/page.ts` | Wraps sections into a complete self-contained HTML page |
| `renderHeader` | `/app/src/templates/header.ts` | Objective title, status badge, last assessed timestamp |
| `renderProgress` | `/app/src/templates/progress.ts` | Progress bar, trend pill, metrics grid |
| `renderTimeline` | `/app/src/templates/timeline.ts` | Milestone timeline with deadline |
| `renderEvents` | `/app/src/templates/events.ts` | Recent events list with transcript popup |
| `renderAssessment` | `/app/src/templates/assessment.ts` | Latest assessment report |
| `renderCheckin` | `/app/src/templates/checkin.ts` | Next scheduled check-in |
| `renderRunStats` | `/app/src/templates/run-stats.ts` | Cost and token usage per run |
| `renderEvalsChart` | `/app/src/templates/evals-chart.ts` | Run-activity card from `evals.jsonl`: runs that changed nothing, per trigger type. An activity check, not a quality score |
| `renderMemoryImpact` | `/app/src/templates/memory-impact.ts` | Memory impact analysis table (opt-in, not in default layout) |

Also available: `generateDashboard()` from `/app/src/dashboard.ts` — an all-in-one function that reads all data files and calls every renderer in the default order.

## Customization Examples

### Example A: Add a custom section after the assessment

Use `generateDashboard()` for everything, then inject a custom block into the generated HTML:

```typescript
import path from 'path';
import { readFile, writeFile, rename } from 'fs/promises';
import { generateDashboard } from '/app/src/dashboard.ts';

const objectivePath = path.resolve(process.argv[2] ?? process.cwd());
const projectId = path.basename(path.dirname(path.dirname(objectivePath)));
const objectiveId = path.basename(objectivePath);

// Run the standard generator first
await generateDashboard({ objectivePath, projectId, objectiveId });

// Read the generated HTML
const htmlPath = path.join(objectivePath, 'dashboard', 'index.html');
let html = await readFile(htmlPath, 'utf8');

// Build a custom section
const customSection = `
  <div class="card" style="margin-top:1rem">
    <h2>Custom Notes</h2>
    <p style="color:var(--text-muted)">Add whatever you need here.</p>
  </div>`;

// Inject before the closing </body> and write atomically
html = html.replace('</body>', `${customSection}\n</body>`);
const tmp = htmlPath + '.tmp';
await writeFile(tmp, html, 'utf8');
await rename(tmp, htmlPath);
```

### Example B: Compose a custom layout from individual renderers

Skip `generateDashboard()` and assemble the page yourself:

```typescript
import path from 'path';
import { readFile, writeFile, rename, mkdir, readdir } from 'fs/promises';
import { renderPage } from '/app/src/templates/page.ts';
import { renderHeader } from '/app/src/templates/header.ts';
import { renderProgress } from '/app/src/templates/progress.ts';
import { renderAssessment } from '/app/src/templates/assessment.ts';
import { renderRunStats } from '/app/src/templates/run-stats.ts';

const objectivePath = path.resolve(process.argv[2] ?? process.cwd());

// Read state
const state = JSON.parse(
  await readFile(path.join(objectivePath, 'state.json'), 'utf8')
);

// Read latest report (if any)
const reportsDir = path.join(objectivePath, 'reports');
const reportFiles = (await readdir(reportsDir).catch(() => [])).sort().reverse();
const latestReport = reportFiles[0]
  ? await readFile(path.join(reportsDir, reportFiles[0]), 'utf8')
  : '';

// Compose only the sections you want, in the order you want
const sections = [
  renderHeader({ state }),
  renderProgress({ state }),
  renderAssessment({ report: latestReport }),
  // Omit timeline, events, checkin — or add them; your choice
  renderRunStats({ objectivePath }),
].join('\n');

// Wrap in the full page shell and write atomically
const html = renderPage({ title: state.title ?? 'Dashboard', body: sections });
const outDir = path.join(objectivePath, 'dashboard');
await mkdir(outDir, { recursive: true });
const tmp = path.join(outDir, 'index.html.tmp');
await writeFile(tmp, html, 'utf8');
await rename(tmp, path.join(outDir, 'index.html'));
```

### Example C: Add custom API routes to app.ts

Edit `dashboard/app.ts` to add objective-specific endpoints. The Hono app is already running — just add routes:

```typescript
// In dashboard/app.ts, after the existing routes:

// ── Custom: latest state endpoint ────────────────────────────────────────────
app.get('/state', async (c) => {
  try {
    const raw = await readFile(join(OBJ_DIR, 'state.json'), 'utf-8');
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ error: 'State not found' }, 404);
  }
});

// ── Custom: evals data ───────────────────────────────────────────────────────
app.get('/evals', async (c) => {
  try {
    const raw = await readFile(join(OBJ_DIR, 'evals.jsonl'), 'utf-8');
    const evals = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return c.json(evals);
  } catch {
    return c.json([]);
  }
});
```

After editing `app.ts`, the brain must be restarted for the new routes to take effect (the Hono server is started fresh by the dashboard-manager, not hot-reloaded).

### Example D: Fully server-rendered dashboard replacing static HTML

Replace the default `GET /` route in `dashboard/app.ts` to render the page dynamically on every request, reading live data each time:

```typescript
// In dashboard/app.ts — replace the default GET / handler:

import { generateDashboard } from '/app/src/dashboard.ts';

app.get('/', async (c) => {
  try {
    // Regenerate the static HTML on the fly, then serve it
    await generateDashboard({
      objectivePath: OBJ_DIR,
      projectId: process.env.PROJECT_ID ?? 'unknown',
      objectiveId: process.env.OBJECTIVE_ID ?? 'unknown',
    });
    const html = await readFile(join(OBJ_DIR, 'dashboard', 'index.html'), 'utf-8');
    return c.html(html);
  } catch (err) {
    return c.text(`Dashboard error: ${err}`, 500);
  }
});
```

This makes every page load reflect the latest state without waiting for the processor to run.

## Testing Your Changes

### Static changes (gen-dashboard.ts)

Run the script manually from inside the objective folder:

```bash
bun .agent/scripts/gen-dashboard.ts /path/to/objective
```

Then open `dashboard/index.html` in a browser to check the result.

### Dynamic changes (app.ts)

Restart the Hono server manually to pick up your changes:

```bash
PORT=3200 OBJECTIVE_DIR=/path/to/objective bun dashboard/app.ts
```

Then test routes with curl or a browser:

```bash
curl http://localhost:3200/
curl http://localhost:3200/logs
curl http://localhost:3200/state  # if you added a custom route
```

After you're satisfied, call `mcp__carapa-board__refresh_dashboard` to reload the iframe in the UI without waiting for the next agent run.

## Important Constraints

- **Self-contained HTML only** — no CDN links, no external JavaScript. Everything the dashboard needs must already be in `dashboard/`.
- **Use the shared stylesheet** — include `<link rel="stylesheet" href="styles.css">` (already handled by `renderPage`). Do not inline the full CSS.
- **Atomic writes** — always write to a `.tmp` file then `rename` to `dashboard/index.html`. Never write directly; a mid-write crash would corrupt the file.
- **Keep gen-dashboard.ts fast** — the script runs as a subprocess with a 30-second timeout. Avoid network calls or expensive computation; read from local files only.
- **`app.ts` is write-once by gen-dashboard.ts** — the default script only creates `app.ts` if it doesn't exist. Your customisations are never overwritten by subsequent runs.
- **Measure outcomes, not activity** — the `score` field in `evals.jsonl` (0–10) is an internal activity heuristic: it counts files changed, tasks created and tool variety, never whether the work was right. Do not show it as a quality, effectiveness or progress KPI, and do not chart or average it. Show quality from outcomes (`outcomes.jsonl`: merged tasks, review scores) and the objective's own progress measures (stories, milestones, metrics in `state.json`). For waste, show runs with no observable output per trigger type.
- **Brain restart required for `app.ts` changes** — the Hono server is started by the dashboard-manager and is not hot-reloaded. After editing `app.ts`, the brain must restart for new routes to take effect.
