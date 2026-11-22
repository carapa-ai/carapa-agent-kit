---
name: curate-memories
description: Clean up long-term board memory, one by one or in bulk. Finds duplicate, stale, contradictory, mistyped or over-long memories, rewrites them to the short-fact standard or invalidates them, then re-checks recall. Use to curate or dedupe memories, for memory hygiene, a memory cleanup round, or when recall returns duplicates, status lines or noise. Rule files go to reflect.
---

# Curate Memories

Keep long-term memory (`memorize` / `recall`) short, true and findable. Three actions only: **keep**, **supersede** (rewrite), **invalidate**. Both write actions need `memory_id` and `expected_version` (the `updated` value from `recall`). Pass `project_id` = the memory's own group on every write, and a `sourceRef` that says why.

## The standard (what a good memory is)

- One idea in one or two plain sentences, about 300 characters, hard maximum 400.
- Fact or decision first, the reason after it when it matters. Ids, task ids and dates go at the end in one parenthesis, never at the start.
- No status or counters: merged, pending, not yet live, review scores, costs, due dates, `[ledger ...]` tails. Those belong on the board or in the ledger.
- No commit hashes, no line numbers, no secret values.
- No duplicates, and nothing the platform already injects (user name, identity, rules that sit in a loaded rule file).
- Keep commands, paths, env vars, invariants and gotchas. They are what a future agent needs.

## Decide per memory

1. **invalidate**: duplicate of another memory; merge/deploy/walk/audit log line; due-date reminder; status of finished or abandoned work; rule contradicted by a newer decision; vague line with no action value; third-party personal data.
2. **supersede**: the fact is still useful but violates the standard (too long, status tail, hash, several ideas). Write the short version. If it contains two durable ideas, supersede with the stronger one and invalidate or split the rest. Do not invent: state only what the old text says; if it presents planned or carded work as current, check the code or say "planned".
3. **keep**: already meets the standard. Default to keep when unsure; a rewrite must not lose a path, command or invariant.

Typing: use the true `memory_type` (decision, preference, project, goal, contact, event, task, identity). A preference stated by the user is `preference`, not `project`.

## Small clean-up (up to about 30 memories)

1. `recall(objective_id=<yours>, limit=30)` without a query, then targeted queries on topics that collect duplicates (deploy, pipeline, a project name).
2. Apply the decision list above with `memorize` (`invalidate`, or `supersede` with `memory_type`, `content`, and the old `tags` and `importance` passed again: supersede otherwise resets importance to the type default).
3. Re-check: `recall(limit=15)` shows no duplicates or status lines. Note the counts in the run report.

## Bulk round (hundreds of memories)

Scope first. Your own projects need no ask. Another project's memories only when the user asked for it; skip throwaway test projects. A repeat round touches only memories whose `validFrom` is after the last round.

1. **Collect**: `recall` caps at 500 per call. Run it with an empty query and with many topic terms (project words, "merged", "pending", "card", "decision"), with and without `objective_id`, dedupe by id, filter by group. Save as `all.json`.
2. **Pick candidates**: ops-heavy projects: `length>400` or status words. Normal projects: review all, keep by default; duplicates, vague stack lines and task narration are the noise there.
3. **Batch**: about 100 per batch, sorted by group then id so duplicates sit next to each other.
4. **Draft**: one balanced-tier subagent per batch, at most about 7 in parallel. Prompt: the standard above, the three actions, output `[{id, action, type?, content?, reason?}]` (one entry per input id, same order), and "no MCP tools". For normal projects add: keep by default, invalidate duplicates, vague lines, junk and secret values.
5. **Review every batch** before applying: `scripts/review.sh DIR K 60` checks the id list, counts, max length and flags hashes, status words and task ids, and prints each change next to the old text. Read the changes. Typical fixes: a rewrite that states planned work as current, a "planned X" that already exists, a stale path, a rule that a newer user decision contradicts, a mistyped id.
6. **Apply** with the helper, in the background and one at a time: `MCP_CALL=<script> flock DIR/apply.lock python3 -I scripts/apply.py DIR/ops-K.json DIR/all.json LOG`. It carries importance and tags over, skips ids already done in the log, backs off on rate limits, and is safe to re-run. A rerun answering "changed concurrently" means the change already landed.
7. **Check**: tally the log by action and status, scan the kept memories for secret values, and write one line per round to the decision log (counts, median length before and after, log path). Delete the temp dir.

Gotchas: two concurrent callers using the same temp files swap request bodies; an empty reply means a rate limit. Objective-scoped memories keep their scope on supersede, so do not pass a different `objective_id`.
