# Account-Speicher- und Lifecycle-Policy

## Ziel

GerNetiX implementiert Speicher-, Projekt-, Build- und Accountgrenzen als
versionierte Policies. Konkrete Preise, Kontingente und Fristen sind
Betriebs- und Produktkonfiguration und werden nicht als unveraenderliche Werte
in Fachcode oder UI-Text eingebaut. Admin- und Kundenansicht lesen dieselbe
effektive Policy und dieselben serverseitig gemessenen Verbrauchswerte.

## Feste Systemregeln

- Nutzerbearbeitete Entwicklungsprojekte und ihre Historie liegen in privaten
  Forgejo-Repositories. Der Project Server bleibt Wahrheit fuer Besitz,
  Berechtigung, Repository-Bindung und Projektzustand.
- Dem Account zurechenbare Git-Objekte, Historie, Branches, Tags, Git-LFS und
  dauerhafte Releases werden dem Speicherplan zugerechnet.
- Build-Metadaten, kurzlebige Build-Ausgaben und technische Caches werden
  getrennt ausgewiesen. Sie duerfen nicht als zweite Projektdateiwahrheit
  dienen.
- Browser und Worker bestimmen weder Plan noch Retention oder Freigabeklasse.
  Die verantwortlichen Services leiten die effektive Policy aus einem
  vertrauenswuerdigen Account- und Policykontext ab.
- Eine Grenzueberschreitung loescht keine Kundendaten unmittelbar. Lesen,
  Exportieren und Bereinigen bleiben moeglich; weiteres dauerhaftes Wachstum
  darf gesperrt werden.
- Hot-Storage-Daten werden erst entfernt, nachdem ein vorgesehenes Cold
  Archive vollstaendig uebertragen sowie anhand von Manifest und Pruefsumme
  verifiziert wurde.

## Konfigurierbare Policy

Der Zielvertrag einer Policy ist unveraenderlich versioniert und besitzt mindestens
`policy_id`, `policy_version`, `plan_id`, `status`, `effective_from`,
`changed_by`, `change_reason` und die fachlichen Grenzwerte. Der aktuelle
Erststand erhoeht die Version der aktiven Policy und schreibt vorherigen und
neuen Zustand in das Admin-Audit; eine eigene append-only Policy-Historie und
zukuenftige Aktivierungszeitpunkte sind noch umzusetzen. Neue Fassungen duerfen
bestehende Fassungen nicht still ersetzen. Nullwerte duerfen nur dort `unbegrenzt` bedeuten,
wo der API-Vertrag dies ausdruecklich festlegt.

Konfigurierbar sind insbesondere:

- verwendbare Projektanzahl und interne Abuse-Grenzen,
- Git-, Release- und gegebenenfalls gemeinsamer dauerhafter Speicher,
- Warnschwellen und Verhalten im Ueberkontingent,
- Aufbewahrung normaler, Debug- und diagnostischer Build-Artefakte,
- Cache-TTL und betriebliche Soft-Limits,
- Premium-Downgrade-, Inaktivitaets-, Kulanz-, Cold-Archive- und
  Loeschfristen,
- Account-Overrides und zugeordnete Commerce-Produktreferenzen.

Preise bleiben in der fuehrenden Commerce-Domaene. Das Admin Tool darf sie
gemeinsam mit der Policy anzeigen, aber nicht als abweichende Kopie im Project
Server fuehren.

## Projektzustand

GerNetiX verwendet zunaechst die fachlichen Projektzustaende `active`,
`plan_locked` und `template`. `plan_locked` bewahrt Repository und Historie,
zaehlt weiter zum Speicherverbrauch und erlaubt Lesen, Klonen, Exportieren und
Loeschen. Bearbeiten, Push, Build, Deployment und neue Releases bleiben bis zu
einer passenden Berechtigung gesperrt. Ein technisches Forgejo-Archiv ist kein
eigener Kundenprojektzustand.

## Build- und Artefaktklassen

- Ein Standardbuild publiziert nur die zum Flashen erforderlichen Artefakte.
- Ein expliziter Debug-Build darf ELF, Map und weitere Diagnoseartefakte
  publizieren, wenn die effektive Policy dies erlaubt.
- Ein erfolgreicher, commitgebundener Build wird nur durch eine bewusste
  Promotion zum dauerhaften Release.
- Release, Build und Artefakt speichern die angewendete Policy-Version. Ein
  eigenstaendiger Retention-Lauf entfernt abgelaufene temporaere Artefakte
  auch dann, wenn keine neuen Builds geschrieben werden.

## Cache

Projekt- und zielbezogene inkrementelle Build-Caches bleiben technische,
vollstaendig reproduzierbare Daten. Sie besitzen `last_used_at`, eine
konfigurierbare maximale Aufbewahrung und koennen bei Speicherdruck per LRU
frueher entfernt werden. Gemeinsam verwendete Toolchains und Frameworks werden
separat behandelt. Cacheverlust darf ausschliesslich den naechsten Build
verlangsamen.

## Account- und Tariflebenszyklus

Identity ist Wahrheit fuer Plan, Plangueltigkeit und Account-Lifecycle. Eine
relevante Aktivitaet ist eine authentifizierte Nutzeraktion; automatische
Webhooks oder Hintergrundjobs verlaengern die Frist nicht. Premium-Ablauf und
Free-Inaktivitaet verwenden getrennte, idempotente Zustandsuebergaenge mit
Policy-Version, Fristen und Audit.

Beim Downgrade waehlt der Nutzer die im Zielplan verwendbaren Projekte. Die
uebrigen Projekte werden `plan_locked`. Eine zusaetzliche
Speicherueberschreitung fuehrt zum Ueberkontingent, ohne sofortige Loeschung.
Ein sicherheitsbedingt deaktivierter Account bleibt von einer
Lifecycle-Deaktivierung getrennt und erhaelt keinen vereinfachten Login.

Mangels verpflichtender E-Mail-Adresse garantiert GerNetiX nur Hinweise in
der Anwendung. Freiwillige Push- oder Benachrichtigungskanaele koennen spaeter
ergaenzt werden; Ablaufdaten und Auswirkungen muessen innerhalb des Accounts
dauerhaft sichtbar sein.

## Speicher- und Backupklassen

Hot Storage, technischer Cache, Account Cold Archive und Disaster Backup sind
getrennte Datenklassen. Cold Archive und Disaster Backup duerfen dieselbe
guenstige, redundante Object-Storage-Infrastruktur verwenden, benoetigen aber
getrennte Namespaces, Credentials, Schluessel, Retention und
Wiederherstellungsvertraege. Ein Accountarchiv wird erst beim tatsaechlichen
Lifecycle-Uebergang erzeugt; aktive Konten erhalten keine zusaetzliche
Kundenarchivkopie.

Im aktuellen Implementierungsstand sind Transitionen nach `cold_archived` und
`pending_deletion` bewusst gesperrt. Sie werden erst freigegeben, wenn ein
vollstaendiges, pruefsummengeprueftes Archivmanifest und ein erfolgreicher
Restore-Nachweis technisch angebunden sind.

## Nachvollziehbarkeit

Jede Policyaenderung, Grenzentscheidung, Lifecycle-Transition,
Artefaktloeschung, Archivierung und Wiederherstellung speichert technischen
Grund, Policy-Version, Zeitpunkt und verantwortlichen Akteur. Admin Tool und
Kundenansicht verwenden eine gemeinsame effektive Policy- und Usage-API. Die
Kundenansicht erklaert Grenzwert, aktuelle Nutzung, Auswirkung und moegliche
Abhilfe, statt nur einen generischen Sperrstatus zu zeigen.
