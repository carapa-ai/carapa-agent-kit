---
name: tune-brain-prompts
description: Customize the CarapaBrain pipeline prompts for this objective - the curator context brief, the reflection rule extractor and the reflector that condenses session reflections - by editing .agent/prompts/{curator,reflection,reflector}.md. Use when briefs emphasize the wrong things, extracted lessons are the wrong kind, or condensation keeps or drops the wrong content.
---

# Tune Brain Prompts

The LLM prompts used by the brain pipeline (curator, reflector, reflection extractor) can be customized per objective. Place markdown files in `.agent/prompts/` inside the objective folder:

```
.agent/prompts/
├── curator.md      ← context brief synthesis (processor.ts)
├── reflection.md   ← rule extraction from session transcripts (session-tracker.ts)
└── reflector.md    ← condensation of session-reflections.md (reflector.ts)
```

## Resolution

**Resolution order:** objective `.agent/prompts/{name}.md` → global `prompts/{name}.md` → hardcoded fallback.

## When to customize

- `curator.md` — when the objective needs different context emphasis (e.g., a fitness tracker cares about activity data, not code commits)
- `reflection.md` — when the objective produces different kinds of learnings (code patterns vs user preference patterns)
- `reflector.md` — when the condensation rules need tuning (what to keep, what to discard, target reduction ratio)

## Editing

- Edit files directly in `.agent/prompts/` — no code deploy needed
- Changes take effect on the next brain run that uses that prompt
- Keep prompts concise — they're injected into LLM calls with limited output tokens
- Test by triggering the relevant pipeline step and checking output quality
- Keep the `{{placeholders}}` from the global prompt (`{{budgetBytes}}`, `{{existingHeadings}}` in reflector.md; `{{existingRules}}` in reflection.md). A missing placeholder means that value is not injected; the brain logs a warning.
