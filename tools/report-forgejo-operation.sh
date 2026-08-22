#!/bin/sh
set -eu

event_type=${1:-}
version=${2:-}
case "$event_type" in forgejo.backup.completed|forgejo.restore.completed|forgejo.upgrade.completed) ;; *) echo "Unbekannter Forgejo-Betriebsereignistyp" >&2; exit 64 ;; esac
url=${FORGEJO_OPERATIONS_EVENT_URL:-}
token=${FORGEJO_OPERATIONS_EVENT_TOKEN:-}
if [ -z "$url" ] && [ -z "$token" ]; then exit 0; fi
[ -n "$url" ] && [ -n "$token" ] || { echo "Operations-URL und Token muessen gemeinsam gesetzt sein" >&2; exit 65; }
printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "Forgejo-Patchversion fehlt" >&2; exit 65; }
case "$url" in https://*|http://127.0.0.1:*|http://localhost:*) ;; *) echo "Unsicheres Operations-Ereignisziel" >&2; exit 65 ;; esac
command -v curl >/dev/null 2>&1 || { echo "curl fehlt fuer den Operations-Nachweis" >&2; exit 69; }
curl --fail --silent --show-error --max-time 10 \
  -H "X-GerNetiX-System-Event-Token: $token" \
  -H "Content-Type: application/json" \
  --data "{\"severity\":\"info\",\"source_service\":\"forgejo-operations\",\"target_service\":\"forgejo\",\"category\":\"backup_restore\",\"event_type\":\"$event_type\",\"message\":\"Forgejo operation completed\",\"details\":{\"forgejo_version\":\"$version\"}}" \
  "$url" >/dev/null
