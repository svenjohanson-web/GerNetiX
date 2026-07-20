# Webshop, GerNetiX-Account und Aktivierungscodes

## Grundsatz

GerNetiX trennt den Webshop fachlich vom GerNetiX-Account.

- Der Webshop verkauft Produkte, Hardware-Bundles, Software-Lizenzen und Abos.
- Der GerNetiX-Account verwaltet technische Nutzung: Projekte, Geraete, Lizenzen, Entitlements und Aktivierungen.
- Ein Kauf im Webshop erzeugt nicht automatisch ein GerNetiX-Konto und verknuepft nicht automatisch eine Shop-E-Mail mit einem GerNetiX-Account.

Diese Trennung verhindert, dass Zahlungs-, Rechnungs- und Versanddaten unnoetig in der Identity-Plattform landen.

## E-Mail im Webshop

Der Webshop darf und soll fuer echte Bestellungen eine E-Mail-Adresse erfassen. Sie dient als Kontakt- und Nachweisadresse, nicht als GerNetiX-Login.

Typische Zwecke:

- Bestellbestaetigung
- Rechnung
- Versandstatus
- Rueckfragen, wenn eine Bestellung, Zahlung oder Lieferung scheitert
- Support, Reklamation und Gewaehrleistung
- Versand eines Aktivierungscodes oder einer Bestellreferenz

Der GerNetiX-Login bleibt davon getrennt. GerNetiX kann weiterhin passkey- und accountbasiert arbeiten, ohne dass jede kaufende Person sofort ein technisches Konto braucht.

## Aktivierungscode als Bruecke

Ein Aktivierungscode verbindet einen Kauf mit einem GerNetiX-Account.

Typischer Ablauf:

1. Eine Person kauft im Webshop ein Produkt, eine Lizenz, ein Hardware-Bundle oder ein Premium-Abo.
2. Der Webshop sendet Rechnung, Bestellreferenz und gegebenenfalls einen Aktivierungscode an die angegebene E-Mail-Adresse.
3. Die Person meldet sich in GerNetiX an oder legt dort ein Konto an.
4. Der Aktivierungscode wird in GerNetiX eingegeben.
5. GerNetiX prueft den Code und wandelt ihn in ein Entitlement fuer genau diesen Account um.

Damit bleibt der Webshop fuer Verkauf und Kommunikation zustaendig, waehrend GerNetiX nur die technische Freischaltung verarbeitet.

## Produktbeispiele

| Angebot | Webshop braucht E-Mail | GerNetiX-Account noetig | Aktivierung |
| --- | --- | --- | --- |
| Hardware ohne Lizenz | Ja, fuer Rechnung, Versand und Support | Nein | keine oder optionale Produktregistrierung |
| Hardware-Bundle mit Lizenz | Ja | Spaetestens zur Nutzung | Aktivierungscode per E-Mail oder im Paket |
| GerNetiX Home Server Software-Lizenz | Ja | Ja, zur Aktivierung und Entitlement-Verwaltung | Aktivierungscode |
| Premium monatlich | Ja | Ja | Aktivierungscode oder spaetere direkte Abo-Zuordnung |
| Premium jaehrlich inkl. Home Server | Ja | Ja | Aktivierungscode, der Premium und Home-Server-Nutzung freischaltet |

## Home-Server-Lizenz

Die GerNetiX Home Server Software ist ein gutes Beispiel fuer diese Trennung:

- Der Webshop verkauft das Nutzungsrecht oder ein Hardware-Bundle.
- GerNetiX aktiviert das Nutzungsrecht auf einem Account.
- Eine aktive Lizenz erlaubt Installation, neue Geraete, Konfiguration, Updates, Cloud-Funktionen, KI und neue Integrationen.
- Nach Ablauf bleibt die bestehende lokale Installation funktionsfaehig: bestehende Geraete, MQTT, Home Assistant und OTA fuer bereits eingerichtete Modelle laufen weiter.

Eine abgelaufene Lizenz darf ein lokales Zuhause nicht lahmlegen. Sie beendet nur Erweiterung, neue kostenpflichtige Funktionen und Cloud-/KI-Komfort.

## Sicherheits- und Datenschutzregeln

- Zahlungsdaten gehoeren nicht in den GerNetiX-Identity-Account.
- Shop-E-Mail und GerNetiX-Account werden nicht automatisch gleichgesetzt.
- Aktivierungscodes sind die explizite Zustimmung, einen Kauf einem GerNetiX-Account zuzuordnen.
- Ein Aktivierungscode sollte eindeutig, zeitlich oder nutzungsbezogen begrenzt und nach erfolgreicher Einloesung verbraucht sein.
- Support kann ueber Bestellnummer und Webshop-E-Mail laufen, ohne direkten Zugriff auf den GerNetiX-Account zu benoetigen.

## Konsequenz fuer die UI

- Produkte und Lizenzmodelle sind oeffentlich im Webshop sichtbar.
- Login ist erst fuer Kaufabschluss, Lizenzaktivierung, Downloads, Premium-Nutzung oder Account-Entitlements erforderlich.
- Identity-Hilfe erklaert den Unterschied zwischen Webshop-E-Mail, GerNetiX-Account und Aktivierungscode.
