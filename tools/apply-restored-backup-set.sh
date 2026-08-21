#!/bin/sh
set -eu

# Spielt die bereits entschluesselten und geprueften Bestandteile eines
# Sicherungssatzes in eine isolierte Umgebung ein. Das Werkzeug schreibt
# ausschliesslich in ein Compose-Projekt mit dem Praefix gernetix-restore- und
# nur dann, wenn dieses nachweislich noch keine Container, Volumes, Tabellen
# oder Daten enthaelt. Es fuehrt keinen Cutover aus.
#
# Vorgelagert: tools/restore-backup-set.js mit --target-dir und --artifacts-dir.

usage() {
  echo "Verwendung: RESTORE_COMPOSE_PROJECT=gernetix-restore-<id> RESTORE_COMPOSE_FILE=<datei>" >&2
  echo "           RESTORE_ENV_FILE=<datei> RESTORE_EXPECTED_FORGEJO_VERSION=<x.y.z>" >&2
  echo "           $0 <bestandteile-verzeichnis> <artefakte-verzeichnis>" >&2
  exit 64
}

[ "$#" -eq 2 ] || usage
members_dir=$1
artifacts_dir=$2
compose_project=${RESTORE_COMPOSE_PROJECT:-}
compose_file=${RESTORE_COMPOSE_FILE:-}
env_file=${RESTORE_ENV_FILE:-}
expected_version=${RESTORE_EXPECTED_FORGEJO_VERSION:-}

case "$compose_project" in
  gernetix-restore-[a-z0-9][a-z0-9-]*) ;;
  *) echo "Unsicherer Restore-Projektname: $compose_project" >&2; exit 65 ;;
esac

[ -d "$members_dir" ] || { echo "Bestandteile-Verzeichnis fehlt: $members_dir" >&2; exit 66; }
[ -d "$artifacts_dir" ] || { echo "Artefakte-Verzeichnis fehlt: $artifacts_dir" >&2; exit 66; }
[ -f "$compose_file" ] && [ ! -L "$compose_file" ] || { echo "Restore-Compose-Datei fehlt oder ist ein Symlink" >&2; exit 66; }
[ -f "$env_file" ] && [ ! -L "$env_file" ] || { echo "Restore-Env-Datei fehlt oder ist ein Symlink" >&2; exit 66; }
printf '%s\n' "$expected_version" | awk -F. '
  NF != 3 { exit 1 }
  $1 !~ /^[0-9]+$/ || $2 !~ /^[0-9]+$/ || $3 !~ /^[0-9]+$/ { exit 1 }
' || { echo "RESTORE_EXPECTED_FORGEJO_VERSION muss eine feste Patchversion sein" >&2; exit 65; }

required_members="runtime-database.dump runtime-roles.sql forgejo-database.dump forgejo-data.tar.gz artifact-objects.tar"
for file in $required_members; do
  [ -f "$members_dir/$file" ] && [ ! -L "$members_dir/$file" ] || {
    echo "Unvollstaendige oder unsichere Bestandteile: $file" >&2
    exit 66
  }
done

# Die Artefaktarchive stammen aus tools/restore-backup-set.js und tragen die
# Backup-ID des Satzes, der sie fuehrt.
archive_count=$(find "$artifacts_dir" -mindepth 1 -maxdepth 1 -name 'artifact-objects-*.tar' -type f | wc -l | tr -d ' ')
[ "$archive_count" -ge 1 ] || { echo "Keine Artefaktarchive zum Einspielen gefunden" >&2; exit 66; }

command -v docker >/dev/null 2>&1 || { echo "Docker ist fuer den isolierten Restore nicht verfuegbar" >&2; exit 69; }
compose() {
  docker compose --project-name "$compose_project" --env-file "$env_file" -f "$compose_file" "$@"
}

compose config --images | grep -Fxq "codeberg.org/forgejo/forgejo:${expected_version}-rootless" || {
  echo "Restore-Compose verwendet nicht die gesicherte Forgejo-Patchversion" >&2
  exit 68
}

[ -z "$(compose ps -aq)" ] || { echo "Restore-Ziel enthaelt bereits Container" >&2; exit 70; }
[ -z "$(docker volume ls --filter "label=com.docker.compose.project=$compose_project" -q)" ] || {
  echo "Restore-Ziel enthaelt bereits Volumes" >&2
  exit 70
}

