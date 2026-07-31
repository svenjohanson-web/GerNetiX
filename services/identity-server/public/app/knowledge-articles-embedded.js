// Wissensspeicher: Mikrocontroller, Embedded-Systeme und Hardware-Landschaft.
const KnowledgeArticlesEmbedded = {
    "hardware-landscape": {
      title: "Hardware-Landkarte: vom Akku bis Edge AI",
      summary: "Hardware ist keine Rangliste. Die Aufgabe entscheidet, ob ein kleiner Mikrocontroller, ein ESP32, Embedded Linux oder GPU-Edge-Computing sinnvoll ist.",
      access: "premium",
      hardwareLandscape: true,
      sections: [
        {
          heading: "Eine Rechenlandschaft statt einer Leistungspyramide",
          paragraphs: [
            "Ein Mikrocontroller führt ein einzelnes Programm direkt auf der Hardware aus. Er startet schnell, braucht wenig Energie und ist ideal für eine konkrete Aufgabe. Ein Embedded-Linux-System kann dagegen Prozesse, Netzwerkdienste und Dateien verwalten – dafür braucht es mehr Energie, Pflege und eine saubere Abschaltstrategie.",
          ],
          hardwareVisual: true,
        },
        {
          heading: "Die fünf Systemebenen",
          table: {
            headers: [
              "Systemebene",
              "Typische Beispiele",
              "Wofür sie passt",
            ],
            rows: [
              [
                "Einfache I/O-Steuerung",
                "Mikrocontroller mit wenigen Ein- und Ausgängen",
                "Ein Sensor, Taster, LED oder Relais mit geringem Energiebedarf und einer klaren Aufgabe.",
              ],
              [
                "Vernetztes Embedded-System",
                "ESP32-C3, ESP32-S3, ESP32-C6, vernetzter STM32",
                "Direkter Hardwarezugriff, Sensoren und Aktoren, lokale Bedienung sowie Funk oder Netzwerk.",
              ],
              [
                "Embedded Linux",
                "Raspberry Pi Zero 2 W, Compute Module, Industrie-SBC",
                "Gateway, Kamera, lokale Dienste, Datenpuffer oder umfangreichere Bedienoberflächen.",
              ],
              [
                "Industriesystem",
                "Industrie-Mikrocontroller, SPS, Industrie-PC",
                "Robuste Echtzeitsteuerung, Feldschnittstellen, lange Produktzyklen und definierte Betriebsanforderungen.",
              ],
              [
                "Edge-KI-System",
                "NVIDIA Jetson, Industrie-PC mit GPU, KI-fähiger SBC",
                "Bildverarbeitung und KI-Inferenz nahe an Kamera oder Maschine; kein Ersatz für Echtzeit-I/O.",
              ],
            ],
          },
        },
        {
          heading: "Erst die Aufgabe, dann die Systemebene",
          table: {
            headers: [
              "Wenn dein Projekt …",
              "meist passende Ebene",
              "Beispiel",
            ],
            rows: [
              [
                "lange mit Akku läuft und nur wenige Ein- und Ausgänge bedient",
                "Einfache I/O-Steuerung",
                "Temperatur-Node, Taster, LED, Relais",
              ],
              [
                "nah an Pins und Sensoren bleibt und Daten oder Bedienung bereitstellt",
                "Vernetztes Embedded-System",
                "GerNetiX-Device, Bewässerung, kleines Touch-UI",
              ],
              [
                "lokal mehrere Dienste, eine Kamera oder ein Gateway braucht",
                "Embedded Linux",
                "Haus-Gateway, Datenablage, Kamera-Bridge",
              ],
              [
                "eine Maschine mit definierten Echtzeit- und Lebenszyklusvorgaben steuert",
                "Industriesystem",
                "Feldbus-Knoten, Serienprodukt",
              ],
              [
                "Kamera- oder KI-Modelle ohne Cloud-Latenz auswertet",
                "Edge-KI-System",
                "Qualitätsprüfung, Objekterkennung",
              ],
            ],
          },
        },
        {
          heading: "Begriffe richtig einordnen",
          paragraphs: [
            "Einen Raspberry Pi Nano gibt es nicht als gängige Produktlinie. Für die kleine Mikrocontroller-Ebene passt der Raspberry Pi Pico; der Raspberry Pi Zero 2 W gehört wegen Linux bereits zur nächsten Ebene.",
            "STM32- und aktuelle Renesas-Familien sind typische Wege in professionelle und industrielle Produkte. Die Renesas-H8-Familie ist vor allem in bestehenden Anlagen anzutreffen; für ein neues Design wird normalerweise eine aktuelle, aktiv gepflegte Familie gewählt.",
          ],
        },
        {
          heading: "Was GerNetiX heute nutzt",
          paragraphs: [
            "GerNetiX konzentriert Basissoftware und geführte Inbetriebnahme auf kompatible ESP32-Boards. Sie sind die praktische Mitte: genug Rechenleistung und Konnektivität für vernetzte Geräte, aber weiterhin nah genug an Sensoren, Aktoren und energieeffizientem Betrieb.",
            "Ein gutes System verteilt Aufgaben: Der Mikrocontroller liest und schaltet zuverlässig. Ein Linux-Gateway bündelt Geräte, Bedienung und lokale Dienste. Eine GPU kommt nur dazu, wenn Bild- oder KI-Rechenlast sie rechtfertigt. Cloud-Dienste bleiben optional für Fernzugriff und Auswertung.",
          ],
        },
      ],
      relatedTopics: [
        "processor-overview",
        "supported-devices",
      ],
    },
    "processor-overview": {
      title: "ESP32-Prozessorfamilien im Vergleich",
      summary: "Die ESP32-Bezeichnung beschreibt zuerst den Chip. Ein Board ergaenzt ihn um Flash, USB, Spannungsversorgung, Antenne und oft Display, Sensoren oder weitere Anschluesse.",
      sections: [
        {
          heading: "Erst die Aufgabe, dann der Chip",
          paragraphs: [
            "Die Buchstaben sind keine Reihenfolge von gut nach schlecht. C steht vor allem fuer kompakte, vernetzte RISC-V-Controller, S fuer umfangreichere WLAN-Controller, H fuer 802.15.4 ohne WLAN und P fuer einen leistungsstarken Prozessor ohne eingebauten Funk. Entscheidend sind Funkweg, Energieversorgung, lokale Bedienung und die benoetigten Anschluesse.",
          ],
        },
        {
          heading: "Familienuebersicht",
          table: {
            headers: [
              "Familie",
              "Funk",
              "Fuer Hausautomation besonders passend",
              "Einordnung",
            ],
            rows: [
              [
                "ESP32 (klassisch)",
                "WLAN 2,4 GHz, Bluetooth Classic und BLE",
                "Bestehende Maker-Projekte, einfache WLAN-Nodes",
                "Sehr weit verbreitet; fuer neue Projekte nur waehlen, wenn ein konkretes Board oder Beispiel dafuer spricht.",
              ],
              [
                "ESP32-S2",
                "WLAN 2,4 GHz",
                "WLAN-Sensor, USB-Geraet, einfache lokale Webseite",
                "Kein Bluetooth und kein Zigbee/Thread.",
              ],
              [
                "ESP32-S3",
                "WLAN 2,4 GHz, BLE",
                "Touchdisplay, lokale Weboberflaeche, Audio, Kamera oder mehr lokale Logik",
                "Gute Wahl fuer sichtbare, interaktive Home Nodes; kein Zigbee/Thread.",
              ],
              [
                "ESP32-C2",
                "WLAN 2,4 GHz, BLE",
                "Sehr kleine, preiswerte WLAN-Sensoren oder Aktoren",
                "Weniger Reserven und Anschluesse; nicht fuer Display- oder umfangreiche Projekte.",
              ],
              [
                "ESP32-C3",
                "WLAN 2,4 GHz, BLE",
                "Einfacher WLAN-Home-Node, Sensor, Relais oder lokale Statusseite",
                "Solider Einstieg fuer WLAN. C3 hat kein Zigbee und kein Thread.",
              ],
              [
                "ESP32-C5",
                "Dual-Band WLAN 6 (2,4/5 GHz), BLE",
                "Anforderungsvolle WLAN-Umgebungen oder 5-GHz-WLAN",
                "Kein Zigbee/Thread. Fuer einen ersten Home-Node meist mehr als erforderlich.",
              ],
              [
                "ESP32-C6",
                "WLAN 6 (2,4 GHz), BLE, 802.15.4",
                "WLAN-Node mit spaeterem Zigbee- oder Thread-Pfad; versorgte Bridge oder Gateway",
                "Der flexible Funkchip: 802.15.4 ist die Grundlage fuer Zigbee und Thread. Funk-Koexistenz muss im Projekt bewusst geplant werden.",
              ],
              [
                "ESP32-C61",
                "WLAN 6 (2,4 GHz), BLE",
                "Moderne WLAN-Sensoren, Aktoren und energieoptimierte WLAN-Nodes",
                "Kein Zigbee/Thread; moderne Alternative im WLAN-Zweig.",
              ],
              [
                "ESP32-H2",
                "BLE, 802.15.4 Zigbee/Thread",
                "Batterie-Sensor oder Aktor als Zigbee-/Thread-Endgeraet",
                "Kein WLAN. Ein H2 kann keine lokale WLAN-Webseite anbieten und braucht fuer den Weg ins Netzwerk einen passenden Koordinator oder eine Bridge.",
              ],
              [
                "ESP32-P4",
                "kein eingebauter Funk",
                "Grosse lokale Bedienoberflaechen, Kamera, Multimedia oder leistungsfaehige Steuerung",
                "Funk kommt bei Bedarf von einem zusaetzlichen C-, S- oder H-Chip. Kein Einstiegschip fuer einen einzelnen WLAN-Sensor.",
              ],
            ],
          },
        },
        {
          heading: "Schnellauswahl fuer das Lernprojekt",
          table: {
            headers: [
              "Wenn du moechtest ...",
              "sinnvoller Start",
            ],
            rows: [
              [
                "Temperatur messen und die Werte im Browser des Heimnetzes sehen",
                "C3, S3 oder C6 als WLAN-Home-Node.",
              ],
              [
                "Ein Display, Touch oder eine umfangreiche lokale Ansicht",
                "S3; bei sehr anspruchsvoller Grafik oder Kamera spaeter P4 mit getrenntem Funkchip.",
              ],
              [
                "Einen moeglichst sparsamen Batterie-Sensor im Zigbee-Netz",
                "H2 als schlafendes Endgeraet plus vorhandener Zigbee-Koordinator.",
              ],
              [
                "Heute WLAN nutzen, Zigbee oder Thread aber als Lernpfad offenhalten",
                "C6. Erst den WLAN-Teil sauber bauen, dann den 802.15.4-Pfad gezielt ergaenzen.",
              ],
              [
                "Viele Zigbee-Geraete mit einer lokalen Oberflaeche verbinden",
                "Eine dauerhaft versorgte Bridge; bei anspruchsvolleren Varianten ein S3 plus H2 als getrennte Funk- und Bedienkomponenten.",
              ],
            ],
          },
        },
        {
          heading: "Akku und Funk realistisch beurteilen",
          paragraphs: [
            "Eine Chipfamilie allein bestimmt nicht die Batterielaufzeit. Entscheidend sind Messintervall, Schlafdauer, Sendezeit, Sensor und die Rolle im Funknetz. Ein batteriebetriebenes Zigbee-Geraet ist normalerweise ein schlafendes Endgeraet; ein Router oder Koordinator muss dagegen erreichbar bleiben und wird typischerweise dauerhaft versorgt. WLAN kann ebenfalls sparsam sein, wenn ein Node nur selten aufwacht und sendet, braucht aber fuer eine staendig erreichbare lokale Webseite deutlich mehr Energie.",
          ],
        },
        {
          heading: "Was die Tabelle nicht behauptet",
          paragraphs: [
            "Es gibt keine allgemeine ESP32-C-Familie und aktuell keine ESP32-S6-Familie. C5 und C61 gibt es, P4 ebenfalls. Die Tabelle ist eine Orientierung, keine Freigabeliste. Ob ein konkretes Board fuer GerNetiX flashbar und passend ist, pruefst du anschliessend in Unterstuetzte Boards anhand der exakten Boardvariante, ihres Flash-Speichers und der Anschluesse.",
          ],
        },
      ],
      actions: [
        {
          label: "Unterstuetzte Boards ansehen",
          route: "/hilfe/#supported-devices",
        },
      ],
      relatedTopics: [
        "supported-devices",
        "provision-new-board",
        "update-profiles",
      ],
      access: "premium",
    },
    "microcontroller-basics": {
      title: "Grundlagen Mikrocontroller",
      summary: "Ein Mikrocontroller verbindet Prozessor, Speicher und Hardware-Schnittstellen in einem Baustein. Diese Grundlagen helfen dir, Firmware und Schaltungen bewusst zusammenzubringen.",
      access: "premium",
      sections: [
        {
          id: "microcontroller-flashing",
          heading: "Wie Software in einen Mikrocontroller kommt – und warum das Flashen heißt",
          paragraphs: [
            "Ein Mikrocontroller startet nicht mit einem Betriebssystem, das ein Programm von einer Festplatte lädt. Seine Software heißt Firmware und liegt dauerhaft in einem speziellen, nichtflüchtigen Speicher: dem Flash-Speicher. Nichtflüchtig bedeutet: Auch ohne Strom bleibt sie erhalten. Beim Einschalten liest der Chip seine Startinformationen aus diesem Speicher und führt anschließend die dort abgelegten Maschinenbefehle aus.",
            "Umgangssprachlich heißt das Übertragen der Firmware deshalb Flashen. Der Name kommt vom Flash-Speicher selbst. Diese Speichertechnik konnte im Vergleich zu älteren, einzeln löschbaren EEPROMs größere Bereiche schnell – wie einen kurzen Lichtblitz, englisch flash – löschen. Heute ist Flashen einfach der gebräuchliche Begriff dafür, eine Firmware in diesen Speicher zu schreiben; es hat nichts mit einer blinkenden LED oder einem Webbrowser-Plugin zu tun.",
          ],
          list: [
            "Der Flash-Speicher enthält Firmware, Bootloader und oft Einstellungen oder Dateidaten dauerhaft.",
            "RAM ist nur Arbeitsspeicher für den laufenden Betrieb und wird beim Ausschalten gelöscht.",
            "Die Firmware muss zur Prozessorfamilie, zum Board und zur vorgesehenen Speicheraufteilung passen.",
          ],
        },
        {
          id: "microcontroller-flash-build",
          heading: "1. Aus Quelltext wird eine Firmware-Datei",
          paragraphs: [
            "Zuerst übersetzt der Compiler den Quelltext in Maschinenbefehle für genau diese Prozessorfamilie, etwa für einen ESP32-S3. Der Linker fügt den eigenen Code, Bibliotheken und die Startteile zusammen. Das Ergebnis ist nicht mehr der für Menschen geschriebene Quelltext, sondern eine oder mehrere Binärdateien.",
            "Bei vielen ESP32-Projekten gehören dazu ein Bootloader, eine Partitionstabelle und die eigentliche Anwendung. Die Partitionstabelle legt fest, an welchen Stellen des Flash-Speichers diese Teile liegen und ob zum Beispiel zwei Bereiche für OTA-Updates reserviert sind. Ein Build-Werkzeug erzeugt diese Dateien vor dem Übertragen und prüft dabei Größe, Adressen und Abhängigkeiten.",
          ],
        },
        {
          id: "microcontroller-flash-bootloader",
          heading: "2. Der Bootloader öffnet den Programmierweg",
          paragraphs: [
            "Ein Mikrocontroller besitzt einen kleinen Startcode im Chip oder im Flash-Speicher: den Bootloader. Er kann entscheiden, ob das Gerät die vorhandene Firmware normal startet oder auf neue Daten wartet. Beim ESP32 wird dafür häufig die USB- oder serielle Schnittstelle verwendet. Manche Boards brauchen dafür einen Reset und eine BOOT-Taste, andere können automatisch in den Download-Modus wechseln.",
            "Das Flash-Werkzeug auf dem Computer, die FlashBox oder ein anderer Programmer verbindet sich mit diesem Bootloader. Es ermittelt den Chip, liest wichtige Eigenschaften wie Flash-Größe und sendet die Firmware in einem festgelegten Protokoll. Der Bootloader schreibt die empfangenen Daten nicht in den RAM, sondern an die vorgesehenen Adressen im Flash-Speicher.",
          ],
        },
        {
          id: "microcontroller-flash-write",
          heading: "3. Löschen, schreiben und prüfen",
          paragraphs: [
            "Flash-Speicher kann nicht wie ein Notizblock einzelne Zeichen beliebig überschreiben. Er wird in größeren Bereichen, sogenannten Sektoren oder Blöcken, gelöscht und anschließend in kleineren Einheiten beschrieben. Deshalb löscht ein Flash-Werkzeug zuerst nur die benötigten Bereiche und schreibt dann Bootloader, Partitionstabelle und Anwendung an ihre festgelegten Adressen.",
            "Während des Vorgangs prüfen Werkzeug und Bootloader Prüfsummen. Sie helfen zu erkennen, ob Daten beim Übertragen beschädigt wurden oder an der falschen Stelle gelandet sind. Erst wenn das Schreiben und die Prüfung erfolgreich sind, wird das Gerät neu gestartet. Ein Fortschrittsbalken zeigt daher nicht nur das Senden der Datei, sondern auch Lösch- und Prüfschritte.",
          ],
          list: [
            "Stromversorgung und Datenverbindung bis zum Abschluss nicht trennen.",
            "Ein USB-Ladekabel ohne Datenleitungen kann keinen Flash-Vorgang übertragen.",
            "Bei einem Fehler erneut verbinden, den Boot-Modus prüfen und die passende Firmware verwenden – nicht wahllos andere Images schreiben.",
          ],
        },
        {
          id: "microcontroller-flash-start",
          heading: "4. Start nach dem Flashen",
          paragraphs: [
            "Nach dem Neustart liest der Bootloader die Partitionstabelle und startet die ausgewählte Anwendung. Die Firmware richtet anschließend Pins, Speicher, Netzwerk und ihre eigentliche Aufgabe ein. Bei einem OTA-fähigen Gerät kann sie später eine neue Anwendung in eine zweite, freie Partition laden und erst nach erfolgreicher Prüfung darauf umschalten.",
            "Die erste Basissoftware wird meist über USB oder eine FlashBox aufgespielt, weil ein neues Gerät noch nicht im WLAN ist. Spätere Projekt-Updates können, wenn die Basissoftware und das Netzwerk eingerichtet sind, per OTA kommen. Der technische Kern bleibt derselbe: Eine geprüfte Binärdatei wird in einen vorgesehenen Bereich des nichtflüchtigen Flash-Speichers geschrieben.",
          ],
        },
        {
          id: "microcontroller-memory",
          heading: "Speicherorganisation",
          paragraphs: [
            "Mikrocontroller verwenden unterschiedliche Speicherarten für unterschiedliche Aufgaben. Flash speichert Firmware dauerhaft. RAM enthält während des Betriebs Variablen, Zwischenergebnisse und den Programmstapel. Manche Systeme haben zusätzlich nichtflüchtigen Datenspeicher oder externen PSRAM.",
            "Wichtig ist die Unterscheidung: Viel Flash schafft Platz für Programm und Assets, viel RAM erlaubt größere Datenstrukturen und mehr parallele Aufgaben. Ein Neustart löscht normalen RAM, aber nicht die Firmware im Flash.",
          ],
        },
        {
          id: "microcontroller-registers",
          heading: "Register",
          paragraphs: [
            "Register sind sehr kleine Speicherplätze direkt im Prozessor oder in einem Hardware-Modul. Sie enthalten zum Beispiel einen Messwert, eine Konfiguration oder einen Status.",
            "Firmware schreibt gezielt in Konfigurationsregister und liest Statusregister aus. Bibliotheken nehmen dir viele Details ab, aber beim Debuggen hilft es zu wissen: Hinter GPIO, Timer oder ADC stehen immer Register mit klaren Bitfeldern und Datenblatt-Beschreibungen.",
          ],
        },
        {
          id: "microcontroller-gpio",
          heading: "GPIO",
          paragraphs: [
            "GPIO bedeutet General Purpose Input/Output: frei nutzbare Pins für digitale Ein- und Ausgänge. Als Eingang liest ein Pin etwa einen Tasterzustand. Als Ausgang schaltet er ein Signal für LED, Transistor oder ein anderes Logikmodul.",
            "Ein GPIO-Pin ist kein universeller Leistungsausgang. Strom, Spannung, Schutzbeschaltung und die zulässige Pin-Funktion müssen zum Datenblatt passen. Größere Lasten wie Motoren oder Relais werden über geeignete Treiberstufen geschaltet.",
          ],
        },
        {
          id: "microcontroller-adc",
          heading: "ADC",
          paragraphs: [
            "Ein Analog-Digital-Converter (ADC) wandelt eine analoge Spannung in einen digitalen Zahlenwert. Damit kann ein Mikrocontroller beispielsweise Potentiometer, Batteriespannung oder analoge Sensoren auswerten.",
            "Die Auflösung bestimmt, wie fein der Zahlenbereich ist; Messbereich, Referenzspannung, Störungen und Kalibrierung bestimmen, wie aussagekräftig der Messwert wirklich ist. Analoge Messung braucht deshalb oft Mittelwerte, Filter oder eine saubere elektrische Umgebung.",
          ],
        },
        {
          id: "microcontroller-timer",
          heading: "Timer",
          paragraphs: [
            "Timer sind Hardware-Zähler im Mikrocontroller. Sie zählen Takte unabhängig vom eigentlichen Programmablauf und können zu festen Zeitpunkten Ereignisse oder Interrupts auslösen.",
            "Sie eignen sich für regelmäßige Abtastungen, Zeitmessungen, präzise Schaltfolgen und als Grundlage für PWM. Ein Timer ist verlässlicher als eine lange Warteschleife, weil die Firmware währenddessen andere Aufgaben erledigen kann.",
          ],
        },
        {
          id: "microcontroller-pwm",
          heading: "PWM",
          paragraphs: [
            "Pulsweitenmodulation (PWM) schaltet ein digitales Signal schnell ein und aus. Das Verhältnis von Ein- zu Auszeit heißt Tastgrad und bestimmt die mittlere Wirkung.",
            "PWM kann LEDs dimmen, Motoren über passende Treiber ansteuern oder Steuersignale erzeugen. Sie ersetzt keine echte analoge Spannung in jeder Anwendung: Frequenz, Filter, Treiber und die angeschlossene Last müssen bewusst gewählt werden.",
          ],
        },
      ],
      relatedTopics: [
        "processor-overview",
        "embedded-measurement-debugging",
        "embedded-safety",
        "glossary-basics",
      ],
    },
    "bus-systems": {
      title: "Bussysteme",
      summary: "Ein Bussystem überträgt Daten zwischen elektronischen Teilnehmern. Die passende Wahl hängt vor allem davon ab, ob Chips auf einer Platine oder Geräte über längere Strecken verbunden werden.",
      access: "premium",
      sections: [
        {
          id: "chip-to-chip-buses",
          heading: "Chip-zu-Chip-Schnittstellen",
          paragraphs: [
            "Chip-zu-Chip-Schnittstellen verbinden Bausteine auf derselben Platine oder über sehr kurze Leitungen: Mikrocontroller, Sensoren, Speicher, Displays oder Wandler. Typische Beispiele sind I²C, SPI und UART.",
            "I²C benötigt meist nur zwei Signalleitungen und erlaubt mehrere adressierbare Teilnehmer; es ist praktisch für viele Sensoren und Konfigurationsbausteine. SPI verwendet getrennte Daten- und Taktleitungen sowie meist eine Auswahlleitung pro Ziel; es ist oft schneller und passt zu Displays, Speichern oder schnellen Wandlern. UART ist eine einfache serielle Punkt-zu-Punkt-Verbindung, häufig für Debug-Ausgaben, Module oder eine direkte Gerätekommunikation.",
            "Diese Schnittstellen sind nicht für beliebig lange Kabel oder raue Umgebungen gedacht. Leitungslänge, Taktfrequenz, Pull-up-Widerstände, Massebezug, Pegel und die Anzahl der Teilnehmer begrenzen, was zuverlässig funktioniert.",
          ],
        },
        {
          id: "field-and-system-buses",
          heading: "Feld- und Systembusse",
          paragraphs: [
            "Die zweite wichtige Kategorie sind Feld- und Systembusse. Sie verbinden eigenständige Geräte, Steuergeräte oder Maschinen über längere Leitungen und sind auf störungsärmere Übertragung, mehrere Teilnehmer und definierte Protokolle ausgelegt.",
            "CAN und LIN sind typische Fahrzeug- und Steuergerätebusse. RS-485 ist eine robuste elektrische Grundlage für serielle Feldkommunikation und wird oft mit Protokollen wie Modbus kombiniert. Ethernet verbindet Geräte mit hoher Datenrate in lokalen Netzwerken und industriellen Varianten. Je nach Anwendung kommen weitere Feldbusse und industrielle Ethernet-Protokolle hinzu.",
            "Ein Bus besteht nie nur aus zwei Datenpins: Topologie, Abschlusswiderstände, Leitungstyp, Teilnehmerzahl, Bitrate, galvanische Trennung, Fehlerbehandlung und das konkrete Protokoll gehören zusammen. Besonders in Fahrzeugen oder Maschinen dürfen unbekannte Bussysteme nicht durch Bastelanschlüsse verändert oder unterbrochen werden; auch vermeintlich harmlose Informationen können Teil sicherheitskritischer Abläufe sein.",
          ],
        },
      ],
      relatedTopics: [
        "sensors",
        "actuators",
        "embedded-measurement-debugging",
        "embedded-safety",
      ],
    },
    "embedded-measurement-debugging": {
      title: "Embedded-Systeme: Messtechnik und Debugging",
      summary: "Embedded-Entwicklung verbindet Software mit Elektrotechnik. Verständnis für Schaltungen, sorgfältiges Aufbauen und passende Messmittel sind genauso wichtig wie der Programmcode.",
      access: "premium",
      sections: [
        {
          heading: "Embedded heißt: Software trifft Elektronik",
          paragraphs: [
            "Ein Embedded-System steuert reale elektrische Signale. Deshalb gehören neben dem Programmieren Grundlagen wie Spannung, Strom, Widerstand, Massebezug, Pegel und sichere Spannungsversorgung dazu. Praktische Fähigkeiten – sauber verdrahten, löten, Datenblätter lesen und Messwerte einordnen – entscheiden oft schneller über Erfolg als noch mehr Code.",
            "Das ist kein Grund, sich abschrecken zu lassen: Starte mit ungefährlichen Kleinspannungen und einfachen Schaltungen. Baue Schritt für Schritt, ändere immer nur eine Sache und prüfe sie anschließend. Arbeiten an Netzspannung oder leistungsstarken Akkus gehören nur in erfahrene Hände und mit passender Schutztechnik.",
          ],
        },
        {
          heading: "Messtechnik: erst messen, dann raten",
          paragraphs: [
            "Messtechnik macht unsichtbare elektrische Zustände sichtbar. Die Werkzeuge ergänzen sich: Ein Multimeter prüft einzelne Werte, ein Oszilloskop zeigt deren Verlauf über die Zeit und ein Logikanalysator erklärt digitale Kommunikation.",
          ],
          table: {
            headers: [
              "Kapitel",
              "Werkzeug",
              "Wofür es da ist",
              "Erste typische Fragen",
            ],
            rows: [
              [
                "1. Multimeter",
                "Multimeter",
                "Misst Gleichspannung, Strom, Widerstand und oft Durchgang. Es ist das wichtigste erste Messgerät.",
                "Liegt wirklich 3,3 V oder 5 V an? Ist ein Kabel unterbrochen? Verursacht ein Bauteil einen Kurzschluss?",
              ],
              [
                "2. Oszilloskop",
                "Oszilloskop",
                "Zeigt Spannung als Kurve über die Zeit. Damit werden Impulse, Störungen, Takt und Signalform sichtbar.",
                "Kommt der PWM-Impuls wirklich an? Bricht die Versorgung beim Schalten ein? Gibt es Störungen auf einem Signal?",
              ],
              [
                "3. Logikanalysator",
                "Logikanalysator",
                "Zeichnet digitale Pegel und Protokolle wie I²C, SPI oder UART auf. Er ist besonders hilfreich bei der Kommunikation zwischen Bauteilen.",
                "Sendet der Sensor eine Antwort? Stimmen Adresse und Daten? Sind Takt, Datenleitung und Timing plausibel?",
              ],
            ],
          },
        },
        {
          heading: "1. Multimeter",
          list: [
            "Vor dem Einschalten: Widerstand oder Durchgang prüfen, um vertauschte Verbindungen und mögliche Kurzschlüsse zu finden. Dabei muss die Schaltung spannungsfrei sein.",
            "Nach dem Einschalten: Spannung immer zwischen dem Messpunkt und dem passenden Massebezug (GND) messen. Bei ESP32-Schaltungen sind 3,3 V ein häufiger Referenzwert.",
            "Strom misst man in Reihe zur Last. Das ist ein anderer Anschluss und Messbereich als bei Spannungsmessung – bei Unsicherheit zuerst die Anleitung des Multimeters lesen.",
            "Ein Messwert ist ein Hinweis, keine automatische Diagnose: Vergleiche ihn mit Schaltplan, Datenblatt und erwarteter Versorgung.",
          ],
        },
        {
          heading: "2. Oszilloskop",
          list: [
            "Ein Oszilloskop hilft, wenn ein Multimeter zwar einen Mittelwert zeigt, das System aber trotzdem unzuverlässig arbeitet. Kurze Spannungseinbrüche oder Impulse bleiben im Multimeter oft unsichtbar.",
            "Die Masseklemme der Tastspitze verbindet sich elektrisch mit der Masse des Messgeräts. Prüfe deshalb den Massebezug, bevor du sie anschließt; bei netzbetriebenen Geräten gelten zusätzliche Sicherheitsregeln.",
            "Für erste Projekte reichen Fragen wie: Welche Spannung liegt an? Wie lang ist der Impuls? Wiederholt er sich? Bricht die Versorgung beim Schalten ein?",
          ],
        },
        {
          heading: "3. Logikanalysator",
          list: [
            "Ein Logikanalysator liest digitale Zustände als 0 und 1. Er ersetzt kein Oszilloskop für analoge Signalqualität, ist aber oft leichter für Bus-Protokolle auszuwerten.",
            "Verbinde immer auch eine gemeinsame Masse. Prüfe vorab, ob die Eingänge zum Pegel passen – bei ESP32 in der Regel 3,3 V, nicht 5 V.",
            "Mit Protokoll-Decodern werden Folgen aus Bits zu lesbaren I²C-, SPI- oder UART-Nachrichten. Das grenzt Fehler in Verdrahtung, Adresse, Timing oder Firmware schnell ein.",
          ],
        },
        {
          heading: "Debugwerkzeuge: moderne Hilfe statt unnötiger Hürden",
          paragraphs: [
            "Debugging ist die systematische Suche nach der Ursache eines Fehlers. Früher bedeutete das oft teure Zusatzhardware und schwer zugängliche Debug-Schnittstellen. Bei vielen heutigen Entwicklungsboards sind USB-Serielle Ausgabe, Bootloader und Debug-Schnittstellen wie JTAG bereits auf dem Board integriert oder einfach erreichbar.",
            "JTAG ist eine standardisierte Schnittstelle, mit der ein Debugger den Prozessor anhalten, Variablen ansehen und Schritt für Schritt durch Code gehen kann. Nicht jedes Projekt braucht das sofort: Serielle Logs, klare Fehlermeldungen, Messgeräte und kleine reproduzierbare Tests lösen viele Probleme schneller.",
            "Auch KI kann heute Logausgaben, Compilerfehler, Protokollmitschnitte und einfache Schaltbilder gut strukturieren und mögliche Ursachen priorisieren. Sie ersetzt aber keine Messung: Prüfe Vorschläge immer gegen Datenblatt, Sicherheitsregeln und reale Messwerte. So nimmt KI Komplexität heraus, ohne Verantwortung vorzutäuschen.",
          ],
        },
        {
          heading: "Ein ruhiger Debug-Ablauf",
          list: [
            "Problem klein machen: Eine LED, ein Sensor oder eine Verbindung isoliert testen.",
            "Versorgung und Masse zuerst mit dem Multimeter prüfen.",
            "Serielle Logs und eindeutige Fehlermeldungen erfassen.",
            "Bei digitalen Schnittstellen einen Logikanalysator, bei Signalform oder Einbrüchen ein Oszilloskop einsetzen.",
            "Ergebnisse mit Datenblatt und Schaltplan vergleichen; erst danach Firmware oder Verdrahtung gezielt ändern.",
            "KI für die Einordnung nutzen: Messwerte, Logs und Fragestellung gemeinsam beschreiben – aber Änderungen bewusst und einzeln übernehmen.",
          ],
        },
      ],
      relatedTopics: [
        "hardware-landscape",
        "processor-overview",
        "server-systems",
        "supported-devices",
      ],
    },
};
