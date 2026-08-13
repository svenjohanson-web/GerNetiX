# Zugriffsmodell der Wissensbibliothek

Stand: 2026-08-13 · Status: verbindlicher Produkt- und Zugriffsvertrag

## Ziel

Ein Wissensbuch ist die kleinste verkaufbare Einheit der Bibliothek. Es ist
unabhaengig vom darunterliegenden Themen- und Kapitelbaum und besitzt genau
einen Zugriffsmodus:

| Modus | Kundenzugang | Berechtigung |
| --- | --- | --- |
| `free` | vollstaendig kostenlos | keine |
| `subscription` | waehrend eines aktiven Wissens-Abos | `knowledge_library` |
| `purchase` | dauerhaft nach Einzelkauf | buchbezogene Berechtigung, zum Beispiel `knowledge_book_software_systems` |

Ein Abo verleiht keine dauerhaften Einzelkaufrechte. Ein Einzelkauf bleibt
nach Ende eines Abos erhalten. Preise, Steuern, Rueckerstattungen und die
Zahlungsabwicklung werden erst mit dem Commerce-Umfang festgelegt; die
Freigabe wird dann ausschliesslich serverseitig als Berechtigung vergeben.

## Kostenlose Vorschau

Jedes nicht kostenlose Buch bleibt im Katalog sichtbar. Ohne passende
Berechtigung sind Zusammenfassung und der erste Abschnitt jedes Kapitels als
Leseprobe sichtbar; alle weiteren Abschnitte werden gesperrt dargestellt.
Kostenlose Buecher besitzen keine Sperre und keine kuenstliche Vorschaugrenze.

## Technische Schutzgrenze

Alle vollstaendigen Bibliotheksinhalte gelten technisch gleichartig als
geschuetzt. Auch ein kostenloses Buch liefert seinen Volltext erst nach einer
gueltigen Anmeldung. Anonym erreichbar bleiben nur Katalogdaten und die
ausdruecklich definierte Leseprobe. `free`, `subscription` und `purchase`
bestimmen daher nicht, ob ein Inhalt technisch geschuetzt wird, sondern nur,
welche serverseitige Berechtigung nach der Anmeldung fuer den Volltext gilt.

Identity leitet Konto und Berechtigungen ausschliesslich aus der serverseitigen
Sitzung ab. Der Browser erhaelt nur das aktuell geoeffnete Kapitel, laedt keine
geschuetzten Nachbarkapitel vor und kann durch veraenderte UI- oder
Entitlementwerte keinen groesseren Antwortumfang erzwingen. Direkte statische
Abrufe der authored oder generierten Kapiteldateien sind gesperrt.

## Aktuelle Katalogzuordnung

| Buch | Modus |
| --- | --- |
| Entwicklungsprozesse | kostenlos |
| Elektrotechnik und Schaltungen | Einzelkauf |
| Mikrocontroller und Embedded | Abo |
| Software und Systeme | Einzelkauf |
| Vernetzung, KI und Sicherheit | Abo |
| Technisches Lexikon | kostenlos |

Die Bibliotheksoberflaeche zeigt den Modus und den jeweiligen naechsten Schritt
direkt am Buch. Kapitel-Historie und Lesebestaetigungen verwenden dieselben
Berechtigungen, damit keine gesperrten Neuigkeiten erscheinen.
