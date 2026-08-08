# Lernkurs-Pakete

Stand: 2026-08-08 · Status: Produktvorschlag, noch kein Preisblatt und noch kein kaufbares Shop-Angebot

## Grundmodell

GerNetiX verkauft Lerninhalte in einer einfachen Hierarchie:

- Ein kostenloses Grundlagenprojekt schafft einen echten, dauerhaft nutzbaren Einstieg.
- Ein Course ist eine einzeln kaufbare, fachlich abgeschlossene Lerneinheit.
- Ein ProductOffering vom Typ `bundle` bündelt mehrere Courses zu einem zusammenhängenden Lernweg.
- Einzelkauf und Paketkauf gewähren dem Account dauerhaften Zugriff auf die gekauften Lerninhalte und den gespeicherten Lernfortschritt.
- Ein Paket kostet weniger als die Summe seiner kostenpflichtigen Einzel-Courses. Bereits gekaufte enthaltene Courses werden beim Paket-Upgrade angerechnet.
- Kostenlose Courses werden sichtbar als enthalten markiert, aber weder in einen künstlichen Streichpreis noch in die behauptete Ersparnis eingerechnet.
- Cloud-, Build- und KI-Dienste bleiben getrennte laufende Leistungen. KI-Verbrauch wird über veröffentlichte Kontingente oder Prepaid-Credits abgerechnet.

Konkrete Preise werden erst nach Umfangs-, Abschlussraten-, Support- und Zahlungsbereitschaftstests festgelegt. Bis dahin tragen Shop- und Tarifansichten den Status `Preis noch nicht festgelegt`.

## Paket 1: Messtechnik und Fehlersuche

**Produkt-ID:** `product_offering.measurement_troubleshooting_bundle`

**Versprechen:** Lernende können eine Kleinspannungsschaltung sicher untersuchen, Messwerte plausibilisieren und einen Fehler mit dem passenden Messmittel schrittweise eingrenzen.

### Geplanter Lernweg

| Position | Course | Ausgangsstand | Rolle im Paket |
| --- | --- | --- | --- |
| 1 | Umgang mit Messmitteln | im Katalog umgesetzt, kostenlos | Multimeter, Logikanalysator, Oszilloskop und sichere Messvorbereitung |
| 2 | Sensoren prüfen und charakterisieren | aus „Sensorik für deine Hausautomation“ und „Baue deinen eigenen Näherungssensor“ auszubauen | Rohwert, Referenz, Streuung, Grenzwert, Kalibrierung und Umwelteinfluss |
| 3 | Versorgung und Akkus diagnostizieren | Akkudiagnose-Lernprojekt als Entwurf vorhanden | Leerlauf- und Lastspannung, Stromaufnahme, Einbruch, Schutzgrenzen und sichere Ladehardware |
| 4 | Digitale Schnittstellen systematisch prüfen | neu auszuarbeiten | UART, I²C und SPI vom Pegel über Timing und Leitungen bis zum Protokollfehler untersuchen |
| 5 | Fortgeschrittene Oszilloskop-Fehlersuche | neu auszuarbeiten | Trigger, Flanken, Überschwingen, Masseführung, Störungen und Vergleichsmessung |

### Abschlussnachweis

Eine vorbereitete Kleinspannungsschaltung enthält einen ungefährlichen Fehler. Die lernende Person formuliert eine Hypothese, wählt mindestens zwei Messmittel, dokumentiert Messpunkte und Einstellungen und grenzt den Fehler ohne Raten ein.

### Abgrenzung

- Keine Netzspannungsmessungen und keine Arbeit in geöffneten Netzgeräten.
- Keine Aussage, dass ein Kurs eine elektrotechnische Qualifikation oder Sicherheitsfreigabe ersetzt.
- Messgeräte, Tastköpfe und Prüfschaltungen können später als getrenntes Hardware-Bundle angeboten werden; alternative kompatible Hardware bleibt erlaubt.

