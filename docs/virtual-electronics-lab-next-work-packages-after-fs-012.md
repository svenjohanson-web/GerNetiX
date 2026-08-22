# Elektroniklabor: nächste Arbeitspakete nach FS-012

Stand: 2026-08-17  
Status: FS-013 bis LED-003 lokal umgesetzt und getestet

## Ziel des nächsten Blocks

Der nächste Block schafft zuerst eine skalierbare Auswahl vieler
Anwendungsfälle. Danach folgt als neuer fachlicher Durchstich die bereits
gewünschte LED-Leistungsregelung mit PWM und Stromrücklesung.

Spark bearbeitet nur isolierte Verträge und Rechenkerne. Wegen der beobachteten
Kapazitätsgrenze läuft immer höchstens ein Spark-Paket gleichzeitig. UI,
Lernführung, Sicherheitsintegration und Browserabnahme bleiben bei GPT-5.6.

## Reihenfolge

```text
FS-013 KI-Schutz vervollständigen
    ↓
FS-014 Angemeldeten KI-Browserpfad prüfen
    ↓
TPL-001 LabTemplate-Vertrag (Spark)
    ↓
TPL-002 Katalog vorhandener Anwendungsfälle (Spark)
    ↓
TPL-003 Sichtbare Vorlagenauswahl
    ↓
LED-001 Stromrücklesungsmodell (Spark)
    ↓
LED-002 Kontrollierte Regelprogramm-Runtime (Spark)
    ↓
LED-003 Sichtbarer LED-Regelungsdurchstich
```

## ELAB-FS-013: Schutz des Live-KI-Endpunkts

**Status:** lokal umgesetzt am 2026-08-17

**Bearbeitung:** GPT-5.6
**Spark:** nicht sinnvoll; Sicherheits- und Serviceintegration

Der vorhandene Elektroniklabor-Endpunkt erhält einen begrenzten
accountgebundenen Anfrageschutz und einen konfigurierbaren Kill-Switch.

Abnahme:

- Begrenzung greift vor Creditreservierung und Provideraufruf,
- keine Identität aus dem Browser,
- stabile Fehlerantwort mit weiter nutzbarem manuellen Labor,
- Audit ohne Laborquellcode oder vollständigen Snapshot,
- kein echter Provideraufruf im Test.

## ELAB-FS-014: Angemeldeter KI-Browserpfad ohne Live-Provider

**Status:** lokal umgesetzt am 2026-08-17; kein Live-Provider verwendet

**Bearbeitung:** GPT-5.6  
**Spark:** nicht sinnvoll; Browser-, Session- und Bestätigungsablauf

Der vollständige Weg unter `/technik-labs/` wird mit angemeldeter Testsitzung,
AI-Usage-Doppel und Testprovider geprüft.

Abnahme:

- 401 ohne Sitzung, verständliche Anzeige und keine Einschränkung des Labors,
- 402 ohne Credits und null Provideraufrufe,
- strukturierter Testvorschlag mit sichtbarem Diff,
- Quellcode bleibt bis zur Bestätigung unverändert,
- kein echter OpenAI-Aufruf und kein Deployment.

## ELAB-TPL-001: Minimaler `LabTemplate`-Vertrag

**Status:** durch Spark umgesetzt und durch GPT-5.6 korrigiert sowie abgenommen

**Bearbeitung:** Spark, anschließend Review durch GPT-5.6  
**Spark-Nutzen:** hoch; reine Schema-/Validierungsfunktion mit Unit-Tests

Ein kleiner Vertrag beschreibt einen auswählbaren Laborstartzustand:

- ID, Version, Titel und Kurzbeschreibung,
- Bereich: Messen, Grundschaltung, Fehlersuche oder freie Simulation,
- referenzierter Labor-/Runtime-Einstieg,
- empfohlene Messgeräte und Messpunkte,
- Startcode und Modellgrenzen,
- Zugangsmetadaten ohne fest codierte Tarifnamen.

Noch nicht enthalten sind UI, Persistenz, KI oder freie Schaltungserzeugung.

## ELAB-TPL-002: Katalog vorhandener Anwendungsfälle

**Status:** Spark-Ausführung durch Kapazitätsgrenze beendet; vorhandenes Ergebnis durch GPT-5.6 korrigiert und lokal abgenommen

**Bearbeitung:** Spark, anschließend Review durch GPT-5.6  
**Spark-Nutzen:** hoch; begrenzter Datenkatalog und Contract-Tests

Die bereits vorhandenen Durchstiche werden als Templates beschrieben:

