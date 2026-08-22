# Optionale Account-E-Mail und persoenliche Community-Hinweise

Stand: 2026-08-18
Status: lokal umgesetzt, Betriebsnachweise offen

## Zweck und Grenze

GerNetiX kann fuer ein persistentes Konto eine optionale verifizierte
Kontaktadresse fuehren. Passkey-Konten, Community und Inbox bleiben ohne
E-Mail-Adresse voll nutzbar. Die interne `user_id` bleibt die einzige
dienstuebergreifende Identitaet.

Die Adresse darf fuer folgende getrennte Zwecke verwendet werden:

- Verifizierung einer neu hinterlegten oder geaenderten Adresse,
- Passwort-Reset bei einem passenden lokalen E-Mail-Konto,
- vom Nutzer aktivierte persoenliche Hinweise zu Direktnachrichten,
  Threadantworten, Supportantworten und Projekteinladungen.

Nicht umfasst sind Werbung, Newsletter, Empfehlungen, globale
Community-Broadcasts per E-Mail, Oeffnungs- oder Klicktracking und die
Speicherung vollstaendiger versendeter E-Mails.

## Feature-Status und erledigte Arbeitspakete

Der lokal implementierte Feature-Stand wurde am 2026-08-18 mit Commit
`fcde810` gesichert. Die weitere Planung wurde mit `22e94d5` festgehalten.

| Paket | Ergebnis | Status |
| --- | --- | --- |
| **EMAIL-01 – Zweck-, Datenschutz- und Consent-Grenze** | Drei getrennte Zwecke, keine Werbung, kein Cookie-Consent und kein Datenschutz-Kenntnisnahmefeld. Oeffentliche Entwurfsseite `/datenschutz/` sowie Links aus Registrierung, Navigation und Kontoeinstellungen. | Lokal umgesetzt |
| **EMAIL-02 – Kontaktadresse und persoenliche Praeferenzen** | Optionale Adresse fuer persistente Passkey-Konten, Verifizierungs- und Wechselablauf, Entfernen mit Ruecksetzen der Schalter, vier getrennte Community-Praeferenzen, Account-UI und Selbstauskunft. Klassische E-Mail-Konten behalten ihre Login-Adresse. | Lokal umgesetzt |
| **EMAIL-03 – Transaktionale Community-Outbox** | Inbox-Aktion und minimiertes Outbox-Ereignis werden atomar gespeichert. Identity beansprucht Ereignisse per Lease; Retry, exponentieller Abstand, Dead Letter nach acht Versuchen und idempotente Zustellnachweise sind implementiert. | Lokal umgesetzt |
| **EMAIL-04 – Datensparsamer SMTP-Versand** | Verifizierung, Passwort-Reset und persoenliche Community-Hinweise verwenden den konfigurierbaren SMTP-Dienst. Community-Mails sind in Deutsch, Englisch und Niederlaendisch generisch und enthalten keine privaten Inhalte, Projekt- oder Absenderdaten. | Lokal umgesetzt |
| **EMAIL-05 – Statusgebundene Retention** | Getrennte, hoechstens stuendliche Bereinigung fuer Community-Outbox, Identity-Zustellnachweise, abgelaufene Verifizierungs-/Reset-Tokens und Support-Recovery. Aktive Zustaende sind geschuetzt; Aktivierung bleibt bis zur Fristfreigabe ausgeschaltet. | Lokal umgesetzt, inaktiv |
| **EMAIL-06 – Bounce und Suppression** | Synchrone permanente SMTP-Fehler pausieren nur Community-Mails an die aktuelle Adressversion. Geschuetzter asynchroner Meldevertrag, feste Grundcodes, Schutz vor alten Bounces, Revalidierung und Anzeige im Konto sowie in der Selbstauskunft. | Lokal umgesetzt |

## Technischer Feature-Vertrag

### Persistierte Identity-Daten

Das Account-JSON in `identity_user_accounts` fuehrt fuer dieses Feature:

- `email` und `email_verified_at`,
- die interne `email_contact_version` zur Bindung von Zustellnachweisen und
  Suppression an genau eine bestaetigte Adressversion,
- `pending_email`, `pending_email_token_id` und
  `pending_email_requested_at`,
