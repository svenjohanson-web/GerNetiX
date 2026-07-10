# KI Cost Protection / Usage Monitoring

Diese Datei ist eine generierte Lesesicht. Der validierte SQLite-Graph ist die kanonische Struktur.

Fuehrende Quellen:

- `data/business/business-rules.yaml`
- `data/business/business-capabilities.yaml`
- `data/requirements/business-requirements.yaml`
- `data/requirements/non-functional-requirements.yaml`
- `data/data-models/data-models.yaml`
- `data/api/api-artifacts.yaml`
- `data/architecture/artifacts.yaml`

## Restriktion

`BR-006` Schutz vor unkontrollierten KI-Kosten

Kostenpflichtige KI-Nutzung muss technisch und wirtschaftlich begrenzt, nachvollziehbar und serverseitig kontrolliert werden.

## Business Capability

- `BC-041`: Kostenkontrolle
- `BC-040`: KI-Community-Assistent bereitstellen

## Massnahmen / SystemCapabilities

- `measure.ai_credit_management` -> `system_capability.ai_credit_management`
- `measure.ai_prepaid_credit_check` -> `system_capability.ai_prepaid_credit_check`
- `measure.ai_budget_limits` -> `system_capability.ai_budget_limits`
- `measure.ai_usage_audit_trail` -> `system_capability.ai_usage_audit_trail`
- `measure.ai_usage_monitoring` -> `system_capability.admin_ai_usage_monitoring`
- `measure.ai_admin_cost_controls` -> `system_capability.admin_ai_cost_controls`
- `measure.ai_suspicious_usage_detection` -> `system_capability.ai_suspicious_usage_detection`

## Requirements

- `requirement.ai_credit_balance`: KI-Credit-Guthaben fuehren
- `requirement.ai_prepaid_credit_check`: Kein ungedeckter KI-Aufruf
- `requirement.ai_credit_consumption_calculation`: Credits verbrauchsabhaengig berechnen
- `requirement.ai_usage_limits`: KI-Nutzung ueber Limits begrenzen
- `requirement.ai_model_access_control`: Teure KI-Modelle tarifabhaengig freigeben
- `requirement.ai_global_kill_switch`: Globalen KI-Kill-Switch bereitstellen
- `requirement.ai_usage_event_audit_trail`: KI Usage Events serverseitig protokollieren
- `requirement.ai_admin_usage_dashboard`: Admin Dashboard fuer KI Usage Monitoring bereitstellen
- `requirement.ai_cost_margin_reporting`: KI-Kosten und Marge je Tarif oder Nutzergruppe schaetzen
- `requirement.ai_admin_cost_control_actions`: Administrative KI-Kostensteuerung bereitstellen
- `requirement.ai_suspicious_usage_detection`: Auffaellige KI-Nutzung sichtbar machen
- `requirement.community_ai_assistant_monitoring`: KI-Community-Assistent im Admin Dashboard ueberwachen

## Admin Dashboard

Das Admin Tool muss anzeigen koennen:

- aktuelle KI-Nutzung pro Benutzer
- verbrauchte Credits und Tokens pro Benutzer
- Quellenrating pro Account, z. B. lokale LLMs unbegrenzt und GPT/OpenAI mit monatlichem Tokenlimit
- Verbrauch nach heute, Woche und Monat
- Verbrauch nach KI-Modell
- Anzahl KI-Anfragen
- durchschnittliche Kosten pro Anfrage
- teuerste Benutzer
- auffaellige Nutzungsmuster
- fehlgeschlagene KI-Aufrufe
- abgelehnte KI-Aufrufe wegen fehlender Credits
- Nutzer nahe am Budgetlimit
- Systemkosten gesamt
- geschaetzte Marge je Tarif oder Nutzergruppe

## Community AI Assistant Monitoring

Der KI-Community-Assistent erweitert das bestehende Dashboard um:

- aktive Premium-Nutzer
- durchschnittliche Antwortzeit
- Kosten pro Community
- Cache-Trefferquote
- RAG-Trefferquote
- haeufigste Fragen
- Fehlerquote der Community-KI
- Budgetwarnungen fuer Community-KI
- verwendete Datenquellen und Modelle

## Usage Event

`data_model.ai_usage_event`

Jeder kostenpflichtige, fehlgeschlagene oder abgelehnte KI-Aufruf wird serverseitig protokolliert mit Benutzer-ID, Zeitpunkt, Modell, Quelle, Tokens, Credits, Anbieter-Kostenschaetzung, Tarif, Projektkontext, Status, Fehler, Ablehnungsgrund und verwendeter Schutzmassnahme.

`data_model.ai_source_rating`

Pro Account wird das KI-Rating je Quelle ausgewertet. Lokale LLM-Quellen koennen unbegrenzt sein, waehrend GPT/OpenAI-Quellen z. B. auf 100.000 Tokens pro Monat begrenzt werden. Nutzer sehen den Prozentverbrauch im Dashboard und in der IDE; Admins sehen dieselben Werte im Account-Blatt.

## Admin-Steuerung

Administratoren koennen Credits gutschreiben oder sperren, Benutzer temporaer fuer KI sperren, Tages- und Monatslimits aendern, Tarifgrenzen konfigurieren, teure Modelle freigeben oder sperren, globalen KI-Kill-Switch aktivieren, Budgetwarnschwellen konfigurieren und verdaechtige Nutzung pruefen.

## KI-Zusatzkontingent

`product_offering.ai_credit_addon`

Nutzer koennen ein bezahlbares Zusatzkontingent erwerben, um mehr KI-Credits fuer eine bessere oder laengere KI-Erfahrung zu erhalten.

Regeln:

- Das Zusatzkontingent bleibt ein Add-on, kein Ersatz fuer Cost Protection.
- Gekaufte Credits werden im Credit Ledger nachvollziehbar gebucht.
- Negative Credit-Salden bleiben unzulaessig.
- Tageslimits, Monatslimits, Modellfreigaben und globale Schutzmechanismen gelten weiterhin.

Offen:

- `open_question.ai_credit_addon_commercial_rules`

## Traceability

```text
BR-006
-> BC-041
-> measure.ai_prepaid_credit_check
-> system_capability.ai_prepaid_credit_check
-> requirement.ai_prepaid_credit_check
-> architecture_artifact.ai_cost_protection
-> data_model.ai_usage_event
-> api_artifact.ai_usage_preflight
```

```text
BR-006
-> BC-041
-> measure.ai_usage_monitoring
-> system_capability.admin_ai_usage_monitoring
-> requirement.ai_admin_usage_dashboard
-> architecture_artifact.ai_usage_observability
-> app.admin_tool
-> system_capability.admin_ai_usage_monitoring
```

## Non-Functional Requirement

`nfr.ai_cost_protection_auditability`

KI-Kostenkontrolle, Credit-Pruefungen, abgelehnte Aufrufe und administrative Eingriffe muessen nachvollziehbar, manipulationsresistent und serverseitig pruefbar sein.
