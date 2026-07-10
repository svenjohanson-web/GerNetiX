# SQLite Graph Model

Kanonisches SQLite-Graphmodell fuer das GerNetiX Engineering-Wissen.

Die YAML-Dateien unter `data/` und `model/` sind ab jetzt Legacy-Import- und Bootstrap-Quellen.
Nach erfolgreichem Import mit `errors: 0` ersetzt die SQLite-Datenbank die YAML-Struktur als kanonische Pflege-, Pruef- und Abfragestruktur.

YAML soll nicht parallel weiter gepflegt werden, wenn der SQLite-Graph dieselbe Struktur exakt validiert abbildet.

## Import

```powershell
cd C:\Users\sven_\Desktop\GerNetiX
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js import
```

Standardausgabe:

```text
tools/yaml-graph-sqlite/out/model-graph.sqlite
```

Beim Import werden die generierten Graph-Tabellen aus Legacy-YAML neu aufgebaut. Die Authoring-Tabellen `graph_authored_artifacts` und `graph_authored_relationships` bleiben erhalten und werden wieder in den kanonischen Graphen gemischt.
Das ist der Bootstrap- und Vergleichspfad von YAML nach SQLite, nicht der normale Pflegeweg.

## Graph-first Pflege

Neue fachliche Regeln, Entscheidungen und Requirements werden direkt in den SQLite-Graphen geschrieben:

```powershell
node tools\yaml-graph-sqlite\import-yaml-graph.js upsert-artifact `
  --id architecture.example_decision `
  --type architecture_decision `
  --title "Beispielentscheidung" `
  --status approved `
  --owner-domain CrossDomain `
  --summary "Kurzbeschreibung" `
  --property rules='["Regel 1","Regel 2"]'
```

Beziehungen werden ebenfalls direkt geschrieben:

```powershell
node tools\yaml-graph-sqlite\import-yaml-graph.js upsert-relationship `
  --from architecture.example_decision `
  --relation references `
  --to requirement.example_requirement `
  --source-field derivedFromRequirements
```

Falsch gesetzte authored Beziehungen koennen wieder entfernt werden:

```powershell
node tools\yaml-graph-sqlite\import-yaml-graph.js delete-relationship `
  --from architecture.example_decision `
  --relation references `
  --to requirement.example_requirement `
  --source-field derivedFromRequirements
```

Danach kann ein Legacy-Import oder eine Graph-Validierung laufen; authored SQLite-Eintraege bleiben erhalten.

## Schema

Das Tool erzeugt mindestens diese Tabellen:

- `artifact_types`
- `artifacts`
- `relationship_types`
- `relationship_type_rules`
- `relationships`
- `validation_errors`
- `artifact_occurrences`
- `graph_authored_artifacts`
- `graph_authored_relationships`

## Abfragen

Zusammenfassung:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js summary
```

Ausgehende Beziehungen:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js outgoing project.smart_plant_watering
```

Eingehende Beziehungen:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js incoming project.smart_plant_watering
```

Traceability-Pfade bis zur Vision:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js trace project.smart_plant_watering
```

Isolierte Artefakte:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js isolated
```

Cluster nach Business Goal, Business Strategy, Business Capability und System Capability:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js clusters
```

Validierungsfehler:

```powershell
& "C:\Program Files\nodejs\node.exe" tools\yaml-graph-sqlite\import-yaml-graph.js errors
```

## Validierung

Der Importer protokolliert unter `validation_errors`:

- unbekannte Artefakttypen
- unbekannte Beziehungstypen
- ungueltige Source-/Target-Typen, soweit das Metamodell konkrete Regeln definiert
- fehlende Source- oder Target-Artefakte
- doppelte IDs
- Zyklen in hierarchischen Beziehungen

Generierte Aggregatsichten wie `model/traceability.yaml` werden nicht als zweite Knotenquelle importiert, damit sie die eigentlichen YAML-Artefakte nicht als Duplikate erscheinen lassen. `model/relations.yaml` bleibt waehrend der Migration die explizite Kantenquelle.

## Source-of-Truth-Regel

Aktuelle Zielregel:

```text
SQLite Graph Model
-> optionaler YAML Export
-> optionale Markdown-/Mermaid-Lesesichten
```

Nicht mehr:

```text
YAML
-> SQLite
-> Markdown
```

Solange die Migration noch nicht vollstaendig abgeschlossen ist, darf YAML fuer Bootstrap und Vergleich verwendet werden. Fachlich fuehrend ist nach validiertem Import der SQLite-Graph.
