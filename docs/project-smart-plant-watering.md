# Projektdefinition - Intelligente Pflanzenbewaesserungsstation

Dieses Dokument beschreibt die fachliche Projektspezifikation fuer eine intelligente Pflanzenbewaesserungsstation.
Es enthaelt keinen Quellcode, keine Schaltplaene und keine konkreten Implementierungsdetails.

## Einordnung

Das Projekt ist ein moegliches `LearningProject` der Learning Platform.
Es unterstuetzt insbesondere:

- BG-001: Bestehende Kunden kontinuierlich mit passenden neuen Lernangeboten begleiten.
- BG-002: Den Einstieg in Embedded-Entwicklung moeglichst einfach machen.
- BG-004: Vorhandene Hardware optimal nutzen und passende Projekte empfehlen.
- BG-005: Engineering-Wissen dauerhaft erhalten.
- CJ-002: Benutzer inventarisiert vorhandene Hardware.
- CJ-003: Benutzer beginnt ein Projekt.
- CJ-004: Benutzer kehrt spaeter zurueck.
- CJ-005: Benutzer besitzt Hardware, aber noch nicht alle Lernziele.
- CJ-006: Benutzer besitzt ein neues ProcessorBoard.

## 1. Projektvision

Die intelligente Pflanzenbewaesserungsstation ist ein praxisnahes Embedded-Projekt, das automatische Bewaesserung, Sensorik, Aktorik und spaeter Vernetzung miteinander verbindet.

Der Benutzer baut schrittweise ein System, das eine Pflanze automatisch mit Wasser versorgen kann.
Das Projekt beginnt bewusst einfach mit einer zeitgesteuerten Bewaesserung und fuehrt anschliessend zur sensorgestuetzten Regelung.

Der zentrale didaktische Kern ist der Unterschied zwischen Steuerung und Regelung:

- Steuerung: Das System handelt nach Zeit oder Plan, ohne Rueckmeldung ueber den realen Zustand.
- Regelung: Das System misst den Zustand und entscheidet anhand der Messwerte.

## 2. Kundennutzen

Der Benutzer erhaelt ein greifbares Projekt mit echtem Alltagsnutzen.
Die Pflanze wird nicht nur als Demo-Objekt verwendet, sondern als reale Umgebung, in der Fehler, Sensorrauschen, Wasserstand, Stromversorgung und Sicherheit eine Rolle spielen.

Nutzen:

- praxisnahes Embedded-Projekt mit sichtbarem Ergebnis
- klarer Einstieg in Sensoren und Aktoren
- verstaendlicher Vergleich von Steuerung und Regelung
- gute Erweiterbarkeit von Arduino bis ESP32
- Hardware kann kostenguenstig bleiben
- vorhandene Komponenten koennen wiederverwendet werden
- spaeterer Ausbau in Richtung WLAN, Webserver, OTA und Cloud moeglich

## 3. Zielgruppe

Primaere Zielgruppen:

- Maker
- Hobbyentwickler
- Schueler
- Studierende
- Embedded-Einsteiger

Sekundaere Zielgruppen:

- Lehrer
- Schulen
- Nutzer mit vorhandener Arduino- oder ESP32-Hardware
- fortgeschrittene Nutzer mit Interesse an IoT und Automatisierung

Die Zielgruppe steuert keine Berechtigungen und ist kein Metamodell-Artefakt.
Sie dient der fachlichen Einordnung, Produktplanung und Customer Journey.

## 4. Praxisbezug

Das Projekt loest ein reales Problem:

Eine Pflanze braucht regelmaessig Wasser, aber der richtige Zeitpunkt haengt von vielen Faktoren ab.

Ein reines Zeitprogramm kann funktionieren, ist aber ungenau.
Eine sensorgestuetzte Regelung kann besser auf reale Bedingungen reagieren.

Praxisnahe Einflussfaktoren:

- Pflanzenart
- Topfgroesse
- Erde
- Raumtemperatur
- Licht
- Verdunstung
- Sensorposition
- Wasserreservoir
- Pumpe oder Ventil
- Stromversorgung

Dadurch eignet sich das Projekt sehr gut, um technische Modelle mit realen Randbedingungen zu vergleichen.

## 5. Lernziele

Kernlernziele:

