# Geführte Code-Lektion

Kleiner statischer Prototyp für zeilenbasiertes, geführtes Code-Editing.

## Start

`index.html` direkt im Browser öffnen.

Der Prototyp zeigt jetzt eine Verbindung von Projektidee zu konkreten Schritten:

- `projectIdeaId` verweist auf die Projektidee `project_idea.actuator_output_basics`.
- jeder sichtbare Schritt besitzt eine `flowItemId` als Platzhalter für `ProjectFlowItem`.
- `pattern` zeigt das didaktische Muster, z. B. Systemgrenze, Code-Walkthrough, Experiment oder Reflexion.
- `focusLines`, `editableLines` und `expectedContains` steuern das Step-Tool.

Der Prototyp enthält keine Build-, Flash-, Backend-, Datenbank- oder Persistenzfunktion.

## Profilabhängige Validierung

Der Step `knownBoardPinOrIntegerRange` nutzt zuerst das bekannte Board aus `learnerProfile.boardKey`.
Wenn für dieses Board ein Pin bekannt ist, muss exakt dieser Wert eingetragen sein, z. B. `ESP32 DevKit V1 -> LED_PIN = 2`.
Wenn kein bekanntes Board vorliegt, wird nur ein allgemeiner Zahlenbereich validiert.

## Projektideen-Auswahl

Oben im Tool kann eine Projektidee ausgewählt werden. Der Prototyp nutzt dafür einen internen Katalog in `app.js`, damit `index.html` weiterhin direkt per Browser ohne Server funktioniert.

Die Aktorik-Idee enthält eine echte geführte Code-Lektion. Die weiteren Projektideen sind als strukturierte Vorschau hinterlegt: links steht ein kompakter Projektideen-Ausschnitt, rechts wird Schritt für Schritt durch die didaktische Struktur geführt.

Ein Projekt kann auch direkt per Query-Parameter geöffnet werden, z. B. `index.html?project=temperature-data-logger`.

