# Projekt-App und Nexi aus Kundensicht

## Ziel

GerNetiX bietet Nutzern nicht nur eine Entwicklungsumgebung, sondern begleitet
ein Projekt von der Entdeckung bis zum Betrieb. Ein fertiges Projekt kann eine
eigene, vom Projektentwickler definierte Projektoberflaeche besitzen. Bei Nexi
ist diese Oberflaeche eine Elternsteuerung; bei einem Sensorprojekt kann sie
Messwerte, Diagramme, Warnschwellen und Geraetestatus zeigen.

Die allgemeine Plattform kennt deshalb weder einen fest eingebauten
Elternbereich noch Nexi-spezifische Felder. Sie rendert eine sichere
Projektoberflaeche, deren Struktur versioniert aus dem Projekt stammt und deren
Werte je persoenlicher Anwendungsinstanz account- und projektgebunden als
Laufzeitdaten gespeichert werden. `Projekt-App` bleibt vorerst der interne
Schema- und API-Name; die Nutzeroberflaeche spricht von Anwendung und
Projektoberflaeche.

## Begriffsmodell und Haupteinstiege

| Begriff | Bedeutung |
| --- | --- |
| Projekt | Versionierte Entwicklung mit Architektur, Hardware, Quellcode und Builds |
| Projektoberflaeche | Vom Projekt definierte sichere Bedienansicht mit Seiten, Widgets, Bindungen und erlaubten Aktionen |
| Anwendung | Nutzerbegriff fuer eine persoenliche, verwendbare Instanz eines Projekts mit Projektoberflaeche |
| Dashboard | Eine Uebersichtsseite innerhalb einer Projektoberflaeche, nicht die gesamte Anwendung |
| Auslieferungsform | Darstellung in der GerNetiX-Webplattform; spaeter optional installierbare PWA oder native Huelle, ohne ein neues Fachmodell zu erzeugen |

`Meine Anwendungen` ist ein eigener Hauptbereich neben Entwicklungs- und
Lernbereichen. Dort werden nur persoenliche Projekte mit einer deklarierten
Projektoberflaeche angezeigt. Die Entwicklungsprojektverwaltung darf dieselbe
Anwendung als Vorschau beziehungsweise Nutzungseinstieg oeffnen, bleibt aber
der Ort fuer Quellcode und Definition. Beim Aufruf der Uebersicht werden nur
bereits vorhandene Projekt- und Geraetemetadaten verwendet; Manifest,
Laufzeitwerte und Bindungen werden erst beim Oeffnen einer Anwendung geladen.

Ein Projekt kann spaeter mehrere fachlich getrennte Anwendungsinstanzen
erzeugen. Beispielsweise definiert ein Tamagotchi-Projekt die gemeinsame
Oberflaeche, waehrend `Naomis Tamagotchi` und `Toms Tamagotchi` jeweils eigene
Geraetezuordnung, Einstellungen und Laufzeitwerte besitzen. Die aktuelle erste
Ausbaustufe bildet eine persoenliche Anwendung noch durch ihr accountgebundenes
Projekt ab. Diese Anwendung kann bereits bis zu 16 kompatible Account-Geraete
gemeinsam verwalten. Ein eigenstaendiges Mehrinstanzenmodell mit voneinander
getrennten Laufzeitwerten bleibt ein nachfolgender Ausbauschritt und wird nicht
durch reine UI-Duplikation vorgetaeuscht.

## Kundeneinstiege fuer Nexi

Nexi ist ein eigenständiger öffentlicher Produkteinstieg und wird direkt auf
der GerNetiX-Startseite vor den allgemeinen Lernwegen vorgestellt. Die
Startseite führt entweder zum fertigen Nachbau- und Flashweg oder – nach der
Anmeldung – zu den persönlichen Anwendungen. Nexi darf damit nicht nur als
Unterpunkt des Nachbaukatalogs oder der Lern- und Entwicklungsplattform
auffindbar sein.

Im angemeldeten Bereich kann ein Kunde zwischen vier klar getrennten Wegen
wählen:

1. **Nexi verwenden**: Eine bereits eingerichtete Nexi-Instanz und ihre
   Projekt-App oeffnen.
2. **Nexi nachbauen**: Hardwarebedarf, Zusammenbau, Firmware-Build, Flash und
   Funktionstest schrittweise durchlaufen.
