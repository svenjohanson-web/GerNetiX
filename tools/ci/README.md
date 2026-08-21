# CI-Pruefungen

Die Test-CI ermittelt ihren Umfang selbst. Es gibt keine gepflegte Liste von
Services oder Testdateien in der Workflow-YAML: ein neuer Service unter
`services/` und eine neue `*.test.js` unter `tools/` laufen automatisch mit.

## Lokale Vorab-Pruefung

`verify.js` prueft lokal denselben Stand wie die CI, bevor committet oder
gepusht wird.

```shell
node tools/ci/verify.js --quick
```

| Aufruf | Umfang | Wofuer |
| --- | --- | --- |
| `--quick` | nur Repo-Pruefungen, keine Tests | vor jedem Commit |
| `--changed` | zusaetzlich die Services mit lokalen Aenderungen | waehrend der Arbeit |
| ohne Schalter | alles, wie die CI | vor dem Push |

Bei `--changed` loest eine Aenderung unter `services/shared/` einen vollen
Durchlauf aus, weil fast jeder Service davon abhaengt.

Die Pruefung ist rein statisch. Sie startet, stoppt und befragt keinen
laufenden Dienst. Die Laufzeitsicht (Prozesse, Health, VPN/Tunnel,
Runtime-Alerts, Security-Readiness) gehoert dem Prozess-Monitor unter
`tools/process-monitor` und wird hier bewusst nicht dupliziert.

Drei E2E-Jobs der CI brauchen Linux-Container und laufen lokal nicht mit.
`verify.js` weist sie am Ende jedes Laufs aus, damit die Pruefung keine
Vollstaendigkeit vortaeuscht, die sie nicht hat.

## Bausteine

| Datei | Aufgabe |
| --- | --- |
| `service-test-matrix.js` | findet alle Services unter `services/` und erzeugt die Actions-Matrix |
| `run-tools-tests.js` | sammelt `tools/**/*.test.js` per Glob |
| `check-javascript-syntax.js` | prueft jede getrackte JS-Datei, CommonJS wie ES-Modul |
| `check-compose.js` | validiert die Compose-Modelle |
| `check-graph-baseline.js` | vergleicht den kanonischen Graphen mit `graph-baseline.json` |
| `check-file-sizes.js` | Sperrklinke: grosse JS-Dateien duerfen nicht wachsen |
| `check-committed-secrets.js` | sucht eingecheckte .env-Dateien und private Schluessel |
| `ci-test-policy.json` | Ausnahmen, jede mit Begruendung |

`service-test-matrix.js` bricht ab, wenn einem Service `package-lock.json`,
`test` oder `check` fehlt. Ein unvollstaendiger Service faellt dadurch auf,
statt still aus der Matrix zu fallen.

## Ausnahmen

Ausnahmen stehen in `ci-test-policy.json` und brauchen eine Begruendung. Die
Liste ist zum Schrumpfen gedacht, nicht zum Wachsen.

Plattformbedingte Faelle gehoeren nicht dorthin, sondern in den Test selbst:

```js
const posixOnly = process.platform === "win32" ? "Braucht eine POSIX-Shell." : false;
test("...", { skip: posixOnly }, () => { /* ... */ });
```

So bleibt der Rest der Datei ueberall pruefbar, statt sie ganz auszuschliessen.
Der Workspace wird auf Windows, macOS und Linux verwendet.

## Waechter mit Freigabeweg

Zwei Pruefungen schlagen bei jeder Aenderung an, weil sie einen Review-Punkt
erzwingen sollen:

```shell
npm run routes:accept --prefix tools/internal-api-route-guard
node tools/ci/check-graph-baseline.js --accept
node tools/ci/check-file-sizes.js --accept
```

Alle erst nach fachlicher Pruefung ausfuehren. Beim Routen-Guard heisst das:
neue Route im Inventar einordnen, Zugriffsklasse kontrollieren, Negativtest
ergaenzen. Nicht ausfuehren, nur um die CI gruen zu bekommen.

## Groessen-Sperrklinke

`file-size-baseline.json` haelt fest, wie gross jede JS-Datei ueber 40 KB
zuletzt war. Wachsen darf keine, schrumpfen jederzeit; eine neue Datei ueber der
Grenze schlaegt an. Gemessen wird mit normalisierten Zeilenenden, damit Windows
und Linux dieselbe Zahl sehen.

Testdateien sind ausgenommen, denn mehr Abdeckung ist erwuenscht. Schlaegt die
Klinke an, gehoert die neue Logik in eine eigene Datei -- siehe die bereits
herausgeloesten Modelle unter `services/identity-server/public/app/`.

Nach einem Schnitt die Baseline nachziehen, sonst bleibt der alte, groessere
Wert stehen und die Datei duerfte wieder wachsen.
