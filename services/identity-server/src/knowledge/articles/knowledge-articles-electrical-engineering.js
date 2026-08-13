// Wissensspeicher: Elektrotechnische Grundlagen und Sicherheit.
const KnowledgeArticlesElectricalEngineering = { // Server-side authored content.
    "electrical-basics-and-component-protection": {
      title: "Elektrische Grundbegriffe und Bauteilschutz",
      summary: "Spannung, Strom, Leistung, Energie und Arbeit verständlich unterscheiden – und verstehen, warum Bauteile durch zu viel Spannung, Strom oder Temperatur kaputtgehen.",
      access: "public",
      sections: [
        {
          id: "electrical-basics-voltage-current",
          heading: "Spannung und Strom: Antrieb und Bewegung",
          paragraphs: [
            "Spannung U beschreibt einen elektrischen Unterschied zwischen zwei Punkten. Sie ist der Antrieb dafür, dass sich elektrische Ladung bewegen kann; gemessen wird sie in Volt (V). Eine Batterie mit 5 V stellt zwischen Plus und Minus diesen Unterschied bereit.",
            "Strom I ist die tatsächlich fließende Ladungsmenge pro Zeit. Er wird in Ampere (A) gemessen. Ob und wie viel Strom fließt, hängt nicht nur von der Spannung ab, sondern auch vom angeschlossenen Stromkreis: Ein offener Schalter lässt praktisch keinen Strom fließen, ein passender Widerstand begrenzt ihn.",
          ],
          table: {
            headers: ["Größe", "Frage", "Einheit", "Einfaches Bild"],
            rows: [
              ["Spannung U", "Wie stark treibt der Unterschied?", "Volt (V)", "Druckunterschied"],
              ["Strom I", "Wie viel fließt gerade?", "Ampere (A)", "Menge pro Sekunde"],
            ],
          },
        },
        {
          id: "electrical-basics-power-energy-work",
          heading: "Leistung, Energie und Arbeit: Wie schnell und wie lange?",
          paragraphs: [
            "Leistung P beschreibt, wie schnell elektrische Energie gerade umgesetzt wird. Sie wird in Watt (W) gemessen. In einem Gleichstromkreis gilt näherungsweise P = U × I: 12 V und 2 A bedeuten 24 W. Leistung ist deshalb kein Vorrat, sondern eine momentane Rate.",
            "Energie E ist der Vorrat beziehungsweise die über eine Zeit umgesetzte Menge. Sie wird oft in Wattstunden (Wh) oder Joule (J) angegeben. Elektrische Arbeit ist die übertragene oder umgesetzte Energie: Läuft eine 24-W-Lampe eine Stunde, setzt sie 24 Wh Energie um. Darum gilt E = P × t.",
          ],
          list: [
            "Ein Netzteil wird häufig nach Spannung und maximalem Strom ausgewählt; daraus ergibt sich seine mögliche Leistung.",
            "Ein Akku wird nach Energie bewertet: Seine Wattstunden sagen mehr über die Laufzeit aus als nur die Zahl auf dem Spannungsaufdruck.",
            "Für ein Bauteil ist die Verlustleistung wichtig: Sie wird überwiegend zu Wärme.",
          ],
        },
        {
          id: "electrical-basics-overload-heat",
          heading: "Warum hoher Strom meist Hitze erzeugt",
          paragraphs: [
            "Leitungen, Widerstände, Transistoren und Kontakte besitzen immer einen elektrischen Widerstand. Fließt Strom durch ihn, entsteht Verlustleistung und damit Wärme. Bei einem Widerstand gilt P = I² × R: Verdoppelt sich der Strom, vervierfacht sich diese Erwärmung. Deshalb kann eine scheinbar kleine Überlast sehr schnell kritisch werden.",
            "Ein Bauteil kann durch seinen eigenen Strom heiß werden, aber auch durch eine warme Umgebung oder schlechte Kühlung. Wird die zulässige Sperrschicht-, Gehäuse- oder Löttemperatur überschritten, altert es schneller, arbeitet unzuverlässig oder wird dauerhaft zerstört. Ein Datenblattwert für Strom ist daher immer zusammen mit Kühlung, Einschaltdauer und Temperatur zu lesen.",
          ],
        },
        {
          id: "electrical-basics-voltage-damage",
          heading: "Zu hohe Spannung: Durchbruch statt normaler Funktion",
          paragraphs: [
            "Auch zu hohe Spannung kann ein Bauteil zerstören. Sie kann Isolationsschichten, Transistorstrukturen oder Eingänge überlasten. Ab einer Grenze kommt es zum Durchbruch: Der Strom steigt dann stark an, obwohl der Stromkreis ihn nicht sinnvoll nutzen kann. Oft folgt daraus wiederum Hitze und ein bleibender Schaden.",
            "Spannung erzeugt also nicht automatisch Wärme. Gefährlich wird sie, wenn sie einen unzulässigen Strom, einen Durchbruch oder eine zu hohe Verlustleistung verursacht. Deshalb schützen Spannungsteiler, Zener- oder TVS-Dioden, passende Pegelwandler und ausreichend spannungsfeste Bauteile den Eingang – sie müssen zur Anwendung berechnet sein.",
          ],
        },
        {
          id: "electrical-basics-short-cross-fault",
          heading: "Kurzschluss und Querschluss sind nicht dasselbe",
          paragraphs: [
            "Ein Kurzschluss ist eine Verbindung mit sehr kleinem Widerstand zwischen Punkten mit unterschiedlicher Spannung, zum Beispiel direkt zwischen Plus und Minus einer Versorgung. Die Last wird dabei umgangen; der Strom kann sehr groß werden. Leitungen, Akku oder Netzteil werden dann gefährlich heiß, wenn keine Sicherung oder Strombegrenzung eingreift.",
            "Ein Querschluss ist allgemeiner: Zwei Leitungen oder Kontakte berühren sich ungewollt, obwohl sie getrennt sein sollten. Ein Tropfen Wasser, eine Lötbrücke oder ein gequetschtes Kabel kann einen Querschluss verursachen. Berührt ein Signalkabel die Versorgung, entstehen vielleicht falsche Messwerte oder ein beschädigter Eingang; berühren sich Plus und Minus, ist dieser Querschluss zugleich ein Kurzschluss.",
          ],
        },
        {
          id: "electrical-basics-protection",
          heading: "Bauteile schützen: Belastung begrenzen und Fehler beherrschen",
          paragraphs: [
            "Bauteilschutz beginnt mit der Frage: Welche Spannung, welcher Strom, welche Temperatur und welche Verlustleistung sind im schlechtesten vorhersehbaren Fall möglich? Danach werden Datenblattgrenzen nicht ausgereizt, sondern mit Reserve geplant. Die Recommended Operating Conditions sind der Arbeitsbereich; Absolute Maximum Ratings sind keine Zielwerte, sondern Schadensgrenzen.",
          ],
          list: [
            "Sicherung, rückstellbare PTC-Sicherung oder elektronische Sicherung begrenzen Folgen eines Kurzschlusses.",
            "Widerstand, Konstantstromquelle oder ein geeigneter Treiber begrenzen Strom, etwa bei LEDs, Motoren und GPIO-Ausgängen.",
            "Passende Leiterquerschnitte, Steckverbinder und Kühlung verhindern, dass Strompfade selbst zur heißen Schwachstelle werden.",
            "TVS-Dioden, Sicherungen und ausreichend spannungsfeste Bauteile helfen gegen Überspannung; sie ersetzen keine korrekte Spannungsversorgung.",
            "Ein Mikrocontroller-Pin steuert größere Lasten über Transistor, MOSFET oder Treiber-IC statt sie direkt zu versorgen.",
          ],
        },
      ],
      relatedTopics: ["physical-limits", "embedded-safety", "actuators", "microcontroller-gpio"],
    },
    "digital-signals-data-and-protocols": {
      title: "Digitale Signale, Daten und Protokolle",
      summary: "Wie Bits über Kabel und Funk übertragen werden, wie daraus Nachrichten entstehen – und warum Mobilfunk mit QAM mehrere Bits pro Funksymbol senden kann.",
      sections: [
        {
          id: "protocols-digital-signals",
          heading: "Binäre Übertragung: 0 und 1 auf einer Leitung",
          paragraphs: [
            "Das Kapitel Sensoren zeigt, wie ein kontinuierliches Messsignal durch Abtastung und Quantisierung zu einer Zahlenfolge wird. Die binäre Übertragung ist davon ein besonders einfacher Spezialfall: Statt vieler Zahlenstufen werden nur zwei zuverlässige Zustände unterschieden.",
            "Ein Computer verarbeitet digitale Daten als Bits: 0 oder 1. Damit ein Bit über eine Leitung wandern kann, muss der Sender es physisch darstellen. Bei einer einfachen 3,3-V-Digitalverbindung kann zum Beispiel vereinbart sein: Alles unter 0,5 V steht für logisch 0, alles über 3 V für logisch 1. Der Empfänger erkennt an der Spannung, welches Bit gesendet wurde.",
            "Dazwischen liegt ein unsicherer Bereich, in dem die Schaltung keinen eindeutigen Wert verspricht. Ein Pegel ist dabei der Spannungsbereich, der für einen logischen Zustand – 0 oder 1 – vereinbart ist. Bei einer standardisierten Schnittstelle legt die Protokoll- oder Schnittstellenspezifikation fest, welche Pegel und welches Zeitverhalten Sender und Empfänger einhalten müssen. Ein protokollkonformer Chip ist dafür ausgelegt; sein Datenblatt nennt die konkreten garantierten Grenzwerte und Betriebsbedingungen. Dieselbe Grundidee funktioniert auch mit Licht in einer Glasfaser oder mit einer veränderten Funkwelle: Ein physisches Signal trägt eine vereinbarte Folge von Bits.",
            "Der Übergang von einem Pegel zum anderen heißt Flanke: Eine steigende Flanke führt von 0 zu 1, eine fallende von 1 zu 0. Manche Eingänge reagieren gezielt auf eine solche Flanke, zum Beispiel mit einem Interrupt. Bei einer Datenübertragung wird der Pegel dagegen meist zu festgelegten Zeitpunkten abgetastet. SPI und I²C übertragen dafür ein Taktsignal; UART leitet die Abtastzeit aus der Startflanke und der vereinbarten Baudrate ab. Die Flanke zeigt also den Wechsel an, während der Abtastzeitpunkt entscheidet, welcher Bitwert gelesen wird.",
            "Die Vereinbarung gilt selbstverständlich nur innerhalb der zulässigen Betriebsgrenzen. 10.000 V wären nach der einfachen Regel zwar größer als 3 V und damit auf dem Papier eine 1 – in Wirklichkeit wäre das kein besonders starkes Digitalsignal, sondern sehr wahrscheinlich der Zustand „Eingang kaputt“. Ein 5-V-Signal an einem nicht 5-V-toleranten 3,3-V-Eingang kann bereits denselben Fehler verursachen.",
          ],
          illustration: {
            src: "/assets/digital-signal-voltage-thresholds.svg",
            alt: "Zeitdiagramm eines digitalen Spannungssignals mit mehreren Sprüngen zwischen logisch 0 und logisch 1 sowie gestrichelten Grenzen bei 0,5 und 3,0 Volt",
            caption: "Beispielhafte 3,3-V-Übertragung: Nur Spannungen bis 0,5 V beziehungsweise ab 3,0 V sind hier eindeutig. Der Bereich dazwischen ist nicht definiert.",
          },
        },
        {
          id: "protocols-manchester-coding",
          heading: "Manchester-Codierung: Takt im Signal",
          expertKnowledge: "Für GerNetiX normalerweise nicht selbst umzusetzen: Funkchip und Übertragungsstandard übernehmen Leitungscodierung und Taktrückgewinnung. Das Prinzip erklärt, wie ein Empfänger ohne separate Taktleitung im richtigen Rhythmus bleibt.",
          paragraphs: [
            "Bei der Manchester-Codierung besitzt jedes Bit in der Mitte seiner Bitzeit einen definierten Flankenwechsel. Die Richtung dieses Wechsels steht – abhängig von der vereinbarten Variante – für 0 oder 1. Weil in jeder Bitzeit sicher eine Flanke vorkommt, kann der Empfänger daraus den Takt zurückgewinnen. Zusätzliche Flanken an der Grenze zwischen zwei Bits sind möglich.",
            "Der Vorteil ist ein selbsttaktendes Signal ohne separate Taktleitung. Der Nachteil ist, dass für dieselbe Nutzdatenrate mehr Signalwechsel und damit mehr Bandbreite benötigt werden. Das kann für einfache physische Übertragungen nützlich sein, ist aber nicht automatisch die beste Funkcodierung.",
            "GerNetiX nutzt WLAN, Bluetooth, Zigbee, LoRa und NFC über dafür vorgesehene Funkchips und Protokollstacks. Deren physische Übertragung kümmert sich bereits um Codierung, Synchronisation und Fehlererkennung. Eine eigene Manchester-Codierung wäre erst bei einer selbst entwickelten Rohdaten-Funkstrecke oder in einem gezielten Lernversuch erforderlich.",
          ],
        },
        {
          id: "protocols-qam-outlook",
          heading: "QAM: mehrere Bits pro Funksymbol",
          expertKnowledge: "Für GerNetiX nicht auf Anwendungsebene umzusetzen: Modem, Funkchip und Mobilfunknetz wählen Modulation und robuste Übertragungsparameter. Das Wissen erklärt, warum Datenrate und Störfestigkeit voneinander abhängen.",
          paragraphs: [
            "Die bisherige Erklärung nutzt einen einfachen Fall: Pro Übertragungstakt wird eine 0 oder eine 1 übertragen. Funk kann auch mehrere unterscheidbare Signalzustände verwenden. Bei der Quadraturamplitudenmodulation, kurz QAM, steht ein Funksymbol dann für mehrere Bits – bei 16-QAM zum Beispiel für vier Bits zugleich.",
            "LTE/4G und 5G NR nutzen solche Verfahren bei guter Funkverbindung, um mehr Daten zu übertragen. Liegen die Zustände zu dicht beieinander, werden sie bei Rauschen oder schwachem Empfang leichter verwechselt; das Netz wählt dann automatisch eine robustere Übertragung. Für die meisten Anwenderinnen und Anwender ist das nur ein interessanter Hintergrundfakt: Die Funktechnik wählt die passende Signalform und schützt Daten gegen Übertragungsfehler. QAM ist kein Anwendungsprotokoll wie MQTT oder HTTP, sondern Teil der physischen Funkübertragung.",
          ],
        },
        {
          id: "protocols-bits-to-data",
          heading: "Von Bits zu Daten",
          paragraphs: [
            "Ein Bit kann nur zwei Zustände darstellen. Acht Bits werden oft als Byte zusammengefasst. Erst eine gemeinsame Bedeutung macht daraus eine Zahl, einen Buchstaben, eine Temperatur oder einen Befehl. Dieselbe Bitfolge kann ohne diese Vereinbarung völlig unterschiedlich interpretiert werden.",
            "Beispiel: Ein Sensor sendet die Bytes 0x00 und 0xFA. Das kann die Zahl 250 bedeuten, 25,0 °C mit einer fest vereinbarten Skalierung oder Teil eines längeren Textes. Sender und Empfänger müssen deshalb nicht nur dieselben Bits übertragen, sondern auch Datenformat, Einheit und Reihenfolge kennen.",
          ],
        },
        {
          id: "protocols-what-is-a-protocol",
          heading: "Was ein Protokoll vereinbart",
          paragraphs: [
            "Ein Protokoll ist eine genaue Absprache für Kommunikation. Es legt fest, wer wann senden darf, wie eine Nachricht beginnt und endet, wie ein Empfänger erkannt wird, was der Inhalt bedeutet und wie Fehler behandelt werden. Ohne Protokoll wären zwar elektrische Impulse vorhanden, aber keine verlässliche Nachricht.",
          ],
          table: {
            headers: ["Baustein", "Beispiel", "Warum er nötig ist"],
            rows: [
              ["Adresse oder Ziel", "I²C-Adresse, IP-Adresse, MQTT-Topic", "Die Nachricht erreicht den vorgesehenen Empfänger."],
              ["Rahmen", "Start, Länge, Nutzdaten, Ende", "Der Empfänger weiß, welche Bits zu einer Nachricht gehören."],
              ["Bedeutung", "Temperatur in Zehntelgrad, JSON-Feld, Öffnungsbefehl", "Die Daten werden richtig interpretiert."],
              ["Fehlerbehandlung", "Prüfsumme, Quittung, Wiederholung", "Übertragungsfehler bleiben erkennbar oder korrigierbar."],
            ],
          },
        },
        {
          id: "protocols-four-layers",
          heading: "Eine einfache Schichtenlandkarte",
          paragraphs: [
            "Damit verschiedene Aufgaben nicht durcheinandergeraten, werden Protokolle in Schichten betrachtet. Das ist eine vereinfachte Landkarte des TCP/IP- und OSI-Gedankens, kein Modell zum Auswendiglernen. Sie hilft vor allem beim Verstehen und bei der Fehlersuche.",
          ],
          table: {
            headers: ["Schicht", "Frage", "Typische Beispiele"],
            rows: [
              ["Physische Übertragung", "Wie kommt ein Signal überhaupt von A nach B?", "Spannung auf Leitung, Ethernet-Kabel, WLAN-Funk"],
              ["Lokale Verbindung", "Wie sprechen direkt verbundene Geräte?", "UART, I²C, SPI, Ethernet, WLAN"],
              ["Weg durchs Netzwerk", "Wie findet eine Nachricht das Ziel und kommt zuverlässig an?", "IP, TCP, UDP"],
              ["Anwendungssprache", "Was soll die Nachricht fachlich bedeuten?", "HTTP/REST, MQTT, DNS, TLS-geschützte Verbindung"],
            ],
          },
        },
        {
          id: "protocols-where-to-learn-more",
          heading: "Vertiefung dort, wo sie gebraucht wird",
          paragraphs: [
            "Dieses Kapitel liefert die gemeinsame Grundlage. Ein ESP32-Projekt vertieft danach UART, I²C oder SPI bei Bussystemen: Dort zählen Takt, Leitungen, Pull-up-Widerstände und konkrete Bausteine. In verteilten Systemen werden IP, TCP und HTTP/REST erklärt. MQTT gehört zur IoT-Kommunikation: Topics, Publisher, Subscriber und Zustellqualität sind seine eigene Anwendungssprache. TLS und Zertifikate gehören zusätzlich zur Security, weil sie Verbindungen schützen und Gegenstellen überprüfbar machen.",
            "Ein Backend arbeitet normalerweise nicht mehr direkt mit 3,3-V-Pegeln; Betriebssystem und Netzwerkkarte übernehmen die physische Übertragung. Trotzdem verarbeitet es weiter Protokolle: HTTP-Anfragen, JSON, Datenbankverbindungen, MQTT-Nachrichten oder TLS. Die gemeinsame Idee bleibt daher vom Pin bis zum Server dieselbe.",
          ],
        },
      ],
      relatedTopics: ["bus-systems", "communication-basics", "security-basics", "microcontroller-basics"],
    },
    "physical-limits": {
      title: "Grenzen der Physik",
      summary: "Datenblattwerte sind keine Wunschliste. Strom, Spannung, Temperatur und Geschwindigkeit haben Grenzen, die für jedes einzelne Bauteil und für das gesamte System gelten.",
      access: "premium",
      sections: [
        {
          id: "physical-limits-ratings",
          heading: "Absolute Maximum Ratings – absolute Grenzwerte",
          paragraphs: [
            "Absolute Maximum Ratings, auf Deutsch absolute Grenzwerte, beschreiben Belastungen, die ein Bauteil keinesfalls überschreiten darf: etwa Spannung an einem Pin, Strom, Temperatur oder maximale Verlustleistung. Sie sind eine Schadensgrenze, kein normaler Arbeitspunkt.",
            "Für die Auslegung werden die empfohlenen Betriebsbedingungen (Recommended Operating Conditions) verwendet. Dort ist beschrieben, in welchem Bereich Funktionen, Pegel und Genauigkeit zugesichert sind. Wer dauerhaft direkt am absoluten Grenzwert arbeitet, plant keinen Sicherheitsabstand ein und riskiert vorzeitige Alterung, Fehlverhalten oder sofortigen Schaden.",
          ],
        },
        {
          id: "physical-limits-current",
          heading: "Strom pro Pin und Gesamtstrom",
          paragraphs: [
            "Ein GPIO-Pin darf nur einen begrenzten Strom liefern oder aufnehmen. Dieser Strom pro Pin ist nicht mit dem Gesamtstrom aller Pins gleichzusetzen. Viele gleichzeitig betriebene LEDs, Sensoren oder Logikeingänge können zusammen eine zweite, oft strengere Grenze des Mikrocontrollers oder seiner Versorgung erreichen.",
            "Das Datenblatt nennt je nach Baustein Grenzen für einzelne Pins, Pin-Gruppen, Versorgungspins und die gesamte Verlustleistung. Plane mit Reserve und benutze für größere Lasten geeignete Treiber: Transistoren, MOSFETs, Treiber-ICs oder Relaismodule mit eigener, passend abgesicherter Versorgung. Ein Mikrocontroller-Pin steuert dann den Treiber, nicht die Last direkt.",
            "Auch ein Ausgang, der nur kurzzeitig überlastet wird, kann sich stark erwärmen oder intern beschädigt werden. Widerstände für LEDs, Strombegrenzung und eine gemeinsame, korrekt geführte Masse sind keine optionalen Details.",
          ],
        },
        {
          id: "physical-limits-frequency",
          heading: "Maximale Frequenz und Prozessortakt",
          paragraphs: [
            "Die Prozessortaktrate sagt, wie schnell der Kern Befehle ausführen kann. Sie ist nicht automatisch die höchste brauchbare Frequenz an einem GPIO-Pin, auf einer Leitung oder bei einem angeschlossenen Bauteil.",
            "Eine Signalkette hat eigene Grenzen: GPIO-Schaltzeit, Timer-Auflösung, Bus- und Peripherietakt, Leitungslänge, Flankensteilheit, Lastkapazität, Störungen und die Anforderungen des Empfängers. Deshalb kann ein Prozessor mit hoher Taktrate ein externes Signal nur deutlich langsamer zuverlässig erzeugen, messen oder übertragen.",
            "Prüfe für jede Schnittstelle den passenden Datenblattwert und messe bei kritischen Signalen. Ein Oszilloskop oder Logikanalysator zeigt, ob Frequenz, Tastgrad, Pegel und Flanken am tatsächlichen Ziel noch korrekt ankommen. Für schnelle oder leistungsstarke Anwendungen sind spezialisierte Treiber, kürzere Leitungen, saubere Versorgung und ein passendes Übertragungsverfahren oft wichtiger als ein höherer Prozessortakt.",
          ],
        },
      ],
      relatedTopics: [
        "microcontroller-basics",
        "embedded-measurement-debugging",
        "embedded-safety",
      ],
    },
    "sampling-rate": {
      title: "Abtastrate und Shannon-Theorem",
      summary: "Ein Mikrocontroller sieht ein analoges Signal nicht kontinuierlich, sondern als Folge einzelner Messwerte. Die Abtastrate entscheidet, welche Veränderungen zuverlässig erkennbar sind.",
      access: "premium",
      sections: [
        {
          id: "sampling-rate-shannon",
          heading: "Nyquist-Shannon-Abtasttheorem",
          paragraphs: [
            "Das Nyquist-Shannon-Abtasttheorem beschreibt die Grundgrenze: Ein Signal mit einer höchsten relevanten Frequenz f lässt sich nur dann aus seinen Messwerten rekonstruieren, wenn die Abtastrate größer als das Doppelte dieser Frequenz ist. Die Nyquist-Frequenz ist die halbe Abtastrate.",
            "Beispiel: Sollen Signalanteile bis 100 Hz erfasst werden, muss mindestens mit mehr als 200 Messungen pro Sekunde abgetastet werden. Das ist eine theoretische Mindestgrenze unter idealen Bedingungen, nicht automatisch eine gute praktische Wahl.",
          ],
        },
        {
          id: "sampling-rate-aliasing",
          heading: "Aliasing – wenn hohe Frequenzen täuschen",
          paragraphs: [
            "Liegt ein Signalanteil oberhalb der Nyquist-Frequenz, kann er in den Messwerten als falsche, niedrigere Frequenz erscheinen. Dieses Phänomen heißt Aliasing. Die nachträgliche Software kann dann nicht mehr sicher erkennen, welche hohe Frequenz tatsächlich vorhanden war.",
            "Ein bekanntes Bild ist ein Rad im Film, das scheinbar langsam rückwärts dreht: Die Bildrate tastet seine Bewegung zu selten ab. Bei Sensoren kann dieselbe Täuschung Vibrationen, Störungen oder schnelle Wechsel falsch darstellen.",
          ],
        },
        {
          id: "sampling-rate-practice",
          heading: "Abtastrate praktisch wählen",
          paragraphs: [
            "Zuerst wird festgelegt, welche schnellste Signaländerung fachlich relevant ist. Danach wählt man eine Abtastrate mit ausreichender Reserve – oft deutlich höher als das bloße Zweifache. Reserve schaffen Abweichungen von Sensor, ADC, Zeitplanung und Filterung beherrschbar.",
            "Ein analoger Tiefpass vor dem ADC, ein Anti-Aliasing-Filter, dämpft Frequenzen oberhalb des gewünschten Bereichs schon vor der Messung. Erst dann kann die digitale Verarbeitung sinnvoll mitteln, filtern oder auswerten. Abtastrate, Messdauer, Datenmenge und Energieverbrauch gehören dabei zusammen: schnelleres Messen erzeugt mehr Daten und kostet häufig mehr Energie.",
          ],
        },
      ],
      relatedTopics: [
        "microcontroller-adc",
        "microcontroller-timer",
        "embedded-measurement-debugging",
        "physical-limits",
      ],
    },
    "embedded-safety": {
      title: "Elektrische und funktionale Sicherheit",
      summary: "Sicherheit beginnt bei der Elektronik und endet nicht beim Code. Elektrische Gefährdungen und Fehlfunktionen können Menschen gefährden – beides braucht klare Grenzen und fachgerechte Lösungen.",
      access: "premium",
      sections: [
        {
          heading: "Elektrische Sicherheit: Strom durch den Körper ist entscheidend",
          paragraphs: [
            "Eine elektrische Verletzung hängt vor allem davon ab, welcher Strom wie lange und auf welchem Weg durch den Körper fließt. Wechselstrom und Gleichstrom wirken unterschiedlich; auch Frequenz, Feuchtigkeit, Kontaktfläche und der Weg durch den Körper beeinflussen das Risiko. Spannung ist trotzdem entscheidend, weil sie den Strom durch den Körperwiderstand antreibt: Vereinfacht gilt Strom = Spannung geteilt durch Widerstand.",
            "Der Körperwiderstand ist nicht verlässlich: Trockene Haut kann stark isolieren, feuchte oder verletzte Haut deutlich weniger. Deshalb wird Sicherheit nicht dadurch hergestellt, dass man auf einen hohen Körperwiderstand hofft. Stattdessen begrenzen Schutzkonzepte die berührbare Spannung, die verfügbare Energie und den möglichen Fehlerstrom.",
            "Als grobe Einordnung werden in Normen für gewöhnliche, trockene Bedingungen oft Schutzkleinspannungen bis 50 V Wechselspannung und 120 V Gleichspannung genannt. Bei Feuchtigkeit, leitfähiger Umgebung oder besonderen Bedingungen gelten niedrigere Grenzen, häufig 25 V AC oder 60 V DC. Diese Werte sind keine persönliche Sicherheitsfreigabe und ersetzen weder eine Gefährdungsbeurteilung noch die jeweils geltenden Normen.",
          ],
        },
        {
          heading: "Praktische Regeln für Embedded-Projekte",
          list: [
            "Zum Lernen bei sicherer Kleinspannung bleiben, zum Beispiel USB-versorgte 3,3-V- oder 5-V-Schaltungen. Netzspannung, Schaltnetzteile, große Akkupacks und leistungsstarke Motoren nur mit passender Fachkenntnis, Schutzaufbau und Aufsicht bearbeiten.",
            "Nie unter Spannung umverdrahten oder löten. Vor Änderungen Energiequellen trennen und gespeicherte Energie in Kondensatoren beachten.",
            "Sicherungen, Strombegrenzung, passende Leitungsquerschnitte, Zugentlastung, isolierte Gehäuse und sichere Steckverbinder sind Teil der Funktion – keine optionalen Extras.",
            "Messgeräte und Tastköpfe nur innerhalb ihrer Kategorie, ihres Messbereichs und gemäß Anleitung einsetzen. Ein falscher Masseanschluss oder Messbereich kann selbst einen Fehler erzeugen.",
          ],
        },
        {
          heading: "Funktionale Sicherheit: Wenn korrektes Funktionieren Leben schützt",
          paragraphs: [
            "Funktionale Sicherheit verbindet die Wörter bewusst: Sie betrifft Systeme, bei denen eine Fehlfunktion unter bestimmten Randbedingungen zu einer Gefahr für Leib und Leben führen kann. Es reicht nicht, dass ein System meistens funktioniert. Es muss nachweisbar mit Fehlern umgehen und in einen sicheren Zustand gelangen oder dort bleiben.",
            "Eine Lenkung, die auf der Autobahn ohne Eingriffsmöglichkeit stark einschlägt, kann katastrophale Folgen haben. Dreht sich dieselbe Lenkung im stehenden Fahrzeug in einer abgesicherten Werkstatt, ist die Fehlfunktion weiterhin relevant, aber die Randbedingung und damit die mögliche Folge ist eine andere. Für die Sicherheitsbetrachtung wird nicht der günstige Alltag angenommen, sondern die ungünstigste vorhersehbare Situation.",
            "Dasselbe gilt für Bremsen, Schutzabschaltungen oder Antriebe. Man betrachtet Fehler, Fehlbedienung, Ausfall von Sensoren, Kabelbruch, Spannungsabfall, Softwarefehler und Diagnoseversagen – und legt fest, wie das System eine gefährliche Wirkung verhindert oder begrenzt.",
          ],
        },
        {
          heading: "Keine Basteländerungen an sicherheitskritischen Fahrzeugfunktionen",
          paragraphs: [
            "Fahrzeuge enthalten mehrere Bussysteme und Steuergeräte. Auch Daten, die harmlos wirken – etwa eine Lichtinformation – können in Netzen liegen, über die weitere sicherheitsrelevante Zustände, Diagnose oder Abschaltbedingungen ausgetauscht werden. Ohne vollständige Fahrzeugarchitektur lässt sich nicht zuverlässig erkennen, welche Wechselwirkung eine Änderung hat.",
            "Jede zusätzliche Klemme, Lötstelle, Stromabnahme, Leitung oder Verbindung kann Kontaktprobleme, Unterbrechungen, Störungen oder unerwartete Lasten verursachen. Im ungünstigsten Fall wird ein Signalweg unterbrochen, ein Steuergerät meldet einen Fehler oder das Fahrzeug geht in einen Notlauf. Deshalb keine Änderungen an Fahrzeugbussen, Lenkung, Bremse, Airbag-, Rückhalte- oder Antriebssystemen vornehmen. Solche Arbeiten gehören in freigegebene Entwicklungs- und Prüfprozesse mit Systemwissen, Risikoanalyse, validierter Hardware und rechtlicher Zulassung.",
          ],
        },
        {
          heading: "Sicher entwickeln heißt Grenzen kennen",
          paragraphs: [
            "Für Lern- und Prototyping-Projekte bedeutet das: Die Funktion klar begrenzen, Energie klein halten, Fehler erwarten und sicher testen. Wenn ein Projekt Menschen, Straßenverkehr, Maschinen oder hohe Energien beeinflussen könnte, ist der nächste Schritt nicht ein schneller Code-Patch, sondern eine fachliche Sicherheitsbewertung.",
          ],
        },
      ],
      relatedTopics: [
        "embedded-measurement-debugging",
        "hardware-landscape",
        "server-systems",
      ],
    },
};
