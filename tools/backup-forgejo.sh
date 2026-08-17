#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Verwendung: $0 <neues-backup-verzeichnis>" >&2
  exit 64
fi

backup_dir=$1
if [ -e "$backup_dir" ]; then
  echo "Backup-Ziel existiert bereits: $backup_dir" >&2
  exit 65
fi

compose_file=${COMPOSE_FILE:-compose.vps.yaml}
env_file=${ENV_FILE:-.env.vps}
compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

mkdir -m 0700 "$backup_dir"
forgejo_was_running=false
if compose ps --status running --services | grep -Fxq forgejo; then
  forgejo_was_running=true
fi

restart_forgejo() {
  if [ "$forgejo_was_running" = true ]; then
    compose up -d --no-deps forgejo >/dev/null
  fi
}
trap restart_forgejo EXIT HUP INT TERM

if [ "$forgejo_was_running" = true ]; then
  compose stop -t 60 forgejo
fi

compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --username "$POSTGRES_USER" --dbname forgejo --format custom --no-owner --no-acl' \
  >"$backup_dir/forgejo-database.dump"

compose run --rm --no-deps --entrypoint sh forgejo -c \
  'tar -C /var/lib/gitea -czf - .' \
  >"$backup_dir/forgejo-data.tar.gz"

compose exec -T forgejo forgejo --version >"$backup_dir/forgejo-version.txt" 2>/dev/null || \
  printf '%s\n' 'codeberg.org/forgejo/forgejo:15.0.6-rootless' >"$backup_dir/forgejo-version.txt"

(
  cd "$backup_dir"
  sha256sum forgejo-database.dump forgejo-data.tar.gz forgejo-version.txt >SHA256SUMS
)

trap - EXIT HUP INT TERM
restart_forgejo
backup_version=$(grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' "$backup_dir/forgejo-version.txt" | head -n 1)
"$(dirname "$0")/report-forgejo-operation.sh" forgejo.backup.completed "$backup_version"
printf 'Konsistentes Forgejo-Backup erstellt: %s\n' "$backup_dir"
