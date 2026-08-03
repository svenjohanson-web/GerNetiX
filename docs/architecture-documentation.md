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

Die serviceuebergreifende Trennung von festen technischen Schutzregeln und
variablen, versionierten Tarif-, Speicher-, Artefakt- und Lifecycle-Werten
steht in der
[Account-Speicher- und Lifecycle-Policy](account-storage-and-lifecycle-policy.md).

Die beschlossene Ablösung der PostgreSQL-Projektquellen durch private
Forgejo-Repositories, die Speichergrenze zu PostgreSQL und Artifact Store sowie
die testbaren Migrationsschritte stehen in
[Forgejo-Projektrepositories und lesbare Projektdateien](forgejo-project-repository-work-packages.md).

Die providerneutrale Trennung von dauerhafter Control Plane, System- und
Kunden-Workern, Grundlast-/Burst-Messung, privaten Rechnern, Cloud-Burst und
Kubernetes steht in der
[elastischen Worker- und Kapazitaetsarchitektur](elastic-worker-capacity-architecture.md).

Die akzeptierte Portabilitaetsgrenze fuer eine spaetere eigenstaendige
School-Deployment-Zelle sowie die Regel fuer standardmaessig deaktivierte
externe KI und ausschliesslich lokal verwaltetes BYOK steht in
[School-Deploymentgrenze und KI-Provider](school-deployment-architecture.md).
