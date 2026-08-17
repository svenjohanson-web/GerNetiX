#!/bin/sh
set -eu

usage() {
  echo "Verwendung: RESTORE_COMPOSE_PROJECT=gernetix-forgejo-restore-<id> RESTORE_COMPOSE_FILE=<datei> RESTORE_ENV_FILE=<datei> RESTORE_EXPECTED_FORGEJO_VERSION=<x.y.z> $0 <backup-verzeichnis>" >&2
  exit 64
}

[ "$#" -eq 1 ] || usage
backup_dir=$1
compose_project=${RESTORE_COMPOSE_PROJECT:-}
compose_file=${RESTORE_COMPOSE_FILE:-}
env_file=${RESTORE_ENV_FILE:-}
expected_version=${RESTORE_EXPECTED_FORGEJO_VERSION:-}

case "$compose_project" in
  gernetix-forgejo-restore-[a-z0-9][a-z0-9-]*) ;;
  *) echo "Unsicherer Restore-Projektname: $compose_project" >&2; exit 65 ;;
esac

[ -d "$backup_dir" ] || { echo "Backup-Verzeichnis fehlt: $backup_dir" >&2; exit 66; }
[ -f "$compose_file" ] && [ ! -L "$compose_file" ] || { echo "Restore-Compose-Datei fehlt oder ist ein Symlink" >&2; exit 66; }
[ -f "$env_file" ] && [ ! -L "$env_file" ] || { echo "Restore-Env-Datei fehlt oder ist ein Symlink" >&2; exit 66; }
printf '%s\n' "$expected_version" | awk -F. '
  NF != 3 { exit 1 }
  $1 !~ /^[0-9]+$/ || $2 !~ /^[0-9]+$/ || $3 !~ /^[0-9]+$/ { exit 1 }
' || { echo "RESTORE_EXPECTED_FORGEJO_VERSION muss eine feste Patchversion sein" >&2; exit 65; }

required_files="forgejo-database.dump forgejo-data.tar.gz forgejo-version.txt SHA256SUMS"
for file in $required_files; do
  [ -f "$backup_dir/$file" ] && [ ! -L "$backup_dir/$file" ] || {
    echo "Unvollstaendiger oder unsicherer Sicherungssatz: $file" >&2
    exit 66
  }
done

entry_count=$(find "$backup_dir" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')
[ "$entry_count" = 4 ] || { echo "Sicherungssatz enthaelt unerwartete Eintraege" >&2; exit 66; }

awk '
  NF != 2 || length($1) != 64 || $1 ~ /[^0-9a-f]/ { exit 1 }
  $2 != "forgejo-database.dump" && $2 != "forgejo-data.tar.gz" && $2 != "forgejo-version.txt" { exit 1 }
  { count[$2]++ }
  END {
    if (NR != 3 || count["forgejo-database.dump"] != 1 || count["forgejo-data.tar.gz"] != 1 || count["forgejo-version.txt"] != 1) exit 1
  }
' "$backup_dir/SHA256SUMS" || { echo "Ungueltiges SHA256SUMS-Manifest" >&2; exit 67; }

(
  cd "$backup_dir"
  sha256sum -c SHA256SUMS >/dev/null
) || { echo "Pruefsummenfehler; Restore wurde nicht gestartet" >&2; exit 67; }

grep -Eq "(^|[^0-9])${expected_version}([^0-9]|$)" "$backup_dir/forgejo-version.txt" || {
  echo "Forgejo-Version des Sicherungssatzes stimmt nicht mit der Restore-Version ueberein" >&2
  exit 68
}

archive_entries=$(tar -tzf "$backup_dir/forgejo-data.tar.gz") || {
  echo "forgejo_data-Archiv ist nicht lesbar" >&2
  exit 67
}
printf '%s\n' "$archive_entries" | awk '
  /^\// { exit 1 }
  /(^|\/)\.\.($|\/)/ { exit 1 }
' || { echo "forgejo_data-Archiv enthaelt unsichere Pfade" >&2; exit 67; }
tar -tvzf "$backup_dir/forgejo-data.tar.gz" | awk 'substr($1,1,1) == "l" || substr($1,1,1) == "h" { exit 1 }' || {
  echo "forgejo_data-Archiv enthaelt nicht erlaubte Links" >&2
  exit 67
}

command -v docker >/dev/null 2>&1 || { echo "Docker ist fuer den isolierten Restore nicht verfuegbar" >&2; exit 69; }
compose() {
  docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file" "$@"
}

configured_images=$(compose config --images)
printf '%s\n' "$configured_images" | grep -Fxq "codeberg.org/forgejo/forgejo:${expected_version}-rootless" || {
  echo "Restore-Compose verwendet nicht die gesicherte Forgejo-Patchversion" >&2
  exit 68
}

[ -z "$(compose ps -aq)" ] || { echo "Restore-Ziel enthaelt bereits Container" >&2; exit 70; }
[ -z "$(docker volume ls --filter "label=com.docker.compose.project=$compose_project" -q)" ] || {
  echo "Restore-Ziel enthaelt bereits Volumes" >&2
  exit 70
}

restore_started=false
rollback_restore() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$restore_started" = true ]; then
    compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap rollback_restore EXIT
trap 'exit 130' HUP INT TERM

restore_started=true
compose up -d runtime-postgres >/dev/null

attempt=0
until compose exec -T runtime-postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_isready --username "$POSTGRES_USER" --dbname forgejo' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "Restore-PostgreSQL wurde nicht bereit" >&2; exit 71; }
  sleep 1
done

table_count=$(compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname forgejo --tuples-only --no-align --command "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('\''pg_catalog'\'', '\''information_schema'\'')"')
[ "$table_count" = 0 ] || { echo "Restore-Datenbank ist nicht leer" >&2; exit 70; }

compose run --rm --no-deps --entrypoint sh forgejo -c \
  'test -z "$(find /var/lib/gitea -mindepth 1 -maxdepth 1 -print -quit)"' || {
  echo "Restore-forgejo_data ist nicht leer" >&2
  exit 70
}

compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --username "$POSTGRES_USER" --dbname forgejo --no-owner --no-acl' \
  <"$backup_dir/forgejo-database.dump"

compose run --rm --no-deps --entrypoint sh forgejo -c \
  'tar -C /var/lib/gitea -xzf -' <"$backup_dir/forgejo-data.tar.gz"

compose up -d forgejo >/dev/null
attempt=0
until compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo "Restored Forgejo wurde nicht gesund" >&2; exit 71; }
  sleep 1
done

restored_version=$(compose exec -T forgejo forgejo --version)
printf '%s\n' "$restored_version" | grep -Eq "(^|[^0-9])${expected_version}([^0-9]|$)" || {
  echo "Laufende Restore-Version stimmt nicht mit dem Sicherungssatz ueberein" >&2
  exit 68
}

trap - EXIT HUP INT TERM
"$(dirname "$0")/report-forgejo-operation.sh" forgejo.restore.completed "$expected_version"
printf 'Isolierter Forgejo-Restore bereit: %s (Version %s)\n' "$compose_project" "$expected_version"
