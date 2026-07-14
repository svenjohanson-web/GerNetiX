#!/bin/sh
set -eu

# The asymmetric migration no longer reads this legacy password database.
# Remove it once at broker start so old derived Device passwords do not remain at rest.
rm -f /mosquitto/data/passwords

config=/mosquitto/config/mosquitto.conf
certificate=/etc/letsencrypt/live/gernetix-services.com/fullchain.pem
private_key=/etc/letsencrypt/live/gernetix-services.com/privkey.pem
device_ca=/mosquitto/config/device-ca.pem

if [ ! -r "$certificate" ] || [ ! -r "$private_key" ] || [ ! -r "$device_ca" ]; then
  echo "MQTT TLS certificate or Device CA is not available; starting internal listeners only"
  awk '/^listener 8883 / { exit } { print }' "$config" >/tmp/mosquitto-internal.conf
  config=/tmp/mosquitto-internal.conf
else
  cp "$certificate" /tmp/mqtt-fullchain.pem
  cp "$private_key" /tmp/mqtt-privkey.pem
  cp "$device_ca" /tmp/device-ca.pem
  chown mosquitto:mosquitto /tmp/mqtt-fullchain.pem /tmp/mqtt-privkey.pem /tmp/device-ca.pem
  chmod 0644 /tmp/mqtt-fullchain.pem
  chmod 0644 /tmp/device-ca.pem
  chmod 0600 /tmp/mqtt-privkey.pem
  sed \
    -e 's#/etc/letsencrypt/live/gernetix-services.com/fullchain.pem#/tmp/mqtt-fullchain.pem#' \
    -e 's#/etc/letsencrypt/live/gernetix-services.com/privkey.pem#/tmp/mqtt-privkey.pem#' \
    -e 's#/mosquitto/config/device-ca.pem#/tmp/device-ca.pem#' \
    "$config" >/tmp/mosquitto-tls.conf
  config=/tmp/mosquitto-tls.conf
fi

exec /usr/sbin/mosquitto -c "$config"
