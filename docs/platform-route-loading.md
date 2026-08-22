# Routenbezogenes Laden der Plattform

Die GerNetiX-Plattform lädt Daten und größere optionale Browsermodule nach dem
tatsächlichen Bedarf der aktiven Route. Eine neue Ansicht darf nicht allein
deshalb alle Domain-Services abfragen, weil deren Daten an anderer Stelle der
Plattform dargestellt werden.

## Ladephasen

1. Der statische App-Shell und die unmittelbar benötigten Controller werden
   geladen. Umfangreiche, ausschließlich routenspezifische Inhalte bleiben aus
   diesem gemeinsamen Startpfad heraus.
2. `/api/platform/bootstrap?include=...` liefert Account, Workspace und
   Entitlements. Projekte werden nur mit `include=projects` vom Project Server
   geladen; KI-Konfiguration, Entwicklungsvorlagen und Vorschauen kommen nur
   mit `include=development`. Beim internen Routenwechsel fordert der Browser
   fehlende Bootstrap-Bereiche einmalig nach und behält bereits geladene
   Bereiche im Arbeitsspeicher.
3. Der Client wählt über `platformSummarySectionsForRoute` die ergänzenden
   Bereiche. `/api/platform/summary?include=...` startet ausschließlich die
   angeforderten Abhängigkeiten.
4. Eigene Routen-Endpunkte, beispielsweise Hardware-Assistent, Downloads,
   Community oder Marketplace, laden ihre Inhalte erst beim Eintritt in diese
   Ansicht oder bei einer konkreten Nutzeraktion.

Ein Aufruf von `/api/platform/summary` ohne `include` bleibt vorerst als
kompatibler vollständiger Aufruf erhalten. Neue Plattform-Aufrufer müssen ein
explizites Profil verwenden.

## Datenprofile

Projektlisten verwenden unabhängig von der Anzahl der Projekte ausschließlich
ein kompaktes Indexprofil. Eine Karte enthält Kennung, Titel, wenige Sätze
Zusammenfassung, Klassifikation, Zugriffs- und Laufzeitstatus sowie die für
sichtbare Aktionen notwendigen kleinen Merkmale. ProjectViewManifest,
Lernschritte, Quellpfade, Buildkonfiguration, Software-Einheiten und
Build-Historie gehören nicht in diesen Index. Der Project Server erzeugt das
Indexprofil mit einer einzelnen Listenabfrage; er darf dafür nicht pro Projekt
Quellen oder Build-Jobs nachladen.

Erst beim Öffnen einer Projektübersicht, eines Lernprojekts, der IDE oder einer
Projektkonfiguration lädt Identity über
`GET /api/platform/projects/:projectId` genau das ausgewählte Projekt. Parallele
Anforderungen desselben Details werden im Browser zusammengeführt. Ein
Direktlink wartet vor dem projektspezifischen Renderer auf dieses Detail,
während der allgemeine Katalog bereits allein mit dem kleinen Index vollständig
benutzbar ist.

Ein Projektchat wird ebenfalls seitenweise fortgesetzt: Das Projekt liefert
seine kurze Zusammenfassung und ausschließlich die letzte Nachrichtenseite mit
höchstens zwölf Nachrichten. Ältere Nachrichten werden weder an den Browser
noch an den nächsten KI-Aufruf angehängt. Beim nächsten Speichern bleibt diese
letzte Seite als unmittelbarer Gesprächskontext erhalten; der vollständige
Chatverlauf darf den Projektstart nicht wieder vergrößern.

Bei einem accountgebundenen Lernprojekt enthält dieser Einzelabruf nur dessen
eigenen Lernfortschritt. Das Öffnen eines Projekts darf nicht auf die
Fortschrittsabfragen aller anderen Projekte warten. Ein bereits aktuelles
Lernprojekt wird beim Fortsetzen nicht erneut gepatcht und seine vorhandenen
Quellen werden nicht noch einmal einzeln geprüft.

