# Auslieferungsmuster für öffentliche Nachbauprojekte

## Ziel

Ein Nachbauprojekt muss bereits vor dem Öffnen erkennen lassen, was GerNetiX tatsächlich ausliefert. Eine vorhandene Firmware gilt aus Kundensicht nicht als angeboten, wenn die Installation erst nach mehreren Erklärungsabschnitten auffindbar ist.

## Lieferstatus

Jede Katalogkarte benennt ihren tatsächlichen Lieferstatus eindeutig:

- **Anleitung:** Bauweg und Erklärungen, aber keine veröffentlichte Firmware.
- **Quellprojekt:** konfigurierbare Quellen, die vor der Installation gebaut werden müssen.
- **Fertig gebaut · direkt flashbar:** unveränderlicher, kompatibilitätsgeprüfter Release, der ohne eigenes Projekt und ohne eigenen Build installiert werden kann.

Ein höherer Lieferstatus darf nur angezeigt werden, wenn der zugehörige Kundenweg tatsächlich verfügbar ist.

## Pattern für direkt flashbare Projekte

Direkt flashbare Nachbauprojekte verwenden durchgängig dieselbe Reihenfolge:

1. Die Katalogkarte zeigt **Fertig gebaut · direkt flashbar** und eine sichtbare Aktion **Öffnen & flashen**.
2. Der Hero nennt Boardziel, Kontopflicht und Buildpflicht und bietet die primäre Aktion **Jetzt flashen**.
3. Danach erklärt eine zusammenhängende Projektvorstellung zuerst, was das Projekt ist und was man damit machen kann.
4. Materialbedarf, Installation und Bedienungsanleitung folgen in dieser Reihenfolge. Technische Prüf- und Datenschutzhinweise werden abschließend kompakt zusammengefasst und nicht als paralleler zweiter Ablauf erzählt.
5. Die Installationseinheit zeigt Zielhardware, Releasezustand, überschreibende Wirkung, Browser-/Helper-Weg und den konkreten Verbindungsbutton.
6. Vor dem Schreiben werden Boardtyp, Flashgröße, Dateigrößen und SHA-256-Prüfsummen geprüft.

## Abgrenzung

Lern- und Entwicklungswege bleiben zusätzliche Perspektiven. Sie dürfen die direkte Installation eines fertig veröffentlichten Nachbauprojekts weder voraussetzen noch verdecken.
