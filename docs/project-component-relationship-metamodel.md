# Komponenten- und Beziehungsmetamodell fuer Entwicklungsprojekte

## Zweck

Die logische Projektarchitektur besteht aus fachlich typisierten Komponenten und explizit erlaubten Beziehungen. Ein Pfeil bedeutet nie nur „verbunden“, sondern eine benannte fachliche Aussage. Das verhindert ungueltige Architekturen wie `Sensor → PWA` und liefert zugleich die Grundlage fuer die Hardware-Zuordnung.

## Komponententypen

| Typ | Bedeutung | Hardware-Zuordnung |
| --- | --- | --- |
| Nutzer | Menschliche Rolle | keine |
| IoT-Device | Logische Steuer- oder Erfassungseinheit | Board und optional Inventar-Device |
| Sensor | Messquelle | genau ein steuerndes IoT-Device |
| Aktor | Physische Ausgabe | genau ein steuerndes IoT-Device |
| Mobile App (iOS & Android) | Gemeinsame native Bedien- oder Anzeigeanwendung mit getrennten Plattform-Builds | keine |
| Browser-App | Vom festgelegten Webserver ausgelieferte Browser-Anwendung; optional installierbar im PWA-Modus | keine |
| Server / API | Zentrale Anwendung oder lokaler Webservice | keine |
| Telemetrie-API | Verwaltet projektbezogenen Telemetrie-Ingress | GerNetiX-Infrastruktur, nicht vom Nutzer zu konfigurieren |
| Projekt-Speicher | Konto- und projektpartitionierte dauerhafte Projektdaten | GerNetiX-Infrastruktur, keine Nutzerkonfiguration |
| Benachrichtigungsdienst | Optionaler Versand von Projektbenachrichtigungen | GerNetiX-Infrastruktur; Nutzer aktiviert nur Push je Projekt |
| Projekt-Runtime-Daten | Projektgebundener Zustand und explizite Folgeereignisse | GerNetiX-Infrastruktur, keine Nutzerkonfiguration der Speicherung |
| Ereignis-Worker | Verarbeitet ein freigegebenes Ereignis mit einem begrenzten Regelauftrag | Nutzer konfiguriert Datenvertrag, Trigger und Regel; Ausfuehrung bleibt GerNetiX-Infrastruktur |
| Ereignis-Dispatcher | Stellt freigegebene Folgeereignisse per MQTT und/oder Push zu | Nutzer waehlt erlaubte Ziele und Kanaele; Ausfuehrung bleibt GerNetiX-Infrastruktur |

## Konfigurationsgrenzen

Die drei verwalteten Dienste erscheinen in einer Vorlage, damit Datenfluss, Eigentum und optionale Benachrichtigung nachvollziehbar bleiben. Sie werden jedoch weder neu angelegt noch technisch durch den Nutzer konfiguriert.

| Bereich | Nutzer konfiguriert | GerNetiX verwaltet |
|---|---|---|
| Telemetrie-API | Messquelle, Intervall, Messwertname und Einheit | Authentifizierung, konto- und projektbezogener Ingress, API-Endpunkte |
| Projekt-Speicher | Aufbewahrungsregel der eigenen Messwerte | Partitionierung nach Konto und Projekt, Persistenz, Zugriffsschutz |
| Benachrichtigungsdienst | Ereignisregel und die Push-Erlaubnis der Projekt-PWA | Push-Schluessel, Subscription-Verwaltung, Versand und Projektisolation |

Web Push ist damit kein Pflichtbestandteil eines Datenlogger-Projekts. Ohne Ereignisregel oder PWA-Erlaubnis werden keine Push-Subscriptions angelegt und der Projekt-Speicher funktioniert unveraendert. Die Projektarchitektur zeigt ausschliesslich die vom Nutzer fachlich zu konfigurierenden Komponenten; interne Annahme, Speicherung und Zustellung werden dort nicht als Komponenten dargestellt.

## Erlaubte Beziehungen

| Quelle | Beziehung | Ziel |
| --- | --- | --- |
| Nutzer | bedient lokal | IoT-Device |
| Nutzer | nutzt | Mobile App, Browser-App oder Server/API |
| Sensor | liefert Messwerte an | IoT-Device |
| IoT-Device | steuert | Aktor |
| IoT-Device | sendet Telemetrie an | Server/API |
| IoT-Device | sendet Telemetrie an | Telemetrie-API |
| Browser-App | wird vom Device-Webserver ausgeliefert | IoT-Device |
| Browser-App | wird vom Webserver ausgeliefert | Server/API |
| IoT-Device | loest Ereignisverarbeitung aus | Ereignis-Worker |
| Telemetrie-API | speichert projektbezogen | Projekt-Speicher |
| Telemetrie-API | loest optional Benachrichtigung aus | Benachrichtigungsdienst |
| Mobile App (iOS & Android) | zeigt Projektstatus von | IoT-Device |
| Mobile App oder Browser-App | liest und konfiguriert Projektdaten | Projekt-Speicher |
| Mobile App oder Browser-App im PWA-Modus | abonniert optional Projekt-Push | Benachrichtigungsdienst |
| Benachrichtigungsdienst | sendet optional Projekt-Push an | Mobile App oder Browser-App im PWA-Modus |
| Telemetrie-API | speichert Ereignis in Runtime-Daten | Projekt-Runtime-Daten |
| Projekt-Runtime-Daten | loest Ereignisverarbeitung aus | Ereignis-Worker |
| Ereignis-Worker | schreibt Zustand oder Folgeereignis | Projekt-Runtime-Daten |
| Ereignis-Worker | gibt freigegebenes Folgeereignis weiter | Ereignis-Dispatcher |
| Projekt-Runtime-Daten | stellt freigegebenes Folgeereignis bereit | Ereignis-Dispatcher |
| Ereignis-Dispatcher | stellt MQTT-Aktion zu | IoT-Device |
| Ereignis-Dispatcher | loest optional Projekt-Push aus | Benachrichtigungsdienst |
| Server/API | sendet Befehle an | IoT-Device |
| Mobile App oder Browser-App | nutzt API | Server/API |
| Server/API | sendet Push an | Mobile App oder Browser-App im PWA-Modus |
| IoT-Device | synchronisiert mit | IoT-Device |

