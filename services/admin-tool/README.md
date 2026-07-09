# Admin Tool

MVP fuer das GerNetiX Admin Tool als eigenstaendiger Admin-Backend/API-Service.

Das Admin Tool bietet erste berechtigte Sichten auf Device-Status, Support-Entitlement, Learning-Feedback, Customer-Data-Consent, Audit-Events und KI-Usage-Monitoring. Es besitzt im MVP keine fuehrenden Domaenendaten, sondern nutzt Seed-/In-Memory-Daten als Adapter-Stellvertreter fuer die spaeteren Domaenen-APIs.

## Zweck

- Admin-/Support-Uebersicht bereitstellen
- Device-Management-Status pruefbar machen
- Support-Entitlement und GerNetiX-vs-Community einsehen
- kundenrelevante Details nur mit Consent, Rechtsgrundlage oder Sicherheitsgrund anzeigen
- Zugriffe auf kundenrelevante Daten auditieren
- Learning-Feedback maskiert oder berechtigt anzeigen
- KI-Usage-Kennzahlen fuer Kostenkontrolle zusammenfassen
- administrative KI-Kostensteuerung auditierbar vorbereiten
- LLM-Provider fuer Kunden-KI-Chat und Entwicklungsplattform konfigurieren

## MVP-Implementierung

Start:

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4600
```

Admin-HMI:

```text
http://127.0.0.1:4600/admin/
```

Konfiguration:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4600`
- `ADMIN_TOOL_RUNTIME_DIR`: Runtime-Verzeichnis fuer spaetere temporaere Artefakte
- `LLM_CONFIG_PATH`: Pfad zur gemeinsamen lokalen LLM-Konfiguration, Standard `.runtime/identity-llm-config.json`
- `OLLAMA_BASE_URL`: lokaler Ollama-Endpoint, Standard `http://127.0.0.1:11434`
- `OLLAMA_MODEL`: lokales Default-Modell, Standard `llama3.2:3b`

## Sicherheitsregeln

- Secret-Material, Credential-Secrets und HMAC-Schluessel werden nie angezeigt.
- Ohne Consent oder dokumentierte Rechtsgrundlage werden kundenrelevante Details maskiert.
- Jede Admin-/Support-Einsicht in kundenrelevante Daten erzeugt ein Audit-Event.
- Support-Rollen brauchen `support_registered_board_check` oder `admin_device_management`.
- Admin-Rollen brauchen die passende Admin-Capability fuer die jeweilige Sicht.

## Nicht-Ziele fuer diesen Stand

- keine produktive Authentifizierung
- keine produktive Admin-Authentifizierung
- keine Datenbankmigration
- keine direkte Integration mit Device Management, Learning oder AI Usage Services
- keine produktive Rollen-/Grant-Verwaltung
