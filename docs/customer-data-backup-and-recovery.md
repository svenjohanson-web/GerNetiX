# Sicherung und Wiederherstellung von Kundendaten

## Ziel

Accountgebundene Kundendaten duerfen weder durch ein fehlerhaftes Deployment noch durch versehentliches Loeschen dauerhaft verloren gehen. Dazu gehoeren insbesondere Accounts und Berechtigungen, Projekte und Projektquellen, Hardware-Inventar und Pairings, Lernfortschritt, Bestellungen und Ansprueche, Consents sowie kundenbezogener KI-Kontext.

Ein persistentes Docker-Volume allein ist keine Datensicherung. Es schuetzt vor einem normalen Container-Austausch, aber nicht vor logischem Loeschen, `down -v`, defekten Volumes, Fehlbedienung, kompromittierten Zugangsdaten oder dem Ausfall des VPS.

## Verbindliche Schutzziele

- RPO: Hoechstens eine Stunde bestaetigter Kundendaten darf im Katastrophenfall fehlen.
- RTO: Innerhalb von vier Stunden muss ein konsistenter, nutzbarer Stand wiederhergestellt werden koennen.
- Aufbewahrung: mindestens 48 stuendliche, 30 taegliche und 12 monatliche Wiederherstellungspunkte.
- Trennung: Mindestens eine verschluesselte Kopie liegt ausserhalb des VPS und ausserhalb des Deployment-Lebenszyklus. Der normale Deployment-Account darf sie nicht loeschen oder ueberschreiben.
- Nachweis: Mindestens vierteljaehrlich und nach wesentlichen Persistenz-Aenderungen wird eine Wiederherstellung in einer isolierten Umgebung geprobt.
- Alarmierung: Fehlgeschlagene Sicherungen, ein zu alter letzter erfolgreicher Sicherungspunkt und fehlgeschlagene Restore-Pruefungen erzeugen einen sichtbaren Betriebsalarm.

## Zu sichernder fachlicher Umfang

Die Sicherung wird aus den fachlichen Quellen der Wahrheit abgeleitet und nicht aus Browser-State, Caches oder generierten Sichten:

| Datenbereich | Fuehrende Persistenz | Beispiele |
| --- | --- | --- |
| Identitaet und Account | Identity-SQLite | Accounts, interne `user_id`, Credentials, Sessions und Berechtigungsbezug |
| Projekte | gemeinsame Service-SQLite / Project Server | Projektstruktur, Quellen, View-Manifeste, Hardware-Konfiguration, Build-Historie und Lernfeedback |
| Hardware-Inventar | gemeinsame Service-SQLite / Device Management | AccountDevices, Pairings, Seriennummern, Device-Identitaet, Credentials und Supportkontext |
| Weitere Plattformdaten | gemeinsame Service-SQLite | Bestellungen, Ansprueche, Lernfortschritt, Consents, Usage- und Auditdaten |
| KI-Kontext | AI-Context-PostgreSQL | Grants, Policy, Prompts, Architektur-Bausteine, accountisolierte Intent-Beispiele und Audit |
| Wiederaufbau-relevante Artefakte | Artifact Store / persistente Build-Daten | Nur Artefakte, die nicht deterministisch aus versionierten Quellen neu erzeugt werden koennen |

Jeder neue Service mit dauerhafter SQL-Persistenz muss vor Produktivsetzung entweder in diesen Sicherungsumfang aufgenommen oder ausdruecklich als vollstaendig reproduzierbar klassifiziert werden.

## Sicherungsregeln

1. SQLite wird transaktionskonsistent ueber die SQLite-Backup-API oder einen gleichwertigen konsistenten Snapshot gesichert. Eine rohe Dateikopie waehrend Schreibzugriffen ist nicht ausreichend.
2. PostgreSQL wird mit einem konsistenten logischen oder physischen Backup-Verfahren gesichert. Datenbank und erforderliche Rollen-/Schema-Informationen muessen gemeinsam wiederherstellbar sein.
3. Jeder Sicherungssatz enthaelt Manifest, Erstellungszeit, Quellinstanz, Schema-/Anwendungsversion, enthaltene Datenbereiche, Groesse und kryptografische Pruefsumme.
4. Sicherungen werden bei Transport und Speicherung verschluesselt. Entschluesselungsschluessel werden getrennt vom Backup-Speicher und vom normalen Deployment-Zugang verwaltet.
5. Vor einem Deployment mit Persistenzmigration oder erhoehtem Datenrisiko wird ein frischer, erfolgreich gepruefter Wiederherstellungspunkt verlangt. Das Deployment darf keine Volumes loeschen oder neu initialisieren.
6. Aufbewahrungsloeschungen erfolgen ausschliesslich ueber die definierte Retention. Ein kompromittierter Service- oder Deployment-Zugang darf vorhandene Sicherungen nicht unmittelbar entfernen koennen.
7. Datenschutzrechtliche Loeschpflichten werden durch eine dokumentierte Backup-Retention und kontrollierte Wiederherstellung beruecksichtigt. Ein Restore darf bereits wirksam geloeschte Datensaetze nicht unkontrolliert wieder produktiv sichtbar machen.

## Wiederherstellungsablauf

1. Vorfall eingrenzen und weitere Schreibzugriffe stoppen.
2. Gewuenschten Wiederherstellungspunkt anhand Manifest, Zeit und Pruefsumme auswaehlen.
3. Sicherung zuerst in eine isolierte Umgebung einspielen; nie ungeprueft direkt ueber den produktiven Stand schreiben.
4. Datenbankintegritaet, Migrationen und fachliche Referenzen pruefen, insbesondere `user_id`, Projektzuordnung, AccountDevice-/Pairing-Beziehungen und kundenbezogene Grants.
5. Stichproben oder automatisierte Abgleiche fuer Account, Projekt, Projektquelle und Hardware-Inventar ausfuehren.
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

Diese Datei definiert die verbindliche fachliche und betriebliche Zielsetzung. Benannte Docker-Volumes bestehen bereits, sind aber allein kein Nachweis fuer Backup oder Wiederherstellbarkeit. Backup-Orchestrierung, externer unveraenderbarer Speicher, Monitoring, Restore-Automation und Restore-Contract-Tests muessen noch umgesetzt und auf dem Zielsystem nachgewiesen werden.

## Offener Punkt

**Customer-Data-Backup und Restore technisch umsetzen und nachweisen.**

- externen, verschluesselten und gegen den Deployment-Zugang geschuetzten Backup-Speicher auswaehlen und einrichten
- konsistente Sicherung fuer Identity-SQLite, gemeinsame Service-SQLite, AI-Context-PostgreSQL und nicht reproduzierbare Artefakte automatisieren
- Retention, Pruefsummen, Backup-Alter und Fehler alarmieren
- isolierte Restore-Automation und fachliche Contract-Checks fuer Accounts, Projekte und Hardware-Inventar implementieren
- ersten vollstaendigen Restore-Test innerhalb von RPO und RTO protokollieren

Der offene Punkt ist erst geschlossen, wenn ein vollstaendiger Verlust der produktiven Volumes aus einer externen Sicherung erfolgreich wiederhergestellt und fachlich geprueft wurde.
