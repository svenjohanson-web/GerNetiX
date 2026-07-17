#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../.."

test -f .env.public-demo.vps
docker network inspect gernetix_edge >/dev/null
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml config >/dev/null
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml up --build -d --wait
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml exec -T public-demo-server sh -lc '
  /opt/platformio/bin/platformio run --project-dir /app/Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung/firmware
  node /app/tools/publish-touch-demo-release.js
'
docker compose --env-file .env.public-demo.vps -f compose.public-demo.vps.yaml ps
