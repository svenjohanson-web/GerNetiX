# Hilfe-Zugriffsstufen

GerNetiX Help unterscheidet drei sichtbar getrennte Bereiche:

- **Oeffentlich:** Produkt-, Einstieg- und Hardwaregrundlagen unter `/hilfe/` ohne Anmeldung.
- **Mit GerNetiX-Konto:** persoenliche Ablaeufe wie Provisionierung, Inventar und Board-Verbindung.
- **Premium-Abo:** vertiefende Projekt- und Umsetzungsinhalte. Die Einleitung darf sichtbar bleiben; an der passenden Stelle folgt eine Paywall.

Die Hilfe-Oberflaeche wertet Account-Entitlements aus. KI-Chats verwenden `ai_assistant`; Projekttemplates koennen eigene Technologie-Entitlements verlangen, zum Beispiel `web_push`. Der Identity Server prueft diese beiden Funktionen serverseitig. Im aktuellen Demo-Betrieb besitzt das Standardkonto weiter Premium-Zugriff; mit `subscription_plan` am Konto oder `GERNETIX_DEFAULT_ACCOUNT_PLAN` kann zwischen `Kostenlos` und `Premium` unterschieden werden.

Die oeffentliche Hilfe erklaert bei gesperrten KI-Chats, dass derzeit externe KI-Anbieter Kosten verursachen. Sie verweist zugleich darauf, dass GerNetiX weiter an kostenguenstigeren und lokalen Loesungen fuer einen spaeteren kostenlosen Zugang arbeitet.

## Noch offene Durchsetzung

Die eigentlichen Premium-Artikel liegen aktuell noch im geschuetzten Plattform-Frontend. Vor dem produktiven Verkauf werden sie in eine serverseitige Artikelauslieferung ueberfuehrt. Der Server liefert den vollstaendigen Premium-Abschnitt dann nur nach einer Entitlement-Pruefung aus; der Browser erhaelt ohne Abo ausschliesslich Titel, Vorschau und Paywall. Die sichtbare Sperre wird dadurch zu einer fachlich durchgesetzten Zugriffskontrolle.
