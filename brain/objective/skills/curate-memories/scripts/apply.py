# usage: MCP_CALL=/path/to/mcp-call.sh python3 -I apply.py OPS.json META.json LOG
# OPS: [{id, action: keep|supersede|invalidate, type?, content?, reason?}]; META: recall rows (id, group, updated, tags, importance).
# Sequential on purpose: a caller that uses fixed /tmp files breaks with two copies at once (wrap in `flock LOCK`).
# Rerunnable: skips ids already OK/ALREADY in LOG. Empty reply = relay rate limit -> backoff.
import json, subprocess, sys, re, time
ops_file, meta_file, log_file = sys.argv[1], sys.argv[2], sys.argv[3]
meta = {m["id"]: m for m in json.load(open(meta_file))}
ops = json.load(open(ops_file))
done = set()
try:
    for l in open(log_file):
        p = l.split("\t")
        if len(p) > 2 and p[2] in ("OK", "ALREADY"): done.add(p[0])
except FileNotFoundError: pass
STATUS = re.compile(r"^(merged|live|pending|not-live|not-yet-live|phase-\d+|due.*|first-pass)$", re.I)
import os
MCP = os.environ["MCP_CALL"]  # script: MCP_CALL <tool> <json-args> -> prints the MCP SSE reply (data: lines)
out = open(log_file, "a")
for op in ops:
    mid, act = op["id"], op["action"]
    if act == "keep" or mid in done: continue
    m = meta.get(mid)
    if not m: out.write(f"{mid}\t{act}\tSKIP\tno meta\n"); continue
    args = {"operation": act, "memory_id": mid, "expected_version": m["updated"], "project_id": m["group"]}
    if act == "supersede":
        # carry importance + tags over: supersede otherwise resets importance to the type default
        args.update(memory_type=op["type"], content=op["content"],
                    tags=[t for t in (m.get("tags") or []) if not STATUS.match(t)],
                    importance=m.get("importance", 0.6),
                    sourceRef="curation: rewritten per the short-fact memory standard")
    else:
        args["sourceRef"] = op.get("reason", "curation")
    txt = ""
    for attempt in range(8):
        r = subprocess.run(["bash", MCP, "memorize", json.dumps(args)], capture_output=True, text=True).stdout
        txt = ""
        for line in r.splitlines():
            if line.startswith("data:"):
                d = json.loads(line[5:]); txt = json.dumps(d.get("result", d.get("error")))[:300]
        if not txt or "429" in txt or "Too Many" in txt:
            time.sleep(15 * (attempt + 1)); continue
        break
    ok = ("superseded" in txt or "invalidated" in txt.lower()) and '"isError": true' not in txt
    status = "OK" if ok else ("ALREADY" if ("changed concurrently" in txt or "not found" in txt.lower()) else "FAIL")
    out.write(f"{mid}\t{act}\t{status}\t{txt}\n"); out.flush()
