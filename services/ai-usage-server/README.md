# KI Cost Protection / AI Usage

MVP-Service fuer KI-Credits, Preflight-Pruefung, Usage Events, Budgetlimits und Admin Cost Controls.

Der Service ist der serverseitige Schutz vor ungedeckten oder unkontrollierten KI-Kosten. Er prueft vor kostenpflichtigen KI-Aufrufen Credits, Modellfreigabe, Tages-/Monatslimits, Prompt-/Antwortgroessen, Account-Sperren und globalen Kill-Switch. Jeder erlaubte, abgelehnte oder fehlerhafte Aufruf wird als Usage Event protokolliert.

Runtime-State wird standardmaessig in `.runtime/gernetix-services.sqlite` persistiert. Unit-Tests koennen weiterhin explizit das In-Memory-Repository verwenden, aber lokale Dev-Server verlieren Usage Events nicht mehr bei jedem Neustart.

Neue Identity-Accounts starten mit dem aktuellen Monatslimit als Credit-Guthaben. Fuer diesen Stand gilt strikt: `1 Credit = 1 Token`. Tageslimit, Monatslimit und Quellenlimit muessen deshalb denselben Token/Credit-Rahmen abbilden; Anbieterpreise dienen nur der Kostenschaetzung.

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
- Verbrauchsabrechnung mit `1 Credit = 1 Token` und separater Anbieter-Kostenschaetzung
- Admin Usage Dashboard
- Admin Cost Control Actions inklusive Audit Events
- Suspicious Usage / Budgetnaehe
- SQLite-Persistenz fuer Credit Accounts, Ledger, Usage Events, Admin Audit Events und Policy

## Nicht-Ziele fuer diesen Stand

- keine echte LLM-Anbieterintegration
- keine produktive Authentifizierung
- keine externe Payment- oder Rechnungslogik
- keine externe Rechnungsstellung oder Provider-Reconciliation
