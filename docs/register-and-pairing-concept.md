# Register and Pairing Concept

## Zweck

Register and Pairing trennt drei Fragen sauber voneinander:

- Wem gehoert ein konkretes Geraet?
- Ist das Geraet ein von GerNetiX provisioniertes Board?
- Darf dieses Geraet fuer Support, OTA, Fernwartung oder Projekt-Flash verwendet werden?

Die Plattform soll eigene Hardware der Nutzer nicht ausschliessen. Community-Hardware darf in der IDE inventarisiert, fuer Projekte gematcht und bei technischer Eignung geflasht werden. GerNetiX-Hardware muss aber eindeutig als von GerNetiX provisioniert erkannt werden koennen, damit Support-, Garantie- und Reklamationsgrenzen nachvollziehbar bleiben.

## Zwei Register-Flows

### Hersteller-Register

Das Hersteller-Register passiert intern durch GerNetiX, typischerweise mit dem Provisioning Tool.

Ziel:

- konkretes physisches Board als GerNetiX-Board anlegen
- Seriennummer, Hardwareprofil und Charge dokumentieren
- initiale Firmware per USB flashen und OTA-Faehigkeit vorbereiten
- geräteeigenen P-256-Schluessel erzeugen und dessen oeffentlichen Schluessel zertifizieren
- Support- und Garantiegrundlage schaffen

Ergebnis:

- `Device` ist bekannt
- `DeviceAuthenticity` ist `gernetix_verified`
- `DeviceCredential` erlaubt spaeter einen Challenge-Response-Nachweis
- `DeviceSupportEntitlement` kann fuer Support/Reklamation geprueft werden

Das Provisioning Tool flasht im Hersteller-Register die Basissoftware fuer das physische Board ausschliesslich ueber USB. Es waehlt ein ProcessorBoard aus dem Hardware-Katalog und leitet daraus Hardwareprofil, Basissoftware-Profil und Factory-Firmware-Artefakt ab. Nach dem Flash erzeugt der ESP32 seinen privaten P-256-Schluessel selbst. Ueber den lokalen Device-Endpunkt `/provisioning` werden Kennungen und Trust-Anker geschrieben; zurueck kommt nur der oeffentliche Device-Schluessel. Das Tool stellt dafuer ein mTLS-Client-Zertifikat aus und prueft den privaten Schluesselbesitz per signierter Challenge. Private Device- oder OTA-Schluessel werden weder im Factory-Payload noch im Device Management gespeichert.

Der vollstaendige Ablauf ist als UML-Sequenzdiagramm dokumentiert: [provisioning-process-sequence-uml.md](provisioning-process-sequence-uml.md).

### Kunden-Register und Pairing

Das Kunden-Register passiert in der IDE oder im Kundenkonto.

Ziel:

- Geraet einem Account zuordnen
- vorhandene eigene Hardware nutzbar machen
- OTA- und Projektkompatibilitaet aus dem Profil ableiten
- mehrere kompatible Devices fuer ein Setup-Rezept auswahlen koennen

Ergebnis:

- `AccountDevice` liegt im Profil/Inventar
- `DeviceOwnership` ordnet Geraet und Account zu
- `DeviceOtaEndpoint` beschreibt Hostname, IP, OTA-Status und letzten Kontakt
- `authenticityStatus` bleibt getrennt von `ownershipStatus`

## Echtheitsnachweis

Eine Seriennummer alleine reicht nicht, weil sie kopiert werden kann. GerNetiX-Boards brauchen deshalb einen Challenge-Response-Nachweis.

Minimaler Ablauf:

```text
Backend/IDE -> Device: random challenge
Device -> Backend/IDE: deviceId, serialNumber, ECDSA-P256-Signatur(challenge)
Backend/IDE prueft: passt die Signatur zum registrierten oeffentlichen Schluessel?
```

Wichtig:

- Der private Device-Schluessel verlaesst den ESP32 nicht.
- Das Backend speichert nur oeffentlichen Schluessel, Zertifikatsmetadaten und Pruefergebnisse.
- Kopierte Seriennummern erzeugen keinen gueltigen Echtheitsnachweis.
- Community-Hardware darf weiter funktionieren, aber bleibt `community_unverified`.

## Device-Klassen

### GerNetiX Verified

Von GerNetiX provisioniert und erfolgreich nachgewiesen.

Darf je nach Plan und Status:

- im Account als geprueft erscheinen
- Support-/Garantieanspruch tragen
- fuer gefuehrte OTA-Flows genutzt werden
- Fernwartungs- oder Diagnosefunktionen erhalten

### Community / Own Hardware

Vom Nutzer selbst gekauft oder selbst gebaut.

Darf:

- im Profil inventarisiert werden
- fuer passende Projekte gematcht werden
- per USB oder OTA genutzt werden, wenn technisch moeglich

