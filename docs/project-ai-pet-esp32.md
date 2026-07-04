# Projektdefinition - KI-Haustier fuer ESP32

Dieses Dokument beschreibt die fachliche Projektdefinition fuer ein KI-gestuetztes Haustier auf Basis eines ESP32 mit Display.
Es enthaelt noch keine Implementierungsdetails und keinen Quelltext.

## Einordnung

Das Projekt ist ein moegliches `LearningProject` der Learning Platform.
Es unterstuetzt insbesondere:

- BG-001: Bestehende Kunden kontinuierlich mit passenden neuen Lernangeboten begleiten.
- BG-002: Den Einstieg in Embedded-Entwicklung moeglichst einfach machen.
- BG-003: Die Einstiegshuerde durch eine einfache IDE reduzieren.
- BG-005: Engineering-Wissen dauerhaft erhalten.
- CJ-003: Benutzer beginnt ein Projekt.
- CJ-004: Benutzer kehrt spaeter zurueck.
- CJ-006: Benutzer besitzt ein neues ProcessorBoard.

## 1. Projektvision

Das KI-Haustier ist ein modernes Embedded-Lernprojekt, das den Charme eines klassischen Tamagotchi mit aktueller Mikrocontroller-, Display- und optionaler KI-Technologie verbindet.

Der Benutzer baut ein virtuelles Haustier, das auf einem Display lebt, sichtbare Zustaende besitzt, auf einfache Eingaben reagiert und spaeter optional mit natuerlicher Sprache interagieren kann.

Das Projekt soll spielerisch wirken, aber echte Embedded-Kompetenzen vermitteln.
Es soll bewusst modular aufgebaut sein, damit spaetere Erweiterungen moeglich bleiben.

## 2. Kundennutzen

Der Benutzer erhaelt ein motivierendes Projekt, das nicht nur eine technische Funktion demonstriert, sondern ein kleines Produkt mit Charakter entstehen laesst.

Nutzen:

- niedrigschwelliger Einstieg in ESP32-Projekte mit Display
- sichtbares, emotionales Ergebnis
- Motivation durch Interaktion und Fortschritt
- wiederverwendbare Grundlagen fuer weitere Display-, Sensor- und IoT-Projekte
- optionaler Einstieg in KI-gestuetzte Interaktion
- Projekt mit Erweiterungspotenzial statt einmaliger Demo

## 3. Zielgruppe

Primaere Zielgruppen:

- Maker
- Hobbyentwickler
- Schueler
- Studierende
- Einsteiger in Embedded-Entwicklung

Sekundaere Zielgruppen:

- Lehrer
- Schulen
- Content-Ersteller fuer Lernangebote
- fortgeschrittene Nutzer, die KI und Embedded kombinieren moechten

Die Zielgruppe steuert keine Berechtigungen und ist kein Metamodell-Artefakt.
Sie dient ausschliesslich der Produkt-, Journey- und Marketing-Einordnung.

## 4. Lernziele

Moegliche Learning Goals:

- Embedded Grundlagen
- IoT Grundlagen
- Embedded Fortgeschrittene

Moegliche Competencies:

- ESP32-Projekt aufsetzen
- Display ansteuern
- einfache UI-Zustaende darstellen
- Eingaben auswerten
- Zustandsautomaten verstehen und anwenden
- persistente Zustandsdaten speichern
- einfache Zeit- und Ereignislogik modellieren
- WLAN-Grundlagen verstehen
- optionale Online-Kommunikation vorbereiten
- Unterschiede zwischen Offline- und Online-Funktionalitaet verstehen
- technische Erweiterungen modular planen

## 5. Motivation des Benutzers

Das Projekt soll durch emotionale Bindung und sichtbaren Fortschritt motivieren.
Der Benutzer baut nicht nur eine Schaltung, sondern ein kleines digitales Wesen.

Motivationsfaktoren:

