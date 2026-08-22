#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Verwendung: UPGRADE_FROM_VERSION=x.y.z UPGRADE_TO_VERSION=x.y.z UPGRADE_COMPOSE_FILE=<datei> UPGRADE_ENV_FILE=<datei> $0 <backup-verzeichnis>" >&2
  exit 64
fi

backup_dir=$1
from_version=${UPGRADE_FROM_VERSION:-}
to_version=${UPGRADE_TO_VERSION:-}
compose_file=${UPGRADE_COMPOSE_FILE:-}
env_file=${UPGRADE_ENV_FILE:-}
for version in "$from_version" "$to_version"; do
  printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "Upgrade-Versionen muessen feste Patchversionen sein" >&2; exit 65; }
done
[ "$from_version" != "$to_version" ] || { echo "Quell- und Zielversion sind identisch" >&2; exit 65; }
[ -f "$compose_file" ] && [ -f "$env_file" ] || { echo "Isolierte Compose- oder Env-Datei fehlt" >&2; exit 66; }
grep -Eq "(^|[^0-9])${from_version}([^0-9]|$)" "$backup_dir/forgejo-version.txt" || { echo "Backup besitzt nicht die angegebene Quellversion" >&2; exit 68; }

run_id=$(date -u +%Y%m%d%H%M%S)-$$
project="gernetix-forgejo-restore-upgrade-$run_id"
override=$(mktemp "${TMPDIR:-/tmp}/gernetix-forgejo-upgrade.XXXXXX.yaml")
cleanup() {
  docker compose --project-name "$project" --env-file "$env_file" -f "$compose_file" -f "$override" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "$override"
}
trap cleanup EXIT HUP INT TERM

RESTORE_COMPOSE_PROJECT="$project" RESTORE_COMPOSE_FILE="$compose_file" RESTORE_ENV_FILE="$env_file" \
  RESTORE_EXPECTED_FORGEJO_VERSION="$from_version" "$(dirname "$0")/restore-forgejo-backup.sh" "$backup_dir"
printf 'services:\n  forgejo:\n    image: codeberg.org/forgejo/forgejo:%s-rootless\n' "$to_version" >"$override"
compose() { docker compose --project-name "$project" --env-file "$env_file" -f "$compose_file" -f "$override" "$@"; }
compose up -d forgejo >/dev/null
attempt=0
until compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1)); [ "$attempt" -lt 60 ] || { echo "Upgrade-Ziel wurde nicht gesund" >&2; exit 71; }; sleep 1
done
compose exec -T forgejo forgejo doctor check --all
compose exec -T forgejo forgejo --version | grep -Eq "(^|[^0-9])${to_version}([^0-9]|$)" || { echo "Upgrade-Zielversion stimmt nicht" >&2; exit 68; }
"$(dirname "$0")/report-forgejo-operation.sh" forgejo.upgrade.completed "$to_version"
printf 'Isolierter Forgejo-Upgrade-Nachweis bestanden: %s -> %s\n' "$from_version" "$to_version"
