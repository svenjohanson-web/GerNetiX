# Zentrale GerNetiX-Architekturdokumentation

Die GerNetiX-Architekturdokumentation wird als eigenstaendige Offline-Lesesicht gebuendelt. Sie gehoert nicht zum Identity Server und benoetigt keinen laufenden Serverprozess.

## Ziel

Die bisher entstandenen Architekturtexte, Diagramme, generierten Sichten und frueheren Aufbereitungsversuche sollen nicht weiter als voneinander getrennte Einstiege behandelt werden. Die Offline-Dokumentation rekonstruiert und indexiert diesen Bestand zentral.

## Quellenhierarchie

1. Der SQLite-Graph unter `tools/yaml-graph-sqlite/out/model-graph.sqlite` ist die kanonische fachliche Quelle fuer strukturierte Entscheidungen, Requirements, Artefakte und Beziehungen.
2. Gepflegte Markdown-Dokumente unter `docs/` liefern lesbare Begruendungen, Ablaeufe und technische Details.
3. Dateien unter `docs/generated/` sind generierte Lesesichten und werden nicht als parallele Wahrheit gepflegt.
4. Weitere und abgeloeste Dokumentationsansaetze bleiben im Rekonstruktionsarchiv sichtbar und werden eindeutig gekennzeichnet.

## Offline-Anwendung

Der Generator unter `tools/architecture-docs/` liest die vorhandenen Dokumente, zentrale SVG-Diagramme und die Architekturentscheidungen aus dem SQLite-Graphen. Er erzeugt eine statische Browser-Anwendung unter `tools/architecture-docs/dist/`.

Die Ausgabe bietet:

- eine thematische Navigation,
- Volltextsuche im gebuendelten Bestand,
- sichtbare Quellen- und Statuskennzeichnung,
- direkt eingebettete Architekturdiagramme,
- eine aus dem SQLite-Graphen erzeugte Entscheidungssicht,
- ein Rekonstruktionsarchiv fuer weitere und fruehere Versuche.

## Pflege

Fachliche Entscheidungen werden weiterhin im SQLite-Graphen gepflegt. Lesbare Konzepte werden in ihrem bestehenden Dokument aktualisiert. Nach Aenderungen wird die Offline-Sicht mit `npm run build` im Verzeichnis `tools/architecture-docs` neu erzeugt.

Die Zuordnung von SQL-Datenbanken, Docker-Volumes, Downloadklassen, Firmware-BLOBs, Account-Assets, Community-Inhalten und technischen Caches steht im [Persistenz- und Asset-Speicherkonzept](persistence-and-asset-storage.md).
