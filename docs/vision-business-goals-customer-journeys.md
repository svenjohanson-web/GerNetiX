# Vision, Business Goals und Customer Journeys

Dieses Dokument priorisiert Vision, Business Goals und Customer Journeys nach Wertbeitrag.
Das Metamodell wird spaeter aus diesen fachlichen Anforderungen abgeleitet.

## Grundsatz

Vision, Business Goals und Customer Journeys werden nicht beliebig dokumentiert.
Sie werden in der Reihenfolge ihrer Wertschoepfung fuer das Produkt entwickelt.

Es wird niemals direkt mit dem Metamodell begonnen.

Ableitung:

Vision -> Business Goal -> Customer Journey -> Requirement -> Metamodell -> Implementierung

## 1. Vision

Die Vision beschreibt, warum die Plattform existiert.

Sie beantwortet ausschliesslich:

- Welches Problem loesen wir?
- Fuer wen loesen wir dieses Problem?
- Welche Produkte entstehen daraus?

Aktuelle Produkte:

- Learning Platform
- Simple IDE

### Kundenversprechen bei der Board-Inbetriebnahme

GerNetiX macht den ersten WLAN-Zugang eines Boards komfortabel, ohne daraus Cloud-Daten zu machen: Das Board sucht die sichtbaren Netze selbst, SSID und Passwort gehen ausschliesslich lokal per USB an das Board und werden weder an GerNetiX gesendet noch im Browser dauerhaft gespeichert. Wer diesen Weg nicht nutzen moechte, kann das lokale Captive Portal des Boards verwenden.

## 2. Business Goals

Business Goals beschreiben, welche Unternehmensziele unterstuetzt werden.

### BG-001

Bestehende Kunden kontinuierlich mit passenden neuen Lernangeboten begleiten.

### BG-002

Den Einstieg in Embedded-Entwicklung moeglichst einfach machen.

### BG-003

Die Einstiegshuerde durch eine einfache IDE reduzieren.

### BG-004

Vorhandene Hardware optimal nutzen und passende Projekte empfehlen.

### BG-005

Engineering-Wissen dauerhaft erhalten.

Leitsatz:

> Wissen ist teurer als Code.

## 3. Customer Journeys

Customer Journeys werden nach Geschaeftswert priorisiert.

### CJ-001 - Neuer Benutzer entdeckt die Plattform

Ablauf:

1. Lerngebiet auswaehlen.
2. Kurs kaufen.
3. Hardware kennenlernen.
4. Projekt starten.

### CJ-002 - Benutzer inventarisiert vorhandene Hardware

Ablauf:

1. Vorhandene Hardware inventarisieren.
2. Hardware Matching durchfuehren.
3. Projektvorschlaege erhalten.
4. Lernpfad ableiten.

### CJ-003 - Benutzer beginnt ein Projekt

Ablauf:

1. Projekt beginnen.
2. Projekt durchfuehren.
3. Kompetenzen aufbauen.
4. Projekt abschliessen.

### CJ-004 - Benutzer kehrt spaeter zurueck

Ablauf:

1. Projektzustand pruefen.
2. Conditions pruefen.
3. Projekt fortsetzen.

### CJ-005 - Benutzer besitzt Hardware, aber noch nicht alle Lernziele

Ablauf:

1. Passende neue Lernangebote empfehlen.
2. Kurs kaufen.
3. Neue Projekte freischalten.

### CJ-006 - Benutzer besitzt ein neues ProcessorBoard

Ablauf:

1. Board per USB erkennen und eine passende Boardkonfiguration auswaehlen oder manuell erfassen.
2. Basissoftware flashen.
3. Das Board laesst lokal sichtbare WLANs suchen; der Benutzer waehlt ein Netz und uebergibt das Passwort direkt per USB oder nutzt alternativ das Captive Portal.
4. Einen kurzlebigen, accountgebundenen Einmalvorgang abschliessen und das Board registrieren und pairen.
5. OTA einrichten und die IDE verwenden.

### CJ-007 - Administrator erweitert die Plattform

Ablauf:

1. Hardware anlegen.
2. Learning Goals erweitern.
3. Projekte ergaenzen.
4. Capabilities pflegen.

## Ableitungsregel

Fuer jede Customer Journey werden anschliessend abgeleitet:

- Requirements
- Metamodell
- Work Packages
- Implementierung

Dadurch bleibt jederzeit nachvollziehbar, warum ein Artefakt existiert und welchen fachlichen Nutzen es erfuellt.
