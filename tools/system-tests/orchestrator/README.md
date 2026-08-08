# Sicherer lokaler Systemtest-Orchestrator

Der Orchestrator fuehrt den vorhandenen k6-Ablauf und den MQTT-Geraetesimulator
parallel gegen **bereits gestartete Loopback-Dienste** aus. Optional startet er
danach den kleinen Browser-Ablauf. Er startet weder Docker/Compose noch andere
Infrastruktur und aktiviert auch beim Profil `chaos` niemals automatisch einen
Fehler.

## Sicherheitsgrenzen

- HTTP(S)- und MQTT-Ziele muessen `localhost`, `127.0.0.1` oder `::1` sein.
- MQTT wird in diesem rein lokalen Ablauf nur ueber `mqtt://` akzeptiert.
- `ALLOW_REMOTE_TARGET` wird ausdruecklich abgelehnt.
- Vor dem ersten Kindprozess werden Binaries, Test-Zugangsdaten, optionale
  Browser-Voraussetzungen und die TCP-Erreichbarkeit beider Dienste geprueft.
- Kindprozesse erhalten nur eine kleine Allowlist an Umgebungsvariablen.
- `SIGINT` und `SIGTERM` werden an laufende Kindprozesse weitergegeben.
- Berichte landen ausschliesslich im ignorierten Verzeichnis
  `tools/system-tests/.runtime/reports/<lauf-id>/`.

## Ausfuehrung

Die Testkonten und Dienste muessen vorher kontrolliert vorbereitet worden sein:

```sh
USERNAME_TEMPLATE='system-test-user-{vu}' \
PASSWORD_TEMPLATE='<nur-lokales-testpasswort-{vu}>' \
node tools/system-tests/orchestrator/cli.js \
  --profile smoke \
  --identity-url http://127.0.0.1:14300 \
  --broker-url mqtt://127.0.0.1:51883
```

Mit `--browser` wird der Browser-Ablauf erst nach erfolgreichem Abschluss von
k6 und Geraetesimulator ausgefuehrt. Dafuer sind zusaetzlich
`GERNETIX_BROWSER_SESSION_COOKIE_NAME` und
`GERNETIX_BROWSER_SESSION_COOKIE_VALUE` erforderlich.

Der Orchestrator besitzt absichtlich keine Optionen zum Starten, Stoppen oder
Zuruecksetzen von Infrastruktur und keine Option zum Aktivieren von Chaos.
