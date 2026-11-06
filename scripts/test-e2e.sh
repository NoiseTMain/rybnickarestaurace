#!/usr/bin/env bash
# End-to-end test v lokálním režimu: production build, server na :3100, průchod v Chromiu.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export HOMEOS_DATA_DIR="$(mktemp -d)"
export HOMEOS_INSECURE_COOKIES=1
unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY
export NEXT_PUBLIC_HOMEOS_LOCAL_MODE=1
export SHOTS_DIR="${SHOTS_DIR:-$ROOT/test-results}"
cleanup() { [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true; rm -rf "$HOMEOS_DATA_DIR"; }
trap cleanup EXIT
[ "${SKIP_BUILD:-0}" = "1" ] || ./node_modules/.bin/next build >/dev/null
./node_modules/.bin/next start -p 3100 >"$HOMEOS_DATA_DIR/server.log" 2>&1 & PID=$!
for _ in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3100/prihlaseni && break; sleep 0.5; done
BASE_URL=http://localhost:3100 node tests/e2e/run.mjs || { echo "--- server log ---"; tail -80 "$HOMEOS_DATA_DIR/server.log"; exit 1; }
