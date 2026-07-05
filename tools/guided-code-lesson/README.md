# Gef?hrte Code-Lektion

Kleiner statischer Prototyp f?r zeilenbasiertes, gef?hrtes Code-Editing.

## Start

`index.html` direkt im Browser ?ffnen.

Der Prototyp zeigt jetzt eine Verbindung von Projektidee zu konkreten Schritten:

- `projectIdeaId` verweist auf die Projektidee `project_idea.actuator_output_basics`.
- jeder sichtbare Schritt besitzt eine `flowItemId` als Platzhalter f?r `ProjectFlowItem`.
- `pattern` zeigt das didaktische Muster, z. B. Systemgrenze, Code-Walkthrough, Experiment oder Reflexion.
- `focusLines`, `editableLines` und `expectedContains` steuern das Step-Tool.

Der Prototyp enth?lt keine Build-, Flash-, Backend-, Datenbank- oder Persistenzfunktion.

## Profilabh?ngige Validierung

Der Step `knownBoardPinOrIntegerRange` nutzt zuerst das bekannte Board aus `learnerProfile.boardKey`.
Wenn f?r dieses Board ein Pin bekannt ist, muss exakt dieser Wert eingetragen sein, z. B. `ESP32 DevKit V1 -> LED_PIN = 2`.
Wenn kein bekanntes Board vorliegt, wird nur ein allgemeiner Zahlenbereich validiert.

## Projektideen-Auswahl

Oben im Tool kann eine Projektidee ausgew?hlt werden. Der Prototyp nutzt daf?r einen internen Katalog in `app.js`, damit `index.html` weiterhin direkt per Browser ohne Server funktioniert.

Die Aktorik-Idee enth?lt eine echte gef?hrte Code-Lektion. Die weiteren Projektideen sind als strukturierte Vorschau hinterlegt: links steht ein kompakter Projektideen-Ausschnitt, rechts wird Schritt f?r Schritt durch die didaktische Struktur gef?hrt.

Ein Projekt kann auch direkt per Query-Parameter ge?ffnet werden, z. B. `index.html?project=temperature-data-logger`.


## Tamagotchi-Modellansicht

Die Tamagotchi-Lektion zeigt links bewusst kein Quellcode-Listing, sondern ein fachliches Verhaltensmodell. Der Lernpfad erklaert zuerst, warum Code fuer Einsteiger schwer lesbar ist, fuehrt dann das Modell als Quelle der Wahrheit ein und leitet daraus die erste Browser-App sowie spaetere Runtime-Apps ab.

Das zugrunde liegende Anzeige-Modell liegt unter:

```text
model/tamagotchi/step-by-step-view.yaml
```
