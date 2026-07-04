# Decision: Modularer Monolith mit externer Device-Management-API

## Entscheidung

Device Management wird fachlich als eigene Domaene und API geschnitten, im MVP aber im gemeinsamen Backend betrieben.

## Begruendung

Pairing, Account, Authorization, Hardware-Katalog, IDE-Profil und Learning-Projekte greifen eng ineinander. Ein separater Microservice wuerde im MVP zusaetzliche Betriebs-, Auth- und Deployment-Komplexitaet erzeugen. Eine klare externe API verhindert trotzdem, dass Device Management im Backend unsichtbar oder schwer auslagerbar wird.

## Konsequenzen

- Ein Serverprozess im MVP.
- Eigener API-Prefix fuer Device Management.
- Eigene Module und Datenmodelle.
- Spaetere Auslagerung bleibt moeglich.
- ESP, IDE, Recovery Tool und Provisioning Tool sprechen denselben Device-Management-Bereich an.