# Unveränderliche Projektvorlagen und Accountkopien

Der Project Server führt vollständige Beispielprojekte als systemeigene Projekte mit dem Status `template`. Quellen, Buildkonfiguration und Board-Snapshot liegen damit getrennt von öffentlichen Firmware-Releases in PostgreSQL.

Beim Start eines Beispielprojekts entsteht atomar ein neues, accountgebundenes Projekt. Der Project Server kopiert die Quellen und Buildkonfiguration und speichert unter `view_manifest.template_ref` die Vorlagen-ID, Version und den SHA-256-Hash des Ausgangsstands. Danach können ausschließlich die Accountquellen verändert und gebaut werden.

Systemvorlagen dürfen weder aktualisiert noch gelöscht werden. Änderungen am redaktionellen Beispiel erzeugen eine neue Vorlagenversion. Bereits angelegte Accountprojekte wechseln niemals automatisch auf eine neue Version.

Das öffentliche USB-Angebot bleibt davon getrennt: Dort wird ausschließlich ein unveränderliches Binary-Release veröffentlicht. Das zugehörige Source-Beispiel wird in der Entwicklungsumgebung aus der versionierten Project-Server-Vorlage kopiert.

Die Touchscreen-Spielesammlung verwendet ab Vorlagenversion 2 den vollständigen ES3C28P-Source einschließlich Display-, Touch- und Spieleimplementierung sowie einen aufgelösten Boardkonfigurations-Snapshot. Das frühere Modellprojekt mit leeren Renderfunktionen ist keine flashbare Beispielanwendung.
