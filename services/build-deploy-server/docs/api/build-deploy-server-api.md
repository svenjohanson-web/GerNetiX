# Build-&-Deploy-Server API

Initiale API-Skizze. Noch kein Implementierungskontrakt.

## Eingehende Auftraege

- Build-Paket annehmen
- Prebuild der Projekthuelle starten
- Build & Flash fuer ein Device starten
- wartenden Job fuer ein Device ersetzen
- Job-Status abfragen
- Deploy-Auftrag per MQTT veroeffentlichen
- Statusmeldungen per MQTT empfangen

## Ausgehende Ergebnisse

- Build-Status
- Firmware-Artefakt
- Build-Log
- Deploy-Log
- Fehlerstatus
- Abschlussstatus
- SHA-256
- Dateigroesse

## Transport

- HTTP: BuildPackage-Uebertragung, BuildResult, Artefaktuebertragung
- HTTPS: Firmware-Download durch das Device
- MQTT: Deploy-Auftraege, Statusmeldungen, Heartbeats, Telemetrie

## Nicht in dieser API

- dauerhafte Projektverwaltung
- Account-Device-Inventar
- Pairing
- Support-Entitlement
- fachliche Lernfortschrittsberechnung