- das Haustier reagiert sichtbar auf den Benutzer
- Zustaende veraendern sich ueber Zeit
- kleine Animationen oder Gesichtsausdruecke erzeugen Persoenlichkeit
- Fortschritt ist direkt auf dem Display sichtbar
- optionale Erweiterungen schaffen Neugier auf weitere Projekte
- KI-Funktionen wirken als spaeterer Hoehepunkt, nicht als Einstiegshuerde

## 6. Moegliche technische Architektur

Die Architektur soll modular gedacht werden.
Die folgende Struktur beschreibt nur fachliche Bausteine, keine Implementierung.

Moegliche Module:

- Pet Core: verwaltet Zustand, Beduerfnisse und Persoenlichkeit.
- State Engine: modelliert Zustaende wie gluecklich, hungrig, muede oder neugierig.
- Display Layer: zeigt Figur, Status, Animationen und einfache Meldungen.
- Input Layer: verarbeitet Buttons, Touch, Encoder oder andere Eingaben.
- Persistence Layer: speichert Haustierzustand lokal.
- Time/Event Layer: steuert Veraenderungen ueber Zeit.
- Connectivity Layer: behandelt WLAN und Online-Verbindung optional.
- AI Adapter: kapselt optionale OpenAI-Interaktion.
- Extension Layer: ermoeglicht spaetere Sensoren, Minispiele oder neue Verhaltensweisen.

Offline-Betrieb:

- Haustier funktioniert ohne Internet.
- Basiszustaende und Interaktionen laufen lokal.
- Display, Eingaben, Speicher und einfache Zustandslogik reichen fuer ein vollstaendiges Lernerlebnis.

Online-Betrieb:

- WLAN kann optional aktiviert werden.
- OpenAI kann spaeter fuer natuerliche Sprache, Persoenlichkeitsdialoge oder erklaerende Antworten verwendet werden.
- Online-Funktionen duerfen das Basisprojekt nicht blockieren.

## 6.1 Varianten: Offline und KI-Online

### Variante A - Offline-Haustier

Die Offline-Variante ist die empfohlene Basis fuer Version 1.
Das Haustier laeuft vollstaendig lokal auf dem ESP32.

Vorteile:

- funktioniert ohne Internetverbindung
- keine laufenden KI- oder Cloud-Kosten
- geringere Einstiegshuerde
- einfacher Datenschutz
- gut geeignet fuer Schulen, Workshops und Einsteiger

Nachteile:

- keine natuerlichsprachlichen KI-Dialoge
- Verhalten und Antworten sind auf lokal modellierte Logik begrenzt
- weniger dynamische Persoenlichkeit als bei Online-KI

### Variante B - KI-Online-Haustier

Die KI-Online-Variante ist eine optionale Erweiterung oder ein spaeteres Folgeprojekt.
Sie nutzt WLAN und optional OpenAI, um natuerlichere Dialoge und eine dynamischere Persoenlichkeit zu ermoeglichen.

Vorteile:

- natuerlichere und abwechslungsreichere Dialoge
- dynamischere Persoenlichkeit
- vermittelt Online-/Offline-Architektur, API-Nutzung und KI-Kostenkontrolle
- eignet sich als hoeherwertige Projektvariante

Nachteile:

- benoetigt eine stabile Online-Verbindung
- verursacht laufende KI-Kosten pro Nutzung
- braucht Credits, Budgetlimits und Usage Monitoring
- Datenschutz, Account-Kontext und Missbrauchsschutz muessen betrachtet werden
- hoehere Komplexitaet fuer Einsteiger

Regel:

- Version 1 muss offline sinnvoll funktionieren.
- KI-Online darf die Offline-Basis nicht blockieren.
- KI-Online muss `BR-006` Schutz vor unkontrollierten KI-Kosten und `nfr.ai_cost_protection_auditability` beruecksichtigen.

## 7. Benoetigte Hardware

Pflicht-Hardware:

- ESP32 oder kompatibles ProcessorBoard
- kleines Display, z. B. OLED oder TFT
- Stromversorgung ueber USB
- mindestens eine Eingabemoeglichkeit, z. B. Button