- die vier booleschen Werte unter `notification_preferences`,
- die minimierte `community_email_suppression` mit festem Grund, Quelle,
  normalisiertem permanentem SMTP-Status, Adressversion und Zeitpunkt.

`identity_notification_deliveries` speichert Ereignis-ID, `user_id`,
Kategorie, Status, festen Grundcode, optionale Provider-Message-ID,
Empfaengerversion und Zeitstempel. Es speichert weder E-Mail-Text noch
Community-Nachricht, Projektname, Absenderdetails oder Bounce-Freitext.

Verifizierungs- und Passwort-Reset-Tokens werden ausschliesslich gehasht und
befristet gespeichert. SMTP-Zugangsdaten liegen verschluesselt in der
bestehenden SMTP-Konfiguration und werden weder ueber Kunden-APIs noch Logs
ausgegeben.

### Persistierte Community-Daten

`community_notification_outbox` fuehrt ausschliesslich:

- Ereignis-ID, Empfaenger-`user_id` und eine der vier erlaubten Kategorien,
- `pending`, `retry`, `leased`, `delivered` oder `dead_letter`,
- Versuchszahl, naechsten Versuch, Lease-Ende, minimiertes Ergebnis und festen
  letzten Fehlercode,
- Erstellungs-, Aktualisierungs- und optionalen Zustellzeitpunkt.

Die Community Platform kennt keine Kontaktadresse. Ein ausgeloestes
Outbox-Ereignis wird in derselben PostgreSQL-Transaktion wie die zugehoerige
Inbox-Aktion gespeichert.

### HTTP- und Service-Grenzen

Kontoseitig und sitzungsgebunden:

```text
GET    /api/account/contact-notifications
PATCH  /api/account/contact-notifications
POST   /api/account/contact-email
DELETE /api/account/contact-email
```

Oeffentliche Token-Abschluesse geben keine Kontodaten preis:

```text
GET  /verify-email?token=...
POST /api/password-reset/request
POST /api/password-reset/complete
```

Nur zwischen Identity und Community mit `COMMUNITY_INTERNAL_TOKEN`:

```text
POST /api/community/notification-outbox/claim
POST /api/community/notification-outbox/{event_id}/complete
POST /api/community/notification-outbox/{event_id}/retry
```

Nur mit dem internen Identity-Admin-Token:

```text
POST /api/internal/email-delivery/suppress
```

Der Suppression-Endpunkt akzeptiert nur `event_id`, `reason_code`, `source`
und einen normalisierten permanenten `smtp_status`. Die Ereignis-ID muss zu
einer bereits als versandt erfassten Zustellung und weiterhin zur aktuellen
Adressversion gehoeren.

### Worker und Laufzeitkonfiguration

Der `community-notification-outbox-worker` laeuft standardmaessig alle 15
Sekunden, beansprucht bis zu 25 Ereignisse mit 60 Sekunden Lease und fuehrt je
Ereignis Complete oder Retry aus. Parallele Flush-Aufrufe werden innerhalb
einer Instanz zusammengefasst.

Der `identity-retention-worker` laeuft hoechstens stuendlich und besitzt zwei
unabhaengige, standardmaessig deaktivierte Bereiche:

```text
COMMUNITY_NOTIFICATION_RETENTION_ENABLED=0
COMMUNITY_NOTIFICATION_DELIVERED_RETENTION_DAYS=30
COMMUNITY_NOTIFICATION_DEAD_LETTER_RETENTION_DAYS=90

IDENTITY_TOKEN_RETENTION_ENABLED=0
IDENTITY_EXPIRED_TOKEN_RETENTION_DAYS=7
IDENTITY_SUPPORT_RECOVERY_RETENTION_DAYS=30
```

Die Intervalle koennen intern ueber
`COMMUNITY_NOTIFICATION_OUTBOX_INTERVAL_MS` und
`IDENTITY_RETENTION_INTERVAL_MS` angepasst werden. Fristen ausserhalb von 1
bis 365 Tagen fallen auf die sicheren Kandidatenwerte zurueck. Eine spaetere
Aktivierung ist eine eigene fachliche und betriebliche Freigabe, keine reine
Konfigurationspflege.

