# SQLite Graph Explorer

Read-only Weboberflaeche fuer das kanonische SQLite-Graphmodell.

Der Explorer zeigt:

- Metamodelltypen unabhaengig von vorhandenen Instanzen
- erlaubte Metamodell-Beziehungsregeln
- konkrete Instanzen eines Artefakttyps
- Details einer Instanz
- eingehende und ausgehende Beziehungen
- eine lokale Graph-Ansicht um die ausgewaehlte Instanz

Er schreibt keine Daten und pflegt keine YAML-Dateien.

## Sichten

### Metamodell

Diese Sicht zeigt die definierten Entitaetstypen und erlaubten Beziehungsregeln.
Ein Entitaetstyp bleibt Teil des Metamodells, auch wenn aktuell keine Instanz existiert.

### Instanzen

Diese Sicht zeigt konkrete Artefakte und ihre gespeicherten Beziehungen.
Sie ist eine Artefakt-/Wissensgraph-Sicht, nicht die Definition des Metamodells.

## Start

```powershell
cd C:\Users\sven_\Desktop\GerNetiX\tools\sqlite-graph-explorer
& "C:\Program Files\nodejs\node.exe" server.js
```

Dann im Browser oeffnen:

```text
http://localhost:4318
```

## Datenquelle

Standard:

```text
tools/yaml-graph-sqlite/out/model-graph.sqlite
```

Optional kann eine andere Datenbank gesetzt werden:

```powershell
$env:GERNETIX_GRAPH_DB="C:\Pfad\model-graph.sqlite"
& "C:\Program Files\nodejs\node.exe" server.js
```

## Check

```powershell
& "C:\Program Files\nodejs\node.exe" server.js --check
```