## Paket 2: Embedded- und Mikrocontroller-Grundlagen

**Produkt-ID:** `product_offering.embedded_microcontroller_foundations_bundle`

**Versprechen:** Lernende verstehen den Weg vom Programmablauf über den Mikrocontroller und seine elektrischen Schnittstellen bis zu einer kleinen eigenen Embedded-Anwendung auf Arduino-/AVR- oder ESP32-Hardware.

### Geplanter Lernweg

| Position | Course | Ausgangsstand | Rolle im Paket |
| --- | --- | --- | --- |
| 1 | Grundlagen der Programmierung | im Katalog umgesetzt, kostenlos | Werte, Variablen, Bedingungen, Funktionen, Schleifen, Fehler und Tests |
| 2 | Grundlagen der Mikrocontrollertechnik | im Katalog umgesetzt, kostenlos | CPU, Speicher, Bits, Datentypen, GPIO, ADC, PWM, Zeit, Interrupts, Watchdog und Bussysteme |
| 3 | Erste Firmware mit Arduino, AVR und ESP32 | aus „Arduino Blink“ und „Arduino Atmel/AVR ohne Arduino“ zusammenzuführen | Board, Toolchain, Build, Flash und Unterschied zwischen Framework und hardwarenaher Laufzeit |
| 4 | Ein- und Ausgänge praktisch einsetzen | aus Mikrocontrollergrundlagen und Motoransteuerung auszubauen | Taster, LED, ADC, PWM, Transistor, Treiber und sichere Aktorgrenzen |
| 5 | Kommunikation und vernetzte Geräte | aus Funktechnologien und passenden ESP32-Projekten auszubauen | UART, I²C, SPI sowie eine begründete erste Einordnung von WLAN und Bluetooth |
| 6 | Eigenes Embedded-Abschlussprojekt | neu als gebündelter Transfer auszuarbeiten | Anforderungen, Pin- und Ressourcenplan, nicht blockierender Ablauf, Messung und nachvollziehbare Abnahme |

### Variantenregel

- Programmier- und Mikrocontrollergrundlagen müssen ohne gekaufte Hardware im Browser beziehungsweise Simulator begonnen werden können.
- Praktische Schritte verwenden ein kompatibles vorhandenes Board, ein GerNetiX-Kit oder eine klar bezeichnete Simulatoralternative.
- ESP32 ist eine wichtige Praxisplattform, aber nicht die Definition von Embedded-Technik. AVR-, STM32- und weitere Boardpfade bleiben fachlich möglich.
- Das Paket darf freie Grundlagen nicht hinter einer Bezahlschranke verstecken. Bezahlt werden zusammenhängende Praxisvertiefungen, geprüfte Projektstände, Assets und der Abschlussweg.

## Kauf- und Upgrade-Regeln

| Situation | Erwartetes Verhalten |
| --- | --- |
| Kostenlosen Course begonnen | Fortschritt bleibt kostenlos und accountgebunden erhalten |
| Einzelnen Course gekauft | Dauerhafter Zugriff auf diesen Course |
| Paket gekauft | Dauerhafter Zugriff auf alle im Kaufumfang benannten Courses |
| Enthaltenen Course bereits gekauft | Sein anrechenbarer Kaufwert reduziert den Paketpreis; kein Doppelkauf |
| Neuer Course erscheint später | Nur enthalten, wenn Kaufumfang oder ein kostenloses Update das ausdrücklich zusagt |
| Cloud-Abo endet | Gekaufte Lerninhalte und Fortschritt bleiben; laufende Cloud-, Build- oder KI-Leistungen fallen auf den kostenlosen Umfang zurück |

Technische Entitlements, Shoppreise, Steuerdarstellung, Rückerstattung und Upgrade-Abrechnung werden erst mit einem eigenen Commerce-Requirement und nach rechtlicher Prüfung umgesetzt. Dieses Dokument definiert zunächst Produktzuschnitt und Kundenversprechen.