- GPIO → LED, digital,
- GPIO → LED, PWM,
- PT1000 → Spannungsteiler → ADC,
- Taster mit Pull-up,
- Taster-Fehlverdrahtung,
- fehlender Pull-Widerstand,
- Tasterprellen und Entprellfehler.

Der Katalog erzeugt noch keine neue Oberfläche und dupliziert keine
Simulationslogik.

## ELAB-TPL-003: Sichtbare Vorlagenauswahl

**Status:** lokal umgesetzt und im Browser abgenommen

**Bearbeitung:** GPT-5.6  
**Spark:** nicht sinnvoll; gemeinsame UI und Lernführung

Die Laboroberfläche bietet eine kompakte Auswahl nach Anwendungsfall. Eine
Vorlage lädt Schaltung, Startcode, passende Messwerkzeuge und Modellhinweise in
die bestehende Oberfläche. Der Nutzer erkennt klar, dass danach frei verändert
und gemessen werden kann.

Abnahme:

- keine zweite Laboranwendung,
- gleicher Editor-, Schaltungs- und Messbereich,
- Reset lädt den gewählten Template-Startzustand,
- kleine Bildschirmbreiten bleiben nutzbar,
- bestehende direkten Laborlinks funktionieren weiter.

## ELAB-LED-001: Idealisierte Stromrücklesung

**Status:** durch Spark umgesetzt und durch GPT-5.6 abgenommen

**Bearbeitung:** Spark, anschließend Review durch GPT-5.6  
**Spark-Nutzen:** hoch; reine elektrische Messkette

Eine reine Funktion erweitert den bestehenden PWM-LED-Aufbau um einen
Shunt-Widerstand und einen idealisierten ADC-Messwert:

```text
PWM-GPIO → LED-Strom → Shunt-Spannung → ADC-Code
```

Sie verwendet vorhandene LED-, Trace- und ADC-Wahrheiten, besitzt feste
Grenzen und noch keine Regelschleife oder UI.

## ELAB-LED-002: Kontrollierte LED-Regelprogramm-Runtime

**Status:** durch GPT-5.6 umgesetzt und getestet

**Bearbeitung:** GPT-5.6
**Spark-Nutzen:** gering; Parser, elektrische Wahrheit und Zeitmodell sind eng gekoppelt

Eine begrenzte Virtual-MCU-Runtime liest den Strom-ADC, verändert den
PWM-Tastgrad und berechnet jeden Regelschritt in virtueller Zeit. Unterstützt
wird nur der notwendige Startcode-Vertrag, keine allgemeine C++-Ausführung.

Abnahme:

- Sollstrom steht im Quellcode,
- PWM wird ausschließlich durch das Programm verändert,
- harte Schritt-, Zeit- und Tastgradgrenzen,
- deterministische Annäherung ohne Wall-Clock,
- kontrollierte Diagnose bei instabiler oder gesättigter Regelung.

## ELAB-LED-003: Sichtbarer LED-Stromregelungsdurchstich

**Status:** durch GPT-5.6 umgesetzt, getestet und im Browser abgenommen

**Bearbeitung:** GPT-5.6  
**Spark:** nicht sinnvoll; UI, Instrumente, Fehlersuche und Realitätsbrücke

Die bestehende LED-Laborfläche erhält ein Template für Stromregelung. Sichtbar
sind PWM-Spannung, LED-Strom, Shunt-Spannung, ADC-Wert und geregelter
Programmwert. Ein Fehlerfall mit falschem Sollwert oder ungeeignetem
Regelparameter wird über Quellcode und Messwerkzeuge repariert.

Die Oberfläche erklärt ausdrücklich, dass eine reale Leistungs-LED einen
geeigneten Treiber, thermische Auslegung und häufig eine schnellere analoge
Stromregelung benötigt. Der Lernaufbau ist kein Ersatz für einen realen
LED-Treiber.

## Koordinationsregel

1. FS-013 und FS-014 schließen die aktuelle KI-Grenze ab.
2. Spark erhält TPL-001; erst nach Review folgt TPL-002.
3. GPT-5.6 integriert beide Verträge in TPL-003 und prüft den Browser.
4. Spark erhält LED-001; LED-002 beginnt erst nach dessen Abnahme.
5. GPT-5.6 setzt LED-003 um und zieht Doku sowie SQLite-Graph gesammelt nach.

Kein Paket erlaubt automatisch Commit, Push, Deployment, echte Provideraufrufe
oder reale Hardwareansteuerung.
