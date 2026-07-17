#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."

test -f .env.public-demo.vps
docker network inspect gernetix_edge >/dev/null
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml config >/dev/null
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml up --build -d
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml ps
