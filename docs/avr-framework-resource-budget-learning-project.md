# Lernprojekt: Arduino oder direkt? Timer und Ressourcen auf dem AVR

## Ziel

Das freie Embedded-Lernprojekt macht die Kosten von Framework-Abstraktionen an
einem ATmega328P sichtbar. Ausgangspunkt ist ein typischer Praxisfall: Eine
kleine Firmware funktioniert, bis eine weitere Komfortfunktion oder Bibliothek
einen Timer umkonfiguriert, der bereits für Zeitbasis, PWM oder eine andere
Funktion benötigt wird.

Die fachliche Aussage lautet bewusst nicht, Arduino verbrauche grundsätzlich
für jede Funktion einen eigenen Timer. Der Lernende untersucht stattdessen den
konkreten Arduino-Core, die verwendeten Bibliotheken und deren impliziten
Ressourcenbesitz.

## Lernweg

Der Kurs verwendet dieselbe Taster-, LED- und Zeitaufgabe in drei Varianten:

1. Arduino-Core mit bewusstem Einsatz von `millis()` und PWM,
2. hybride Firmware mit Arduino-Core und ausdrücklich reserviertem Timer1,
3. direkte AVR-Firmware mit avr-libc, Registern, ISR und eigener Hauptschleife.

Vor der Implementierung entsteht ein Timer- und Ressourcenbudget. Danach
werden Flash, SRAM, Timerbelegung, Interruptlaufzeit, Periodenfehler und Jitter
gemessen. Die Abschlussentscheidung berücksichtigt neben Binärgröße und
Zeitverhalten auch Entwicklungsaufwand, Teamwissen, Bibliotheksbedarf und
Wartbarkeit.

## Abgrenzung

Das bestehende Kurzprojekt `arduino-atmel-bare-metal` bleibt der unmittelbare
Build- und Flash-Einstieg ohne Arduino-Framework. Das neue Projekt vermittelt
die vorgelagerte Architektur- und Ressourcenentscheidung und enthält deshalb
Arduino-, Hybrid- und Bare-Metal-Varianten.

Die allgemeinen Themen Resetpfad, Speicherorganisation und Interruptgrenzen
bleiben im Ausbaukurs `embedded-runtime-and-interrupts`. Das neue Projekt
wendet diese Grundlagen konkret auf Timerknappheit und Frameworkwahl beim AVR
an.