3. **Nexi verstehen**: Als Lernprojekt nachvollziehen, wie Audio, Tasten, LEDs,
   Basissoftware, Datenschutz und die optionale KI-Erweiterung entstanden sind.
4. **Nexi weiterentwickeln**: Eine eigene, versionierte Projektkopie anlegen
   und Firmware, Assistentendefinition sowie Projekt-App erweitern.

Der öffentliche Detail- und Flash-Einstieg liegt unter
`/nachbauprojekte/nexi-sprachassistent/`. Er beschreibt Hardware, lokale
Funktionen, Installation und Bedienung sowie die Grenze zur optionalen KI.
Nach der Anmeldung fuehrt er gezielt zum Nachbau-Einstieg; die Projektuebersicht
zeigt danach alle vier Wege getrennt. `Verwenden` wird erst aktiv, wenn eine
persoenliche Nexi-Instanz existiert.

| Einstieg | Ziel | Abnahmekriterium |
| --- | --- | --- |
| Verwenden | Projekt-App der persoenlichen Instanz | kein Katalog-Dummy und keine fremde Instanz |
| Nachbauen | Schritt `nexi-build` | Material, Build, Flash und Hardwaretest sichtbar |
| Verstehen | Schritt `nexi-local` | lokaler Produktkern vor optionaler KI erklaert |
| Weiterentwickeln | eigene IDE-Projektkopie | Waveshare-Profil, Voice-Lab-Code und Projekt-App vorhanden |

Nexi Basic ist bereits ohne externen KI-Provider ein ehrliches nutzbares
Produkt. Aufnahme, Wiedergabe und lokale Stimmeffekte bleiben offline. Sprach-
und Internet-KI sind getrennte, spaeter aktivierbare Projektfaehigkeiten und
duerfen im Katalog nicht als bereits verfuegbar erscheinen, solange Provider,
Kontingent und Betreiberfreigabe fehlen.

Die Kundensicht erklärt diesen Ausbau immer funktionsorientiert in derselben
Reihenfolge: lokale Nachbaufunktionen ohne Konto, persönliche Verwaltung mit
kostenlosem Konto und optionale Sprach-KI mit ausdrücklicher Aktivierung,
freigegebenem Provider und verfügbarem Kontingent. Ein fehlender KI-Vertrag
darf nicht nur als „nicht freigeschaltet“ erscheinen. Die Oberfläche nennt,
welche Voraussetzung fehlt, warum sie erforderlich ist und was der Nutzer
heute bereits tun kann.

## Projektoberflaeche

Der Entwickler definiert die Projektoberflaeche deklarativ im gebundenen
Projekt-Repository. Eine Definition darf ausschliesslich freigegebene Seiten,
Widgets, Datenbindungen und typisierte Aktionen enthalten. Freies JavaScript,
freie Netzwerkziele, Datenbankzugang und Secrets sind nicht Teil des Vertrags.

Der umgesetzte Vertrag `gernetix.project-app/v1` unterstuetzt:

- Text und erklaerende Hinweise,
- Status- und Messwertkarten,
- Schalter und Auswahlfelder,
- Zeitfenster,
- typisierte Text- und Zahleneingaben mit serverseitigen Wertebereichen,
- einfache Verlaufsdiagramme,
- typisierte Aktionsbuttons,
- sichtbare Lade-, Offline-, Fehler- und Berechtigungszustaende.

Die Eingabefelder duerfen nur an deklarierte Einstellungen gleichen Typs
gebunden sein. Zahlenbereiche werden im Manifest, im Renderer und beim
serverseitigen Speichern geprueft.

## Trennung der Wahrheiten

