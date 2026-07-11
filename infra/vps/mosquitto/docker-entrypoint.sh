#!/bin/sh
set -eu

touch /mosquitto/data/passwords
chmod 0600 /mosquitto/data/passwords

config=/mosquitto/config/mosquitto.conf
certificate=/etc/letsencrypt/live/gernetix-services.com/fullchain.pem
private_key=/etc/letsencrypt/live/gernetix-services.com/privkey.pem

if [ ! -r "$certificate" ] || [ ! -r "$private_key" ]; then
  echo "MQTT TLS certificate is not available; starting internal listeners only"
  awk '/^listener 8883 / { exit } { print }' "$config" >/tmp/mosquitto-internal.conf
  config=/tmp/mosquitto-internal.conf
fi

exec /usr/sbin/mosquitto -c "$config"