- Unterschied zwischen Steuerung und Regelung verstehen
- digitale Ein- und Ausgaenge verwenden
- Sensorwerte erfassen
- Aktoren ansteuern
- Relais, MOSFET, Ventil oder Pumpe fachlich einordnen
- Zeitsteuerungen modellieren
- Zustandsautomaten verwenden
- modularen Softwareaufbau verstehen
- Hardwareabstraktion verstehen
- Fehlerbehandlung planen
- Erweiterbarkeit beruecksichtigen

Optionale Lernziele:

- WLAN mit ESP32 nutzen
- lokalen Webserver fachlich einordnen
- OTA-Updates verstehen
- Cloud-Anbindung vorbereiten
- Benachrichtigungen planen
- Datenaufzeichnung und Statistiken verwenden
- Messwerte interpretieren
- Schwellenwerte und Hysterese verstehen

Moegliche Competencies:

- digitale Ausgaenge schalten
- digitale oder analoge Sensoren einlesen
- Bodenfeuchtigkeit messen
- Aktorik sicher ansteuern
- Steuerung von Regelung unterscheiden
- Messwerte bewerten
- einfache Regelentscheidungen treffen
- Zustandsautomat modellieren
- Fehlerfaelle erkennen
- System modular erweitern

## 6. Fachliche Grundlagen

Das Projekt vermittelt mehrere Grundlagen der Embedded-Entwicklung.

Zentrale Begriffe:

- Sensor: misst einen Zustand, z. B. Bodenfeuchtigkeit.
- Aktor: veraendert die Umwelt, z. B. Pumpe oder Ventil.
- Steuerung: fuehrt eine Aktion nach Plan aus.
- Regelung: nutzt Messwerte zur Entscheidung.
- Zustandsautomat: beschreibt, in welchem Zustand sich das System befindet.
- Schwellenwert: legt fest, ab welchem Messwert reagiert wird.
- Hysterese: verhindert staendiges Ein- und Ausschalten an einer Grenze.
- Fehlerzustand: beschreibt eine Situation, in der das System nicht sicher arbeiten kann.

Wichtige fachliche Einsichten:

- Ein Messwert ist nicht automatisch eine richtige Entscheidung.
- Sensoren koennen ungenau, falsch platziert oder defekt sein.
- Aktoren koennen ausfallen oder mechanisch blockieren.
- Wasser und Elektronik erfordern besondere Sorgfalt.
- Automatisierung braucht immer Sicherheitsgrenzen.

## 7. Unterschied zwischen Steuerung und Regelung

### Steuerung

Bei der Steuerung wird die Bewaesserung nach einem festen Ablauf ausgefuehrt.

Beispiel:

- alle 12 Stunden fuer 10 Sekunden bewaessern

Eigenschaften:

- einfach zu verstehen
- guenstig umsetzbar
- keine Sensoren notwendig
- keine Rueckmeldung vom Pflanzenzustand
- Risiko von Unter- oder Ueberbewaesserung

Geeignet fuer:

- Einstieg in digitale Ausgaenge
- Einstieg in Zeitsteuerung
- erste Aktoransteuerung
- Arduino-Grundlagen

### Regelung

Bei der Regelung misst ein Sensor den Zustand.
Das System entscheidet anhand der Messwerte, ob bewaessert werden muss.

Beispiel:

- Bodenfeuchtigkeit messen
- wenn Wert unter Schwelle liegt, bewaessern
- nach Bewaesserung erneut messen

Eigenschaften:

- reagiert auf reale Bedingungen
- vermittelt Sensorintegration
- benoetigt Messwertbewertung
- benoetigt Fehlerbehandlung
- ist fachlich naeher an echten Automatisierungssystemen

Geeignet fuer:

- Sensorintegration
- Regelkreis-Verstaendnis
- Zustandsautomaten
- Fehlerfaelle
- spaetere Datenaufzeichnung

## 8. Hardwarearchitektur

Das Projekt soll zwei Hardwarevarianten unterstuetzen.

### Variante A - Arduino

Fokus:

- Embedded-Grundlagen
- einfache Hardware
- geringe Kosten
- keine WLAN-Anbindung

Moeglicher Einsatz:

- Schulunterricht
- Einsteigerprojekt
- Grundlagen fuer digitale Ausgaenge und Sensorik
- Vergleich zwischen Steuerung und Regelung ohne Netzwerkkomplexitaet

Vorteile:

- guenstig
- einfach
- robuste Lernumgebung
- gute Trennung der Grundlagen

Nachteile:

- keine integrierte WLAN-Funktion
- begrenzter Ausbau in Richtung Webserver, OTA oder Cloud
- weniger geeignet fuer IoT-Folgeprojekte

