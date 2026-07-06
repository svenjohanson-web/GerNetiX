# E2E Demo Flow

Reproduzierbarer Smoke-Test fuer den aktuellen MVP-Verbund.

```powershell
node tools\e2e-demo-flow\run-demo-flow.js
```

Der Befehl erwartet laufende Services auf den Standardports.

```powershell
node tools\e2e-demo-flow\run-demo-flow.js --start-services
```

Startet die benoetigten Services temporaer, fuehrt den Smoke aus und beendet nur die vom Skript gestarteten Prozesse.

Geprueft werden:

- Provisioning Tool registriert GerNetiX-verified Device im Device Management Server.
- Recovery Tool registriert Community-Device im Device Management Server.
- Community AI Assistant beantwortet eine Frage mit verifizierter Community-Quelle und AI Usage Buchung.
