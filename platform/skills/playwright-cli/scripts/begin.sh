#!/usr/bin/env bash
# Open a URL and start a Playwright CLI video recording.
# Usage: begin.sh <url> [recording-directory]

set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <url> [recording-directory]" >&2
  exit 2
fi

if ! command -v playwright-cli >/dev/null 2>&1; then
  echo "playwright-cli is not available on PATH" >&2
  exit 127
fi

url="$1"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
recording_dir="${2:-.playwright-cli/recordings/$timestamp}"
recording_file="$recording_dir/session.webm"

mkdir -p "$recording_dir"
playwright-cli open "$url"

attempt=1
while ! playwright-cli snapshot >/dev/null 2>&1; do
  if [ "$attempt" -ge 30 ]; then
    echo "Browser did not become ready after 30 attempts" >&2
    playwright-cli close >/dev/null 2>&1 || true
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if ! playwright-cli video-start "$recording_file"; then
  playwright-cli close >/dev/null 2>&1 || true
  exit 1
fi

echo "Recording started: $recording_file"
echo "Stop it with: playwright-cli video-stop"
