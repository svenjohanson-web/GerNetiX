# Community Platform API

MVP fuer Community-Fragen, persönliche Projektbegleitung, Triage, verifizierte Antworten und dauerhafte Wissensbasis.

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

## Betriebsstatus

```text
GET /operations-summary
```

Der interne, durch `COMMUNITY_INTERNAL_TOKEN` geschützte Endpunkt liefert ausschließlich aggregierte Zähler für Admin Tool und Betriebsmonitoring: Fragen nach Sichtbarkeit und Bearbeitungsstatus, Triage-Rückstand, Antworten nach Verifizierungsstatus, Wissensdokumente sowie das konfigurierte Persistenz-Backend. Titel, Texte, technische Account-/Projektkennungen und andere Community-Inhalte werden nicht ausgegeben.

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
