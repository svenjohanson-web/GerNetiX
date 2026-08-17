# ELAB-PAR-001: Isoliertes PT1000-Umgebungsmodell

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

Dieses Arbeitspaket darf parallel zu ELAB-DS-001 und ELAB-DS-002 umgesetzt
werden. Es besitzt absichtlich keine Verbindung zur aktuellen Laboroberfläche,
Program Runtime, Virtual MCU Runtime oder Schaltungssimulation.

Das Ergebnis ist ein getesteter, aber noch nicht integrierter fachlicher
Rechenkern:

```text
Umgebungstemperatur in °C
-> PT1000-Kennlinienmodell
-> Widerstand in Ohm
```

## 1. Zweck der Parallelisierung

ELAB-PAR-001 darf ausschließlich neue, eigene Dateien anlegen. Es verändert
keine Datei, die von den beiden laufenden Durchstichen voraussichtlich
bearbeitet wird.

Insbesondere bleiben unverändert:

- `modules/virtual-electronics-lab/app.js`,
- `modules/virtual-electronics-lab/index.html`,
- `modules/virtual-electronics-lab/styles.css`,
- vorhandene Dateien unter `modules/virtual-electronics-lab/labs/`,
- Workbench-, Command-, MCU-, Runtime-, Solver- und Measurement-Dateien,
- Identity-Routen und Identity-Tests,
- bestehende Elektroniklabor-Dokumente,
- der kanonische SQLite-Graph.

Falls Spark für die Umsetzung eine dieser Dateien verändern müsste, stoppt es
und meldet den Konflikt. Es erweitert den Scope nicht selbst.

## 2. Ziel

Eine reine Funktion berechnet für eine vorgegebene Temperatur den idealisierten
Nennwiderstand eines Pt1000 nach der IEC-60751-Kennlinie.

Der Rechenkern ist später für folgende Wirkungskette vorgesehen, bildet in
diesem Paket aber ausschließlich den ersten Pfeil ab:

```text
Temperatur
-> Sensorwiderstand
-> spätere Messschaltung
-> späterer ADC-Wert
-> spätere Programmlogik
```

Messschaltung, ADC und Programmlogik gehören nicht zu diesem Arbeitspaket.

## 3. Fachliche Referenz

Das Modell verwendet:

- Pt1000-Nennwiderstand `R0 = 1000 Ω` bei `0 °C`,
- Temperaturkoeffizient der 3850-ppm/K-Kennlinie,
- Callendar–Van-Dusen-Koeffizienten nach IEC 60751,
- idealisierten Modellbereich `-200 °C` bis einschließlich `850 °C`.

Koeffizienten:

```text
A =  3,9083 * 10^-3 °C^-1
B = -5,7750 * 10^-7 °C^-2
C = -4,1830 * 10^-12 °C^-4
```

