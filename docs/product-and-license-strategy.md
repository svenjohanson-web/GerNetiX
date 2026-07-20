# Produkt- und Lizenzstrategie GerNetiX

Stand: 2026-07-20 · Status: strategischer Vorschlag. Dieses Dokument ist kein Preisblatt und keine bereits zugesagte Funktionsliste. Es konkretisiert das Zielbild auf Basis der bestehenden Plattform-, Geräte- und Entitlement-Architektur.

## Kurzentscheidung

GerNetiX sollte kein unscharfer "Cloud plus Smart Home plus Hardware"-Bauchladen werden. Das tragfähige Kernversprechen lautet:

> Von der ersten ESP32-Idee bis zum dauerhaft betreibbaren lokalen System – geführt, sicher flashbar und ohne Zwang zur Cloud.

Dies schließt eine offene Hardwarestrategie ein: Sensoren, Aktoren, ESP32-Boards und Zubehör dürfen grundsätzlich im freien Handel gekauft und als Community-/eigene Hardware genutzt werden. GerNetiX verkauft nicht den Zugang zu Hardware, sondern reduziert Auswahl-, Kompatibilitäts- und Inbetriebnahmerisiko durch passende, getestete Bundles.

Das Portfolio besteht deshalb aus drei klaren Ebenen:

| Ebene | Produkte | Kundennutzen | Erlöslogik |
| --- | --- | --- | --- |
| Einstieg und Entwicklung | GerNetiX Cloud Kostenlos, Cloud Basic+, Cloud Premium, Flashbox | Lernen, Projekte bauen, Geräte sicher einrichten | Freemium, Monats-/Jahresabo, KI-Zusatzkontingente |
| Selbstbetriebene Software | Home Small, Home Big, GerNetiX School | Lokale Autonomie und dauerhafte Gerätefunktion | Zeitlich begrenzte Server-Lizenz; optional zertifizierte Hardware |
| Organisationen | Education/Team, später Managed/Private Instance | Mehrnutzerbetrieb, Verwaltung und Datenschutzgrenzen | Organisationslizenz je Instanz/Standort |

Die drei Stufen sind bewusst wie bei Streaming-Angeboten aufgebaut: Ein Nutzer kauft nicht sofort alle Inhalte, Komfort- und Premiumleistungen, sondern steigt passend zu seinem Bedarf auf. **Nicht empfohlen** sind weitere private Cloud-Tarife zwischen Basic+ und Premium, ein künstlicher Zwang zur Flashbox oder ein eigenes "Home Premium"-Abo neben Cloud Premium. Sie erzeugen Produktnamen und Supportaufwand, ohne ein separates Kundenproblem zu lösen.

## Geschäftsarten: SaaS und lizenzierte Server-Software

GerNetiX unterscheidet bewusst zwei Geschäftsarten. Diese dürfen weder im Shop noch in der Lizenztechnik vermischt werden.

| Geschäftsart | Produkte | Betrieb und Daten | Kaufmodell |
| --- | --- | --- | --- |
| **Software as a Service (SaaS)** | Cloud Kostenlos, Basic+, Premium, KI-Credits | GerNetiX betreibt Clouddienste; konto- und projektgebundene Cloud-Daten liegen in den vorgesehenen Serverdomänen | Kostenlos oder Monats-/Jahresabo |
| **Lizenzierte Server-Software (Self-hosted)** | Home Small, Home Big, GerNetiX School | Kunde bzw. Organisation betreibt die Software auf eigener oder optional gekaufter Hardware; lokale Betriebsdaten bleiben in der Instanz | Zeitlich begrenzte Lizenz pro privater Instanz, Standort oder Organisation; Hardware ist optional |

Die optionale Hardware verändert die Softwarelizenz nicht. Im Shop steht daher bei jedem Serverprodukt zuerst die fachliche Wahl **„Softwarelizenz“** oder **„Softwarelizenz mit zertifizierter Hardware“**. Ein Kunde kann die Lizenz auf eigener freigegebener Hardware installieren; eine Appliance kauft nur den komfortableren, getesteten Lieferweg hinzu.

### Gemeinsamer Shop- und Lizenzablauf

```text
Kunde wählt Home Small, Home Big oder GerNetiX School
→ Shop zeigt Zielgruppe, Funktionsumfang und Mindest-/Empfehlungsprofil
→ Kunde wählt „nur Lizenz“ oder „Lizenz + zertifizierte Hardware“
→ bei Lizenz: Setup Tool / Installationspaket und Aktivierungscode
→ bei Hardware: vorkonfigurierte Appliance oder Hardware-Bundle plus Aktivierungscode
→ Setup Tool prüft das Zielprofil und installiert nur ein passendes, signiertes Image
→ Lizenz wird einer privaten Instanz bzw. Organisationsinstanz zugeordnet
→ lokale Nutzung läuft unabhängig von einem Cloud-Abo weiter
```

Die Lizenz ist an eine **Serverinstanz**, nicht an einen einzelnen physischen Datenträger gebunden. Hardwarewechsel, Defekt oder Wiederherstellung benötigen einen transparenten Transferprozess: alte Instanz deaktivieren, Wiederherstellungs-/Transfercode bestätigen, neue Instanz aktivieren. Keine Lizenz darf an einen nicht übertragbaren Hardwarefingerabdruck gekettet sein.

## Portfolio und Produktgrenzen

### GerNetiX Flashbox

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Maker mit mobilen Geräten, Workshops, Schulen sowie Support- und Laborumgebungen – besonders bei absichtlich funkfreien oder noch nicht verbundenen IoT-Geräten |
| Hauptanwendung | ESP32-Zielboards vor Ort per USB sicher erkennen, flashen, beobachten und wiederherstellen; mobiles Gerät und IoT-Device werden dabei lokal gekoppelt |
| Gelöstes Problem | Unterschiedliche Treiber, Browser-/USB-Konflikte und fehlende Diagnose machen den ersten Flash und Recovery unnötig schwer. Ohne WLAN, Bluetooth oder Mobilfunk fehlt mobilen Geräten zudem ein direkter Arbeitsweg zum IoT-Device. |
| Mehrwert | Ein inventarisiertes, geführtes Werkzeug mit bestätigtem Zielboard, signierten Paketen und nachvollziehbarem Flashprotokoll – ohne dass das Zielgerät eine Funkverbindung besitzen oder aktivieren muss |
| Muss enthalten | USB-OTG-Host, kompatible Zielboard-Erkennung, klarer lokaler Bedienweg mit Mobile-App oder mobilem Browser, signierter Manifest-/Paketabruf mit optionalem Offline-Cache, USB-Flash, serieller Monitor/Logexport, eigener Update- und Recovery-Weg, Account-Claim und Offline-Grundbetrieb |
| Bewusst nicht enthalten | Kein Home-Server, kein permanenter MQTT-Broker, keine allgemeine Linux-Box, keine Cloud-Pflicht, kein beliebiger App-Store |
| Abgrenzung | Flashbox ist ein mobiles Werkstattwerkzeug; Home ist ein dauerhaft laufender Standortdienst |

Die Flashbox ist deshalb nicht nur ein Komfort-Programmer, sondern die **lokale Brücke zwischen einem mobilen Gerät und einem absichtlich offline betriebenen IoT-Device**. Sie ist besonders wertvoll, wenn kein WLAN/Bluetooth/Mobilfunk erwünscht ist – etwa in Schule, Labor, sicherheits- oder datensensiblen Anwendungen, bei energiearmen Geräten oder während Recovery. Die Bedienung bleibt lokal: Mobiles Gerät → Flashbox → USB → Zielboard. Die Flashbox muss für diesen Grundablauf weder Cloud noch Funk am Zielboard voraussetzen.

Die vorhandene technische Richtung ist richtig: Flashbox als gekauftes, seriennummerngebundenes Inventar statt als frei nachbaubare Vertrauensklasse. Sie darf aber **nicht** zur Voraussetzung für USB-Flash werden. Web Serial bzw. der lokale Serial Service bleibt der kostenlose Standardweg; sonst würde GerNetiX Community-Hardware unnötig ausschließen.