Optionale Hardware:

- mehrere Buttons
- Touch Display
- Buzzer
- RGB LED
- Akku oder Batterieversorgung
- Gehaeuse
- Temperatur- oder Lichtsensor
- Mikrofon
- Lautsprecher

Technische Constraints fuer eine erste Variante:

- mandatory: ESP32-kompatibles Board
- mandatory: Display
- mandatory: einfache Eingabe
- mandatory fuer KI-Online: WLAN
- optional: Buzzer oder LED fuer Feedback
- optional: Akku fuer mobilen Betrieb
- optional: Mikrofon und Lautsprecher fuer spaetere Sprachinteraktion

## 8. Benoetigte Software

Benutzerseitig benoetigte Software:

- Simple IDE oder alternative Embedded-Entwicklungsumgebung
- Firmware-Upload per USB
- optional WLAN-Konfiguration
- optional Zugang zu OpenAI-Funktionen

Projektseitig benoetigte Software-Bausteine:

- Display-Ansteuerung
- Eingabe-Verarbeitung
- Zustandsmodell
- lokaler Speicher fuer Haustierzustand
- Zeit- und Ereignislogik
- einfache Asset- oder Animationsverwaltung
- optional Netzwerkkommunikation
- optional OpenAI-Adapter

Plattformseitig relevante Bausteine:

- LearningProject
- ProjectVariant
- TechnicalConstraint
- TechnicalCapability
- Condition
- AccountProjectProgress
- AccountCompetencyProgress
- RegisteredProcessorBoard, falls Board-Pairing verwendet wird

## 9. Moegliche Erweiterungen

Funktionale Erweiterungen:

- Persoenlichkeitsprofile
- mehrere Haustierarten
- Minispiele
- Tagesrhythmus
- Stimmungssystem
- Futter, Pflege und Training
- Level- oder Entwicklungsstufen
- einfache Dialoge ohne Internet
- natuerliche Sprache mit OpenAI
- Erinnerungen oder Events
- mehrere Haustiere

Hardware-Erweiterungen:

- Touch Display
- Gehaeuse
- Akku
- Sensoren
- Lautsprecher
- Mikrofon
- RGB Feedback

Plattform-Erweiterungen:

- Projektvarianten fuer unterschiedliche Displays
- Erweiterungspakete als Folgeprojekte
- Hardware-Matching fuer vorhandene Boards und Displays
- neue Lernangebote fuer KI, IoT oder UI-Programmierung

## 10. Risiken

Fachliche Risiken:

- Projekt koennte zu spielerisch wirken und Lernziele ueberdecken.
- Zu viele Funktionen koennten Einsteiger ueberfordern.
- KI-Funktionalitaet koennte falsche Erwartung erzeugen, wenn sie nicht klar optional ist.

Technische Risiken:

- Display-Bibliotheken unterscheiden sich je nach Hardware.
- Speicher und Performance auf kleinen Boards koennen begrenzt sein.
- WLAN-Konfiguration kann fuer Einsteiger schwierig sein.
- OpenAI-Nutzung benoetigt Internet, Account, Kostenkontrolle und Datenschutzbetrachtung.
- Offline- und Online-Modus muessen fachlich klar getrennt bleiben.

Produkt-Risiken:

- Zu teure Hardware wuerde die Einstiegshuerde erhoehen.
- Zu viele Varianten koennten Dokumentation und Support erschweren.
- Ohne klare Roadmap koennte das Projekt zu gross fuer ein erstes Lernprojekt werden.

## 11. Offene Entscheidungen