### Variante B - ESP32

Fokus:

- WLAN
- Weboberflaeche
- OTA
- Cloud-Anbindung
- erweiterte Funktionen

Moeglicher Einsatz:

- fortgeschrittenes Lernprojekt
- IoT-Einstieg
- Datenaufzeichnung
- Fernueberwachung
- Folgeprojekt fuer Simple IDE und Device Management

Vorteile:

- integriertes WLAN
- leistungsfaehiger als einfache Arduino-Boards
- gute Basis fuer Webserver, OTA und Cloud
- geeignet fuer mehrere Ausbaustufen

Nachteile:

- hoeherer Einstieg
- mehr Konfigurationsaufwand
- WLAN und Sicherheit koennen vom Kernlernziel ablenken
- Stromversorgung und Stabilitaet muessen sorgfaeltiger betrachtet werden

## 9. Softwarearchitektur

Die Softwarearchitektur soll modular gedacht werden.
Die folgende Struktur beschreibt fachliche Bausteine, keine Implementierung.

Moegliche Module:

- Plant Model: beschreibt Pflanze, Schwellenwerte und Pflegeparameter.
- Sensor Layer: liest Bodenfeuchtigkeit und optionale Umweltdaten.
- Actuator Layer: steuert Pumpe, Ventil, Relais oder MOSFET.
- Control Mode: setzt eine zeitgesteuerte Bewaesserung um.
- Regulation Mode: entscheidet anhand von Sensorwerten.
- State Engine: verwaltet Zustaende wie idle, measuring, watering, waiting, error.
- Safety Layer: begrenzt Laufzeit, erkennt Fehler und verhindert Dauerbetrieb.
- Persistence Layer: speichert Einstellungen und letzte Zustaende.
- Connectivity Layer: behandelt WLAN, Webserver und Cloud optional.
- Notification Layer: meldet Fehler oder Status optional.
- Data Logging Layer: speichert Messwerte fuer Verlauf und Statistik optional.

Offline-Betrieb:

- zeitgesteuerte Bewaesserung
- sensorgestuetzte Bewaesserung
- lokale Einstellungen
- lokale Fehlerbehandlung

Online-Betrieb:

- WLAN-Konfiguration
- lokale Weboberflaeche
- OTA-Updates
- Cloud-Anbindung
- Benachrichtigungen
- Statistiken

## 10. Benoetigte Komponenten

Pflichtkomponenten fuer eine einfache Steuerung:

- Arduino oder ESP32
- Pumpe oder Ventil
- Treiberstufe, z. B. Relais oder MOSFET
- Stromversorgung
- Wasserreservoir
- Schlauch

Pflichtkomponenten fuer eine Regelung:

- Bodenfeuchtigkeitssensor
- Arduino oder ESP32
- Pumpe oder Ventil
- Treiberstufe
- Stromversorgung
- Wasserreservoir
- Schlauch

Optionale Komponenten:

- Wasserstandssensor
- Temperatur- oder Luftfeuchtigkeitssensor
- Display
- Status-LED
- Buzzer
- Taster
- Gehaeuse
- Batterie oder Akku

## 11. Moegliche Sensoren und Aktoren

Moegliche Sensoren:

- kapazitiver Bodenfeuchtigkeitssensor
- resistiver Bodenfeuchtigkeitssensor
- Wasserstandssensor
- Temperatur- und Luftfeuchtigkeitssensor
- Lichtsensor
- Durchflusssensor

Bewertung:

- Kapazitive Bodenfeuchtigkeitssensoren sind fuer Lernprojekte meist besser geeignet als einfache resistive Sensoren, weil sie weniger stark korrodieren.
- Resistive Sensoren sind guenstig, aber langfristig weniger robust.
- Ein Wasserstandssensor verbessert die Sicherheit, weil Trockenlauf erkannt werden kann.
- Ein Durchflusssensor ist fuer Version 1 vermutlich zu komplex, kann aber fuer fortgeschrittene Varianten interessant sein.

Moegliche Aktoren:

- kleine Wasserpumpe
- Magnetventil
- Relaismodul
- MOSFET-Treiber
- Status-LED
- Buzzer

Bewertung:

- Eine kleine Pumpe ist fuer Einsteiger anschaulich und flexibel.
- Ein Magnetventil benoetigt oft eine passendere Wasserquelle und kann hoeheren Strombedarf haben.
- Ein Relais ist didaktisch einfach, aber mechanisch und langsamer.
- Ein MOSFET ist technisch eleganter, erfordert aber mehr Verstaendnis fuer Treiberstufen.

## 12. Ausbaustufen

### Stufe 1 - Zeitgesteuerte Bewaesserung

Ziel:

- einfache Steuerung verstehen
- Aktor schalten
- Zeitlogik verwenden

Merkmale:

- keine Sensorwerte
- feste Bewaesserungsintervalle
- einfache Sicherheitsgrenze fuer maximale Laufzeit

### Stufe 2 - Manuelle Eingabe und Statusanzeige

Ziel:

- Benutzerinteraktion hinzufuegen
- Zustand sichtbar machen

Merkmale:

- Taster fuer manuelles Bewaessern
- LED oder Display fuer Status
- einfache Fehleranzeige

### Stufe 3 - Sensorgestuetzte Regelung

Ziel:

- Bodenfeuchtigkeit messen
- Regelentscheidung treffen
- Unterschied zur Steuerung praktisch erleben

Merkmale:

- Messwert erfassen
- Schwellenwert verwenden
- Bewaesserung anhand des Messwertes ausloesen
- Hysterese oder Wartezeit fachlich erklaeren

### Stufe 4 - Fehlerbehandlung und Sicherheit

Ziel:

- robuste Systeme verstehen
- typische Fehler erkennen

Merkmale:

- Trockenlauf vermeiden
- Sensorfehler erkennen
- maximale Pumpenlaufzeit begrenzen
- Fehlerzustand anzeigen

### Stufe 5 - ESP32 mit WLAN und Weboberflaeche

Ziel:

- IoT-Grundlagen einfuehren
- lokale Bedienung ueber Netzwerk vorbereiten

Merkmale:

- WLAN optional
- lokaler Webserver
- Anzeige von Feuchtigkeit und Status
- einfache Konfiguration

### Stufe 6 - OTA und Datenaufzeichnung

Ziel:

- Wartbarkeit und Verlauf verstehen

Merkmale:

- OTA-Updates
- Messwertverlauf
- einfache Statistiken
- Konfigurationsspeicherung

### Stufe 7 - Cloud und Benachrichtigungen

Ziel:

- vernetzte Systeme verstehen
- externe Dienste einordnen

Merkmale:

- Cloud-Anbindung optional
- Benachrichtigung bei leerem Tank oder Fehler
- langfristige Datenauswertung

## 13. Erweiterungsmoeglichkeiten

Funktionale Erweiterungen:

- mehrere Pflanzen
- Pflanzenprofile
- automatische Kalibrierung
- saisonale Anpassung
- Urlaubsmodus
- manuelle Sofortbewaesserung
- Wassersparmodus
- Fehlerhistorie

Hardware-Erweiterungen:

- Display
- Wasserstandssensor
- Durchflusssensor
- groesseres Reservoir
- Akku oder Solarbetrieb
- Gehaeuse
- mehrere Pumpen oder Ventile

Plattform-Erweiterungen:

- Hardware-Matching fuer Arduino- und ESP32-Varianten
- Folgeprojekte fuer IoT, OTA und Cloud
- Lernpfad "Automatisierung"
- Lernpfad "Sensorik und Regelung"
- Lernpfad "Smart Garden"

## 14. Risiken und typische Fehlerquellen

Fachliche Risiken:

- Benutzer verwechseln Steuerung und Regelung, wenn der Unterschied nicht klar inszeniert wird.
- Zu fruehe WLAN- oder Cloud-Funktionen koennen vom Kernlernziel ablenken.
- Zu viele Sensoren koennen Einsteiger ueberfordern.

Technische Risiken:

- Sensorwerte koennen stark schwanken.
- Sensoren koennen falsch positioniert sein.
- Resistive Sensoren koennen korrodieren.
- Pumpen koennen zu viel Strom ziehen.
- Relais oder MOSFET koennen falsch dimensioniert werden.
- Wasser kann Elektronik beschaedigen.
- Pumpe kann trockenlaufen.
- Schlauch kann undicht sein.
- WLAN kann instabil sein.
- OTA kann bei falscher Anwendung das Board in einen unbrauchbaren Zustand bringen.

Typische Fehlerquellen:

- gemeinsame Masseverbindung vergessen
- falsche Versorgungsspannung
- Aktor direkt am Mikrocontroller-Pin betrieben
- Sensorwerte ohne Kalibrierung interpretiert
- keine maximale Pumpenlaufzeit definiert
- kein Fehlerzustand vorgesehen
- keine Trennung zwischen Messung und Entscheidung

## 15. Offene Architekturentscheidungen

- Soll Variante A mit Arduino oder direkt mit ESP32 starten?
- Welches Board wird als Referenzhardware fuer Variante A verwendet?
- Welches ESP32-Board wird als Referenzhardware fuer Variante B verwendet?
- Wird fuer Version 1 eine Pumpe oder ein Ventil empfohlen?
- Wird ein Relais oder ein MOSFET als bevorzugte Treiberstufe verwendet?
- Welcher Bodenfeuchtigkeitssensor wird empfohlen?
- Soll Version 1 bereits einen Sensor enthalten oder zuerst nur zeitgesteuert arbeiten?
- Gibt es ein Display in Version 1 oder nur LED/Taster?
- Wie wird Sensor-Kalibrierung didaktisch eingefuehrt?
- Welche Sicherheitsregeln sind Pflicht?
- Wird OTA erst als Folgeprojekt behandelt?
- Wird Cloud-Anbindung als eigenes Folgeprojekt modelliert?
- Werden Arduino- und ESP32-Variante als zwei `ProjectVariant` desselben `LearningProject` modelliert?

## 16. Roadmap fuer eine schrittweise Umsetzung

### Phase 1 - Projektdefinition

Ziel:

- fachlichen Nutzen klaeren
- Steuerung und Regelung didaktisch trennen
- Zielgruppe bestimmen
- Referenzvarianten festlegen
- erste Competencies ableiten

Ergebnis:

- stabile Projektspezifikation
- offene Architekturentscheidungen sichtbar
- Grundlage fuer Requirements

### Phase 2 - Einfache Steuerung

Ziel:

- zeitgesteuerte Bewaesserung fachlich umsetzen
- digitale Ausgaenge und Aktorik vermitteln

Moeglicher Umfang:

- Intervall festlegen
- Pumpe oder Ventil zeitlich begrenzt aktivieren
- maximale Laufzeit als Sicherheitsregel definieren

### Phase 3 - Sensorintegration

Ziel:

- Bodenfeuchtigkeit messen
- Messwerte interpretieren
- Sensorgrenzen verstehen

Moeglicher Umfang:

- Sensor anschliessen
- Messwert sichtbar machen
- trockene und feuchte Erde vergleichen
- Kalibrierung fachlich einfuehren

### Phase 4 - Regelung

Ziel:

- geschlossenen Regelkreis verstehen
- Bewaesserung anhand des Messwertes entscheiden

Moeglicher Umfang:

- Schwellenwert definieren
- Hysterese oder Wartezeit einfuehren
- Zustand nach Bewaesserung erneut bewerten

### Phase 5 - Fehlerbehandlung

Ziel:

- robuste Automatisierung verstehen
- typische Fehlerfaelle abfangen

Moeglicher Umfang:

- Trockenlauf erkennen
- maximale Pumpenlaufzeit
- Sensorfehler
- Fehleranzeige

### Phase 6 - ESP32 und lokale Vernetzung

Ziel:

- WLAN und lokalen Webserver als Erweiterung einfuehren

Moeglicher Umfang:

- Messwerte lokal anzeigen
- Einstellungen lokal aendern
- Status ueber Weboberflaeche betrachten

### Phase 7 - OTA, Cloud und Benachrichtigungen

Ziel:

- Wartbarkeit und vernetzte Funktionen verstehen

Moeglicher Umfang:

- OTA als optionaler Baustein
- Datenaufzeichnung
- Benachrichtigung bei Fehlern
- Cloud-Anbindung als spaeteres Folgeprojekt

## Ergebnis

Die intelligente Pflanzenbewaesserungsstation ist ein starkes LearningProject, weil sie einen klaren Alltagsnutzen mit grundlegenden Embedded-Konzepten verbindet.

Die Arduino-Variante eignet sich fuer den Einstieg in Steuerung, Aktorik und Sensorik.
Die ESP32-Variante eignet sich fuer den Ausbau in Richtung IoT, Webserver, OTA und Cloud.

Der didaktische Kern bleibt der Vergleich zwischen offener Steuerung und geschlossenem Regelkreis.
Dadurch kann das Projekt schrittweise wachsen, ohne die fachliche Klarheit zu verlieren.