**Ausbau in Stufen:**

1. USB-Flash, serieller Monitor, signierte Firmware, Offline-Cache und Recovery zuerst.
2. Einen lokalen mobilen Bedienvertrag festlegen: Die Flashbox stellt gegenüber der GerNetiX-App oder dem mobilen Browser eine abgesicherte lokale Verbindung bereit; der physische Flash- und Serientransport zum Zielboard bleibt USB. So bleibt das Zielgerät funkfrei.
3. OTA nur als zusätzliche Orchestrierung für bereits vernetzte Geräte: Die Flashbox kann einen Auftrag vermitteln oder lokal cachen; sie ersetzt nicht die Geräteautorisierung, Signaturprüfung oder den Rollback im Board.
4. Erst nach Feldnachweis: Mehrfach-Flash für Klassensätze und Diagnosepakete. Debugger/JTAG, Akku und Funk-Bridges sind eigene spätere Varianten, keine MVP-Pflicht.

### GerNetiX Projekt- und Hardware-Bundles

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Einsteiger, Bildung, Maker und Smart-Home-Nutzer, die ein konkretes Ergebnis statt einer langen Kompatibilitätsrecherche wollen |
| Hauptanwendung | Für ein Lernprojekt oder eine Lösung passende Sensoren, Aktoren, Board, Stromversorgung, Verbindungstechnik und – wenn nötig – Mechanik gemeinsam erwerben |
| Gelöstes Problem | Freihandelskomponenten sind günstig und vielfältig, aber Pinbelegung, Spannungsniveau, Bibliotheken, mechanischer Aufbau und Firmwareprofile passen nicht automatisch zusammen |
| Mehrwert | Ein transparentes Stücklisten-Bundle, dessen Kombination, Firmwarebeispiel, Anschlussplan und GerNetiX-Projektablauf gemeinsam getestet sind |
| Muss enthalten | Vollständige BOM mit Hersteller-/Handelsreferenzen, getestete Versionen bzw. Kompatibilitätsbereich, Anschluss-/Sicherheitsdokumentation, Beispielprojekt, klarer Ersatzteil- und Nachkaufweg |
| Bewusst nicht enthalten | Keine Sperre für baugleiche oder alternative Freihandelskomponenten, keine künstliche Gerätebindung, kein Anspruch, jede Revision eines Drittanbieters zu unterstützen |
| Abgrenzung | Ein Bundle ist ein Komfort- und Supportprodukt; Freihandels-Hardware bleibt der offene, voll nutzbare Basisweg |

GerNetiX sollte Bundles stets als **"getestete Referenzkonfiguration"** verkaufen, nicht als proprietäres Ökosystem. Sinnvolle Startbundles sind beispielsweise ein Sensor-/Aktor-Grundkit, ein Datenlogger-/Umweltsensor-Kit, ein lokales Automationskit sowie projektbezogene Lernkits. Jedes Bundle erhält eine veröffentlichte Kompatibilitätsmatrix: enthaltene Hardware, getestete Firmware-/Bibliotheksversionen, Stromversorgungsgrenzen, alternative bekannte Komponenten und ein Datum des letzten Tests.

### GerNetiX Geschenk-Gutschein mit ESP32

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Schenkende ohne technisches Vorwissen, Familien, Kurse, Schulen und Unternehmen |
| Hauptanwendung | Ein Geschenk öffnet direkt den praktischen Einstieg: Der Empfänger erhält Guthaben bzw. eine festgelegte Freischaltung **und** ein kleines nutzbares ESP32-Startgerät |
| Gelöstes Problem | Ein reiner Digitalgutschein ist unpersönlich; ohne Hardware kann der Empfänger den Lern- oder Projektwert nicht sofort erleben |
| Mehrwert | Der Gutschein ist zugleich eine kleine erste Hardware-Einladung und führt nachvollziehbar zur Kontoaktivierung, zum ersten Projekt und bei Bedarf zu einem getesteten Bundle |
| Muss enthalten | Kleines ESP32-Board, eindeutige Geräte-/Gutscheinbindung, sichtbare Einlöseanleitung, einmalige Account-Aktivierung, klarer Gutscheinwert oder eine klar beschriebene Freischaltung, Ablaufdatum und Support-/Recoveryprozess |
| Bewusst nicht enthalten | Kein offener Geldspeicher auf dem ESP32, keine automatische Kontoverknüpfung der Schenkenden, keine Übertragung von Rechnungs-/Zahlungsdaten auf das Board |
| Abgrenzung | Geschenk-Gutschein = physischer Einstieg und einmalige Aktivierung; Flashbox = professionelles lokales Werkzeug; reguläres Hardware-Bundle = getestete Projektkonfiguration |

Der Gutschein wird **an die mitgelieferte ESP32-Hardware gebunden**, aber das Board ist keine sichere Geldbörse. Es speichert nur eine minimale Gutscheinreferenz und einen geräteeigenen kryptographischen Nachweis. Beim Einlösen liest die GerNetiX-App bzw. der lokale USB-/Flashbox-Weg die Referenz aus, der Server prüft Signatur, Status, Ablauf und Einmaligkeit und schreibt erst dann das Entitlement oder Credit-Guthaben dem bewusst gewählten Account zu.

Verbindlicher Sicherheitsablauf:

```text
Webshop bestellt Geschenk-Gutschein
→ Produktion provisioniert ESP32 mit Geräte-ID und nicht geheimem Gutscheinbezug
→ Server speichert Gutscheinwert, Status und nur den öffentlichen Geräte-/Signaturbezug
→ Empfänger verbindet Board lokal per USB oder Flashbox
→ GerNetiX prüft Geräte-Signatur und einmalige Gutscheinaktivierung
→ Empfänger wählt oder erstellt den eigenen Account
→ Server bucht Gutscheinwert bzw. Entitlement im Ledger und sperrt den Gutschein endgültig
```

Damit darf ein kopierter Flashinhalt keinen Gutschein duplizieren: Die Einlösung verlangt einen Challenge-Response mit dem nicht exportierbaren Geräteschlüssel und wird serverseitig atomar als verbraucht markiert. Geht das Board vor der Einlösung verloren, darf Support nicht aufgrund einer bloßen aufgedruckten Nummer Guthaben übertragen; erforderlich sind Bestellnachweis und ein dokumentierter Sperr-/Ersatzprozess. Nach der Einlösung bleibt das ESP32 ein normales, frei nutzbares Community-/GerNetiX-Startboard – es ist kein Zugangsschlüssel zum Konto.

### GerNetiX Home Small

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Nutzer mit wenigen bis mittleren ESP32-/Smart-Home-Geräten, die lokal und datensparsam betreiben wollen |
| Hauptanwendung | Stabiler lokaler Gerätehub für MQTT, lokale OTA-Auslieferung und Gerätezustand |
| Gelöstes Problem | Ein VPS ist für lokale Automatisierung nicht nötig; Router, PC oder Bastel-Container sind jedoch oft keine wartbare Dauerlösung |
| Mehrwert | Ein vorkonfigurierter, sicher aktualisierbarer lokaler Betriebsanker mit verständlicher Sicherung und Cloud-Optionalität |
| Muss enthalten | Lokaler MQTT-Broker mit Geräte-ACLs, lokale Geräte-/Pairing-Sicht, signierter OTA-Cache und -Proxy, lokales Mobil-Dashboard, einfache lokale Regeln, Ereignis-/Messwerthistorie, Health-/Backup-Export, verschlüsselte Administration im LAN, kontrollierte Cloud-Synchronisation |
| Bewusst nicht enthalten | Kein frei zugänglicher Docker-Host, kein Home-Assistant-Supportversprechen, keine freie Node-RED-/Containerlandschaft, keine lokale generative KI, keine Video-/Kamera-NVR |
| Abgrenzung | Small liefert GerNetiX-Basisbetrieb; Big liefert offene Integrations- und Automatisierungsleistung |

