# Elektroniklabor: Planung nach ELAB-FS-006

Stand: 2026-08-17  
Status: FS-007 bis FS-012 lokal umgesetzt und getestet; Live-Provider-Nachweis ausstehend

## Zielbild

Der nächste Block macht aus der sichtbaren Prellspur eine realitätsnahe
Quellcodeübung. Danach wird der bereits getestete KI-Vertrag schrittweise bis
zu einer serverseitigen, creditgebundenen KI-Anbindung geführt.

```text
FS-007 Entprellkern
    ↓
FS-008 Virtual-MCU-Entprellprogramm
    ↓
FS-009 Sichtbarer Vergleich
    ↓
FS-010 Fehlersuche Entprellung
    ↓
FS-011 KI-Bedienablauf ohne Live-KI
    ↓
FS-012 Serverseitige Live-KI mit Credits
```

## ELAB-FS-007: Deterministischer Entprellkern

**Bearbeitung:** Spark  
**Umfang:** reine Funktion und Unit-Tests

Eine digitale `MeasurementTrace` wird mit expliziter virtueller Zeit
entprellt. Der Ausgang ändert sich erst, wenn der neue Pegel über ein
definiertes Zeitfenster stabil geblieben ist.

Grenzen:

- verwendet ausschließlich vorhandene Trace-Samples,
- keine Timer, Wall-Clock oder Zufallswerte,
- begrenzte Samplezahl und stabile Fehlercodes,
- noch keine UI und kein Quellcodeinterpreter.

## ELAB-FS-008: Kontrollierte Virtual-MCU-Entprellung

**Bearbeitung:** Spark, anschließend Review durch GPT-5.6  
**Abhängigkeit:** FS-007

Eine kleine kontrollierte Programmlaufzeit verbindet `digitalRead(4)`,
virtuelle Mikrosekunden und den Entprellkern. Der Startcode sieht wie ein
kleines reales Mikrocontrollerprogramm aus. Unterstützt wird nur der für die
Übung notwendige Sprachumfang; Nutzerquellcode wird nicht nativ ausgeführt.

## ELAB-FS-009: Rohsignal und Programmwert vergleichen

**Bearbeitung:** GPT-5.6  
**Abhängigkeit:** FS-008

Die bestehende Taster-Laborfläche erhält im Prellfall zwei übereinanderliegende
Spuren:

- physikalisch idealisierter Rohkontakt,
- vom Mikrocontrollerprogramm entprellter Wert.

Das Entprellverhalten wird im Quellcode verändert, nicht über einen separaten
Laborregler. Cursor und Messwerte lesen die gemeinsamen Spuren.

## ELAB-FS-010: Fehlerhafte Entprellung diagnostizieren

**Bearbeitung:** GPT-5.6  
**Abhängigkeit:** FS-009

Zwei kleine Fehlerfälle werden ergänzt:

- Zeitfenster zu kurz: mehrere Tastendrücke werden erkannt,
- Zeitfenster zu lang: der Tastendruck wird störend spät erkannt.

Der Nutzer beobachtet zuerst das Symptom, ändert anschließend den Quellcode
und bestätigt die Reparatur durch die Messspur. Die Aufgabe nennt keine ideale
Universalzeit für reale Taster.

## ELAB-FS-011: KI-Bedienablauf ohne Live-Provider

**Bearbeitung:** GPT-5.6  
**Abhängigkeit:** FS-006 und FS-010

Der bestehende KI-Vertrag wird sichtbar eingebunden. Feste Fixtures prüfen den
vollständigen Bedienablauf:

- Beobachtung erklären,
- nächste Messung vorschlagen,
- Command-Diff anzeigen,
- Änderung erst nach ausdrücklicher Nutzerbestätigung anwenden.

Noch enthalten: keine Netzwerkverbindung, Credits oder Provider-Schlüssel.
Damit kann die Sicherheits- und Bedienlogik unabhängig von einer Live-KI
abgenommen werden.

## ELAB-FS-012: Serverseitige KI-Anbindung und Credits

**Bearbeitung:** GPT-5.6  
**Abhängigkeit:** FS-011

Erst dieses Paket bindet einen Live-Provider an. Dafür sind vor Umsetzung eine
eigene Architektur- und Sicherheitsentscheidung erforderlich.

Verbindliche Grenzen:

- Provider-Schlüssel ausschließlich serverseitig,
- serverseitige Sitzung, Entitlement- und Creditprüfung,
- minimierter Kontext aus dem FS-006-Vertrag,
- strukturierte Ausgabe und erneute serverseitige Validierung,
- `store: false`, Audit und Kostenabschluss,
- Fehlersuche bleibt ohne Credits vollständig manuell nutzbar,
- KI darf weiterhin keine Reparatur selbständig anwenden.

## Empfohlene Abarbeitung

1. FS-007 und FS-008 als getrennte, gut prüfbare Rechenpakete.
2. FS-009 und FS-010 direkt nacheinander in derselben Laborfläche.
3. FS-011 vollständig lokal abnehmen.
4. Vor FS-012 Kosten-, Datenschutz- und Sicherheitsentscheidung treffen.

Spark wird nur für FS-007 und gegebenenfalls FS-008 eingesetzt. Die
Koordinationskosten bleiben dadurch auf isolierte Rechenkerne beschränkt.
