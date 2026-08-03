# Reine Test-CI

GerNetiX verwendet GitHub Actions ausschließlich als Test-CI für Pull Requests
und Änderungen auf `main`. Der Workflow `.github/workflows/test-ci.yml`
veröffentlicht keine Images oder Artefakte und führt weder Deployment, Staging,
Cutover noch Forgejo Actions aus. Ausschließlich die isolierten
End-to-End-Nachweise bauen kurzlebige lokale Testimages im Runner. Der Workflow
benötigt keine Secrets.

## Nachweise

Die Jobs sind nach Fehlerdomäne getrennt:

- `Project Server`, `Identity Server` und `Build and Deploy Server` installieren
  jeweils ausschließlich ihre gelockten npm-Abhängigkeiten und führen Syntax-
  sowie die in einem frischen Checkout reproduzierbaren Servicetests aus.
  Damit bleiben auch Artifact-Store, Flash-/OTA-Auslieferung, Downloads und
  ELF-Symbolisierung bei Änderungen am Buildpfad abgesichert. Ephemere
  `.runtime/`-Verzeichnisse liegen nur im Runner-Checkout.
- `Forgejo and migration contracts` prüft die gezielten Project-/Identity-
  Verträge, die gehärtete Forgejo-Compose-Konfiguration und den ausschließlich
  lesenden, deterministischen Migrations-Dry-run einschließlich synthetischer
  Projektfälle und Backup-/Restore-Fehlerverträge.
- `Forgejo container and restore E2E` startet zwei voneinander isolierte
  Compose-Projekte ohne dauerhafte Daten: zuerst den echten Forgejo-Adapter mit
  Neustart- und Datenbankgrenzentest, danach einen gemeinsamen Datenbank-/Volume-
  Backup- und Leerstand-Restore mit Baum-, Inhalts-, Branch-, HEAD- und
  Historienvergleich. Beide Skripte räumen Container, Volumes, Netzwerke und
  lokale Testimages auch bei Fehlern auf.
- `Forgejo repository card UI E2E` bedient die produktive Repository-Karte in
  einem gepinnten Chromium. Der Browser liest über die echten
  sessiongeschützten Identity-Routen und den Project-Server-HTTP-Vertrag aus
  einem kurzlebigen echten Forgejo-Repository. Anonyme und fremde Projekte
  werden abgewiesen; Token und interne Forgejo-URL dürfen weder in Antworten
  noch Browseranfragen erscheinen.
- `Syntax and Compose` parst alle versionierten JavaScript-Dateien, validiert
  alle projektrelevanten Compose-Modelle mit Platzhaltern für erforderliche
  Variablen und lehnt Whitespace-Fehler ab. Die Platzhalter sind keine
  Laufzeit-Secrets und starten keine Container.
- `Architecture docs and graph baseline` testet und baut die zentrale
  Offline-Lesesicht, fordert einen sauberen Diff der eingecheckten Ausgabe und
  vergleicht Integrität, Prüfsumme und Kernmetriken des kanonischen
  SQLite-Graphen mit `tools/ci/graph-baseline.json`.

Node.js 24 stellt für die Graph- und Migrationsprüfungen `node:sqlite` bereit.
Die npm-Caches werden pro Lockfile wiederverwendet; parallele Läufe desselben
Branches werden zugunsten des neuesten Laufs abgebrochen.

Der Project-Server-Test `loads the protected ESP32 basis ...` benötigt den
lokal von ESP-IDF erzeugten und absichtlich ignorierten Ordner
`basissoftware/esp32/managed_components/`. Er wird in der Checkout-CI gezielt
übersprungen; die übrigen Basissoftware-, BuildPackage- und Forgejo-Verträge
bleiben aktiv. Ein Firmware-/Toolchain-Build ist ausdrücklich nicht Bestandteil
dieser reinen Test-CI.

## Lokale Reproduktion

Voraussetzungen sind Node.js 24, npm, Git und Docker mit Compose-Plugin. Vom
Repository-Stamm aus entsprechen diese Befehle den CI-Nachweisen:

```bash
mkdir -p .runtime services/build-deploy-server/.runtime
(cd services/project-server && npm ci --ignore-scripts --no-audit --no-fund && npm run check && node --test --test-skip-pattern="loads the protected ESP32 basis and overlays only the project user main")
(cd services/identity-server && npm ci --ignore-scripts --no-audit --no-fund && npm run check && node --test)
(cd services/build-deploy-server && npm ci --ignore-scripts --no-audit --no-fund && npm run check && node --test)

node --test \
  tools/forgejo-ops-contract.test.js \
  tools/forgejo-integration/contract.test.js \
  tools/forgejo-backup-restore-contract.test.js \
  services/project-server/test/forgejo-client.test.js \
  services/project-server/test/git-project-repository-store.test.js \
  services/project-server/test/project-repository-api.test.js \
  services/identity-server/test/project-repository-contract-stub.test.js \
  services/identity-server/test/project-repository-routes.test.js \
  services/identity-server/test/project-git-light.test.js
node --test \
  tools/forgejo-migration-dry-run.test.js \
  tools/forgejo-migration-dry-run-fixtures.test.js

tools/forgejo-integration/run.sh
tools/forgejo-backup-restore-e2e.sh
tools/forgejo-ui-e2e/run.sh

node tools/ci/check-javascript-syntax.js
node tools/ci/check-compose.js
git diff --check
git show --check --oneline HEAD

node --test tools/architecture-docs/test/build.test.js
node tools/architecture-docs/build.js
git diff --exit-code -- tools/architecture-docs/dist
node tools/ci/check-graph-baseline.js
```

Ein beabsichtigter Graph-Change erfordert eine fachliche Graph-Validierung und
ein bewusstes Review der neuen Metriken. Erst danach darf
`tools/ci/graph-baseline.json` auf Prüfsumme und Zählwerte des bestätigten
Graphen aktualisiert werden. Die Test-CI selbst importiert, migriert oder
verändert den Graphen nie.
