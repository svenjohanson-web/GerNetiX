# Deterministische Systemtest-Fixtures

`manifest.v1.json` ist der versionierte Vertrag fuer synthetische Accounts, Projekte und Devices. Alle E-Mail-Adressen verwenden die reservierte TLD `.invalid`; das Kennwort steht absichtlich nicht im Repository.

Der Seed-Client akzeptiert ausschließlich lokale Loopback-Ziele (`127.0.0.1`, `localhost`, `::1`), folgt keinen Redirects und prueft vor jedem Schreibzugriff, ob das Objekt bereits existiert. Bei gleicher ID mit abweichendem Besitzer oder anderer Seriennummer bricht er ab.

Nur den Plan anzeigen (keine Netzwerkzugriffe, keine Schreibzugriffe):

```sh
node tools/system-tests/fixtures/cli.js --plan
```

Eine bereits gestartete, isolierte Testumgebung befuellen:

```sh
GERNETIX_SYSTEM_TEST_FIXTURE_PASSWORD='ein-langes-nur-lokales-testkennwort' \
  node tools/system-tests/fixtures/cli.js
```

Optionale Zielvariablen sind `GERNETIX_SYSTEM_TEST_IDENTITY_URL`, `GERNETIX_SYSTEM_TEST_PROJECT_URL` und `GERNETIX_SYSTEM_TEST_DEVICE_URL`. Nicht-lokale Ziele werden auch bei expliziter Konfiguration abgelehnt. Der Identity Server muss ohne SMTP laufen, damit synthetische Accounts lokal automatisch verifiziert werden; ein `202 requires_email_verification` beendet den Lauf sicher.

Verwendete Laufzeitvertraege:

- Identity: `POST /api/login`, `POST /api/register`
- Project Server: `GET /api/projects/{projectId}`, `POST /api/projects`
- Device Management: `GET /api/device-management/devices/{deviceId}/status`, `POST /api/device-management/devices/register`, `GET/POST /api/device-management/accounts/{accountId}/devices`
