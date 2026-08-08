# GerNetiX Systemtests

Dieses Verzeichnis buendelt den ersten lokalen Durchstich fuer Last-,
Geraete- und spaetere Chaos-Tests. Die Suite ist bewusst von den schnellen
Unit-, Contract- und E2E-Tests getrennt.

## Sicherheitsgrenze

- Alle versionierten Profile tragen `environment: isolated-local`.
- HTTP-Ziele muessen standardmaessig auf Loopback liegen.
- Der Geraetesimulator akzeptiert entfernte Broker nur nach ausdruecklichem
  Opt-in und dann ausschliesslich ueber MQTT-TLS.
- Die Compose-Infrastruktur publiziert keine Host-Ports und verwendet nur
  eindeutig als `system-test` markierte Netze und Volumes.
- Staging-, VPS- und Produktionszugangsdaten gehoeren nicht in diese Suite.
- Das Loeschen von Volumes ist kein Chaos-Szenario. Persistenz- und
  Restore-Tests bleiben eigene, kontrollierte Nachweise.

## Bestandteile

| Pfad | Zweck |
| --- | --- |
| `config/` | Versionierte Smoke-, Load- und Chaos-Profile |
| `k6/` | Authentifizierter API-Lasttest ueber die Identity-Routen |
| `devices/` | MQTT-Geraetesimulator mit begrenztem Reconnect |
| `integrity/` | Fachliche Nachpruefung eines Test-Snapshots |
| `lib/` | Profilvalidierung und gemeinsame Ergebnis-Gates |
| `test/` | Hardware- und serverfreie Contract-Tests |
| `../../infra/system-test/` | Isolierte PostgreSQL-, Forgejo-, MQTT- und Toxiproxy-Basis |

## Lokaler Contract-Nachweis

Die Tests installieren nichts und starten keine Dienste:

```sh
node --test tools/system-tests/test/*.test.js \
  tools/system-tests/k6/test/*.test.js \
  tools/system-tests/devices/test/*.test.js \
  infra/system-test/compose.contract.test.js
```

Der Compose-Test validiert das Modell zusaetzlich mit `docker compose config`,
falls Docker lokal vorhanden ist. Er startet oder laedt keine Container.

Ein sicherer, nicht ausfuehrender Ablaufplan fuer ein Profil wird so erzeugt:

```sh
node tools/system-tests/cli.js --profile smoke
```

Die Ausgabe enthaelt Argumentlisten, nicht geheime Umgebungswerte und die
Voraussetzungen fuer k6 und den Geraetesimulator. Sie startet bewusst weder
Infrastruktur noch Last. Ein zusammengefuehrtes Ergebnis kann spaeter mit
`--results <datei>` gegen die Profil-Gates ausgewertet werden; fehlende
Messwerte fuehren dabei zu einem Fehlerstatus.

## Profile

- `smoke`: 10 API-Nutzer, 20 Geraete, zwei Minuten, kein Chaos.
- `load`: 500 API-Nutzer, 2.000 Geraete, 15 Minuten, kein Chaos.
- `chaos`: 100 API-Nutzer, 1.000 Geraete und einzeln aktivierte Ausfaelle von
  Forgejo, PostgreSQL oder MQTT.

Die Schwellwerte sind anfangs bewusst versionierte Startwerte. Sie werden erst
nach reproduzierbaren Messlaeufen als belastbare SLO-Baseline eingestuft.

## Noch nicht Teil dieses Durchstichs

- automatisches Anlegen synthetischer Konten, Projekte und mTLS-Zertifikate,
- der ausfuehrende gemeinsame Prozess-Orchestrator; der aktuelle CLI-Befehl
  plant und bewertet nur,
- Playwright-Browserablaeufe,
- produktionsnahes MQTT-mTLS mit einem Zertifikat pro simuliertem Geraet,
- ein realer verteilter Dauerlauf,
- Staging- oder VPS-Ausfuehrung.

Diese Punkte werden erst auf dem getesteten lokalen Grundvertrag aufgebaut.
