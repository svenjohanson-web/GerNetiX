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
