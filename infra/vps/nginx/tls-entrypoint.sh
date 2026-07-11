#!/bin/sh
set -eu

nginx -g 'daemon off;' &
nginx_pid=$!
trap 'nginx -s quit; wait "$nginx_pid"' TERM INT

while kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 21600 &
  wait $! || true
  kill -0 "$nginx_pid" 2>/dev/null && nginx -s reload
done

wait "$nginx_pid"
