# Zusammengefuehrter Systemtestbericht

`mergeReports(profile, sources)` normalisiert die Abschlussberichte von k6,
MQTT-Geraetesimulator, Browserlauf, Chaos-Steuerung und Integritaetspruefung in
ein versioniertes Ergebnisobjekt. Dieses Objekt kann direkt an die bestehende
`evaluateRun(profile, result)`-Funktion uebergeben werden.

Der Merger arbeitet fail-closed: Jeder Bericht ist erforderlich, Schema- und
Profilabweichungen werden abgewiesen, konfigurierte Chaos-Szenarien muessen
vollstaendig vorliegen und ein erfolgreicher Browserbericht muss alle
vereinbarten Browserablaeufe enthalten. Beim MQTT-Abschlussbericht wird
`peakConnected` als erreichte Verbindungszahl verwendet, weil `connected` nach
dem kontrollierten Stop erwartungsgemaess null ist.

Wenn ein Orchestrator fuer einen Lauf bewusst keinen Browser startet, muss er
`browser: null` uebergeben. Das wird im Gesamtbericht explizit als
`status: "skipped"` festgehalten. Ein fehlendes Browserfeld bleibt ein Fehler;
ein ausgefuehrter, fehlgeschlagener Browserlauf laesst die bestehende
`evaluateRun`-Auswertung ueber `integrity.ok=false` sicher fehlschlagen.

Das Gesamtergebnis uebernimmt ausschliesslich aggregierte Zahlen, boolesche
Zustaende, fest erlaubte Szenarionamen und normalisierte Issue-Codes. Freie
Payloads, Checktexte, Subjects, Ziel-URLs, Credentials und interner k6-State
werden nie kopiert. Unerwartete Felder im besonders sensiblen
Geraetesimulator-Bericht fuehren zum Abbruch.

Reiner Contract-Test ohne Dienste:

```sh
node --test tools/system-tests/reports/test/*.test.js
```

Konkrete JSON-Artefakte lassen sich ueber das CLI zusammenfuehren. Der
Browserpfad darf als einziger Pfad den reservierten Wert `skipped` tragen:

```sh
node tools/system-tests/reports/merge-cli.js \
  --profile-file tools/system-tests/config/smoke.json \
  --k6 tools/system-tests/.runtime/reports/<lauf-id>/k6-summary.json \
  --devices tools/system-tests/.runtime/reports/<lauf-id>/devices.json \
  --browser tools/system-tests/.runtime/reports/<lauf-id>/browser.json \
  --chaos tools/system-tests/.runtime/reports/<lauf-id>/chaos.json \
  --integrity tools/system-tests/.runtime/reports/<lauf-id>/integrity.json
```

Die Ausgabe erfolgt ausschliesslich auf `stdout`. Eingabedaten und
JSON-Parserdetails werden bei Fehlern nicht ausgegeben.
