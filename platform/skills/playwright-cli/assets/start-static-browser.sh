#!/usr/bin/env bash
# Copy to the checkout's .agent/start-browser.sh and set the app directory.
set -euo pipefail
web_root="$PWD/public"
exec python3 - "$web_root" "${CARAPA_BROWSER_URL_FILE:?Start through browser-open or Board}" <<'PY'
import functools
import os
from pathlib import Path
import signal
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

root = Path(sys.argv[1]).resolve(strict=True)
if not root.is_dir() or not (root / "index.html").is_file():
    raise SystemExit(f"Expected a static app with index.html in {root}")
url_file = Path(sys.argv[2])
if not url_file.is_absolute():
    raise SystemExit("CARAPA_BROWSER_URL_FILE must be absolute")

def stop(_signal, _frame):
    raise SystemExit(0)

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
handler = functools.partial(SimpleHTTPRequestHandler, directory=str(root))
with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
    temporary = url_file.with_name(f"{url_file.name}.{os.getpid()}.tmp")
    temporary.write_text(f"http://127.0.0.1:{server.server_port}/\n")
    temporary.replace(url_file)
    server.serve_forever()
PY
