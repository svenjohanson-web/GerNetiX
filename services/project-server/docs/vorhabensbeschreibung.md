# Vorhabensbeschreibung Projektserver

## Ausgangspunkt

GerNetiX braucht fuer Lernprojekte und Embedded-Projekte einen zentralen Projektserver. Dieser Server besitzt die dauerhaften Projektdaten und stellt sicher, dass Builds reproduzierbar aus dem gespeicherten Projektzustand entstehen.

## Erkannte Entscheidungen

- Der Projektserver ist Quelle der Wahrheit fuer Projekte, Quellcode, Projektkonfiguration, Device-Zuordnung und Build-Historie.
- Der Build-&-Deploy-Server besitzt keine dauerhaften Projektdaten.
- Fuer jeden Build erzeugt der Projektserver ein vollstaendiges Build-Paket.
- Das Build-Paket enthaelt Projektquellen, GerNetiX-Basissoftware, User-Code, Hardware-Konfiguration und Zielgeraeteprofil.
- Firmware, Build-Log, Deploy-Log und Status werden nach dem Build zum Projektserver zurueckgegeben.
- Build-Historie und Firmware-Artefaktreferenzen gehoeren zum Projektserver.
- Der Projektserver darf den Build-&-Deploy-Server fuer Prebuilds der Projekthuelle beauftragen.
- Step- und Projektfeedback gehoert fachlich zum Projektserver beziehungsweise zur Learning-Domaene.
- Das Admin Tool zeigt Feedback nur an und sortiert/filtert es, ist aber nicht Quelle der Wahrheit.
- Beim Absenden kann der Nutzer anonym bleiben oder zweckgebunden Kontakt fuer Rueckfragen zu genau diesem Feedback erlauben.
- Kontakt-Consent ist auf maximal zwei Monate begrenzt; danach wird das Feedback anonymisiert.

## Zielbild

```text
Projektserver
  - Projektquellen
  - Projektkonfiguration
  - Device-Zuordnung
  - Build-Paket-Erzeugung
  - Build-Historie
  - Firmware-Artefaktreferenzen
  - Step- und Projektfeedback
  - Anonymisierungsstatus

Build-&-Deploy-Server
  - temporaere Build-Ausfuehrung
  - technischer Cache
  - OTA-/Deploy-Auftrag
```

## Erste fachliche Meilensteine

1. Projektmodell und Build-Paket-Format beschreiben.
2. Ablage fuer User-Code und Hardware-Konfigurationen festlegen.
3. Schnittstelle zum Build-&-Deploy-Server definieren.
4. Build-Historie und Artefaktstatus modellieren.
5. Prebuild-Ausloesung beim Anlegen eines Lernprojekts beschreiben.
6. Device-Management-Verknuepfung fuer OTA-Zielgeraete einbinden.
7. Feedbackspeicherung, Kontakt-Consent und Anonymisierungslauf spezifizieren.

## Offene Punkte

- Wie sieht das minimale Build-Paket technisch aus?
- Welche Projektdateien duerfen Nutzer direkt bearbeiten?
- Wie werden Firmware-Artefakte versioniert?
- Wie lange werden Build-Logs aufbewahrt?
- Welche Teile der Build-Historie sind fuer den Nutzer sichtbar?
- Wie wird die automatische Anonymisierung nach zwei Monaten technisch ausgefuehrt und auditiert?
