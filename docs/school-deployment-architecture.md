# School-Deploymentgrenze und KI-Provider

## Status und Zweck

Diese Entscheidung ist als Architekturleitplanke akzeptiert. GerNetiX School
wird noch nicht implementiert. Aktuelle Cloud- und Plattformaenderungen muessen
aber so geschnitten bleiben, dass dieselben fachlichen Dienste spaeter als
eigenstaendige lokale School-Deployment-Zelle betrieben werden koennen.

## Eigenstaendige Deployment-Zelle

Eine School-Installation ist kein Client und kein Worker des zentralen
GerNetiX-VPS. Sie besitzt ihre eigene Laufzeit und ihre eigenen fachlichen
Wahrheiten, insbesondere:

- eigene Identity, Konten, Sitzungen und lokale Rollen,
- eigenes PostgreSQL fuer fachliche Laufzeitdaten,
- eigenes Forgejo fuer Projektdateien und Git-Historie,
- eigenen Artifact Store fuer Builds und Firmware,
- eigene Compute Control Plane samt Worker Gateway,
- eigenes Device Management sowie lokales MQTT und OTA,
- eigene Instanz-, Dienst-, Worker-, Device- und OTA-Schluessel.

Es gibt keinen direkten Datenbankzugriff, keine gemeinsam verwendeten Sessions
und keine geteilten privaten Schluessel zwischen School und Haupt-VPS. Der
Unterricht, lokale Builds, Geraetebetrieb und lokales OTA duerfen weder Cloud-
Login noch DNS-, KI-, Telemetrie- oder Lizenzaufrufe zum Haupt-VPS voraussetzen.

Spaetere Herstellerverbindungen fuer signierte Updates, Lizenzverlaengerung,
Inhaltsimport, Support oder einen bewusst freigegebenen Datenaustausch sind
optional, zweckgebunden und grundsaetzlich von der School-Installation ausgehend.
Ein Export oder Import ist ein sichtbarer Vorgang mit Konflikt- und
Einwilligungsregeln, keine Datenbankreplikation und kein zweiter Datenmaster.

## Leitplanken fuer die heutige Architektur

Bis GerNetiX School priorisiert wird, gelten fuer neue Plattformaenderungen nur
folgende Portabilitaetsregeln:

1. Oeffentliche Origins, interne Serviceziele, MQTT-Ziele und Provider werden
   konfiguriert und nicht als Haupt-VPS-Adresse in Domaenenlogik eingebaut.
2. Kein Dienst liest oder schreibt direkt die Datenbank eines anderen Dienstes.
3. Externe Provider, E-Mail und Cloud-Telemetrie sind optionale Adapter und
   keine Startvoraussetzung fuer lokale Kernfunktionen.
4. BuildPackages bleiben vollstaendig, versioniert und aus einem festen
   Git-Commit reproduzierbar.
5. Build- und spaetere School-Worker registrieren Faehigkeiten beim lokalen
   Worker Gateway, beziehen Lease und Eingaben ueber dessen API und erhalten
   keinen direkten PostgreSQL- oder Forgejo-Administrationszugang.
6. Produktberechtigungen werden gegen eine gekapselte Capability-Entscheidung
   geprueft. Domaenencode setzt keinen Online-Aufruf zu einem zentralen
   Lizenzdienst voraus.
7. Installationskennungen werden an Austausch-, Lizenz-, Zertifikats- und
   Worker-Pairing-Grenzen gefuehrt. Das allgemeine Domaenenmodell erhaelt nicht
   vorsorglich ein `school_id`.

Diese Regeln verlangen heute weder einen School-Compose-Stack noch lokale
School-Konten, Klassenraeume, Zertifikatsverteilung oder Synchronisationslogik.

## KI-Provider in School

Externe KI ist in einer School-Installation standardmaessig deaktiviert. Eine
School-Lizenz enthaelt keinen durch GerNetiX finanzierten oder ueber den
GerNetiX-VPS vermittelten OpenAI-Zugang.

Zulaessig sind spaeter genau folgende Modi:

| Modus | Regel |
| --- | --- |
| Keine KI | Vollstaendiger School-Kernbetrieb ohne Modell oder Provider |
| Lokale KI | Optionales, lokal betriebenes und ausdruecklich freigegebenes Modell ohne externen Provider |
| Externe KI mit BYOK | Die Schule konfiguriert bewusst einen eigenen OpenAI- oder anderen freigegebenen Providerzugang und traegt Kosten sowie Providervertrag selbst |

Fuer BYOK gelten verbindlich:

- Der Provider-Schluessel gehoert der Schule und wird nur in der lokalen
  School-Installation als Secret gespeichert.
- Der Schluessel wird weder an den GerNetiX-VPS uebertragen noch in Browser,
  Projektdateien, Logs, Exporte, Supportpakete oder Telemetrie aufgenommen.
- Provideraufrufe laufen direkt von der School-Installation zum konfigurierten
  Provider und verwenden keine GerNetiX-Credits oder einen GerNetiX-Proxy.
- Provider, Modell, erlaubte Zwecke, Datenquellen und Redaktionsstufe werden
  durch lokale AI-Context-Policy und Grants deny-by-default begrenzt und
  auditiert.
- Ohne konfigurierten oder erreichbaren Provider bleiben Projekte, Builds,
  Lernen, Geraetebetrieb und lokales OTA funktionsfaehig; nur die betroffene
  KI-Funktion wird als nicht verfuegbar angezeigt.
- Schluesselrotation, Widerruf, Kostenlimits und die datenschutzrechtliche
  Freigabe liegen bei der Schule. GerNetiX zeigt diese Verantwortungsgrenze
  vor der Aktivierung sichtbar an.

Die konkrete Secret-Persistenz, Administrationsoberflaeche, Provider-Allowlist
und Datenschutzabnahme werden erst mit der School-Implementierung festgelegt
und sicherheitstechnisch nachgewiesen.

## Spaeterer Deploymentvertrag

School Core soll als kontrollierter, versionierter Docker-Compose-Stack fuer
Appliance, freigegebenen Schulserver oder VM ausgeliefert werden. Docker ist
dabei nur die reproduzierbare Betriebsbasis von GerNetiX School und kein fuer
Lehrkraefte oder Lernende geoeffneter allgemeiner Containerhost.

Der Compose-Stack, lokale TLS-/PKI-Einrichtung, Backup und Restore,
Offline-Lizenzpruefung, Updateimport sowie externe Worker-Registrierung sind
bewusste spaetere Arbeitspakete. Sie duerfen den aktuellen Haupt-VPS nicht zur
Laufzeitvoraussetzung machen.
