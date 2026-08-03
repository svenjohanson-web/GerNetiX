# Isolierter Forgejo-Container-Integrationstest

## Zweck und Grenze

Dieser Harness weist den Forgejo-/Git-Vertrag des Project Servers gegen das
gepinnte Forgejo-Image nach. Er ist ausschließlich für lokale, kurzlebige
synthetische Testdaten bestimmt. Er verwendet weder Staging noch die
VPS-Compose-Datei, vorhandene Dev-Daten oder vorhandene Volumes und führt
keinen Cutover aus.

Der Runner erzeugt für jeden Lauf einen eigenen Compose-Projektnamen. Alle
drei Volumes (PostgreSQL, Forgejo und Testzustand) sowie das interne Netzwerk
werden dadurch unter diesem Namen neu erzeugt. Es gibt keine Host-Portbindung.
Ein einmaliger Init-Container setzt nur den Besitzer des neuen Testzustands-
Volumes; er besitzt neben `CHOWN` keine Capability. Der eigentliche Adaptertest
läuft read-only, capability-frei und als UID 1000.
Ein Exit-Trap entfernt die Testcontainer, lokal gebaute Testimages, das
Netzwerk und alle drei Volumes auch bei einem fehlgeschlagenen Nachweis.

## Ausführung

Voraussetzungen sind ein laufender lokaler Docker-Daemon mit Docker Compose
und Zugriff auf die in `tools/forgejo-integration/compose.yaml` gepinnten
Images. Aus dem Repository-Wurzelverzeichnis:

```sh
tools/forgejo-integration/run.sh
```

Der Lauf baut einen kleinen Node-/Git-Testcontainer. Dieser enthält die
unveränderten Repository-Adapter aus
`services/project-server/src/repository-store/`; das Testskript ersetzt weder
Forgejo noch Git durch Stubs.

## Automatisierter Nachweis

Der Harness prüft:

1. Erreichbarkeit von Forgejo ausschließlich aus dem internen Compose-Netz.
2. Anlage einer privaten synthetischen Organisation und eines privaten
   Projekt-Repositorys über die Forgejo-API.
3. Initialcommit sowie Lesen von Unicode und einer leeren Datei.
4. Schreiben/Ändern, Git-erkanntes Rename und Delete über den echten
   Project-Server-Adapter.
5. Ablehnung eines veralteten `expected_head_sha` einschließlich erwartetem
   und tatsächlichem Head.
6. Persistenz von privatem Repository, Head und Dateiinhalt nach Neustart nur
   des Forgejo-Testcontainers.
7. Erfolgreiche Anmeldung der Rolle `forgejo` an der Testdatenbank `forgejo`
   und abgewiesene Anmeldung derselben Rolle an `gernetix_runtime`.
8. Vollständiges Entfernen aller containerspezifischen Testressourcen.

Die Zugangsdaten sind feste oder laufbezogen erzeugte synthetische Werte und
dürfen außerhalb dieses kurzlebigen Teststands nicht verwendet werden. Der
Zugriffstoken wird weder ausgegeben noch in das Repository geschrieben.

## Ergänzender Contract-Test

`tools/forgejo-integration/contract.test.js` prüft ohne Docker-Daemon die
Isolation, gepinnten Images, Cleanup-Regel, Adaptereinbindung, geforderten
CRUD-/Konflikt-/Neustartpfade und den negativen Datenbankvertrag. Er ersetzt
den Containerlauf nicht, schützt aber dessen sicherheitsrelevante Struktur.

## Nachweisstand 2026-08-03

- Contract-Test: drei Tests lokal bestanden.
- Compose-Konfiguration: mit gesetzten synthetischen Pflichtwerten lokal
  erfolgreich aufgelöst.
- Echter Containerlauf: lokal vollständig bestanden. Nachgewiesen wurden
  interne Erreichbarkeit, privates Repository, Initialcommit, Lesen,
  Schreiben, Rename, Delete, erwarteter Head-Konflikt, Persistenz nach
  Forgejo-Neustart und die Abweisung der Forgejo-Rolle durch
  `gernetix_runtime`.
- Cleanup: Testcontainer, lokal gebaute Testimages, Testnetz und alle drei
  Testvolumes wurden nach dem Lauf entfernt und anschließend als abwesend
  verifiziert.
- SQLite-Graph und zentrale Forgejo-Statusdokumente: unverändert, weil dieser
  Arbeitsstrang ausschließlich den isolierten Gate-1-Nachweis bereitstellt.
