#!/usr/bin/env bash
set -euo pipefail

# Runs on the VPS as an unprivileged, read-only observer. It never sends IP
# addresses or raw log lines to GerNetiX; only a short aggregated finding.
: "${SECURITY_MONITOR_TOKEN:?SECURITY_MONITOR_TOKEN must be set}"
ADMIN_URL="${GERNETIX_ADMIN_URL:-http://127.0.0.1:4600/api/internal/security-events}"

post_event() {
  local severity="$1" event_type="$2" message="$3" alert_key="$4"
  curl --fail --silent --show-error --max-time 10 -X POST "$ADMIN_URL" \
    -H 'content-type: application/json' \
    -H "x-gernetix-security-monitor-token: ${SECURITY_MONITOR_TOKEN}" \
    --data "{\"severity\":\"${severity}\",\"source_service\":\"vps-security-monitor\",\"event_type\":\"${event_type}\",\"message\":\"${message}\",\"alert_key\":\"${alert_key}\"}" >/dev/null
}

banned="$(fail2ban-client status sshd 2>/dev/null | awk -F: '/Currently banned:/ {gsub(/ /, "", $2); print $2}')"
if [[ "${banned:-0}" =~ ^[1-9][0-9]*$ ]]; then
  post_event error fail2ban_ban "Fail2ban hat aktuell ${banned} SSH-Adresse(n) gesperrt." fail2ban_ban
fi

failed_units="$(systemctl --failed --no-legend --plain 2>/dev/null | grep -cve '^$' || true)"
if [[ "${failed_units:-0}" =~ ^[1-9][0-9]*$ ]]; then
  post_event critical failed_systemd_unit "Der VPS meldet ${failed_units} fehlgeschlagene Systemdienste." failed_systemd_unit
fi

unhealthy="$(docker compose -f /opt/gernetix/compose.vps.yaml ps --format json 2>/dev/null | grep -ciE 'unhealthy|exited|dead' || true)"
if [[ "${unhealthy:-0}" =~ ^[1-9][0-9]*$ ]]; then
  post_event critical unhealthy_container "Der VPS meldet ${unhealthy} ungesunde oder beendete GerNetiX-Container." unhealthy_container
fi
