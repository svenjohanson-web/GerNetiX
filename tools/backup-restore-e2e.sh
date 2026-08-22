#!/bin/sh
set -eu

# Synthetischer End-to-End-Nachweis fuer die Kundendaten-Sicherung.
#
# Der Lauf erzeugt eine vollstaendig neue, synthetische Quelle mit
# gernetix_runtime, Forgejo, einem privaten Repository und einem
# content-addressed Artifact Store, sichert sie taeglich und danach stuendlich,
# stellt den stuendlichen Punkt in ein nachweislich leeres Restore-Projekt
# zurueck und prueft ihn technisch und fachlich.
#
# Er liest oder veraendert keine vorhandenen Backups, Container, Datenbanken
# oder Volumes und ist weder Deployment noch Cutover-Freigabe.

command -v docker >/dev/null 2>&1 || { echo "Docker fehlt; Container-Nachweis nicht gestartet" >&2; exit 69; }
docker info >/dev/null 2>&1 || { echo "Docker-Daemon ist nicht erreichbar; Container-Nachweis nicht gestartet" >&2; exit 69; }
command -v git >/dev/null 2>&1 || { echo "Git fehlt" >&2; exit 69; }
command -v curl >/dev/null 2>&1 || { echo "curl fehlt" >&2; exit 69; }
command -v openssl >/dev/null 2>&1 || { echo "openssl fehlt" >&2; exit 69; }
command -v node >/dev/null 2>&1 || { echo "Node fehlt" >&2; exit 69; }

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
run_id="$(date -u +%Y%m%d%H%M%S)-$$"
started_epoch=$(date +%s)
source_project="gernetix-backup-source-$run_id"
restore_project="gernetix-restore-$run_id"
tampered_project="gernetix-restore-tampered-$run_id"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/gernetix-backup-restore-e2e.XXXXXX")
env_file="$work_dir/synthetic.env"
sets_dir="$work_dir/saetze"
compose_file="$script_dir/backup-restore-test.compose.yaml"
expected_forgejo_version=15.0.6
test_password="Aa1-$(openssl rand -hex 24)"

cleanup() {
  for project in "$source_project" "$restore_project" "$tampered_project"; do
    docker compose --project-name "$project" --env-file "$env_file" -f "$compose_file" \
      down --volumes --remove-orphans >/dev/null 2>&1 || true
  done
  case "$work_dir" in
    ${TMPDIR:-/tmp}/gernetix-backup-restore-e2e.*) rm -rf -- "$work_dir" ;;
  esac
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

cat >"$env_file" <<EOF
BACKUP_TEST_POSTGRES_PASSWORD=$(openssl rand -hex 32)
BACKUP_TEST_FORGEJO_POSTGRES_PASSWORD=$(openssl rand -hex 32)
BACKUP_TEST_SECRET_KEY=$(openssl rand -hex 32)
BACKUP_TEST_INTERNAL_TOKEN=$(openssl rand -hex 48)
EOF
chmod 0600 "$env_file"
mkdir -m 0700 "$sets_dir"

source_compose() {
  docker compose --project-name "$source_project" --env-file "$env_file" -f "$compose_file" "$@"
}
restore_compose() {
  docker compose --project-name "$restore_project" --env-file "$env_file" -f "$compose_file" "$@"
}

# Fuehrt eine Abfrage gegen gernetix_runtime der genannten Umgebung aus.
runtime_query() {
  "$1" exec -T runtime-postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --quiet --no-psqlrc --file -'
}

# Legt ein Objekt content-addressed im Artifact Store der Quelle ab und gibt
# seinen SHA-256 aus.
put_artifact() {
  printf '%s' "$1" | source_compose run --rm --no-deps -T --entrypoint sh public-demo-server -c '
    set -eu
    root=/var/lib/gernetix/build/artifacts
    tmp=$(mktemp)
    cat >"$tmp"
    sha=$(sha256sum "$tmp" | cut -d" " -f1)
    dir="$root/objects/$(echo "$sha" | cut -c1-2)"
    mkdir -p "$dir"
    cp "$tmp" "$dir/$sha"
    rm -f "$tmp"
    printf "%s" "$sha"
  ' 2>/dev/null | tr -d '\r\n'
}