Weitere Beziehungstypen werden erst als Metamodell-Erweiterung eingefuehrt, nicht als freier Pfeil im Projekteditor.

Die Mobile App ist eine eigenstaendige ausfuehrbare Projektkomponente und wird
als eine gemeinsame Software-Einheit mit den Zielplattformen iOS und Android
modelliert. Der Project Server fuehrt sie als `mobile_application`; konkrete
App-Store-Buildrunner sind noch nicht angeschlossen. Die Beziehung
`zeigt Projektstatus von` ist eine fachliche Sichtbeziehung und kein direkter
Netzwerkkanal zum IoT-Device. Datenzugriff und Anmeldung erfolgen spaeter ueber
GerNetiX-Server-APIs mit demselben Account wie die Plattform.

Ein nativer Frontend-Builder wird spaeter innerhalb der Mobile-App-Komponente
angesiedelt. Er ist weder der bestehende PWA-Dashboard-Editor noch Teil dieses
ersten Modellierungsschritts. Ein eigenes Mobile-App-Projekttemplate folgt
ebenfalls erst als separater Schritt.

Eine PWA ist keine eigene neue Architekturkomponente. Sie ist eine
Bereitstellungsoption der Browser-App mit Web-App-Manifest, Service Worker,
Home-Bildschirm-Installation und optionalem Web Push. Der historische interne
Typ `smartphone_app` bleibt ausschliesslich erhalten, damit bestehende
PWA-Projekte weiter gelesen und bearbeitet werden koennen; die
Komponentenauswahl legt neue PWA-faehige Oberflaechen als `browser_app` an.

Jede Browser-App benoetigt zwingend einen ausliefernden Webserver. Beim
Hinzufuegen wird deshalb genau ein vorhandenes IoT-Device oder eine
Server/API-Komponente als Webserver gewaehlt. Die Hosting-Beziehung speichert
ausserdem verpflichtend die Reichweite `nur lokales Netzwerk / Intranet` oder
`ueber Internet erreichbar`. Diese Architekturentscheidung exponiert noch
keinen technischen Dienst. Fuer eine spaetere Internet-Veroeffentlichung sind
TLS, Authentifizierung, Zugriffsschutz und ein Sicherheitsnachweis erforderlich.

Die technische Vermittlung ueber MQTT, REST, Web Push, Topics, Subscriptions und API-Endpunkte ist keine Nutzerkomponente. GerNetiX leitet sie intern aus der fachlichen Beziehung ab und zeigt sie nur in technischen, schreibgeschuetzten Sichten.

Eine Datenlogger-Aufbewahrung ist ebenfalls keine Architekturkomponente: Sie ist eine Konfiguration der Messwerterfassung am Sensor. Die PWA-Datenlogger-Vorlage aktiviert dafuer die projektprivate Datenhaltung als Grundfunktion; konkrete Speichergrenzen und Aufbewahrungsregeln folgen in der Sensor-Konfiguration.

## Ableitung fuer die Hardware-Zuordnung

Die Zuordnung wird aus der Beziehung abgeleitet, nicht aus der Reihenfolge im Editor:

- `Sensor → IoT-Device`: Das Ziel ist die Steuereinheit des Sensors.
- `IoT-Device → Aktor`: Die Quelle ist die Steuereinheit des Aktors.

Damit kann die Hardware-View Sensoren und Aktoren nur dem logisch passenden IoT-Device zuordnen. Alle anderen Komponententypen erhalten keine Board- oder Pinzuordnung.

## Validierung im Editor

Beim Hinzufuegen zeigt der Editor nur erlaubte Beziehungsoptionen. Eine Browser-App verlangt dabei einen Webserver-Host und dessen Reichweite; Sensoren und Aktoren verlangen ihre Steuereinheit. Vor dem Wechsel zur Hardware prueft der Editor, ob jede Komponente in mindestens einer erlaubten Beziehung vorkommt und ob keine unzulaessige Beziehung gespeichert ist. Befunde erscheinen als konkrete Hinweise mit Komponentenname und Beziehung.

## Administrative Sicht

Die private Operator Console stellt das Metamodell im Reiter `Metamodell` als schreibgeschuetztes UML-Klassendiagramm und als Beziehungstabelle dar. Sie liest die Komponententypen und Regeln aus derselben ausfuehrbaren Regelquelle wie der Projekteditor. Der Endpunkt bleibt durch den bestehenden Admin-Access-Proxy geschuetzt.
