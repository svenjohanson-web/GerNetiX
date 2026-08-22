# Codex-Arbeitsanweisung: Elektroniklabor schrittweise umsetzen

Stand: 2026-08-16  
Status: Arbeitsanweisung für geplante Arbeitspakete; die Zielarchitektur ist
noch nicht fachlich beschlossen

Diese Arbeitsanweisung richtet sich insbesondere an die Umsetzung mit
**Spark**. Mit `Spark` ist in diesem Dokument das vom Nutzer gewählte schnelle
Codex-Modell gemeint. Die Arbeitsanweisung gilt ergänzend zu `AGENTS.md` und ersetzt keine
Projekt-, Sicherheits-, Persistenz- oder Graphregel.

Fachliche Grundlage:

- [Lastenheft-Entwurf](virtual-electronics-lab-requirements-draft.md)
- [Zielarchitektur-Entwurf](virtual-electronics-lab-target-architecture-draft.md)
- [Aktuell umgesetztes öffentliches Labor](virtual-electronics-lab.md)

Bei Widersprüchen gilt folgende Reihenfolge:

1. aktuelle System- und Projektanweisungen,
2. bestätigte Entscheidungen und Requirements im SQLite-Graphen,
3. gepflegte verbindliche Architekturdokumente,
4. genehmigtes Arbeitspaket,
5. diese Arbeitsanweisung,
6. noch nicht beschlossene Entwürfe.

## 1. Ziel der Arbeitsweise

Das Elektroniklabor wird nicht als Big-Bang-Projekt implementiert. Jede
Änderung führt höchstens eine neue fachliche Fähigkeit ein und endet mit einem
kontrollierbaren, getesteten Ergebnis.

Leitregel:

> Ein Arbeitspaket ist klein genug, wenn sein Verhalten in einem Satz erklärt,
> mit wenigen Abnahmekriterien geprüft und ohne vorweggenommene Nachbarfunktion
> implementiert werden kann.

## 2. Vor jedem Arbeitspaket

Vor der Umsetzung muss das Arbeitspaket mindestens enthalten:

- eindeutige ID und Titel,
- fachliches Ziel,
- sichtbarer oder maschinenprüfbarer Nachweis,
- ausdrücklich enthaltene Funktion,
- ausdrücklich nicht enthaltene Funktionen,
- betroffene Architekturgrenze,
- erlaubte oder erwartete Dateien,
- Abnahmekriterien,
- verpflichtende Tests,
- Dokumentations- und Graphauswirkung,
- bekannte offene Entscheidung.

Fehlt eine Angabe, wird sie vor der Implementierung ergänzt. Eine offene
Entscheidung wird nicht durch eine zufällige Codewahl ersetzt.

## 3. Pflichtlektüre

Für jedes größere oder fachliche Arbeitspaket sind mindestens zu lesen:

- `AGENTS.md`,
- `docs/codex-reminder-procedure.md`,
- die relevanten Einträge in
  `tools/yaml-graph-sqlite/out/model-graph.sqlite`,
- dieses Dokument,
- der relevante Abschnitt des Zielarchitektur-Entwurfs,
- die direkt betroffenen bestehenden Quelldateien und Tests.

Zusätzlich gelten die projektspezifischen Pflichten:

- Architektur oder Prozesse: zentrale Prozess-UML und
  Architekturdokumentation prüfen.
- Codeausführung, KI, öffentliche Endpunkte, Persistenz, Logging, Solver oder
  Worker: `docs/security-posture.md` lesen und bei Umsetzung aktualisieren.
- Projektdateien und Speicherung: Project-Server-, Forgejo- und
  Persistenzvertrag lesen.
- KI: Standard-KI-Chat-Pattern, AI Context und AI Usage prüfen.

Es werden nur die für das Arbeitspaket notwendigen Dateien gelesen. Bereits
bekannte Projektregeln werden nicht durch eine breite Repositorysuche ersetzt.

## 4. Ablauf eines Arbeitspakets

### Schritt 1: Scope bestätigen

Vor dem Editieren wird in höchstens wenigen Sätzen festgehalten:

- welche eine Fähigkeit umgesetzt wird,
- welche Nachbarfunktionen ausdrücklich unberührt bleiben,
- welche Dateien voraussichtlich betroffen sind.

### Schritt 2: Ist-Vertrag prüfen

Bestehendes Verhalten, Tests und dokumentierte Grenzen werden gelesen. Eine
Bestandsfunktion wird nicht aufgrund einer Vermutung umgebaut.

### Schritt 3: Kleinste tragfähige Änderung planen

Die Änderung wird am bestehenden Vertrag ausgerichtet. Neue Abstraktionen oder
Module entstehen nur, wenn sie für das aktuelle Arbeitspaket benötigt werden.

### Schritt 4: In einem fachlichen Block implementieren

Code, gezielte Tests und unmittelbar notwendige Dokumentation werden als ein
zusammengehöriger Block umgesetzt. Unabhängige Aufräumarbeiten werden nicht
beigemischt.

### Schritt 5: Verpflichtend nachweisen

Spark wird in jedem Auftrag ausdrücklich angewiesen, die
benannten Tests auszuführen. Ein bloßes Erstellen von Code gilt nicht als
Abschluss.

### Schritt 6: Graph und Dokumentation abgleichen

Es wird geprüft, ob Requirement, Architektur, Persistenz, Abhängigkeit,
Sicherheitsgrenze oder Prozess verändert wurden. Nur relevante Artefakte
werden aktualisiert. Reine UI-Texte oder Kommentare lösen keinen künstlichen
Graphschritt aus.

### Schritt 7: Kurz abschließen

Der Abschluss nennt nur:

- geänderte Bereiche,
- ausgeführte Tests,
- Graphstatus,
- offene Punkte.

## 5. Verbotene Abkürzungen

Folgende Lösungen sind im Zielsystem nicht zulässig:

- eine neue Funktion als weiteres getrenntes Instrumenten-Lab bauen,
- Mikrocontroller-PWM über einen unabhängigen UI-Regler steuern,
- GPIO-, ADC-, DAC- oder Buszustände ohne Virtual MCU Runtime erzeugen,
- Instrumente mit eigener versteckter Schaltung oder Signalwahrheit versehen,
- Schaltung getrennt für UI, KI und Solver modellieren,
- Nutzerquellcode mit `eval`, `new Function` oder nativer Ausführung starten,
- Raw-SPICE-Eingaben ungeprüft ausführen,
- LLM-Provider direkt aus dem Browser aufrufen,
- Provider Keys im Browser oder Projekt speichern,
- KI-Ausgaben direkt auf Projekt- oder Laborzustand anwenden,
- fachliche Projektwahrheit in `localStorage`, losen JSON-Dateien oder
  Prozessspeicher legen,
- Tarifnamen wie `premium` direkt in Fachlogik abfragen,
- reale Herstellerbauteile oder professionelle Modellgenauigkeit vortäuschen,
- eine offene Architekturentscheidung still im Code treffen,
- laufende Dienste vorsorglich neu starten,
- ohne ausdrücklichen Auftrag deployen, committen oder pushen.

## 6. Architekturregeln für Implementierungen

### Gemeinsames LabProject

Jede neue Funktion muss das gemeinsame `LabProject` oder einen klar
versionierten Vorläufer verwenden. Ein nur für einen einzelnen Bildschirm
gebautes Parallelmodell ist ausgeschlossen.

### Typisierte Commands

Zustandsänderungen erfolgen über den gemeinsamen Command-Pfad. UI,
Vorlagenlogik und bestätigte KI-Aktionen dürfen dieselben fachlichen Befehle
verwenden, aber keine gegenseitigen Sonderwege.

### Virtuelle Zeit

Simulation und Mikrocontroller verwenden eine kontrollierte virtuelle Zeit.
Fachliches Verhalten darf nicht von Browser-Renderfrequenz oder zufälligem
Wall-Clock-Timing abhängen.

### Messinstrumente

Instrumente lesen definierte Messpunkte über den Measurement Bus. Sie
berechnen keine zweite Schaltungswahrheit.

### Modelltransparenz

