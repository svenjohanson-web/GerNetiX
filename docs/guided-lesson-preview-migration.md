# Guided Lesson Preview Migration

## Ziel

Das Dev-Step-by-Step-Tool bleibt ein schnelles Autorenwerkzeug. Wenn eine Lektion dort gut aussieht, soll sie ohne manuelle Code-Migration in die Server-IDE gespiegelt werden koennen, um Layout, Visualisierungen und Ablauf in der Plattform zu pruefen.

## Ablauf

1. Autor bearbeitet die Lesson in `tools/guided-code-lesson/index.html`.
2. Button `Auf Server pruefen` erzeugt aus der aktuellen Lesson ein `ProjectViewManifest`.
3. Das Manifest wird an `POST /api/dev/lesson-preview-migration` des Identity Servers gesendet.
4. Der Identity Server speichert das Manifest als Preview-Override fuer die laufende Session.
5. Die User IDE zeigt das Projekt ueber `/app/ide/?project=project_<slug>` mit diesem Preview-Manifest an.

## Grenzen

- Der Endpunkt ist ein lokaler Dev-/Preview-Pfad, keine Freigabe-Pipeline.
- Der Preview-Override ist pro laufendem Identity-Server-Prozess gedacht.
- Die kanonische Lesson bleibt vorerst das Dev-Step-by-Step-Tool, bis ein eigenes persistentes Lesson-Manifest als Master eingefuehrt ist.
- Eine spaetere Freigabe sollte das Manifest versionieren und dauerhaft im Project Server speichern.
