# KI Cost Protection / AI Usage API

MVP-API fuer Credits, Preflight, Usage Events und Admin Cost Controls.

## Basis

- `GET /health`
- Prefix: `/api/ai-usage`

## Credits

- `GET /api/ai-usage/accounts/{accountId}/credits`
- `POST /api/ai-usage/accounts/{accountId}/credits/grant`
- `POST /api/ai-usage/accounts/{accountId}/credits/hold`

## KI-Aufrufe

- `POST /api/ai-usage/preflight`
- `POST /api/ai-usage/events/{eventId}/complete`
- `POST /api/ai-usage/events/{eventId}/fail`
- `GET /api/ai-usage/events?account_id=...`

`preflight` prueft Credits, Modellfreigabe, Tages-/Monatslimits, Prompt-/Antwortgroesse, Account-Sperre und globalen Kill-Switch. Auch Ablehnungen erzeugen ein Usage Event.

Fuer den aktuellen Stand gilt `1 Credit = 1 Token`. `update_policy` darf Tages- und Monatslimit als `daily_token_limit`/`monthly_token_limit` oder als bestehende Credit-Felder senden; der Service speichert beide Sichtweisen identisch. Quellenlimits fuer externe Provider werden auf das Monatslimit normalisiert.

## Admin

- `GET /api/ai-usage/admin/dashboard`
- `GET /api/ai-usage/admin/audit-events`
- `POST /api/ai-usage/admin/cost-controls`

Cost-Control-Aktionen unterstuetzen:

- `grant_credits`
- `hold_credits`
- `block_account`
- `unblock_account`
- `update_policy`
- `set_global_kill_switch`
- `allow_model`
- `block_model`
