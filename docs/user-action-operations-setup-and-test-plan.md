# Nutzeraktions-Operations: Einrichtungs- und Testplan

## Ziel und Abgrenzung

Dieser Plan nimmt die lokal implementierte Nutzeraktions-Observability und die
synthetischen Kernablauf-Vorpruefungen kontrolliert in Betrieb. Die vier
synthetischen Pruefungen sind absichtlich read-only. Sie erzeugen weder Konten
noch Projekte, Build-Jobs oder Flash-Auftraege und ersetzen keine spaetere
authentifizierte Browser-/Board-Abnahme.

## 1. Erforderliche Konfiguration

Das Admin Tool benoetigt die bereits vorhandenen internen Service-URLs sowie:

| Variable | Zweck |
|---|---|
| `OPERATIONS_POSTGRES_*` oder `OPERATIONS_POSTGRES_URL` | Fuehrende Operations-Persistenz |
| `ADMIN_TOOL_BASE_URL` | Scheduler-Ziel, intern normalerweise Port 4600 |
| `INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON` | Oeffentlicher Trust Ring fuer die Verifikation interner Tokens |
| `INTERNAL_API_SIGNING_KEY_ID` / `INTERNAL_API_SIGNING_PRIVATE_KEY_B64` | Eigene Ed25519-Dienstidentitaet des Admin Tools; der private Key bleibt nur bei diesem Dienst |
| `IDENTITY_BASE_URL` | Login-HTML-Pruefung |
| `PROJECT_SERVER_BASE_URL` | Project-Server-Pruefung |
| `BUILD_DEPLOY_BASE_URL` | Build-Koordinationspruefung |
| `PUBLIC_DEMO_BASE_URL` | Oeffentlicher Flash-Katalog, intern normalerweise Port 4920 |
| `SYNTHETIC_CHECK_TIMEOUT_MS` | Optional, Standard 1500 ms je Ziel |

Tokens werden nur als Secret injiziert. Sie gehoeren nicht in Git, Logs,
Scheduler-Ausgaben oder Admin-Pruefergebnisse.

## 2. Lokaler Nachweis

1. Bestehende Prozesse zuerst ueber ihre `/health`-Endpunkte pruefen; keine
   vorsorglichen Neustarts.
2. Gezielt die Admin-Tests ausfuehren:

   ```text
   cd services/admin-tool
   node --test
   ```

3. Admin Tool ausschliesslich ueber den Admin Access Server oeffnen.
4. Unter **Betrieb -> Synthetische Kernablaeufe** `Jetzt pruefen` ausloesen.
5. Erwartung: genau vier Ergebnisse; jedes Ergebnis enthaelt nur Pruef-ID,
   Zieldienst, feste Route, Status, HTTP-Code, Dauer und Reason-Code.
6. Scheduler-Vertrag separat pruefen:

   ```text
   node services/admin-tool/scripts/run-synthetic-checks.js
   ```

   Exitcode `0` bedeutet kein fehlgeschlagenes Ziel, `2` mindestens einen
   fachlich fehlgeschlagenen Check und `1` einen Scheduler-/Zugriffsfehler.

## 3. Negative lokale Tests

| Fall | Erwartung |
|---|---|
| Token fehlt oder ist falsch | interner Start antwortet `403` |
| Ziel nicht konfiguriert | Ergebnis `skipped/not_configured` |
| Ziel nicht erreichbar | `failed/network_unreachable` |
| Zeitbudget ueberschritten | `failed/timeout` |
| HTTP ungleich 2xx | `failed/unexpected_status` |
| falscher Content-Type beim Login | `failed/unexpected_content_type` |
| falscher JSON-Vertrag | `failed/invalid_response` |
| Admin-Neustart nach Lauf | Ergebnisse bleiben in PostgreSQL sichtbar |