Die Koeffizienten und Gleichungen werden unter anderem in der
[RTD-Anwendungsinformation von Texas Instruments](https://www.ti.com/lit/pdf/sbaa275)
und den
[technischen Informationen von YAGEO Nexensos](https://www.yageo-nexensos.com/content/dam/nexensos/documents/faq/2_Website_FAQs_Technische_Informationen_EN.pdf)
beschrieben. TE Connectivity bestätigt für Pt1000 den Nennwiderstand von
1000 Ω bei 0 °C und die Übereinstimmung mit DIN EN 60751 in seiner
[Pt1000-Produktbeschreibung](https://www.te.com/en/product-CAT-RTD0048.html).

Diese Quellen sind Referenzen für das Lernmodell und keine Freigabe eines
konkreten Herstellerbauteils.

## 4. Berechnungsregeln

Für Temperaturen größer oder gleich 0 °C gilt:

```text
R(T) = R0 * (1 + A*T + B*T^2)
```

Für Temperaturen kleiner als 0 °C gilt:

```text
R(T) = R0 * (1 + A*T + B*T^2 + C*(T - 100)*T^3)
```

Eingabe und Berechnung verwenden Grad Celsius. Das Ergebnis wird in Ohm
zurückgegeben.

Der Rechenkern darf den fachlichen Wert nicht für eine Anzeige vorab runden.
Eine spätere UI darf unabhängig davon formatiert runden.

## 5. Verbindliche Referenzwerte

Die Tests verwenden mindestens folgende idealisierten Werte:

| Temperatur | Widerstand |
| ---: | ---: |
| -200 °C | 185,2008 Ω |
| -100 °C | 602,5584 Ω |
| -50 °C | 803,06281875 Ω |
| 0 °C | 1000 Ω |
| 100 °C | 1385,055 Ω |
| 200 °C | 1758,56 Ω |
| 600 °C | 3137,08 Ω |
| 850 °C | 3904,81125 Ω |

Vergleiche berücksichtigen die Gleitkommadarstellung mit einer ausdrücklich
definierten engen numerischen Toleranz. Tests dürfen erwartete Werte nicht aus
derselben Implementierungsfunktion ableiten.

## 6. Fachlicher Vertrag

Das Paket exportiert genau:

- eine unveränderliche Modelldeskription,
- eine reine Auswertungsfunktion.

Konzeptioneller Vertrag:

```text
PT1000_MODEL
|- modelId
|- modelVersion
|- quantity
|- inputUnit
|- outputUnit
|- nominalResistanceOhm
|- minTemperatureC
|- maxTemperatureC
|- coefficients
`- limitations

evaluatePt1000(temperatureC)
-> temperatureC
-> resistanceOhm
-> modelId
-> modelVersion
-> warnings
```

Verbindliche Kennungen:

```text
modelId      = pt1000-iec-60751
modelVersion = 1.0.0
inputUnit    = degC
outputUnit   = ohm
```

Die Funktion besitzt keine Seiteneffekte und mutiert weder Eingabe noch
Modelldeskription.

## 7. Eingabevalidierung

Akzeptiert werden ausschließlich endliche JavaScript-Zahlen im Bereich
`-200` bis `850` einschließlich der Grenzen.

Abgewiesen werden:

- `NaN`,
- positive und negative Unendlichkeit,
- Strings einschließlich numerisch aussehender Strings,
- `null` und `undefined`,
- Objekte und Arrays,
- Temperaturen außerhalb des Modellbereichs.

Stabile Fehlercodes:

| Code | Bedeutung |
| --- | --- |
| `PT1000_TEMPERATURE_NUMBER_REQUIRED` | Eingabe ist keine endliche Zahl |
| `PT1000_TEMPERATURE_OUT_OF_RANGE` | Eingabe liegt außerhalb -200 bis 850 °C |

Ein Fehler enthält den stabilen Code und einen für Entwickler verständlichen
Text. Deutsche UI-Texte sind nicht Teil dieses Rechenkerns.

## 8. Modellgrenzen

Das Ergebnis ist der idealisierte Nennwiderstand der Kennlinie. Nicht
modelliert werden:

- Toleranzklassen AA, A, B oder C,
- konkrete Hersteller- oder Gehäusevarianten,
- Eigenerwärmung durch Messstrom,
- thermische Trägheit,
- Hysterese oder Alterung,
- Leitungswiderstand,
- Zwei-, Drei- oder Vierleitermessung,
- Kontakt- und Steckverbinderwiderstände,
- Messstromquelle oder Spannungsteiler,
- ADC-Auflösung, Referenzspannung oder Quantisierung,
- Rauschen, Kalibrierung oder Messunsicherheit,
- Umrechnung von Widerstand zurück in Temperatur.

Diese Grenzen stehen maschinenlesbar oder als stabile Texte in der
Modelldeskription. Das Paket darf keine reale Genauigkeitsklasse versprechen.

## 9. Determinismus und Sicherheit

Der Rechenkern verwendet ausschließlich seine numerische Eingabe und feste
Modellkonstanten.

Unzulässig sind:

- `Date`, reale Uhrzeit oder Zeitzone,
- `Math.random`,
- Browser- oder DOM-Zugriff,
- Netzwerk- oder Dateizugriff,
- `eval` oder `new Function`,
- globale mutierbare Zustände,
- `localStorage`, Datenbank oder Prozesspersistenz,
- externe Laufzeitabhängigkeiten für die Formel.

Gleiche Eingabe und gleiche Modellversion ergeben denselben serialisierbaren
Fachwert.

## 10. Erlaubte Dateien

Spark darf für dieses Paket ausschließlich folgende neue Dateien oder
gleichwertig isolierte neue Pfade anlegen:

```text
modules/virtual-electronics-lab/environment-models/pt1000.mjs
modules/virtual-electronics-lab/test/environment-models/pt1000.test.mjs
```

Falls diese Pfade durch parallele Arbeit bereits belegt wurden, legt Spark
nicht eigenmächtig einen konkurrierenden Vertrag an. Es stoppt und meldet den
Dateikonflikt.

Nicht erlaubt sind Änderungen an `package.json`, Buildsystem, Routen,
Navigation, Styles oder bestehenden Tests, nur um den neuen Test ausführbar zu
machen. Der Test wird direkt mit der im Projekt verfügbaren Node-Runtime
ausgeführt.

## 11. Nicht enthalten

- Einbau in das `LabProject`,
- `SetEnvironmentValue`-Command,
- Slider oder andere UI-Bedienelemente,
- Sensor-Symbol oder Schaltungsdarstellung,
- Widerstand, Strom oder Spannung in einer Schaltung,
- Virtual MCU, ADC oder Quellcode,
- zeitlicher Temperaturverlauf,
- thermische Simulation,
- Fehlerszenarien,
- SPICE,
- KI,
- Persistenz,
- API oder Serverprozess,
- Änderungen an ELAB-DS-001 oder ELAB-DS-002,
- Änderungen am SQLite-Graphen während der parallelen Ausführung.

## 12. Verpflichtende Tests

Spark erstellt und führt mindestens folgende Tests aus:

- alle acht verbindlichen Referenzwerte,
- exakt `1000 Ω` bei `0 °C`,
- beide Formeläste unmittelbar unter und über `0 °C`,
- Kontinuität der beiden Formeläste bei `0 °C`,
- inklusive Grenzen `-200 °C` und `850 °C`,
- Ablehnung knapp außerhalb beider Grenzen,
- Ablehnung aller unter Eingabevalidierung genannten Typen und Werte,
- monoton steigender Widerstand über den Modellbereich, geprüft an einer
  unabhängigen Folge von Stützstellen,
- unveränderte Modelldeskription nach einem Auswertungsaufruf,
- identische Ergebnisse bei wiederholten Aufrufen,
- keine unerlaubten Imports oder globalen Zugriffe,
- statische Prüfung auf `eval`, `new Function`, `Date`, `Math.random`,
  Netzwerk-, DOM- und Persistenzzugriffe.

Verpflichtender gezielter Testbefehl:

```text
node --test modules/virtual-electronics-lab/test/environment-models/pt1000.test.mjs
```

Spark verwendet den projektspezifisch verfügbaren Node-24-Pfad, falls `node`
nicht in der Shell verfügbar ist.

## 13. Abnahmekriterien

Das isolierte Paket ist technisch nachgewiesen, wenn:

1. genau die beiden erlaubten neuen Dateien entstanden sind,
2. alle Referenzwerte innerhalb der definierten numerischen Toleranz stimmen,
3. ungültige Eingaben stabile Fehlercodes liefern,
4. der Widerstand im gültigen Bereich monoton steigt,
5. die Auswertung deterministisch und frei von Seiteneffekten ist,
6. alle gezielten Tests erfolgreich sind,
7. keine Datei der parallelen Durchstiche geändert wurde,
8. keine UI-, Runtime-, Solver-, Routing-, Persistenz- oder Graphintegration
   vorgenommen wurde.

Das Paket gilt damit als **isoliert vorbereitet**, nicht als bereits in das
Elektroniklabor integrierte Nutzerfunktion.

## 14. Spätere Integration

Ein eigenes, späteres Integrationspaket muss entscheiden und testen:

- Aufnahme als versioniertes Environment Model im `LabProject`,
- `SetEnvironmentValue` über den gemeinsamen Command-Pfad,
- Temperaturbedienung in derselben Laboroberfläche,
- Widerstandsübergabe an den gemeinsamen Schaltungssolver,
- Messschaltung und späterer ADC-Pfad,
- Graph-, Architektur- und Dokumentationsnachweis.

Diese Entscheidungen werden in ELAB-PAR-001 nicht vorweggenommen.

## 15. Abschlussnachweis

Spark meldet ausschließlich:

- die zwei neu angelegten Dateien,
- den ausgeführten Testbefehl und das Ergebnis,
- die geprüften Referenzwerte,
- Bestätigung, dass keine bestehenden Dateien verändert wurden,
- offene Punkte für die spätere Integration.

Spark führt in diesem Parallelpaket keinen Graphimport, keinen
Dokumentationsbuild und keinen Serverstart aus.

## 16. Arbeitsauftrag für Spark

> Implementiere ausschließlich `ELAB-PAR-001` aus
> `docs/virtual-electronics-lab-pt1000-environment-model-work-package.md`.
> Dieses Paket muss vollständig unabhängig von ELAB-DS-001 und ELAB-DS-002
> bleiben. Lege ausschließlich die beiden unter `Erlaubte Dateien` genannten
> neuen Dateien an. Verändere keine bestehende Datei. Implementiere nur das
> reine PT1000-Temperatur-zu-Widerstand-Modell und seine gezielten Tests.
> Implementiere keine UI, Schaltung, Runtime-, MCU-, ADC-, Solver-, Routing-,
> Persistenz- oder Graphintegration. Führe den benannten Node-Test aus.
> Starte oder restarte keine Dienste. Deploye, stage, committe und pushe nicht.
> Wenn einer der erlaubten Pfade bereits belegt ist oder eine bestehende Datei
> geändert werden müsste, stoppe und melde genau diesen Konflikt. Erweitere den
> Scope nicht selbst.
