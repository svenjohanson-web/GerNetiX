# Eine aktive Kontositzung pro Einzelkonto

## Ziel und Geltungsbereich

Ein persoenliches GerNetiX-Einzelkonto darf genau eine aktive interaktive
Browser- oder App-Sitzung besitzen. Der Kunde darf das Konto auf mehreren
eigenen Geraeten verwenden, aber nicht gleichzeitig. Ein neuer erfolgreicher
Login uebernimmt das Konto erst nach einer ausdruecklichen Entscheidung des
Kunden.

Die Regel erschwert das parallele Teilen von Zugangsdaten und reduziert
widerspruechliche Bearbeitungen. Sie ersetzt keine serverseitigen
Transaktionen, Versionspruefungen oder Autorisierung. GerNetiX behauptet daher
nicht, dass zwei Sitzungen zwangslaeufig Daten korrumpieren; gespeicherte
Fachdaten muessen auch bei konkurrierenden Anfragen konsistent bleiben.

Nicht als persoenliche Sitzung gelten technische Device-, Worker-, Service-
und API-Identitaeten. Mehrpersonenangebote verwenden je Person ein eigenes
Login und ausdrueckliche Projekt- oder Geraeteberechtigungen.

## Verbindliche Datenschutzgrenze

Die Entscheidung basiert ausschliesslich auf dem serverseitigen
Sitzungszustand desselben Kontos. IP-Adresse, Standort, VPN-Erkennung und
invasives Browser-Fingerprinting sind weder Erkennungsmerkmal noch
Entscheidungsgrundlage. Eine zufaellige Sitzungskennung enthaelt keine
Hardware- oder Personenmerkmale. Auditdaten werden zweckgebunden minimiert und
erhalten eine festgelegte Aufbewahrungsfrist.

## Nutzerablauf

Nach erfolgreicher Authentifizierung prueft Identity atomar, ob bereits eine
aktive Hauptsitzung besteht. Ohne bestehende Hauptsitzung wird der Zugang
normal freigegeben. Andernfalls bleibt der neue Login bis zur Entscheidung in
einem begrenzten Uebernahmezustand und kann keine geschuetzten Fachdaten lesen
oder veraendern.

Der Dialog erklaert:

> Fuer dieses persoenliche GerNetiX-Konto ist nur eine aktive Sitzung
> gleichzeitig zulaessig. Dadurch werden widerspruechliche Bearbeitungen
> vermieden. Wenn du fortfaehrst, wird die bisherige Sitzung abgemeldet. Dort
> noch nicht gespeicherte Eingaben koennen verloren gehen.

Er bietet genau diese fachlichen Entscheidungen:

- **Abbrechen:** Der neue Anmeldeversuch endet; die bisherige Sitzung bleibt
  unveraendert aktiv.
- **Andere Sitzung abmelden und fortfahren:** Die bisherige Sitzung wird
  atomar widerrufen, danach wird die neue Sitzung aktiv.
- **Anmeldung nicht erkannt - Konto sichern:** Alle anderen normalen Sitzungen
  werden widerrufen. Die gerade erneut authentifizierte Sitzung bleibt erhalten
  und fuehrt in den kontrollierten Passwort-/Passkey-Sicherungsablauf, damit ein
  Konto ohne vorbereitetes Offline-Recovery-Set nicht ausgesperrt wird.

Die verdraengte Sitzung erhaelt bei der naechsten Anfrage einen eindeutigen
Hinweis auf die Konto-Uebernahme. Sie darf sich nicht automatisch erneut
anmelden oder die neue Sitzung verdraengen. Serverseitig gespeicherte Projekte,
Geraete, Berechtigungen, Builds und bereits angenommene Jobs werden nicht
geloescht. Noch nicht gespeicherte Browserinhalte koennen verloren gehen und
werden deshalb vor der Uebernahme ausdruecklich genannt.

## Zustands- und Integritaetsvertrag

Der logische Sitzungszustand unterscheidet mindestens:

- `pending_takeover`: erfolgreich authentifiziert, aber ohne Fachzugriff;
- `active`: einzige zugriffsberechtigte persoenliche Hauptsitzung;
- `revoked`: ausdruecklich widerrufen, insbesondere durch Uebernahme;
- `expired`: aufgrund der serverseitigen Laufzeit nicht mehr gueltig.

Ein offener Tab und reine Mausbewegungen sind keine eigene fachliche Wahrheit.
Alle geschuetzten HTTP-Endpunkte und dauerhaften Verbindungen pruefen den
serverseitigen Zustand. Ein altes Cookie darf eine widerrufene Sitzung nicht
reaktivieren. Zwei gleichzeitige Uebernahmeversuche duerfen niemals zwei aktive
Hauptsitzungen erzeugen.

