#!/usr/bin/env bash
# End-to-end test: build proti mock backendu, spuštění a průchod v Chromiu.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source tests/e2e/env.sh
export CHROMIUM_PATH="${CHROMIUM_PATH:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}"
export SHOTS_DIR="${SHOTS_DIR:-$ROOT/test-results}"

if curl -s -o /dev/null http://localhost:3100/ || curl -s -o /dev/null http://127.0.0.1:54321/; then
  echo "Port 3100 nebo 54321 je obsazený – ukončete předchozí běh." >&2
  exit 1
fi
node tests/e2e/mock-backend.mjs & MOCK_PID=$!
cleanup() {
  [ -n "${NEXT_PID:-}" ] && kill -- "-$NEXT_PID" 2>/dev/null || true
  kill "$MOCK_PID" 2>/dev/null || true
}
trap cleanup EXIT
# build až po startu mocku, aby předgenerované stránky četly (prázdná) testovací data
[ "${SKIP_BUILD:-0}" = "1" ] || ./node_modules/.bin/next build >/dev/null
setsid ./node_modules/.bin/next start -p 3100 >/dev/null 2>&1 & NEXT_PID=$!
for _ in $(seq 1 40); do curl -sf -o /dev/null http://localhost:3100/ && break; sleep 0.5; done
node tests/e2e/run.mjs
