# Open Gaps

Diese Datei ist eine generierte Lesesicht auf Luecken, Inkonsistenzen und offene Punkte.
YAML bleibt die Source of Truth.

## Kritische Modell-Luecken

### Konkrete Requirements fehlen

ID: `gap.concrete_requirements_missing`

Status: offen

Beschreibung:

Es gibt einen klaren Requirements-Prozess, aber noch keine konkrete Requirement-Liste je Customer Journey und Projekt.

Auswirkung:

- Requirements ohne Produkt/Capability koennen noch nicht vollstaendig geprueft werden.
- Work Packages und Tasks koennen noch nicht sauber abgeleitet werden.

### Zentraler Capability-Katalog initial angelegt

ID: `gap.capability_catalog_missing`

Status: mitigated

Beschreibung:

Capabilities werden in Projekt-YAMLs referenziert.
Eine erste zentrale Quelle liegt nun in `data/hardware/technical-capabilities.yaml`.

Auswirkung:

- Projekt-YAMLs haben nun eine erste zentrale Capability-Quelle.
- Detailattribute, CapabilityCategories und vollstaendige Validierung fehlen noch.

### Task-Modell fehlt

ID: `gap.task_model_missing`

Status: offen

Beschreibung:

Tasks werden im Prozess erwaehnt, aber noch nicht als YAML-Entitaeten mit Zielbezug gepflegt.

Auswirkung:

- Tasks ohne Zielbezug koennen nicht geprueft werden, weil es noch keine Task-Entitaeten gibt.

## Offene Fragen

- `open_question.account_skill_level_scope`: Ist AccountSkillLevel global, domaenenbezogen oder beides?
- `open_question.teacher_plan_scope`: Wird Teacher Plan produktiver Standardplan oder Test-/Schulkontext?

## Inkonsistenzen / Altstruktur

### Doppelte Pflanzenbewaesserungs-Struktur

`data/project-ideas/smart-plant-watering.yaml` und `data/learning/projects/smart-plant-watering.yaml` beschreiben denselben fachlichen Projektkern.

Bewertung:

- Kein Datenverlust.
- Aktuelle Fuehrungsstruktur sollte `data/learning/projects/smart-plant-watering.yaml` sein.
- Alte Datei kann spaeter als Legacy/Importquelle markiert werden.

### Markdown-Projektdefinitionen sind nicht mehr fuehrend

`docs/project-ai-pet-esp32.md` und `docs/project-smart-plant-watering.md` enthalten fachliche Informationen, sind aber nach YAML-first nicht mehr Source of Truth.

Bewertung:

- Nicht loeschen.
- Spaeter aus YAML generieren oder gegen YAML abgleichen.

### Einige referenzierte IDs fehlen als eigene Dateien

Beispiele:

- `risk.sensor_noise`
- `risk.pump_overcurrent`
- `software_module.pet_core`
- `software_module.inventory_model`

Bewertung:

- Im Traceability-Modell teilweise als Referenzen sichtbar.
- Sollten spaeter als eigene YAML-Entitaeten zentral gepflegt werden.

## Konsistenzpruefung

- Produkte ohne Business Goal: keine kritische Luecke.
- Requirements ohne Produkt/Capability: konkrete Requirements fehlen noch.
- Capabilities ohne Projektbezug: erfasste Capabilities stammen ueberwiegend aus Projekt-YAMLs oder Systemberechtigungen.
- Technische Entscheidungen ohne betroffene Architekturbausteine: keine kritische Luecke.
- Offene Fragen ohne betroffene Entitaet: zentrale offene Fragen wurden zugeordnet.
- Tasks ohne Zielbezug: Task-Entitaeten fehlen.
- Widerspruechliche Begriffe: Capability-Doppeldeutigkeit ist entschieden, Alttexte muessen weiterhin bewusst gelesen werden.