Darf nicht automatisch:

- GerNetiX-Hardware-Support beanspruchen
- als von GerNetiX verkauft gelten
- Garantie- oder Reklamationsansprueche erzeugen

## Community-Board-Discovery ueber Recovery Tool

Ein typischer Neukundenfall ist ein guenstig gekauftes ESP32-Board von eBay, Amazon oder einem anderen Anbieter. Der Nutzer weiss oft nicht, welches genaue Boardprofil vorliegt, welche Pins sicher nutzbar sind, ob eine Onboard-LED existiert, ob ein Display vorhanden ist oder welche Beschriftung was bedeutet.

Das Recovery Tool soll diesen Einstieg erleichtern:

```text
Unbekanntes Board per USB verbinden
-> Recovery Tool erkennt USB/Chip soweit moeglich
-> GerNetiX Discovery Firmware flashen
-> Device startet AP, Webinterface, Weblog und OTA-Basis
-> Basisdaten erfassen: Chip-ID, Flash-Groesse, Runtime-Version, Connectivity
-> gefuehrte Fragen stellen, wenn Capabilities nicht automatisch erkennbar sind
-> Community Hardware Profile oder AccountDevice-Eintrag erzeugen
```

Beispiele fuer gefuehrte Fragen:

- Hat dein Board WLAN?
- Kannst du es per USB flashen?
- Hat es eine Onboard-LED?
- Weisst du den LED-Pin?
- Ist ein Display angeschlossen?
- Weisst du SDA/SCL fuer I2C?
- Weisst du, an welchem Pin ein Sensor oder Aktor angeschlossen ist?

Wenn der Nutzer eine Eigenschaft nicht kennt, bleibt sie `unknown`. Unbekannt ist weder `false` noch `true`; unbekannte Capabilities duerfen nicht automatisch fuer pflichtige Lernprojekte verwendet werden. Das Tool darf dann Alternativen anbieten, zum Beispiel ein bekanntes Boardprofil auswaehlen, ein GerNetiX-Kit nutzen oder das Projekt auf den Minimalumfang reduzieren.

Die Business-Argumentation ist Neukundengewinnung durch erleichterten Einstieg. Community-Hardware bleibt nutzbar und lernfoerdernd, erzeugt aber keinen GerNetiX-Hardware-Support-, Garantie- oder Reklamationsanspruch.

## OTA-Auswahl in der IDE

Wenn ein Nutzer ein Setup-Rezept oder Lernprojekt oeffnet, ermittelt die IDE benoetigte TechnicalCapabilities und sucht passende Account-Devices.

Ablauf:

```text
Projekt/Setup-Rezept oeffnen
-> benoetigte TechnicalCapabilities bestimmen
-> AccountDevice-Inventar filtern
-> OTA-faehige und kompatible Devices anzeigen
-> Nutzer waehlt Zieldevice
-> Build/Flash ausfuehren
-> Ergebnis im Profil speichern
```

Beispielauswahl:

```text
Sven ESP32 DevKit       verified   online   OTA ready
Keller Sensor ESP32     community  online   OTA ready
Arduino Nano Testboard  community  online   OTA unsupported
```

## Zustandsmodell

```text
unknown
registered_by_customer
provisioned_by_gernetix
pairing_pending
paired_to_account
active
revoked
replaced
retired
```

`provisioned_by_gernetix` beschreibt Echtheit. `paired_to_account` beschreibt Besitz/Zugriff. Diese Zustande duerfen fachlich nicht vermischt werden.


## Device Management Server

Register, Pairing, Echtheitsnachweis, Account-Device-Inventar, OTA-Zielauswahl und Supportberechtigung werden fachlich im Device Management Server gebuendelt.

Im MVP laeuft dieser Bereich als Modul im gemeinsamen Backend fuer Account, Learning und Wissensspeicher. Die API bleibt trotzdem extern ansprechbar, damit ESP-Firmware, User IDE, Recovery Tool und Provisioning Tool denselben Device-Zustand verwenden koennen.

API-Prefix im MVP:

```text
/api/device-management
```

Spaetere Auslagerung bleibt moeglich, z. B. als eigener Dienst `devices.gernetix.com`.

### Provisioning-Weg zuerst auswaehlen

Der Provisioning-Bereich im Plattform-Frontend beginnt immer mit einer expliziten, nicht vorbelegten Wahl zwischen `WLAN` und `USB`. Beide Wege sind gegenseitig ausschliessend. Erst nach der Wahl wird der zugehoerige Ablauf angezeigt; ein Wechsel verwirft vorhandene Suchergebnisse und Zwischenzustaende des vorherigen Wegs.

