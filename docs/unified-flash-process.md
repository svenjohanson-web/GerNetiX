# Einheitlicher GerNetiX-Flashprozess

## Architekturentscheidung

Jede kundenbediente Aktion, die Firmware auf ein Board schreibt, öffnet denselben zentralen Flash-Dialog. Produktseiten, IDE, Provisioning, geführte Projekte und FlashBox-Einrichtung dürfen keinen eigenen Flash-Assistenten und keine eigene Abfolge aus Portwahl, Transportwahl und Fortschrittsanzeige definieren.

Der Dialog erzeugt einen normalisierten Flashauftrag mit genau diesen sichtbaren Bestandteilen:

1. Flash-Ziel und Sicherheitskontext,
2. die tatsächlich zu übertragende Flash-Datei mit Version, Größe und SHA-256, sobald sie bekannt ist,
3. die drei stabilen Transportoptionen `USB`, `OTA` und `FlashBox`,
4. eine konkrete Begründung für jeden nicht verfügbaren Transport,
5. ein gemeinsames Terminal für Prüfung, Download, Schreiben, Verifikation, Neustart und Fehler.

## Verantwortungsgrenze

`unified-flash-dialog.js` besitzt Darstellung, Transportauswahl, Sperrbegründung und Terminal. `unified-flash-executor.js` besitzt den technischen USB-Ablauf aus Download, Größen- und SHA-256-Prüfung, Quellreferenzprüfung, Bootloader-Verbindung, Schreiben, Reset, Terminalmeldungen und Fehlerweitergabe. Ein aufrufender Produktbereich liefert nur einen `FlashDialogConfig`, fachliche Vorbedingungen und Transportkontext; er darf weder eine zweite Flash-Bedienoberfläche noch einen eigenen USB-Schreibablauf erzeugen.

```text
Flash-Einstieg
  -> zentraler FlashDialogConfig
  -> Flash-Dialog (Artefakt + USB/OTA/FlashBox + Terminal)
  -> gemeinsamer FlashExecutor + gewählter Transportadapter
  -> Build/Artifact Store bzw. lokaler Serial Service/Device/FlashBox
  -> Ergebnis zurück in dasselbe Terminal
```

Der Flash-Dialog speichert keine fachlichen Daten. Build- und Gerätezustände bleiben in ihren zuständigen Diensten. Firmwarebytes liegen ausschließlich im Artifact Store. Jede angezeigte Binary muss über Build/Release eine Quellreferenz mit Quellpfad und Quellversion besitzen; der Dialog erfindet weder Artefakte noch Quellstände.

## Verbindliche Regeln

- Ein Flash-Einstieg startet nie direkt einen USB-, OTA- oder FlashBox-Schreibvorgang.
- Alle drei Transportarten bleiben im Dialog sichtbar. Nicht verfügbare Wege sind auswählbar, aber der Start ist gesperrt und begründet.
- Ein deaktivierter Flash-Start besitzt immer dieselbe sichtbare Begründung wie sein `title`/Accessible Name.
- Das Terminal erhält echte Adaptermeldungen. Ein Erfolg darf erst nach der Rückmeldung des zuständigen Adapters erscheinen.
- Vor jedem USB-Schreibvorgang prüft der gemeinsame Executor jede Binärdatei gegen erwartete Größe und SHA-256 sowie auf Quellpfad und Quellversion. Fehlt eine Angabe, wird nichts geschrieben.
- Meldet der lokale Serial Service eine Version unterhalb der für den verifizierten Flash erforderlichen Mindestversion, fragt die Plattform ausdrücklich nach Zustimmung zum Helper-Update. Erst danach lädt sie das für Betriebssystem und Architektur freigegebene Installationspaket aus dem authentifizierten Downloadbereich. Die Systeminstallation benötigt weiterhin die Bestätigung des Betriebssystems; GerNetiX wartet auf die erneut gemeldete Mindestversion und setzt erst dann denselben Flashauftrag automatisch fort. Ablehnung, fehlender Release, fehlende Anmeldung oder Zeitüberschreitung schreiben nichts auf das Board.
- Provisioning verwendet dieselbe technische Ausführung; nur Board-/Profilwahl vor dem Flash und WLAN-/Account-Zuordnung nach dem Flash bleiben provisioning-spezifisch.
- Wechselnde Produkttexte dürfen den Vertrag erweitern, aber nicht die Reihenfolge oder Grundbedienung verändern.
- Factory- und Support-Werkzeuge ohne Kundenbedienung dürfen eigene HMIs behalten; sobald ein Ablauf Teil der Identity-Plattform oder einer öffentlichen GerNetiX-Kundenseite ist, gilt der zentrale Dialog.

## Umgesetzte Einstiege

- User IDE: ein einziger Button `Flashen…` statt separater USB-, OTA- und FlashBox-Buttons.
- Öffentlicher Nexi-Release: Flashdatei und USB-Adapter im zentralen Dialog; OTA und FlashBox sind mit Grund sichtbar gesperrt.
- Öffentliche S3-Touch-Spielesammlung: Release-Datei, direkter USB-Adapter sowie die accountgebundenen Übergänge zu OTA und FlashBox liegen im zentralen Dialog.
- Identity-Provisioning: Basissoftware wird als zentraler Flashauftrag geöffnet.
- Öffentliche FlashBox-Einrichtung: geprüftes Initialimage wird im zentralen Dialog ausgeführt.
- Geführte Projektlabore: auch die didaktische Flashsimulation verwendet denselben Dialog und dasselbe Terminalmodell.

## Erweiterung

Neue Flash-Einstiege werden ausschließlich durch einen weiteren `FlashDialogConfig`-Adapter ergänzt. Änderungen an Transportwahl, Artefaktdarstellung oder Terminal erfolgen nur im zentralen Dialog und gelten dadurch für alle Einstiege.
