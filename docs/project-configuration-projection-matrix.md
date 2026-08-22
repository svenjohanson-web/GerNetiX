# Projektionsmatrix der Entwicklungsdialoge

Diese Matrix ist der verbindliche FG-17-Vertrag zwischen Entwicklungsdialog,
lesbarer Projektdatei und Build-/Laufzeitwirkung. Alle Dateien werden beim
Speichern aus einem kanonischen Projektsnapshot erzeugt und gemeinsam mit
`expected_head_sha` in genau einem Forgejo-Commit geschrieben.

| Feldklasse | Kanonische bzw. erzeugte Datei | Nachweisbare Wirkung |
| --- | --- | --- |
| Projekt-/Architekturvorlage | `gernetix/project.json`, `gernetix/configuration/architecture-dialog.json` | Projekt- und Software-Einheiten-Snapshot |
| Architekturdiagramm | `gernetix/architecture/project.puml` | sichtbare, versionierte Architektur |
| Hardware-Realisierung und Zuordnung | `gernetix/hardware/allocation.json` | buildbezogene Komponenten-/Gerätezuordnung ohne Inventarsecrets |
| Boardkonfiguration | `gernetix/hardware/boards/<component-id>.json` | eingefrorener Boardstand des Builds |
| Board-Pins und -Treiber | `Komponenten/<ziel>/include/gernetix_board_configuration.h` | deterministische Compile-Konstanten |
| Boardexterne Anschlüsse und Peripherie | `gernetix/configuration/board-peripherals/<component-id>.json` | aktivierte ADC-, PWM-, SPI-, I²C- und Treiberbindungen |
| GerNetiX-Board-Support | Board-Support-Referenz im Board-Snapshot plus freigegebene Manifestdateien im BuildPackage | exakt gepinnte Boarddefinition, Header, Partitionen, Treiber oder Linkerskripte |
| Basissoftware | `gernetix/configuration/basissoftware/<software-unit-id>.json` | WLAN-, MQTT- und Runtime-Konfiguration |
| Softwarefunktionen und Webserver | `gernetix/configuration/software-features/<software-unit-id>.json` | Feature- und Webserverkonfiguration |
| Kommunikation | `gernetix/configuration/communication.json` | Provisioning-/Netzwerkmodus; Secrets nur als `<runtime-secret>` |
| PWA-Dashboard | `gernetix/configuration/pwa-dashboard.json` | Titel und sichtbare Karten der Anwendung |
| Ereignis-Worker und Dispatcher | `gernetix/configuration/events.json` | Ereignisname, Trigger und Zyklus |
| Spielesammlung | `gernetix/configuration/game.json` | freigegebene Spieleauswahl |
| Home-Automation | `gernetix/configuration/home-automation.json` | Koordinator und Knotenmodell |
| PlatformIO-Ziel | `Komponenten/<ziel>/platformio.ini` | Plattform, Board, Framework, Libraries und Buildflags |

Ein unveränderter Dialogwert erzeugt keinen Commit. Zeitstempel und andere
volatile Darstellungswerte verändern keinen Inhalts-Hash. Der BuildPackage
Creator rekonstruiert dieselben Projektionen aus dem gepinnten Commit und
bricht bei Drift ab. Die Mutationstests in
`services/project-server/test/project-configuration-projection.test.js` decken
jede Tabellenzeile mindestens auf Ebene ihrer Feldklasse ab; der
Forgejo-End-to-End-Test in `project-repository-store-service.test.js` deckt
atomare Dialog-Commits, No-op und das abschließende BuildPackage ab.
