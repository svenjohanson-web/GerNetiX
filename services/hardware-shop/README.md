# Hardware Shop / Hardware-Katalog

MVP fuer den GerNetiX Hardware Shop und Hardware-Katalog.

Der Service stellt TechnicalCapabilities, HardwareItems, Shop-Angebote, Hardware-Matching, Warenkoerbe, Bestellungen und Kaufkontexte bereit. Die User IDE kann darueber passende Hardware zu Lernprojekten anzeigen; Provisioning und Device Management koennen spaeter den Kaufkontext fuer Support- und Reklamationspruefungen referenzieren.

## Start

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4900
```

API-Prefix:

```text
/api/hardware-shop
```

## Umgesetzt

- TechnicalCapabilities lesen
- HardwareItems und ProcessorBoards verwalten
- ProcessorBoards mit Basissoftware-Profil und Factory-Firmware-Artefaktreferenz bereitstellen
- Shop-Angebote fuer Boards und Kits lesen
- passende Angebote nach benoetigten Capabilities finden
- einfache Warenkoerbe und Bestellungen erzeugen
- Kaufkontext fuer Support/Provisionierung ausgeben
- Admin-Endpunkte fuer HardwareItems, Capabilities und Angebote

## Nicht-Ziele fuer diesen Stand

- keine Zahlungsanbieter-Integration
- keine Lagerverwaltung mit realem ERP
- keine Rechnungsstellung
- keine Versandlabel-Erzeugung
- keine produktive Authentifizierung