- Das Dashboard ist die vollständige Übersicht und lädt Geräte, Builds,
  KI-Abrechnung, Community-Zusammenfassung, Wissensupdates, Billing und
  Lernfortschritt.
- Entwicklungs- und IDE-Routen laden Projekte im Bootstrap und anschließend
  nur Geräte, Builds und gegebenenfalls Lernfortschritt.
- `Meine Anwendungen` lädt Projekte im Bootstrap und ausschließlich die für
  die Karten sichtbaren Geräteinformationen. Projekt-App-Manifest,
  Laufzeitwerte, Bindungen und Renderer werden erst beim Öffnen einer
  konkreten Anwendung geladen. Erst dort wird auch die kleine Liste der mit
  dem Projekt kompatiblen Account-Geräte für die Multi-Device-Zuordnung
  aufgelöst; sie gehört nicht zum globalen Dashboard-Bootstrap.
- Device-Management lädt Projekte, Geräte und Builds, aber keine Community-,
  Wissens- oder KI-Abrechnungsdaten.
- Billing lädt Projekte sowie Billing- und KI-Abrechnungsdaten.
- Hardware-Assistent, Downloads, Shop und einfache Accountansichten starten
  keine globale Summary. Ihre eigenen APIs bleiben unabhängig.
- Verweise auf den KI-Hardware-Assistenten in der Geräteübersicht und im leeren
  Inventar sind reine Navigation. Fragment, Controller, Styles und
  KI-Nutzungsdaten werden erst nach dem tatsächlichen Öffnen seiner Route
  geladen.
- Die oeffentliche Hilfe verwendet nur Account und eine leichtgewichtige
  Subscription-Sicht. Der Wissensstand wird erst im Wissensportal angefordert;
  das Dashboard laedt ihn weiterhin fuer sichtbare Neuigkeiten und Badges.

## Browsermodule

Die Artikelmodule des Wissensportals werden ausschließlich auf `/wissen/`
geladen. Dort kommen zuerst der kompakte Kapitelindex und
`knowledge-content.js`. Der Index enthält Titel, Zusammenfassungen,
Zugriffsstufen, Unterkapitel und die Asset-Zuordnung, aber keine vollständigen
Artikeltexte. Anschließend lädt der Browser nur die Datei des ausgewählten
Kapitels. Ein Kapitelwechsel oder ein Direktlink auf ein Unterkapitel lädt genau
dieses Kapitel nach und bewahrt den Zielanker.

Die zehn thematischen `knowledge-articles-*.js` bleiben die gut pflegbaren
Autorenquellen. `npm run build:knowledge` im Identity Server erzeugt daraus
35 einzeln cachebare Browserassets unter `knowledge-chapters/` sowie den
Kapitelindex. Ein Test vergleicht die generierten Inhalte vollständig mit den
Autorenquellen, damit veraltete Assets nicht unbemerkt ausgeliefert werden.

Downloads des lokalen Serial Service werden ebenfalls erst auf der
Downloadseite oder beim Öffnen des Installationsdialogs abgefragt.

Nach der vollständigen Dashboard-Hydration darf der Browser nur Kapitelindex,
Katalog und das öffentliche Einstiegskapitel mit `rel=prefetch` und damit
niedriger Priorität in seinen Cache holen. Nach dem Lesen eines Kapitels dürfen
höchstens dessen direkter Vorgänger und Nachfolger vorgemerkt werden. Die
Module werden dabei nicht ausgeführt. Dieser Komfortpfad bleibt bei aktiviertem
Datensparmodus sowie langsamen 2G-Verbindungen aus; das direkte Öffnen des
Wissensportals funktioniert unabhängig davon.