echo "== Synthetische Quelle aufbauen =="
source_compose up -d >/dev/null
attempt=0
until source_compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { echo "Synthetische Quelle wurde nicht gesund" >&2; exit 71; }
  sleep 1
done

runtime_query source_compose <"$script_dir/backup/e2e-seed-runtime.sql" >/dev/null

source_compose exec -T forgejo forgejo admin user create \
  --username restore-contract \
  --password "$test_password" \
  --email restore-contract@example.invalid \
  --admin \
  --must-change-password=false >/dev/null

source_port=$(source_compose port forgejo 3000)
source_url="http://$source_port"
curl --fail --silent --show-error \
  --user "restore-contract:$test_password" \
  --header "Content-Type: application/json" \
  --data '{"name":"backup-proof","private":true,"auto_init":false}' \
  "$source_url/api/v1/user/repos" >/dev/null

seed_repo="$work_dir/seed"
mkdir "$seed_repo"
git -C "$seed_repo" init --initial-branch main >/dev/null
git -C "$seed_repo" config user.name "Synthetic Restore Contract"
git -C "$seed_repo" config user.email "restore-contract@example.invalid"
printf '%s\n' "first restore proof" >"$seed_repo/README.md"
git -C "$seed_repo" add README.md
GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z \
  git -C "$seed_repo" commit -m "synthetic first commit" >/dev/null
mkdir "$seed_repo/gernetix"
printf '%s\n' '{"contract":"customer-data-backup","revision":2}' >"$seed_repo/gernetix/project.json"
git -C "$seed_repo" add gernetix/project.json
GIT_AUTHOR_DATE=2026-01-01T00:01:00Z GIT_COMMITTER_DATE=2026-01-01T00:01:00Z \
  git -C "$seed_repo" commit -m "synthetic second commit" >/dev/null

askpass="$work_dir/askpass.sh"
cat >"$askpass" <<EOF
#!/bin/sh
case "\$1" in
  *Username*) printf '%s\n' restore-contract ;;
  *) printf '%s\n' '$test_password' ;;
esac
EOF
chmod 0700 "$askpass"
git -C "$seed_repo" remote add origin "$source_url/restore-contract/backup-proof.git"
GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 git -C "$seed_repo" push -u origin main >/dev/null

git -C "$seed_repo" ls-tree -r --full-tree HEAD >"$work_dir/source-tree.txt"
git -C "$seed_repo" log --reverse --format='%H %P %T %s' >"$work_dir/source-history.txt"
source_head=$(git -C "$seed_repo" rev-parse HEAD)

# Die Projektzeile traegt jetzt den echten Commit. Damit ist die Kette
# Account -> Projekt -> Repository -> erwarteter Commit nach dem Restore pruefbar.
printf "UPDATE project_projects SET head_sha = '%s' WHERE project_id = 'project-synthetic-1';\n" "$source_head" \
  | runtime_query source_compose >/dev/null

artifact_one=$(put_artifact "synthetisches artefakt aus dem taeglichen satz")
case "$artifact_one" in
  [0-9a-f]*) [ "${#artifact_one}" -eq 64 ] || { echo "Artefakt-Hash unerwartet: $artifact_one" >&2; exit 72; } ;;
  *) echo "Artefakt konnte nicht abgelegt werden: $artifact_one" >&2; exit 72 ;;
esac

echo "== Erster Sicherungssatz: taeglich, mit kontrolliertem Forgejo-Stopp =="
node "$script_dir/generate-backup-recovery-key.js" \
  --private-key-out "$work_dir/recovery.key" \
  --public-key-out "$work_dir/recovery.pub" >/dev/null

COMPOSE_PROJECT_NAME="$source_project" node "$script_dir/backup-orchestrator.js" \
  --mode daily \
  --work-dir "$sets_dir" \
  --public-key "$work_dir/recovery.pub" \
  --compose-file "$compose_file" \
  --env-file "$env_file" \
  --source-instance gernetix-e2e \
  --application-version synthetic-e2e >"$work_dir/daily.log"
daily_id=$(awk '/^Sicherungssatz erstellt: /{ print $3 }' "$work_dir/daily.log")
[ -n "$daily_id" ] || { echo "Taeglicher Sicherungssatz wurde nicht erzeugt" >&2; exit 72; }

