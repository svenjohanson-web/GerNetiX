#!/usr/bin/env sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_dir"

env_file=${GERNETIX_STAGING_ENV_FILE:-.env.vps}
wait_timeout=${GERNETIX_STAGING_WAIT_TIMEOUT:-180}
incremental_wait_timeout=${GERNETIX_STAGING_INCREMENTAL_WAIT_TIMEOUT:-45}

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

add_plan_reason() {
  reason=$1
  case "; $plan_reasons;" in
    *"; $reason;"*) ;;
    *) plan_reasons="${plan_reasons}${plan_reasons:+; }${reason}" ;;
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

reload_edge() {
  nginx_container=$(compose ps -q nginx)
  nginx_tls_container=$(compose --profile tls ps -q nginx-tls)
  if [ -z "$nginx_container" ] || [ -z "$nginx_tls_container" ]; then
    echo "Nginx oder Nginx-TLS laeuft nicht; gezieltes Reload wird sicher abgebrochen." >&2
    return 1
  fi
  docker exec "$nginx_container" nginx -t >/dev/null
  docker exec "$nginx_tls_container" nginx -t >/dev/null
  docker exec "$nginx_container" nginx -s reload
  docker exec "$nginx_tls_container" nginx -s reload
  wait_for_private_pwa
}

apply_host_firewall() {
  nft -c -f infra/vps/security/firewall.nft
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
}

previous_commit=${1:-}
operation=${2:-deploy}
deploy_mode=none
incremental_services=""
edge_changed=0
firewall_changed=0
plan_reasons=""
if [ -z "$previous_commit" ] \
  || ! git cat-file -e "${previous_commit}^{commit}" 2>/dev/null \
  || ! git merge-base --is-ancestor "$previous_commit" HEAD; then
  deploy_mode=full
  add_plan_reason "Vorheriger Commit fehlt oder die Historie ist nicht linear"
else
  changed_files=$(git diff --name-only "$previous_commit" HEAD)
  previous_ifs=$IFS
  IFS='
