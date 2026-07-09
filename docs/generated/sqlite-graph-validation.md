# SQLite Graph Validation

Diese Datei ist eine generierte Lesesicht.
Der validierte SQLite-Graph ist die kanonische Pflege-, Pruef- und Abfragestruktur.
YAML ist nur noch Legacy-Import, Bootstrap oder Export, sofern der Graph die YAML-Struktur fehlerfrei abbildet.

## Stand

Letzte Synchronisation: 2026-07-09

SQLite-Datenbank:

```text
tools/yaml-graph-sqlite/out/model-graph.sqlite
```

## Importumfang

```text
artifact_types:      96
artifacts:           691
relationship_types:  58
relationships:       2250
errors:              0
warnings:            0
```

## Ergebnis

Die harte Graph-Synchronisation ist bestanden.
Damit kann der SQLite-Graph die bisherige YAML-Struktur als fuehrende Struktur abloesen.

Bestanden:

- Keine fehlenden Source-Artefakte.
- Keine fehlenden Target-Artefakte.
- Keine unbekannten Artefakttypen.
- Keine unbekannten Beziehungstypen.
- Keine doppelten Artefakt-IDs.

Verbleibend:

- Keine aktuellen Warnungen.

## Synchronisierte Korrekturen

- `data/project-ideas/smart-plant-watering.yaml` verwendet jetzt eine eigene Projektideen-ID `project_idea.smart_plant_watering` und referenziert das kanonische Projekt ueber `canonicalProject: project.smart_plant_watering`.
- `data/learning/projects/book-vault.yaml` definiert das MakerLab-Todo nicht mehr doppelt, sondern referenziert `todo.book_vault.3d_print_lock_model`.
- `data/business/knowledge-base.yaml` definiert `knowledge_base.distributed_engineering_knowledge` als kanonisches Artefakt.
- `data/learning/example-domains.yaml` definiert `example_domain.digital_tamagotchi` als kanonisches Artefakt.
- `data/architecture/artifacts.yaml` definiert `component.ota` als Architekturkomponente.
- Der SQLite-Importer ignoriert generierte Aggregatsichten als zweite Knotenquelle und behandelt eingebettete `views` und `exampleDomain` IDs als Referenzen statt als eigenstaendige Zweitdefinitionen.

## Naechster fachlicher Schritt

Der aktuelle Import ist fehler- und warnungsfrei. Naechster fachlicher Schritt ist, neue UI-, API- oder Runtime-Aenderungen weiterhin zuerst im Graphen nachzuziehen und danach die Lesesichten zu aktualisieren.

## Source-of-Truth-Regel

Ab diesem Stand gilt:

```text
SQLite Graph Model
-> YAML Export bei Bedarf
-> Markdown-/Mermaid-Lesesichten
```

YAML-Dateien sollen nicht mehr parallel fachlich gepflegt werden, wenn die gleiche Information im SQLite-Graphmodell vorhanden ist.
