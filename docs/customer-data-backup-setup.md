# Kundendaten-Sicherung einrichten

Diese Anleitung fuehrt von den fertigen Werkzeugen zum laufenden Betrieb. Sie
ist bewusst als Abfolge einzelner, jeweils pruefbarer Schritte geschrieben:
jeder Schritt nennt, was er bewirkt, welcher Befehl ihn ausfuehrt und woran man
erkennt, dass er gelungen ist.

Die fachliche Zielsetzung steht in
[customer-data-backup-and-recovery.md](customer-data-backup-and-recovery.md),
der Wiederherstellungsablauf in
[customer-data-restore-runbook.md](customer-data-restore-runbook.md).

## Stand

Die Werkzeuge sind gebaut und durch Tests abgedeckt, aber **nichts davon laeuft
bislang automatisch**. Es gibt weder einen Recovery-Key noch ein
Arbeitsverzeichnis, keinen Timer und kein externes Speicherziel.

| Fertig | Fehlt fuer den Betrieb |
| --- | --- |
| Sicherungssatz erzeugen, verschluesseln, pruefen | Recovery-Key erzeugen und verwahren |
| Restore entschluesseln, pruefen, einspielen | planmaessige Ausfuehrung ueber einen Timer |
| Fachliche Restore-Pruefungen | Alarmierung bei Fehlern und zu altem Punkt |
| Container-Nachweis ueber beide Modi | externes, unveraenderbares Speicherziel und Upload |

Die Schritte 1 bis 5 unten machen die Sicherung lokal auf dem VPS lauffaehig.
Schritt 6 und 7 sind noch nicht umgesetzt und brauchen zusaetzliche Arbeit am
Code; sie sind hier nur so weit beschrieben, dass die Reihenfolge klar bleibt.

## Schritt 1: Recovery-Key erzeugen

Ohne diesen Schluessel sind alle Sicherungen absichtlich nicht lesbar. Er wird
**nicht** auf dem VPS erzeugt und liegt dort auch spaeter nie.

```bash
node tools/generate-backup-recovery-key.js --private-key-out /pfad/ausserhalb/des/repos/recovery.key --public-key-out /pfad/ausserhalb/des/repos/recovery.pub
```

Das Werkzeug verweigert einen Zielpfad innerhalb des Repositorys und gibt den
privaten Schluessel niemals nach stdout aus. Es liest beide Dateien sofort
wieder ein; ein Schluesselpaar, das sich nicht fehlerfrei zurueckgelesen laesst,
waere ein stiller Totalverlust.

**Gelungen, wenn:** die Ausgabe eine Schluessel-ID nennt und beide Dateien
existieren, die private mit Rechten `0600`.

**Danach sofort:** den privaten Schluessel auf mindestens zwei getrennte,
verschluesselte Offline-Verwahrorte bringen und die erzeugte Datei vom
Arbeitsrechner loeschen. Ein Passwortmanager allein ist kein zweiter
Verwahrort. Die Schluessel-ID notieren — jeder Sicherungssatz nennt sie, und
ein Restore mit dem falschen Schluessel bricht mit genau dieser Begruendung ab.

## Schritt 2: Oeffentlichen Schluessel auf den VPS bringen

Nur `recovery.pub` gehoert auf den VPS. Ueblicher Ort:

```bash
sudo install -o root -g root -m 0644 recovery.pub /etc/gernetix/backup-recovery.pub
```

**Gelungen, wenn:** die Datei mit einer Zeile beginnt, die
`gernetix-recovery-public-key-v1` lautet, und der private Schluessel nirgends
auf dem VPS liegt.

## Schritt 3: Arbeitsverzeichnis anlegen

Der Orchestrator schreibt ausschliesslich lokal. Das Verzeichnis haelt die
Sicherungssaetze und den Ledger, der die bereits gesicherten Artefakte fuehrt.

```bash
sudo install -d -o root -g root -m 0700 /var/backups/gernetix
```

Die Groesse waechst mit jedem Satz. Solange es kein externes Ziel gibt
(Schritt 6), bleiben alle Saetze hier liegen — das ist ausdruecklich **keine**
Datensicherung im Sinne des Schutzziels, sondern nur die Vorstufe.

## Schritt 4: Erster Sicherungslauf von Hand

Zuerst der taegliche Modus, weil er den gemeinsam konsistenten Punkt erzeugt
und dabei Forgejo kurz stoppt. Der Lauf muss aus dem Verzeichnis heraus
gestartet werden, in dem auch das Deployment laeuft, damit `docker compose`
dasselbe Projekt anspricht; andernfalls `COMPOSE_PROJECT_NAME` setzen.

```bash
node tools/backup-orchestrator.js --mode daily --work-dir /var/backups/gernetix --public-key /etc/gernetix/backup-recovery.pub
```

Die Ausgabe nennt Backup-ID, Modus, Konsistenzart, Objektanzahl, wie viele
Artefakte neu und wie viele uebernommen wurden, sowie die Recovery-Key-ID.

**Gelungen, wenn:** ein Verzeichnis mit der Backup-ID entstanden ist, darin
`SHA256SUMS` und ausschliesslich `.gxb`-Objekte liegen, und Forgejo danach
wieder erreichbar ist. Ein gescheiterter Lauf hinterlaesst kein Verzeichnis und
startet ein gestopptes Forgejo in jedem Fall wieder.

