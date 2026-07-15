# Gemeinsame Operator-Oberflaechen

## Ziel

GerNetiX soll sich fuer denselben Betreiber auf PWA, Desktop und privater Administration wie eine zusammenhaengende Anwendung anfuehlen. Deshalb teilen die Oberflaechen dieselbe dunkle Designsprache, Kopfzeile, Statusdarstellung und die Bereiche **Uebersicht**, **Betrieb** und **Sicherheit**.

## Sicherheitsgrenzen bleiben erhalten

Gleiche Oberflaeche bedeutet nicht gleiche Berechtigung oder gleiche technische Moeglichkeit:

| Oberflaeche | Zweck | Zulässige Besonderheiten |
| --- | --- | --- |
| Plattform-PWA | Accountgebundene Bedienung, Boards, Meldungen und Hilfe | Keine Serveradministration oder lokale Prozesssteuerung |
| Desktop Operator Console | Lokale Entwicklungsprozesse, WireGuard und read-only VPS-Nachweise | Nur feste, isolierte Electron-IPC; keine generische Shell oder Admin-API |
| Private Admin Console | Serverbetrieb, Accounts, KI-Routing, E-Mail und Sicherheitsereignisse | Ausschliesslich privater Zugriff; Autorisierung wird serverseitig geprueft |

Eine Funktion wird daher nicht nur wegen einer sichtbaren Navigation freigeschaltet. Sie benoetigt weiterhin die passende Umgebung und eine serverseitige Berechtigungspruefung.

## Gemeinsame Umsetzung

- `services/shared/public/operator-shell.css` ist die gemeinsame visuelle Grundlage fuer Plattform-PWA und Admin Console.
- Der Identity Server und das Admin Tool liefern dieses Asset jeweils aus ihrem eigenen geschuetzten Origin aus.
- Der Desktop-Monitor folgt denselben Komponenten und Begriffen, bleibt aber absichtlich ein eigenstaendiges Electron-Paket.
- Neue Operator-Funktionen werden zuerst fachlich einer Berechtigung und einer dieser Oberflaechen zugeordnet. Erst danach werden sie in die gemeinsame Navigation aufgenommen.

## Ausbauregel

Read-only-Betriebsinformationen duerfen in einer spaeteren PWA-Ansicht erscheinen, wenn sie account- und rollenbezogen serverseitig freigegeben werden. Private Admin-APIs, SMTP-, LLM- und VPS-Steuerung werden dabei nicht in die PWA gespiegelt.