Quiz, generische Projekt-App, KI-Hardware-Assistent sowie die Controller fuer
Community, Nachrichten und Community-Marktplatz werden erst beim Eintritt in
ihre Route geladen. Das zusammengehoerige Entwicklungspaket aus Plattform-,
Hardware- und Komponentenmodell, Feedback-UI und Repository-Karte wird nur auf
den beiden Entwicklungsrouten geladen; eine bereits eingetroffene
Entwicklungs-Summary bleibt bis dahin gepuffert. Ihre Eventbindungen entstehen
ebenfalls erst nach dem Laden des jeweiligen Controllers und bleiben
idempotent. Eine Teilantwort
rendert außerdem nur die aktive Ansicht. Bootstrap und Summary werden nach
einem internen Routenwechsel parallel hydriert und loesen gemeinsam hoechstens
einen weiteren Inhaltsrender aus. Antworten einer inzwischen verlassenen
Route duerfen nicht mehr rendern.

Die kompakte Nachschlagewerke-Ansicht unter `/app/nachschlagewerke/` lädt ihr
passives HTML-Fragment, ihr routeneigenes Stylesheet und den statischen
Such-/Filtercontroller ebenfalls erst beim Eintritt. Die Kurzreferenzen sind
versionierter UI-Inhalt und erzeugen keine eigene Browser- oder Serverpersistenz.

IDE, Build/Flash, Debug, gefuehrte Projektansicht und Provisioning bilden
ebenfalls keine globale Startvoraussetzung. Der zentrale Loader setzt sie aus
deduplizierten Teilpaketen zusammen:

- IDE und Debug laden Build-/USB-Basis, gefuehrte Projektansicht, IDE und Debug
  in fester Abhaengigkeitsreihenfolge.
- Ein konkretes Lernprojekt laedt nur Build-/Flash-Basis und gefuehrte
  Projektansicht, wenn sein Zielsystem diese Werkzeuge tatsächlich benötigt.
  Reine Browser-Lernprojekte laden ausschließlich den Kern der geführten
  Projektansicht; Boardkonfiguration, Build, USB-Erkennung und Flashdialog
  bleiben bis zu einer tatsächlich hardwaregebundenen Route ungeladen.
- Inventar und Recovery laden den gemeinsamen Device-/Build-Controller, aber
  weder IDE noch Provisioning.
- Provisioning ergaenzt Device-Modell, Board-Konfiguration, Flash-Ausfuehrung
  und Onboarding-Controller.
- Das Device-WLAN-Werkzeug wird erst durch den ausdruecklichen Klick im Menue
  geladen und idempotent gebunden.

Kleine Querschnittsfunktionen wie der Wechsel eines Entwicklungsprojekts in die
IDE und der FlashBox-Claim liegen im gemeinsamen Projekt- beziehungsweise
Shell-Controller. Dadurch zwingen sie weder Entwicklungsplattform noch Shop zum
Download des grossen Build-Controllers. Solange Routenassets laden, blockiert
der sichtbare View Interaktionen; nach erfolgreicher Initialisierung wird diese
Sperre aufgehoben.

Routenexklusive Darstellung wird ebenfalls nicht mehr global uebertragen. Die
Hardware-Assistent- und Community-Familie besitzen eigene Stylesheets. Das
Nachrichten- und Hardware-Assistent-Markup liegt in statischen HTML-Fragmenten,
die der zentrale Route-Asset-Loader zusammen mit CSS und Controller parallel
laedt. Fragmente muessen genau ein Root-Element mit der erwarteten View-ID
enthalten, bleiben gleichurspruenglich und duerfen keine Skripte enthalten. So
bleibt der Shell klein, Direktnavigation funktioniert weiterhin und ein
fehlgeschlagener Assetabruf kann beim naechsten Routenwechsel erneut versucht
werden. Ein sehr kleiner synchroner Stil verhindert beim Direktaufruf des
Hardware-Assistenten, dass vor dessen Fragment kurz das Dashboard erscheint.

