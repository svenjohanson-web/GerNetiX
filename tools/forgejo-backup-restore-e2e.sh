#!/bin/sh
set -eu

command -v docker >/dev/null 2>&1 || { echo "Docker fehlt; Container-Nachweis nicht gestartet" >&2; exit 69; }
docker info >/dev/null 2>&1 || { echo "Docker-Daemon ist nicht erreichbar; Container-Nachweis nicht gestartet" >&2; exit 69; }
command -v git >/dev/null 2>&1 || { echo "Git fehlt" >&2; exit 69; }
command -v curl >/dev/null 2>&1 || { echo "curl fehlt" >&2; exit 69; }
command -v openssl >/dev/null 2>&1 || { echo "openssl fehlt" >&2; exit 69; }

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
run_id="$(date -u +%Y%m%d%H%M%S)-$$"
started_epoch=$(date +%s)
source_project="gernetix-forgejo-source-$run_id"
restore_project="gernetix-forgejo-restore-$run_id"
bad_checksum_project="gernetix-forgejo-restore-bad-checksum-$run_id"
incomplete_project="gernetix-forgejo-restore-incomplete-$run_id"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/gernetix-forgejo-restore-e2e.XXXXXX")
env_file="$work_dir/synthetic.env"
backup_dir="$work_dir/backup"
compose_file="$script_dir/forgejo-backup-restore-test.compose.yaml"
test_password="Aa1-$(openssl rand -hex 24)"
postgres_password=$(openssl rand -hex 32)
secret_key=$(openssl rand -hex 32)
internal_token=$(openssl rand -hex 48)

cleanup() {
  for project in "$source_project" "$restore_project" "$bad_checksum_project" "$incomplete_project"; do
    docker compose --project-name "$project" --env-file "$env_file" -f "$compose_file" \
      down --volumes --remove-orphans >/dev/null 2>&1 || true
  done
  case "$work_dir" in
    ${TMPDIR:-/tmp}/gernetix-forgejo-restore-e2e.*) rm -rf -- "$work_dir" ;;
  esac
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

cat >"$env_file" <<EOF
FORGEJO_TEST_POSTGRES_PASSWORD=$postgres_password
FORGEJO_TEST_SECRET_KEY=$secret_key
FORGEJO_TEST_INTERNAL_TOKEN=$internal_token
EOF
chmod 0600 "$env_file"

source_compose() {
  docker compose --project-name "$source_project" --env-file "$env_file" -f "$compose_file" "$@"
}

source_compose up -d >/dev/null
attempt=0
until source_compose exec -T forgejo wget --quiet --spider http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo "Synthetische Forgejo-Quelle wurde nicht gesund" >&2; exit 71; }
  sleep 1
done

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
printf '%s\n' '{"contract":"backup-restore","revision":2}' >"$seed_repo/gernetix/project.json"
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

COMPOSE_PROJECT_NAME="$source_project" \
COMPOSE_FILE="$compose_file" \
ENV_FILE="$env_file" \
  "$script_dir/backup-forgejo.sh" "$backup_dir"

RESTORE_COMPOSE_PROJECT="$restore_project" \
RESTORE_COMPOSE_FILE="$compose_file" \
RESTORE_ENV_FILE="$env_file" \
RESTORE_EXPECTED_FORGEJO_VERSION=15.0.6 \
  "$script_dir/restore-forgejo-backup.sh" "$backup_dir"

restore_port=$(docker compose --project-name "$restore_project" --env-file "$env_file" -f "$compose_file" port forgejo 3000)
restore_url="http://$restore_port"
restored_clone="$work_dir/restored-clone"
GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 git clone "$restore_url/restore-contract/backup-proof.git" "$restored_clone" >/dev/null
git -C "$restored_clone" ls-tree -r --full-tree HEAD >"$work_dir/restored-tree.txt"
git -C "$restored_clone" log --reverse --format='%H %P %T %s' >"$work_dir/restored-history.txt"

cmp "$work_dir/source-tree.txt" "$work_dir/restored-tree.txt"
cmp "$work_dir/source-history.txt" "$work_dir/restored-history.txt"
[ "$(git -C "$restored_clone" rev-parse HEAD)" = "$source_head" ]
[ "$(git -C "$restored_clone" branch --show-current)" = main ]
cmp "$seed_repo/README.md" "$restored_clone/README.md"
cmp "$seed_repo/gernetix/project.json" "$restored_clone/gernetix/project.json"

bad_backup="$work_dir/bad-checksum"
cp -R "$backup_dir" "$bad_backup"
printf '%s\n' tampered >>"$bad_backup/forgejo-database.dump"
if RESTORE_COMPOSE_PROJECT="$bad_checksum_project" RESTORE_COMPOSE_FILE="$compose_file" \
  RESTORE_ENV_FILE="$env_file" RESTORE_EXPECTED_FORGEJO_VERSION=15.0.6 \
  "$script_dir/restore-forgejo-backup.sh" "$bad_backup"; then
  echo "Falsche Pruefsumme wurde unerwartet akzeptiert" >&2
  exit 72
fi
[ -z "$(docker volume ls --filter "label=com.docker.compose.project=$bad_checksum_project" -q)" ]

incomplete_backup="$work_dir/incomplete"
cp -R "$backup_dir" "$incomplete_backup"
rm "$incomplete_backup/forgejo-data.tar.gz"
if RESTORE_COMPOSE_PROJECT="$incomplete_project" RESTORE_COMPOSE_FILE="$compose_file" \
  RESTORE_ENV_FILE="$env_file" RESTORE_EXPECTED_FORGEJO_VERSION=15.0.6 \
  "$script_dir/restore-forgejo-backup.sh" "$incomplete_backup"; then
  echo "Unvollstaendiger Satz wurde unerwartet akzeptiert" >&2
  exit 72
fi
[ -z "$(docker volume ls --filter "label=com.docker.compose.project=$incomplete_project" -q)" ]

elapsed_seconds=$(($(date +%s) - started_epoch))
printf 'GO: synthetischer Backup-/Restore-Nachweis bestanden; HEAD=%s; Dauer=%ss\n' "$source_head" "$elapsed_seconds"
