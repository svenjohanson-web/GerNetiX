# Klassifikation des Lernprojekt-Katalogs

Lernprojekte erhalten genau eine stabile Hauptkategorie und beliebig viele kontrollierte Tags. Die Klassifikation dient ausschließlich der Darstellung und Filterung im Lernprojekt-Katalog.

## Kategorien

- `software_engineering`: Software Engineering
- `desktop`: PC / Mac
- `embedded`: Embedded
- `distributed_system`: Verteilte Systeme
- `mobile`: Mobile

## Tags

Tags sind namespaced, zum Beispiel `platform:esp32`, `platform:stm32`, `platform:avr`, `protocol:mqtt` oder `topic:firmware`. Neue Tags werden in der kontrollierten Liste des Identity Servers ergänzt, bevor sie in einer Lernprojektdefinition verwendet werden. So bleiben Schreibweisen und Filter stabil.

Ein Tag beschreibt ein Merkmal des Lernangebots. Er ersetzt keine Hardware-, Runtime- oder Capability-Anforderung des Projekts.

## Abgrenzung

Die Klassifikation gilt nicht für freie Entwicklungsprojekte. Startet ein Nutzer ein Lernprojekt, übernimmt das accountgebundene Projekt Kategorie und Tags aus seiner Lernprojekt-Katalogdefinition. Die Metadaten werden nicht als zweite fachliche Wahrheit im Project Server dupliziert.

## Entwicklungsprojekte und einzeln startbare Lessons

Ein projektzentriertes Lernangebot kann im Katalog als Entwicklungsprojekt mit einer zusammenhaengenden Projektstory erscheinen.

Der Katalog bietet dann zwei Einstiege:

- `Projektstory starten`: erzeugt ein accountgebundenes Entwicklungsprojekt und fuehrt die zugeordneten DevelopmentLessons in ihrer Projekt-Reihenfolge fort.
- `Lesson einzeln starten`: erzeugt ein separates accountgebundenes Uebungsprojekt aus dem `LessonStartSnapshot` und zeigt nur die Schritte dieser DevelopmentLesson.

Die DevelopmentLesson wird dabei nicht dupliziert. Ein zentraler Lesson-Katalog besitzt Lesson, Schritte und Einzelstart-Snapshot; Lernprojekte enthalten nur `ProjectLessonAssignment`-Zuordnungen. Deshalb kann dieselbe Lesson auch mehreren Lernprojekten zugeordnet werden. Reihenfolge, Pflichtstatus, Freischaltbedingung und narrative Einbettung gehören zur jeweiligen Projektzuordnung, nicht zur Lesson-Kopie. Projektmodus und Einzelmodus referenzieren dieselbe Lesson und dieselben Schritte. Nur der Ausgangszustand und der gespeicherte Arbeitskontext unterscheiden sich.
