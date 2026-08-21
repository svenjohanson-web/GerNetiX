# Sicherung und Wiederherstellung von Kundendaten

## Ziel

Accountgebundene Kundendaten duerfen weder durch ein fehlerhaftes Deployment noch durch versehentliches Loeschen dauerhaft verloren gehen. Dazu gehoeren insbesondere Accounts und Berechtigungen, Projekte und Projektquellen, Hardware-Inventar und Pairings, Lernfortschritt, Bestellungen und Ansprueche, Consents sowie kundenbezogener KI-Kontext.

Fuehrende Quellen sind die GerNetiX-Domaenendatenbank `gernetix_runtime`, nach
dem Projekt-Cutover die Forgejo-Datenbank `forgejo` samt Repository-Volume und
der Artifact Store. Ein PostgreSQL-Dump allein umfasst dann nicht mehr alle
Projektdateien. Forgejo-Datenbank und Git-Repositories muessen als
konsistenter gemeinsamer Sicherungspunkt behandelt werden.

Ein persistentes Docker-Volume allein ist keine Datensicherung. Es schuetzt vor einem normalen Container-Austausch, aber nicht vor logischem Loeschen, `down -v`, defekten Volumes, Fehlbedienung, kompromittierten Zugangsdaten oder dem Ausfall des VPS.

Die Sicherung ist unabhaengig von der
[elastischen Worker- und Kapazitaetsarchitektur](elastic-worker-capacity-architecture.md).
Ein Compute- oder Kubernetes-Provider ist niemals Backup-Owner und darf weder
Retention noch bestehende Sicherungssaetze loeschen. Private und kurzlebige
Worker-Caches werden nicht gesichert.

## Verbindliche Schutzziele

- RPO: Hoechstens eine Stunde bestaetigter Kundendaten darf im Katastrophenfall fehlen.
  Fuer Projektdateien gilt zusaetzlich: der garantiert gemeinsam konsistente
  Sicherungspunkt aus Forgejo-Datenbank und Repository-Volume entsteht taeglich.
  Die stuendlichen Saetze enthalten Forgejo ebenfalls, aber aus dem laufenden Betrieb.
- RTO: Innerhalb von vier Stunden muss ein konsistenter, nutzbarer Stand wiederhergestellt werden koennen.
- Aufbewahrung: mindestens 48 stuendliche, 30 taegliche und 12 monatliche Wiederherstellungspunkte.
- Trennung: Mindestens eine verschluesselte Kopie liegt ausserhalb des VPS und ausserhalb des Deployment-Lebenszyklus. Der normale Deployment-Account darf sie nicht loeschen oder ueberschreiben.
- Nachweis: Mindestens vierteljaehrlich und nach wesentlichen Persistenz-Aenderungen wird eine Wiederherstellung in einer isolierten Umgebung geprobt.
- Alarmierung: Fehlgeschlagene Sicherungen, ein zu alter letzter erfolgreicher Sicherungspunkt und fehlgeschlagene Restore-Pruefungen erzeugen einen sichtbaren Betriebsalarm.

## Zu sichernder fachlicher Umfang

Die Sicherung wird aus den fachlichen Quellen der Wahrheit abgeleitet und nicht aus Browser-State, Caches oder generierten Sichten:

| Datenbereich | Fuehrende Persistenz | Beispiele |
| --- | --- | --- |
| Alle Laufzeitdomaenen | PostgreSQL `gernetix_runtime` in `runtime_postgres_data` | `identity_*`, `project_*`, `telemetry_*`, `community_*`, `device_management_*`, `ai_usage_*`, `hardware_catalog_*`, `hardware_shop_*`, `operations_*`, `ai_context_*`, weitere Domaenentabellen und verschluesselter Runtime-State |
| Projektdateien und Historie | Forgejo-Datenbank `forgejo` plus `forgejo_data` | private Projektrepositories, Commits, Baeume, Tags und Forgejo-Verwaltungsmetadaten |
| Wiederaufbau-relevante Artefakte | verwalteter, content-addressed Artifact Store plus Referenzmetadaten in PostgreSQL `gernetix_runtime` | Plattform-Releases, Account-Assets, Public-Demo-Releases und Build-Artefakte, die nicht deterministisch neu erzeugt werden koennen; die SQL-Referenz enthaelt mindestens Hash, Groesse, Quellpfad und unveraenderliche Quellversion |

