#!/usr/bin/env sh
set -eu

env_file=${1:-.env.vps}
username=${2:-}

case "$username" in
  ""|*[!a-z0-9._-]*|.*|-*)
    echo "Ungueltiger Forgejo-Entwicklername." >&2
    exit 1
    ;;
esac

compose() {
  docker compose --env-file "$env_file" -f compose.vps.yaml "$@"
}

if ! compose exec -T forgejo forgejo admin user list | awk -v username="$username" 'NR > 1 && $2 == username { found = 1 } END { exit found ? 0 : 1 }'; then
  compose exec -T forgejo forgejo admin user create \
    --username "$username" \
    --random-password \
    --email "${username}@localhost.invalid" \
    --must-change-password=false >/dev/null
fi

access_json=$(compose exec -T project-server node /app/tools/provision-forgejo-developer-access.js --username "$username" | tr -d '\r')
token_name="desktop-$(date +%s)"
token=$(compose exec -T forgejo forgejo admin user generate-access-token \
  --username "$username" \
  --token-name "$token_name" \
  --scopes 'write:repository' \
  --raw | tr -d '\r\n')
test -n "$token"

# Die erste Zeile wird ausschliesslich vom lokalen Setup-Werkzeug eingelesen
# und niemals an dessen Standardausgabe weitergereicht.
printf '%s\n%s\n' "$token" "$access_json"