# Archive vor jedem schreibenden Schritt auf unsichere Pfade pruefen.
check_archive() {
  archive=$1
  entries=$(tar -tzf "$archive" 2>/dev/null || tar -tf "$archive") || {
    echo "Archiv ist nicht lesbar: $archive" >&2
    exit 67
  }
  printf '%s\n' "$entries" | awk '
    /^\// { exit 1 }
    /(^|\/)\.\.($|\/)/ { exit 1 }
  ' || { echo "Archiv enthaelt unsichere Pfade: $archive" >&2; exit 67; }
}
check_archive "$members_dir/forgejo-data.tar.gz"
for archive in "$artifacts_dir"/artifact-objects-*.tar; do
  check_archive "$archive"
done

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
until compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo "Restore-PostgreSQL wurde nicht bereit" >&2; exit 71; }
  sleep 1
done

runtime_tables=$(compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('\''pg_catalog'\'', '\''information_schema'\'')"')
[ "$runtime_tables" = 0 ] || { echo "Restore-Datenbank gernetix_runtime ist nicht leer" >&2; exit 70; }

forgejo_tables=$(compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname forgejo --tuples-only --no-align --command "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('\''pg_catalog'\'', '\''information_schema'\'')"')
[ "$forgejo_tables" = 0 ] || { echo "Restore-Datenbank forgejo ist nicht leer" >&2; exit 70; }

compose run --rm --no-deps -T --entrypoint sh forgejo -c \
  'test -z "$(find /var/lib/gitea -mindepth 1 -maxdepth 1 -print -quit)"' || {
  echo "Restore-forgejo_data ist nicht leer" >&2
  exit 70
}

# Rollen zuerst: sie liegen ausserhalb der Datenbank. Bereits vorhandene Rollen
# der frischen Instanz erzeugen dabei erwartete Fehler, deshalb wird nicht auf
# einen fehlerfreien Lauf geprueft, sondern anschliessend auf den Sollzustand.
compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --quiet --no-psqlrc --file - >/dev/null 2>&1 || true' \
  <"$members_dir/runtime-roles.sql"

expected_roles=$(awk '/^CREATE ROLE /{ print $3 }' "$members_dir/runtime-roles.sql" | tr -d '";' | sort -u)
for role in $expected_roles; do
  case "$role" in
    *[!a-zA-Z0-9_]*) echo "Unerwarteter Rollenname im Sicherungssatz: $role" >&2; exit 67 ;;
  esac
  present=$(compose exec -T runtime-postgres sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" --tuples-only --no-align --command \"SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname = '$role'\"")
  [ "$present" = 1 ] || { echo "Rolle aus dem Sicherungssatz fehlt nach dem Restore: $role" >&2; exit 71; }
done

compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-owner --no-acl --exit-on-error' \
  <"$members_dir/runtime-database.dump"

compose exec -T runtime-postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --username "$POSTGRES_USER" --dbname forgejo --no-owner --no-acl --exit-on-error' \
  <"$members_dir/forgejo-database.dump"

compose run --rm --no-deps -T --entrypoint sh forgejo -c \
  'tar -C /var/lib/gitea -xzf -' <"$members_dir/forgejo-data.tar.gz"

# Der Artifact Store wird aus allen beteiligten Saetzen aufgebaut. Content-
# addressed abgelegte Objekte duerfen sich dabei ueberschneiden, aber nie
# widersprechen; deshalb wird bereits Vorhandenes nicht ueberschrieben.
for archive in "$artifacts_dir"/artifact-objects-*.tar; do
  compose run --rm --no-deps -T --entrypoint sh public-demo-server -c \
    'mkdir -p /var/lib/gernetix/build/artifacts && tar -C /var/lib/gernetix/build/artifacts -xf - --keep-old-files' \
    <"$archive"
done

restored_objects=$(compose run --rm --no-deps -T --entrypoint sh public-demo-server -c \
  'cd /var/lib/gernetix/build/artifacts 2>/dev/null && find objects -type f | wc -l || echo 0' | tr -d '\r ')

compose up -d forgejo >/dev/null
attempt=0
until compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { echo "Wiederhergestelltes Forgejo wurde nicht gesund" >&2; exit 71; }
  sleep 1
done

restored_version=$(compose exec -T forgejo forgejo --version)
printf '%s\n' "$restored_version" | grep -Eq "(^|[^0-9])${expected_version}([^0-9]|$)" || {
  echo "Laufende Restore-Version stimmt nicht mit dem Sicherungssatz ueberein" >&2
  exit 68
}

trap - EXIT HUP INT TERM
printf 'Isolierter Restore bereit: %s (Forgejo %s, %s Artefaktobjekte)\n' \
  "$compose_project" "$expected_version" "$restored_objects"