Jeder neue Service mit dauerhafter SQL-Persistenz muss vor Produktivsetzung entweder in diesen Sicherungsumfang aufgenommen oder ausdruecklich als vollstaendig reproduzierbar klassifiziert werden.

## Sicherungsregeln

1. Verbliebene SQLite-Dateien sind ausschliesslich schreibgeschuetzt eingebundene Migrationsquellen und keine fuehrende Persistenz mehr. Wird eine davon wieder schreibend genutzt, ist sie transaktionskonsistent ueber die SQLite-Backup-API zu sichern; eine rohe Dateikopie waehrend Schreibzugriffen ist nicht ausreichend.
2. PostgreSQL wird mit einem konsistenten logischen oder physischen Backup-Verfahren gesichert. Datenbank und erforderliche Rollen-/Schema-Informationen muessen gemeinsam wiederherstellbar sein.
3. Forgejo wird stuendlich im laufenden Betrieb gesichert und einmal taeglich fuer den
   gemeinsam konsistenten Sicherungspunkt kontrolliert gestoppt; danach werden seine
   Datenbank und `forgejo_data` gemeinsam gesichert und der Dienst garantiert wieder
   gestartet. Jeder Sicherungssatz nennt im Manifest, mit welcher Konsistenzart er
   erzeugt wurde. Ein Online-Satz ist ein gueltiger Wiederherstellungspunkt fuer
   Kundendaten, aber nicht der belastbare Ausgangspunkt fuer den vollstaendigen
   Wiederaufbau der Projektdateien; dafuer gilt der letzte taegliche Satz. Ein
   stuendlicher gemeinsam konsistenter Punkt benoetigt einen ausdruecklich
   nachgewiesenen Online-Snapshotvertrag.
4. Jeder Sicherungssatz enthaelt Manifest, Erstellungszeit, Quellinstanz, Schema-/Anwendungsversion, enthaltene Datenbereiche, Groesse und kryptografische Pruefsumme.
5. Sicherungen werden bei Transport und Speicherung verschluesselt. Entschluesselungsschluessel werden getrennt vom Backup-Speicher und vom normalen Deployment-Zugang verwaltet.
6. Vor einem Deployment mit Persistenzmigration oder erhoehtem Datenrisiko wird ein frischer, erfolgreich gepruefter Wiederherstellungspunkt verlangt. Das Deployment darf keine Volumes loeschen oder neu initialisieren.
7. Aufbewahrungsloeschungen erfolgen ausschliesslich ueber die definierte Retention. Ein kompromittierter Service- oder Deployment-Zugang darf vorhandene Sicherungen nicht unmittelbar entfernen koennen.
8. Datenschutzrechtliche Loeschpflichten werden durch eine dokumentierte Backup-Retention und kontrollierte Wiederherstellung beruecksichtigt. Ein Restore darf bereits wirksam geloeschte Datensaetze nicht unkontrolliert wieder produktiv sichtbar machen.
9. Das Backup-Ziel wird ueber einen providerneutralen, versionierten Vertrag
   angesprochen. Ein S3-kompatibles Ziel ist zulaessig, sofern Verschluesselung,
   getrennte Credentials, Retention beziehungsweise Object Lock, Pruefsummen
   und ein getesteter vollstaendiger Restore nachgewiesen sind.
10. Cloud-Burst-, Worker- und Deployment-Credentials erhalten keine Loesch- oder
   Retention-Rechte auf dem Backup-Ziel. Der Capacity Controller kann
   Backup-Alarme lesen, aber keine Sicherungen administrieren.

## Konkrete Zielarchitektur: gemieteter Speicher plus privater Server

GerNetiX verwendet das **3-2-1-Prinzip**: den produktiven Stand auf dem VPS,
eine verschluesselte externe Hauptkopie und eine zweite, privat betriebene Kopie.
Der private Server ergaenzt die externe Hauptkopie; er ersetzt sie nicht. Ein
Brand, Diebstahl, Ransomware oder ein laengerer Internetausfall am privaten
Standort darf den RPO-/RTO-Vertrag deshalb nicht gefaehrden.

```text
GerNetiX-VPS
  |  stuendlich: konsistenter, clientseitig verschluesselter Sicherungssatz
  v
S3-Object-Storage mit Object Lock (Hauptkopie, unveraenderbar)
  |  taeglich: read-only Pull, keine Verbindung vom VPS zum Privatserver
  v
Privater Backup-Server (zweite Kopie, lokale Snapshots)
  |
  +-- optional monatlich: verschluesselte Offline-Festplatte ausser Haus
```

