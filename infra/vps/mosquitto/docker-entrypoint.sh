#!/bin/sh
set -eu

touch /mosquitto/data/passwords
chmod 0600 /mosquitto/data/passwords
chown mosquitto:mosquitto /mosquitto/data/passwords

config=/mosquitto/config/mosquitto.conf
certificate=/etc/letsencrypt/live/gernetix-services.com/fullchain.pem
private_key=/etc/letsencrypt/live/gernetix-services.com/privkey.pem

if [ ! -r "$certificate" ] || [ ! -r "$private_key" ]; then
  echo "MQTT TLS certificate is not available; starting internal listeners only"
  awk '/^listener 8883 / { exit } { print }' "$config" >/tmp/mosquitto-internal.conf
  config=/tmp/mosquitto-internal.conf
else
  cp "$certificate" /tmp/mqtt-fullchain.pem
  cp "$private_key" /tmp/mqtt-privkey.pem
  chown mosquitto:mosquitto /tmp/mqtt-fullchain.pem /tmp/mqtt-privkey.pem
  chmod 0644 /tmp/mqtt-fullchain.pem
  chmod 0600 /tmp/mqtt-privkey.pem
  sed \
    -e 's#/etc/letsencrypt/live/gernetix-services.com/fullchain.pem#/tmp/mqtt-fullchain.pem#' \
    -e 's#/etc/letsencrypt/live/gernetix-services.com/privkey.pem#/tmp/mqtt-privkey.pem#' \
    "$config" >/tmp/mosquitto-tls.conf
  config=/tmp/mosquitto-tls.conf
fi

exec /usr/sbin/mosquitto -c "$config"
