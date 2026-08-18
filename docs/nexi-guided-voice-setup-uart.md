# Gefuehrte Nexi-Spracheinrichtung ueber UART

## Ziel

Nach dem Flashen fuehrt Nexi den Nutzer durch die lokale Einrichtung aller acht
vollstaendigen Sprachsaetze. Das Board ist die einzige Quelle fuer Fortschritt,
aktiven Satz und erwartete Handlung. Die oeffentliche Inbetriebnahmeseite zeigt
diesen Zustand an und kann die Anweisung nach einer bewussten Nutzeraktion mit
der lokalen Browser-Sprachausgabe vorlesen.

Die Seite fuehrt keinen eigenen Einrichtungszaehler. Ein Reload, ein Wechsel des
USB-Ports oder eine verspaetete Verbindung rekonstruiert den sichtbaren Stand
immer aus der naechsten Boardantwort.

## Ablauf

```text
Board startet
-> vorhandene Satzprofile pruefen
-> Satz 1..8 auswaehlen
-> Aufnahme 1..2 anfordern
-> auf KEY2 warten
-> waehrend KEY2 aufnehmen
-> lokal annehmen oder denselben Schritt wiederholen
-> Merkmalsprofil lokal speichern
-> naechster Satz
-> complete
```

KEY1 pausiert die Einrichtung. Ein Neustart setzt bei bereits dauerhaft
gespeicherten Satzprofilen fort. Die Website darf den Boardzustand weder
ueberspringen noch als erfolgreich markieren.

## UART-Vertrag

Der vorhandene Vertrag `gernetix.serial_provisioning` bleibt das Protokoll.
Als Transport dient bevorzugt WebSerial direkt im Browser (Chrome/Edge unter
Windows, Linux und macOS); ist `navigator.serial` nicht verfügbar (Safari
unter macOS), übernimmt weiterhin der lokale GerNetiX Serial Service als
Sicherheitsgrenze. Project Hook API v2
stellt nur zwei lesende beziehungsweise wiederholende Projektaktionen bereit:

- `nexi_setup_status`: liefert den aktuellen Boardzustand.
- `nexi_setup_repeat`: liefert denselben Zustand mit neuer `revision`, damit
  die bereits sichtbare Anweisung bewusst erneut gesprochen werden kann.

Beide Antworten verwenden das Ereignis `nexi_setup_status` und Payload-Schema 1:

```json
{
  "schema_version": 1,
  "revision": 12,
  "state": "waiting_for_button",
  "step_index": 3,
  "step_count": 8,
  "reference_index": 1,
  "reference_count": 2,
  "phrase": "Hey Nexi, lauter",
  "instruction": "Halte KEY2 gedrueckt, sprich den angezeigten Satz und lass KEY2 danach los.",
  "expected_action": "press_and_hold_key2",
  "complete": false
}
```

Zustaende sind `starting`, `already_saved`, `waiting_for_button`, `recording`,
`accepted`, `retry`, `paused`, `error` und `complete`. Die `revision` steigt bei
jeder fachlichen Zustandsaenderung und bei `nexi_setup_repeat`. Die Seite fragt
den Zustand im Abstand von 750 Millisekunden ab und spricht eine Revision
hoechstens einmal automatisch.

## Audio- und Datenschutzgrenze

- Die integrierten Board-Mikrofone sind der einzige Aufnahmeweg.
- Roh-Audio und Merkmalsprofile verlassen das Board nicht.
- Die Website fordert keinen Mikrofonzugriff an und besitzt keinen eigenen
  Sprach- oder Fortschrittsspeicher.
- Die optionale Anleitung verwendet ausschliesslich lokale Browser-
  Sprachsynthese. Sie wird erst nach dem Klick auf `Nexi-Anleitung starten`
  aktiv und bleibt waehrend `recording` stumm, damit sie die Aufnahme nicht
  verunreinigt.
- Eine spaetere Ausgabe derselben Texte ueber den Boardlautsprecher benoetigt
  versionierte lokale Sprachassets und ist nicht Teil dieses Durchstichs.

## Akzeptanznachweis

- Contract-Tests pruefen die beiden UART-Aktionen, Schemafelder, acht Saetze,
  KEY2-Zustaende und die vergroesserte Projektantwort.
- UI-Tests pruefen Boardzustand, Satzanzeige, Fortschritt, lokale Sprachausgabe
  und das Fehlen von Browser-Aufnahme-APIs.
- Der vollstaendige ESP32-S3-Firmware-Build vom 2026-08-15 besteht. Er belegt
  50.012 Byte RAM und 1.513.557 Byte des 6.291.456-Byte-App-Slots.
- Flash und echter Hardwaretest bleiben ein ausdruecklicher Nutzerschritt.
