#!/bin/sh
set -eu

while :; do
  certbot renew --webroot --webroot-path /var/www/certbot --quiet
  sleep 43200
done
