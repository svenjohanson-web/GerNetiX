# Community Platform API

MVP fuer Community-Fragen, persönliche Projektbegleitung, Community-Marktplatz, Triage, verifizierte Antworten und dauerhafte Wissensbasis.

Die API ist nicht öffentlich erreichbar. Der Identity Server ruft den regulären Bereich mit dem internen Community-Token auf und übergibt dabei ausschließlich den angemeldeten Account als Actor. Ein getrenntes Admin-Tool verwendet zusätzlich einen eigenen Admin-Token; Identity-Konten erhalten dabei keine Operatorrechte.

Die Community Platform speichert Fragen, Antworten und Knowledge Documents standardmässig dauerhaft in einer eigenen SQLite-Datei (`.runtime/gernetix-community.sqlite`). Der Pfad kann mit `COMMUNITY_SQLITE_PATH` geändert werden; `COMMUNITY_PERSISTENCE_BACKEND=memory` ist nur für isolierte Tests vorgesehen.

## Prefix

```text
/api/community
```

## Questions

```text
GET  /questions
POST /questions
GET  /questions/{questionId}
POST /questions/{questionId}/triage
```

Neue Fragen erhalten `triage_due_at`, `triage_status` und eine sichtbare SLA-Bewertung.

`POST /questions` verlangt zusätzlich `visibility` mit `public` oder `private`. Öffentliche Anfragen können angemeldete Mitglieder sehen. Private Anfragen und ihre Antworten sind ausschliesslich für das anfragende Konto sowie für autorisierte, getrennte Admin-Akteure sichtbar. Account-IDs werden in öffentlichen Antworten nicht ausgegeben.

`GET /questions?mine=true` begrenzt die Liste serverseitig auf Anfragen der aufrufenden Person. Der übergebene Actor bestimmt die Zuordnung; eine fremde Account-ID kann nicht als Filter angegeben werden.

## Answers

```text
GET   /questions/{questionId}/answers
POST  /questions/{questionId}/answers
PATCH /answers/{answerId}
POST  /answers/{answerId}/verify
```

Verifizierte Antworten sind fuer Nutzer sichtbar. Aenderungen an verifizierten Antworten setzen `requires_reverification`.

## Knowledge

```text
GET /search?q={term}
GET /knowledge-documents
```

Verifizierte Antworten werden als indexierbare Knowledge Documents bereitgestellt. Der KI-Community-Assistent kann diese API als quellengebundene RAG-Basis nutzen.

Private Anfragen dürfen weder durch Suche noch als Knowledge Document ausserhalb ihres privaten Begleitungsdialogs erscheinen.

## Ideenwerkstatt

```text
GET  /ideas
POST /ideas
GET  /ideas/{ideaId}
POST /ideas/{ideaId}/comments
```

Die Ideenwerkstatt speichert Projektvorstellungen getrennt von Fragen und Elektronik-Inseraten. Ideen enthalten Pitch, Beschreibung, Motivation, Reifegrad, gesuchte Unterstuetzung und Tags. Angemeldete Mitglieder koennen Feedback, Fragen oder Mitarbeitshinweise kommentieren. Identity setzt Autoren aus der Sitzung; technische Account-IDs werden nicht ausgegeben. Ideen enthalten weder Preis noch Verkaufslogik.

## Projekt-Showcase

```text
GET  /showcases
POST /showcases
GET  /showcases/{showcaseId}
```

Der Showcase ist fuer fertige oder weit entwickelte Projekte. Identity prueft den Besitz des ausgewaehlten Entwicklungsprojekts und erstellt eine begrenzte, redigierte und unveraenderliche Projektkopie. Die Liste enthaelt nur Metadaten und Dateianzahl; erst die Detailansicht liefert die Projektkopie. Projektideen und Verkaufsangebote bleiben getrennt. Nicht redaktionell gepruefte Projekte tragen `community_unverified`.

## Community-Marktplatz

```text
GET  /marketplace/listings
POST /marketplace/listings
GET  /marketplace/listings/{listingId}
PATCH /marketplace/listings/{listingId}
```

Der Marketplace ist ein Kleinanzeigenbereich fuer gebrauchte Elektronik und kein Projektkatalog. Ein Inserat enthaelt Artikel, Beschreibung, Kategorie, Zustand, Preis, optionale Abholregion, Versandmoeglichkeit und Tags. Der Identity-Proxy setzt den Anzeigenamen aus der Sitzung; die technische Account-ID wird nicht ausgegeben. Der Anbieter kann den Status auf `reserved` oder `sold` setzen. Jeder Eintrag traegt `used_electronics` und `community_unverified`. Kontakt erfolgt ueber die vorhandenen privaten Community-Nachrichten; GerNetiX wickelt keine Zahlung ab.

## Betriebsstatus

```text
GET /operations-summary
```

Der interne, durch `COMMUNITY_INTERNAL_TOKEN` geschützte Endpunkt liefert ausschließlich aggregierte Zähler für Admin Tool und Betriebsmonitoring: Fragen nach Sichtbarkeit und Bearbeitungsstatus, Triage-Rückstand, Antworten nach Verifizierungsstatus, Wissensdokumente, Ideen, Showcase-Projekte, Marketplace-Eintraege sowie das konfigurierte Persistenz-Backend. Titel, Texte, technische Account-/Projektkennungen und andere Community-Inhalte werden nicht ausgegeben.

Die ebenfalls durch `COMMUNITY_INTERNAL_TOKEN` geschuetzten
`notification-outbox`-Routen duerfen nur ohne Community-Akteur durch Identity
verwendet werden. Claim-Antworten enthalten ausschliesslich Ereignis-ID,
Empfaenger-`user_id`, Kategorie und Versuchszahl. Browser-Akteure erhalten
keinen Zugriff. Complete beziehungsweise Retry akzeptieren nur den minimierten
Zustellstatus; Nachrichten-, Projekt- oder E-Mail-Inhalte sind nicht Teil des
Vertrags.

Jeder Claim kann vorab den statusgebundenen Retention-Lauf ausfuehren. Die
Antwort ergaenzt nur `retention.enabled` und aggregierte Loeschzaehler, keine
geloeschten Kennungen. Ohne
`COMMUNITY_NOTIFICATION_RETENTION_ENABLED=1` bleibt die Bereinigung
deaktiviert. Bei Aktivierung laeuft sie hoechstens stuendlich und entfernt nur
abgelaufene `delivered`- beziehungsweise `dead_letter`-Zeilen; `pending`,
`retry` und aktive Leases bleiben erhalten.

## Getrennte Admin-Verwaltung

```text
GET  /admin/overview
GET  /admin/support-threads
GET  /admin/support-threads/{threadId}
POST /admin/support-threads/{threadId}/messages
GET  /admin/questions
GET  /admin/questions/{questionId}
POST /admin/questions/{questionId}/triage
POST /admin/questions/{questionId}/answers
POST /admin/answers/{answerId}/verify
GET  /admin/message-reports
POST /admin/message-reports/{reportId}/resolve
```

Diese Routen akzeptieren ausschließlich `COMMUNITY_ADMIN_TOKEN` und einen vom Admin Tool mitgegebenen Admin-Akteur. Die Plattform prüft dessen Capability erneut: Support darf nur Support-Postfach und Community-Anfragen lesen und beantworten; Moderation darf ausschließlich konkret gemeldete Nachrichten prüfen und entscheiden. Private Direktnachrichten werden nicht als allgemeines Admin-Postfach exponiert. Das Admin Tool schreibt keine Kopie der Community-Inhalte in sein Operations-Register, sondern protokolliert jeden Abruf und jede Änderung dort als Audit-Ereignis.