| Inhalt | Fuehrende Quelle |
| --- | --- |
| Seiten, Felder, Bindungen und Aktionen | Projektdateien im gebundenen Forgejo-Commit |
| Kundenwerte einer Projekt-App-Instanz | Project-Server-PostgreSQL als Projekt-Laufzeitdaten |
| Projekt- und Kontobesitz | Project Server |
| Geordnete Geraetezuordnung einer Anwendung | Project Server |
| Geraetebesitz, Authentizitaet und Verbindungsstatus | Device Management |
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
`device_status`-, `ai_usage`-, `project`- und `telemetry`-Bindungen auf. Eine
Anwendung darf hoechstens 16 kompatible Geraete aus dem Accountinventar
zuordnen. Identity prueft Besitz und Hardwareprofil vor jeder Aenderung; der
Project Server speichert die geordnete Liste und haelt das erste Geraet als
rueckwaertskompatibles Primaergeraet. Die Geraeteuebersicht zeigt Status und
Firmware pro Geraet. Bestehende skalare `device_status`- und
`assigned_device`-Telemetriebindungen beziehen sich weiterhin eindeutig auf
dieses Primaergeraet. KI-Werte
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
revisionsgeschuetzte Einstellungs-Aenderung funktionieren gemeinsam. Am
2026-08-04 wurde Nexi ausserdem mit einer echten Passkey-Sitzung ueber den
kontrollierten Remote-Dev-Tunnel gegen Project Server, AI Usage und
PostgreSQL auf Staging geoeffnet. Der direkte Wiedereinstieg ueber
`/app/project-app/` ist Bestandteil dieses Nachweises. Dynamische JSON-Antworten
werden nicht im Browsercache gehalten; Projekt-App-Leseaufrufe verwenden
zusaetzlich einen eindeutigen Cache-Schluessel. Wiederholte PostgreSQL-Updates
sind durch eine atomare Compare-and-Set-Abfrage und Regressionstests abgedeckt.

## Nexi-Projekt-App

Nexi definiert auf der allgemeinen Projekt-App-Plattform unter anderem:

- bis zu 16 kompatible Nexi-Geraete mit Name, Verbindungs- und Firmwarestatus,
- sichtbare, verbindliche Hardware-Mindestanforderungen: ESP32-S3,
  Audio-Treiber, drei integrierte Bedientasten und zwei integrierte
  Mikrofonkanaele mit Treiber,
- gemeinsame Familienregeln und Limits fuer alle zugeordneten Geraete,
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

Das materialisierte Nexi-Projekt enthaelt nicht nur diese Oberflaeche, sondern
auch das reale Ziel `hardware.processor_board.waveshare_esp32_s3_audio_board`,
das PlatformIO-Environment `waveshare_esp32_s3_audio_board`, 16 MB Flash, die
geschuetzte GerNetiX-Basissoftware und die Voice-Lab-Erweiterung als
`Komponenten/IoT-Device 1/src/user_main.cpp`. Bereits angelegte Nexi-Projekte
mit dem frueheren generischen ESP32-Profil werden beim erneuten Einstieg
gezielt auf diesen Nexi-Vertrag angehoben; andere Lernprojekte oder bereits
vollstaendige Nexi-Quellen werden dabei nicht ueberschrieben.

Die Anforderungen sind Bestandteil des validierten Projekt-App-Manifests und
keine lose UI-Beschreibung. Identity gleicht ein Account-Device mit seinem
ProcessorBoard im Hardware Catalog ab. Ein Geraet bleibt in der Auswahl
sichtbar, ist bei fehlenden Eigenschaften jedoch deaktiviert und nennt die
fehlenden Merkmale. Fuer die aktuelle Firmware bleibt zusaetzlich das
Waveshare-Profil verbindlich, da Pins, ES7210- und ES8311-Anbindung sowie die
Basissoftware darauf abgestimmt sind. Ein allgemeiner digitaler Eingang gilt
nicht automatisch als vorhandene Bedientaste.

## Sicherheits- und Abnahmeregeln

- Jede API leitet Account und Projekt aus der authentifizierten Sitzung ab.
- Ein Client darf weder Owner, Projekt noch Datenquelle durch Payloadfelder
  erweitern.
- Geraetezuordnungen werden ausschliesslich aus dem aktuellen Accountinventar
  gewaehlt und auf das Projekt-Hardwareprofil sowie die manifestierten,
  kataloggestuetzt nachgewiesenen Hardware-Mindestanforderungen begrenzt.
- Bindungen lesen nur freigegebene, typisierte Datenpfade.
- Aktionen besitzen Allowlist, Parameterschema und serverseitige
  Berechtigungspruefung.
- Projekt-App-Definition und Laufzeitwerte besitzen unabhaengige Versionen.
- Eine fremde Projekt-App-Instanz darf weder gelesen noch veraendert werden.
- Nexi Basic muss ohne externen KI-Provider voll nutzbar bleiben.
- Als Allgemeinheitsnachweis wird neben Nexi eine kleine Sensor-Projekt-App aus
  demselben Vertrag gerendert.
