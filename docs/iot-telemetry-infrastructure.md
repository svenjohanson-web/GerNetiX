# IoT-Telemetrie-Infrastruktur

## Zweck

Der Telemetry Server ist eine wiederverwendbare Infrastrukturgrenze fuer Projekterweiterungen. Er enthaelt keine Datenlogger-Regeln, Sensorlogik oder Board-Queue. Diese fachliche Logik verbleibt im jeweiligen Projektquellcode.

## Vertrauensgrenzen

Ein Board sendet nicht direkt mit einer frei waehlbaren Account-ID. Ein mTLS-/MQTT-authentifizierter Adapter ruft die interne Ingest-API mit `device_id`, `project_id`, Messwerten und Ereignissen auf. Der Telemetry Server prueft vor dem Schreiben:

1. Project Server liefert den Besitzer des Projekts.
2. Device Management liefert die aktuellen Besitzer des Boards.
3. Beide Ergebnisse muessen denselben Account enthalten, und das Board muss als Projekt-Device oder Komponentenzuordnung im Projekt hinterlegt sein.

Erst danach werden `account_id`, `project_id` und `device_id` gemeinsam persistiert. Die PWA geht ueber Identity: Die angemeldete Session bestimmt den Account; Identity prueft den Projektzugriff und ruft die interne Telemetrie-API mit der daraus abgeleiteten Account-ID auf.

## Datenfluss

```text
Projekt-Runtime auf dem Board
  -> mTLS/MQTT-Adapter
  -> token-geschuetzter Telemetry Ingress
  -> Device Management + Project Server: Ownership-Pruefung
  -> TelemetryMeasurement / TelemetryEvent in SQLite
  -> Identity-Push-Route nur fuer notify_push-Ereignisse, mit account_id + project_id
  -> account- und projektgeschuetzte PWA-Lese- und Loesch-API
```

Der Ingress speichert Ereignisse vor einem Push-Versuch. Ein fehlgeschlagener oder deaktivierter Push loescht daher keinen Alarm aus dem Protokoll. Der Push-Versand ist optional und sucht Subscriptions ausschliesslich nach derselben Kombination aus `account_id` und `project_id`; ein Browser-Abonnement eines anderen Projekts desselben Accounts erhaelt keine Nachricht.

## Aufbewahrung und Loeschung

Standardmaessig bewahrt der Dienst Messwerte 90 Tage und Ereignisse 365 Tage auf. Pro Account und Projekt kann die Infrastruktur eine abweichende Dauer zwischen einem und 3650 Tagen speichern. Der Telemetry Server fuehrt die Retention beim Start und danach standardmaessig alle 24 Stunden aus; sie loescht abgelaufene Datensaetze direkt aus SQLite.

Eine Projektloeschung wirkt immer nur innerhalb der serverseitig geprueften Kombination aus Account und Projekt. Sie entfernt Messwerte, Ereignisse und deren Retention-Konfiguration. Sie entfernt weder das physische Board noch dessen Geraete-Credential.

## Interne API

Alle Telemetry-Server-Endpunkte ausser `/health` liegen unter `/api/telemetry/internal/` und erfordern `X-GerNetiX-Telemetry-Token`. Der Token ist nur fuer interne Adapter und Identity bestimmt und wird nie an PWA oder Board ausgeliefert.

- `POST /ingest`: Messwerte und Ereignisse eines bereits authentifizierten Boards annehmen.
- `GET /accounts/{account}/projects/{project}/measurements`: accountgebundene Zeitreihe lesen.
- `GET /accounts/{account}/projects/{project}/events`: accountgebundenes Ereignisprotokoll lesen.
- `GET|PUT /accounts/{account}/projects/{project}/retention`: Aufbewahrung lesen oder setzen.
- `DELETE /accounts/{account}/projects/{project}/data`: alle Telemetriedaten dieses Projekts loeschen.
- `POST /retention/run`: geplanter Retention-Lauf.

Die oeffentlichen PWA-Routen bleiben im Identity Server unter `/api/platform/telemetry/projects/{projectId}/...`; sie reichen die Browser-Session nicht an den Telemetry Server weiter.
