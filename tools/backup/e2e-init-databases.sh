#!/bin/sh
set -eu

# Legt fuer den synthetischen Backup-/Restore-Nachweis dieselbe Aufteilung an
# wie auf dem VPS: die Domaenendatenbank gernetix_runtime und daneben, in
# derselben Instanz, die Datenbank forgejo mit eigener Rolle.

psql --set=ON_ERROR_STOP=1 \
  --set=forgejo_password="$FORGEJO_POSTGRES_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE forgejo
  LOGIN
  PASSWORD :'forgejo_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

CREATE DATABASE forgejo OWNER forgejo;

REVOKE ALL PRIVILEGES ON DATABASE forgejo FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE forgejo TO forgejo;
REVOKE ALL PRIVILEGES ON DATABASE gernetix_runtime FROM forgejo;

\connect forgejo
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO forgejo;
SQL
