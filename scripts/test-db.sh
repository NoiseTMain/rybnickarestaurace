#!/usr/bin/env bash
# Spustí migrace a testy RLS proti dočasné lokální instanci PostgreSQL.
# Vyžaduje nainstalovaný PostgreSQL (initdb, pg_ctl, psql) – Docker není potřeba.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

run_as() {
  if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi
}

if [ "$(id -u)" = "0" ]; then chown postgres "$TMP"; fi
run_as "'$PG_BIN/initdb' -D '$TMP/data' -U postgres --locale=C.UTF-8 -E UTF8 >/dev/null"
run_as "'$PG_BIN/pg_ctl' -D '$TMP/data' -o '-p $PORT -k $TMP -c listen_addresses=' -w start >/dev/null"

PSQL=("$PG_BIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migrace $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/10_rls_test.sql"
