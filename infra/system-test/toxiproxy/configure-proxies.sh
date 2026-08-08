#!/bin/sh
set -eu

api_url="${TOXIPROXY_API_URL:?TOXIPROXY_API_URL is required}"

create_proxy() {
  proxy_name="$1"
  listen_address="$2"
  upstream_address="$3"

  curl --fail --silent --show-error \
    --request DELETE \
    "$api_url/proxies/$proxy_name" >/dev/null 2>&1 || true

  curl --fail --silent --show-error \
    --header 'Content-Type: application/json' \
    --data "{\"name\":\"$proxy_name\",\"listen\":\"$listen_address\",\"upstream\":\"$upstream_address\",\"enabled\":true}" \
    "$api_url/proxies" >/dev/null
}

create_proxy postgres "0.0.0.0:15432" "postgres:5432"
create_proxy mqtt "0.0.0.0:11883" "mosquitto:1883"
create_proxy forgejo "0.0.0.0:13000" "forgejo:3000"
