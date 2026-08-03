# Synthetische Testfaelle fuer den Forgejo-Migrations-Dry-run

## Zweck und Sicherheitsgrenze

Dieser Testkatalog ergaenzt den Forgejo-Migrations-Dry-run um repraesentative,
reproduzierbare Altbestaende. Alle Projekt-, Account-, Board-, Datei-,
Versions- und Artefaktkennungen sowie alle Inhalte wurden ausschliesslich fuer
die Tests erfunden. Sie stammen weder aus lokalen GerNetiX-Laufzeitdaten noch
aus Staging oder Forgejo.

Die Tests rufen nur die reine Berichtsplanung im Speicher auf. Sie stellen
keine Netzwerkverbindung her, schreiben kein Repository, fuehren keinen
Cutover aus und veraendern keine SQL-Daten. Der uebergrosse Testinhalt wird
erst im Testprozess erzeugt und nicht als Megabyte-Datei im Repository
abgelegt.

## Fixture-Vertrag

Die Eingaben liegen in
`tools/fixtures/forgejo-migration-dry-run/synthetic-inventories.js`. Die
erwarteten Resultate sind getrennt davon in
`tools/fixtures/forgejo-migration-dry-run/expected-results.js` fest
eingefroren. Dadurch berechnet ein Test seine Sollwerte nicht aus demselben
Lauf, den er prueft.

Je Testfall werden mindestens folgende Werte verglichen:

- SHA-256 der vollstaendigen kanonischen Berichtsbytes,
- Quellbestands-Fingerprint,
- erwartete Pfade und Inhalts-SHA-256,
- Repository-Pfad- und Datei-Set-SHA-256,
- Git-Tree-OID und Ziel-Commit-OID,
- alle geplanten Commit-OIDs und bei Historienfaellen ihre Elternkette,
- erwartete Blocker-Codes und das geschlossene beziehungsweise offene
  Write-Gate.

Jeder Bericht wird aus zwei voneinander geklonten Eingaben erzeugt. Beide
kanonischen JSON-Ausgaben einschliesslich Abschluss-Newline muessen bytegleich
sein. Die statische Berichts-SHA-256 erkennt zusaetzlich unbeabsichtigte
Aenderungen, die in einzeln gelisteten Assertions nicht sichtbar waeren.

## Abgedeckte Testfaelle

| Fixture | Inhalt | Erwartung |
| --- | --- | --- |
| `empty-project` | Projekt ohne SQL-Quellen und ohne Git-Light-Version | Genau das projizierte Projektmanifest und ein deterministischer Initialcommit |
| `normal-esp32-project` | PlatformIO-Konfiguration, ESP32-C++-Quelle und eine Firmware-Softwareeinheit | Pfad- und bytegleiche Quellen plus kanonische Projekt- und Softwareeinheitsdateien |
| `multiple-software-units` | Firmware, Web-Anwendung und Node-Simulator in getrennten Quellwurzeln | Drei stabile Softwareeinheitsprojektionen und ein gemeinsamer Git-Baum |
| `unicode-and-empty-file` | NFC-Pfad und UTF-8-Inhalt mit Umlauten/CJK sowie eine Datei mit null Bytes | Unveraenderte Unicode-Pfadbytes; SHA-256 der leeren Datei bleibt der bekannte Leerwert |
| `complex-board-and-pins` | ESP32-S3, drei Board-Features, I2C/SPI/GPIO-Pins, Hardwarezuordnung und Peripheriekonfiguration | Deterministische Board-JSON-, Allocation-, Header- und Peripherieprojektionen |
| `git-light-history` | Drei linear verkettete SQL-Versionen und aktueller Stand | Vier fest erwartete Trees/Commits mit lueckenloser Elternkette |
| `build-artifact-reference` | Binary-markierte SQL-Version mit vollstaendiger Artifact-Store-Referenz | Artefakt-ID, Dateinamen-Hash, Binary-SHA-256 und Groesse bleiben erhalten; kein Binary wird Git-Datei |
| `blocking-sources` | Secret-Datei, Binary, uebergrosse Datei, Windows-Pfad und falscher Quellhash | Write-Gate geschlossen; alle Klassifikations-, Pfad- und Hash-Blocker exakt vorhanden |
| `blocking-history-and-artifact` | Fehlender Versionselternteil, mehrere Historienkoepfe, unlesbarer Zeitstempel und fehlende Artefaktreferenz | Write-Gate geschlossen; strukturelle Historien- und Artefaktblocker exakt vorhanden |

Der unlesbare Zeitstempel ist eine deterministische Warnung und setzt allein
keinen zusaetzlichen Blocker. Die anderen Fehler desselben Fixtures halten das
Write-Gate geschlossen.

## Lokaler Nachweis

Gezielter Fixture-Katalog:

```sh
node --test tools/forgejo-migration-dry-run-fixtures.test.js
```

Gesamter lokaler Dry-run-Vertrag:

```sh
node --test \
  tools/forgejo-migration-dry-run.test.js \
  tools/forgejo-migration-dry-run-fixtures.test.js
```

Eine beabsichtigte Aenderung des Migrationsvertrags muss fachlich geprueft
werden. Erst danach duerfen die statischen Erwartungen gezielt angepasst
werden; ein automatisches Snapshot-Update ist nicht vorgesehen.
