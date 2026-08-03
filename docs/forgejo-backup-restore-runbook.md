# Isolierter Forgejo-Backup-/Restore-Nachweis

## Zweck und harte Grenze

Dieses Runbook ist der Go/No-Go-Vertrag fuer einen Forgejo-Sicherungspunkt aus
`forgejo`-Datenbank und `forgejo_data`. Der Nachweis arbeitet ausschliesslich
mit neu erzeugten synthetischen Daten, einem neuen Compose-Projektnamen und
neuen projektgebundenen Volumes. Er liest oder veraendert keine vorhandenen
Backups, Container, Datenbanken oder Volumes. Er ist weder Deployment noch
Staging-, Cutover- oder Produktionsfreigabe.

Der automatisierte Restore-Helfer akzeptiert nur Projektnamen mit dem Praefix
`gernetix-forgejo-restore-`. Vor dem ersten schreibenden Schritt weist er nach,
dass unter diesem Namen weder Container noch Volumes existieren. Bei einem
Fehler nach Beginn entfernt sein Fehler-Trap ausschliesslich diesen neuen,
synthetischen Compose-Stand samt dessen Volumes.

## Sicherungssatz und Vorpruefung

Ein vollstaendiger Satz besteht exakt aus:

- `forgejo-database.dump`
- `forgejo-data.tar.gz`
- `forgejo-version.txt`
- `SHA256SUMS` mit genau einer SHA-256-Pruefsumme fuer jede der drei Nutzdateien

Die Datenbank und `forgejo_data` stammen aus demselben kontrollierten
Sicherungspunkt: Forgejo ist waehrend beider Exporte gestoppt. Die
Forgejo-Patchversion wird mitgesichert und muss mit dem isolierten Restore-Image
uebereinstimmen. Runtime-Secrets gehoeren nicht in den Satz; fuer einen echten
Disaster-Recovery-Lauf werden sie getrennt gesichert und kontrolliert
bereitgestellt.

`tools/restore-forgejo-backup.sh` prueft vor Docker-Zugriff Vollstaendigkeit,
regulaere Dateien ohne Symlinks, exakte Manifesteintraege, SHA-256, sichere
Archivpfade und die gepinnte Patchversion. Bei falscher Pruefsumme,
unvollstaendig vorliegendem Satz, zusaetzlichen Eintraegen, unsicherem Archiv
oder Versionsabweichung gilt zwingend **NO-GO**; es wird kein Restore-Ziel
angelegt.

## Synthetischer Nachweislauf

Voraussetzungen sind Docker mit Compose, Git, `tar`, `sha256sum` und freier
lokaler Kapazitaet. Der Nachweislauf verwendet die ausschliesslich fuer diesen
Vertrag bestimmte Datei
`tools/forgejo-backup-restore-test.compose.yaml`. Testpasswoerter und -token
sind zufaellig, kurzlebig und duerfen keinen Bezug zu einer GerNetiX-Umgebung
haben.

Der ausfuehrbare End-to-End-Lauf ist bewusst ein gesondertes Gate. Er muss:

1. zwei neue Compose-Projekte mit eindeutigen Namen erzeugen: Quelle und
   leerer Restore;
2. in der Quelle eine synthetische Forgejo-Datenbank, ein privates Repository
   und mindestens zwei nachvollziehbare Commits anlegen;
3. `tools/backup-forgejo.sh` gegen diese Quelle ausfuehren;
4. den Restore-Helfer gegen das nachweislich leere Ziel ausfuehren;
5. das private Repository aus dem Restore neu klonen;
6. Clone-Nachweis, Dateibaum, Datei-Pruefsummen, Branch/HEAD und die vollstaendige
   Commit-Historie bytegleich gegen die Quelle pruefen;
7. die Negativfaelle falsche Pruefsumme und unvollstaendiger Satz ausfuehren
   und belegen, dass vor dem Abbruch kein Restore-Container oder -Volume
   angelegt wurde;
8. im Abschluss beide ausschliesslich synthetischen Compose-Projekte und ihre
   Volumes entfernen.

Solange der End-to-End-Lauf nicht auf einem Docker-faehigen Rechner bestanden
hat, lautet der Status `contract passed, container evidence pending` und nicht
Restore-freigegeben.

## Manuelle Ausfuehrung des Restore-Helfers

Die folgenden Platzhalter muessen auf ein eigenes, synthetisches Verzeichnis
und einen nie zuvor verwendeten Projektnamen zeigen:

```bash
RESTORE_COMPOSE_PROJECT=gernetix-forgejo-restore-<lauf-id> \
RESTORE_COMPOSE_FILE=tools/forgejo-backup-restore-test.compose.yaml \
RESTORE_ENV_FILE=</absoluter/pfad/synthetic.env> \
RESTORE_EXPECTED_FORGEJO_VERSION=15.0.6 \
tools/restore-forgejo-backup.sh </absoluter/pfad/synthetic-backup>
```

Nach erfolgreichem Restore werden fuer die Abnahme separat protokolliert:

| Nachweis | Musswert |
| --- | --- |
| Sicherungssatz | alle vier Dateien, SHA-256 erfolgreich |
| Anwendung | gesicherte und laufende Forgejo-Patchversion identisch |
| Gemeinsamer Stand | Datenbankdump und `forgejo_data` aus demselben gestoppten Quellstand |
| Clone-Nachweis | frischer Clone aus dem Restore erfolgreich |
| Dateibaum | Pfade, Dateitypen und SHA-256 stimmen mit der Quelle ueberein |
| Commit-Historie | Branch, HEAD, Commitanzahl, Elternfolge und Commit-IDs stimmen ueberein |
| Isolation | nur neuer Testprojektname und neue Testvolumes vorhanden |
| Zeit | Start, Ende und gemessene Restore-Dauer dokumentiert |

## Go/No-Go

**GO** ist nur zulaessig, wenn alle Tabellenzeilen belegt sind, alle positiven
Pruefungen bestehen, beide Negativfaelle vor jeder Mutation abbrechen und keine
Abweichung offen ist. Dieser GO bestaetigt allein die technische
Wiederherstellbarkeit des getesteten Forgejo-Satzes; er autorisiert keine
Umschaltung eines Zielsystems.

**NO-GO** gilt bei fehlender oder falscher Pruefsumme, unvollstaendig oder
unerwartet zusammengesetztem Satz, abweichender Forgejo-Version, nicht leerem
Ziel, Restore-/Healthfehler sowie jeder Abweichung bei Clone, Dateibaum oder
Commit-Historie. Der Satz bleibt unveraendert, der Befund wird protokolliert
und es erfolgt keine Zielumschaltung.

## Rollback und sichere Abbrueche

Vor Beginn besteht Rollback aus einem reinen Abbruch: Da die Vorpruefung vor
Docker laeuft, existiert noch kein Zielzustand. Nach Beginn entfernt der
Restore-Helfer bei Fehlern nur Container, Netz und Volumes des exakt
validierten neuen Restore-Projektnamens. Er verwendet keine globalen
Docker-Aufraeumoperationen und adressiert kein fremdes Volume.

Nach erfolgreichem Nachweis bleibt der synthetische Restore bis zum Abschluss
der Clone-/Baum-/Historienpruefung stehen. Erst danach wird er mit exakt seinem
Compose-Projektnamen entfernt. Ein echter Wiederanlauf verwendet einen
separaten, freigegebenen Betriebsablauf; dieses Runbook nimmt niemals einen
vorhandenen Stand zurueck und fuehrt keinen Cutover aus.

## Zu protokollierendes Ergebnis

- Lauf-ID und UTC-Zeitfenster
- Git-Commit dieses Vertrags
- synthetische Quell- und Restore-Projektnamen
- Forgejo-Version und SHA-256-Ergebnis
- Datenbank-, Volume-, Clone-, Dateibaum- und Historienergebnis
- Ergebnisse beider sicheren Negativabbrueche
- gemessene Dauer gegen RTO, ohne daraus einen produktiven RPO-Nachweis
  abzuleiten
- GO oder NO-GO, Abweichungen und verantwortliche Pruefperson

Keine Passwoerter, Tokens, Clone-Credentials oder anderen Secrets werden in
den Nachweis aufgenommen.

## Lokaler Nachweisstand

Am 2026-08-03 bestand der vollstaendige synthetische Containerlauf lokal mit
Forgejo 15.0.6 und PostgreSQL 17. Datenbank und `forgejo_data` wurden aus
demselben gestoppten Quellstand gesichert und in einen leeren, neu benannten
Compose-Stand eingespielt. Frischer privater Clone, Branch, HEAD, Dateibaum,
Dateiinhalte und die deterministische Zwei-Commit-Historie stimmten ueberein.
Ein Satz mit falscher Pruefsumme und ein unvollstaendiger Satz brachen jeweils
vor Anlage eines Restore-Volumes ab. Die abschliessende Docker-Abfrage fand
keine Container oder Volumes der synthetischen Quell- und Restore-Projekte.

Dieser lokale GO ist der technische Vertragsnachweis. Er ist ausdruecklich
kein Nachweis fuer externe Verschluesselung, produktives RPO/RTO, Staging oder
einen Cutover.
