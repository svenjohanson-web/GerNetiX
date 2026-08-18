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