### Fehler- und Sicherheitsverhalten

- Community-Aktionen bleiben erfolgreich, wenn der nachgelagerte Mailversand
  scheitert.
- Temporaere SMTP-Fehler werden wiederholt; permanente `5xx`-Fehler beenden
  den Retry fuer diese Adressversion durch Suppression.
- Erfolgreiche und bewusst uebersprungene Ereignisse sind idempotent; frische
  `processing`-Zustaende werden nicht parallel erneut versandt.
- Freie Providerfehler, Rohmails, private Nachrichten und Empfaengeradressen
  werden nicht in Operations- oder Suppression-Datensaetze kopiert.
- Eine neue oder erneut bestaetigte Adresse erhaelt eine neue interne Version
  und kann deshalb nicht durch einen verspaeteten Bounce der alten Version
  gesperrt werden.
- SMTP besitzt keine transaktionale Exactly-once-Garantie. Das kleine
  Ausfallfenster nach Providerannahme und vor Speicherung der Quittung kann
  einen doppelten generischen Hinweis erzeugen.

### Lokaler Nachweisstand

Beim Feature-Checkpoint bestanden:

- 814 eindeutige Identity-Tests einschliesslich des separat mit Loopback-
  Freigabe ausgefuehrten Linkintegritaetstests,
- 44 Community-Tests,
- SMTP-Normalisierung fuer temporaere und permanente Fehler,
- Kontakt-, Praeferenz-, Outbox-, Lease-, Retry-, Dead-Letter-, Suppression-,
  Revalidierungs-, SQLite-Neustart-, Selbstauskunft- und Datenschutzvertraege,
- Offline-Architekturdokumentation mit 173 Dokumenten,
- SQLite-Graphvalidierung ohne Fehler; eine bereits bestehende themenfremde
  Metamodellwarnung zum Process Monitor blieb offen.

Nicht als Nachweis behauptet werden echter IONOS-Versand, automatisches
Einlesen von Delivery-Status-Mails, echter PostgreSQL-Parallelbetrieb,
authentifizierter Browser, Backup-Auslauf oder Staging.

## Datenhoheit

Identity-PostgreSQL fuehrt die normalisierte Adresse, den
Verifizierungszeitpunkt, eine ausstehende Adressaenderung, getrennte
Benachrichtigungspraeferenzen, eine adressversionsgebundene Zustellsperre und
minimierte Zustellnachweise. Tokens werden nur gehasht gespeichert und sind
zeitlich begrenzt.

Community Platform fuehrt weiterhin Threads, Nachrichten, Inbox-Eintraege und
Lesestaende. Nach erfolgreicher persoenlicher Inbox-Aktion darf sie nur
Ereignis-ID, Empfaenger-`user_id` und Kategorie an Identity melden. Adresse,
Betreff, Nachrichtentext, Projektbezeichnung und Absenderdetails sind nicht
Bestandteil dieses Zustellereignisses.

Nachricht beziehungsweise Einladung und Outbox-Ereignis werden in derselben
Community-PostgreSQL-Transaktion gespeichert. Identity holt faellige
Ereignisse mit einer zeitlich begrenzten Lease ab. PostgreSQL sperrt die kleine
Auswahl mit `FOR UPDATE SKIP LOCKED`, sodass parallele Identity-Instanzen ein
Ereignis nicht gleichzeitig beanspruchen. Fehlgeschlagene Uebergaben werden
mit begrenztem exponentiellem Abstand wiederholt und nach acht Versuchen als
`dead_letter` sichtbar gehalten. `sent` und ein wegen deaktivierter
Praeferenz bewusstes `skipped` schliessen das Ereignis ab.

