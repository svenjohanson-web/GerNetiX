# Community-Portal und Projekt-Showcase

## Community-Startseite

Die angemeldete Community beginnt mit vier gleichrangigen Einstiegen:

1. Forum und Hilfe fuer Fragen und Erfahrungsaustausch,
2. Ideenwerkstatt fuer unfertige Projektideen, Feedback und Mitstreiter,
3. Projekt-Showcase fuer fertige oder weit entwickelte Projekte,
4. Elektronik-Marktplatz fuer gebrauchte Hardware.

Eine gemeinsame Suche verdichtet passende aktuelle Aktivitaeten. Die Startseite zeigt ausserdem neue Beitraege, eigene Ideen, eigene Showcase-Projekte, eigene Community-Anfragen und ungelesene Nachrichten. Die wiederkehrende Community-Challenge verbindet den Ablauf Idee vorstellen, Projekt entwickeln und Ergebnis zeigen.

## Projekt-Showcase

Ein `CommunityProjectShowcase` ist keine Idee und kein Verkaufsangebot. Der Autor waehlt ein eigenes Entwicklungsprojekt, beschreibt Ergebnis und Entstehung, erfasst verwendete Hardware und Tags und veroeffentlicht eine begrenzte, redigierte, unveraenderliche Projektkopie.

Identity prueft Sitzung und Projektbesitz und erstellt den Snapshot serverseitig. Secrets, Schluessel- und Binaerdateien werden ausgeschlossen. Listen enthalten keine Quelltexte; die Detailansicht liefert die begrenzte Projektkopie. Jeder nicht redaktionell gepruefte Eintrag traegt `community_unverified`.

## Persistenz

Die Community Platform ist PostgreSQL-Wahrheit fuer `community_project_showcases`. Die technische Account-ID bleibt in der Nutzer-API verborgen. Ein spaeteres Nachbauen oder Uebernehmen muss eine eigene accountgebundene Kopie im Project Server erzeugen und darf den veroeffentlichten Stand nicht veraendern.

## Offene Erweiterungen

Bildergalerien, Favoriten, Folgen, Reaktionen, redaktionelle Verifikation, Kommentarstrang am Showcase und automatische Uebernahme in ein eigenes Projekt sind nicht Bestandteil dieses MVP.
