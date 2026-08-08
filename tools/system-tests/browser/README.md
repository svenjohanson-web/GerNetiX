# GerNetiX Browser-Systemtests

Dieser kleine Playwright-Strang prüft mit genau einem Browserkontext:

1. Eine geschützte App-Route führt ohne Sitzung sichtbar zur Anmeldung.
2. Eine vorbereitete, isolierte Testsitzung öffnet Projektliste und Projektdetail.
3. Ein simulierter Ausfall der Auth-Persistenz erscheint als verständliche Meldung in der Oberfläche.

k6 erzeugt die hohe Last. Die Browser-Suite bleibt bewusst bei wenigen Workern und prüft nur die reale Benutzerperspektive.

## Sicherheitsgrenzen

- Erlaubt sind ausschließlich `localhost`, `127.0.0.1` und `::1`.
- Die Sitzung kommt nur aus Umgebungsvariablen und wird nicht in Dateien geschrieben.
- Ziel-URLs dürfen keine eingebetteten Zugangsdaten enthalten.
- Screenshots, Videos und Playwright-Traces sind standardmäßig deaktiviert, damit keine Sitzung oder personenbezogenen Inhalte in Artefakten landen.
- Der Test erzeugt und löscht keine Accounts und verändert keine persistierten Projektdaten.

## Contract-Tests

Die Contract-Tests benötigen weder Browser-Binary noch laufenden Server:

```sh
npm test
```

## Browserlauf

Voraussetzungen sind eine isolierte lokale GerNetiX-Umgebung, ein darin vorbereiteter Testaccount mit mindestens einem sichtbaren Lernprojekt und ein gültiges Session-Cookie:

```sh
GERNETIX_BROWSER_BASE_URL=http://127.0.0.1:4300 \
GERNETIX_BROWSER_SESSION_COOKIE_NAME=gernetix_session \
GERNETIX_BROWSER_SESSION_COOKIE_VALUE='<nur-aus-testumgebung>' \
npm run test:browser
```

Optional kann `GERNETIX_BROWSER_TIMEOUT_MS` gesetzt werden. `GERNETIX_BROWSER_WORKERS` ist auf 1 bis 4 begrenzt; der erste Referenzablauf verlangt bewusst den Wert `1`.

Der Lauf gibt ausschließlich Ziel-Origin, Szenarionamen und Erfolg aus. Das Session-Cookie wird weder protokolliert noch in Berichte geschrieben.