Dauerhafte synchrone SMTP-Fehler (`5xx`) sperren ausschliesslich weitere
Community-E-Mails an die aktuell bestaetigte Adressversion. Die Adresse bleibt
im Konto erhalten, und die persoenlichen Schalter werden nicht veraendert.
Spaetere Delivery-Status-Nachrichten koennen ueber den mit dem internen
Admin-Token geschuetzten Vertrag `POST /api/internal/email-delivery/suppress`
gemeldet werden. Der Vertrag akzeptiert nur Ereignis-ID, feste Grund- und
Quellcodes sowie einen normalisierten permanenten SMTP-Status; Freitext,
Mailinhalt und Providerantwort werden weder angenommen noch gespeichert.
Identity sperrt nur ein bereits als versandt erfasstes Ereignis, dessen
Empfaengerversion noch der aktuellen bestaetigten Adresse entspricht. Ein
verspaeteter Bounce einer alten Adresse kann daher keine neue Adresse sperren.

Community Platform und Identity besitzen denselben expliziten
Aufbewahrungsvertrag fuer diese minimierten Nachweise. Ein hoechstens
stuendlicher Lauf entfernt in Community ausschliesslich alte `delivered`- und
`dead_letter`-Ereignisse und in Identity ausschliesslich alte `sent`, `skipped`,
`failed` oder verwaiste `processing`-Nachweise. `pending`, `retry` und aktive
Leases bleiben unangetastet. PostgreSQL, SQLite und In-Memory implementieren
denselben Vertrag.

Die Laufzeitaktivierung bleibt bis zur Fristfreigabe mit
`COMMUNITY_NOTIFICATION_RETENTION_ENABLED=0` deaktiviert. Die technisch
begrenzten Kandidatenwerte sind 30 Tage fuer erfolgreiche beziehungsweise
bewusst uebersprungene Zustaellungen und 90 Tage fuer Dead Letter sowie
fehlgeschlagene Nachweise. Werte ausserhalb von 1 bis 365 Tagen werden nicht
uebernommen.

Ein davon unabhaengiger Identity-Retention-Worker kann abgelaufene
E-Mail-Verifizierungs- und Passwort-Reset-Token sowie alte
Support-Recovery-Transaktionen entfernen. Er verwendet ausschliesslich
Hash-Datensaetze und laeuft unabhaengig von der Erreichbarkeit der Community.
Ein aktiver Verifizierungs- oder Reset-Token wird nicht geloescht. Bei
Support-Recovery ist das spaetere Ende aus vorlaeufigem Passwort und
Recovery-Grant massgeblich, sodass ein noch aktiver Grant den Datensatz
schuetzt.

Auch diese Bereinigung bleibt mit `IDENTITY_TOKEN_RETENTION_ENABLED=0`
deaktiviert. Kandidaten sind sieben Tage nach Tokenablauf und 30 Tage nach dem
letzten wirksamen Support-Recovery-Ablauf; beide Fristen sind vor Aktivierung zu
pruefen.

## Bedienvertrag

- Eine neue Adresse wird erst nach dem aktuell passenden Verifizierungslink
  wirksam.
- Community-E-Mail-Schalter bleiben bis dahin deaktiviert.
- Jeder Schalter ist eine Benachrichtigungspraeferenz und keine Werbung- oder
  Cookie-Einwilligung.
- Beim Entfernen einer optionalen Adresse werden alle Community-E-Mail-Schalter
  deaktiviert.
- Ein klassisches E-Mail-Konto darf seine fuer Login und Reset benoetigte
  Adresse nicht ersatzlos entfernen.
- Nach einer dauerhaften Unzustellbarkeit bleiben Adresse und Schalter sichtbar,
  der Community-Versand pausiert jedoch. Erneutes Speichern und Bestaetigen
  derselben Adresse oder die Bestaetigung einer neuen Adresse hebt die Sperre auf.
- Die Registrierung verlangt keine Kenntnisnahme oder Zustimmung zur
  Datenschutzinformation. Eine vorhandene Pflichtauswahl betrifft nur die
  Nutzungsbedingungen.

## Mailinhalt

Eine Community-E-Mail teilt nur die Ereignisart mit und verlinkt auf
`/app/messages/`. Private Nachrichtentexte, Projektnamen und Absenderdetails
werden nicht in Betreff oder Text uebernommen. Die eigentlichen Inhalte bleiben
hinter der GerNetiX-Sitzung.

## Naechste Arbeitspakete

Wiedereinstieg nach Abschluss des parallel laufenden Nexi-Identity-Blocks:

