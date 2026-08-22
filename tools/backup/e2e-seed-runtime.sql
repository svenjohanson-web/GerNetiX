-- Synthetischer Kundendatenbestand fuer den Backup-/Restore-Nachweis.
-- Die Tabellen bilden die fuer die fachlichen Restore-Pruefungen relevanten
-- Strukturen aus gernetix_runtime nach: Accounts, Projekte mit
-- Repository-Bindung, Build-Artefakte, Geraete und Pairings, Hardware-Inventar
-- und Bestellungen. Alle Werte sind erfunden und ohne Bezug zu echten Kunden.

BEGIN;

CREATE TABLE identity_user_accounts (
  id text PRIMARY KEY,
  username_normalized text NOT NULL UNIQUE,
  email_normalized text UNIQUE,
  passkey_credential_id text UNIQUE,
  raw_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE identity_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_projects (
  project_id text PRIMARY KEY,
  user_id text NOT NULL,
  status text NOT NULL,
  repository_provider text,
  repository_name text,
  repository_id text,
  repository_state text,
  default_branch text,
  head_sha text,
  raw_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE project_artifacts (
  artifact_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
  build_job_id text NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE project_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_management_devices (
  device_id text PRIMARY KEY,
  serial_number text NOT NULL,
  hardware_profile_id text NOT NULL,
  authenticity_status text NOT NULL,
  lifecycle_state text NOT NULL,
  raw_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_management_account_devices (
  account_device_id text PRIMARY KEY,
  account_id text NOT NULL,
  device_id text NOT NULL REFERENCES device_management_devices(device_id) ON DELETE CASCADE,
  raw_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_management_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hardware_catalog_items (
  item_id text PRIMARY KEY,
  raw_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hardware_catalog_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hardware_shop_orders (
  order_id text PRIMARY KEY,
  cart_id text NOT NULL,
  account_id text NOT NULL,
  status text NOT NULL,
  payment_status text NOT NULL,
  fulfillment_status text NOT NULL,
  raw_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE hardware_shop_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO identity_migrations (migration_id) VALUES ('0001-synthetic'), ('0002-synthetic');
INSERT INTO project_migrations (migration_id) VALUES ('0001-synthetic');
INSERT INTO device_management_migrations (migration_id) VALUES ('0001-synthetic');
INSERT INTO hardware_catalog_migrations (migration_id) VALUES ('0001-synthetic');
INSERT INTO hardware_shop_migrations (migration_id) VALUES ('0001-synthetic');

INSERT INTO identity_user_accounts (id, username_normalized, email_normalized, raw_json, updated_at) VALUES
  ('account-synthetic-1', 'restore-contract', 'restore-contract@example.invalid',
   '{"display_name":"Synthetic Restore Contract"}', '2026-01-01T00:00:00Z'),
  ('account-synthetic-2', 'zweiter-kunde', 'zweiter-kunde@example.invalid',
   '{"display_name":"Zweiter synthetischer Kunde"}', '2026-01-01T00:00:00Z');

-- Das erste Projekt zeigt auf das im Nachweislauf tatsaechlich angelegte
-- Forgejo-Repository. Sein head_sha wird nach dem Push gesetzt, damit der
-- Restore die Kette Projekt -> Repository -> erwarteter Commit belegen kann.
INSERT INTO project_projects
  (project_id, user_id, status, repository_provider, repository_name, repository_id,
   repository_state, default_branch, head_sha, raw_json, updated_at)
VALUES
  ('project-synthetic-1', 'account-synthetic-1', 'active', 'forgejo', 'backup-proof', 'repo-synthetic-1',
   'ready', 'main', 'wird-nach-dem-push-gesetzt', '{"title":"Backup-Nachweis"}', '2026-01-01T00:00:00Z'),
  ('project-synthetic-2', 'account-synthetic-2', 'active', NULL, NULL, NULL,
   NULL, NULL, NULL, '{"title":"Projekt ohne Repository"}', '2026-01-01T00:00:00Z');

INSERT INTO project_artifacts (artifact_id, project_id, build_job_id, raw_json, created_at) VALUES
  ('artifact-synthetic-1', 'project-synthetic-1', 'job-synthetic-1',
   '{"file_name":"firmware.bin"}', '2026-01-01T00:02:00Z');

INSERT INTO device_management_devices
  (device_id, serial_number, hardware_profile_id, authenticity_status, lifecycle_state, raw_json)
VALUES
  ('device-synthetic-1', 'SN-SYNTHETIC-1', 'esp32-synthetic', 'verified', 'paired', '{"board":"esp32"}');

INSERT INTO device_management_account_devices (account_device_id, account_id, device_id, raw_json) VALUES
  ('account-device-synthetic-1', 'account-synthetic-1', 'device-synthetic-1', '{"name":"Nachweisgeraet"}');

INSERT INTO hardware_catalog_items (item_id, raw_json) VALUES
  ('catalog-synthetic-1', '{"name":"Synthetisches Board"}'),
  ('catalog-synthetic-2', '{"name":"Synthetischer Sensor"}');

INSERT INTO hardware_shop_orders
  (order_id, cart_id, account_id, status, payment_status, fulfillment_status, raw_json, created_at, updated_at)
VALUES
  ('order-synthetic-1', 'cart-synthetic-1', 'account-synthetic-1', 'placed', 'paid', 'shipped',
   '{"total_cents":4200}', '2026-01-01T00:03:00Z', '2026-01-01T00:03:00Z');

COMMIT;
