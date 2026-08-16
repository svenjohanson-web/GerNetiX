# Ferngesteuerte Hühnerstalltür und Smartphone-App-Lernprojekt

## Ziel und Lieferumfang

Das Projekt verbindet einen öffentlichen, kontofreien Nachbauweg mit einem
separaten accountgebundenen Lernweg:

- Das **Nachbauprojekt** beschreibt Mechanik, Kleinspannungselektronik,
  Zustandsrückmeldung, lokale Sicherheitsgrenzen und die alternativen
  Kommunikationswege WLAN und LoRa.
- Das **Lernprojekt** führt vom sicheren Türzustandsvertrag zu einer eigenen
  installierbaren Smartphone-Web-App. Es verwendet für WLAN-Controller und
  WLAN-zu-LoRa-Gateway denselben logischen API-Vertrag.

Der aktuelle Lieferstatus des Nachbauprojekts ist **Anleitung**. Es existiert
noch keine veröffentlichte, direkt flashbare und am realen Stall abgenommene
Firmware. Die Seite darf deshalb weder einen fertigen Release noch eine
Flash-Aktion versprechen.

## Fachliche Systemgrenze

Die Fernbedienung sendet ausschließlich Bedienabsichten:

```text
Smartphone-App
  -> WLAN-Controller oder WLAN-zu-LoRa-Gateway
  -> Stallcontroller
  -> Motor und Türmechanik
```

Der Stallcontroller bleibt die einzige Instanz, die eine Bewegung lokal
freigibt. Er wertet Endlagen, Hindernis beziehungsweise Motorstrom, maximale
Fahrzeit und lokale Taster aus. App und Gateway dürfen diese Entscheidung nicht
vorwegnehmen oder umgehen.

LoRa ist keine direkte Smartphone-Schnittstelle. Im LoRa-Weg spricht das
Smartphone per WLAN und HTTPS mit einem Gateway. Nur Gateway und Stallcontroller
tauschen kleine LoRa-Telegramme aus. LoRa ersetzt damit den Transport, nicht
Zustandsmodell, Berechtigungsprüfung oder lokale Sicherheitslogik.

## Türzustände und Befehle

Der sichtbare Controllerzustand unterscheidet mindestens:

- `open`
- `closed`
- `opening`
- `closing`
- `stopped`
- `blocked`
- `unknown`

Die App darf die Endlage nicht aus dem zuletzt gedrückten Button ableiten. Ein
Befehl enthält eine eindeutige `command_id` und die gewünschte Aktion `open`,
`close` oder `stop`. Eine Annahmebestätigung bedeutet noch nicht, dass die
physische Bewegung erfolgreich beendet wurde. Erst der danach gemeldete
Controllerzustand bestätigt Bewegung, Endlage oder Störung.

## Sicherheitsgrenzen des Nachbaus

- Ausschließlich geeignete Kleinspannung für die offene Maker-Elektronik; eine
  Netzspannungsversorgung bleibt in einem geschlossenen, geeigneten Netzteil.
- Getrennte Motor- und Logikversorgung mit Sicherung und gemeinsamem Bezug; der
  Motorstrom fließt nie durch das ESP32-Board.
- Zwei reale Endlagen, begrenzte Fahrzeit und eine zweite Abschaltbedingung über
  Motorstrom oder Hindernissensor.
- Gut erreichbarer lokaler Stopptaster, sichtbare Zustandsanzeige und manuelle
  Entriegelung.
- Funkverlust, unbekannte Position oder widersprüchliche Sensorik führen nicht
  zu automatischen Wiederholungsfahrten.
- Automatische Zeit- oder Dämmerungssteuerung ist erst eine spätere Erweiterung
  und benötigt einen nachgewiesenen Schutz für Tiere im Fahrweg.

Der Maker-Aufbau ist keine zertifizierte Maschinensteuerung. Vor
unbeaufsichtigtem Betrieb müssen Mechanik, Kraft, elektrische Auslegung,
Witterungsschutz und reale Fehlerfälle fachkundig beurteilt werden.

## Aufbau des Lernprojekts

Das Katalogprojekt `chicken-coop-door-smartphone-app` besitzt drei
wiederverwendbare DevelopmentLessons mit jeweils drei Steps:

| Lesson | Ergebnis |
| --- | --- |
| Sicherer Vertrag vor der App | Systemgrenze, Türzustandsmodell und API-Vertrag sind festgelegt |
| Die eigene Smartphone-App bauen | Statusanzeige, Bedienabsichten, Manifest und Service Worker sind umgesetzt |
| Fehlerfälle, Abnahme und LoRa-Gateway | Negative Tests, Ende-zu-Ende-Abnahme und Gatewaygrenze sind beschrieben |

Die mitgelieferte Web-App verwendet relative API-Pfade. Dadurch kann derselbe
Client vom WLAN-Controller oder vom LoRa-Gateway ausgeliefert werden. Für eine
echte PWA-Installation und Service Worker ist ein vertrauenswürdiger
HTTPS-Origin nötig. Ein reiner lokaler HTTP-Prototyp bleibt eine Browser-App.
API-Antworten werden niemals in den Offline-Cache aufgenommen. Startet nur die
App-Hülle aus dem Cache, zeigt sie `unknown` und sperrt Bewegungsbefehle.

## Plattformintegration

- Öffentliche Katalogroute:
  `/nachbauprojekte/huehnerstalltuer/`
- Accountgebundener Lernkatalog-Slug:
  `chicken-coop-door-smartphone-app`
- Das Lernprojekt ist vorerst kostenlos verfügbar; ein Konto bindet die
  Projektinstanz und den Lesson-/Step-Fortschritt an den Lernenden.
- Die vorhandene Identity-/Project-Server-Kette materialisiert die
  Lernprojektinstanz und speichert Lesson-/Step-Fortschritt.
- Es entsteht kein neuer GerNetiX-Serverprozess und keine neue
  Persistenzwahrheit.
- Smartphone-App, Beispiel-API und LoRa-Gateway sind Lernartefakte und werden
  nicht als bereits produktiv betriebene Remote-Steuerung ausgegeben.

## Weitere Ausbaustufen

1. Exakte Motor-, Treiber-, Sensor- und Boardprofile auswählen und als
   Hardware-Stückliste abnehmen.
2. Stallcontroller-Firmware mit lokaler Zustandsmaschine und Tests umsetzen.
3. WLAN-Ende-zu-Ende-Test mit realer Mechanik durchführen.
4. Optionales LoRa-Gateway mit Nachrichtenauthentifizierung, Replay-Zähler,
   regionalem Frequenzplan und Reichweitentest ergänzen.
5. Erst nach Hardware-Abnahme einen unveränderlichen Public-Demo-Release bauen
   und den Lieferstatus gegebenenfalls auf direkt flashbar anheben.
6. Eine native Android-/iOS-App bleibt eine spätere Vertiefung; sie verwendet
   denselben Türvertrag, benötigt aber eigene Build-, Signierungs- und
   Veröffentlichungswege.
