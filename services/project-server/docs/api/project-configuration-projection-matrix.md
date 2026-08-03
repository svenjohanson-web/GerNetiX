# Projektionsmatrix der Entwicklungs-Konfiguration

Jede wirksame Eingabe veraendert mindestens eine sichtbare Projektdatei. Bei
aktiver Bindung werden alle Pfade atomar mit `expected_head_sha` in genau einem
Commit geschrieben; identische Projektion ist ein No-op.

| Dialog / Feldklasse | Kanonische Datei | Generierte Wirkung | Klasse |
| --- | --- | --- | --- |
| Projekt, Hardwareprofil, aktive Einheit, Template-Commit | `gernetix/project.json` | Auswahl der Software-Einheit | runtime/view |
| Architekturziel | `gernetix/configuration/architecture-dialog.json` | keine zweite Kopie | view |
| Architekturdiagramm | `gernetix/architecture/project.puml` | Diagrammansicht | view |
| Komponenten/Zuordnung | `gernetix/hardware/allocation.json` | Boardpfade | runtime |
| Board und Pins | `gernetix/hardware/boards/<component-id>.json` | `gernetix_board_configuration.h` | build |
| Software-Ziel und Build | `gernetix/software-units/<software-unit-id>.json` | `<source_root>/platformio.ini` | build |
| Basissoftware | `gernetix/configuration/basissoftware/<software-unit-id>.json` | Basissoftware-Projektion | build/runtime |
| Funktionen/Webserver | `gernetix/configuration/software-features/<software-unit-id>.json` | Feature-/Webserver-Projektion | build/runtime/view |
| Board-Peripherie | `gernetix/configuration/board-peripherals/<component-id>.json` | Board-Header | build |
| Kommunikation/WLAN/MQTT | `gernetix/configuration/communication.json` | Kommunikationskonfiguration, Secrets redigiert | build/runtime |
| PWA-Karten | `gernetix/configuration/pwa-dashboard.json` | PWA-Lesesicht | view |
| Ereignisse | `gernetix/configuration/events.json` | Ereignisadapter | runtime |
| Home-Automation, Spiel, Datenlogger | jeweilige `gernetix/configuration/*.json` | fachliche Projektion | runtime/view |

Dateiprojektion, Determinismus, Secret-Redaktion, No-op und atomarer Git-Commit
sind lokal getestet. Build-Drift-Abbruch und commitgebundenes BuildPackage
bleiben FG-07/Gate 3.
