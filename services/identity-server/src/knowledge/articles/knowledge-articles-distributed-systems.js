// Wissensspeicher: Verteilte Systeme und Server-Landschaften.
const KnowledgeArticlesDistributedSystems = { // Server-side authored content.
    "distributed-systems-introduction": {
      title: "Verteilte Systeme: Wenn zwei Welten zusammenarbeiten",
      summary: "Ein verteiltes System verbindet die physische Welt mit Software, Kommunikation und Bedienung. Keine einzelne Komponente löst die Aufgabe allein.",
      access: "premium",
      sections: [
        {
          heading: "Von der einzelnen Aufgabe zum System",
          paragraphs: [
            "Ein Temperatursensor kann eine Temperatur messen. Ein Mikrocontroller kann den Messwert lesen und mit seiner Firmware bewerten. Damit daraus eine verständliche Anzeige, eine Benachrichtigung oder eine Regel für mehrere Orte wird, kommen Netzwerk, Server und eine Anwendung hinzu. Diese Teile arbeiten getrennt, müssen aber zuverlässig zusammenpassen – deshalb sprechen wir von einem verteilten System.",
          ],
        },
        {
          heading: "Die Rollen sind verschieden",
          table: {
            headers: [
              "Teil",
              "Stärke",
              "Typische Aufgabe",
            ],
            rows: [
              [
                "Elektrotechnik und Hardware",
                "misst, schaltet, speichert Energie und überträgt Signale",
                "Sensor, Stromversorgung, Aktor und Board",
              ],
              [
                "Firmware",
                "reagiert nah an der Hardware und mit begrenzten Ressourcen",
                "Messwert auswerten, Motor sicher ansteuern, WLAN verbinden",
              ],
              [
                "Netzwerk und Server",
                "verbindet mehrere Geräte und Nutzer",
                "Daten speichern, Regeln koordinieren, Fernzugriff anbieten",
              ],
              [
                "Apps und Web-Oberflächen",
                "machen Informationen und bewusste Befehle für Menschen zugänglich",
                "Status zeigen, Einstellungen ändern, Warnungen darstellen",
              ],
            ],
          },
        },
        {
          heading: "Die richtige Verteilung wählen",
          paragraphs: [
            "Nicht jedes Projekt braucht Cloud, App und mehrere Server. Eine lokale Temperaturregelung muss auch ohne Internet sicher funktionieren. Ein Server ist sinnvoll, wenn Geräte oder Menschen über mehrere Orte hinweg zusammenarbeiten, Daten langfristig ausgewertet werden oder ein zentraler Zugang gebraucht wird. Gute Architektur verteilt Aufgaben nur dort, wo es einen klaren Nutzen gibt.",
          ],
        },
        {
          heading: "So geht es weiter",
          paragraphs: [
            "In diesem Kapitel geht es nun um die Verbindungen zwischen den Teilen: Software auf mehreren Ebenen, Schnittstellen, Nachrichten und passende Server. Die vorherigen Kapitel liefern dafür die Grundlagen: Hardware bestimmt die physikalischen Möglichkeiten, Software und Firmware beschreiben das Verhalten innerhalb dieser Grenzen.",
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "hardware-landscape",
        "software-basics-introduction",
        "communication-basics",
        "server-systems",
      ],
    },
    "software-basics": {
      title: "Software in verteilten Systemen",
      summary: "Ein modernes Produkt besteht oft aus mehreren Softwareteilen: Firmware im Gerät, Diensten auf Servern und Apps für Menschen. Zusammen müssen sie klar zusammenspielen.",
      access: "premium",
      sections: [
        {
          heading: "Software auf jeder Ebene",
          table: {
            headers: [
              "Ebene",
              "Typische Software",
              "Aufgabe",
            ],
            rows: [
              [
                "IoT-Gerät",
                "Firmware",
                "Liest Sensoren, steuert Aktoren und setzt die Kernfunktion mit begrenzten Ressourcen um.",
              ],
              [
                "Lokaler Server",
                "Gateway- oder Automatisierungsdienst",
                "Verbindet Geräte, übersetzt Protokolle, puffert Daten und führt lokale Regeln aus.",
              ],
              [
                "Internet/VPS oder Cloud",
                "API, Datenbank, Hintergrunddienste",
                "Verwaltet Konten, Synchronisation, zentrale Daten und Dienste für mehrere Nutzer oder Standorte.",
              ],
              [
                "Apps",
                "Mobile, Desktop- und Web-Anwendungen",
                "Machen Funktionen bedienbar, zeigen Informationen und senden bewusst ausgelöste Befehle.",
              ],
            ],
          },
        },
        {
          heading: "Schnittstellen statt Vermischung",
          paragraphs: [
            "Die Teile sollten über klar definierte Schnittstellen zusammenarbeiten: Datenformate, APIs, Ereignisse und Fehlerfälle werden bewusst beschrieben. Eine App sollte nicht die einzige Stelle sein, an der ein Gerät korrekt funktioniert; eine Internetverbindung sollte keine lokale Schutzfunktion ersetzen.",
            "Gute Software trennt Verantwortung: Die Firmware reagiert zuverlässig am Gerät, ein Server koordiniert und speichert, Apps stellen Menschen eine verständliche Bedienung bereit. Diese Trennung macht Änderungen, Tests und Fehlersuche beherrschbar.",
          ],
        },
        {
          heading: "Ein praktischer Ablauf",
          list: [
            "Zuerst Kernfunktion und Fehlergrenzen am Gerät oder in der lokalen Logik klären.",
            "Dann Schnittstellen und Datenflüsse zwischen Geräten, Servern und Apps benennen.",
            "Zeitaufwändige Arbeit in klar begrenzte Hintergrundaufgaben auslagern.",
            "Logs, Tests und Messwerte nutzen, um jedes Teil einzeln und im Zusammenspiel zu prüfen.",
          ],
        },
      ],
      relatedTopics: [
        "workers-and-queues",
        "server-systems",
        "hardware-landscape",
      ],
    },
    "communication-basics": {
      title: "Kommunikation und Schnittstellen",
      summary: "Verteilte Systeme werden erst dann zu einem gemeinsamen Projekt, wenn sie zuverlässig, verständlich und sicher miteinander kommunizieren können.",
      access: "premium",
      sections: [
        {
          id: "communication-rest",
          heading: "REST und HTTP: fragen und antworten",
          paragraphs: [
            "REST ist ein verbreiteter Stil für Web-Schnittstellen. Eine App oder ein Gerät sendet über HTTP eine Anfrage an eine Adresse, der Server verarbeitet sie und sendet eine Antwort zurück. Ein Beispiel: Die Tamagotchi-App fragt den Server nach dem aktuellen Zustand oder sendet den Wunsch, das Tamagotchi zu füttern.",
            "HTTP-Methoden machen die Absicht lesbar: GET liest Daten, POST legt etwas Neues an oder löst eine Aktion aus, PUT oder PATCH aktualisieren vorhandene Daten und DELETE entfernt etwas. Eine gute REST-API beschreibt klar, welche Adresse welche Daten erwartet, welche Antwort zurückkommt und was bei einem Fehler passiert.",
            "REST passt besonders gut, wenn ein Nutzer oder eine App bewusst etwas abfragt oder auslöst. Es ist leicht zu testen, gut dokumentierbar und funktioniert über viele Plattformen hinweg. Für ständig neue Ereignisse oder sehr viele kleine Sensormeldungen ist ein anderes Kommunikationsmuster oft besser geeignet.",
          ],
        },
        {
          id: "communication-events",
          heading: "Ereignisse, Webhooks und WebSockets",
          paragraphs: [
            "Bei einem Ereignis informiert ein System ein anderes darüber, dass etwas passiert ist: Ein Grenzwert wurde überschritten, ein Update steht bereit oder dein Tamagotchi wird hungrig. Der Empfänger muss nicht ständig nachfragen. Das ist ein anderes Muster als die klassische REST-Anfrage.",
            "Ein Webhook ist eine vorher vereinbarte HTTP-Adresse, die ein System bei einem Ereignis aufruft. WebSockets halten dagegen eine offene Verbindung zwischen Client und Server. So können beide Seiten schnell Nachrichten austauschen, etwa für einen Live-Status in einer Web-App.",
            "Ereignisorientierte Kommunikation braucht klare Regeln: Welche Ereignisnamen gibt es? Welche Daten dürfen sie enthalten? Was passiert, wenn der Empfänger kurz offline ist? Ein Ereignis sollte auch doppelt eintreffen können, ohne ungewollt zweimal dieselbe Aktion auszulösen.",
          ],
        },
        {
          id: "communication-mqtt",
          heading: "MQTT: Nachrichten für IoT",
          paragraphs: [
            "MQTT ist ein leichtgewichtiges Nachrichtenprotokoll für Geräte, Sensoren und Aktoren. Geräte veröffentlichen Nachrichten zu einem Thema, zum Beispiel 'haus/wohnzimmer/temperatur'. Andere Systeme abonnieren dieses Thema und erhalten die Nachricht, wenn sie dafür berechtigt sind.",
            "Dazwischen steht ein MQTT-Broker. Er nimmt Nachrichten entgegen und verteilt sie an die passenden Empfänger. Dadurch müssen Geräte einander nicht direkt kennen. Ein ESP32 kann einen Messwert senden, während eine App, ein Home Server und ein Regelwerk ihn gleichzeitig verwenden.",
            "MQTT passt gut zu vielen kleinen Meldungen, wechselnden Verbindungen und verteilten IoT-Geräten. Es ersetzt REST nicht vollständig: Konfigurationen, Konten oder einmalige Abfragen können weiterhin sinnvoll über eine REST-API laufen. Gute Systeme kombinieren beide Muster bewusst.",
          ],
        },
        {
          id: "communication-data-security",
          heading: "JSON, Identität und Berechtigungen",
          paragraphs: [
            "JSON ist ein einfaches Textformat für strukturierte Daten. Statt nur '23' zu senden, kann eine Nachricht zum Beispiel Temperatur, Einheit, Zeit und Gerätekennung enthalten. Ein klar definiertes Datenformat verhindert Missverständnisse zwischen App, Server und Gerät.",
            "Eine Schnittstelle darf nicht nur technisch erreichbar sein, sondern muss auch wissen, wer kommuniziert. Identität beantwortet die Frage: Wer ist dieses Gerät oder dieser Nutzer? Berechtigung beantwortet: Was darf diese Identität lesen, ändern oder auslösen? Diese beiden Fragen gehören zu jeder API und zu jedem MQTT-Thema.",
            "Plane außerdem Fehlerfälle mit ein: ungültige Daten, fehlende Verbindung, abgelaufene Zugangsdaten oder doppelte Nachrichten. Eine gute Schnittstelle beantwortet nicht nur den Idealfall, sondern bleibt auch dann nachvollziehbar und sicher, wenn etwas schiefgeht.",
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "server-systems",
        "microcontroller-basics",
      ],
    },
    "server-systems": {
      title: "Moderne Systemlandschaften verstehen",
      summary: "Ein Embedded-Gerät, ein lokaler Server, globale Dienste und eine iPhone-App sind mögliche Bausteine – keine Pflichtkette. Die Aufgabe bestimmt, was wirklich gebraucht wird.",
      access: "premium",
      sections: [
        {
          heading: "Vom IoT-Device-Bus zur App",
          paragraphs: [
            "Die Grafik zeigt drei Hauptbereiche. IoT-Geräte arbeiten an der realen Umgebung. Server verbinden, speichern oder verarbeiten Daten. Apps machen Funktionen für Menschen bedienbar. Die Server- und App-Varianten werden hier bewusst einzeln erklärt.",
          ],
          systemLandscape: true,
          table: {
            headers: [
              "Baustein aus der Übersicht",
              "Aufgabe",
              "Wann er sinnvoll ist",
            ],
            rows: [
              [
                "IoT-Geräte",
                "Embedded-Systeme lesen Sensoren, steuern Aktoren und reagieren direkt vor Ort.",
                "Wenn kurze Reaktionszeit, geringer Energiebedarf oder Betrieb ohne Internet wichtig sind – zum Beispiel ESP32-Sensor, Türkontakt oder Bewässerungssteuerung.",
              ],
              [
                "Server: Lokal",
                "Ein lokaler Server oder Gateway bündelt Geräte im Haus, Betrieb oder Fahrzeug; er kann Daten puffern und Regeln ausführen.",
                "Wenn Geräte bei Internet-Ausfall zusammenarbeiten sollen, Daten vor Ort bleiben oder verschiedene Funknetze verbunden werden.",
              ],
              [
                "Server: Internet/VPS",
                "Ein Internet-Server oder VPS stellt APIs, Konten, Synchronisation und zentrale Dienste bereit.",
                "Wenn Fernzugriff, gemeinsame Nutzung, zentrale Backups oder mehrere Standorte erforderlich sind.",
              ],
              [
                "Server: Cloud",
                "Cloud-Dienste liefern nach Bedarf verwalteten Speicher, Datenbanken, Auswertung oder skalierbare Verarbeitung.",
                "Wenn Last stark schwankt, weltweite Reichweite gebraucht wird oder verwaltete Dienste Betriebsaufwand sparen.",
              ],
              [
                "Apps: Mobil",
                "Mobile Apps auf iPhone, iPad oder Android zeigen Werte, senden Bedienbefehle und empfangen Benachrichtigungen.",
                "Wenn Menschen unterwegs informiert werden oder Funktionen mobil bedienen sollen.",
              ],
              [
                "Apps: PC/Mac und Web",
                "Desktop- und Web-Apps bieten größere Übersichten, Konfiguration und Analyse im Browser oder auf dem Rechner.",
                "Wenn längere Bedienabläufe, Planung, Auswertung oder Administration im Vordergrund stehen.",
              ],
            ],
          },
        },
        {
          heading: "Nicht jedes Projekt braucht alles",
          table: {
            headers: [
              "Beispiel",
              "Sinnvolle Bausteine",
              "Warum",
            ],
            rows: [
              [
                "Batteriebetriebener Temperatursensor",
                "IoT-Gerät",
                "Er misst und sendet in Intervallen. Ein Server oder eine App ist erst nötig, wenn Werte dauerhaft gesammelt oder aus der Ferne gesehen werden sollen.",
              ],
              [
                "Bewässerung im Gewächshaus",
                "IoT-Geräte, optional Server: lokal",
                "Die Steuerung muss auch ohne Internet funktionieren. Ein lokales Gateway kann mehrere Sensoren und Zeitpläne koordinieren.",
              ],
              [
                "Hausautomation mit Fernzugriff",
                "IoT-Geräte, Server: lokal und Internet/VPS, Apps: mobil oder Web",
                "Lokal bleiben Automationen reaktionsfähig; über Internet-Server und Apps kommen Fernzugriff und sichere Benachrichtigungen dazu.",
              ],
              [
                "Produkt mit Kunden-App",
                "IoT-Gerät, Server: Internet/VPS oder Cloud, Apps: mobil",
                "Das Gerät arbeitet vor Ort; Server verwalten Konten und Synchronisation; die mobile App ist die persönliche Bedienung.",
              ],
              [
                "Maschinenüberwachung an mehreren Standorten",
                "IoT-Geräte, Server: lokal und Cloud/VPS, Apps: PC/Mac oder Web",
                "Der lokale Server puffert und filtert Daten vor Ort, während zentrale Server Standorte vergleichen und Alarme verteilen.",
              ],
            ],
          },
        },
        {
          heading: "Sicherheitsgrenze folgt dem Servermodell",
          table: {
            headers: [
              "Modell",
              "Wofür du selbst verantwortlich bleibst",
            ],
            rows: [
              [
                "Eigener lokaler Server",
                "Physischer Zugang, Router und Heimnetz, Updates, Konten, Backups sowie die Entscheidung, ob überhaupt etwas ins Internet darf.",
              ],
              [
                "Dedizierter Server oder VPS",
                "Betriebssystem, Dienste, Firewall-Regeln, Identitäten, Geheimnisse, Updates, Backups und die Überwachung. Der Anbieter schützt Rechenzentrum und beim VPS die Virtualisierung.",
              ],
              [
                "Cloud-Dienst",
                "Identitäten und Rechte, sichere Konfiguration, Daten, Netzfreigaben, Geheimnisse, Protokollierung und Ausgaben. Der Anbieter schützt die jeweilige Plattform bis zu der im Dienstvertrag beschriebenen Grenze.",
              ],
            ],
          },
          paragraphs: [
            "Die Technik ändert sich, die Grundregel nicht: Verantwortung lässt sich nicht einfach mitmieten. Vor der Auswahl sollte klar sein, wer Updates einspielt, Zugänge prüft, Daten wiederherstellt und auf einen Sicherheitsvorfall reagiert.",
          ],
        },
        {
          heading: "GerNetiX einordnen",
          paragraphs: [
            "GerNetiX nutzt für seine Plattform einen VPS als gemeinsame Deployment-Umgebung für getrennte Dienste. Das ist kein Cloud-Autopilot: Zugänge, Updates, Container-Netzwerk, Backups und Monitoring bleiben bewusst kontrollierte Betriebsaufgaben. Hardware-nahe Funktionen wie USB-Provisionierung bleiben lokal beim Gerät und werden nicht auf den VPS verlagert.",
            "Ein GerNetiX-Projekt kann deshalb klein beginnen: ESP32 plus lokale Bedienung. Erst wenn es einen fachlichen Nutzen gibt, kommen ein lokales Gateway, der VPS für Fernzugriff oder eine iPhone-App dazu. Die verlässliche Reaktion auf Sensoren und Aktoren bleibt dabei am Embedded-System oder lokalen Gateway.",
          ],
        },
      ],
      relatedTopics: [
        "hardware-landscape",
        "processor-overview",
        "glossary-basics",
      ],
    },
    "local-servers": {
      title: "Lokale Server und Gateways",
      summary: "Ein lokaler Server läuft im Haus, Büro oder Werk und verbindet Geräte nahe an ihrem Einsatzort.",
      access: "premium",
      sections: [
        {
          heading: "Wofür ein lokaler Server da ist",
          paragraphs: [
            "Ein lokaler Server oder Gateway sammelt Daten von IoT-Geräten, führt Regeln aus, puffert Informationen und stellt bei Bedarf eine lokale Bedienoberfläche bereit. Weil er nah bei den Geräten ist, kann die Kernfunktion auch ohne Internet weiterlaufen.",
          ],
        },
        {
          heading: "Typische Anwendungen",
          list: [
            "Hausautomation mit lokalen Regeln und Funk-Bridges.",
            "Maschinen- oder Kameradaten, die das Gebäude nicht verlassen sollen.",
            "Lokale Datenpufferung bei unzuverlässigem Internet.",
            "Protokollübersetzung zwischen IoT-Geräten und weiteren Systemen.",
          ],
        },
        {
          heading: "Sicherheit eines lokalen Servers",
          paragraphs: [
            "Lokale Kontrolle bedeutet auch lokaler Betrieb: Stromausfall, Netzwerk, Updates, Backups und Fernwartung müssen geplant werden. Ein lokaler Server ersetzt kein Sicherheitskonzept, kann aber Latenz, Datenschutz und Ausfallsicherheit verbessern.",
            "Die wichtigste Grenze ist: Ein Dienst im Heimnetz ist nicht automatisch für das Internet bestimmt. Verwaltungsoberflächen, Datenbanken und Fernzugänge bleiben am besten im lokalen Netz oder hinter einem VPN. Werden sie per Portfreigabe erreichbar, gelten sie als Internetdienste und brauchen dieselbe Pflege wie ein VPS: klare Zugänge, zeitnahe Updates, Protokollierung und geprüfte Backups.",
          ],
          list: [
            "Router und WLAN mit aktuellen Updates und getrennten Gästen bzw. IoT-Netzen betreiben.",
            "Für Administration starke, persönliche Konten und einen privaten Zugang wie VPN verwenden; keine gemeinsamen Standardpasswörter lassen.",
            "Sicherungen getrennt vom Server aufbewahren und die Wiederherstellung regelmäßig testen.",
            "Bei Ausfall oder Angriff muss die lokale Kernfunktion einen sicheren Zustand erreichen – sie darf nicht auf Fernzugriff angewiesen sein.",
          ],
        },
      ],
      relatedTopics: [
        "server-systems",
        "internet-vps",
        "cloud-services",
      ],
    },
    "internet-vps": {
      title: "Internet-Server und VPS",
      summary: "Ein Internet-Server macht einen klar abgegrenzten Dienst von außen erreichbar. VPS, dedizierte Server und Cloud unterscheiden sich vor allem darin, wie fest Ressourcen gebucht sind und wie sie mit Last wachsen.",
      access: "premium",
      sections: [
        {
          heading: "Internet-Server",
          paragraphs: [
            "Ein öffentlich erreichbarer Server stellt beispielsweise APIs, Konten, Synchronisation oder eine Web-Anwendung bereit. Er verbindet Nutzer, Apps und Standorte über das Internet, muss aber besonders sorgfältig gegen unbefugte Zugriffe geschützt werden.",
          ],
        },
        {
          heading: "VPS: ein fest gebuchtes Serverprodukt",
          paragraphs: [
            "Ein VPS ist eine logisch getrennte virtuelle Serverinstanz im Rechenzentrum. Du buchst in der Regel ein festes Produkt: eine bestimmte Anzahl virtueller CPUs, eine festgelegte RAM-Größe, Speicherplatz und einen Netzrahmen. Er fühlt sich wie ein eigener Linux-Server an, ohne dass du die physische Hardware betreiben musst.",
            "Reicht die Leistung später nicht mehr, wechselst du normalerweise bewusst auf einen größeren Tarif oder ergänzt weitere Instanzen. Das ist planbar, aber nicht automatisch unendlich skalierbar. Betriebssystem, Updates, Firewall, Zugänge, Backups und Überwachung bleiben deine Aufgabe.",
          ],
        },
        {
          heading: "Die vier verbreiteten Betriebsmodelle",
          table: {
            headers: [
              "Modell",
              "Wie Ressourcen bereitstehen",
              "Typische Aufgabe",
            ],
            rows: [
              [
                "Lokaler Server",
                "Ein Rechner im eigenen Haus, Büro oder Werk; er läuft im lokalen Netzwerk oder hinter einem eigenen Internetanschluss.",
                "Home Assistant, lokale Datenablage, Maschinen-Gateway, Kameraaufzeichnung, Entwicklung und Offline-Betrieb.",
              ],
              [
                "Klassischer dedizierter Server",
                "Ein vollständig gemieteter physischer Server im Rechenzentrum. Seine CPUs, sein RAM und seine Laufwerke sind als konkrete Hardware nur für einen Kunden reserviert.",
                "Dauerlast mit festen Anforderungen, große Datenbanken, spezielle Hardware oder Anwendungen mit planbarer Auslastung.",
              ],
              [
                "VPS (Virtual Private Server)",
                "Ein fest gebuchtes Paket aus virtuellen CPUs, RAM, Speicher und Netzwerk auf einem gemeinsamen physischen Host. Größer wird es durch Tarifwechsel oder weitere Instanzen.",
                "Websites, APIs, VPN-Gateways, kleine bis mittlere Datenbanken und klar abgegrenzte Container-Dienste.",
              ],
              [
                "Cloud-Dienste",
                "Ressourcen werden als nach Verbrauch oder Konfiguration bereitgestellte Bausteine gemietet: zum Beispiel Instanzen, Funktionen, Datenbanken, Objektspeicher oder Queues. Viele Angebote können Leistung automatisch hoch- und herunterfahren.",
                "Stark schwankende Last, weltweite Reichweite, verwaltete Datenbanken, Objektspeicher, Event-Verarbeitung und elastische Web-Anwendungen.",
              ],
            ],
          },
        },
        {
          heading: "Auswirkungen im Alltag",
          table: {
            headers: [
              "Kriterium",
              "Lokal",
              "Dediziert",
              "VPS",
              "Cloud",
            ],
            rows: [
              [
                "Performance",
                "Sehr kurze Wege zu lokalen Geräten; Internetzugriff hängt am eigenen Anschluss.",
                "Konstant und gut planbar, da konkrete Hardware reserviert ist.",
                "Für viele Anwendungen stark genug; die gebuchte Größe setzt jedoch eine feste Obergrenze.",
                "Kann mit Last wachsen oder schrumpfen; Netzlatenz, Dienstgrenzen und die gewählte Architektur bleiben entscheidend.",
              ],
              [
                "Sicherheit",
                "Volle Kontrolle, aber Updates, Backups, Stromausfall und Netzabsicherung liegen bei dir.",
                "Klare Hardware-Trennung; Betriebssystem, Firewall, Patches und Backups bleiben deine Aufgabe.",
                "Provider schützt Rechenzentrum und Virtualisierung; du verantwortest Betriebssystem, Zugänge, Updates und Daten.",
                "Provider übernimmt Teile der Plattform-Sicherheit; Identitäten, Rechte, Konfiguration, Daten und Kostenlimits bleiben deine Verantwortung.",
              ],
              [
                "Skalierbarkeit",
                "Begrenzt durch die vorhandene Hardware; Aufrüstung oder zweiter Server sind Handarbeit.",
                "Vertikal durch andere Hardware, horizontal durch weitere Server – jeweils mit Planung, Beschaffung oder Vertrag.",
                "Vertikal durch einen größeren Tarif, horizontal durch zusätzliche Instanzen. Beides wird bewusst geplant und ausgelöst.",
                "Elastisch: Je nach Dienst können Instanzen, Speicher, Datenbankkapazität oder parallele Ausführungen automatisch oder kurzfristig mehr und später wieder weniger werden.",
              ],
              [
                "Betriebsaufwand",
                "Hoch: Hardware, Netzwerk, USV, Monitoring und Fernzugriff selbst organisieren.",
                "Mittel bis hoch: Hardware ist gemietet, Softwarebetrieb bleibt selbst verwaltet.",
                "Mittel: kein Hardwarebetrieb, aber Linux, Container, Updates, Monitoring und Backups bleiben wichtig.",
                "Niedrig bis mittel bei verwalteten Diensten; Architektur, Rechte und Kostenkontrolle benötigen weiterhin Fachwissen.",
              ],
            ],
          },
        },
        {
          heading: "Sicherheitsverantwortung: dedizierter Server und VPS",
          paragraphs: [
            "Bei einem dedizierten Server schützt der Anbieter Gebäude, Stromversorgung und Hardware; bei einem VPS zusätzlich die Virtualisierungsplattform. Ab dem Betriebssystem beginnt jedoch deine Verantwortung. Dazu gehören Benutzerkonten, SSH- oder Adminzugang, Firewall, Anwendungen, Abhängigkeiten, Daten, Sicherungskopien und die Reaktion auf Auffälligkeiten.",
            "Trenne öffentliche Funktionen von Verwaltung und Datenhaltung. Erlaube nur notwendige Netzwerkwege, halte das Betriebssystem und Anwendungen aktuell, verwende individuelle Schlüssel oder Mehrfaktor-Authentisierung für Administration und überwache Logins, Fehler sowie Speicher- und Ressourcenverbrauch. Ein VPS ist damit kein 'sicherer Server von selbst', sondern ein gemieteter Server mit weniger Hardwarearbeit.",
          ],
        },
        {
          heading: "Betrieb und Sicherheit",
          list: [
            "Zugänge mit Schlüsseln und starken Identitäten schützen; unnötige Dienste und offene Ports vermeiden.",
            "Betriebssystem und Anwendungen zeitnah aktualisieren sowie Backups und Wiederherstellung testen.",
            "Logs, Erreichbarkeit, Speicher und Ressourcen überwachen.",
            "Verlässliche Echtzeit- oder Schutzfunktionen nicht vom Internet abhängig machen.",
          ],
        },
      ],
      relatedTopics: [
        "local-servers",
        "cloud-services",
        "server-systems",
      ],
    },
    "home-server-internet-security": {
      title: "Home-Server sicher betreiben: Risiken der Internetfreigabe",
      summary: "Warum eine Portfreigabe aus einem privaten Netzwerk einen dauerhaft erreichbaren Dienst macht – und welche Entscheidungen das Risiko wirksam reduzieren.",
      access: "premium",
      sections: [
        {
          id: "home-server-public-meaning",
          heading: "Eine Portfreigabe macht aus einem lokalen Dienst einen Internetdienst",
          paragraphs: [
            "Ein Home-Server ist zunächst nur im eigenen Netz erreichbar. Eine Portfreigabe oder ein öffentlich erreichbarer Reverse Proxy ändert das grundlegend: Der Dienst kann nun von beliebigen Systemen im Internet angesprochen werden. Das ist kein Fehler an sich, aber es ist eine neue Betriebsrolle mit eigener Verantwortung.",
            "Automatisierte Scanner suchen fortlaufend nach erreichbaren Adressen, offenen Ports und bekannten Antwortmustern. Sie unterscheiden nicht, ob ein Dienst als Hobbyprojekt, Testsystem oder Produkt gedacht ist. Jede sichtbare Login-Seite, API oder Verwaltungsoberfläche muss deshalb so behandelt werden, als würde sie regelmäßig von Unbekannten geprüft.",
          ],
        },
        {
          id: "home-server-attack-surface",
          heading: "Warum das Risiko wächst",
          paragraphs: [
            "Mit jedem öffentlich erreichbaren Dienst wächst die Angriffsfläche: Betriebssystem, Webserver, Anwendung, Abhängigkeiten, Konfiguration, Konten, Datenbankzugänge und Sicherungskopien können Fehler enthalten. Auch ein korrekt geschriebenes Programm schützt nicht vor einem ungepatchten Framework, einem zu weit geöffneten Admin-Port oder einem schwachen Zugang.",
            "Besonders gefährlich sind Verwaltungsoberflächen, Datenbanken, Fernwartung und Testdienste. Sie enthalten oft weitreichende Rechte oder sensible Daten. Ein kompromittiertes Konto kann nicht nur Informationen lesen, sondern je nach Dienst Konfigurationen ändern, weitere Zugänge anlegen oder Schadsoftware nachladen.",
          ],
        },
        {
          id: "home-server-common-mistakes",
          heading: "Typische Fehlannahmen",
          list: [
            "„Die Adresse kennt niemand.“ – Suchmaschinen und Scanner finden offene Dienste automatisiert.",
            "„Ein starkes Passwort reicht.“ – Passwörter helfen nicht gegen Sicherheitslücken, Fehlkonfigurationen oder gestohlene Sitzungen.",
            "„Der Router blockiert alles andere.“ – Eine einzelne Freigabe reicht aus, um genau diesen Dienst weltweit erreichbar zu machen.",
            "„Ich aktualisiere später.“ – Bekannte Schwachstellen werden oft sehr schnell automatisiert ausgenutzt.",
            "„Ein Backup genügt.“ – Ein Backup schützt nur, wenn es getrennt gespeichert und die Wiederherstellung regelmäßig getestet wird.",
          ],
        },
        {
          id: "home-server-safer-design",
          heading: "Sicherer planen statt einfach öffnen",
          paragraphs: [
            "Frage zuerst, ob der Dienst wirklich öffentlich erreichbar sein muss. Für persönliche Administration ist ein VPN oder ein strikt begrenzter Zugriff über eine private Verbindung häufig die bessere Wahl. Öffentliche Funktionen sollten von Verwaltungsfunktionen getrennt sein: Ein Besucher braucht keinen Zugriff auf Admin-Tools, Datenbanken, SSH oder interne Diagnoseports.",
            "Wenn ein Dienst öffentlich sein muss, reduziere ihn auf eine klar definierte Aufgabe. Nur notwendige Ports öffnen, sichere Identitäten wie Passkeys oder Schlüssel verwenden, Mehrfaktor-Authentisierung für Administration einsetzen, Rechte minimal halten und Geheimnisse nicht in Quelltext oder Browser speichern. Rate Limits, Protokollierung und Alarmierung helfen, Auffälligkeiten früh zu erkennen; sie ersetzen aber keine Updates und keine Zugangskontrolle.",
          ],
        },
        {
          id: "home-server-operation",
          heading: "Betrieb ist Teil der Sicherheitsfunktion",
          paragraphs: [
            "Ein Internetdienst braucht einen wiederholbaren Wartungsablauf: Sicherheitsupdates zeitnah einspielen, nicht mehr benötigte Komponenten entfernen, Logs und Login-Versuche prüfen, Backups getrennt aufbewahren und eine Wiederherstellung üben. Plane auch, wie Zugänge gesperrt, Schlüssel ersetzt und ein betroffener Dienst vom Netz getrennt wird.",
            "Für Steuerungen im Haus gilt zusätzlich: Schutz- und Grundfunktionen dürfen nicht von einem Internetdienst abhängen. Heizung, Zutritt, Licht oder sicherheitsrelevante Aktoren brauchen lokale, sichere Fehlerzustände. Der Fernzugriff darf Komfort liefern, aber er darf keinen einzelnen Angriff zu einer Gefährdung im Gebäude machen.",
          ],
        },
        {
          id: "home-server-decision",
          heading: "Eine gute Entscheidungsfrage",
          paragraphs: [
            "Nicht „Wie öffne ich den Port?“, sondern „Welche Menschen sollen welche Funktion von wo aus nutzen – und was passiert bei einem Fehler?“ ist die richtige Ausgangsfrage. Wenn die Antwort nur dich selbst oder wenige bekannte Personen betrifft, ist ein privater Zugang meist einfacher und sicherer. Wenn ein Dienst öffentlich wird, sollte er wie ein kleiner Produktivdienst geplant, überwacht und gepflegt werden.",
          ],
        },
      ],
      relatedTopics: [
        "local-servers",
        "internet-vps",
        "privacy-basics",
        "communication-basics",
      ],
    },
    "cloud-services": {
      title: "Cloud-Dienste",
      summary: "Cloud ist nicht einfach ein fremder Server: Du mietest einzeln messbare Rechen-, Speicher- und Plattformressourcen, die je nach Last wachsen und wieder schrumpfen können.",
      access: "premium",
      sections: [
        {
          heading: "Was Cloud von einem VPS unterscheidet",
          paragraphs: [
            "Bei einem VPS kaufst du üblicherweise eine fest definierte virtuelle Maschine für einen Zeitraum: etwa vier virtuelle CPUs, acht Gigabyte RAM und eine bestimmte Platte. Sie läuft auch dann mit dieser Größe weiter, wenn gerade niemand deine Anwendung nutzt. Mehr Leistung erhältst du durch einen bewussten Tarifwechsel oder eine zusätzliche Maschine.",
            "Cloud-Dienste zerlegen diese Maschine in mietbare Bausteine. Eine Anwendung kann auf vielen kurzlebigen Instanzen, einzelnen Funktionsaufrufen, einer verwalteten Datenbank, einem Objektspeicher und einer Queue laufen. Je nach Angebot und Konfiguration wird bei mehr Anfragen mehr parallel ausgeführt; sinkt die Last, werden Ressourcen wieder reduziert. Diese Elastizität ist die Besonderheit – und keine automatische Eigenschaft jedes Servers im Rechenzentrum.",
          ],
        },
        {
          heading: "Wann Cloud sinnvoll ist",
          paragraphs: [
            "Cloud-Dienste passen zu stark schwankender Last, globaler Reichweite oder verwalteten Datenbanken und Speichern. Sie können Infrastrukturarbeit reduzieren, ersetzen aber keine gute Architektur und keine Verantwortung für Daten, Rechte und Ausgaben.",
          ],
        },
        {
          heading: "Sicherheit in der Cloud: gemeinsame Verantwortung",
          paragraphs: [
            "Cloud-Anbieter schützen Rechenzentren und – abhängig vom gebuchten Dienst – Teile der Hardware, Virtualisierung und Plattform. Du verantwortest trotzdem, wer sich anmelden darf, welche Rechte diese Personen und Dienste haben, welche Daten gespeichert werden und welche Netzverbindungen oder Schnittstellen geöffnet sind.",
            "Verwaltete Dienste nehmen Wartungsarbeit ab, aber Fehlkonfigurationen bleiben möglich: ein zu weit berechtigtes Konto, ein öffentlicher Speicherbereich, ein offener Datenbankzugang oder ein veröffentlichter Schlüssel kann Daten gefährden. Deshalb Identitäten und Rechte klein halten, Geheimnisse sicher verwalten, Zugriffe protokollieren, Regionen und Aufbewahrung bewusst wählen sowie Alarm- und Kostenlimits einrichten.",
          ],
        },
        {
          heading: "Die Kostenfalle Cloud-Computing",
          paragraphs: [
            "Cloud-Plattformen wie AWS können bei steigender Last automatisch zusätzliche Ressourcen bereitstellen. Das ist ein großer Vorteil: Anwendungen wachsen, ohne dass jemand Server manuell nachbestellen muss. Genau dieselbe Automatik kann aber einen Fehler sehr schnell und teuer verstärken.",
            "Läuft eine Funktion, ein Worker oder Hintergrundprozess unbegrenzt, startet sich ständig neu oder erzeugt ohne Grenze neue Aufgaben, kann die Cloud dieses Verhalten mit immer weiteren Ausführungen beantworten. Ein kleiner Fehler im Code kann so in kurzer Zeit hohe Kosten verursachen.",
            "Automatische Skalierung verstärkt nicht nur erfolgreiche Anwendungen, sondern auch Fehler. Wer Cloud-Systeme entwickelt, muss deshalb neben der technischen Funktion auch die wirtschaftliche Wirkung jeder einzelnen Ausführung verstehen.",
          ],
        },
        {
          heading: "Typische Ursachen",
          list: [
            "Endlosschleifen oder fehlende Abbruchbedingungen.",
            "Unbegrenzte Wiederholungsversuche und fehlende Timeouts bei externen Aufrufen.",
            "Rekursiv erzeugte Events oder Cloud-Funktionen, die sich gegenseitig erneut auslösen.",
            "Unkontrolliert skalierende Queue-Consumer und zu große Batch-Mengen.",
            "Dauerhaft laufende, blockierende oder nach Fehlern sofort neu gestartete Prozesse.",
          ],
        },
        {
          heading: "Jede Ausführung muss begrenzt sein",
          list: [
            "Im Code: maximale Laufzeit, klare Abbruchbedingungen, begrenzte Wiederholungsversuche und kontrollierte Batch- oder Mengenlimits festlegen.",
            "Bei externen Diensten: verbindliche Timeouts setzen und Fehler nicht ohne Pause sofort erneut ausführen.",
            "In der Cloud-Infrastruktur: Parallelität, Queue-Größen, Skalierungsgrenzen und Ausgaben begrenzen; Budgets und Warnmeldungen aktivieren.",
            "Der Dienst soll sich selbst kontrolliert beenden oder in einen sicheren Fehlerzustand wechseln. Infrastruktur-Limits sind das letzte Sicherheitsnetz, nicht die einzige Schutzmaßnahme.",
          ],
        },
      ],
      relatedTopics: [
        "local-servers",
        "internet-vps",
        "workers-and-queues",
      ],
    },
    "choosing-servers": {
      title: "Server passend auswählen",
      summary: "Die passende Serverart folgt aus Aufgabe, Reichweite, Reaktionszeit, Datenschutz und dem Aufwand, den du dauerhaft übernehmen kannst.",
      access: "premium",
      sections: [
        {
          heading: "Wie du auswählst",
          list: [
            "Wähle lokal, wenn Geräte auch ohne Internet zuverlässig funktionieren müssen oder Daten das Gebäude nicht verlassen sollen. Plane Stromausfall, Fernwartung und externe Backups mit ein.",
            "Wähle einen dedizierten Server bei dauerhaft hoher, gut planbarer Last oder wenn spezielle Hardware und maximale Kontrolle nötig sind.",
            "Wähle einen VPS als ausgewogenen Start für öffentlich erreichbare Web-Anwendungen und klar abgegrenzte Dienste. Sichere ihn wie einen eigenen Server ab: Schlüssel statt Passwörter, Updates, Firewall, Backups und Monitoring.",
            "Wähle Cloud-Dienste bei stark schwankender Last, globaler Reichweite oder wenn verwaltete Datenbanken und Speicher den Betriebsaufwand senken sollen. Prüfe vorher Datenschutz, Region, Anbieterbindung und laufende Kosten.",
            "Viele Systeme kombinieren beides: Ein ESP32 oder lokales Gateway reagiert schnell vor Ort; VPS oder Cloud liefern Fernzugriff, Benachrichtigungen, Auswertung und zentrale Datensicherung.",
          ],
        },
        {
          heading: "Mit kleinster sinnvoller Architektur beginnen",
          paragraphs: [
            "Baue keine globale Plattform, wenn ein Gerät mit lokaler Regelung die Aufgabe vollständig löst. Ergänze erst dann Gateway, VPS, Cloud oder App, wenn ein konkreter Nutzen entsteht: mehrere Geräte koordinieren, Fernzugriff anbieten, Daten langfristig auswerten oder Menschen informieren. Jede zusätzliche Komponente schafft auch zusätzlichen Betriebs-, Sicherheits- und Datenschutzaufwand.",
          ],
        },
        {
          heading: "Sicherheit als Auswahlkriterium",
          paragraphs: [
            "Wähle nicht nur nach Leistung und Preis, sondern danach, ob du den verbleibenden Betrieb sicher leisten kannst. Beim eigenen Server kommen Netzwerk und Hardware hinzu; bei dediziertem Server und VPS ist der Softwarebetrieb dein Anteil; in der Cloud werden vor allem Identitäten, Rechte, Daten- und Kostenkontrolle entscheidend. Wenn diese Aufgaben nicht klar verteilt und regelmäßig erfüllt werden können, ist eine kleinere oder stärker verwaltete Lösung oft die bessere Wahl.",
          ],
        },
      ],
      relatedTopics: [
        "local-servers",
        "internet-vps",
        "cloud-services",
        "server-systems",
      ],
    },
};