Die Dashboard-Community-Kachel verwendet den kontoabgeleiteten internen
Endpunkt `/api/community/dashboard-summary`. Community Platform aggregiert
Fragen- und Nachrichtenzähler bereits in der jeweiligen Persistenz und liefert
weder Fragen, Threadlisten, Nachrichtentexte noch technische Account-IDs an
Identity. Eine kleine Antwort darf nicht erst nach dem Transfer vollständiger
Fachlisten im aufrufenden Service entstehen.

## Modulgrenze

Die Browserdateien der Plattform sind ES-Module. Sie führen ein, was sie
brauchen, statt es aus einem gemeinsamen globalen Namensraum aufzulesen. Von 28
Skript-Tags im Plattformdokument ist genau eines klassisch:
`initial-view-router.js` wählt die Ansicht vor dem ersten Zeichnen und würde als
Modul aufgeschoben.

Für das routenbezogene Laden ist dabei eine Richtung entscheidend. Ein `import`
ist eine feste Abhängigkeit: der Browser holt das Modul, bevor der einführende
Code läuft. **Eine beim Start geladene Datei darf deshalb keine nachgeladene
einführen.** Täte sie es, käme das betroffene Routenpaket bei jedem Seitenaufruf
mit -- ohne sichtbaren Fehler, denn alles funktioniert weiter, nur langsamer.
Genau das ist die Grenze, die dieses Dokument schützt.

Für diese Richtung bleibt der Zugriff über den globalen Namensraum bestehen. Die
nachgeladenen Dateien stellen ihre Namen dafür mit einer ausdrücklich
gekennzeichneten Übergangsbrücke bereit. Eine solche Brücke ist keine Altlast,
sondern die Gegenrichtung der Aufteilung; aufgelöst wird sie nicht durch einen
`import`, sondern durch die Registratur in `platform-components.js`, die eine
Fabrik entgegennimmt und sie erst beim tatsächlichen Bedarf ruft.

Kurze Namen wie `@app/api-client.js` werden über eine erzeugte Import Map
aufgelöst. Sie leitet sich aus denselben Cache-Versionen ab wie die
Skript-Tags, wird von `npm run assets:sync` geschrieben und steht auf jeder
Seite, die ein Modul lädt oder sich eines nachträglich holt. Ein `import` ohne
Version würde eine zweite, unversionierte Kopie laden und dasselbe Modul ein
zweites Mal anlegen.

`test/module-boundary.test.js` hält alle drei Punkte fest: keine
Start-Datei führt eine nachgeladene ein, jede verbliebene Brücke gehört zu einer
nachgeladenen Datei, und nur der Initialrouter ist klassisch.

## Verbindliche Regeln

- Ein `include`-Abschnitt ist eine serverseitige Ausführungsgrenze, nicht nur
  eine Filterung der fertigen Antwort. Nicht angeforderte Service-Calls dürfen
  nicht gestartet werden.
- Nicht angeforderte Entwicklungskataloge und deren Vorschauen dürfen weder im
  Bootstrap noch in einer Teil-Summary enthalten sein. Eine Teilantwort darf
  bereits geladene Entwicklungskonfiguration im Browser nicht leeren.
- Abhängige Bereiche dürfen gemeinsame Ergebnisse wiederverwenden. Account und
  Billing dürfen beispielsweise keinen zweiten vollständigen KI-Usage-Abruf
  neben dem bereits angeforderten KI-Bereich auslösen.
- Unabhängige angeforderte Bereiche werden parallel geladen.
- Ein Routenwechsel darf fehlende Daten nachladen; vorhandene Zustände werden
  durch eine Teilantwort nicht mit leeren Standardwerten überschrieben.
- Neue große statische Module und neue Domain-Summary-Bereiche benötigen einen
  Test, der ihre Ladegrenze festhält.
- Routenexklusive Views, Styles und Controller gehoeren in den zentralen
  Route-Asset-Lader und nicht erneut in den globalen HTML-Startpfad.
- Nachgeladene HTML-Fragmente sind passive View-Strukturen: genau eine
  erwartete Root-ID, keine eingebetteten Skripte und keine neue fachliche
  Persistenz im Browser.
