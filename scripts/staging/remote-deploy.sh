#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

env_file=${GERNETIX_STAGING_ENV_FILE:-.env.vps}
wait_timeout=${GERNETIX_STAGING_WAIT_TIMEOUT:-180}
if [ ! -f "$env_file" ]; then
  echo "Fehlende VPS-Konfiguration: $repo_dir/$env_file" >&2
  exit 1
fi

echo "==> Compose-Konfiguration pruefen"
docker compose --env-file "$env_file" -f compose.vps.yaml config --quiet

echo "==> Images bauen"
docker compose --env-file "$env_file" -f compose.vps.yaml build

echo "==> Staging aktualisieren und auf Healthchecks warten"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --force-recreate mqtt-broker
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --wait --wait-timeout "$wait_timeout"

echo "==> Nginx an aktuelle Upstreams und Bind-Mounts binden"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --force-recreate nginx

echo "==> HTTPS-Zertifikat fuer die oeffentlichen GerNetiX-Domains bereitstellen"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile tls run --rm --entrypoint certbot certbot \
  certonly --webroot --webroot-path /var/www/certbot \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring --cert-name gernetix.nl \
  -d gernetix.nl -d www.gernetix.nl \
  -d gernetix.de -d www.gernetix.de \
  -d gernetix.com -d www.gernetix.com

docker compose --env-file "$env_file" -f compose.vps.yaml --profile tls run --rm --entrypoint certbot certbot \
  certonly --webroot --webroot-path /var/www/certbot \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring --cert-name gernetix-services.com \
  -d build.gernetix.com -d mqtt.gernetix.com

echo "==> HTTPS-Nginx und automatische Zertifikatserneuerung starten"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile tls up -d --wait --wait-timeout "$wait_timeout" --force-recreate nginx-tls mqtt-broker certbot

echo "==> Edge- und Admin-Healthchecks"
edge_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port nginx 8080 | sed 's/.*://')
admin_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port admin-tool 4600 | sed 's/.*://')
curl --fail --silent --show-error "http://127.0.0.1:${edge_port}/health"
printf '\n'
curl --fail --silent --show-error --resolve gernetix.nl:443:127.0.0.1 "https://gernetix.nl/" >/dev/null
printf 'HTTPS ok\n'
curl --fail --silent --show-error "http://127.0.0.1:${admin_port}/health"
printf '\n'

echo "==> Containerstatus"
docker compose --env-file "$env_file" -f compose.vps.yaml ps