Bereits angenommene serverseitige Jobs behalten einen eindeutigen Status und
werden nicht allein wegen des Browserwechsels geloescht. Neue Steueraktionen
verlangen die aktive Sitzung. Schreibende Fachdienste bleiben fuer atomare,
idempotente oder versionsgeschuetzte Verarbeitung verantwortlich. Besonders
KI-Aufrufe und andere kostenpflichtige Vorgange duerfen nach Sitzungsentzug
nicht neu begonnen oder doppelt gebucht werden.

## Arbeitspakete und Akzeptanzkriterien

### DS-01 - Fachlicher Sitzungsvertrag

#### DS-01.1 Kontotypen und Geltungsbereich

- Einzelkonto, Mehrpersonenkonto und technische Identitaet sind eindeutig
  unterschieden.
- Genau eine aktive interaktive Sitzung gilt nur fuer persoenliche
  Einzelkonten.
- Maschinenidentitaeten verdraengen keine Browsersitzung.
- Gemeinsame Nutzung erfolgt ueber eigene Nutzeridentitaeten, nicht geteilte
  Zugangsdaten.

#### DS-01.2 Aktive Sitzung und Zustandsautomat

- Jeder Sitzungszustand und jeder erlaubte Uebergang ist dokumentiert.
- Pro Einzelkonto kann hoechstens eine Sitzung `active` sein.
- `revoked` und `expired` erhalten keinen geschuetzten Zugriff mehr.
- Browser-Schliessen fuehrt nicht zu einer dauerhaft blockierten Anmeldung;
  eine maximale Laufzeit ist festgelegt.

#### DS-01.3 Geraetewechsel und Kommunikation

- Der Wechsel zwischen eigenen Geraeten ist ohne Support moeglich.
- Die neue Sitzung wird erst nach ausdruecklicher Bestaetigung aktiv.
- Abbruch veraendert die bestehende Sitzung nicht.
- Produkt-, Hilfe- und Nutzungsregel erklaeren dieselbe Ein-Sitzungs-Regel.

#### DS-01.4 Datenschutzgrenze

- IP, Standort, VPN-Erkennung und Browser-Fingerprint beeinflussen die
  Entscheidung nicht.
- Datenfelder, Zweck und Aufbewahrungsfrist sind dokumentiert.
- Sitzungsdaten werden nicht fuer Werbung oder Verhaltensprofile verwendet.

### DS-02 - Persistentes Sitzungsregister

#### DS-02.1 Datenmodell und Geheimnisschutz

- Sitzung enthaelt Konto, Zustand, Erstellungs-, Aktivitaets-, Ablauf- und
  Widerrufszeit sowie Widerrufsgrund.
- Geheimnisse werden nur technisch geschuetzt beziehungsweise gehasht
  persistiert.
- PostgreSQL bleibt fuer normale Identity-Laufzeit fuehrend; Serverneustart
  verliert den Zustand nicht.
- Konten koennen gegenseitig weder Sitzungen lesen noch beeinflussen.

#### DS-02.2 Atomare Ein-Sitzungs-Garantie

- Die Persistenz erzwingt hoechstens eine aktive Hauptsitzung pro Einzelkonto.
- Bei zwei parallelen Logins oder Uebernahmen gewinnt genau einer.
- Prozessabbruch erzeugt weder zwei aktive Sitzungen noch eine dauerhafte
  Kontosperre.
- Parallelitaet wird mit einem automatisierten Datenbanknachweis geprueft.

#### DS-02.3 Ablauf und Bereinigung

- Abgelaufene Sitzungen werden an jeder Schutzgrenze abgewiesen.
- Bereinigung loescht keine fachlichen Kunden- oder Projektdaten.
- Auditdaten werden nach der festgelegten Frist minimiert oder entfernt.

#### DS-02.4 Schutz aller Endpunkte

- Jede geschuetzte API prueft Sitzung und Status serverseitig.
- Widerruf sperrt Lesen, Schreiben, Buildsteuerung, Geraeteverwaltung und neue
  KI-Nutzung.
- Alte Cookies und manipulierter Browserzustand umgehen die Sperre nicht.

### DS-03 - Login- und Uebernahmeablauf

#### DS-03.1 Begrenzter Uebernahmezustand

- Der Dialog erscheint erst nach erfolgreicher Authentifizierung.
- `pending_takeover` besitzt keinen normalen Plattform- oder Fachdatenzugriff.
- Passwort-, Passkey- und Recovery-Login verhalten sich konsistent.