- Welche Zielgruppe wird zuerst adressiert: Maker, Schueler, Studierende oder Embedded-Einsteiger?
- Welches konkrete ESP32-Board wird als Referenzhardware verwendet?
- Welches Display wird fuer Version 1 empfohlen?
- Welche Eingabeform ist fuer Version 1 ausreichend?
- Soll Version 1 nur offline funktionieren?
- Ab welcher Ausbaustufe wird OpenAI eingebunden?
- Soll das Haustier eine feste Figur oder auswaehlbare Haustierarten besitzen?
- Welche Zustaende gehoeren in Version 1?
- Wie stark soll der Spielcharakter gegenueber den Lernzielen gewichtet werden?
- Wird Board-Pairing fuer dieses Projekt vorausgesetzt oder erst spaeter eingefuehrt?
- Soll es mehrere ProjectVariants geben oder zuerst nur eine ESP32-Display-Variante?

## 12. Roadmap fuer eine schrittweise Umsetzung

### Phase 1 - Projektdefinition

Ziel:

- fachlichen Nutzen klaeren
- Zielgruppe bestimmen
- Lernziele und Competencies ableiten
- Referenzhardware festlegen
- Offline-Basisumfang definieren

Ergebnis:

- stabile Projektspezifikation
- offene Entscheidungen reduziert
- Grundlage fuer Requirements

### Phase 2 - Offline-Basisprojekt

Ziel:

- Haustier auf Display darstellen
- einfache Eingabe ermoeglichen
- wenige lokale Zustaende modellieren
- Zustand lokal speichern

Moeglicher Umfang:

- Gesicht oder Figur anzeigen
- Zustand wechseln
- Button-Interaktion
- einfacher Tages- oder Ereignisverlauf

### Phase 3 - Didaktische Struktur

Ziel:

- ProjectIntroduction erstellen
- Lessons und ProjectSteps planen
- Conditions definieren
- ProjectFlowItems ableiten

Moegliche Inhalte:

- ESP32 vorbereiten
- Display anschliessen
- erstes Bild anzeigen
- Eingabe auswerten
- Zustandsautomat verstehen
- Zustand speichern

### Phase 4 - Modularisierung und Erweiterbarkeit

Ziel:

- Erweiterungen fachlich vorbereiten
- klare Modulgrenzen dokumentieren
- optionale Hardware-Erweiterungen ableiten

Moegliche Erweiterungen:

- Buzzer
- RGB LED
- Touch
- Akku
- Sensoren

### Phase 5 - Online-Funktionen

Ziel:

- WLAN optional einbinden
- Online-Status als Condition modellieren
- Datenfluss und Datenschutz klaeren

Moeglicher Umfang:

- WLAN konfigurieren
- Online-Erreichbarkeit pruefen
- einfache externe Antwort abrufen

### Phase 6 - Optionale OpenAI-Integration

Ziel:

- natuerlichsprachliche Interaktion optional ermoeglichen
- OpenAI als austauschbaren AI Adapter betrachten
- Offline-Funktionalitaet weiterhin erhalten

Moeglicher Umfang:

- kurze Texteingabe ueber IDE oder Companion UI
- Antwort als Text auf Display
- Persoenlichkeitsprofil fuer das Haustier

### Phase 7 - Folgeprojekte und Produktstrategie

Ziel:

- weitere Lernangebote aus dem Projekt ableiten
- Kundenbindung durch Erweiterungsprojekte staerken

Moegliche Folgeprojekte:

- KI-Haustier mit Touch Display
- KI-Haustier mit Sensoren
- KI-Haustier mit Sprache
- KI-Haustier mit OTA Updates
- KI-Haustier als Gehaeuseprojekt

## Ergebnis

Das KI-Haustier ist ein geeignetes LearningProject, weil es sichtbaren Spass, emotionale Motivation und relevante Embedded-Kompetenzen verbindet.

Die erste Version sollte bewusst offline, guenstig und klein bleiben.
OpenAI wird als optionale Erweiterung eingeordnet, nicht als Voraussetzung.

Damit eignet sich das Projekt sowohl als Einstieg in ESP32-Display-Projekte als auch als Ausgangspunkt fuer spaetere Lernpfade zu IoT, UI, Device Management und KI-gestuetzter Interaktion.
