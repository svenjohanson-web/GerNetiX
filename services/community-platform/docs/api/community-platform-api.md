# Community Platform API

MVP fuer Community-Fragen, Triage, verifizierte Antworten und dauerhafte Wissensbasis.

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