# Forgejo muss nach dem taeglichen Lauf wieder erreichbar sein.
attempt=0
until source_compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { echo "Forgejo lief nach dem taeglichen Sicherungslauf nicht wieder an" >&2; exit 72; }
  sleep 1
done

echo "== Zweiter Sicherungssatz: stuendlich, inkrementell =="
artifact_two=$(put_artifact "synthetisches artefakt nur im stuendlichen satz")
[ "${#artifact_two}" -eq 64 ] || { echo "Zweites Artefakt konnte nicht abgelegt werden" >&2; exit 72; }

COMPOSE_PROJECT_NAME="$source_project" node "$script_dir/backup-orchestrator.js" \
  --mode hourly \
  --work-dir "$sets_dir" \
  --public-key "$work_dir/recovery.pub" \
  --compose-file "$compose_file" \
  --env-file "$env_file" \
  --source-instance gernetix-e2e \
  --application-version synthetic-e2e >"$work_dir/hourly.log"
hourly_id=$(awk '/^Sicherungssatz erstellt: /{ print $3 }' "$work_dir/hourly.log")
[ -n "$hourly_id" ] || { echo "Stuendlicher Sicherungssatz wurde nicht erzeugt" >&2; exit 72; }
grep -q '1 neu, 1 uebernommen' "$work_dir/hourly.log" || {
  echo "Der stuendliche Satz hat nicht genau ein neues und ein uebernommenes Artefakt:" >&2
  cat "$work_dir/hourly.log" >&2
  exit 72
}

# Bestand der Quelle festhalten, damit der Restore dagegen gehalten werden kann.
cat >"$work_dir/bestand.sql" <<'SQL'
SELECT format('{"identity_user_accounts":%s,"project_projects":%s,"project_artifacts":%s,"device_management_devices":%s,"device_management_account_devices":%s,"hardware_catalog_items":%s,"hardware_shop_orders":%s}',
  (SELECT count(*) FROM identity_user_accounts),
  (SELECT count(*) FROM project_projects),
  (SELECT count(*) FROM project_artifacts),
  (SELECT count(*) FROM device_management_devices),
  (SELECT count(*) FROM device_management_account_devices),
  (SELECT count(*) FROM hardware_catalog_items),
  (SELECT count(*) FROM hardware_shop_orders));
SQL
runtime_query source_compose <"$work_dir/bestand.sql" | tr -d '\r' | head -n 1 >"$work_dir/bestand.json"
grep -q '"identity_user_accounts":2' "$work_dir/bestand.json" || {
  echo "Bestandsaufnahme der Quelle ist unbrauchbar: $(cat "$work_dir/bestand.json")" >&2
  exit 72
}

echo "== Sicherungssatz entschluesseln und pruefen =="
node "$script_dir/restore-backup-set.js" "$sets_dir/$hourly_id" \
  --private-key "$work_dir/recovery.key" \
  --target-dir "$work_dir/bestandteile" \
  --store-dir "$sets_dir" \
  --artifacts-dir "$work_dir/artefakte" \
  --report "$work_dir/restore-protokoll.json" >"$work_dir/restore.log"
grep -q "1 aus diesem Satz, 1 aus 1 frueheren" "$work_dir/restore.log" || {
  echo "Die Artefakte wurden nicht ueber beide Saetze nachgewiesen:" >&2
  cat "$work_dir/restore.log" >&2
  exit 72
}

echo "== In ein leeres, isoliertes Projekt einspielen =="
RESTORE_COMPOSE_PROJECT="$restore_project" \
RESTORE_COMPOSE_FILE="$compose_file" \
RESTORE_ENV_FILE="$env_file" \
RESTORE_EXPECTED_FORGEJO_VERSION="$expected_forgejo_version" \
  "$script_dir/apply-restored-backup-set.sh" "$work_dir/bestandteile" "$work_dir/artefakte"

echo "== Fachliche Pruefung =="
node "$script_dir/check-restored-runtime.js" \
  --compose-project "$restore_project" \
  --compose-file "$compose_file" \
  --env-file "$env_file" \
  --expected-row-counts "$work_dir/bestand.json" \
  --report "$work_dir/fachpruefung.json"

