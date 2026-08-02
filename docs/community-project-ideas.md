# Community-Ideenwerkstatt

## Ziel

Die Ideenwerkstatt ist der getrennte Community-Bereich fuer Projektideen. Mitglieder koennen eine noch unfertige Idee vorstellen, ihren Nutzen erklaeren und gezielt Feedback, Mitstreiter oder Fachwissen suchen. Sie ist weder Kleinanzeigenmarkt noch Shop: Ideen besitzen keinen Preis und werden dort nicht verkauft.

## Aufbau einer Idee

Eine `CommunityProjectIdea` enthaelt:

- Titel und kurzen Pitch,
- ausfuehrliche Beschreibung und optionale Motivation,
- Reifegrad `rough_idea`, `concept`, `prototype` oder `seeking_collaborators`,
- gesuchte Unterstuetzung wie Feedback, Mitstreiter, Hardwarewissen, Softwarewissen oder Tests,
- optionale Tags und den sichtbaren Community-Nickname des Autors.

Andere angemeldete Mitglieder koennen unter der Idee Fragen, Feedback oder ein Angebot zur Mitarbeit veroeffentlichen. Technische Account-IDs werden weder an Ideen noch an Diskussionsbeitraegen ausgegeben.

## Persistenz und Abgrenzung

Die Community Platform ist PostgreSQL-Wahrheit fuer `community_project_ideas` und `community_project_idea_comments`. Identity leitet den Autor aus der Sitzung ab. Projektquellen werden nicht automatisch angehaengt. Falls aus einer Idee spaeter ein echtes GerNetiX-Projekt entsteht, muss dies als eigener bewusster Ablauf im Project Server erfolgen.

## MVP-Grenzen

Moderation, Reaktionen, Favoriten, Einladungen in gemeinsame Projektrollen, Eigentums-/Lizenzvereinbarungen und automatische Umwandlung in ein Entwicklungsprojekt sind noch nicht Teil dieses Stands.
