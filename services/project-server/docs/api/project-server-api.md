# Projektserver API

Initiale API-Skizze. Noch kein Implementierungskontrakt.

## Verantwortliche Schnittstellen

- Projekt anlegen, lesen und aktualisieren
- Projektquellen und User-Code verwalten
- Hardware-Konfigurationen verwalten
- Build-Paket erstellen
- Build- und Deploy-Status empfangen
- Firmware-Artefakte und Logs referenzieren
- Build-Historie fuer Projekt und Nutzer anzeigen
- Step- und Projektfeedback annehmen
- Kontaktmodus fuer Feedback erfassen
- Kontakt-Consent fuer Rueckfragen zu genau einem Feedback verwalten
- Feedback nach Ablauf von maximal zwei Monaten anonymisieren

## Nicht in dieser API

- Device-Pairing
- Echtheitsnachweis
- OTA-Zielauswahl aus Account-Devices
- Build-Ausfuehrung
- Firmware-Deployment auf das Device
- dauerhafte Speicherung von Admin-Sichten
