#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

env_file=${GERNETIX_STAGING_ENV_FILE:-.env.vps}
wait_timeout=${GERNETIX_STAGING_WAIT_TIMEOUT:-180}
if [ ! -f "$env_file" ]; then
  echo "Fehlende VPS-Konfiguration: $repo_dir/$env_file" >&2
  exit 1
fi

echo "==> Compose-Konfiguration pruefen"
docker compose --env-file "$env_file" -f compose.vps.yaml config --quiet

echo "==> Images bauen"
docker compose --env-file "$env_file" -f compose.vps.yaml build

echo "==> Staging aktualisieren und auf Healthchecks warten"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --wait --wait-timeout "$wait_timeout"

echo "==> Edge- und Admin-Healthchecks"
curl --fail --silent --show-error http://127.0.0.1:8080/health
printf '\n'
curl --fail --silent --show-error http://127.0.0.1:4600/health
printf '\n'

echo "==> Containerstatus"
docker compose --env-file "$env_file" -f compose.vps.yaml ps
