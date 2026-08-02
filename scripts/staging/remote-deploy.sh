#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

env_file=${GERNETIX_STAGING_ENV_FILE:-.env.vps}
wait_timeout=${GERNETIX_STAGING_WAIT_TIMEOUT:-180}
incremental_wait_timeout=${GERNETIX_STAGING_INCREMENTAL_WAIT_TIMEOUT:-45}
if [ ! -f "$env_file" ]; then
  echo "Fehlende VPS-Konfiguration: $repo_dir/$env_file" >&2
  exit 1
fi

ensure_staging_secret() {
  secret_name=$1
  secret_encoding=$2
  if grep -q "^${secret_name}=." "$env_file"; then
    return
  fi
  if [ -s "$env_file" ] && [ -n "$(tail -c 1 "$env_file")" ]; then
    printf '\n' >> "$env_file"
  fi
  case "$secret_encoding" in
    hex) secret_value=$(openssl rand -hex 32) ;;
    base64) secret_value=$(openssl rand -base64 32 | tr -d '\r\n') ;;
    *) echo "Unbekannte Secret-Kodierung fuer $secret_name" >&2; exit 1 ;;
  esac
  printf '%s=%s\n' "$secret_name" "$secret_value" >> "$env_file"
  echo "    $secret_name: fehlenden Staging-Wert sicher erzeugt"
}

repair_concatenated_hex_secret() {
  secret_name=$1
  repair_file="${env_file}.repair.$$"
  awk -v secret_name="$secret_name" '
    {
      marker = secret_name "="
      marker_position = index($0, marker)
      if (marker_position > 1) {
        secret_value = substr($0, marker_position + length(marker))
        if (length(secret_value) == 64 && secret_value ~ /^[0-9a-f]+$/) {
          print substr($0, 1, marker_position - 1)
          print substr($0, marker_position)
          repaired = 1
          next
        }
      }
      print
    }
    END { exit repaired ? 0 : 3 }
  ' "$env_file" > "$repair_file" || repair_status=$?
  repair_status=${repair_status:-0}
  if [ "$repair_status" -eq 0 ]; then
    chmod 600 "$repair_file"
    mv "$repair_file" "$env_file"
    echo "    $secret_name: zusammengefuehrte Staging-Zeile repariert"
  else
    rm -f "$repair_file"
    if [ "$repair_status" -ne 3 ]; then
      echo "Staging-Env konnte fuer $secret_name nicht geprueft werden." >&2
      exit "$repair_status"
    fi
  fi
}

echo "==> Fehlende Compute-Secrets fuer Staging provisionieren"
chmod 600 "$env_file"
repair_concatenated_hex_secret COMPUTE_INTERNAL_TOKEN
ensure_staging_secret COMPUTE_INTERNAL_TOKEN hex
ensure_staging_secret COMPUTE_WORKER_BOOTSTRAP_TOKEN hex
ensure_staging_secret COMPUTE_WORKER_SIGNING_SECRET hex
ensure_staging_secret COMPUTE_PROJECT_GRANT_SIGNING_SECRET hex
ensure_staging_secret RUNTIME_STATE_ENCRYPTION_KEY base64

compute_bind_address=$(awk -F= '$1 == "COMPUTE_BIND_ADDRESS" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
compute_bind_address=${compute_bind_address:-127.0.0.1}
if [ "$compute_bind_address" = "0.0.0.0" ] || [ "$compute_bind_address" = "::" ]; then
  echo "COMPUTE_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden." >&2
  exit 1
fi

compose() {
  docker compose --env-file "$env_file" -f compose.vps.yaml "$@"
}

add_incremental_service() {
  service_name=$1
  case " $incremental_services " in
    *" $service_name "*) ;;
    *) incremental_services="${incremental_services}${incremental_services:+ }${service_name}" ;;
  esac
}

wait_for_incremental_service() {
  service_name=$1
  attempt=0
  while [ "$attempt" -lt "$incremental_wait_timeout" ]; do
    container_id=$(compose ps -q "$service_name")
    if [ -n "$container_id" ] \
      && [ "$(docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null || true)" = "true" ] \
      && docker exec "$container_id" node /app/docker/healthcheck.js >/dev/null 2>&1; then
      echo "    $service_name: bereit nach ${attempt}s"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "$service_name wurde innerhalb von ${incremental_wait_timeout}s nicht bereit." >&2
  compose logs --tail 80 "$service_name" >&2 || true
  return 1
}

