# Kopierschutz und Schutz der Basissoftware

## Ziel

Die GerNetiX-Basissoftware darf fuer Endnutzer, Kunden und nicht autorisierte Dritte nicht einsehbar, extrahierbar oder nachbaubar ausgeliefert werden. Ziel ist Schadensabwehr: Schutz von geistigem Eigentum, Schutz vor Manipulation und Schutz vor unsicheren Kopien.

## Sicherheitsanforderung

Der Nutzer darf niemals Zugriff auf den Quellcode, interne Build-Artefakte, Debug-Symbole, private Schluessel, internen Update-Code oder andere nicht oeffentliche Bestandteile der Basissoftware erhalten.

Ausgeliefert werden duerfen nur signierte Firmware-Images, die auf dem Zielgeraet ausgefuehrt werden koennen. Die Firmware muss so bereitgestellt werden, dass sie ohne autorisierte Werkzeuge weder sinnvoll ausgelesen noch veraendert und erneut gestartet werden kann.

## Technische Massnahmen

- Quellcode bleibt ausschliesslich in privaten Repositories und autorisierten Build-Systemen.
- Firmware-Updates werden als signierte Binaries ausgeliefert, niemals als Quellcode.
- ESP32 Secure Boot wird fuer Produktionsgeraete aktiviert.
- ESP32 Flash Encryption wird fuer Produktionsgeraete aktiviert.
- JTAG, UART-Bootloader-Zugriff und andere Debug-Schnittstellen werden fuer Produktionsgeraete deaktiviert oder streng kontrolliert.
- OTA-Updates werden nur akzeptiert, wenn die Signatur gueltig ist.
- Private Signatur- und Verschluesselungsschluessel verlassen niemals die autorisierte Build-Umgebung.
- Logs, Fehlerausgaben und Diagnosefunktionen duerfen keine internen Implementierungsdetails, Secrets oder Schluessel ausgeben.
- Produktions-Firmware wird ohne Debug-Symbole und ohne interne Testfunktionen gebaut.

## Nicht-Ziele

Ein absoluter Schutz gegen jede physische Laboranalyse kann nicht garantiert werden. Die Anforderung ist daher, wirtschaftlich und technisch sinnvolle Angriffe deutlich zu erschweren und Manipulationen am Geraet zu verhindern.

## Akzeptanzkriterien

- Ein Endnutzer erhaelt keinen Zugriff auf Source-Dateien, private Header oder Build-Skripte der Basissoftware.
- Ein Produktionsgeraet startet nur signierte Firmware.
- Ausgelesener Flash-Inhalt ist durch Flash Encryption nicht als Klartext-Firmware nutzbar.
- Debug- und Recovery-Zugaenge sind in der Produktion gesperrt oder nur mit autorisierten Schluesseln nutzbar.
- OTA-Updates mit ungueltiger oder fehlender Signatur werden abgelehnt.

