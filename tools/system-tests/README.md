# GerNetiX Systemtests

Dieses Verzeichnis buendelt den ersten lokalen Durchstich fuer Last-,
Geraete- und spaetere Chaos-Tests. Die Suite ist bewusst von den schnellen
Unit-, Contract- und E2E-Tests getrennt.

## Sicherheitsgrenze

- Alle versionierten Profile tragen `environment: isolated-local`.
- HTTP-Ziele muessen standardmaessig auf Loopback liegen.
- Der Geraetesimulator akzeptiert entfernte Broker nur nach ausdruecklichem
  Opt-in und dann ausschliesslich ueber MQTT-TLS.
- Die Compose-Infrastruktur bindet benoetigte Host-Ports ausschliesslich an
  `127.0.0.1` und verwendet nur eindeutig als `system-test` markierte Netze
  und Volumes.
- Staging-, VPS- und Produktionszugangsdaten gehoeren nicht in diese Suite.
- Laufzeitberichte unter `.runtime/`, lokale Fixture-Daten und
  Zertifikats-/Schluesseldateien
  sind durch die lokale `.gitignore` vom Repository ausgeschlossen.
- Das Loeschen von Volumes ist kein Chaos-Szenario. Persistenz- und
  Restore-Tests bleiben eigene, kontrollierte Nachweise.

## Bestandteile

| Pfad | Zweck |
| --- | --- |
| `config/` | Versionierte Smoke-, Load- und Chaos-Profile |
| `k6/` | Authentifizierter API-Lasttest ueber die Identity-Routen |
| `devices/` | MQTT-Geraetesimulator mit begrenztem Reconnect |
| `fixtures/` | Synthetische, idempotent anlegbare Testkonten, Projekte und Geraete |
| `browser/` | Kleine Playwright-Ablaufe aus Sicht eines echten Browsers |
| `chaos/` | Allowlist-basierte Toxiproxy-Steuerung mit garantiertem Recovery |
| `integrity/` | Fachliche Nachpruefung eines Test-Snapshots |
| `orchestrator/` | Sicherer gemeinsamer lokaler Lauf von k6, MQTT und optional Browser |
| `reports/` | Fail-closed Normalisierung und Bewertung der Teilberichte |
| `lib/` | Profilvalidierung und gemeinsame Ergebnis-Gates |
| `test/` | Hardware- und serverfreie Contract-Tests |
| `../../infra/system-test/` | Isolierte PostgreSQL-, Forgejo-, MQTT- und Toxiproxy-Basis |

## Lokaler Contract-Nachweis

Die Tests installieren nichts und starten keine Dienste:

```sh
node --test tools/system-tests/test/*.test.js \
  tools/system-tests/k6/test/*.test.js \
  tools/system-tests/devices/test/*.test.js \
  tools/system-tests/fixtures/test/*.test.js \
  tools/system-tests/chaos/test/*.test.js \
  tools/system-tests/browser/test/*.test.js \
  tools/system-tests/orchestrator/test/*.test.js \
  tools/system-tests/reports/test/*.test.js \
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

- `smoke`: 3 API-Nutzer, 4 gemappte Fixture-Geraete, zwei Minuten, kein Chaos.
- `load`: 500 API-Nutzer, 2.000 Geraete, 15 Minuten, kein Chaos.
- `chaos`: 100 API-Nutzer, 1.000 Geraete und einzeln aktivierte Ausfaelle von
  Forgejo, PostgreSQL oder MQTT.

Die Schwellwerte sind anfangs bewusst versionierte Startwerte. Sie werden erst
nach reproduzierbaren Messlaeufen als belastbare SLO-Baseline eingestuft.

Der Smoke-Lauf ist mit den vier versionierten Geraeten aus dem Fixture-Manifest
ausfuehrbar, sobald die GerNetiX-Dienste getrennt auf den Testports Identity
`14300`, Project `14800` und Device `14700` gestartet und die Fixtures bewusst
mit `--confirm-write` angelegt wurden. PostgreSQL, MQTT, Forgejo und Toxiproxy
stehen ueber die ausschliesslich an Loopback gebundene Compose-Basis bereit.

Die Profile `load` und `chaos` brechen derzeit absichtlich ab, weil ihr Bedarf
von 2.000 beziehungsweise 1.000 Geraeten das vier Eintraege umfassende
Fixture-Manifest uebersteigt. Vor realen Lastlaeufen wird das Manifest
deterministisch skaliert. Der Standard-k6-Lauf ist lesend; schreibende Project-
App-CAS-Ablaufe benoetigen zusaetzliche, pro Nutzer isolierte Projekt-Fixtures.

## Noch nicht Teil dieses Durchstichs

- automatische Erzeugung individueller mTLS-Zertifikate fuer jedes Geraet,
- produktionsnahes MQTT-mTLS mit einem Zertifikat pro simuliertem Geraet,
- ein realer verteilter Dauerlauf,
- Staging- oder VPS-Ausfuehrung.

Diese Punkte werden erst auf dem getesteten lokalen Grundvertrag aufgebaut.
