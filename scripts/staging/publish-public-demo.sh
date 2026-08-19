#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

if [ "${GERNETIX_STAGING_LOCK_HELD:-0}" != "1" ]; then
  command -v flock >/dev/null 2>&1 || { echo "flock fehlt auf dem VPS." >&2; exit 1; }
  exec flock -E 75 -n /var/lock/gernetix-staging-deploy.lock \
    env GERNETIX_STAGING_LOCK_HELD=1 sh "$0" "$@"
fi

env_file=${GERNETIX_STAGING_ENV_FILE:-.env.vps}
test -f "$env_file" || { echo "Die VPS-Konfiguration $env_file fehlt." >&2; exit 1; }

docker compose --env-file "$env_file" -f compose.vps.yaml exec -T identity-server \
  node /app/services/identity-server/src/operations/publish-public-demo.js
