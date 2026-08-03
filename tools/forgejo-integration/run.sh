#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_name="gernetix-forgejo-it-$$"
compose_file="$script_dir/compose.yaml"

export FORGEJO_INTEGRATION_SECRET_KEY="integration-secret-key-$project_name"
export FORGEJO_INTEGRATION_INTERNAL_TOKEN="integration-internal-token-$project_name-0000000000000000000000000000000000000000000000000000000000000000"

compose() {
  docker compose --project-name "$project_name" --file "$compose_file" "$@"
}

cleanup() {
  compose --profile test down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

printf '%s\n' "Starte isoliertes Compose-Projekt $project_name (keine Host-Ports)."
compose up --detach --wait postgres forgejo

compose exec --no-TTY forgejo forgejo admin user create \
  --username integration-admin \
  --password integration-admin-only \
  --email integration-admin@example.invalid \
  --admin \
  --must-change-password=false >/dev/null

access_token=$(compose exec --no-TTY forgejo forgejo admin user generate-access-token \
  --username integration-admin \
  --token-name adapter-integration \
  --scopes all \
  --raw | tr -d '\r\n')
if [ -z "$access_token" ]; then
  printf '%s\n' "Forgejo erzeugte keinen synthetischen Zugriffstoken." >&2
  exit 1
fi
export FORGEJO_INTEGRATION_ACCESS_TOKEN="$access_token"

compose --profile test run --rm --no-deps test-state-init
FORGEJO_INTEGRATION_TEST_PHASE=initial compose --profile test run --rm --no-deps adapter-test

printf '%s\n' "Starte ausschließlich den isolierten Forgejo-Testcontainer neu."
compose restart forgejo >/dev/null
compose up --detach --wait forgejo >/dev/null
FORGEJO_INTEGRATION_TEST_PHASE=restart compose --profile test run --rm --no-deps adapter-test

compose exec --no-TTY --env PGPASSWORD=integration-forgejo-only postgres \
  psql --host 127.0.0.1 --username forgejo --dbname forgejo --no-psqlrc --tuples-only --no-align \
  --command 'SELECT current_database();' | grep -Fxq forgejo

if compose exec --no-TTY --env PGPASSWORD=integration-forgejo-only postgres \
  psql --host 127.0.0.1 --username forgejo --dbname gernetix_runtime --no-psqlrc \
  --command 'SELECT 1;' >/dev/null 2>&1; then
  printf '%s\n' "FEHLER: Forgejo-Rolle konnte gernetix_runtime öffnen." >&2
  exit 1
fi
printf '%s\n' "OK database: Forgejo-Rolle erreicht forgejo und wird von gernetix_runtime abgewiesen."
printf '%s\n' "Alle isolierten Forgejo-Integrationstests bestanden; Testcontainer und -Volumes werden entfernt."