- Optionales Prefetching darf erst nach dem kritischen Datenpfad beginnen,
  keine Module ausführen und keine Datensparpräferenz übergehen.
- Ein Wissenskapitel darf nicht voraussetzen, dass andere Kapitelinhalte bereits
  ausgeführt wurden. Der kleine Index ist die einzige globale Navigationsquelle.
- Direktlinks auf Kapitel und stabile Unterkapitelanker müssen auch dann
  funktionieren, wenn der zugehörige Artikel erst nachgeladen wird.
- Globale Projektlisten enthalten keine Projektmanifeste, Lernschritte,
  Quelllisten oder Buildkonfigurationen; diese Daten werden nur für genau ein
  geöffnetes Projekt geladen.
- Ein Projektindex darf keine projektweise Folgeabfrage für Quellen oder
  Build-Jobs auslösen.
- Ein geöffnetes Lernprojekt lädt nur seinen eigenen Fortschritt. Reine
  Browserprojekte dürfen den Projektstart nicht von Build-, Board-, USB- oder
  Flashmodulen abhängig machen.
- Eine beim Start geladene Browserdatei führt keine nachgeladene ein. Der
  `import` ist eine feste Abhängigkeit und hebt die Aufteilung stillschweigend
  auf.
- Eine Übergangsbrücke an `globalThis` ist nur an einer nachgeladenen Datei
  zulässig. An einer beim Start geladenen ist sie Rest und gehört entfernt.

## Nachweis

Vor der Trennung lud jede Plattformseite mehr als 50 JavaScript-Dateien mit
zusammen rund 1,47 MB und anschließend Bootstrap plus vollständige Summary.
Die ausgelagerten Wissensmodule reduzieren den gemeinsamen JavaScript-Pfad um
elf Requests und ungefähr 380 KB. Quiz und Projekt-App entfernen weitere vier
Requests und ungefähr 46 KB aus diesem Pfad. Hardware-Assistent und die vier
Community-Controller entfernen weitere fünf globale Requests und rund 61 KB.
Das Entwicklungspaket entfernt weitere fuenf Requests mit rund 229 KB. Die
Workbench-Trennung entfernt weitere 13 Requests mit rund 501 KB beziehungsweise
rund 122 KB als Summe einzeln gzip-komprimierter Dateien. Der gemeinsame Pfad
liegt damit aktuell bei 21 JavaScript-Dateien mit zusammen rund 270 KB
unkomprimiert beziehungsweise rund 72 KB gzip-komprimiert. Contract-Tests
prüfen zusätzlich die
routenbezogenen API-Profile, aktiven Rendergrenzen und verhindern, dass
Downloads, Wissensartikel oder diese Fachcontroller wieder global geladen
werden.

Die beiden ersten ausgelagerten HTML-Views umfassen zusammen rund 7,6 KB; der
globale Shell liegt danach bei rund 110 KB unkomprimiert. Hardware- und
Community-Routen-CSS umfassen zusammen rund 27,8 KB und reduzieren das globale
`app.css` von rund 281 KB auf rund 253 KB, also um knapp zehn Prozent.

Vor der Kapiteltrennung lud der Eintritt in den Wissensbereich alle Artikel mit
ungefähr 380 KB. Der neue Einstieg lädt Index, Katalog und das erste Kapitel mit
zusammen ungefähr 52 KB. Weitere Kapitel kommen einzeln hinzu; aktuell liegen
sie je nach Umfang zwischen wenigen Kilobyte und rund 40 KB.

Die versionierten VPS-Nginx-Konfigurationen komprimieren Textantworten ab 1 KiB
mit Gzip und senden `Vary: Accept-Encoding`. Das betrifft insbesondere HTML,
CSS, JavaScript, JSON, Manifest-, XML- und SVG-Antworten; bereits komprimierte
Binärformate werden nicht zusätzlich in die Typenliste aufgenommen.