1. **EMAIL-07 – IONOS-DSN-Postfach-Reader:** Eingehende Delivery-Status-
   Nachrichten aus einem dedizierten Postfach lesen, streng begrenzt parsen,
   ueber die versandte Ereignis-ID zuordnen und an den vorhandenen geschuetzten
   Suppression-Vertrag uebergeben. Keine Rohmail und keinen Bounce-Freitext
   dauerhaft speichern.
2. **EMAIL-08 – echter SMTP-Nachweis:** Verifizierung, Passwort-Reset,
   Community-Hinweis, temporaeren Fehler und dauerhaften Bounce mit dem
   vorgesehenen IONOS-Postfach pruefen.
3. **EMAIL-09 – PostgreSQL-Parallelitaetsnachweis:** Mehrere Worker, Lease,
   Idempotenz, Retry und Suppression gegen echtes PostgreSQL pruefen.
4. **EMAIL-10 – authentifizierter Browsernachweis:** Adresse hinterlegen,
   bestaetigen, Praeferenzen aendern, Suppression anzeigen und Adresse erneut
   bestaetigen; Desktop, iPad und schmale Mobilbreite abdecken.
5. **EMAIL-11 – Datenschutz-Veroeffentlichungsdaten:** Verantwortlichen,
   Anschrift, Datenschutzkontakt, DSB-Status, Aufsichtsbehoerde und finale
   Rechtsgrundlagen mit rechtlicher Freigabe ergaenzen.
6. **EMAIL-12 – Mailanbieter- und AV-Pruefung:** IONOS-Vertragsrolle,
   Auftragsverarbeitung, Unterauftragnehmer, Standorte und Aufbewahrung der
   Zustelldaten dokumentieren.
7. **EMAIL-13 – Fristfreigabe und Retention-Aktivierung:** Konkrete Fristen
   rechtlich freigeben und erst danach die vorbereiteten Notification- und
   Token-Retention-Worker aktivieren.
8. **EMAIL-14 – Backup-Loeschnachweis:** Auslaufen geloeschter Adressen, Tokens,
   Zustellnachweise und Suppressionsdaten in Backups festlegen und testen.
9. **EMAIL-15 – Staging-Abnahme:** Nach gesondertem Auftrag kontrolliert
   deployen und SMTP, PostgreSQL, Browser, Retention und Neustartverhalten auf
   Staging abnehmen.

EMAIL-07 ist das naechste technische Paket. Es beginnt nicht parallel zu
Nexi-Aenderungen an zentralen Identity-Routen, `dev-server.js`, Persistenz-
adaptern oder dem SQLite-Graphen; diese Dateien werden entweder zeitlich
nacheinander oder in getrennten Worktrees bearbeitet.

## Offene Nachweise

- Automatisches Auslesen und Zuordnen der vom IONOS-Postfach eingehenden
  Delivery-Status-Nachrichten; der providerunabhaengige, geschuetzte
  Suppression-Vertrag und synchrone SMTP-`5xx`-Pfad sind lokal umgesetzt,
- die oeffentliche Entwurfsseite `/datenschutz/` ist lokal umgesetzt und bei
  Registrierung, Kontoeinstellungen und Navigation verlinkt; vor rechtlicher
  Freigabe fehlen noch der exakte Verantwortliche, Postanschrift,
  Datenschutzkontakt, Status eines Datenschutzbeauftragten, zustaendige
  Aufsichtsbehoerde sowie die abschliessende Rechtsgrundlagenzuordnung,
- Auftragsverarbeitungs- und Empfaengerpruefung des Mailanbieters,
- rechtliche Freigabe und anschliessende Aktivierung der konkreten
  Notification- und Token-Loeschfristen; Loeschung und Auslaufen in Backups
  bleiben separat offen,
- authentifizierter Browser-, echter SMTP-, echter PostgreSQL-Parallelitaets- und
  Staging-Nachweis.

SMTP besitzt keine transaktionale Exactly-once-Garantie. Falls ein Provider
eine Nachricht annimmt und Identity unmittelbar vor dem Speichern des
Zustellnachweises ausfaellt, kann ein spaeterer Retry im Grenzfall einen
doppelten generischen Hinweis erzeugen. Private Inhalte werden auch in diesem
Fall nicht uebertragen.
