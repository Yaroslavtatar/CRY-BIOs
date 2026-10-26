#!/usr/bin/env bash
# Smoke-тест: поднимает собранный сервер (dist/server.cjs) и проверяет ключевые эндпоинты.
set -euo pipefail

PORT=3000 # в server.ts порт зашит (const PORT = 3000)
BASE="http://127.0.0.1:${PORT}"
WORKDIR="$(mktemp -d)"
LOG="${WORKDIR}/server.log"

cleanup() {
  [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

REPO="$(pwd)"
# Сервер берёт data/ и dist/ относительно cwd — изолируем данные во временной папке
ln -s "${REPO}/dist" "${WORKDIR}/dist"
cd "$WORKDIR"
NODE_ENV=production ADMIN_PASSWORD=ci-smoke-password-123 PORT="$PORT" APP_URL="http://127.0.0.1:${PORT}" \
  DISCORD_CLIENT_ID=ci DISCORD_CLIENT_SECRET=ci \
  node "${REPO}/dist/server.cjs" >"$LOG" 2>&1 &
PID=$!

for i in $(seq 1 40); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$PID" 2>/dev/null; then echo "Сервер упал при старте:"; cat "$LOG"; exit 1; fi
  sleep 0.5
done

check() { # name expected_status url [curl args...]
  local name="$1" want="$2" url="$3"; shift 3
  local got
  got="$(curl -s -o /dev/null -w "%{http_code}" "$@" "$url" || true)"
  if [ "$got" != "$want" ]; then
    echo "FAIL ${name}: ожидали ${want}, получили ${got}"; cat "$LOG"; exit 1
  fi
  echo "ok   ${name} (${got})"
}

check "health"                     200 "${BASE}/api/health"
check "discord start без сессии"   401 "${BASE}/api/discord/oauth/start"
check "discord presence bad id"    400 "${BASE}/api/discord/abc"
check "discord presence unlinked"  404 "${BASE}/api/discord/123456789012345678"
check "discord callback bad state" 302 "${BASE}/api/discord/oauth/callback?state=x&code=y"
check "SPA index"                  200 "${BASE}/"

echo "Smoke OK"
