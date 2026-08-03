#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
base_compose="$script_dir/../forgejo-integration/compose.yaml"
ui_compose="$script_dir/compose.yaml"
project_name="gernetix-forgejo-ui-e2e-$$"

export FORGEJO_INTEGRATION_SECRET_KEY="ui-e2e-secret-key-$project_name"
export FORGEJO_INTEGRATION_INTERNAL_TOKEN="ui-e2e-internal-token-$project_name-0000000000000000000000000000000000000000000000000000000000000000"
export FORGEJO_UI_E2E_SESSION_TOKEN="ui-e2e-session-$project_name-00000000000000000000000000000000"

compose() {
  docker compose --project-name "$project_name" --file "$base_compose" --file "$ui_compose" "$@"
}

cleanup() {
  compose --profile ui-e2e down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

printf '%s\n' "Starte isolierten Forgejo-UI-E2E-Nachweis $project_name (keine Hostports)."
compose up --detach --wait postgres forgejo

compose exec --no-TTY forgejo forgejo admin user create \
  --username ui-e2e-admin \
  --password ui-e2e-admin-only \
  --email ui-e2e-admin@example.invalid \
  --admin \
  --must-change-password=false >/dev/null

access_token=$(compose exec --no-TTY forgejo forgejo admin user generate-access-token \
  --username ui-e2e-admin \
  --token-name ui-e2e-adapter \
  --scopes all \
  --raw | tr -d '\r\n')
if [ -z "$access_token" ]; then
  printf '%s\n' "Forgejo erzeugte keinen synthetischen UI-E2E-Token." >&2
  exit 1
fi
export FORGEJO_UI_E2E_ACCESS_TOKEN="$access_token"

compose --profile ui-e2e run --rm --no-deps ui-e2e
printf '%s\n' "Forgejo-UI-E2E bestanden; Testcontainer, Netzwerke und Volumes werden entfernt."
