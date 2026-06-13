#!/usr/bin/env bash
# Shared helpers for Testnet deploy scripts (Linux / Ubuntu 24)
set -euo pipefail

_xmarket_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XMARKET_ROOT="$(cd "${_xmarket_script_dir}/../.." && pwd)"
RUN_DIR="${XMARKET_ROOT}/.run"
DEPLOY_JSON="${DEPLOY_JSON:-deploy/testnet-v2.json}"

cd "$XMARKET_ROOT"
mkdir -p "$RUN_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

deploy_json_get() {
  local path="$1"
  python3 - "$DEPLOY_JSON" "$path" <<'PY'
import json, sys
path = sys.argv[2].split(".")
with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)
for p in path:
    d = d[p]
print(d)
PY
}

env_set_line() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

wait_postgres_healthy() {
  local max_wait="${1:-90}"
  local i=0
  echo "Waiting for Postgres to become healthy (max ${max_wait}s) ..."
  while [[ "$i" -lt "$max_wait" ]]; do
    if docker compose -f docker-compose.indexer.yml exec -T postgres pg_isready -U xmarket -d xmarket_indexer >/dev/null 2>&1; then
      echo "Postgres is healthy"
      return 0
    fi
    sleep 2
    i=$((i + 2))
  done
  echo "Postgres did not become healthy within ${max_wait}s" >&2
  return 1
}

stop_by_pid_file() {
  local name="$1"
  local pid_file="${RUN_DIR}/${name}.pid"
  [[ -f "$pid_file" ]] || return 0
  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    echo "Stopped ${name} (pid ${pid})"
  fi
  rm -f "$pid_file"
}

free_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null && echo "Freed port ${port}" || true
    return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"${port}" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs -r kill -9 2>/dev/null || true
      echo "Freed port ${port}"
    fi
  fi
}

check_health() {
  local name="$1"
  local url="$2"
  local body
  if ! body="$(curl -sf --max-time 10 "${url}/health" 2>/dev/null)"; then
    echo "[FAIL] ${name} ${url}/health"
    return 1
  fi
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)" 2>/dev/null; then
    echo "[OK] ${name} ${url}/health"
    echo "     ${body}"
    return 0
  fi
  echo "[WARN] ${name} unhealthy: ${body}"
  return 1
}

start_npm_service() {
  local name="$1"
  local work_dir="$2"
  local log_file="${RUN_DIR}/${name}.log"
  local pid_file="${RUN_DIR}/${name}.pid"

  if [[ -f "$pid_file" ]]; then
    local saved_pid
    saved_pid="$(cat "$pid_file")"
    if kill -0 "$saved_pid" 2>/dev/null; then
      echo "${name} already running (pid ${saved_pid})"
      return 0
    fi
  fi

  (
    cd "$work_dir"
    nohup npm start >>"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
  local pid
  pid="$(cat "$pid_file")"
  echo "Started ${name} pid=${pid} log=${log_file}"
}

bootstrap_app_env() {
  local profile="${1:-p1}"
  local app_example="app/.env.example"
  local app_local="app/.env.local"

  [[ -f "$app_example" ]] || { echo "Missing ${app_example}" >&2; exit 1; }
  [[ -f "$app_local" ]] || cp "$app_example" "$app_local"

  local package_id
  package_id="$(deploy_json_get packageId)"
  env_set_line "$app_local" "NEXT_PUBLIC_PACKAGE_ID" "$package_id"

  if [[ "$profile" != "frontend" ]]; then
    env_set_line "$app_local" "NEXT_PUBLIC_GAS_STATION_URL" "http://localhost:8787"
    env_set_line "$app_local" "NEXT_PUBLIC_INDEXER_URL" "http://localhost:8800"
  fi
  if [[ "$profile" == "p2" || "$profile" == "full" ]]; then
    env_set_line "$app_local" "NEXT_PUBLIC_INDEXER_URL" "http://localhost:8800"
  fi
  if [[ "$profile" == "full" ]]; then
    env_set_line "$app_local" "NEXT_PUBLIC_PRICING_ENGINE_URL" "http://localhost:8801"
  fi
  echo "Updated ${app_local}"
}