'
  for changed_file in $changed_files; do
    case "$changed_file" in
      docs/*|data/*|model/*|tools/architecture-docs/*|tools/yaml-graph-sqlite/out/*|.github/*|README.md|AGENTS.md)
        ;;
      services/*/test/*|*.test.js)
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
      services/device-voice-orchestrator/*) add_incremental_service device-voice-orchestrator ;;
      services/community-platform/*) add_incremental_service community-platform ;;
      services/ai-context-server/*) add_incremental_service ai-context-server ;;
      services/admin-tool/*) add_incremental_service admin-tool ;;
      services/admin-access-server/*) add_incremental_service admin-access-server ;;
      services/recovery-tool/*) add_incremental_service identity-server ;;
      .dockerignore|docker/*)
        deploy_mode=full
        add_plan_reason "Docker-Builddefinition geaendert: $changed_file"
        break
        ;;
      compose.vps.yaml)
        deploy_mode=full
        add_plan_reason "VPS-Compose-Topologie geaendert: $changed_file"
        break
        ;;
      scripts/staging/*|tools/staging-deploy.js)
        deploy_mode=full
        add_plan_reason "Deploymentlogik geaendert: $changed_file"
        break
        ;;
      infra/vps/nginx/*)
        edge_changed=1
        add_plan_reason "Nginx-Konfiguration oder Edge-Assets geaendert"
        ;;
      infra/vps/security/*)
        firewall_changed=1
        add_plan_reason "Host-Firewall geaendert"
        ;;
      *)
        deploy_mode=full
        add_plan_reason "Nicht gezielt zugeordnete Runtime-Datei: $changed_file"
        break
        ;;
    esac
  done
  IFS=$previous_ifs
  if [ "$deploy_mode" != "full" ] && [ -n "$incremental_services" ]; then
    deploy_mode=incremental
    add_plan_reason "Betroffene Dienste: $incremental_services"
  elif [ "$deploy_mode" != "full" ] && { [ "$edge_changed" -eq 1 ] || [ "$firewall_changed" -eq 1 ]; }; then
    deploy_mode=targeted-infrastructure
  fi
fi

echo "==> Deployment-Plan: $deploy_mode${incremental_services:+ ($incremental_services)}"
echo "    Edge: $([ "$edge_changed" -eq 1 ] && printf 'validieren + neu laden' || printf 'unveraendert')"
echo "    Firewall: $([ "$firewall_changed" -eq 1 ] && printf 'validieren + neu laden' || printf 'unveraendert')"
[ -z "$plan_reasons" ] || echo "    Grund: $plan_reasons"
if [ "$operation" = "--plan-only" ]; then
  exit 0
fi
if [ "$operation" != "deploy" ]; then
  echo "Unbekannte Deployment-Operation: $operation" >&2
  exit 1
fi
if [ "$deploy_mode" = "none" ]; then
  echo "Keine Runtime-Datei geaendert; Commit ist ohne Container-Neustart aktiv."
  exit 0
fi

if [ "${GERNETIX_STAGING_LOCK_HELD:-0}" != "1" ]; then
  if ! command -v flock >/dev/null 2>&1; then
    echo "flock fehlt; parallele Deployments koennen nicht sicher ausgeschlossen werden." >&2
    exit 1
  fi
  lock_file=${GERNETIX_STAGING_LOCK_FILE:-/var/lock/gernetix-staging-deploy.lock}
  exec 9>"$lock_file"
  if ! flock -n 9; then
    echo "Ein anderes Staging-Deployment laeuft bereits." >&2
    exit 1
  fi
fi

deploy_started_at=$(date +%s)
phase_name=""
phase_started_at=$deploy_started_at
begin_phase() {
  next_phase=$1
  phase_now=$(date +%s)
  if [ -n "$phase_name" ]; then
    echo "<== $phase_name: $((phase_now - phase_started_at))s"
  fi
  phase_name=$next_phase
  phase_started_at=$phase_now
  echo "==> $phase_name"
}
report_deploy_duration() {
  deploy_status=$?
  deploy_finished_at=$(date +%s)
  if [ -n "$phase_name" ]; then
    echo "<== $phase_name: $((deploy_finished_at - phase_started_at))s"
  fi
  echo "==> Deployment beendet: Status $deploy_status, Dauer $((deploy_finished_at - deploy_started_at))s"
  trap - EXIT
  exit "$deploy_status"
}
trap report_deploy_duration EXIT

if [ ! -f "$env_file" ]; then
  echo "Fehlende VPS-Konfiguration: $repo_dir/$env_file" >&2
  exit 1
fi

begin_phase "Fehlende Staging-Secrets provisionieren"
chmod 600 "$env_file"
repair_concatenated_hex_secret COMPUTE_INTERNAL_TOKEN
ensure_staging_secret COMPUTE_INTERNAL_TOKEN hex
ensure_staging_secret COMPUTE_WORKER_BOOTSTRAP_TOKEN hex
ensure_staging_secret COMPUTE_WORKER_SIGNING_SECRET hex
ensure_staging_secret COMPUTE_PROJECT_GRANT_SIGNING_SECRET hex
ensure_staging_secret BUILD_ARTIFACT_UPLOAD_TOKEN hex
ensure_staging_secret RUNTIME_STATE_ENCRYPTION_KEY base64
ensure_staging_secret FORGEJO_POSTGRES_PASSWORD hex
ensure_staging_secret FORGEJO_SECRET_KEY hex
ensure_staging_secret FORGEJO_INTERNAL_TOKEN hex

compute_bind_address=$(awk -F= '$1 == "COMPUTE_BIND_ADDRESS" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
compute_bind_address=${compute_bind_address:-127.0.0.1}
if [ "$compute_bind_address" = "0.0.0.0" ] || [ "$compute_bind_address" = "::" ]; then
  echo "COMPUTE_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden." >&2
  exit 1
fi

if [ "$deploy_mode" = "incremental" ]; then
  begin_phase "Compose-Konfiguration pruefen"
  compose config --quiet

  shared_build_service=""
  identity_build_required=0
  for service_name in $incremental_services; do
    if [ "$service_name" = "identity-server" ]; then
      identity_build_required=1
    elif [ -z "$shared_build_service" ]; then
      shared_build_service=$service_name
    fi
  done
  if [ "$identity_build_required" -eq 1 ]; then
    begin_phase "Schlankes Identity-Image bauen"
    compose build identity-server
  fi
  if [ -n "$shared_build_service" ]; then
    begin_phase "Gemeinsames Node-Image einmal ueber $shared_build_service bauen"
    compose build "$shared_build_service"
  fi

  begin_phase "Nur betroffene Services neu erstellen: $incremental_services"
  # Die beabsichtigte Wortaufteilung uebergibt die ermittelten Servicenamen einzeln an Compose.
  # shellcheck disable=SC2086
  compose up -d --no-deps --force-recreate $incremental_services
  for service_name in $incremental_services; do
    wait_for_incremental_service "$service_name"
  done

  if [ "$firewall_changed" -eq 1 ]; then
    begin_phase "Host-Firewall validieren und gezielt neu laden"
    apply_host_firewall
  fi

  case " $incremental_services " in
    *" identity-server "*)
      edge_changed=1
      ;;
  esac
  if [ "$edge_changed" -eq 1 ]; then
    begin_phase "HTTP- und HTTPS-Nginx validieren und ohne Containerwechsel neu laden"
    reload_edge
  fi

  begin_phase "Betroffene Container"
  # shellcheck disable=SC2086
  compose ps $incremental_services
  exit 0
fi

if [ "$deploy_mode" = "targeted-infrastructure" ]; then
  begin_phase "Compose-Konfiguration pruefen"
  compose config --quiet
  if [ "$firewall_changed" -eq 1 ]; then
    begin_phase "Host-Firewall validieren und gezielt neu laden"
    apply_host_firewall
  fi
  if [ "$edge_changed" -eq 1 ]; then
    begin_phase "HTTP- und HTTPS-Nginx validieren und ohne Containerwechsel neu laden"
    reload_edge
  fi
  exit 0
fi

begin_phase "Host-Firewall und MQTT-Verbindungsrate pruefen"
nft -c -f infra/vps/security/firewall.nft

begin_phase "Compose-Konfiguration pruefen"
docker compose --env-file "$env_file" -f compose.vps.yaml config --quiet

begin_phase "Images bauen"
docker compose --env-file "$env_file" -f compose.vps.yaml build

begin_phase "Legacy-PostgreSQL-Secrets fuer eine sichere Erstkonsolidierung pruefen"
legacy_consolidation_required=0
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
    legacy_consolidation_required=1
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

begin_phase "Validierte Host-Firewall installieren"
apply_host_firewall

begin_phase "Staging aktualisieren und auf Healthchecks warten"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --force-recreate mqtt-broker
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --wait --wait-timeout "$wait_timeout"

begin_phase "PostgreSQL-Zugriff fuer externe Build-Worker provisionieren"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile build-worker-provisioning \
  run --rm build-worker-postgres-access

if [ "$legacy_consolidation_required" -eq 1 ]; then
  begin_phase "Vorhandene PostgreSQL-Domaenendaten einmalig zentral konsolidieren"
  docker compose --env-file "$env_file" -f compose.vps.yaml --profile postgres-consolidation \
    run --rm --no-deps postgres-consolidation-migration
else
  begin_phase "Keine Legacy-PostgreSQL-Container: Konsolidierung uebersprungen"
fi

begin_phase "Alte PostgreSQL-Container erst nach erfolgreicher Konsolidierung entfernen"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --remove-orphans

begin_phase "Build-Router an aktuelle Upstreams binden"
docker compose --env-file "$env_file" -f compose.vps.yaml up -d --no-deps --wait \
  --wait-timeout "$wait_timeout" --force-recreate build-router

letsencrypt_dir=$(awk -F= '$1 == "LETSENCRYPT_DIR" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
letsencrypt_dir=${letsencrypt_dir:-/etc/letsencrypt}
if [ ! -s "$letsencrypt_dir/live/gernetix.nl/fullchain.pem" ] \
  || [ ! -s "$letsencrypt_dir/live/gernetix-services.com/fullchain.pem" ]; then
  begin_phase "Fehlende HTTPS-Zertifikate bereitstellen"
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
else
  begin_phase "HTTPS-Zertifikate vorhanden: Ausstellung uebersprungen"
fi

begin_phase "HTTPS-Nginx und automatische Zertifikatserneuerung sicherstellen"
docker compose --env-file "$env_file" -f compose.vps.yaml --profile tls up -d --wait --wait-timeout "$wait_timeout" nginx-tls certbot

begin_phase "HTTP- und HTTPS-Nginx an aktuelle Upstreams und Konfiguration binden"
reload_edge

begin_phase "Edge- und Admin-Healthchecks"
admin_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port admin-tool 4600 | sed 's/.*://')
admin_access_port=$(docker compose --env-file "$env_file" -f compose.vps.yaml port admin-access-server 4610 | sed 's/.*://')
private_vps_bind_address=$(awk -F= '$1 == "PRIVATE_VPS_BIND_ADDRESS" { print $2 }' "$env_file" | tail -n 1 | tr -d '\r')
private_vps_bind_address=${private_vps_bind_address:-10.77.0.1}
if [ "$private_vps_bind_address" = "0.0.0.0" ] || [ "$private_vps_bind_address" = "::" ]; then
  echo "PRIVATE_VPS_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden." >&2
  exit 1
fi
private_pwa_dns_answer=$(dig +short A pwa.gernetix.com "@${private_vps_bind_address}" | head -n 1)
if [ "$private_pwa_dns_answer" != "$private_vps_bind_address" ]; then
  echo "Private DNS-Aufloesung fuer pwa.gernetix.com ist fehlerhaft: ${private_pwa_dns_answer:-keine Antwort}" >&2
  exit 1
fi
printf 'Private DNS-Aufloesung ok\n'
curl --fail --silent --show-error --resolve "pwa.gernetix.com:443:${private_vps_bind_address}" "https://pwa.gernetix.com/health" >/dev/null
printf 'Private PWA HTTPS ok\n'
curl --fail --silent --show-error "http://127.0.0.1:${admin_port}/health"
printf '\n'
curl --fail --silent --show-error "http://127.0.0.1:${admin_access_port}/health"
printf '\n'

begin_phase "Containerstatus"
docker compose --env-file "$env_file" -f compose.vps.yaml ps
