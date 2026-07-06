# KI Cost Protection / AI Usage

MVP-Service fuer KI-Credits, Preflight-Pruefung, Usage Events, Budgetlimits und Admin Cost Controls.

Der Service ist der serverseitige Schutz vor ungedeckten oder unkontrollierten KI-Kosten. Er prueft vor kostenpflichtigen KI-Aufrufen Credits, Modellfreigabe, Tages-/Monatslimits, Prompt-/Antwortgroessen, Account-Sperren und globalen Kill-Switch. Jeder erlaubte, abgelehnte oder fehlerhafte Aufruf wird als Usage Event protokolliert.

## Start

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:5000
```

API-Prefix:

```text
/api/ai-usage
```

## Umgesetzt

- Credit Accounts und Ledger
- Credit-Gutschrift und Credit-Sperre
- KI-Preflight gegen Credits, Limits, Modellfreigabe und Kill-Switch
- Usage Event Audit Trail
- Verbrauchsabrechnung nach Tokens und Modellpreis
- Admin Usage Dashboard
- Admin Cost Control Actions inklusive Audit Events
- Suspicious Usage / Budgetnaehe

## Nicht-Ziele fuer diesen Stand

- keine echte LLM-Anbieterintegration
- keine produktive Authentifizierung
- keine externe Payment- oder Rechnungslogik
- keine persistente Datenbankmigration
