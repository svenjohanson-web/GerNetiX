#!/bin/sh
set -eu

target=/var/run/gernetix/build-workers.inc
mkdir -p "$(dirname "$target")"
printf '%s\n' 'server build-deploy-server:4400 max_fails=2 fail_timeout=15s;' > "$target"

old_ifs=$IFS
IFS=','
for upstream in ${BUILD_WORKER_UPSTREAMS:-}; do
  upstream=$(printf '%s' "$upstream" | tr -d '[:space:]')
  [ -z "$upstream" ] && continue
  case "$upstream" in
    *[!A-Za-z0-9._:-]*|*:*:*)
      echo "Ungueltiger BUILD_WORKER_UPSTREAMS-Eintrag: $upstream" >&2
      exit 1
      ;;
    *:*) ;;
    *)
      echo "Build-Worker braucht Host und Port: $upstream" >&2
      exit 1
      ;;
  esac
  printf 'server %s max_fails=2 fail_timeout=15s;\n' "$upstream" >> "$target"
done
IFS=$old_ifs

exec nginx -c /etc/nginx/build-router.conf -g 'daemon off;'