Small braucht keine lokale Kopie jedes GerNetiX-Cloudservice. Lokal erforderlich sind nur Latenz-, Offline- oder Datenschutz-kritische Teile: MQTT, Geräte- und Credential-Metadaten, OTA-Artefaktcache, Zustands-/Eventpuffer und ein Backup/Restore-Weg. Projekte, Konto, Katalog, Zahlungsentitlements und KI-Kontext bleiben führend in ihren bestehenden Serverdomänen. Synchronisation ist optional, konfliktarm und ereignisbasiert – niemals ein zweiter, unklarer Master für Account- oder Projektzustand.

#### Home Small: konkrete Funktionsbereiche

| Funktionsbereich | Kundensicht | Lokale Funktion und Grenze |
| --- | --- | --- |
| **Geräte starten und verbinden** | Neues ESP32 einschalten, per Handy finden, WLAN einrichten und einem Raum/Projekt zuordnen | Lokaler Discovery- und Pairing-Ablauf, QR-/Einmalcode und keine Speicherung des WLAN-Passworts im Cloudkonto. Unterstützt nur freigegebene GerNetiX- und Community-Boardprofile. |
| **Zigbee einbinden – wenn Hardware vorhanden** | Zigbee-Sensoren und -Aktoren lokal hinzufügen, Räumen zuordnen und wie andere Geräte bedienen | Erscheint nur bei erkanntem, freigegebenem Zigbee-USB-Koordinator oder einer zertifizierten Appliance-Variante. Lokales Pairing, Netz-/Batteriestatus und die Abbildung in Gerätepult, Regeln und MQTT; keine Cloud-Pflicht. |
| **Lokales Gerätepult** | Auf iPhone, iPad oder Browser aktuelle Messwerte, Zustände und einfache Bedienelemente sehen | Lokale PWA zeigt Räume, Geräte, Letztkontakt, Sensorwerte und Aktorstatus. Kein vollwertiger, frei konfigurierbarer Dashboard-Builder; das ist Home Big/externen Systemen vorbehalten. |
| **Lokale Automationen** | „Wenn Feuchtigkeit niedrig ist, schalte Pumpe an“ oder „bei Türkontakt sende lokalen Alarm“ | Ein begrenzter, verständlicher Regelbaukasten aus Auslöser, Bedingung, Aktion, Zeitplan und Sicherheitsgrenze. Keine freien Skripte, keine beliebigen Plugins und keine komplexen graphischen Flows. |
| **MQTT und Gerätezustand** | Geräte reagieren auch bei Internetausfall zuverlässig im Haus | Lokaler Broker mit Geräte-ACLs, mTLS/gerätespezifischer Identität, QoS- und Retain-Regeln. Der Home Small ist lokale Laufzeit, nicht die führende Cloud-Identität. Zigbee-Zustände werden über einen klar abgegrenzten lokalen Adapter in dieses Modell überführt. |
| **Lokales OTA und Releasekanäle** | Geräte erhalten getestete Projektupdates im Heimnetz ohne Cloud-Abhängigkeit | Signierte Artefakte, Kompatibilitätsprüfung, Rollout einzeln/als kleine Gruppe, Erfolgsmeldung und Rollback. Kein unkontrolliertes Firmware-Uploadformular. |
| **Verlauf und Ereignisse** | Sehen, was heute oder in den letzten Tagen passiert ist | Begrenzte lokale Messwert-/Ereignishistorie mit Aufbewahrungsregel und Export. Kein unbegrenztes Langzeitarchiv und keine Grafana-Analyseumgebung. |
| **Lokale Hinweise** | Einfache Benachrichtigung bei wichtigen Zuständen | Lokale PWA-Hinweise und Ereigniscenter. Externe Push-Zustellung, E-Mail oder Fernzugriff nur als ausdrücklich aktivierte Cloud-Erweiterung. |
| **Backup und Wiederherstellung** | Nach Hardwaredefekt wieder schnell weiterarbeiten | Verschlüsselter Backup-Export auf lokales USB-/Netzwerkziel sowie geführter Restore. Kein stilles Cloud-Backup; ein externes Backupziel wird sichtbar eingerichtet. |
| **Haushalt und Zugriff** | Familienmitglieder dürfen Geräte bedienen, aber nicht die Anlage verändern | Ein Eigentümer-/Adminzugang und einfache lokale Haushaltsrollen wie „Bedienen“ und „Verwalten“. Kein Organisations-, Klassen- oder Mandantenmodell. |
| **Betriebszustand** | Verstehen, ob der Home Server gesund ist | Lokale Health-Sicht für Speicher, Backup-Alter, Geräteerreichbarkeit, Update-/Lizenzstatus und Sicherheitswarnungen – ohne technische Containerverwaltung für Endnutzer. |

#### Ein klarer Alltagsablauf

```text
ESP32 einschalten oder per Flashbox/USB vorbereiten
→ Home Small erkennt das lokale Gerät oder nimmt seinen QR-/Pairing-Code an
→ Nutzer richtet WLAN lokal ein und ordnet das Gerät einem Raum/Projekt zu
→ Gerät verbindet sich per gerätespezifischer Identität mit lokalem MQTT
→ Mobil-Dashboard zeigt Zustand und Messwerte im Heimnetz
→ Nutzer erstellt bei Bedarf eine einfache lokale Regel
→ Home Small verteilt später eine signierte, kompatible Firmware per lokalem OTA
→ Backup/Health-Sicht sichert den dauerhaften Betrieb
```

Damit ist Home Small bereits für typische Alltagsprojekte vollständig: Pflanzenbewässerung, Tür-/Fensterstatus, Raumklima, einfache Licht-/Relaissteuerung, lokale Sensoranzeige und Alarmierung im Heimnetz. Es darf nicht versprechen, jede Smart-Home-Marke, Kamera, Sprachassistenz oder beliebige Docker-Anwendung zu integrieren.

#### Optionales Zigbee-Modul

Zigbee ist ein lokaler Funkpfad neben WLAN-ESP32, kein Clouddienst. Der Kunde wählt beim Kauf einer Appliance optional eine zertifizierte Zigbee-Variante oder ergänzt bei einer Server-Lizenz einen freigegebenen USB-Zigbee-Koordinator. Ohne Koordinator bleibt die Zigbee-Oberfläche deaktiviert und verweist transparent auf kompatible Hardware.

Der erste Supportumfang umfasst lokales Geräte-Pairing, Räume, Batterie-/Erreichbarkeitsstatus, Sensorwerte, Schaltaktoren sowie die Verwendung in Dashboard und einfachen Regeln. Für jede unterstützte Gerätegruppe veröffentlicht GerNetiX ein getestetes Profil. Es gibt bewusst **keine Zusage für alle Zigbee-Marken, herstellerspezifische Sonderfunktionen oder generische Zigbee-Firmwareupdates**. Das verhindert, dass die kleine, stabile Home-Small-Appliance zu einer unbeherrschbaren universellen Integrationsplattform wird.

#### Lizenzgrenzen und Ausbaustufen

| Zustand | Verfügbar |
| --- | --- |
| **Aktive Home-Small-Lizenz** | Neue Geräte aktivieren, geprüfte Profile und Integrationspakete installieren, System-/Sicherheitsupdates, neue lokale OTA-Releasekanäle, erweiterte Regeln, Cloud-Relay/-Sync und regulärer Support |
| **Nach Lizenzablauf** | Bereits gepairte ESP32- und Zigbee-Geräte, lokales MQTT, bestehende Regeln, lokales Dashboard, vorhandene OTA-Ziele, Datenexport und Wiederherstellung aus vorhandenem Backup |
| **Bewusst gesperrt nach Ablauf** | Neue Geräte-/Lizenzaktivierungen, neue Integrationspakete, Produktupdates, Cloud-/KI-Komfort und regulärer Support |

Kritische Sicherheitsupdates für die letzte unterstützte Home-Small-Version folgen weiterhin der im Lizenzmodell zugesagten Sicherheitsfrist. Das verhindert, dass ein Nutzer zwischen Sicherheit und einem kostenpflichtigen Upgrade wählen muss.

