# SQLite Graph Validation

Diese Datei ist eine generierte Lesesicht.
Der validierte SQLite-Graph ist die kanonische Pflege-, Pruef- und Abfragestruktur.
YAML ist nur noch Legacy-Import, Bootstrap oder Export, sofern der Graph die YAML-Struktur fehlerfrei abbildet.

## Stand

Letzte Synchronisation: 2026-06-30

SQLite-Datenbank:

```text
tools/yaml-graph-sqlite/out/model-graph.sqlite
```

## Importumfang

```text
artifact_types:      95
artifacts:           423
relationship_types:  56
relationships:       1427
errors:              0
warnings:            494
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

- 494 Warnungen vom Typ `invalid_source_target_type`.

Diese Warnungen bedeuten nicht, dass referenzierte Artefakte fehlen.
Sie bedeuten, dass vorhandene Beziehungen zwar importierbar sind, aber noch nicht vollstaendig als erlaubte Source-/Target-Typ-Kombinationen im Metamodell formalisiert wurden.

## Haeufigste Warnungsgruppen

| Beziehung | Source-Typ | Target-Typ | Anzahl |
|---|---|---|---:|
| supports | customer_journey | business_goal | 38 |
| derived_from | data_model | requirement | 35 |
| supports | architecture_structural_element | customer_journey | 28 |
| supports | architecture_structural_element | business_goal | 26 |
| realizes | measure | requirement | 22 |
| derived_from | api_artifact | requirement | 21 |
| derived_from | architecture_artifact | requirement | 21 |
| references | requirement | business_rule | 18 |
| supports | product_offering | business_goal | 18 |
| constrains | business_rule | system_capability | 14 |

## Synchronisierte Korrekturen

- `data/project-ideas/smart-plant-watering.yaml` verwendet jetzt eine eigene Projektideen-ID `project_idea.smart_plant_watering` und referenziert das kanonische Projekt ueber `canonicalProject: project.smart_plant_watering`.
- `data/learning/projects/book-vault.yaml` definiert das MakerLab-Todo nicht mehr doppelt, sondern referenziert `todo.book_vault.3d_print_lock_model`.
- `data/business/knowledge-base.yaml` definiert `knowledge_base.distributed_engineering_knowledge` als kanonisches Artefakt.
- `data/learning/example-domains.yaml` definiert `example_domain.digital_tamagotchi` als kanonisches Artefakt.
- `data/architecture/artifacts.yaml` definiert `component.ota` als Architekturkomponente.
- Der SQLite-Importer ignoriert generierte Aggregatsichten als zweite Knotenquelle und behandelt eingebettete `views` und `exampleDomain` IDs als Referenzen statt als eigenstaendige Zweitdefinitionen.

## Naechster fachlicher Schritt

Die verbleibenden Warnungen sollten nicht blind unterdrueckt werden.
Sie zeigen, welche Beziehungstypen im Metamodell noch formalisiert werden sollten, wenn sie dauerhaft erlaubt sein sollen.

## Source-of-Truth-Regel

Ab diesem Stand gilt:

```text
SQLite Graph Model
-> YAML Export bei Bedarf
-> Markdown-/Mermaid-Lesesichten
```

YAML-Dateien sollen nicht mehr parallel fachlich gepflegt werden, wenn die gleiche Information im SQLite-Graphmodell vorhanden ist.
