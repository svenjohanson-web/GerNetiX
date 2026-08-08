# GerNetiX k6 API-Lasttests

Dieses Verzeichnis enthaelt einen browsernahen, authentifizierten API-Ablauf fuer eine **isolierte Testumgebung**:

1. `POST /api/login`
2. `GET /api/session`
3. `GET /api/platform/bootstrap?include=projects`
4. `GET /api/platform/projects/{projectId}`
5. optional: revisionsgeschuetztes Lesen und Schreiben von Project-App-Settings

Die Routen entsprechen den oeffentlichen Identity-Routen, die auch die GerNetiX-Webanwendung verwendet. k6 verwaltet den vom Login gesetzten `gernetix_demo_session`-Cookie pro virtuellem Nutzer. Der Login wird pro VU einmal ausgefuehrt; die Sitzungs-, Listen- und Detailaufrufe laufen in jeder Iteration.

## Voraussetzungen

- k6 ist separat installiert; dieses Paket installiert keine Laufzeitabhaengigkeiten.
- Die Zielumgebung laeuft bereits und enthaelt vorab angelegte Testkonten und Projekte.
- Niemals Produktionskonten oder Produktionsdaten verwenden.

`BASE_URL` akzeptiert ausschließlich Loopback-Ziele (`localhost`, `127.x.x.x`, `::1`). Remote-Ziele bleiben auch bei gesetztem `ALLOW_REMOTE_TARGET` verboten. Zugangsdaten, Query-Parameter und Fragmente sind in `BASE_URL` ebenfalls verboten.

## Smoke-Profil

```sh
k6 run \
  -e BASE_URL=http://127.0.0.1:14300 \
  -e USERNAME=load-user \
  -e PASSWORD=test-password \
  tools/system-tests/k6/scenario.js
```

Standard: 10 VUs, 10 Iterationen, maximal 2 Minuten. `VUS`, `ITERATIONS` und `MAX_DURATION` koennen ueberschrieben werden.

## Load-Profil mit einem Konto pro VU

```sh
k6 run \
  -e PROFILE=load \
  -e BASE_URL=http://127.0.0.1:14300 \
  -e USERNAME_TEMPLATE='load-user-{vu}' \
  -e PASSWORD_TEMPLATE='test-password-{vu}' \
  -e VUS=100 \
  -e RAMP_UP=2m \
  -e DURATION=10m \
  -e RAMP_DOWN=2m \
  tools/system-tests/k6/scenario.js
```

`{vu}` und `{index}` werden durch die globale VU-Nummer plus `USER_OFFSET` ersetzt. Ein einzelnes Konto kann fuer reine Leseprofile geteilt werden; fuer Settings-Schreibtests sind getrennte Konten und Projekte pro VU erforderlich, damit echte CAS-Konflikte nicht als kuenstliche Lasttestfehler entstehen.

## Optionaler Settings-CAS-Test

Nur fuer Projekte mit `hasProjectApp: true`:

```sh
k6 run \
  -e USERNAME_TEMPLATE='load-user-{vu}' \
  -e PASSWORD=test-password \
  -e SAVE_SETTINGS=true \
  -e SETTING_KEY=enabled \
  -e SETTING_VALUE=false \
  tools/system-tests/k6/scenario.js
```

Ohne `SETTING_VALUE` wird der aktuelle Wert erneut geschrieben. Der Test sendet `manifest_version`, `expected_revision` und die GerNetiX-Action-Header und erwartet exakt einen Revisionsschritt. `PROJECT_ID` kann die automatische Projektauswahl ueberschreiben.

## Schwellenwerte und Ausgabe

- `P95_MS` (Standard `500`)
- `P99_MS` (Standard `1000`)
- `MAX_ERROR_RATE` (Standard `0.01`)
- `REQUEST_TIMEOUT_MS` (Smoke `5000`, Load `10000`; erlaubt `100` bis `120000`)
- `PAUSE_SECONDS` (Smoke `0.2`, Load `1`)
- `SUMMARY_PATH`, z. B. `reports/k6-smoke-summary.json`

Alle Requests tragen `endpoint`-, `operation`-, `profile`- und Suite-Tags. Die Abschlussausgabe ist ein kompaktes JSON-Dokument mit Metriken, Threshold-Ergebnissen und abgeflachten Checks. Bei gesetztem `SUMMARY_PATH` schreibt k6 dasselbe Dokument zusaetzlich in eine Datei.

## Contract-Tests ohne k6

```sh
npm test --prefix tools/system-tests/k6
```

Die Tests pruefen Profile, Eingabevalidierung, Credential-Templates, Routen, Projektauswahl, CAS-Payload und Summary-Format. Sie starten keine Dienste und benoetigen kein k6-Binary.
