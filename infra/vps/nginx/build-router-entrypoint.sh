#!/bin/sh
set -eu

target=${BUILD_ROUTER_INCLUDE_PATH:-/var/run/gernetix/build-workers.inc}
mkdir -p "$(dirname "$target")"
: > "$target"

validate_upstream() {
  upstream=$1
  case "$upstream" in
    *[!A-Za-z0-9._:-]*|*:*:*)
      echo "Ungueltiger Build-Worker-Eintrag: $upstream" >&2
      exit 1
      ;;
    *:*) ;;
    *)
      echo "Build-Worker braucht Host und Port: $upstream" >&2
      exit 1
      ;;
  esac
}

primary_count=0
old_ifs=$IFS
IFS=','
for upstream in ${BUILD_WORKER_PRIMARY_UPSTREAMS:-}; do
  upstream=$(printf '%s' "$upstream" | tr -d '[:space:]')
  [ -z "$upstream" ] && continue
  validate_upstream "$upstream"
  printf 'server %s max_fails=1 fail_timeout=10s;\n' "$upstream" >> "$target"
  primary_count=$((primary_count + 1))
done
IFS=$old_ifs

fallback_option=
if [ "$primary_count" -gt 0 ]; then
  fallback_option=' backup'
fi

printf 'server build-deploy-server:4400 max_fails=2 fail_timeout=15s%s;\n' "$fallback_option" >> "$target"

IFS=','
for upstream in ${BUILD_WORKER_UPSTREAMS:-}; do
  upstream=$(printf '%s' "$upstream" | tr -d '[:space:]')
  [ -z "$upstream" ] && continue
  validate_upstream "$upstream"
  printf 'server %s max_fails=2 fail_timeout=15s%s;\n' "$upstream" "$fallback_option" >> "$target"
done
IFS=$old_ifs

exec nginx -c /etc/nginx/build-router.conf -g 'daemon off;'
