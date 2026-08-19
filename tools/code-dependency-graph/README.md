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
| Dateien | 63 |
| globale Namen | 613 |
| Kanten (Datei nutzt Bezeichner aus Datei) | 359 |
| Dateipaare mit Abhaengigkeit | 146 |
| gegenseitige Abhaengigkeiten | 14 |

`order` teilt die Dateien in Stufen. Stufe 1 sind die Dateien, von denen
niemand abhaengt — nur sie lassen sich einzeln auf ES-Module umstellen, weil
eine Moduldatei weiterhin Globale lesen darf, ihre eigenen Namen aber fuer
klassische Skripte unsichtbar werden. Der Rest bildet einen wechselseitig
abhaengigen Kern um `app.js`, `app-runtime-utils.js` und
`app-shell-controller.js`. Dieser Kern laesst sich nicht Datei fuer Datei
bewegen; dort muessen zuerst die Zyklen aufgeloest werden.

## Zwei Korrekturen, die das Ergebnis umgedreht haben

Eine fruehere Fassung meldete 13 abhaengigkeitsfreie Dateien. Acht davon waren
es nicht:

- **`window.X` wurde als Eigenschaftszugriff gewertet.** Damit blieb
  unsichtbar, dass drei Dateien ueber `window.GerNetiXFlashDialog` am
  Flash-Dialog haengen. Solche Zugriffe zaehlen jetzt als Verweis.
- **Der Schutz durch `typeof` galt fuer die ganze Datei.** Ein
  `typeof GerNetiXHardwareLab === "undefined"` in Zeile 238 liess vier
  ungeschuetzte Aufrufe weiter unten verschwinden. Er gilt jetzt nur im
  selben bedingten Ausdruck, also genau dort, wo er wirkt.

Waeren die acht Dateien auf dieser Grundlage umgestellt worden, haetten
Flash-Dialog, Hardware-Labor und Aktionsprotokoll aufgehoert zu arbeiten.

Ausserdem muss vor jeder Umstellung die **Ladeart** geprueft werden: ein
Modul wird immer verzoegert ausgefuehrt. `app/initial-view-router.js` wird
bewusst synchron geladen, damit es vor dem ersten Zeichnen laeuft, und darf
deshalb kein Modul werden.

## Bereits umgestellt

`session-state.js`, `ai-chat-pattern.js` und `app-event-bindings.js` werden
mit `type="module"` geladen. Alle drei deklarieren nichts, was andere Skripte
brauchen. `flashbox-einrichten/app.js` war schon vorher ein Modul.

## Verwandter Test

`services/identity-server/test/browser-global-references.test.js` nutzt
dieselbe Analyse und schlaegt fehl, sobald eine Browser-Datei einen Bezeichner
verwendet, den weder eine dieser Dateien deklariert noch der Browser
bereitstellt. Der erste Lauf fand damit vier echte Fehler in
`project-app-controller.js` und `project-app-renderer.js`.