### Empfohlene Beschaffung

1. **Hauptkopie: S3-kompatibler Object Storage mit Object Lock im
   Compliance-Modus.** Als konkrete, aktuell passende Option ist Backblaze B2
   geeignet: Object Lock verhindert das Aendern oder Loeschen bis zum Ende der
   Retention; im Compliance-Modus kann sie nicht durch einen Schluessel des
   Backup-Clients aufgehoben werden. Der Bucket wird einmalig mit Object Lock
   angelegt und erhaelt eine Standardretention von **400 Tagen**. Das deckt den
   Jahreszyklus mit Reserve ab. Ein Zugriffsschluessel auf dem VPS darf nur neue
   Objekte schreiben; er darf weder Bucketeinstellungen noch Retention aendern
   oder Objekte loeschen.
2. **Private Kopie: vorhandener Mini-PC, NAS oder kleiner Server mit zwei
   separaten Datentraegern.** Der Server baut nur ausgehend eine Verbindung zum
   Object Storage auf und spiegelt die verschluesselten Sicherungssaetze mit
   einem ausschliesslich lesenden Schluessel. Der VPS kennt weder seine Adresse
   noch seine Zugangsdaten. Lokale ZFS-/btrfs-Snapshots oder ein vergleichbarer
   Snapshotmechanismus halten mindestens 30 Tage vor; der Speicher wird mit
   Vollplattenverschluesselung betrieben.
3. **Alternative ohne Object Storage:** Eine Hetzner Storage Box unterstuetzt
   BorgBackup, SSH-Schluessel und einen Append-only-Modus. Das ist eine gute
   europaeische, unkomplizierte Kopie, erreicht allein jedoch nicht die gleiche
   providerseitige Unveraenderbarkeit wie S3 Object Lock. Sie ist daher eine
   moegliche zusaetzliche Kopie oder die pragmatische Einstiegsvariante, nicht
   die bevorzugte Hauptkopie fuer den verbindlichen Schutz gegen einen
   kompromittierten VPS.

Die genaue Speicherklasse wird nach der Erstmessung bestimmt: mindestens das
2,5-Fache der aktuellen Summe aus Datenbank, Forgejo-Repositories und
aufbewahrungspflichtigen Artefakten, zuzueglich Wachstum fuer zwoelf Monate.
Keine Datenbank und kein Docker-Volume darf auf dem gemieteten Netzspeicher
betrieben werden; er dient ausschliesslich als Backup-Ziel.

### Sicherungssatz und Ablauf

Der isolierte `backup-orchestrator` ([tools/backup-orchestrator.js](../tools/backup-orchestrator.js))
ist ein `operator_maintenance`-Prozess und kein Teil eines Kundenjobs. Er laeuft
stuendlich, schreibt ausschliesslich in ein lokales temporäres Verzeichnis und
beendet den Lauf erst nach einem Integritaetscheck. Ein gescheiterter Lauf
hinterlaesst keinen unvollstaendigen Satz und startet ein gestopptes Forgejo in
jedem Fall wieder.

```sh
node tools/backup-orchestrator.js --mode hourly --work-dir /var/backups/gernetix
node tools/backup-orchestrator.js --mode daily  --work-dir /var/backups/gernetix
```

| Bestandteil | Konsistente Erzeugung | Rhythmus |
| --- | --- | --- |
| `gernetix_runtime` | PostgreSQL Custom-Dump plus Rollen-/Schema-Metadaten | stuendlich |
| Forgejo (online) | `forgejo` dumpen und `forgejo_data` im laufenden Betrieb archivieren; im Manifest als `online_snapshot` gekennzeichnet | stuendlich |
| Forgejo (gemeinsam konsistent) | Forgejo kontrolliert stoppen, `forgejo` dumpen und `forgejo_data` gemeinsam archivieren, danach Dienst garantiert wieder starten; im Manifest als `stopped_service_snapshot` gekennzeichnet | taeglich |
| Artifact Store | alle seit dem letzten bestaetigten Punkt geaenderten, hash-geprueften Objekte plus SQL-Referenzen | stuendlich |
| Secrets fuer Wiederanlauf | getrenntes, mit Recovery-Public-Key verschluesseltes Paket: Forgejo-Secret, Datenbankrollen, interne Signierschluessel, Device-CA und OTA-Schluessel | bei Aenderung und monatlich vollstaendig |