echo "== Projektdateien aus dem Restore =="
restore_port=$(restore_compose port forgejo 3000)
restored_clone="$work_dir/restored-clone"
GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 \
  git clone "http://$restore_port/restore-contract/backup-proof.git" "$restored_clone" >/dev/null
git -C "$restored_clone" ls-tree -r --full-tree HEAD >"$work_dir/restored-tree.txt"
git -C "$restored_clone" log --reverse --format='%H %P %T %s' >"$work_dir/restored-history.txt"

cmp "$work_dir/source-tree.txt" "$work_dir/restored-tree.txt"
cmp "$work_dir/source-history.txt" "$work_dir/restored-history.txt"
[ "$(git -C "$restored_clone" rev-parse HEAD)" = "$source_head" ]
[ "$(git -C "$restored_clone" branch --show-current)" = main ]
cmp "$seed_repo/README.md" "$restored_clone/README.md"
cmp "$seed_repo/gernetix/project.json" "$restored_clone/gernetix/project.json"

# Die wiederhergestellte Projektzeile muss genau auf diesen Commit zeigen.
restored_head=$(printf "SELECT head_sha FROM project_projects WHERE project_id = 'project-synthetic-1';\n" \
  | runtime_query restore_compose | tr -d '\r\n ')
[ "$restored_head" = "$source_head" ] || {
  echo "Die Repository-Bindung des Projekts zeigt nach dem Restore auf $restored_head statt auf $source_head" >&2
  exit 72
}

echo "== Artifact Store aus beiden Saetzen =="
for expected_object in "$artifact_one" "$artifact_two"; do
  printf '%s' "$expected_object" | restore_compose run --rm --no-deps -T --entrypoint sh public-demo-server -c '
    set -eu
    sha=$(cat)
    file="/var/lib/gernetix/build/artifacts/objects/$(echo "$sha" | cut -c1-2)/$sha"
    test -f "$file"
    actual=$(sha256sum "$file" | cut -d" " -f1)
    test "$actual" = "$sha"
  ' >/dev/null || { echo "Artefakt $expected_object fehlt oder ist beschaedigt" >&2; exit 72; }
done

echo "== Negativfall: veraendertes Objekt im Sicherungssatz =="
tampered_dir="$work_dir/manipuliert"
cp -R "$sets_dir/$hourly_id" "$tampered_dir"
printf 'x' >>"$tampered_dir/runtime-database.dump.gxb"
if node "$script_dir/restore-backup-set.js" "$tampered_dir" \
  --private-key "$work_dir/recovery.key" \
  --target-dir "$work_dir/bestandteile-manipuliert" \
  --store-dir "$sets_dir" >/dev/null 2>&1; then
  echo "Ein veraenderter Sicherungssatz wurde unerwartet akzeptiert" >&2
  exit 72
fi
[ ! -d "$work_dir/bestandteile-manipuliert" ] || [ -z "$(ls -A "$work_dir/bestandteile-manipuliert")" ] || {
  echo "Ein veraenderter Satz hat trotzdem Bestandteile abgelegt" >&2
  exit 72
}
[ -z "$(docker volume ls --filter "label=com.docker.compose.project=$tampered_project" -q)" ]

echo "== Negativfall: fehlender frueherer Satz =="
isolated_store="$work_dir/nur-stuendlich"
mkdir -m 0700 "$isolated_store"
cp -R "$sets_dir/$hourly_id" "$isolated_store/$hourly_id"
if node "$script_dir/restore-backup-set.js" "$isolated_store/$hourly_id" \
  --private-key "$work_dir/recovery.key" \
  --target-dir "$work_dir/bestandteile-unvollstaendig" \
  --store-dir "$isolated_store" >/dev/null 2>&1; then
  echo "Ein Punkt ohne den benoetigten frueheren Satz wurde unerwartet akzeptiert" >&2
  exit 72
fi

elapsed_seconds=$(($(date +%s) - started_epoch))
printf 'GO: Kundendaten-Backup- und Restore-Nachweis bestanden; taeglich=%s; stuendlich=%s; HEAD=%s; Dauer=%ss\n' \
  "$daily_id" "$hourly_id" "$source_head" "$elapsed_seconds"