wait_for_private_pwa() {
  private_vps_bind_address=$(awk -F= '$1 == "PRIVATE_VPS_BIND_ADDRESS" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
  private_vps_bind_address=${private_vps_bind_address:-10.77.0.1}
  if [ "$private_vps_bind_address" = "0.0.0.0" ] || [ "$private_vps_bind_address" = "::" ]; then
    echo "PRIVATE_VPS_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden." >&2
    return 1
  fi
  attempt=0
  while [ "$attempt" -lt "$incremental_wait_timeout" ]; do
    if curl --fail --silent --max-time 3 --resolve "pwa.gernetix.com:443:${private_vps_bind_address}" "https://pwa.gernetix.com/health" >/dev/null 2>&1; then
      echo "    Private PWA HTTPS: bereit nach ${attempt}s"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "Private PWA wurde innerhalb von ${incremental_wait_timeout}s nicht bereit." >&2
  return 1
}

previous_commit=${1:-}
deploy_mode=none
incremental_services=""
if [ -z "$previous_commit" ] \
  || ! git cat-file -e "${previous_commit}^{commit}" 2>/dev/null \
  || ! git merge-base --is-ancestor "$previous_commit" HEAD; then
  deploy_mode=full
else
  changed_files=$(git diff --name-only "$previous_commit" HEAD)
  previous_ifs=$IFS
  IFS='
'
  for changed_file in $changed_files; do
    case "$changed_file" in
      docs/*|data/*|model/*|tools/architecture-docs/*|tools/yaml-graph-sqlite/out/*|.github/*|README.md|AGENTS.md)
        ;;
      services/*/test/*|services/*.test.js|services/*/*.test.js|tools/*.test.js|scripts/*.test.js)
        ;;
      services/identity-server/*) add_incremental_service identity-server ;;
      services/project-server/*) add_incremental_service project-server ;;
      services/build-deploy-server/*) add_incremental_service build-deploy-server ;;
      services/compute-control-plane/*) add_incremental_service compute-control-plane ;;
      services/public-demo-server/*) add_incremental_service public-demo-server ;;
      services/device-management-server/*) add_incremental_service device-management-server ;;
      services/telemetry-server/*) add_incremental_service telemetry-server ;;
      services/hardware-catalog/*) add_incremental_service hardware-catalog ;;
      services/hardware-shop/*) add_incremental_service hardware-shop ;;
      services/ai-usage-server/*) add_incremental_service ai-usage-server ;;
      services/community-platform/*) add_incremental_service community-platform ;;
      services/ai-context-server/*) add_incremental_service ai-context-server ;;
      services/admin-tool/*) add_incremental_service admin-tool ;;
      services/admin-access-server/*) add_incremental_service admin-access-server ;;
      *) deploy_mode=full; break ;;
    esac
  done
  IFS=$previous_ifs
  if [ "$deploy_mode" != "full" ] && [ -n "$incremental_services" ]; then
    deploy_mode=incremental
  fi
fi

echo "==> Deployment-Plan: $deploy_mode${incremental_services:+ ($incremental_services)}"
if [ "$deploy_mode" = "none" ]; then
  echo "Keine Runtime-Datei geaendert; Commit ist ohne Container-Neustart aktiv."
  exit 0
fi

if [ "$deploy_mode" = "incremental" ]; then
  echo "==> Compose-Konfiguration pruefen"
  compose config --quiet

  build_service=${incremental_services%% *}
  echo "==> Gemeinsames Node-Image einmal ueber $build_service bauen"
  compose build "$build_service"

  echo "==> Nur betroffene Services neu erstellen: $incremental_services"
  # Die beabsichtigte Wortaufteilung uebergibt die ermittelten Servicenamen einzeln an Compose.
  # shellcheck disable=SC2086
  compose up -d --no-deps --force-recreate $incremental_services
  for service_name in $incremental_services; do
    wait_for_incremental_service "$service_name"
  done

  case " $incremental_services " in
    *" identity-server "*)
      echo "==> Nginx nach Identity-Wechsel kurz neu binden"
      compose up -d --no-deps --force-recreate nginx
      nginx_container=$(compose ps -q nginx)
      docker exec "$nginx_container" nginx -t >/dev/null
      wait_for_private_pwa
      ;;
  esac

  echo "==> Betroffene Container"
  # shellcheck disable=SC2086
  compose ps $incremental_services
  exit 0
fi

echo "==> Host-Firewall und MQTT-Verbindungsrate pruefen"
nft -c -f infra/vps/security/firewall.nft

echo "==> Compose-Konfiguration pruefen"
docker compose --env-file "$env_file" -f compose.vps.yaml config --quiet

echo "==> Images bauen"
docker compose --env-file "$env_file" -f compose.vps.yaml build

echo "==> Legacy-PostgreSQL-Secrets fuer eine sichere Erstkonsolidierung pruefen"
for legacy_spec in \
  "identity-postgres:IDENTITY_POSTGRES_PASSWORD" \
  "project-postgres:PROJECT_POSTGRES_PASSWORD" \
  "telemetry-postgres:TELEMETRY_POSTGRES_PASSWORD" \
  "community-postgres:COMMUNITY_POSTGRES_PASSWORD" \
  "device-management-postgres:DEVICE_MANAGEMENT_POSTGRES_PASSWORD" \
  "ai-usage-postgres:AI_USAGE_POSTGRES_PASSWORD" \
  "hardware-catalog-postgres:HARDWARE_CATALOG_POSTGRES_PASSWORD" \
  "hardware-shop-postgres:HARDWARE_SHOP_POSTGRES_PASSWORD" \
  "operations-postgres:OPERATIONS_POSTGRES_PASSWORD" \
  "ai-context-postgres:AI_CONTEXT_POSTGRES_PASSWORD"
do
  legacy_service=${legacy_spec%%:*}
  legacy_secret=${legacy_spec#*:}
  legacy_container=$(docker ps -aq --filter "label=com.docker.compose.service=$legacy_service" | head -n 1)
  if [ -n "$legacy_container" ]; then
    if [ "$(docker inspect -f '{{.State.Running}}' "$legacy_container")" != "true" ]; then
      echo "Legacy-Container $legacy_service ist gestoppt; vor der Konsolidierung kontrolliert starten." >&2
      exit 1
    fi
    if ! grep -q "^${legacy_secret}=." "$env_file"; then
      echo "Bestehender Container $legacy_service erfordert $legacy_secret fuer die Konsolidierung." >&2
      exit 1
    fi
  fi
done

echo "==> Validierte Host-Firewall installieren"
install -d -m 0755 /etc/gernetix
install -m 0644 infra/vps/security/firewall.nft /etc/gernetix/firewall.nft
install -m 0755 infra/vps/security/gernetix-firewall-apply /usr/local/sbin/gernetix-firewall-apply
install -m 0644 infra/vps/security/gernetix-firewall.service /etc/systemd/system/gernetix-firewall.service
systemctl daemon-reload
systemctl enable gernetix-firewall.service >/dev/null
if systemctl is-active --quiet gernetix-firewall.service; then
  systemctl reload gernetix-firewall.service
else
  systemctl start gernetix-firewall.service
fi

echo "==> Staging aktualisieren und auf Healthchecks warten"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --force-recreate mqtt-broker
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --force-recreate runtime-postgres
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --wait --wait-timeout "$wait_timeout"

echo "==> PostgreSQL-Zugriff fuer externe Build-Worker provisionieren"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile build-worker-provisioning \
  run --rm build-worker-postgres-access

echo "==> Vorhandene PostgreSQL-Domaenendaten einmalig zentral konsolidieren"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile postgres-consolidation \
  run --rm --no-deps postgres-consolidation-migration

echo "==> Alte PostgreSQL-Container erst nach erfolgreicher Konsolidierung entfernen"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --remove-orphans

echo "==> Build-Router und Nginx an aktuelle Upstreams und Bind-Mounts binden"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --wait \
  --wait-timeout "$wait_timeout" --force-recreate build-router nginx

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
  -d build.gernetix.com -d mqtt.gernetix.com -d pwa.gernetix.com

echo "==> HTTPS-Nginx und automatische Zertifikatserneuerung starten"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile tls up -d --wait --wait-timeout "$wait_timeout" --force-recreate nginx-tls mqtt-broker certbot

echo "==> Edge- und Admin-Healthchecks"
admin_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port admin-tool 4600 | sed 's/.*://')
admin_access_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port admin-access-server 4610 | sed 's/.*://')
private_vps_bind_address=$(awk -F= '$1 == "PRIVATE_VPS_BIND_ADDRESS" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
private_vps_bind_address=${private_vps_bind_address:-10.77.0.1}
if [ "$private_vps_bind_address" = "0.0.0.0" ] || [ "$private_vps_bind_address" = "::" ]; then
  echo "PRIVATE_VPS_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden." >&2
  exit 1
fi
curl --fail --silent --show-error --resolve "pwa.gernetix.com:443:${private_vps_bind_address}" "https://pwa.gernetix.com/health" >/dev/null
printf 'Private PWA HTTPS ok\n'
curl --fail --silent --show-error "http://127.0.0.1:${admin_port}/health"
printf '\n'
curl --fail --silent --show-error "http://127.0.0.1:${admin_access_port}/health"
printf '\n'

echo "==> Containerstatus"
docker compose --env-file "$env_file" -f compose.vps.yaml ps