- `WLAN` sucht ausschliesslich bereits provisionierte Boards, auf denen die GerNetiX-Basissoftware laeuft und die im gleichen lokalen Netzwerk erreichbar sind. Dieser Hinweis muss vor Beginn der WLAN-Suche sichtbar sein.
- `USB` ist der Weg fuer neue, blanke, fremd geflashte oder ueber WLAN nicht erreichbare Boards. Nur in diesem Ablauf werden USB-Port, Browser-Web-Serial und USB-nahe Fallbacks angeboten.
- Vor der Suche werden weder Prozessorfamilie noch IoT-Device abgefragt, weil der aktive Transport den Erkennungsweg bestimmt. Der USB-Bootloader liefert zunaechst nur das Prozessorprofil. Danach kann der Nutzer ein dazu kompatibles, bekanntes konkretes Board aus dem Hardware Catalog waehlen. Dessen gepruefte Standardausstattung wird zur Bestaetigung vorbelegt; ohne Auswahl bleibt das generische Prozessorprofil erhalten. Ein kurzer Board-Name wird erst angeboten, nachdem ein uebernehmbares Board gefunden wurde.

Die Transportwahl aendert nicht die fachliche Trennung zwischen Provisionierung, Registrierung und Pairing. Sie bestimmt lediglich, wie das Board fuer den gefuehrten Ablauf erreicht wird.

### Connectivity Setup ist kein Pairing

Der Device-Webserver darf das WLAN-Setup anbieten, aber dieses Setup ist fachlich vom Pairing getrennt.

Ablauf:

```text
Device startet AP
-> Device-Webserver scannt verfuegbare WLANs
-> Nutzer waehlt SSID aus Liste
-> Nutzer gibt Passwort ein
-> Device speichert WLAN-Daten lokal in NVS/Flash
-> Device wechselt in Node-Modus
-> Device meldet Connectivity-/OTA-Status an Device Management Server
```

Der zentrale Server speichert kein WLAN-Passwort. Eine manuelle SSID-Eingabe ist nur ein Fallback fuer versteckte WLANs oder Expertenmodus.



### Datenschutz und Consent

Device-Management-Daten koennen kundenrelevant sein, sobald sie einem Account, einem Nutzerprofil, einem Supportfall oder einem konkreten Besitz-/Pairing-Kontext zugeordnet sind. Admin- und Support-Sichten duerfen diese Daten nur mit gueltigem Consent, dokumentierter Rechtsgrundlage oder zwingendem Sicherheits-/Missbrauchsgrund einsehen.

Ohne Consent muessen Detaildaten maskiert oder gesperrt bleiben. Jede Einsicht wird ueber `CustomerDataAccessAuditEvent` protokolliert.

Kundenrelevant sind insbesondere AccountDevice, DeviceOwnership, PairingSession, DeviceOtaEndpoint, SupportEntitlement, Kompetenz-/Lernfortschritt und KI-/Usage-Bezug.
### Admin- und Support-Sichten

Das Admin Tool nutzt den Device Management Server fuer alle Device-bezogenen Pruefungen. Damit liegen Statuspruefung, GerNetiX-Verified-vs-Community-Unterscheidung, Pairing, Connectivity, OTA, Credentials und Support-Entitlement fachlich unter Device Management.

Typische Unterfunktionen:

- Device suchen
- Device-Status pruefen
- Pairing-Status pruefen
- Connectivity-Status pruefen
- OTA-Status pruefen
- GerNetiX-verified Hardware von Community-Hardware unterscheiden
- Provisionierungs- und Credential-Historie ansehen
- Support- und Reklamationsgrundlage pruefen
### Pairing-Kanaele

Mehrere Pairing-Kanaele sind erlaubt:

- `device_webserver`
- `recovery_tool`
- `provisioning_tool`
- `ide_pairing_code`

Alle Kanaele erzeugen dasselbe fachliche Ergebnis: `AccountDevice`, `DeviceOwnership` und eine abgeschlossene `DevicePairingSession`.
## Traceability

Business-Ziele:

- `BG-004`: vorhandene Hardware optimal nutzen
- `BG-006`: Hardwarevertrieb und Support absichern
- `BG-007`: robuste Flash- und Recovery-Prozesse sichern

Customer Journeys:

- `CJ-002`: Benutzer inventarisiert vorhandene Hardware
- `CJ-006`: Benutzer besitzt ein neues ProcessorBoard
- `CJ-010`: Support prueft registriertes Board
- `CJ-011`: Benutzer kauft passende Hardware in der IDE

Zentrale Requirements:

- `requirement.device_manufacturer_registration`
- `requirement.device_customer_registration_and_pairing`
- `requirement.device_authenticity_challenge_response`
- `requirement.community_hardware_supported_without_entitlement`
- `requirement.ide_ota_device_selection_from_profile`
- `requirement.device_support_entitlement_traceability`
