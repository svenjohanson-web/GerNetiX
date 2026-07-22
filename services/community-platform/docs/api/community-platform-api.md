# Community Platform API

MVP fuer Community-Fragen, persönliche Projektbegleitung, Triage, verifizierte Antworten und dauerhafte Wissensbasis.

Die API ist nicht öffentlich erreichbar. Ausschliesslich der Identity Server ruft sie mit dem internen Community-Token auf und übergibt dabei den angemeldeten Account als Actor.

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

`POST /questions` verlangt zusätzlich `visibility` mit `public` oder `private`. Öffentliche Anfragen können angemeldete Mitglieder sehen. Private Anfragen und ihre Antworten sind ausschliesslich für das anfragende Konto sowie für die in `COMMUNITY_OPERATOR_USER_IDS` eingerichteten GerNetiX-Operatoren sichtbar. Account-IDs werden in öffentlichen Antworten nicht ausgegeben.

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
