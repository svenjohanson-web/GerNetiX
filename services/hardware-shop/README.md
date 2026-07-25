# Hardware Shop

MVP fuer den GerNetiX Hardware Shop.

Der Service stellt Shop-Angebote, Hardware-Matching, Warenkoerbe, Bestellungen und Kaufkontexte bereit. TechnicalCapabilities und HardwareItems liest er als Client des getrennten Hardware Catalog. Die User IDE kann darueber passende Hardware zu Lernprojekten anzeigen; Provisioning und Device Management koennen den Kaufkontext fuer Support- und Reklamationspruefungen referenzieren.

Fuehrende Persistenz ist die eigene PostgreSQL-Datenbank `gernetix_hardware_shop`. Die bisherige gemeinsame SQLite dient nur der einmaligen Altuebernahme. Fuer isolierte lokale Tests kann `PERSISTENCE_BACKEND=memory` gesetzt werden.

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

- TechnicalCapabilities und HardwareItems ueber den Hardware Catalog lesen
- Shop-Angebote fuer Boards und Kits lesen
- passende Angebote nach benoetigten Capabilities finden
- einfache Warenkoerbe und Bestellungen erzeugen
- Kaufkontext fuer Support/Provisionierung ausgeben
- Admin-Endpunkt fuer Angebote

## Nicht-Ziele fuer diesen Stand

- keine Zahlungsanbieter-Integration
- keine Lagerverwaltung mit realem ERP
- keine Rechnungsstellung
- keine Versandlabel-Erzeugung
- keine produktive Authentifizierung
