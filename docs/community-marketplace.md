# Community-Marktplatz fuer gebrauchte Elektronik

## Ziel und Einordnung

Der Shop enthaelt einen getrennten Community-Marktplatz als Kleinanzeigenbereich fuer gebrauchte Elektronik. Mitglieder koennen beispielsweise Mikrocontroller-Boards, Sensoren, Displays, Bauteile, Werkzeuge oder ganze Konvolute anbieten. Projektideen, Quellcode und Projektkopien werden dort nicht verkauft oder veroeffentlicht.

Der Marktplatz ist fachlich weder der GerNetiX Hardware Shop noch ein Zahlungsdienst. GerNetiX stellt Inserat und private Kontaktaufnahme bereit, prueft aber weder Ware noch Anbieter und wickelt Kauf, Zahlung, Versand, Gewaehrleistung oder Streitfaelle in diesem MVP ab.

## Inserat

Ein angemeldetes Mitglied erfasst:

- Artikelbezeichnung und Beschreibung,
- Kategorie und Zustand,
- Preis in Euro,
- optionale Region fuer eine Abholung,
- Versandmoeglichkeit und optionale Tags.

Genaue Adresse, Telefonnummer und Zahlungsdaten gehoeren nicht in das oeffentliche Inserat. Interessenten kontaktieren den Anbieter ueber die teilnehmergeschuetzten privaten Community-Nachrichten. Der Anbieter kann sein Inserat als verkauft markieren; verkaufte Inserate verschwinden aus der allgemeinen Liste.

## Persistenz und Vertrauen

Die Community Platform ist die PostgreSQL-Wahrheit und speichert Inserate in `community_marketplace_listings`. Die technische Account-ID des Anbieters bleibt in der oeffentlichen API verborgen. Jedes Inserat traegt `sale_type: used_electronics` und `verification_state: community_unverified`.

## MVP-Grenzen

Bilder, Bezahlung, Treuhand, Versandlabels, Bewertungen von Kaeufern oder Verkaeufern, automatisierte Moderation und rechtliche Verkaufsabwicklung sind nicht Teil dieses Stands. Der bestehende Hardware Shop mit redaktionellen Angeboten und Bestellungen bleibt fachlich getrennt.