#### DS-03.2 Uebernahmedialog

- Der Dialog erklaert Regel, Zweck und moeglichen Verlust ungespeicherter
  Eingaben vor der Bestaetigung.
- Er behauptet keinen Verlust gespeicherter Projekte.
- Abbrechen, Uebernehmen und Konto sichern sind auf Desktop, Tablet und mobil
  eindeutig sowie tastaturbedienbar.
- Reload, Zuruecknavigation und Doppelklick erzeugen keinen inkonsistenten
  Zustand.

#### DS-03.3 Abbruch

- Nur der neue Anmeldeversuch endet.
- Die bestehende Sitzung bleibt aktiv und nutzbar.
- Ein spaeterer Login startet einen neuen, unabhaengigen Entscheidungsablauf.

#### DS-03.4 Atomare Uebernahme

- Die alte Sitzung wird widerrufen, bevor die neue freigeschaltet wird.
- Nach Erfolg existiert genau eine aktive Sitzung.
- Wiederholtes Absenden ist idempotent.
- Zeitpunkt und minimierter Grund werden auditiert.

### DS-04 - Verhalten der verdraengten Sitzung

#### DS-04.1 Zugriffsentzug

- Spaetestens die naechste Serveranfrage weist die alte Sitzung eindeutig ab.
- Nach Widerruf kann keine neue fachliche Aenderung begonnen werden.
- Der Entzug gilt konsistent ueber alle Identity-Instanzen.

#### DS-04.2 Nutzerhinweis

- Die alte Sitzung unterscheidet Uebernahme, normalen Ablauf und allgemeinen
  Authentifizierungsfehler.
- Sie zeigt keine Informationen ueber das andere Geraet oder dessen Nutzer.
- Sie bietet erneutes Anmelden, Konto sichern und einen oeffentlichen Ausgang.

#### DS-04.3 Dauerhafte Verbindungen

- SSE-/WebSocket-Verbindungen werden zeitnah geschlossen.
- Danach werden keine geschuetzten Daten mehr uebertragen.
- Automatische Wiederverbindung mit der widerrufenen Sitzung wird abgewiesen.

#### DS-04.4 Laufende Servervorgaenge

- Bereits angenommene Builds und Jobs behalten Eigentum, Status und Auditspur.
- Neue Steueraktionen verlangen die neue aktive Sitzung.
- Fuer jeden sicherheitskritischen Vorgang ist Weiterlaufen, Pausieren oder
  sicheres Beenden festgelegt.

### DS-05 - Konto sichern

#### DS-05.1 Globaler Sitzungswiderruf

- Alle anderen normalen Sitzungen werden widerrufen.
- Die gerade erneut authentifizierte Sitzung bleibt fuer den Sicherungsablauf
  erreichbar; ein fehlendes Offline-Recovery-Set sperrt das Konto nicht aus.
- Alte Sitzungskennungen koennen nicht wiederverwendet werden.

#### DS-05.2 Passwort und Passkeys

- Passwortaenderung verlangt eine angemessene erneute Identitaetspruefung.
- Das alte Passwort ist danach unwirksam.
- Passkeys werden mit verstaendlichem Namen und Erstellungszeit angezeigt und
  koennen einzeln entfernt werden.
- Der letzte nutzbare Anmeldeweg wird erst nach sicherem Ersatz entfernt.

#### DS-05.3 Abschluss und Abbruch

- Der Nutzer sieht den erreichten Sicherungsstatus und noch offene Schritte.
- Bestatigungen enthalten keine geheimen Token oder fremde Geraetedaten.
- Ein abgebrochener Ablauf laesst das Konto nicht unbemerkt vollstaendig offen.

### DS-06 - Datenintegritaet und Kostenschutz

#### DS-06.1 Inventur schreibender Vorgange

- Projektdateien, Devices, Builds, Kontoeinstellungen, Passkeys,
  Berechtigungen, KI-Vorgaenge und Bestellungen besitzen eine dokumentierte
  Konfliktstrategie.
- Kein fachlich fuehrender Stand liegt ausschliesslich im Browser.
- Nicht inventarisierte Schreibpfade blockieren die Produktfreigabe.

#### DS-06.2 Versions- und Wiederholungsschutz

- Veraenderliche Datensaetze verwenden erwartete Version, Transaktion oder
  gleichwertigen Konfliktschutz.
- Veraltete Anfragen ueberschreiben keinen neueren Stand.
- Wiederholte Requests erzeugen keine doppelten Datensaetze oder Buchungen.

#### DS-06.3 Ungespeicherte Browserdaten