Antwortkoerper, Redirect-Ziele, Cookies, Credentials und freie Fehlermeldungen
duerfen in keinem gespeicherten Ergebnis vorkommen.

## 4. Staging-Einrichtung

Ein Staging-Schritt erfolgt nur nach ausdruecklichem Auftrag.

1. `docs/codex-staging-deployment.md` lesen.
2. `node tools/staging-deploy.js --plan` ausfuehren und Modus, Dienste und
   Grund bestaetigen.
3. Sicherstellen, dass alle oben genannten URLs im internen Docker-Netz, der
   oeffentliche Trust Ring und der eigene private Admin-Tool-Key gesetzt sind.
4. Den bereits gepushten, sauberen Stand genau einmal mit
   `node tools/staging-deploy.js` ausrollen.
5. Admin- und Access-Health sowie die vier Ziel-Health-/Read-only-Pfade pruefen.
6. Einen manuellen Lauf ueber die geschuetzte Admin-Konsole starten.
7. PostgreSQL-Nachweis: vier Zeilen mit gleicher `run_id` in
   `operations_synthetic_check_results`, keine fachlichen Mutationen in
   Account-, Projekt-, Build- oder Device-Tabellen.
8. Einen kontrollierten Fehlfall je Reason-Code-Klasse in einem
   Wartungsfenster ausloesen und danach die Originalkonfiguration
   wiederherstellen.
9. Admin Tool neu starten und die persistierte Historie erneut lesen.

## 5. Periodischer Staging-Betrieb

Nach erfolgreicher manueller Abnahme wird der Scheduler ausserhalb des Admin
Tools alle fuenf Minuten gestartet. Der Scheduler stellt nur einen
kurzlebigen Token mit `operations.synthetic_checks.run` aus, besitzt keinen Admin-Login und keinen direkten
PostgreSQL-Zugang. Gleichzeitige Laeufe werden zunaechst organisatorisch durch
die Scheduler-Konfiguration verhindert.

Vier Wochen lang bleiben Auswertung und Nutzeraktions-Alarme im
Beobachtungsmodus. Erfasst werden Verfuegbarkeit, Antwortzeitverteilung,
Fehlergruende und Wiederherstellungszeit. Erst danach werden Zeitbudgets und
Schwellwerte abgenommen.

## 6. Authentifizierte End-to-End-Abnahme

Die read-only Vorpruefungen gelten nicht als Ersatz fuer diese spaetere
Abnahme:

1. Passkey-Testkonto meldet sich im Browser an; dieselbe Action-ID erscheint
   bis zur Sitzung.
2. Ein isoliertes Testprojekt speichert eine Einstellung und weist die neue
   Project-Revision nach.
3. Ein kleiner deterministischer Test-Build wird eingereiht, ausgefuehrt und
   mit Artefakt-Hash abgeschlossen.
4. Flash wird zunaechst nur bis Manifest- und Board-Kompatibilitaetspruefung
   synthetisch getestet; der echte Schreibvorgang erfolgt ausschliesslich in
   einer angekuendigten Hardware-Abnahme.
5. Fehler-, Timeout- und fehlender-Handler-Faelle erscheinen mit derselben
   Action-ID im Admin Explorer.

## 7. Produktionsfreigabe

Produktiv werden die Checks zuerst ohne externen Alarmversand aktiviert.
Freigabekriterien:

- vier Wochen belastbare Staging-Baseline,
- dokumentierte Owner und Runbooks je Check,
- getesteter Ausfall und Recovery,
- getestete PostgreSQL-Sicherung und Wiederherstellung,
- festgelegte Retention fuer Synthetic-, Action- und Interface-Historie,
- abgenommene Deduplizierung und Cooldowns,
- ausdrueckliche Freigabe fuer E-Mail-/Push-Zustellung.

Rollback bedeutet: Scheduler deaktivieren und Alarmversand ausgeschaltet
lassen. Bereits persistierte Pruefhistorie wird nicht geloescht.
