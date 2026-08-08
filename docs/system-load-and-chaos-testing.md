# System-, Last- und Chaos-Tests fuer GerNetiX

## Ziel und aktueller Stand

GerNetiX ergaenzt die vorhandenen Unit-, Contract- und E2E-Nachweise um eine
getrennte Testsuite fuer parallele Nutzer, simulierte MQTT-Geraete und
kontrollierte Abhaengigkeitsausfaelle. Der erste lokale Durchstich stellt
versionierte Lastprofile, einen k6-API-Ablauf, einen MQTT-Geraetesimulator,
fachliche Integritaetsregeln und eine isolierte Infrastrukturgrundlage bereit.

Die Suite ist noch kein Nachweis einer produktiven Kapazitaet. Verbindliche
Grenzwerte entstehen erst aus wiederholbaren Baselines auf einer benannten,
isolierten Umgebung.

## Testarchitektur

```text
k6 API-Nutzer ---------+
                       +--> GerNetiX-Dienste --> PostgreSQL / Forgejo
MQTT-Geraetesimulator -+           |
                                   +-----------> MQTT / Telemetry
                                   |
Toxiproxy -------------------------+

Nachlauf: Metriken + fachlicher Integritaets-Snapshot
```

k6 erzeugt viele HTTP-Nutzer effizient. Browser-E2E bleibt ein eigener,
kleiner Playwright-Strang und wird nicht zur Massensimulation verwendet. Der
MQTT-Simulator bildet Verbindungsaufbau, Telemetrie, Duplikate, verspaetete
Nachrichten und begrenzte Wiederverbindung ab. Toxiproxy stellt ausschliesslich
vorab erlaubte Netzwerkfehler bereit.

## Verbindliche Schutzregeln

1. Automatisierte Systemtests laufen standardmaessig nur gegen Loopback und
   eindeutig isolierte Ressourcen.
2. Production ist nie ein zulaessiges Ziel. Staging benoetigt einen spaeteren,
   ausdruecklichen Auftrag und einen getrennten Ausfuehrungsnachweis.
3. Testkonten, Projekte, Geraete und Zertifikate duerfen keine realen
   Kundenidentitaeten oder Zugangsdaten wiederverwenden.
4. Chaos bedeutet Latenz, Timeout, Verbindungsabbruch oder begrenzten
   Dienstausfall. Volume-Loeschung, Datenreset und Backupmanipulation gehoeren
   nicht zu automatischen Chaos-Aktionen.
5. Berichte enthalten nur aggregierte Kennzahlen, stabile technische
   Kennungen und allowlist-validierte Fehlergruende. Secrets, freie
   Nutzereingaben, lokale Pfade und Rohpayloads bleiben ausgeschlossen.
6. Externe KI-Aufrufe bleiben im Systemtest standardmaessig deaktiviert oder
   werden durch deterministische Testdoubles ersetzt.

## Fachliche Abnahme

Ein Lauf ist nicht allein wegen guter Antwortzeiten erfolgreich. Nach dem Lauf
werden mindestens folgende Invarianten geprueft:

- jedes Projekt besitzt einen existierenden Account-Owner,
- aktive Build-Auftraege sind pro Projekt und Idempotency-Key eindeutig,
- Ledger-Operationen werden nicht doppelt gebucht,
- Telemetrie stimmt mit Account- und Projektbesitz ueberein,
- absichtlich doppelte Telemetrie wird eindeutig erkannt,
- konfigurierte Abhaengigkeiten erreichen nach einem Chaosfenster wieder den
  erwarteten Zustand.

Fehlende Messwerte werden als Fehlschlag behandelt. Erwartete Autorisierungs-
und Rate-Limit-Antworten werden getrennt von unerwarteten Systemfehlern
ausgewertet.

## Ausbaureihenfolge

1. Lokale Contract-Tests und isolierte Infrastrukturgrundlage.
2. Deterministische Fixtures fuer Accounts, Projekte, Geraete und Zertifikate.
3. Gemeinsamer Smoke-Lauf aus k6 und MQTT-Simulator.
4. Einzelne Forgejo-, PostgreSQL- und MQTT-Ausfaelle mit Wiederanlaufpruefung.
5. Kleine authentifizierte Playwright-Ablaufe unter paralleler Last.
6. Wiederholbare Load-, Stress- und Soak-Baselines.
7. Erst nach eigener Freigabe ein nicht destruktiver Staging-Nachweis.

Der vorhandene Compute-Last- und Chaos-Harness fuer Queue, Fairness,
Backpressure und Worker-Ausfall bleibt bestehen und wird als spezialisierter
Nachweis eingebunden, nicht dupliziert.