- Der Uebernahmedialog nennt den moeglichen Verlust klar.
- GerNetiX verspricht keine Wiederherstellung ohne technische Garantie.
- Lokale Entwuerfe gelten nie als fuehrender Projektstand.

#### DS-06.4 KI- und kostenpflichtige Vorgaenge

- Vor einem neuen kostenpflichtigen Vorgang wird die Sitzung erneut geprueft.
- Jeder angenommene Vorgang besitzt eine eindeutige, idempotente Vorgangs-ID.
- Ein KI-Aufruf wird hoechstens einmal gebucht.
- Eine widerrufene Sitzung kann keine neuen variablen Kosten ausloesen.

### DS-07 - Tarif- und Mehrpersonenabgrenzung

#### DS-07.1 Sichtbare Einzelkonto-Regel

- Tarifseite, Checkout, Hilfe und Nutzungsregel widersprechen sich nicht.
- Vor Kauf ist erkennbar, dass ein Einzelkonto nur eine aktive Sitzung besitzt.
- Eigene Geraete duerfen gewechselt werden.

#### DS-07.2 Zusammenarbeit mit eigenen Identitaeten

- Jede eingeladene Person besitzt ein eigenes Login.
- Projekt- und Geraetezugriffe werden rollenbasiert erteilt und entzogen.
- Auditereignisse sind der handelnden Identitaet zuordenbar.

#### DS-07.3 Faire Begruendung

- Kommunikation nennt Konfliktschutz und die Reduktion von Konto-Sharing.
- Sie behauptet nicht, dass technische Integritaet allein von der
  Ein-Sitzungs-Regel abhaengt.

### DS-08 - Datenschutz, Nachweis und Einfuehrung

#### DS-08.1 Datenschutz- und Aufbewahrungsnachweis

- Datenschutzhinweis beschreibt Zweck, Datenfelder und Frist.
- IP-/Standortdaten sind kein Bestandteil der Sharing-Erkennung.
- Auskunft, Loeschung und gesetzliche Aufbewahrung sind beruecksichtigt.

#### DS-08.2 Unit-, Datenbank- und API-Tests

- Tests decken alle Zustaende, Ablauf, Widerruf, Neustart und Parallelitaet ab.
- Jede geschuetzte API weist widerrufene Sitzungen mit stabilem Fehlercode ab.
- Uebernahme, Abbruch und Kontosicherung sind idempotent getestet.
- Maschinenidentitaeten werden nicht versehentlich verdraengt.

#### DS-08.3 Browser-End-to-End-Nachweis

- Browser A meldet sich an; Browser B kann abbrechen oder uebernehmen.
- Nach Uebernahme kann Browser A keine geschuetzte Aktion mehr ausfuehren.
- Konto sichern widerruft alle anderen normalen Sitzungen und erhaelt den
  frisch authentifizierten Sicherungszugang.
- Ungespeichertes Formular und laufender Build zeigen das dokumentierte
  Verhalten.
- Desktop-, Tablet- und Mobilansicht sind bedienbar.

#### DS-08.4 Kontrollierte Einfuehrung

- Interne Testkonten durchlaufen den Gesamtpfad zuerst.
- Metriken erfassen nur Uebernahme, Abbruch und Kontosicherung ohne IP- oder
  Standortprofil.
- Support besitzt einen Diagnose- und Wiederherstellungsablauf.
- Eine kontrollierte Abschaltmoeglichkeit ist vorhanden.

## Umsetzungsreihenfolge

1. DS-01 und DS-06.1 legen Fachvertrag und kritische Schreibpfade fest.
2. DS-02 schafft persistente und atomare Durchsetzung.
3. DS-03 und DS-04 liefern Uebernahme und sicheren Zugriffsentzug.
4. DS-05 liefert die Reaktion auf Missbrauchsverdacht.
5. DS-06.2 bis DS-06.4 sichern Konflikte und variable Kosten ab.
6. DS-07 vereinheitlicht Tarif- und Produktkommunikation.
7. DS-08 liefert Datenschutz-, Test-, Browser- und Einfuehrungsnachweis.

## Architekturwirkung

Die Regel erweitert den bestehenden Identity Server, die vorhandene Auth
Session Management Component, die Identity API und das bestehende
Session/AuthToken-Datenmodell. Es entsteht kein neuer Serverprozess, keine neue
Portbelegung und keine neue Persistenzhoheit. Das zentrale PostgreSQL bleibt
die Identity-Wahrheit. Deshalb bleibt die gezeichnete Laufzeittopologie
unveraendert; die fachliche Prozessbeschreibung wird in der UML-Lesesicht
ergaenzt.