Jeder Satz wird vor dem Upload mit einem nur offline verwahrten Recovery-Key
verschluesselt. Der VPS besitzt lediglich dessen oeffentlichen Schluessel. Das
Manifest selbst liegt verschluesselt vor und enthaelt Backup-ID, Zeit, Anwendung-
und Schemaversionen, enthaltene Bereiche, Konsistenzart je Bestandteil, Groessen
und SHA-256-Pruefsummen.

Verschluesselt wird mit X25519 und AES-256-GCM
([tools/backup/recovery-key.js](../tools/backup/recovery-key.js)): pro Bestandteil
ein ephemeres Schluesselpaar, daraus ein Sitzungsschluessel, der Inhalt in
authentifizierten Chunks mit einem abschliessenden Endblock. Vertauschen, Kuerzen
und Anhaengen sind dadurch erkennbar. Der Sicherungssatz haelt fuer jeden
Bestandteil sowohl den Hash des Klartextes als auch den des verschluesselten
Objekts: der erste beweist beim Restore, dass genau das zurueckkommt, was
gesichert wurde, der zweite sichert Transport und Speicherung und ist ohne
Recovery-Key pruefbar. Die unverschluesselte Pruefsummenliste `SHA256SUMS`
enthaelt deshalb ausschliesslich Hashes der verschluesselten Objekte.

Der Recovery-Key wird mit
[tools/generate-backup-recovery-key.js](../tools/generate-backup-recovery-key.js)
erzeugt. Das Werkzeug verweigert es, den privaten Schluessel im Repository
abzulegen, und gibt ihn niemals nach stdout aus.
Der Upload ist erst erfolgreich, wenn das Ziel die Pruefsummen bestaetigt und
Object Lock mit der erwarteten Retention meldet. Danach kann das lokale
Arbeitsverzeichnis geloescht werden.

Der private Server zieht danach die neuen, bereits verschluesselten Objekte
vom externen Speicher. Ein erfolgreicher Pull prueft Objektanzahl und
Pruefsummen, meldet aber keine Inhalte oder Secrets. Fällt der private Server
aus, bleibt die externe Hauptkopie wirksam und es wird ein Betriebsalarm
ausgeloest.

### Getrennte Rechte und Schluessel

| Rolle | Ort | Rechte |
| --- | --- | --- |
| Backup-Writer | VPS | neue Sicherungssaetze schreiben; kein Loeschen, keine Retention- oder Bucket-Aenderung |
| Backup-Reader | privater Server | Sicherungssaetze lesen und pruefen; kein Schreiben oder Loeschen |
| Backup-Administrator | getrenntes Betreiberkonto mit MFA | Object-Lock- und Retention-Konfiguration verwalten; nicht im Deployment hinterlegt |
| Recovery-Key | offline, mindestens zwei getrennte Verwahrorte | Sicherungssaetze und Secret-Paket entschluesseln; nie auf dem VPS |

Der Recovery-Key wird als zwei separat verwahrte, dokumentierte Kopien
gehalten. Ohne ihn sind die Sicherungen absichtlich nicht lesbar. Ein
Passwortmanager allein ist kein zweiter Verwahrort.

### Restore und Betriebsnachweis

Ein Restore liest immer zuerst aus der externen Hauptkopie in eine isolierte
Umgebung. Der private Server wird mindestens quartalsweise als zweite Quelle
getestet. Die Probe prueft PostgreSQL, Forgejo-Repository und Artifact-Hashes
sowie die Beziehungen Account -> Projekt -> Repository -> Build-Artefakt.
Sie dokumentiert Dauer, Wiederherstellungspunkt und Abweichungen. Ein Alarm
entsteht bei fehlendem stuendlichen Sicherungspunkt, fehlendem Object Lock,
fehlgeschlagenem privaten Pull oder ueberfaelliger Restore-Probe.

```sh
node tools/restore-backup-set.js <satz-verzeichnis> \
  --private-key <pfad-zum-offline-recovery-key> \
  --target-dir  <leeres-isoliertes-arbeitsverzeichnis> \
  --store-dir   <verzeichnis-mit-allen-saetzen> \
  --report      <protokoll.json>
```

Weil der Artifact Store inkrementell gesichert wird, enthaelt ein einzelner Satz
nicht alle Objekte. [tools/restore-backup-set.js](../tools/restore-backup-set.js)
zieht die uebernommenen Objekte aus den Saetzen nach, die das Manifest benennt,
prueft jedes gegen seinen eigenen Inhaltshash und lehnt den
Wiederherstellungspunkt ab, sobald ein benoetigter Satz oder ein Objekt fehlt.
Ein unvollstaendiger Punkt gilt nie als Erfolg.

