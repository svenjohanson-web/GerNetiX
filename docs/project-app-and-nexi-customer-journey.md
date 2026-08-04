# Projekt-App und Nexi aus Kundensicht

## Ziel

GerNetiX bietet Nutzern nicht nur eine Entwicklungsumgebung, sondern begleitet
ein Projekt von der Entdeckung bis zum Betrieb. Ein fertiges Projekt kann eine
eigene, vom Projektentwickler definierte Kundenoberflaeche besitzen. Bei Nexi
ist diese Oberflaeche eine Elternsteuerung; bei einem Sensorprojekt kann sie
Messwerte, Diagramme, Warnschwellen und Geraetestatus zeigen.

Die allgemeine Plattform kennt deshalb weder einen fest eingebauten
Elternbereich noch Nexi-spezifische Felder. Sie stellt eine sichere
`Projekt-App` bereit, deren Struktur versioniert aus dem Projekt stammt und
deren Kundenwerte account- und projektgebunden als Laufzeitdaten gespeichert
werden.

## Kundeneinstiege fuer Nexi

Ein Kunde findet Nexi im Bereich `Lernen & Entwickeln` und kann zwischen vier
klar getrennten Wegen waehlen:

1. **Nexi verwenden**: Eine bereits eingerichtete Nexi-Instanz und ihre
   Projekt-App oeffnen.
2. **Nexi nachbauen**: Hardwarebedarf, Zusammenbau, Firmware-Build, Flash und
   Funktionstest schrittweise durchlaufen.
3. **Nexi verstehen**: Als Lernprojekt nachvollziehen, wie Audio, Tasten, LEDs,
   Basissoftware, Datenschutz und die optionale KI-Erweiterung entstanden sind.
4. **Nexi weiterentwickeln**: Eine eigene, versionierte Projektkopie anlegen
   und Firmware, Assistentendefinition sowie Projekt-App erweitern.

Nexi Basic ist bereits ohne externen KI-Provider ein ehrliches nutzbares
Produkt. Aufnahme, Wiedergabe und lokale Stimmeffekte bleiben offline. Sprach-
und Internet-KI sind getrennte, spaeter aktivierbare Projektfaehigkeiten und
duerfen im Katalog nicht als bereits verfuegbar erscheinen, solange Provider,
Kontingent und Betreiberfreigabe fehlen.

## Projekt-App

Der Entwickler definiert die Kundenoberflaeche deklarativ im gebundenen
Projekt-Repository. Eine Definition darf ausschliesslich freigegebene Seiten,
Widgets, Datenbindungen und typisierte Aktionen enthalten. Freies JavaScript,
freie Netzwerkziele, Datenbankzugang und Secrets sind nicht Teil des Vertrags.

Der umgesetzte Vertrag `gernetix.project-app/v1` unterstuetzt:

- Text und erklaerende Hinweise,
- Status- und Messwertkarten,
- Schalter und Auswahlfelder,
- Zeitfenster,
- einfache Verlaufsdiagramme,
- typisierte Aktionsbuttons,
- sichtbare Lade-, Offline-, Fehler- und Berechtigungszustaende.

Zahlen- und Texteingaben mit Wertebereichen sind als naechste Erweiterung des
versionierten Vertrags vorgesehen. Bis dahin duerfen Projekte solche
Einstellungen nicht als interaktive Widgets deklarieren.

## Trennung der Wahrheiten

| Inhalt | Fuehrende Quelle |
| --- | --- |
| Seiten, Felder, Bindungen und Aktionen | Projektdateien im gebundenen Forgejo-Commit |
| Kundenwerte einer Projekt-App-Instanz | Project-Server-PostgreSQL als Projekt-Laufzeitdaten |
| Projekt- und Kontobesitz | Project Server |
| Geraetezuordnung, Authentizitaet und Verbindungsstatus | Device Management |
| Messwerte und Ereignisse | Telemetry Server |
| KI-Kontingent und Kosten | AI Usage Server |
| erzeugte Firmware | commitgebundenes Build-Artefakt |

Eine Aenderung der Projekt-App-Definition erzeugt einen Projekt-Commit. Eine
Kundeneinstellung wie Nexis Ruhezeit erzeugt keinen Quellcode-Commit, sondern
eine versionierte Laufzeitaenderung innerhalb der konkreten Projekt-App-
Instanz.

Project Server liefert der Plattform fuer die Erkennung einer Projekt-App nur
Pfad und Rolle der vorhandenen Projektdateien. Quellinhalte bleiben hinter der
projektgebundenen Datei-API und werden nicht mit der Projektuebersicht
ausgeliefert.

Beim Laden loest Identity nur die im validierten Manifest genannten
`device_status`-, `ai_usage`-, `project`- und `telemetry`-Bindungen auf. Der Geraetestatus
stammt ausschliesslich vom dem Projekt zugeordneten Account-Device. KI-Werte
stammen aus der serverseitig abgeleiteten Account-Nutzung. Faellt ein
Domaenendienst aus, bleibt die Projekt-App bedienbar und kennzeichnet nur den
betroffenen Wert als nicht verfuegbar. Telemetrie wird nur fuer die im Manifest
validierte Metrik aus dem sitzungsgebundenen Account und Projekt gelesen. Der
Scope `assigned_device` begrenzt sie zusaetzlich auf das exakt zugeordnete
Geraet. Je Bindung werden hoechstens die letzten 24 Werte ohne Metadaten an den
Browser ausgegeben; ein Manifest darf hoechstens 20 Telemetrie-Bindungen
definieren.

Ein kontrollierter Browserdurchstich prueft den echten Renderer und Controller
mit einer angemeldeten Testhuelle: Status, aktueller Messwert, Verlauf und eine
revisionsgeschuetzte Einstellungs-Aenderung funktionieren gemeinsam. Der
Live-Nachweis gegen Remote-Dev-PostgreSQL und die VPS-Domaenendienste bleibt ein
eigener Betriebsnachweis und setzt den kontrollierten Tunnel voraus.

## Nexi-Projekt-App

Nexi definiert auf der allgemeinen Projekt-App-Plattform unter anderem:

- Kinderprofil mit Vorname, Altersgruppe, Sprachen und Interessen,
- aktivierbare lokale und KI-gestuetzte Modi,
- Stimme und maximale Lautstaerke,
- Nutzungszeiten und Ruhezeit,
- erlaubte Websuche und zusaetzlich ausgeschlossene Themen,
- Konto- und Geraetekontingent,
- technischen Geraete- und Verbindungsstatus.

Diese Felder sind Bestandteil des Nexi-Projekts und kein globales
GerNetiX-Kundendatenmodell. Eine andere Projekt-App darf ein vollstaendig
anderes Schema besitzen.

## Sicherheits- und Abnahmeregeln

- Jede API leitet Account und Projekt aus der authentifizierten Sitzung ab.
- Ein Client darf weder Owner, Projekt noch Datenquelle durch Payloadfelder
  erweitern.
- Bindungen lesen nur freigegebene, typisierte Datenpfade.
- Aktionen besitzen Allowlist, Parameterschema und serverseitige
  Berechtigungspruefung.
- Projekt-App-Definition und Laufzeitwerte besitzen unabhaengige Versionen.
- Eine fremde Projekt-App-Instanz darf weder gelesen noch veraendert werden.
- Nexi Basic muss ohne externen KI-Provider voll nutzbar bleiben.
- Als Allgemeinheitsnachweis wird neben Nexi eine kleine Sensor-Projekt-App aus
  demselben Vertrag gerendert.