Jedes Modell nennt Einheit, Grenzbereich, Modellgüte und bekannte Grenzen.
Schätzung und berechnetes Solverergebnis werden nicht vermischt.

### Persistenz

Flüchtige Entwürfe dürfen im Browser leben. Dauerhafte accountgebundene
Projektdateien laufen ausschließlich über Project Server und gebundenes
Forgejo-Repository. Große Ergebnisartefakte benötigen einen ausdrücklich
entschiedenen Artifact- und Retentionsvertrag.

### KI

Echte KI-Aufrufe benötigen serverseitige Identity, Capability, AI-Usage-
Preflight, minimierten AI-Context, `store: false`, Structured Output und
Abschlussbuchung. Ändernde Vorschläge benötigen ein sichtbares Diff und
Nutzerbestätigung.

## 7. Größenregel für Spark-Arbeitspakete

Ein normales Arbeitspaket soll möglichst:

- genau eine neue fachliche Fähigkeit einführen,
- einen Hauptvertrag oder eine vertikale Schnittstelle verändern,
- mit gezielten Unit- oder Contract-Tests nachweisbar sein,
- keine neue Runtime und keinen neuen Serverprozess gleichzeitig einführen,
- keine unbestätigte Nachbarfunktion vorbereitend implementieren.

Wenn ein Paket gleichzeitig MCU, SPICE, KI, Persistenz und UI berührt, ist es
zu groß und muss geteilt werden.

Ein Refactoringpaket verändert kein Nutzerverhalten. Ein Funktionspaket darf
notwendiges lokales Refactoring enthalten, aber keine unabhängige Bereinigung.

## 8. Arbeitspaket-Schablone

```markdown
# ELAB-XXX: Eindeutiger Titel

## Ziel

Ein Satz mit der einen neuen fachlichen Fähigkeit.

## Ausgangssituation

Der nachgewiesene aktuelle Stand und die betroffenen Verträge.

## Enthalten

- exakt umzusetzende Funktion

## Nicht enthalten

- ausdrücklich ausgeschlossene Nachbarfunktionen

## Architekturbezug

- betroffene Zielkomponente
- verwendeter bestehender Vertrag
- keine still zu treffende offene Entscheidung

## Voraussichtlich betroffene Dateien

- konkrete Dateien oder eng begrenzte Verzeichnisse

## Fachliche Regeln

- Formeln, Einheiten, Zustände und Fehlerverhalten

## Abnahmekriterien

- beobachtbares oder exakt berechenbares Ergebnis

## Tests

- auszuführende Testbefehle
- erwartete neue Unit-/Contract-Tests

## Dokumentation und Graph

- erwartete Auswirkung oder ausdrücklich `keine`

## Abschlussnachweis

- geänderte Bereiche
- Tests
- Graphstatus
- offene Punkte
```

## 9. Pflichtformulierungen für Spark-Aufträge

Jeder Auftrag an Spark soll ausdrücklich enthalten:

- `Implementiere ausschließlich dieses Arbeitspaket.`
- `Bewahre alle nicht genannten Bestandsfunktionen.`
- `Triff keine offene Architekturentscheidung still im Code.`
- `Implementiere keine der unter Nicht enthalten genannten Funktionen.`
- `Führe die benannten Tests aus.`
- `Prüfe am Ende Graph- und Dokumentationsauswirkung.`
- `Starte oder restarte keine Dienste ohne nachgewiesene Notwendigkeit.`
- `Deploye, stage, committe und pushe nicht.`

Wenn der Auftrag eine größere Richtungsentscheidung erfordert, beendet Spark
das Paket mit der offenen Frage, statt eine zusätzliche Architektur zu bauen.

## 10. Kontrollpunkte für den Nutzer

Nach jedem Paket muss der Nutzer ohne tiefe Codeanalyse mindestens einen der
folgenden Nachweise kontrollieren können:

- klar sichtbares Verhalten in genau einem Versuchsaufbau,
- exakt erwarteter numerischer Wert,
- stabile Zustandsfolge,
- verständliche Fehlermeldung,
- reproduzierbarer Reset,
- kleines serialisiertes Modell,
- grüner gezielter Contract-Test.