Nach dem Einspielen in die isolierte Umgebung folgen die fachlichen Pruefungen
mit [tools/check-restored-runtime.js](../tools/check-restored-runtime.js). Sie
laufen ausschliesslich gegen ein Compose-Projekt, dessen Name mit
`gernetix-restore-` beginnt, und pruefen Accounts, verwaiste Projekt-, Artefakt-,
Pairing- und Bestellbeziehungen, die Vollstaendigkeit der Repository-Bindung und
das Hardware-Inventar. Zeilenzahlen werden gegen den Stand zum
Sicherungszeitpunkt gehalten; ein fehlender Vergleichswert wird als solcher
ausgewiesen und gilt nicht als bestanden.

## Wiederherstellungsablauf

1. Vorfall eingrenzen und weitere Schreibzugriffe stoppen.
2. Gewuenschten Wiederherstellungspunkt anhand Manifest, Zeit und Pruefsumme auswaehlen.
3. Sicherung zuerst in eine isolierte Umgebung einspielen; nie ungeprueft direkt ueber den produktiven Stand schreiben.
4. Datenbankintegritaet, Migrationen und fachliche Referenzen pruefen, insbesondere `user_id`, Projektzuordnung, AccountDevice-/Pairing-Beziehungen und kundenbezogene Grants.
5. Stichproben oder automatisierte Abgleiche fuer Account, Projekt,
   Repository-Bindung, erwarteten Commit, Projektdatei, benannte Version,
   Build-Artefaktreferenz und Hardware-Inventar ausfuehren.
6. Freigabe und Verantwortlichen dokumentieren, danach kontrolliert umschalten.
7. Vorfall, Datenluecke, verwendeten Sicherungspunkt und Nachweis auditieren und den Kunden transparent informieren, falls Daten betroffen waren.

## Abnahmekriterien

- Der Verlust des gesamten VPS oder aller produktiven Volumes kann aus einer externen Sicherung wiederhergestellt werden.
- Ein fehlerhaftes Deployment mit logisch geloeschten Projekten oder Inventareintraegen kann auf einen Stand innerhalb des RPO zurueckgesetzt werden.
- Ein Restore erhaelt stabile Account-, Projekt- und Device-IDs sowie deren Beziehungen.
- Die Wiederherstellung wird innerhalb des RTO abgeschlossen und durch Integritaets- und fachliche Contract-Checks nachgewiesen.
- Backup-Monitoring erkennt einen mehr als eine Stunde alten letzten erfolgreichen Kundendaten-Sicherungspunkt.
- Ein Restore-Test ist mit Zeitpunkt, Sicherungssatz, Ergebnis und festgestellten Abweichungen nachvollziehbar.

## Umsetzungsstatus

Diese Datei definiert die verbindliche fachliche und betriebliche Zielsetzung.
Benannte Docker-Volumes bestehen bereits, sind aber allein kein Nachweis fuer
Backup oder Wiederherstellbarkeit.

Umgesetzt und durch Tests abgedeckt ist die lokale Erzeugung und Pruefung eines
vollstaendigen, verschluesselten Sicherungssatzes:

| Baustein | Ort | Nachweis |
| --- | --- | --- |
| Recovery-Key und Hybridverschluesselung | [tools/backup/recovery-key.js](../tools/backup/recovery-key.js) | [recovery-key.test.js](../tools/backup/recovery-key.test.js) |
| Manifest mit Konsistenzarten und Pflichtbereichen | [tools/backup/backup-manifest.js](../tools/backup/backup-manifest.js) | [backup-manifest.test.js](../tools/backup/backup-manifest.test.js) |
| Sicherungssatz mit Doppelhash und Pruefsummenliste | [tools/backup/backup-set.js](../tools/backup/backup-set.js) | [backup-set.test.js](../tools/backup/backup-set.test.js) |
| Orchestrierung inklusive Forgejo-Rhythmus und inkrementellem Artifact Store | [tools/backup/orchestrator.js](../tools/backup/orchestrator.js) | [orchestrator.test.js](../tools/backup/orchestrator.test.js) |
| Restore mit satzuebergreifender Artefaktabdeckung | [tools/backup/restore.js](../tools/backup/restore.js) | [restore.test.js](../tools/backup/restore.test.js) |
| Fachliche Restore-Pruefungen | [tools/backup/restore-contract-checks.js](../tools/backup/restore-contract-checks.js) | [restore-contract-checks.test.js](../tools/backup/restore-contract-checks.test.js) |
| Einspielen in eine isolierte Umgebung | [tools/apply-restored-backup-set.sh](../tools/apply-restored-backup-set.sh) | [backup-restore-e2e-contract.test.js](../tools/backup-restore-e2e-contract.test.js) |
| Werkzeugvertraege auf CLI-Ebene | [tools/backup-restore-contract.test.js](../tools/backup-restore-contract.test.js) | CI-Job `customer-data-backup` |
| Container-Nachweis ueber beide Modi | [tools/backup-restore-e2e.sh](../tools/backup-restore-e2e.sh) | CI-Job `customer-data-backup-e2e` |

