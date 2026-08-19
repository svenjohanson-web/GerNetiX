# Code-Abhaengigkeitsgraph der Browser-Skripte

Bildet ab, **welche Datei an welcher haengt** — bewusst getrennt vom fachlichen
Graphen in `tools/yaml-graph-sqlite`. Dort stehen Requirements, Entscheidungen
und Nachweise, also *warum* etwas existiert. Zwei Abstraktionsebenen, die sich
nicht vermischen sollen.

Eigene Datenbank: `tools/code-dependency-graph/out/code-graph.sqlite`
(nicht versioniert, jederzeit aus dem Quelltext neu zu erzeugen).

## Warum das noetig ist

Die 54 Dateien unter `services/identity-server/public/app` werden ohne
Modulsystem geladen: 26 `<script>`-Tags, kein `type="module"`. Es gibt keine
`import`-Anweisung, an der man eine Abhaengigkeit ablesen koennte. Sie entsteht
allein dadurch, dass eine Datei einen Namen benutzt, den eine andere auf
oberster Ebene deklariert — ueber den gemeinsamen globalen Namensraum.

Per Textsuche ist das nicht zu ermitteln. Ein erster Versuch mit regulaeren
Ausdruecken lieferte 177 Dateipaare; die sichtbarkeitskorrekte Auswertung
liefert 120. Die Differenz waren Fehltreffer: eine lokale Variable `status`
wurde als Verwendung des gleichnamigen Globals gezaehlt, und Deklarationen der
Form `window.X = ...` wurden gar nicht erkannt.

## Verwendung

```powershell
node tools\code-dependency-graph\build-code-graph.js build
node tools\code-dependency-graph\build-code-graph.js summary
node tools\code-dependency-graph\build-code-graph.js outgoing app-ide-controller.js
node tools\code-dependency-graph\build-code-graph.js incoming app-runtime-utils.js
node tools\code-dependency-graph\build-code-graph.js isolated
node tools\code-dependency-graph\build-code-graph.js order
node tools\code-dependency-graph\build-code-graph.js cycles
```

`acorn` wird nur zum Bauen gebraucht und aus
`services/identity-server/node_modules` geladen — es liegt dort bereits als
Abhaengigkeit von `terser`. Das Projekt bekommt dadurch keine zusaetzliche
Laufzeitabhaengigkeit.

## Was die Analyse leistet

Ausgewertet wird der Syntaxbaum mit echter Sichtbarkeitsaufloesung:

- `var` und Funktionsdeklarationen steigen zur Funktionsebene auf
- `let`, `const`, `class` gelten im Block
- Parameter, `catch`-Parameter und benannte Funktionsausdruecke sind gebunden
- Eigenschaftsnamen (`obj.foo`) sind keine Verweise
- `window.X = ...`, `globalThis.X = ...` und der UMD-Parameter, der
  `globalThis` hereinreicht, erzeugen Globale
- `typeof X === "undefined"` gilt als abgesicherter, weicher Verweis: ein
  blankes `typeof` wirft nicht, wenn der Name fehlt

## Stand

| | |
|---|---|
| Dateien | 54 |
| globale Namen | 497 |
| Kanten (Datei nutzt Bezeichner aus Datei) | 329 |
| Dateipaare mit Abhaengigkeit | 120 |
| gegenseitige Abhaengigkeiten | 14 |

`order` teilt die Dateien in Stufen: Stufe 1 sind die 13 Dateien, von denen
niemand abhaengt — sie lassen sich einzeln auf ES-Module umstellen, weil eine
Moduldatei weiterhin Globale lesen darf, ihre eigenen Namen aber fuer
klassische Skripte unsichtbar werden. Der Rest bildet einen wechselseitig
abhaengigen Kern um `app.js`, `app-runtime-utils.js` und
`app-shell-controller.js`. Dieser Kern laesst sich nicht Datei fuer Datei
bewegen; dort muessen zuerst die Zyklen aufgeloest werden.

## Verwandter Test

`services/identity-server/test/browser-global-references.test.js` nutzt
dieselbe Analyse und schlaegt fehl, sobald eine Browser-Datei einen Bezeichner
verwendet, den weder eine dieser Dateien deklariert noch der Browser
bereitstellt. Der erste Lauf fand damit vier echte Fehler in
`project-app-controller.js` und `project-app-renderer.js`.