Danach ein stuendlicher Lauf, um die Inkrementalitaet zu sehen:

```bash
node tools/backup-orchestrator.js --mode hourly --work-dir /var/backups/gernetix --public-key /etc/gernetix/backup-recovery.pub
```

**Gelungen, wenn:** der zweite Satz deutlich kleiner ist und in der Zeile
`Artefakte:` uebernommene Objekte ausweist. Forgejo wird dabei nicht gestoppt.

## Schritt 5: Restore-Probe

Erst diese Probe belegt, dass die Sicherung etwas wert ist. Sie laeuft auf
einem Rechner, auf dem der private Recovery-Key kurzzeitig verfuegbar ist —
nicht auf dem VPS.

```bash
node tools/restore-backup-set.js /var/backups/gernetix/<backup-id> --private-key /pfad/zum/recovery.key --target-dir /tmp/restore-probe/bestandteile --store-dir /var/backups/gernetix --artifacts-dir /tmp/restore-probe/artefakte --report /tmp/restore-probe/protokoll.json
```

Danach in eine isolierte Umgebung einspielen und fachlich pruefen; beide
Schritte stehen mit ihren Befehlen im
[Restore-Runbook](customer-data-restore-runbook.md).

**Gelungen, wenn:** das Protokoll `jointly_consistent_restore_point` fuer den
taeglichen Satz auf `true` setzt, alle Artefakte nachgewiesen sind und die
fachliche Pruefung ohne Fehler durchlaeuft. Den Recovery-Key danach wieder vom
Rechner entfernen.

Wer den ganzen Ablauf zuerst gefahrlos sehen will, faehrt den synthetischen
Nachweislauf; er beruehrt keine echten Daten und raeumt vollstaendig auf:

```bash
tools/backup-restore-e2e.sh
```

## Schritt 6: Planmaessige Ausfuehrung und Alarmierung

**Noch nicht umgesetzt.** Ohne diesen Schritt laeuft die Sicherung nur von
Hand. Vorgesehen sind zwei systemd-Timer nach dem Muster, das der VPS fuer die
Sicherheitsueberwachung bereits verwendet
([gernetix-security-alert-monitor.timer](../infra/vps/security/gernetix-security-alert-monitor.timer),
[security-alert-scan.sh](../infra/vps/security/security-alert-scan.sh)):

- ein stuendlicher Timer fuer `--mode hourly`;
- ein taeglicher Timer fuer `--mode daily`, zeitlich so gelegt, dass der kurze
  Forgejo-Stopp in eine ruhige Phase faellt;
- ein Scan-Skript, das Backup-Alter, den letzten Lauf und die Faelligkeit der
  Restore-Probe prueft und einen aggregierten Befund an
  `/api/internal/security-events` meldet, ohne Rohdaten zu uebertragen.

Alarmwuerdig sind laut Zielsetzung: fehlender stuendlicher Sicherungspunkt,
fehlgeschlagener Lauf, fehlendes Object Lock, fehlgeschlagener Pull auf den
privaten Server und ueberfaellige Restore-Probe.

## Schritt 7: Externes, unveraenderbares Speicherziel

**Noch nicht umgesetzt.** Solange dieser Schritt fehlt, liegen alle
Sicherungen auf demselben VPS wie die Daten — der Verlust des VPS bedeutet
weiterhin den Verlust der Sicherungen. Zu tun ist:

1. Bucket mit Object Lock im Compliance-Modus und 400 Tagen Standardretention
   anlegen (Beschaffungsempfehlung in der
   [Zielsetzung](customer-data-backup-and-recovery.md)). Dieser Schritt ist von
   Hand auszufuehren; Zugangsdaten gehoeren nicht ins Repository.
2. Getrennte Zugangsschluessel anlegen: der Schluessel auf dem VPS darf
   ausschliesslich neue Objekte schreiben — kein Loeschen, keine Retention- und
   keine Bucketaenderung.
3. Den providerneutralen Upload-Adapter bauen. Ein Upload gilt erst als
   erfolgreich, wenn das Ziel die Pruefsummen bestaetigt und Object Lock mit der
   erwarteten Retention meldet.
4. Privaten Backup-Server einrichten, der die verschluesselten Saetze mit einem
   ausschliesslich lesenden Schluessel zieht.

## Prueffragen vor der Abnahme

- Liegt der private Recovery-Key an zwei getrennten Verwahrorten und nirgends
  auf dem VPS oder im Repository?
- Erzeugt der VPS stuendlich und taeglich ohne Zutun einen Sicherungssatz?
- Faellt ein Alarm auf, wenn der letzte erfolgreiche Punkt aelter als eine
  Stunde ist?
- Existiert mindestens eine verschluesselte Kopie ausserhalb des VPS, die der
  normale Deployment-Zugang nicht loeschen kann?
- Wurde ein vollstaendiger Restore innerhalb des RTO protokolliert und fachlich
  geprueft?

Erst wenn alle fuenf Fragen mit Ja beantwortet sind, ist der offene Punkt
geschlossen.