Der Container-Nachweis baut eine vollstaendig synthetische Quelle auf, sichert
sie einmal taeglich und einmal stuendlich, spielt den stuendlichen Punkt in ein
leeres Restore-Projekt zurueck und belegt Projektdateien, Repository-Bindung,
Bestand und beide Artefakte ueber beide Saetze hinweg. Der Ablauf steht im
[Restore-Runbook](customer-data-restore-runbook.md).

Noch nicht umgesetzt und noch nicht auf dem Zielsystem nachgewiesen sind der
externe unveraenderbare Speicher, der Upload, die Retention, das Monitoring, der
private Backup-Server, die planmaessige Ausfuehrung ueber einen Timer und die
Restore-Probe gegen echte Kundendaten. Es laeuft also bislang nichts von allein:
die Werkzeuge sind vorbereitet, die Inbetriebnahme steht aus.

Die Schritte dorthin, jeweils mit Befehl und Erfolgskriterium, stehen in
[customer-data-backup-setup.md](customer-data-backup-setup.md).

## Offene Punkte

**1. Externen Backup-Speicher einrichten und anbinden.**

- externen, verschluesselten und gegen den Deployment-Zugang geschuetzten
  Backup-Speicher auswaehlen und einrichten; Bucket mit Object Lock im
  Compliance-Modus und 400 Tagen Standardretention
- providerneutralen Backup-Adapter und getrennte, nicht von Workern oder
  Deployment nutzbare Credentials nachweisen
- Upload gilt erst als erfolgreich, wenn das Ziel Pruefsummen bestaetigt und
  Object Lock mit der erwarteten Retention meldet

**2. Betrieb und Alarmierung.**

- stuendlichen und taeglichen Lauf als `operator_maintenance`-Prozess ueber
  systemd-Timer einplanen; ohne Timer laeuft die Sicherung nicht von allein
- Retention, Pruefsummen, Backup-Alter und Fehler alarmieren. Dafuer besteht
  bereits ein erprobtes Muster: ein Timer ruft ein Scan-Skript auf, das ueber
  [security-alert-scan.sh](../infra/vps/security/security-alert-scan.sh) einen
  aggregierten Befund an `/api/internal/security-events` meldet, ohne Rohdaten
  zu uebertragen
- privaten Backup-Server mit ausschliesslich lesendem Zugriff aufsetzen

**3. Nachweis.**

- ersten vollstaendigen Restore-Test innerhalb von RPO und RTO protokollieren
- Restore-Probe gegen eine isolierte Umgebung mit echten Containern, inklusive
  Clone-Nachweis aus dem wiederhergestellten Forgejo

**4. Loeschpflichten und Backup-Retention zusammenbringen.**

Regel 8 verlangt, dass ein Restore bereits wirksam geloeschte Datensaetze nicht
unkontrolliert wieder produktiv sichtbar macht. Object Lock im Compliance-Modus
bedeutet aber, dass geloeschte Kundendaten bis zu 400 Tage unveraenderbar in den
Sicherungssaetzen liegen. Dafuer fehlt bislang der technische Mechanismus:

- eine ausserhalb der Sicherungssaetze gefuehrte, selbst gesicherte Liste der
  wirksam gewordenen Loeschungen
- ein Schritt im Wiederherstellungsablauf, der diese Loeschungen nach dem
  Einspielen und vor dem Umschalten erneut anwendet
- ein dokumentiertes Loeschkonzept, das die Backup-Retention als Grund fuer die
  verzoegerte Loeschung benennt

Die offenen Punkte sind erst geschlossen, wenn ein vollstaendiger Verlust der
produktiven Volumes aus einer externen Sicherung erfolgreich wiederhergestellt
und fachlich geprueft wurde.
