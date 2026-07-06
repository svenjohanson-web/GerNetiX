# Product View

Diese Datei ist eine generierte Lesesicht auf Produkte, Projekte, Capabilities und Requirements.
Der validierte SQLite-Graph ist die kanonische Struktur.

## Produkte

- `product.learning_platform`
- `product.simple_ide`

## Premium-Funktionen

### KI-Community-Assistent

ID: `product_offering.community_ai_assistant_premium`

Einordnung:

- Business-Domain: `business_domain.community`
- Capability: `BC-040`
- Learning Path: `learning_path.community_knowledge_usage`
- Berechtigung: `system_capability.community_ai_assistant`
- Plan: `plan.premium`

Regel:

- Die normale Community bleibt kostenlos.
- KI-Suche, Zusammenfassungen, Empfehlungen, Uebersetzungen und Quellenantworten sind Premium.
- Die Funktion nutzt KI Cost Protection, Credits, Limits, Usage Events und Admin Monitoring.
- Keine direkten neuen Links zu Vision, Business Goals oder Customer Journeys.

## Projekte

### Tamagotchi Entry Course

ID: `project.tamagotchi_entry_course`

Learning Path:

- `learning_path.ai_pet_embedded_interaction`

Nutzt:

- `capability.processor_esp32`
- `capability.display_output`
- optional `capability.wifi`
- optional `system_capability.ai_assistant`

Varianten:

- `project.tamagotchi_entry_course.variant.basic_display`: Offline-Haustier ohne Internet und ohne laufende KI-Kosten.
- `project.tamagotchi_entry_course.variant.ai_online`: KI-Online-Haustier mit WLAN/OpenAI-Anbindung, natuerlicheren Dialogen, aber laufenden KI-Kosten und Online-Abhaengigkeit.

Regel:

- Version 1 muss offline sinnvoll funktionieren.
- KI-Online ist eine optionale Erweiterung und muss Cost Protection, Credits, Usage Events und Budgetlimits beruecksichtigen.

### Cross-Platform Development

ID: `learning_goal.cross_platform_development`

Learning Path:

- `learning_path.cross_platform_development`

Beispieldomaene:

- `example_domain.digital_tamagotchi`
- Die Domaene ist austauschbar. Das Learning Goal bleibt stabil, auch wenn spaeter ein anderes Beispielprojekt verwendet wird.

Schritte:

- `learning_path.cross_platform_development` enthaelt die Projekte Embedded, Desktop, Mobile, Web, Cloud, Synchronisation und optionale KI-Erweiterung.
- Die einzelnen Projekte referenzieren nur ihren Learning Path.

Lernfokus:

- Zielsysteme und Laufzeitumgebungen vergleichen.
- Native und plattformuebergreifende Entwicklung bewerten.
- Fachlogik von Benutzeroberflaeche, Hardwarezugriff und Plattformadaptern trennen.
- Gemeinsames Datenmodell und Synchronisation ueber mehrere Clients aufbauen.
- KI-Integration nur als optionale Erweiterung mit Kosten- und Tokenmanagement behandeln.

### Intelligente Pflanzenbewaesserungsstation

ID: `project.smart_plant_watering`

Learning Path:

- `learning_path.automation_control_and_regulation`

Nutzt:

- `capability.digital_output`
- `capability.actuator_driver`
- optional `capability.soil_moisture_measurement`
- optional `capability.wifi`
- optional `capability.ota`

### Hausautomatisierung verstehen und erweitern

ID: `course.home_automation_understand_and_extend`

Lernziele:

- `learning_goal.home_automation_basics`
- `learning_goal.home_automation_topologies`
- `learning_goal.home_automation_app_integration`
- `learning_goal.automation_basics`
- `learning_goal.iot_basics`

Zielarchitekturen:

- Embedded only: Sensoren, Aktoren und lokale Logik laufen direkt auf dem Embedded Device.
- Embedded und PC-Software: Embedded Devices liefern Statuswerte an eine PC-Anwendung fuer Anzeige, Konfiguration, Analyse und Debugging.
- Embedded und Mobile-App: Embedded Devices liefern Statuswerte an eine App fuer alltagsnahe Bedienung und schnelle Uebersicht.

Anzuzeigende Statuswerte:

- Temperatur
- Luftfeuchtigkeit
- Bodenfeuchtigkeit und Hydrierung von Pflanzenerde
- Pumpen-, Ventil- und Aktorzustand
- Batteriestand, Warnungen und Geraetestatus

Topologien:

- lokales Embedded-System
- kleiner HomeServer
- verteiltes IoT-System
- intelligentere Edge-Devices

Bewertung:

- Die Learning-Einheit soll Vor- und Nachteile der Topologien erklaeren, insbesondere Einstiegskomplexitaet, Kosten, Erweiterbarkeit, Ausfallsicherheit, Datenschutz, Wartung und Bedienkomfort.

### RFID-Tresor

ID: `project.rfid_safe`

Learning Path:

- `learning_path.embedded_access_control`

Nutzt:

- `capability.spi`
- `capability.rfid_reading`
- `capability.servo_control`
- optional `capability.display_output`
- optional `capability.wifi`

### Buchtresor / Tagebuchschloss

ID: `project.book_vault`

Learning Path:

- `learning_path.maker_access_and_mechanics`

Nutzt:

- `capability.rfid_reading`
- `capability.servo_control`
- `capability.mechanical_locking`
- optional `capability.display_output`
- optional `capability.digital_input`
- optional `capability.fallback_unlock`

Lernfokus:

- Identifizierung: welcher Tag wurde erkannt?
- Autorisierung: darf dieser Tag das Buch oeffnen?
- Fallback: was passiert, wenn der Tag verloren oder defekt ist?
- Mechanik: wie wird ein kleines Buchschloss verlaesslich verriegelt und geoeffnet?

### Kanban-/Gridfinity-Inventarsystem

ID: `project.kanban_gridfinity_inventory`

Learning Path:

- `learning_path.workshop_inventory_and_tooling`

Nutzt:

- `capability.item_identification`
- optional `capability.qr_code`
- optional `capability.rfid_reading`
- optional `capability.wifi`

## Requirements-Status

Vorhanden:

- Requirements-Prozess
- Dekompositionsregel
- Definition, dass Requirements fachlichen Nutzen beschreiben

Noch offen:

- konkrete Requirements je Customer Journey
- konkrete Work Packages je Requirement
- konkrete Tests/Nachweise je Work Package

## Produkt-Gaps

- `data/project-ideas/smart-plant-watering.yaml` und `data/learning/projects/smart-plant-watering.yaml` beschreiben denselben Inhalt in zwei Strukturen. Ziel sollte eine konsolidierte Fuehrungsquelle sein.
- Mehrere referenzierte IDs wie `capability.qr_code`, `capability.printable_labels`, `risk.sensor_noise` existieren in Projekt-YAMLs, aber noch nicht als zentrale YAML-Entitaeten.