**Hardwareempfehlung:** Für eine eigene Appliance ist ein Raspberry Pi 5 mit 4 GB RAM, NVMe-SSD (mindestens 128 GB), aktivem Kühler und zuverlässigem Netzteil eine praktikable Small-Basis. Für ein späteres eigenes Seriengerät ist Compute Module 5 mit eMMC und Carrier Board besser wartbar und robuster. Raspberry Pi dokumentiert für CM5 Varianten mit 2–16 GB RAM und optionalem eMMC; Pi 5 bleibt laut Hersteller mindestens bis Januar 2036 in Produktion. [CM5-Spezifikation](https://www.raspberrypi.com/documentation/computers/compute-module.html), [Pi-5-Produktbrief](https://pip-assets.raspberrypi.com/categories/892-raspberry-pi-5/documents/RP-008348-DS-4-raspberry-pi-5-product-brief.pdf)

#### Zwei Lieferformen, ein Home-Small-Produkt

| Lieferform | Was der Kunde erhält | Für wen | Supportgrenze |
| --- | --- | --- | --- |
| **Home Small Appliance** | Vorgeprüfte Hardware, Gehäuse, Netzteil, Speicher, vorinstalliertes und aktiviertes GerNetiX Home Small | Nutzer, die ohne Serverbau starten möchten | GerNetiX verantwortet die gelieferte Hardware-/Imagekombination und den dokumentierten Betriebsweg |
| **Home Small Server-Lizenz** | Nutzungsrecht, GerNetiX Home Setup Tool und signiertes Image für freigegebene Zielhardware | Maker, Schulen und vorhandene Raspberry-Pi-/Mini-PC-Besitzer | GerNetiX supportet Image, Setup Tool und freigegebene Hardwareprofile – nicht beliebige Drittgehäuse, Netzteile, Datenträger oder zusätzliche Container |

Die Server-Lizenz ist daher kein abgespecktes Angebot, sondern dieselbe lokale Home-Funktion auf kundeneigener Hardware. Eine Appliance verkauft Bequemlichkeit, getestete Hardware und einen klaren Ansprechpartner; die Lizenz verkauft Flexibilität und niedrigere Einstiegskosten. Beide verwenden dieselben Entitlements, dieselben lokalen Datenverträge und dieselben Sicherheits-/Updatekanäle.

#### Mindest- und Empfehlungsprofile für den Shop

Nicht allein die Gigahertz-Zahl entscheidet über ein zuverlässiges Serversystem. Im Shop müssen CPU-Architektur, Kerne, RAM, SSD, Netzwerk, Stromversorgung und beim School-Produkt USB-/WLAN-Hardware gemeinsam als verbindliches Profil erscheinen.

| Produkt | Mindestprofil für die Lizenz | Empfohlenes Profil / zertifizierte Appliance |
| --- | --- | --- |
| **Home Small** | 64-Bit ARM oder x86-64, 4 CPU-Kerne, 4 GB RAM, 64 GB SSD/eMMC, Gigabit-Ethernet | Raspberry Pi 5 mit 4–8 GB RAM, 128-GB-NVMe, aktivem Kühler und Marken-Netzteil; alternativ freigegebener x86-64-Mini-PC |
| **Home Big** | x86-64, 4 CPU-Kerne ab etwa 2 GHz, 8 GB RAM, 256-GB-SSD/NVMe, Gigabit-Ethernet | 6–8 CPU-Kerne, 16 GB RAM, 512-GB-NVMe, getrenntes Backup-Ziel; ausreichend Reserven für Home Assistant, Docker, Node-RED und Grafana |
| **GerNetiX School Core** | x86-64, 4 CPU-Kerne ab etwa 2 GHz, 16 GB RAM, 512-GB-NVMe, Gigabit-Ethernet, lokales Backupziel | 6–8 CPU-Kerne, 32 GB RAM, 1-TB-NVMe, zwei Netzwerkpfade oder VLAN-fähiger Betrieb; dedizierter Wi-Fi-6/6E-Access-Point für Lernende und ein getrenntes Geräte-WLAN für ESP32 |

Die Mindestprofile sind eine Installationsgrenze, keine Leistungszusage für beliebige Zusatzsoftware. Der Setup-Prozess prüft mindestens Architektur, RAM, freien persistenten Speicher und Netzwerk; fehlende USB-/WLAN-Anforderungen werden produktspezifisch angezeigt. Die Kompatibilitätsliste ist versioniert und nennt für jedes Profil die unterstützte Image-Version.

Für **GerNetiX School Core** ist zusätzlich eine unterstützte Docker-Engine mit Docker Compose verbindlich. Die School-Lizenz wird als versionierter Compose-Stack betrieben, damit Lernportal, Kurs-/Firmwarekatalog, Projekt-/Gerätespeicher, MQTT-/OTA-Dienst und Backup klar getrennt, reproduzierbar aktualisierbar und von der Schul-IT prüfbar bleiben. Die All-in-one-Appliance enthält diese Laufzeit bereits; bei der reinen Server-Lizenz prüft das Setup Tool Docker, Compose, verfügbaren Speicher und die notwendigen lokalen Netzwerkports vor der Installation.

Docker ist dabei **ausschließlich die interne Betriebsbasis von GerNetiX School**. Die Lizenz eröffnet keinen allgemeinen Docker-Host: Lehrkräfte und Lernende erhalten weder ein Container-Terminal noch die Möglichkeit, beliebige Images oder Ports zu starten. Updates, Backups und Freigaben erfolgen über die School-Administrationsoberfläche bzw. den dokumentierten IT-Admin-Ablauf.

#### Home Setup Tool und Image-Ablauf

Das Setup Tool ist eine eigene, einfache Desktop- oder Web-USB-Anwendung – kein manueller Download-Zettel. Es führt durch Hardwareprüfung, Speicherauswahl, Image-Schreiben, lokale Erstkonfiguration, Lizenzaktivierung und Wiederherstellung.

```text
Kunde kauft Home Small Appliance oder Server-Lizenz
→ bei Lizenz: Setup Tool herunterladen und öffnen
→ Tool erkennt freigegebenes Raspberry-Pi-/Mini-PC-Profil und Ziellaufwerk
→ Tool lädt ein versioniertes, signiertes Home-Small-Image oder verwendet ein zuvor geladenes Offline-Paket
→ Tool prüft Signatur und Prüfsumme, schreibt das Image und verifiziert den Schreibvorgang
→ Home Small startet im lokalen Setup-Modus
→ Kunde verbindet sich lokal, legt Admin-Zugang und Backup-Ziel fest
→ Kunde löst die Lizenz bewusst im GerNetiX-Account ein oder importiert eine zeitlich begrenzte Offline-Aktivierung
→ Home Small erhält nur die für die Lizenz nötigen Entitlements und arbeitet danach lokal weiter
```

Für den Image- und Lizenzweg gelten verbindlich:

- Images sind versioniert, signiert und mit Prüfsumme veröffentlicht; das Setup Tool akzeptiert keine unbestätigten Images.
- Ein Image enthält weder Account-Session, WLAN-Passwort, Shared Secret noch vorab eingebrachte Device-Private-Keys.
- Die Lizenz wird erst bei der lokalen Erstkonfiguration einem Home-Server-Schlüssel bzw. einer Installation zugeordnet. Ein Hardwaretausch braucht einen dokumentierten Transfer-/Recoveryprozess.
- Ein Kunde ohne Internet kann Image und zeitlich begrenzte Offline-Aktivierung vorher herunterladen/importieren; die nachfolgende lokale Nutzung bleibt internetunabhängig.
- Backup, Restore und ein erneutes Schreiben des Images müssen ohne Cloud-Abhängigkeit funktionieren.
- Die Setup Tool-UI macht vor dem Schreiben den korrekten Datenträger, die vollständige Löschung des Ziellaufwerks und die Wiederherstellungsoption sichtbar. Sie darf nicht still auf einen Systemdatenträger schreiben.

Für die erste Markteinführung sollte die Server-Lizenz auf wenige freigegebene Profile begrenzt werden, etwa Raspberry Pi 5 + NVMe und ein ausgewählter x86-64-Mini-PC. Das ist wesentlich glaubwürdiger als "läuft auf jedem Linux". Weitere Hardware wird erst nach einem Image-, Update-, Stromausfall- und Restore-Nachweis in die Kompatibilitätsliste aufgenommen.

### GerNetiX Home Big

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Smart-Home-aktive Maker, Power User, kleine Werkstätten und Familien mit mehreren Integrationen |
| Hauptanwendung | Lokale Automatisierung und Integration neben dem GerNetiX-Gerätebetrieb |
| Gelöstes Problem | Mehrere einzelne Systeme für Automationen, Dashboards, Dienste und Backups erhöhen Komplexität und Ausfallrisiko |
| Mehrwert | Ein getesteter, supportbarer Integrationsknoten mit Ressourcen, Isolation und Wiederherstellung |
| Muss enthalten | Alles aus Small, dazu Home Assistant, freigegebene Docker-Apps, Node-RED, Grafana, Zeitreihen-/Metrikspeicher, Backup-Ziele, Ressourcenüberwachung und klare Supportgrenzen |
| Bewusst nicht enthalten | Kein Versprechen beliebige Drittcontainer zu supporten, keine offene Portfreigabe als Standard, keine unkontrollierte KI-/Kamera-Workload |
| Abgrenzung | Big rechtfertigt seinen Preis nur durch sichtbare Integrationen, Kapazität, Datensicherung und Support, nicht durch dieselben Basisdienste auf stärkerer Hardware |

**Empfohlene Hardware:** kein höher getakteter Small, sondern ein x86-64-Mini-PC mit 16 GB RAM, 512-GB-NVMe (besser zwei getrennte Speicherpfade für System und Backup) und Gigabit-Ethernet. Die Architektur muss auch auf ARM funktionieren, aber Big sollte Docker, Grafana und Home Assistant nicht auf knapper SBC-Hardware bündeln. Ein "GerNetiX Home Big" auf einem Home Assistant Green wäre keine glaubwürdige Big-Variante: Das Gerät ist laut Home Assistant der empfehlenswerte Einstiegscontroller und hat 4 GB RAM/32 GB eMMC; es eignet sich gut als Vergleich bzw. als Home-Assistant-Einstieg, aber nicht als offene GerNetiX-Integrationsbox. [Home Assistant Green](https://www.home-assistant.io/green/), [Hardware-Empfehlung von Home Assistant](https://www.home-assistant.io/faq/what-hardware-do-i-need/)

### GerNetiX School

GerNetiX School ist **kein Home Big mit anderem Gehäuse**, sondern eine bewusst offlinefähige Unterrichts-Appliance. Sie stellt einer Klasse ein eigenes WLAN und die benötigten Lern-, Projekt- und Flashdienste lokal bereit. iPads, Tablets, Chromebooks und Notebooks verbinden sich damit direkt; für den Unterricht ist keine Internetverbindung erforderlich.

| Frage | Festlegung |
| --- | --- |
| Zielgruppe | Schulen, Lehrkräfte, Medienzentren und außerschulische Lernorte mit Klassensätzen |
| Hauptanwendung | Eine Lehrkraft startet einen lokalen Kursraum; Lernende verbinden ihre Geräte mit dem GerNetiX-School-WLAN, bearbeiten Inhalte und aktualisieren die vorbereiteten ESP32-Klassensätze kontrolliert per lokalem OTA |
| Gelöstes Problem | Schul-WLAN, Gastzugänge, Filter, fehlende Internetverbindung, Datenschutzvorgaben und unterschiedlich verwaltete Endgeräte dürfen den praktischen Embedded-Unterricht nicht blockieren |
| Mehrwert | Ein vollständiger, lokaler und wiederholbarer Unterrichtsraum: Inhalte, Projekte, Firmware, Geräteworkflow und Lehrkraftsicht stehen auch ohne Internet bereit |
| Muss enthalten | Eigenes WLAN mit klarer Kursraum-Anmeldung, getrenntes Geräte-WLAN, lokales Lernportal/PWA, lokale Kurs- und Projektbibliothek, lokaler Projekt-/Gerätespeicher, lokale Build-/Firmware-Artefakte, signiertes lokales OTA, Lehrkraftkonsole, Sicherung/Export und eine explizite Offline-/Online-Anzeige |
| Bewusst nicht enthalten | Kein offenes Internet-Gateway, keine ungeprüfte externe KI, kein öffentlich erreichbarer Dienst, keine automatische Übertragung von Schülerdaten in die GerNetiX Cloud |
| Abgrenzung | Home betreibt ein privates Zuhause; School betreibt einen zeitlich und didaktisch strukturierten Klassenraum mit mehreren Lernenden und OTA-fähigem Klassensatz |

#### Offline-Unterrichtsablauf

```text
Lehrkraft schaltet GerNetiX School ein
→ School eröffnet ein eigenes, WPA3-geschütztes Klassen-WLAN
→ iPad / Tablet / Chromebook / Notebook öffnet lokales Lernportal
→ Lernende treten einem Kursraum mit Klassen-Code oder QR-Code bei
→ Inhalte, Projekte, Hilfen und Firmware kommen ausschließlich vom School Server
→ vorprovisionierte ESP32 verbinden sich mit dem lokalen School-Geräte-WLAN
→ Lehrkraft oder Lernende startet den freigegebenen OTA-Auftrag
→ School prüft Boardprofil, Geräte-/Klassenzuordnung, Firmware, Signatur und Online-Status
→ lokaler OTA-Dienst liefert die Firmware aus und protokolliert das Ergebnis
→ Lehrkraft exportiert Ergebnisse oder synchronisiert bewusst zu einem späteren Zeitpunkt
```

Der School Server darf im Offline-Betrieb **keine externe Namensauflösung, Telemetrie, KI-Provider, Cloud-Login oder Hintergrundsynchronisation** voraussetzen. Der Benutzer sieht jederzeit, dass er im lokalen Schulnetz arbeitet. Internet ist optional und standardmäßig weder für den Unterricht noch für den ESP32-Flash aktiviert.

#### WLAN, Identität und Datenschutz

- Das Schul-WLAN wird als eigener, isolierter Access Point betrieben; ohne ausdrückliche Freigabe existiert kein Routing ins Schulnetz oder Internet.
- WPA3-Personal mit zeitlich wechselndem Kursraum-Passwort ist der einfache Standard. Für verwaltete Schulumgebungen kann später WPA2-/WPA3-Enterprise als Integrationsoption folgen.
- Der Klassenbeitritt verwendet einen kurzlebigen Kursraum-/QR-Code. Lernende brauchen im Offline-Unterricht weder private E-Mail noch einen Cloud-Account.
- Der School Server führt lokale, pseudonyme Lernenden-Kennungen und lokale Kursprojekte in SQL/SQLite. Personenbezug, Namenslisten und Bewertungsdaten bleiben bei der Schule bzw. Lehrkraft und werden nicht automatisch mit GerNetiX geteilt.
- Ein Cloud-Konto kann später bewusst verknüpft werden, etwa um ein eigenes Projekt mitzunehmen. Dabei muss sichtbar gewählt werden, welche Projekte und Daten exportiert oder synchronisiert werden. Eine Klassenprojekt-Synchronisation braucht immer Lehrkraftfreigabe und einen dokumentierten Datenschutz-/Auftragsverarbeitungsprozess.

#### Lokales Geräte-WLAN und OTA-Klassensatz

Der Klassenbetrieb setzt auf **vorprovisionierte, OTA-fähige ESP32**. Diese werden einmalig vor der Ausgabe per USB/Provisioning vorbereitet und besitzen danach ihre Geräteidentität, ein OTA-fähiges Basissoftwareprofil und die Berechtigung für den jeweiligen Klassenbestand. Im Unterricht brauchen sie keine USB-Verbindung mehr.

| Funktion | Warum sie nötig ist |
| --- | --- |
| Eigenes Geräte-WLAN für ESP32, getrennt vom Lernenden-WLAN | Geräte bleiben untereinander und vom Unterrichtsportal erreichbar, ohne Schülergeräte unnötig in das Geräte-Netz zu lassen |
| Lokaler MQTT-/OTA-Dienst mit Geräteidentität und Signaturprüfung | OTA bleibt auch ohne Internet kontrolliert; nur dem Klassensatz zugeordnete Boards erhalten passende Aufträge |
| Lehrkraftsicht auf Gerät, Platz und letztem OTA-Ergebnis | Die Klasse kann Geräte zuordnen und Fehler gezielt lösen, ohne Kabelsuche |
| Freigegebene Firmware-/Boardprofile und Rollback | Kein falsches Image; ein fehlgeschlagenes Update lässt die letzte gültige Firmware nutzbar |
| Lernprojekt zurücksetzen als OTA-Aktion | Setzt Benutzeranwendung bzw. Projektdaten zurück, ohne Geräteidentität, WLAN-Bindung oder Recovery-Anker zu zerstören |

Ein vollständiger Factory-/Identity-Reset oder ein neues erstes Provisioning bleibt absichtlich ein separater Recovery-/Supportablauf außerhalb des normalen Schulunterrichts. Dafür kann eine einzelne Flashbox oder ein betreuter USB-Recoveryplatz verwendet werden; eine fest eingebaute Mehrport-USB-Flashstation ist kein Bestandteil von GerNetiX School.

#### Referenzhardware und Betriebsform

Für den ersten Schulbetrieb ist ein x86-64-Mini-PC mit 16 GB RAM, 512-GB-NVMe, zwei Netzwerkinterfaces oder einem dedizierten Wi-Fi-6/6E-Access-Point sowie einem separat versorgten 8- bis 16-Port-USB-Hub sinnvoll. Das Gerätegehäuse braucht sichere Stromversorgung, Diebstahlschutz, gut sichtbare USB-Portnummern und einen lokalen Backup-/Exportanschluss. Ein einzelner Raspberry Pi oder ein normaler USB-Hub ist für einen parallelen Klassensatz-Flash nicht die belastbare Produktbasis.

Softwareseitig besteht School aus klar getrennten lokalen Diensten: Kursraum-/Lehrkraftportal, Inhalts- und Firmwarekatalog, Projekt-/Gerätespeicher, Build-/Artefaktdienst, lokaler MQTT-/OTA-Dienst sowie Backup/Export. Alle führenden Offline-Daten liegen lokal in SQL/SQLite. Eine optionale Synchronisation ist ein expliziter Export-/Importprozess mit Konflikt- und Einwilligungsregeln, nicht ein unsichtbarer zweiter Datenmaster.

Für die IT-Infrastruktur einer Schule gibt es zwei gleichwertige Betriebsformen:

| Betriebsform | Einsatz | Konsequenz |
| --- | --- | --- |
| **School All-in-one Appliance** | Mobiler Koffer oder einzelner Klassenraum | School Core und eigener Access Point kommen als geprüfte Hardware zusammen; der OTA-fähige Klassensatz verbindet sich lokal |
| **School Server-Lizenz in der Schul-IT** | Dauerhafte Bereitstellung auf freigegebenem physischem Server oder VM mit Docker Compose | Die Schule betreibt School Core im eigenen Netz/VLAN; Lernenden- und Geräte-WLAN können aus vorhandener Infrastruktur stammen. OTA bleibt auf den lokalen School Core begrenzt. |

Ein School Core in einer VM oder Schulserver-Infrastruktur ist damit ohne USB-Passthrough sinnvoll betreibbar. Die einzige produktseitige Voraussetzung für OTA ist, dass School Core und der provisionierte Klassensatz über das isolierte Geräte-WLAN miteinander kommunizieren können. Die ESP32 benötigen keinen Internetzugang.

#### Lizenz und Verkaufsmodell

GerNetiX School wird als **jährliche Education-Server-Lizenz** angeboten – wahlweise als reine Installationslizenz für die eigene IT-Infrastruktur oder zusammen mit einer All-in-one-Appliance inklusive Access Point. Einzel-Schülerabos sind dafür nicht erforderlich. Die Lizenz umfasst lokale Kursbibliotheks-Updates, neue getestete Board-/Firmwareprofile, Lehrkraftfunktionen und Education-Support. Nach Ablauf bleiben vorhandene Kurse, lokale Schülerprojekte, bereits konfigurierte Geräte und die Offline-Basisfunktion les- und nutzbar; neue Inhalte, neue Geräteaktivierungen, Updates, Cloud-Synchronisation und Support enden. Die Schule darf ihre eigenen Daten jederzeit exportieren.

## Cloud- und Entitlement-Modell

Cloud ist hier kein Zwangsspeicher für ein Zuhause, sondern die kontoübergreifende Entwicklungs- und Komfortschicht. Die bereits vorhandene Trennung von Webshop, Account und Aktivierungscode bleibt verbindlich.

| Leistung | Cloud Kostenlos | Cloud Basic+ | Cloud Premium |
| --- | --- | --- |
| Konto, Community, öffentliche Hilfe | Ja | Ja | Ja |
| Eigene Entwicklungsprojekte | Bis 5, mit fairen Speicher-/Traffic-Limits | Praxis-Kontingent für regelmäßige Projekte | Großzügiges Kontingent, aktuell technisch bis 200 Projekte als Missbrauchsgrenze |
| USB-Flash und Community-Hardware | Ja, soweit technisch kompatibel | Ja | Ja |
| Geräteinventar und lokales Pairing | Ja | Ja | Ja |
| Geführte Grundlagen und Projektvorschau | Ja | Ja | Ja |
| Zusätzliche geführte Lernprojekte, geprüfte Templates und Projekt-Assets | Vorschau bzw. einzelne kostenlose Inhalte | Enthalten: praxisnahe Standardbibliothek | Enthalten: vollständige Premium-Bibliothek und verbundene Erweiterungen |
| Entwicklungs-, Hilfe- und Community-KI | Kein kostenpflichtiger externer KI-Anspruch; kostenlose lokale Hilfe kann später separat freigegeben werden | Kleines, klar veröffentlichtes Monatskontingent für konkrete Projektfragen | Höheres, klar veröffentlichtes Monatskontingent; über das Kontingent hinaus Prepaid-Credits |
| Projekt-Push, Cloud-/OTA-Komfort und längere Retention | Kleine, transparent dokumentierte Basisquote | Praxis-Kontingent | Erweitertes Kontingent mit Limits und Kostenkontrolle |
| Home-Server-Softwarelizenz | Nicht enthalten | Im Jahresabo für eine private Home-Instanz enthalten | Im Jahresabo für eine private Home-Instanz enthalten |

Die Stufen verkaufen **schrittweise mehr Zeitgewinn und fortlaufende Hilfe**, nicht das Recht, eigene Geräte grundsätzlich weiter zu benutzen:

- **Kostenlos** beweist den Nutzen: eigene Hardware, erste Projekte, lokales Pairing und offene Community.
- **Basic+** ist die alltägliche Praxisstufe: mehr Projekte, eine breite getestete Projektbibliothek, ein kleines KI-Budget und ausreichend Cloud-Komfort für regelmäßige Maker.
- **Premium** ist die Vertiefungsstufe: vollständige Lern- und Erweiterungsbibliothek, höhere KI-/Cloud-Kontingente und anspruchsvollere vernetzte Projekte.

Damit wird Premium nicht zur bloßen Paywall, und Basic+ ist kein künstlich verstümmeltes Premium. Jede Stufe muss allein einen klaren Zweck erfüllen.

Weitere private Stufen über Kostenlos, Basic+ und Premium hinaus sind vorerst abzulehnen. Falls sich später ein klarer Bedarf zeigt, ist ein **KI-Credit-Add-on** besser als ein vierter Tarif: Es löst ein messbares Verbrauchsproblem und passt zu der bereits vorgesehenen Prepaid-/Ledger-Architektur.

### Modelle für Organisationen

Nur drei Ergänzungen haben eigenständigen Nutzen:

- **Education/School:** Lehrkraft-/Klassensatzverwaltung, zeitlich begrenzte Lernzugänge, Offline-/Klassensatz-Flash, Datenschutz- und Rollenmodell. Nicht einfach rabattiertes Premium.
- **Team:** gemeinsame Organisation, Rollen, Gerätepool, abrechenbare Projekte und zentrale Rechnungsadresse. Erst anbieten, wenn Mehrmandanten-/Rollen- und Auditfunktionen produktreif sind.
- **Managed/Private Instance:** reservierte Region, eigene Instanz oder On-Premises-Betrieb nur für Organisationen mit nachvollziehbaren Compliance-, Integrations- oder Verfügbarkeitsanforderungen. Kein Self-Service-Angebot; es ist ein Betriebsvertrag mit Mindestpreis und Support-Scope.

### Bastler-Support und Engineering-Dienstleistungen

Neben Produkten kann GerNetiX **individuelle Bastler-Unterstützung und Engineering-Dienstleistungen nach Absprache** anbieten. Das ist kein Bestandteil eines Cloud- oder Home-Abos und kein pauschales 24/7-Supportversprechen.

| Angebot | Typischer Nutzen | Verbindliche Grenze |
| --- | --- | --- |
| Bastler- und Projektunterstützung | Idee strukturieren, Hardware-/Architekturentscheidung bewerten, Fehlersuche eingrenzen, nächsten Projektschritt planen | Umfang, Kanal und Zeitbudget werden vorab vereinbart; Community- und Standardhilfe bleiben davon getrennt |
| Engineering-Dienstleistung | Machbarkeitsanalyse, Architektur, Prototyping, technische Analyse oder klar abgegrenzte Entwicklung | Auftrag, Ergebnis, Abnahme, Rechte an Arbeitsergebnissen, Datenzugriff, Haftung und Vergütung werden individuell vereinbart |

Auf der öffentlichen Produktseite darf hierfür nur „nach Absprache“ geworben werden. Vor der Annahme müssen Ziel, Verantwortlichkeiten, verwendete Fremdkomponenten, Zugang zu Kundendaten/-systemen und ein klarer Leistungsumfang schriftlich geklärt sein. Leistungen mit Sicherheits-, Elektro-, Medizin-, Produktions- oder sonstigem reguliertem Einsatz benötigen eine gesonderte Risiko- und Vertragsprüfung.

## Lizenz- und Ablaufmodell

### Empfohlenes Modell

| Angebot | Abrechnung | Enthält | Nach Ablauf |
| --- | --- | --- | --- |
| Hardware (Flashbox, Home) | Einmalig | Das physische Gerät, gesetzliche Gewährleistung, Grundfunktion | Hardware bleibt nutzbar |
| Basic+ monatlich | Monatlich, jederzeit kündbar | Basic+-Cloud für die Laufzeit | Fällt auf Kostenlos zurück |
| Premium monatlich | Monatlich, jederzeit kündbar | Premium-Cloud für die Laufzeit | Fällt auf Kostenlos zurück |
| Basic+ jährlich | Jährlich zum Preis von zehn Monaten | Zwölf Monate Basic+; **eine** Home-Server-Softwarelizenz für den privaten Betrieb | Fällt auf Kostenlos zurück; Home bleibt lokal funktionsfähig |
| Premium jährlich | Jährlich zum Preis von zehn Monaten | Zwölf Monate Premium; **eine** Home-Server-Softwarelizenz für den privaten Betrieb | Fällt auf Kostenlos zurück; Home bleibt lokal funktionsfähig |
| Home Small Server-Lizenz einzeln | Jährlich oder mehrjährig, nicht als unkündbare Einmalzahlung | Setup Tool, signierte Images, neue Installationen, Updates, neue Integrationen und Premium-Home-Komfort auf freigegebener Hardware | Bestehende lokale Funktionen laufen weiter |
| KI-Credits | Prepaid, Ablauf transparent | Zusätzliches KI-Kontingent | Keine negativen Salden; Restlaufzeit offen ausweisen |

**Die Jahresabos von Basic+ und Premium kosten jeweils nur zehn Monatsraten, gewähren aber zwölf Monate Leistung und eine Home-Server-Softwarelizenz für eine private Instanz.** Der Bonus ist ein Nutzungsrecht, keine versteckte Hardwarefinanzierung. Er kann für eine gekaufte Appliance oder kundeneigene, freigegebene Hardware verwendet werden. Monatsabos schalten Home nicht frei; so bleibt die Lizenz einfach und es entstehen keine vermeidbaren Aktivierungs-/Churn-Konflikte. Wer ausschließlich lokal betreiben will, erhält die separate Home-Small-Server-Lizenz.

### Faire Degradierung nach Ablauf

Nach Ablauf einer Home-Lizenz bleiben ohne Zeitlimit aktiv: lokale Automationen, bereits gepairte Geräte, lokales MQTT, Home Assistant/Node-RED soweit installiert, bereits eingerichtete OTA-Ziele, lokaler Zugriff und Export der eigenen Daten. Gesperrt bzw. beendet werden nur: neue Geräte aktivieren, neue oder Premium-Integrationen installieren, signierte System-/Featureupdates, Cloud-Relay/-Sync, externe KI und Premium-Support.

Es gilt zusätzlich:

- Kein Fernabschalten, kein Löschen von Geräten, Projekten oder Automationen.
- Vor Ablauf: mindestens 30 Tage, 7 Tage und am Ablauftag klarer Hinweis in UI und E-Mail, mit lokalem Status sichtbar.
- Nach Ablauf: mindestens 90 Tage Cloud-Projekte und Daten lesbar/exportierbar; Lösch- und Retentionsfristen vor Verkauf verbindlich festlegen.
- Sicherheitsupdates: kritische Sicherheitsfixes für die letzte unterstützte Home-Version mindestens 12 Monate nach Ablauf oder bis zum Ende der zugesagten Produktunterstützung bereitstellen. Andernfalls wäre die Lizenz ethisch und wirtschaftlich schwer vertretbar.

## Wirtschaftliche Logik und Wettbewerb

| Produkt | Kaufgrund | Vergleichbare Kategorien | Differenzierung von GerNetiX |
| --- | --- | --- | --- |
| Flashbox | Wiederholbares Flashen, Diagnose und Recovery | USB-Programmer, ESP-Prog, Laptop/Web Serial | Geführter, inventarisierter und sicherer Gesamtworkflow statt nur Adapterhardware |
| Projekt-/Hardware-Bundles | Sicherer, schneller Aufbau eines konkreten Projekts | Einzelteile von Elektronikhandel und Maker-Shops, Lernkits | Getestete Referenzkonfiguration inklusive Software, Dokumentation und Kompatibilitätsnachweis; Alternativhardware bleibt offen |
| Geschenk-Gutschein mit ESP32 | Persönliches Geschenk mit sofortigem Praxisstart | Digitale Gutscheine, Elektronik-Einstiegskits | Einmalig aktivierbarer Gutschein plus kleines nutzbares Board statt bloßem Code |
| GerNetiX School | Offlinefähiger Embedded-Unterricht und OTA-Klassensatz | Einzelne Lernplattformen, mobile Koffer, manuelle Laptop-/USB-Setups | Eigenes Klassen- und Geräte-WLAN, lokaler Kursraum und kontrolliertes OTA ohne Internetpflicht |
| Home Small | Lokaler, datensparsamer Gerätebetrieb | Raspberry Pi mit Mosquitto, Home Assistant Green | GerNetiX-Geräte-, OTA- und Accountfluss bei Cloud-Optionalität |
| Home Big | Integrationen ohne selbstgebauten Serverbetrieb | NUC/Mini-PC, Home Assistant OS, NAS/Docker | Getestete GerNetiX-Integration, Backup-/Recovery- und Supportgrenzen |
| Cloud Premium | Schneller lernen, entwickeln und Projekte betreiben | Arduino Cloud, Blynk, Home Assistant Cloud, Maker-/KI-Lernplattformen | Verbindung aus ESP32-Lernen, sicherem Geräte-Lifecycle, lokaler Autonomie und nachvollziehbarer KI |

Das Alleinstellungsmerkmal ist nicht MQTT, Docker oder ein ESP32-Flash allein – diese sind austauschbar. Es ist die durchgängige, sichere Reise **Lernen → Bauen → Pairen → Aktualisieren → lokal betreiben**, mit Community-Hardware als offenem Einstieg und GerNetiX-Hardware als Komfort-/Supportoption.

Variable Kosten müssen produktseitig sichtbar steuerbar bleiben: KI über Credits und Preflight; Cloud-Traffic, Retention und OTA über veröffentlichte Quoten; Home-Support über klaren Scope statt "alles im Docker ist inklusive". Preise dürfen erst nach Stückliste, Versand/RMA, Zahlungsgebühren, Supportzeit, Hosting, KI-Kosten und Zielmarge festgelegt werden. Pauschale Preisversprechen wären derzeit Spekulation.

## Nutzerreisen und Aufstiegspfade

| Persona | Sinnvoller Start | Natürlicher nächster Schritt | Nicht erzwingen |
| --- | --- | --- | --- |
| Einsteiger | Basic + vorhandenes ESP32 oder Kit + geführte Grundlagen | Premium für Lernpfad und Assistenz; später Flashbox bei wiederholten USB-Problemen | Home und Flashbox nicht beim ersten Projekt bündeln |
| Maker | Basic oder Premium + Community-Hardware aus dem freien Handel | Ein passendes getestetes Bundle, Flashbox für Werkstatt/Recovery; Home Small bei mehreren WLAN-Geräten | GerNetiX-Hardware als Voraussetzung für eigene Boards |
| Beschenkter Einsteiger | Geschenk-Gutschein mit ESP32 | Gutschein aktivieren, erstes Projekt beginnen, passendes Bundle oder Basic+/Premium wählen | Die Person in einen Shop-Account, ein Abo oder einen Hardware-Lock-in drängen |
| Schule | GerNetiX School + vorprovisionierter OTA-Klassensatz | Lokale Kursräume, paralleles OTA, Lehrkraftverwaltung und bei Bedarf spätere Cloud-Synchronisation | Einzelkonten-/Monatsabo, Internetpflicht oder unkontrollierte Übernahme von Schülerdaten |
| Smart-Home-Nutzer | Home Small + Basic | Home Big, wenn Home Assistant, Automationen und Backups real benötigt werden; Premium für cloudgestützte Lern-/Komfortfunktionen | Cloud-Premium als Bedingung für lokale Automationen |
| Professioneller Entwickler | Basic/Premium für Entwicklung und Geräteworkflow | Team oder Managed/Private Instance bei Mehrnutzer- und Compliance-Bedarf | Home Big als Produktionsplattform ohne Vertrag/SLA |

Der Pfad `Kostenlos → Basic+ → Premium → Flashbox → Home Small → Home Big` ist damit eine **mögliche** Entwicklung, keine Verkaufspflicht. Besonders wichtig: Home Small ist ein paralleler Pfad für Datenschutz- und Offline-Bedarf, nicht zwingend die Belohnung nach Premium.

## Kritische Bewertung und Entscheidungen vor Markteintritt

1. **Home Small und Home Big dürfen nicht nur unterschiedlich starke Hardware sein.** Ohne getrennte Funktionsversprechen ist einer der beiden SKUs überflüssig. Small = Appliance; Big = Integrationsplattform.
2. **Flashbox-MVP ist noch unvollständig.** Der Bestand beschreibt Register/Pairing, aber der eigentliche Flashbox-Firmware-Flash und ein eigener signierter Update-/Recovery-Weg sind ausdrücklich noch nicht als HMI-Schritt umgesetzt. Erst nach diesem Nachweis als Produkt bewerben.
3. **Lokale Datenhoheit braucht ein konkretes Replikationsdesign.** Eigentum, Credentials, OTA-Freigabe, Konfliktauflösung, Offline-Ablauf und Restore müssen vor Home-Verkauf als Verträge definiert sein. Zwei gleichwertige Wahrheiten sind nicht zulässig.
4. **Lizenzerfüllung und Open Source prüfen.** Docker, Home Assistant, Node-RED, Grafana und Mosquitto benötigen eine vollständige Lizenz-, Marken- und Supportprüfung; "inkludiert" darf nicht suggerieren, GerNetiX sei deren Hersteller oder garantiere fremde Add-ons.
5. **Sicherheits- und Lebenszyklusversprechen kosten Geld.** Signatur-/Schlüsselrotation, Updatekanäle, Backups, Geräte-CAs und Security-Fixes benötigen einen finanzierten Supportzeitraum, RMA-Prozess und EOL-Politik.
6. **Premium braucht messbare Limits.** Vor Verkaufsstart Kontingente für KI, Speicher, Traffic, OTA und Retention veröffentlichen; "unbegrenzt" ist bei variablen Kosten nicht belastbar.
7. **Education und Team erst bei echter Verwaltungsfähigkeit.** Ohne Rollen, Datenminimierung, Audit und Beschaffungsabläufe wären sie nur umbenannte Privatabos.
8. **Bundles brauchen Versions- und Ersatzteilpflege.** Vor Verkauf müssen Stückliste, elektrische Grenzen, getestete Firmware und ein Prozess für abgekündigte Komponenten feststehen. Sonst wird "getestet" zum nicht einlösbaren Supportversprechen.
9. **Der Gutscheinwert darf nie nur im ESP32 liegen.** Erfordert werden Geräte-Schlüsselerzeugung im Board, Challenge-Response, serverseitiger Gutschein-/Ledgerstatus, atomare Einlösung, Sperrung bei Verlust und ein geprüfter Ersatzprozess.
10. **School braucht eine echte Offline-Abnahme.** WLAN ohne WAN-Routing, vollständiger Unterrichtsablauf, lokales OTA für einen Klassensatz, Geräte-WLAN-Isolation, Rollback, Kurs-/Projektbackup, Stromausfall, Datenexport und bewusste spätere Synchronisation müssen mit einem Klassensatz getestet sein, bevor das Produkt beworben wird.

## Priorisierte Umsetzung

1. Produktnamen, Zielgruppen, enthaltene/nicht enthaltene Funktionen und Ablaufregeln als öffentliche Produktverträge bestätigen.
2. Entitlements für `home_license`, `cloud_basic_plus`, `cloud_premium`, KI-Credits, Gutscheinaktivierung und Organisationsrollen fachlich modellieren; Shop-Aktivierung und Account bleiben getrennt.
3. Home-Small-Referenzimage, Setup Tool, sichere Lizenzaktivierung, lokale Sicherung/Restore und einen klaren Synchronisationsvertrag für wenige freigegebene Hardwareprofile bauen.
4. Flashbox: signierter Update-/Recovery-Pfad, USB-Flash und serieller Monitor mit realer Hardware nachweisen.
5. GerNetiX-School-Referenzaufbau mit isoliertem Lernenden- und Geräte-WLAN, lokalem Kursraum, OTA-Klassensatz, Backup/Export und dem sicheren Unterschied zwischen Projekt-Reset und Identity-Reset in einer Schule pilotieren.
6. Erst danach Home Big und Education/Team skalieren; Managed/Private Instance nur nach operativem SLA- und Kostenmodell.

## Nachweisstatus im heutigen Bestand

- Bereits angelegt: Free/Premium-Entitlements, Projektlimits, KI-Kostenkontrolle, Geräteinventar, USB-/OTA-Architektur, Flashbox als kaufbares Inventar sowie die faire Grundregel für abgelaufene Home-Lizenzen.
- Noch Strategie bzw. Konzept: konkrete Home-Produkte, lokale Home-Runtime, Preisblatt, SLA/EOL, Abonnement-Abrechnung, veröffentlichte Ressourcenquoten und Organisationsangebote.
- Graph-Hinweis: Die zwei strategischen Zielangebote `product_offering.gernetix_home` und `product_offering.gernetix_cloud_premium` werden als Vorschläge im SQLite-Graphen geführt; sie ersetzen keine bestehenden Legacy-YAML-Angebote.