Ein rein internes Paket muss sein Ergebnis durch ein kleines, lesbares
Vertragsbeispiel und Tests sichtbar machen.

## 11. Vorgeschlagene erste Arbeitspakete

Für den ersten echten vertikalen Nachweis gilt die gesonderte
[Spezifikation ELAB-DS-001](virtual-electronics-lab-gpio-led-vertical-slice-spec.md).
Sie verbindet die unten beschriebenen Architekturgrenzen in genau einem
kontrollierbaren Nutzerablauf. Die folgenden Pakete bleiben als mögliche
feinere Zerlegung und nicht als zusätzlich parallel zu implementierender
Umfang erhalten.

Diese Reihenfolge ist ein Vorschlag und wird erst nach Bestätigung einzeln
beauftragt.

### ELAB-001: Minimaler LabProject-Vertrag

Nur versioniertes Modell für Spannungsquelle, Widerstand, LED, virtuellen MCU,
einen GPIO und eine Quellcodedatei. Keine UI und keine Simulation.

### ELAB-002: Validierte Laborbefehle

Nur Commands zum Ändern des Quellcodes und zum Verbinden der bereits im
Minimalmodell vorhandenen Pins. Keine freie Komponentenbibliothek.

### ELAB-003: Deterministischer LED-Gleichstrompfad

Nur Berechnung von GPIO-Pegel, Vorwiderstand, LED-Zustand und Strom für den
festen Minimalaufbau. Kein SPICE und kein Quellcodeinterpreter.

### ELAB-004: Minimaler Virtual-MCU-GPIO

Nur GPIO-Modus, HIGH, LOW, Pegel und Stromgrenze. Noch kein Timer, PWM oder
Interrupt.

### ELAB-005: Kontrollierte setup/loop-Minimalruntime

Nur Parser und Ausführung der für den GPIO-Durchstich benötigten Befehle. Keine
allgemeine C++-Kompatibilität.

### ELAB-006: Gemeinsame Laborfläche für den GPIO-LED-Durchstich

Nur sichtbarer Aufbau, Editor, Start und Reset für den fest vorbereiteten
Durchstich. Keine freie Verdrahtung und kein Bestandsinstrument.

### ELAB-007: Integrations- und Replaynachweis

Nur deterministischer Nachweis Code -> GPIO -> Widerstand -> LED sowie
Überlastwarnung und reproduzierbarer Reset. Keine neue Fachfunktion.

Erst nach diesem Durchstich werden Timer, PWM, Oszilloskop, Taster, ADC,
Sensoren, Fehlersuche, KI und SPICE jeweils in eigenen Paketen geplant.

## 12. Definition of Done

Ein Arbeitspaket ist nur abgeschlossen, wenn:

- die eine beschriebene Fähigkeit vollständig umgesetzt ist,
- ausgeschlossene Nachbarfunktionen nicht vorweggenommen wurden,
- bestehendes relevantes Verhalten erhalten ist,
- gezielte Tests vorhanden und erfolgreich sind,
- Fehler- und Grenzfälle verständlich behandelt werden,
- keine neue fachliche Wahrheit in Browser State oder losen Dateien entstand,
- Sicherheits-, Graph- und Dokumentationsauswirkung geprüft wurde,
- relevante Dokumentation mit dem Code übereinstimmt,
- der Abschlussnachweis kurz und überprüfbar ist.

Budgetende, Zeitdruck oder ein nur teilweise funktionierender Prototyp erfüllen
die Definition of Done nicht.

## 13. Integrationspakete

Nach mehreren Fachpaketen folgt ein eigenes Integrationspaket. Es führt keine
neue Funktion ein, sondern prüft:

- Zusammenspiel der Verträge,
- deterministische Wiederholbarkeit,
- Regressionen,
- Browserlayout,
- Sicherheitsgrenzen,
- Dokumentations- und Graphkonsistenz.

Dadurch bleiben die Arbeitspakete klein, ohne dass isolierte Einzelteile am
Ende unverbunden nebeneinander stehen.
