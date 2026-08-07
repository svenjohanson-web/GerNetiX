# Hilfe-Zugriffsstufen

GerNetiX Help unterscheidet drei sichtbar getrennte Bereiche:

- **Oeffentlich:** Produkt-, Einstieg- und Hardwaregrundlagen unter `/hilfe/` ohne Anmeldung.
- **Mit GerNetiX-Konto:** persoenliche Ablaeufe wie Provisionierung, Inventar und Board-Verbindung.
- **Premium-Abo:** vertiefende Projekt- und Umsetzungsinhalte. Die Einleitung darf sichtbar bleiben; an der passenden Stelle folgt eine Paywall.

Die Hilfe-Oberflaeche wertet Account-Entitlements fuer Premium-Inhalte aus. Der eigenständige GerNetiX-Help-Chat verwendet OpenAI `gpt-5-nano` mit einem auf passende Hilfeartikel begrenzten Kontext und verbraucht KI-Credits innerhalb des jeweiligen Kontolimits. Ohne passenden Artikel wird weder OpenAI aufgerufen noch ein Credit reserviert. Projekt- und Code-KI verwenden weiterhin `ai_assistant`; Projekttemplates koennen eigene Technologie-Entitlements verlangen, zum Beispiel `web_push`. Der Identity Server prueft diese Funktionen serverseitig. Der Tarif wird als `subscription_plan` am Konto persistiert. Neu registrierte Konten erhalten `free`; der Demo-Betrieb legt getrennte Basis- und Premium-Demokonten an. `GERNETIX_DEFAULT_ACCOUNT_PLAN` bleibt nur der Kompatibilitaets-Fallback fuer alte Konten ohne gespeicherten Tarif.

Die öffentliche Hilfe erklärt, dass Projekt-, Code- und Help-KI den externen OpenAI-Anbieter und KI-Credits verwenden. Der getrennte Help-Chat beantwortet weiterhin nur Fragen, die durch passende GerNetiX-Hilfeartikel gedeckt sind.

## Noch offene Durchsetzung

Die eigentlichen Premium-Artikel liegen aktuell noch im geschuetzten Plattform-Frontend. Vor dem produktiven Verkauf werden sie in eine serverseitige Artikelauslieferung ueberfuehrt. Der Server liefert den vollstaendigen Premium-Abschnitt dann nur nach einer Entitlement-Pruefung aus; der Browser erhaelt ohne Abo ausschliesslich Titel, Vorschau und Paywall. Die sichtbare Sperre wird dadurch zu einer fachlich durchgesetzten Zugriffskontrolle.

## Konto-, Recovery- und Entitlement-Hilfe

Die oeffentliche Hilfe enthaelt zusaetzlich die Kategorie **Konto und Zugang**. Sie erklaert den Unterschied zwischen Gastzugang, dauerhaftem Passkey-Konto, ESP32-Recovery-Token, Kampagnen-Premium-Token und Premium-Entitlement. Die Artikel trennen sichtbar zwischen dem bereits implementierten Free-/Premium-Entitlement-Modell und dem vorgeschlagenen Zielbild mit Passkeys, Offline-Recovery-Set, Social Recovery, Ressourcenstufen, Background Workern und Dispatchern. Dadurch verspricht die Hilfe keine noch nicht verfuegbaren Funktionen.
