# Modellbasierte Entwicklung am Beispiel Tamagotchi

## Vision

Das Tamagotchi ist das zentrale Lernprojekt, um modellbasierte Softwareentwicklung zu vermitteln. Der Lernende beginnt nicht mit Quellcode, sondern mit einem fachlichen Modell, das Verhalten fuer Menschen lesbar macht.

Die erste Einsicht lautet: Quellcode ist fuer Einsteiger schwer zu verstehen. Ein Modell kann dasselbe Verhalten fachlicher, kuerzer und sichtbarer ausdruecken.

Das Modell ist runtime-unabhaengig. Aus demselben Modell koennen unterschiedliche Runtime-Apps erzeugt werden.

Fuer das Tamagotchi gibt es zwei uebergeordnete Runtime-Pfade:

- Browser App: laeuft auf Mac, PC und Mobile im Browser.
- Embedded: laeuft auf einem Board, zum Beispiel ESP32.

## Browser-Pfad als erster Lernpfad

Der Browser-Pfad startet nicht mit Technik, sondern mit einer Lernsequenz:

1. Code ist schwer verstaendlich.
2. Ein fachliches Modell beschreibt Verhalten verstaendlicher.
3. Das Modell ist unabhaengig von der Runtime.
4. Aus einem Modell lassen sich mehrere Runtime-Apps erzeugen.
5. Wir starten mit einer Browser App, weil sie sofort sichtbar und schnell ausfuehrbar ist.
6. Danach werden Vorteile und Nachteile der Browser App besprochen.
7. Spaeter folgen weitere Apps und Runtimes, zum Beispiel Embedded.

Die Browser App ist dadurch das erste Schaufenster fuer das Modell. Sie ist nicht das eigentliche Produktziel, sondern der schnellste Weg, Modellwirkung sichtbar zu machen.

## Vorteile der Browser App

- Startet schnell ohne Board, Flashen oder Installation.
- Laeuft auf Mac, PC und Mobile.
- Verhalten ist direkt sichtbar.
- Modellanpassungen koennen schnell ausprobiert werden.
- Gut geeignet, um fachliche Regeln, Zustaende und Aktionen zu erklaeren.

## Nachteile der ersten Browser App

Die erste Browser-App-Version darf bewusst einfach sein:

- Sie reagiert nur auf Benutzerinteraktionen.
- Sie aktualisiert sich noch nicht selbststaendig ueber Zeit.
- Sie speichert noch keinen Zustand.
- Wenn der Browser geschlossen wird, ist das Tamagotchi weg.

Dieser Nachteil ist didaktisch gewollt. Er bereitet die naechste Lektion vor.

## Naechste Lektion: State-Machine und Zeit

Nach der ersten Browser-App-Lektion wird der Unterschied zwischen Benutzerinteraktion und laufendem Systemverhalten eingefuehrt.

Die erste Version ist ereignisbasiert:

- Nutzer klickt auf Fuettern.
- Nutzer klickt auf Spielen.
- Nutzer klickt auf Schlafen.
- Der Zustand aendert sich direkt durch diese Aktion.

Die naechste Version fuehrt eine zeitgesteuerte State-Machine ein:

- Ein regelmaessiger Tick aktualisiert Hunger, Freude und Energie.
- Regeln pruefen danach den naechsten Zustand.
- Das Tamagotchi veraendert sich auch ohne direkte Benutzeraktion.
- Zustand und Modell koennen gespeichert und spaeter wieder geladen werden.

Damit wird sichtbar: Professionelle Software reagiert nicht nur auf Klicks, sondern modelliert laufendes Verhalten ueber Zeit.

## Weitere Runtime-Apps

Wenn der Lernende verstanden hat, dass das Modell die Quelle der Wahrheit ist, koennen weitere Runtime-Apps entstehen.

Der Embedded-Pfad nutzt dasselbe fachliche Modell, aber mit anderen technischen Randbedingungen:

- begrenzter Speicher
- echte Laufzeit auf Hardware
- Build, Flash und OTA
- lokale Persistenz auf dem Geraet
- Trennung zwischen Basissoftware und generierter Projektlogik

Der Lernende erkennt dadurch, dass dieselbe fachliche Beschreibung anders umgesetzt wird, wenn sie auf einem Board statt im Browser laeuft.

## Fachliches Modell

Das Modell beschreibt:

- Beduerfnisse
- Zustaende
- Regeln
- Zeitverhalten
- Prioritaeten
- Aktionen
- Reaktionen
- Persistenzstrategie

Der Lernende veraendert dieses Modell und beobachtet anschliessend, wie sich das Verhalten des Tamagotchis veraendert.

## Codegenerierung

Aus demselben fachlichen Modell wird runtime-spezifischer Code erzeugt:

- Browser App: TypeScript/JavaScript-Modul fuer eine schnell startbare Web-App.
- Embedded: C++-Komponente fuer die Firmware.

Die erzeugten Dateien liegen unter `generated/<runtime>/<projekt-id>/`. Sie duerfen die Basissoftware nicht veraendern.

## Architekturregel

Das fachliche Modell ist runtime-neutral. Runtime-spezifische Details gehoeren in Adapter, Generatoren oder Templates, nicht in das Modell.

Damit kann dieselbe fachliche Beschreibung zuerst schnell im Browser erlebt und spaeter auf weiteren Runtime-Apps ausgefuehrt werden.
