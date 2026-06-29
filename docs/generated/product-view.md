# Product View

Diese Datei ist eine generierte Lesesicht auf Produkte, Projekte, Capabilities und Requirements.
YAML bleibt die Source of Truth.

## Produkte

- `product.learning_platform`
- `product.simple_ide`

## Projekte

### KI-Haustier / Tamagotchi AI

ID: `project.ai_pet_esp32`

Unterstuetzt:

- `BG-001`
- `BG-002`
- `BG-003`
- `BG-005`
- `CJ-003`
- `CJ-004`
- `CJ-006`

Nutzt:

- `capability.processor_esp32`
- `capability.display_output`
- optional `capability.wifi`
- optional `system_capability.ai_assistant`

### Intelligente Pflanzenbewaesserungsstation

ID: `project.smart_plant_watering`

Unterstuetzt:

- `BG-001`
- `BG-002`
- `BG-004`
- `BG-005`
- `CJ-002`
- `CJ-003`
- `CJ-004`
- `CJ-005`
- `CJ-006`

Nutzt:

- `capability.digital_output`
- `capability.actuator_driver`
- optional `capability.soil_moisture_measurement`
- optional `capability.wifi`
- optional `capability.ota`

### RFID-Tresor

ID: `project.rfid_safe`

Unterstuetzt:

- `BG-001`
- `BG-002`
- `BG-004`
- `BG-005`
- `CJ-002`
- `CJ-003`
- `CJ-006`

Nutzt:

- `capability.spi`
- `capability.rfid_reading`
- `capability.servo_control`
- optional `capability.display_output`
- optional `capability.wifi`

### Kanban-/Gridfinity-Inventarsystem

ID: `project.kanban_gridfinity_inventory`

Unterstuetzt:

- `BG-001`
- `BG-002`
- `BG-004`
- `BG-005`
- `CJ-002`
- `CJ-003`
- `CJ-005`
- `CJ-007`

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
