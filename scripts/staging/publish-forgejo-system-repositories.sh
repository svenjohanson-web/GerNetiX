#!/usr/bin/env sh
set -eu

env_file=${1:-.env.vps}

compose() {
  docker compose --env-file "$env_file" -f compose.vps.yaml "$@"
}

upsert_env() {
  key=$1
  value=$2
  temporary_file="${env_file}.tmp.$$"
  awk -v key="$key" -v value="$value" '
    $0 ~ ("^" key "=") { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$env_file" > "$temporary_file"
  chmod 600 "$temporary_file"
  mv "$temporary_file" "$env_file"
}

ensure_service_access() {
  username=gernetix-system-repositories
  if ! compose exec -T forgejo forgejo admin user list | awk -v username="$username" 'NR > 1 && $2 == username { found = 1 } END { exit found ? 0 : 1 }'; then
    password=$(openssl rand -base64 36 | tr -d '\r\n')
    compose exec -T forgejo forgejo admin user create \
      --username "$username" \
      --password "$password" \
      --email "gernetix-system-repositories@localhost.invalid" \
      --admin \
      --must-change-password=false >/dev/null
    echo "Forgejo-Systemkonto angelegt."
  fi

  changed=0
  if ! grep -q '^FORGEJO_PROVISION_TOKEN=.' "$env_file"; then
    token=$(compose exec -T forgejo forgejo admin user generate-access-token \
      --username "$username" --token-name gernetix-provision --scopes 'write:organization,write:repository' --raw | tr -d '\r\n')
    test -n "$token"
    upsert_env FORGEJO_PROVISION_TOKEN "$token"
    changed=1
  fi
  if ! grep -q '^FORGEJO_RUNTIME_TOKEN=.' "$env_file"; then
    token=$(compose exec -T forgejo forgejo admin user generate-access-token \
      --username "$username" --token-name gernetix-runtime --scopes 'write:repository' --raw | tr -d '\r\n')
    test -n "$token"
    upsert_env FORGEJO_RUNTIME_TOKEN "$token"
    changed=1
  fi
  if [ "$changed" -eq 1 ]; then
    compose up -d --no-deps --force-recreate --wait --wait-timeout 90 project-server >/dev/null
    echo "Forgejo-Servicezugang aktiviert."
  fi
}

ensure_service_access
published=$(compose exec -T project-server node /app/tools/publish-forgejo-system-repositories.js --apply)
assignments=$(printf '%s\n' "$published" | sed -n 's/.*"environment_variable": "\([^"]*\)".*/\1/p')
count=0
printf '%s\n' "$assignments" | while IFS='=' read -r key value; do
  test -n "$key"
  test -n "$value"
  upsert_env "$key" "$value"
  count=$((count + 1))
done
compose up -d --no-deps --force-recreate --wait --wait-timeout 90 project-server >/dev/null
printf 'Forgejo-Systemquellen veroeffentlicht und %s Commit-Referenzen aktiviert.\n' "$(printf '%s\n' "$assignments" | grep -c .)"
