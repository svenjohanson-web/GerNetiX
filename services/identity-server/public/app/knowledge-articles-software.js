// Wissensspeicher: Informatik, Software und Datenspeicherung.
const KnowledgeArticlesSoftware = {
    "software-basics-introduction": {
      title: "Was Software ist: von der Idee zum ausführbaren Programm",
      summary: "Software beschreibt, welche Aufgabe ein Gerät erfüllen soll. Je nach Zielsystem wird sie direkt in Maschinencode übersetzt oder mit einer Laufzeitumgebung ausgeführt.",
      access: "premium",
      sections: [
        {
          id: "software-purpose",
          heading: "Warum gibt es Software?",
          paragraphs: [
            "Hardware kann rechnen, speichern, messen und Signale ausgeben. Ohne Software weiß sie aber nicht, welche Aufgabe sie in welcher Reihenfolge erledigen soll. Software macht aus derselben Hardware eine Uhr, eine Wetterstation, eine Musik-App oder einen Server für viele Nutzer.",
            "Sie hält Regeln und Abläufe fest: Was passiert, wenn ein Taster gedrückt wird? Welche Temperatur soll angezeigt werden? Wer darf eine Einstellung ändern? Gute Software übersetzt eine fachliche Aufgabe in eindeutige Schritte, die ein Computer wiederholt und zuverlässig ausführen kann. Sie verändert dabei nicht die physikalischen Eigenschaften eines Widerstands, eines Transistors oder eines fest verdrahteten Logikgatters; sie steuert nur die vorhandenen programmierbaren Teile innerhalb ihrer Grenzen.",
          ],
        },
        {
          id: "software-source-code",
          heading: "Quelltext: Anweisungen für Maschinen",
          paragraphs: [
            "Menschen schreiben Software meist als Quelltext in einer Programmiersprache wie C, C++, Rust, Java, Python oder JavaScript. Dieser Text ist für Menschen lesbar genug, um ihn zu erklären, zu prüfen und zu verändern. Für den Prozessor ist er zunächst noch nicht direkt ausführbar.",
            "Ein Programm besteht nicht nur aus Rechenbefehlen. Es beschreibt auch Daten, Entscheidungen, Wiederholungen, Fehlerfälle und die Zusammenarbeit mit Anzeige, Netzwerk, Speicher oder Sensoren. Das Ergebnis kann eine App, eine Website, Firmware für ein Gerät oder ein Hintergrunddienst sein.",
          ],
        },
        {
          id: "software-compilation",
          heading: "Kompilieren: in Maschinencode übersetzen",
          paragraphs: [
            "Beim Kompilieren übersetzt ein Compiler den Quelltext vor dem Start in Befehle für eine bestimmte Prozessorfamilie. Diese sehr einfachen Befehle heißen Maschinencode. Ein Programm für einen ESP32 enthält daher andere Maschinenbefehle als ein Programm für einen Windows-PC oder ein iPhone.",
            "Oft folgt danach das Linken: Der Linker verbindet den eigenen Code mit benötigten Programmteilen zu einer ausführbaren Datei oder Firmware. Beim Flashen wird diese Firmware in den nichtflüchtigen Speicher des Mikrocontrollers geschrieben. Beim Start kann der Prozessor die Befehle direkt ausführen.",
            "Kompilieren findet nicht nur bei C oder C++ statt. Auch andere Sprachen können vorher oder während der Ausführung in Maschinencode überführt werden. Entscheidend ist: Für die CPU müssen am Ende immer passende Maschinenbefehle entstehen.",
          ],
        },
        {
          id: "software-libraries",
          heading: "Bibliotheken: bewährte Bausteine nutzen",
          paragraphs: [
            "Eine Bibliothek ist ein wiederverwendeter Programmbaustein. Sie kann zum Beispiel eine Anzeige ansteuern, verschlüsselte Netzwerkverbindungen aufbauen, Daten speichern oder eine Schaltfläche darstellen. So muss nicht jedes Projekt dieselben Grundlagen neu schreiben.",
            "Bibliotheken sparen Zeit, bringen aber Verantwortung mit: Sie müssen zum Zielsystem passen, gepflegt und aktualisiert werden und dürfen nicht mehr Speicher oder Rechenzeit verbrauchen, als das Projekt verträgt. Eine Bibliothek ist kein Zauberpaket, sondern Code mit einer klaren Aufgabe und Abhängigkeiten.",
          ],
        },
        {
          id: "software-scripts",
          heading: "Skripte, Interpreter und Laufzeitumgebungen",
          paragraphs: [
            "Ein Skript ist Quelltext, der häufig erst beim Start von einem Interpreter gelesen und ausgeführt wird. Python ist ein typisches Beispiel: Das Python-Programm braucht eine Python-Laufzeitumgebung. JavaScript im Browser braucht eine JavaScript-Engine. Diese Laufzeitumgebung übernimmt viele allgemeine Aufgaben, benötigt aber selbst Speicher und Rechenzeit.",
            "Die Grenze ist in der Praxis fließend. Java und C# werden oft zuerst in einen Zwischencode übersetzt; eine virtuelle Maschine führt ihn aus oder übersetzt häufig genutzte Teile später mit einem Just-in-Time-Compiler in Maschinencode. Moderne JavaScript-Engines tun Ähnliches. 'Interpretiert' heißt also nicht automatisch langsam, sondern beschreibt vor allem, dass zwischen Quelltext und Prozessor noch eine Laufzeitumgebung arbeitet.",
            "Der Vorteil solcher Umgebungen ist oft eine schnelle Entwicklung: Viele Funktionen, gute Diagnosewerkzeuge und dieselbe Anwendung auf verschiedenen Systemen. Der Nachteil ist zusätzlicher Platzbedarf, ein späterer Start und weniger direkte Kontrolle über Ressourcen.",
          ],
        },
        {
          id: "software-embedded",
          heading: "Firmware auf Mikrocontrollern: klein, schnell und berechenbar",
          paragraphs: [
            "Embedded-Software läuft in Geräten mit klarer Aufgabe, etwa in einem Sensor, einer Fernbedienung, einer Maschine oder einem ESP32-Projekt. Dort sind Flash-Speicher, Arbeitsspeicher, Energie und Rechenzeit begrenzt. Deshalb wird Firmware häufig in C, C++ oder Rust kompiliert und direkt als schlanke Firmware ausgeführt.",
            "Ein großer Interpreter wäre für viele Mikrocontroller unnötiger Ballast: Er belegt Speicher, erzeugt zusätzliche Prozessorlast und kann die Antwortzeit schlechter berechenbar machen. Gerade wenn Sensorwerte rechtzeitig verarbeitet, Motoren gesteuert oder Energie gespart werden muss, zählt ein überschaubares und vorhersehbares Programm.",
            "Das ist keine absolute Regel. Es gibt Mikrocontroller mit MicroPython, Lua oder anderen Laufzeitumgebungen, besonders zum Lernen oder für leistungsfähigere Geräte. Für ein dauerhaftes, ressourcenarmes oder zeitkritisches Produkt wird jedoch meist eine direkt kompilierte Firmware gewählt.",
          ],
        },
        {
          id: "software-backend",
          heading: "Backend: Entwicklungsgeschwindigkeit zählt",
          paragraphs: [
            "Ein Backend ist Software, die im Hintergrund läuft: Es verwaltet Daten, prüft Berechtigungen, stellt Schnittstellen bereit oder verarbeitet Nachrichten von Apps und Geräten. Server haben oft deutlich mehr Arbeitsspeicher und Rechenleistung als ein Mikrocontroller. Speicher und Rechenzeit sind dort nicht kostenlos, aber für viele Anwendungen weniger knapp.",
            "Darum sind im Backend Sprachen mit produktiven Laufzeitumgebungen beliebt, zum Beispiel JavaScript mit Node.js, Python, Java oder C#. Sie ermöglichen schnelle Änderungen, umfangreiche Bibliotheken und gute Werkzeuge für Tests, Fehlersuche und Betrieb. Wenn viel Leistung nötig ist, können einzelne Teile gezielt optimiert oder in kompilierten Sprachen umgesetzt werden.",
            "Die passende Entscheidung hängt nicht nur von Geschwindigkeit ab: Zuverlässigkeit, Sicherheit, Teamwissen, Wartbarkeit, Kosten und Antwortzeiten gehören genauso dazu. Ein kleiner Dienst braucht keine komplizierte Hochleistungsarchitektur, aber ein stark belasteter Dienst braucht klare Grenzen und Messwerte.",
          ],
        },
        {
          id: "software-client-devices",
          heading: "PC, Tablet und Smartphone: beide Welten",
          paragraphs: [
            "Auf PC, Tablet und Smartphone existieren beide Welten nebeneinander. Betriebssysteme und anspruchsvolle Teile von Apps sind häufig nativ kompiliert, damit sie schnell und direkt mit Hardware arbeiten können. Gleichzeitig laufen Web-Apps und viele Programme in Browsern, virtuellen Maschinen oder anderen Laufzeitumgebungen.",
            "Eine Smartphone-App kann zum Beispiel einen nativen Teil für Kamera oder Bluetooth haben, eine Web-Oberfläche anzeigen und mit einem JavaScript- oder Dart-Framework entwickelt sein. Ein PC kann ein kompiliertes Spiel, ein Python-Werkzeug und mehrere Browser-Tabs gleichzeitig ausführen. Leistungsfähige Geräte machen diese Mischung möglich.",
            "Für ein Projekt wählst du daher nicht 'kompiliert gegen interpretiert' als Glaubensfrage. Du fragst: Wo läuft die Software? Wie knapp sind Speicher, Energie und Antwortzeit? Wie schnell muss sich das Produkt ändern? Welche Bibliotheken und Kenntnisse stehen zur Verfügung? So kann ein System aus schlanker Embedded-Firmware, einem entwicklungsfreundlichen Backend und einer plattformübergreifenden App bestehen.",
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "server-systems",
        "microcontroller-basics",
        "communication-basics",
      ],
    },
    "yaml-basics": {
      title: "YAML: strukturierte Daten lesbar beschreiben",
      summary: "YAML ist ein textbasiertes Datenformat für Konfigurationen und andere strukturierte Informationen. Seine wenigen Grundregeln sind schnell gelernt – die Einrückung muss jedoch stimmen.",
      access: "premium",
      sections: [
        {
          id: "yaml-purpose",
          heading: "Was YAML ist – und was nicht",
          paragraphs: [
            "YAML beschreibt Daten in einer für Menschen gut lesbaren Textform. Es wird häufig für Konfigurationen, Build-Abläufe, Deployment-Dateien und technische Metadaten verwendet. Eine Anwendung liest die Datei und entscheidet, was die darin enthaltenen Werte bedeuten.",
            "YAML ist keine Programmiersprache. Eine YAML-Datei führt selbst keine Funktionen, Bedingungen oder Schleifen aus. Wenn ein Werkzeug in einer YAML-Konfiguration besondere Ausdrücke erlaubt, ist das eine Erweiterung dieses Werkzeugs und keine allgemeine YAML-Regel.",
            "JSON und YAML können oft dieselbe Datenstruktur ausdrücken. JSON verwendet viele Klammern und Kommas; YAML bildet Hierarchie überwiegend mit Einrückung ab. Das macht YAML kompakt, aber auch empfindlich gegenüber falsch gesetzten Leerzeichen.",
          ],
        },
        {
          id: "yaml-scalars",
          heading: "Schlüssel und einfache Werte",
          paragraphs: [
            "Die kleinste gut lesbare Einheit ist ein Schlüssel mit einem Wert: `name: Pflanzenmonitor`. Hinter dem Doppelpunkt steht normalerweise ein Leerzeichen. Schlüssel sollten verständlich und innerhalb ihres Bereichs eindeutig sein.",
            "Werte können Text, Zahlen, Wahrheitswerte wie `true` und `false` oder ein leerer Wert wie `null` sein. Ein Parser erkennt diese Typen anhand der Schreibweise. Darum ist `port: 4300` eine Zahl, während `port: \"4300\"` Text ist.",
            "Kommentare beginnen mit `#` und werden nicht Teil der Daten. Sie erklären besondere Entscheidungen, sollten aber keine Pflichtinformation verstecken, die das verwendende Werkzeug eigentlich als eigenes Feld prüfen müsste.",
          ],
        },
        {
          id: "yaml-indentation",
          heading: "Einrückung und Verschachtelung",
          paragraphs: [
            "Zusammengehörige Werte werden eingerückt. Unter `sensor:` können zum Beispiel `typ`, `pin` und eine weitere `kalibrierung` stehen. Je tiefer ein Wert eingerückt ist, desto tiefer liegt er in der entstehenden Datenstruktur.",
            "Für die Einrückung werden Leerzeichen verwendet, keine Tabs. Ob ein Projekt zwei oder vier Leerzeichen pro Ebene nutzt, ist weniger wichtig als eine durchgehend konsistente Schreibweise. Ein versehentliches Leerzeichen zu viel kann einen Wert einem anderen Objekt zuordnen oder die Datei ungültig machen.",
            "Einrückung dient deshalb nicht nur der Schönheit. Sie ist Syntax und trägt fachliche Bedeutung.",
          ],
          example: "sensor:\n  typ: bodenfeuchte\n  pin: 34\n  kalibrierung:\n    trocken: 3200\n    nass: 1400",
        },
        {
          id: "yaml-lists",
          heading: "Listen und Objekte kombinieren",
          paragraphs: [
            "Ein Bindestrich beginnt einen Eintrag in einer Liste. Ein einfacher Eintrag kann nur aus einem Wert bestehen. Häufig ist jeder Listeneintrag selbst ein Objekt mit mehreren benannten Eigenschaften.",
            "In einer Aufgabenliste kann ein Eintrag beispielsweise `name: messen` und `alle_sekunden: 60` enthalten. Der nächste Bindestrich auf derselben Ebene beginnt eine neue Aufgabe. Die eingerückten Schlüssel darunter gehören nur zu diesem Listeneintrag.",
            "So lassen sich Objekte, Listen und weitere Unterobjekte beliebig kombinieren. Große Dateien bleiben jedoch nur verständlich, wenn Namen, Ebenen und Verantwortlichkeiten klar geschnitten sind.",
          ],
          example: "aufgaben:\n  - name: messen\n    alle_sekunden: 60\n  - name: warnen\n    unter_prozent: 25",
        },
        {
          id: "yaml-text",
          heading: "Anführungszeichen und mehrzeiliger Text",
          paragraphs: [
            "Einfacher Text braucht oft keine Anführungszeichen. Enthält er jedoch einen Doppelpunkt mit nachfolgendem Leerzeichen, ein Kommentarzeichen oder eine Schreibweise, die wie Zahl oder Wahrheitswert aussieht, machen Anführungszeichen die Absicht eindeutig.",
            "Mit `|` beginnt ein Textblock, der Zeilenumbrüche bewahrt. Mit `>` werden mehrere Quellzeilen zu einem fortlaufenden Absatz gefaltet. Die folgenden Textzeilen müssen jeweils weiter eingerückt sein als der zugehörige Schlüssel.",
            "Anführungszeichen lösen keine fehlerhafte Struktur. Sie sichern nur einen einzelnen Textwert; Einrückung und Datentypen müssen weiterhin zum erwarteten Modell passen.",
          ],
        },
        {
          id: "yaml-errors",
          heading: "Typische Fehler und Validierung",
          paragraphs: [
            "Häufige Fehler sind Tabs, uneinheitliche Einrückung, ein fehlendes Leerzeichen nach dem Doppelpunkt, ein Bindestrich auf der falschen Ebene oder ein unbeabsichtigter Datentyp. Auch doppelte Schlüssel sind gefährlich, weil Werkzeuge sie unterschiedlich behandeln können.",
            "Ein YAML-Parser prüft, ob die Syntax lesbar ist. Das reicht fachlich noch nicht aus: Eine gültige Datei kann einen Pflichtschlüssel vergessen oder einen unbekannten Wert enthalten. Ein Schema oder die Validierung des verwendenden Werkzeugs prüft zusätzlich, ob die Daten die erwartete Form und Bedeutung haben.",
            "Gehe bei einer Fehlermeldung von der genannten Zeile nach oben bis zum Beginn des aktuellen Blocks. Die eigentliche Ursache liegt oft eine Zeile vor der Stelle, an der der Parser nicht mehr weiterweiß.",
          ],
        },
        {
          id: "yaml-learning-project",
          heading: "Im Lernprojekt selbst ausprobieren",
          paragraphs: [
            "Das kostenlose Lernprojekt „YAML-Grundlagen“ führt ohne Hardware durch Schlüssel und Werte, Verschachtelung, Listen, Textblöcke und typische Fehler. Als Abschluss entsteht eine kleine Konfiguration für einen Pflanzenmonitor.",
            "Du findest es nach der Anmeldung im Bereich Lernen unter „YAML-Grundlagen“. Bearbeite die Beispieldatei bewusst in kleinen Schritten: erst einen Wert ändern, dann ein Unterobjekt ergänzen und zuletzt einen Listeneintrag hinzufügen. Erkläre anschließend die resultierende Struktur in eigenen Worten. Wer die Hierarchie erklären kann, hat die wichtigste YAML-Hürde bereits genommen.",
          ],
        },
      ],
      relatedTopics: [
        "software-basics-introduction",
        "databases-and-storage",
        "from-problem-to-system",
      ],
    },
    "databases-and-storage": {
      title: "Datenbanken, Speicher und Dateiserver",
      summary: "Nicht jeder dauerhaft gespeicherte Wert braucht eine Datenbank. Mikrocontroller, Apps und Server haben unterschiedliche Speicherformen, Grenzen und Aufgaben.",
      access: "premium",
      sections: [
        {
          id: "storage-is-not-always-a-database",
          heading: "Speicher ist nicht automatisch eine Datenbank",
          paragraphs: [
            "Persistenz bedeutet zunächst nur, dass Daten einen Neustart oder Stromausfall überstehen. Eine Konfigurationsdatei, ein gespeicherter Schlüssel oder ein Ringpuffer mit Messwerten ist deshalb bereits persistenter Speicher, aber noch keine vollwertige Datenbank.",
            "Eine Datenbank organisiert Daten nach einem Modell und wird durch ein Datenbankmanagementsystem verwaltet. Dieses kann Datensätze suchen, filtern und ändern, Beziehungen oder Indizes pflegen, gleichzeitige Zugriffe koordinieren und Änderungen so absichern, dass nach einem Fehler kein halbfertiger Zustand übrig bleibt. Welche dieser Fähigkeiten nötig sind, hängt von der Aufgabe ab.",
            "SQL ist dabei keine Datenbank, sondern eine Sprache für relationale Datenbanken. SQLite, PostgreSQL, MySQL und MariaDB sind konkrete Datenbanksysteme, die SQL verstehen – mit unterschiedlichen Betriebsmodellen und Stärken.",
          ],
        },
        {
          id: "microcontroller-storage",
          heading: "Was Mikrocontroller lokal speichern können",
          paragraphs: [
            "Ein Mikrocontroller wie der ESP32 kann dauerhaft Daten speichern, obwohl auf ihm normalerweise kein klassischer Datenbankserver läuft. Kleine Einstellungen, WLAN-Konfigurationen, Zähler oder Kalibrierwerte passen in einen Key-Value-Speicher wie NVS. Andere Controller besitzen echtes EEPROM oder bilden eine ähnliche Funktion in Flash-Speicher nach.",
            "Für mehrere Dateien eignen sich eingebettete Dateisysteme wie LittleFS oder FatFS. Darin können zum Beispiel Konfigurationsdateien, kleine Webseiten, Protokolle oder gepufferte Messwerte liegen. Ein festes Binärformat, eine einfache CSV-Datei, ein Ringpuffer oder ein kleines Journal kann für eine klar begrenzte Aufgabe sinnvoller und robuster sein als eine allgemeine Datenbank.",
            "Die Grenzen bleiben wichtig: Flash kann nicht beliebig oft beschrieben werden, RAM und Speicherplatz sind begrenzt, und ein Stromausfall darf keine zentrale Struktur zerstören. Schreibvorgänge werden deshalb gebündelt, über Speicherbereiche verteilt und möglichst atomar ausgeführt. Häufige Messwerte sollten nicht bei jeder Abtastung dauerhaft in dieselbe Flash-Zelle geschrieben werden.",
            "SQLite lässt sich technisch auf einigen leistungsfähigeren Embedded-Systemen oder mit erheblichem Anpassungsaufwand auch sehr klein betreiben. Auf einem typischen Mikrocontroller ohne vollwertiges Betriebssystem und belastbares Dateisystem ist es jedoch selten die beste Standardlösung. Der Mikrocontroller speichert lokal meist Gerätezustand und einen begrenzten Puffer; umfangreiche Abfragen, viele Nutzer und lange Historien gehören auf einen Server oder ein Linux-System.",
          ],
          table: {
            headers: [
              "Mikrocontroller-Speicher",
              "Geeignet für",
              "Wichtige Grenze",
            ],
            rows: [
              [
                "NVS / Key-Value",
                "Einstellungen, Schlüssel, Kalibrierwerte, kleine Zustände",
                "Kein Ersatz für frei abfragbare Tabellen",
              ],
              [
                "EEPROM oder Flash-Emulation",
                "Wenige kleine Werte, die Neustarts überstehen",
                "Begrenzte Schreibzyklen und kleine Kapazität",
              ],
              [
                "LittleFS / FatFS",
                "Dateien, kleine Webseiten, Protokolle und Datenpuffer",
                "Anwendung muss Format, Konsistenz und Suche selbst beherrschen",
              ],
              [
                "Ringpuffer / Journal",
                "Begrenzte Messwerthistorie und Offline-Puffer",
                "Ältere Einträge werden bewusst überschrieben oder übertragen",
              ],
            ],
          },
        },
        {
          id: "sql-and-sqlite",
          heading: "SQL, SQLite und relationale Server-Datenbanken",
          paragraphs: [
            "Relationale Datenbanken speichern strukturierte Datensätze in Tabellen. Primärschlüssel identifizieren Zeilen, Fremdschlüssel verbinden fachlich zusammengehörige Tabellen, Indizes beschleunigen Suchen und Transaktionen fassen mehrere Änderungen zu einem zuverlässigen Ganzen zusammen. SQL formuliert Abfragen und Änderungen an diesem Modell.",
            "SQLite ist eine echte relationale SQL-Datenbank, aber kein eigener Datenbankserver. Die Datenbank liegt normalerweise in einer Datei, und die Anwendung bindet die SQLite-Bibliothek direkt ein. Das ist hervorragend für lokale Programme, Desktop-Apps, mobile Apps, Entwicklungswerkzeuge und kleinere Server mit überschaubarer gleichzeitiger Schreiblast.",
            "PostgreSQL, MySQL und MariaDB laufen dagegen als eigene Serverprozesse. Anwendungen verbinden sich über das Netzwerk oder einen lokalen Socket. Solche Systeme verwalten viele parallele Verbindungen, Benutzer und Berechtigungen, Replikation sowie umfangreiche Betriebs- und Diagnosefunktionen. Dafür brauchen sie Installation, Updates, Überwachung und Backups.",
          ],
          table: {
            headers: [
              "System",
              "Betriebsart",
              "Typische Verwendung",
            ],
            rows: [
              [
                "SQLite",
                "Eingebettete Bibliothek, meist eine lokale Datenbankdatei",
                "Lokale Anwendung, einzelner Dienst, Edge- oder Desktop-Software",
              ],
              [
                "PostgreSQL",
                "Eigenständiger Datenbankserver",
                "Komplexe Fachmodelle, viele Nutzer, hohe Datenintegrität, Erweiterungen",
              ],
              [
                "MySQL / MariaDB",
                "Eigenständiger Datenbankserver",
                "Webanwendungen, Content-Systeme und klassische Serverdienste",
              ],
            ],
          },
        },
        {
          id: "database-families",
          heading: "Weitere Datenbankarten",
          paragraphs: [
            "Nicht jedes Problem passt am besten in Tabellen. NoSQL ist ein Sammelbegriff für mehrere Modelle und bedeutet nicht automatisch schneller oder besser. Die Datenform, Abfragen, Konsistenzanforderungen und der Betrieb entscheiden.",
            "Viele Produkte verbinden mehrere Fähigkeiten. PostgreSQL kann neben relationalen Tabellen auch JSON, Volltextsuche, Zeitreihenerweiterungen oder Vektoren verwalten. Eine zusätzliche Spezialdatenbank lohnt sich erst, wenn ihr Vorteil den zusätzlichen Betrieb wirklich rechtfertigt.",
          ],
          table: {
            headers: [
              "Datenbankart",
              "Beispiele",
              "Passt besonders zu",
            ],
            rows: [
              [
                "Dokumentendatenbank",
                "MongoDB, CouchDB",
                "JSON-ähnliche Dokumente mit flexibler Struktur",
              ],
              [
                "Key-Value-Datenbank",
                "Redis",
                "Sehr schneller Zugriff über einen Schlüssel, Cache und kurzlebige Zustände",
              ],
              [
                "Zeitreihendatenbank",
                "InfluxDB, TimescaleDB",
                "Zeitgestempelte Messwerte, Verdichtung und Zeitfenster",
              ],
              [
                "Graphdatenbank",
                "Neo4j",
                "Beziehungen und Pfade zwischen stark vernetzten Objekten",
              ],
              [
                "Vektordatenbank / Vektorsuche",
                "pgvector, Milvus",
                "Ähnlichkeitssuche für Embeddings, Texte, Bilder oder KI-Kontext",
              ],
            ],
          },
        },
        {
          id: "file-and-object-storage",
          heading: "Dateiserver und Objektspeicher",
          paragraphs: [
            "Ein Dateiserver stellt Dateien und Ordner für andere Geräte bereit, zum Beispiel über SMB, NFS, WebDAV oder SFTP. Er eignet sich für Dokumente, Bilder, Backups, Firmware-Artefakte und gemeinsam genutzte Verzeichnisse. Er ist keine relationale Datenbank: Eine Anwendung kann Dateien öffnen, muss deren fachlichen Inhalt und Beziehungen aber selbst verstehen.",
            "Objektspeicher verwaltet Dateien oder Binärdaten als Objekte über eine API, häufig nach dem S3-Prinzip. Statt eines gemeinsam eingebundenen Ordnerbaums verwendet die Anwendung Objektschlüssel, Metadaten und Zugriffsregeln. Das passt gut zu großen Mengen unveränderlicher Bilder, Videos, Builds oder Backups.",
            "In vielen Systemen arbeiten Datenbank und Datei- oder Objektspeicher zusammen. Die Datenbank enthält zum Beispiel Eigentümer, Status, Version und Zugriffsrecht; der Objektspeicher enthält die große Firmware- oder Bilddatei. Große Dateien ungeprüft in Datenbanktabellen abzulegen oder wichtige Fachmetadaten nur aus Dateinamen abzuleiten, macht Betrieb und Suche unnötig schwer.",
          ],
        },
        {
          id: "choosing-data-storage",
          heading: "Den passenden Speicher auswählen",
          paragraphs: [
            "Beginne mit der kleinsten Speicherform, die Datenmenge, Lebensdauer, Abfragen und Fehlerfälle sicher erfüllt. Entscheidend ist nicht der bekannteste Produktname, sondern wo die Daten entstehen, wer sie gleichzeitig nutzt, wie lange sie erhalten bleiben und wie sie gesichert oder wiederhergestellt werden.",
            "Ein Mikrocontroller darf lokal sicherheitsrelevante Konfiguration und einen Offline-Puffer besitzen. Er sollte aber nicht zum weltweit erreichbaren Datenbank- oder Dateiserver gemacht werden. Zentrale Konten, projektübergreifende Historien oder Fernzugriff benötigen eine autorisierte Serverkomponente; deren Datenbank ist eine Softwareeigenschaft dieses Servers und keine eigenständige Gerätekomponente.",
          ],
          table: {
            headers: [
              "Aufgabe",
              "Meist passende Lösung",
              "Beispiel",
            ],
            rows: [
              [
                "Wenige Geräteeinstellungen",
                "NVS, EEPROM oder kleiner Key-Value-Speicher",
                "WLAN-Modus, Kalibrierung, letzter sicherer Zustand",
              ],
              [
                "Kurzer Offline-Puffer auf dem Gerät",
                "Ringpuffer oder Datei in LittleFS / FatFS",
                "Messwerte bis zur nächsten Verbindung",
              ],
              [
                "Lokale App mit strukturierten Daten",
                "SQLite",
                "Desktop-Werkzeug oder lokale Home-Server-Anwendung",
              ],
              [
                "Viele Nutzer und gleichzeitige Zugriffe",
                "PostgreSQL, MySQL oder MariaDB",
                "Webplattform, Konten und Projektverwaltung",
              ],
              [
                "Große Dateien und Artefakte",
                "Dateiserver oder Objektspeicher plus Metadaten in einer Datenbank",
                "Bilder, Firmware, Exporte und Backups",
              ],
              [
                "Spezialisierte Abfragen",
                "Gezielt gewählte Zeitreihen-, Graph- oder Vektorlösung",
                "Telemetrie, Beziehungsanalyse oder Ähnlichkeitssuche",
              ],
            ],
          },
        },
        {
          id: "storage-learning-path",
          heading: "Kleine Lernprojekte: vom Wert zur Datenbank",
          paragraphs: [
            "Die sinnvollste Lernreihenfolge beginnt nicht mit einem Produktnamen. Zuerst modellierst du Daten im Arbeitsspeicher: einzelne Werte, Listen, Datensätze, eindeutige IDs und Beziehungen. Danach speicherst du dasselbe Modell mit zunehmend mächtigeren Techniken. So erkennst du, welche Arbeit der Speicher übernimmt und welche Verantwortung weiterhin in deiner Software bleibt.",
            "Die Projekte sind bewusst klein und können einzeln gebaut werden. Zusammen ergeben sie eine Lernreihe: Das Mini-Inventar aus dem ersten Projekt kann später auf dem ESP32 konfiguriert, als Datei exportiert, in SQLite abgefragt und schließlich um echte Dateien ergänzt werden. Jeder Schritt besitzt einen sichtbaren Test nach einem Neustart.",
            "Ein eigener Redis- oder WebDAV-Server ist für den Einstieg nicht nötig. Das NVS-Projekt vermittelt bereits das Key-Value-Prinzip. WebDAV ist eine optionale Erweiterung des Dateiarchivs, wenn der Unterschied zwischen einer eigenen HTTP-API und einem standardisierten Dateizugriff untersucht werden soll.",
          ],
          table: {
            headers: [
              "Stufe",
              "Kleines Projekt",
              "Was du dabei lernst",
              "Fertig, wenn …",
            ],
            rows: [
              [
                "1 · Daten verstehen",
                "Werkstatt-Inventar im Arbeitsspeicher",
                "Datentypen, Listen, Objekte, IDs, Suchen, Sortieren und Beziehungen",
                "Bauteile können angelegt, gezählt, gesucht und einem Lagerplatz zugeordnet werden",
              ],
              [
                "2 · Key-Value auf dem Gerät",
                "ESP32-Einstellungswächter mit NVS oder EEPROM",
                "Schlüssel und Werte, Standardwerte, Validierung, Versionierung und begrenzte Schreibzyklen",
                "Modus, Grenzwert und Zähler bleiben nach Ausschalten erhalten; ungültige Werte fallen sicher zurück",
              ],
              [
                "3 · Dateien auf dem Gerät",
                "LittleFS-Messwertlogbuch",
                "Dateien, CSV oder JSON, Anhängen, Ringpuffer, Speichergrenzen und beschädigte Einträge",
                "Konfiguration und letzte Messwerte überstehen einen Neustart und alte Daten werden kontrolliert begrenzt",
              ],
              [
                "4 · Relationale Daten",
                "SQLite-Pflanzen- oder Bücherinventar",
                "Tabellen, Primär- und Fremdschlüssel, CRUD, Abfragen, Indizes und Transaktionen",
                "Eine Historie lässt sich filtern und eine zusammengehörige Änderung wird vollständig oder gar nicht gespeichert",
              ],
              [
                "5 · Daten plus Dateien",
                "Lokales Projektarchiv mit SQLite-Metadaten",
                "Trennung von Fachmetadaten und Binärdateien, Pfade, Prüfsummen, Versionen und Backup",
                "Dateien bleiben im Dateispeicher auffindbar und ihre Metadaten können in SQLite gesucht werden",
              ],
            ],
          },
          learningProjects: [
            {
              model: "Lernprojekt · Datenstrukturen",
              title: "Werkstatt-Inventar im Arbeitsspeicher",
              description: "Modelliere Bauteile, Mengen und Lagerplätze zuerst ohne Datenbank und lerne den Unterschied zwischen Wert, Datensatz, Liste und Beziehung.",
              href: "/app/learn/?catalog=storage-learning-story&lesson=development_lesson.storage.data_structures",
            },
            {
              model: "Lernprojekt · Mikrocontroller",
              title: "ESP32-Einstellungswächter mit NVS oder EEPROM",
              description: "Speichere wenige geprüfte Einstellungen dauerhaft und untersuche Neustart, Standardwerte, Formatversion und Flash-Schonung.",
              href: "/app/learn/?catalog=storage-learning-story&lesson=development_lesson.storage.nvs",
            },
            {
              model: "Lernprojekt · Mikrocontroller",
              title: "LittleFS-Messwertlogbuch",
              description: "Lege Konfiguration und eine begrenzte Messwerthistorie als Dateien ab und mache Speichergrenzen sowie Fehlerfälle sichtbar.",
              href: "/app/learn/?catalog=storage-learning-story&lesson=development_lesson.storage.littlefs",
            },
            {
              model: "Lernprojekt · Datenbank",
              title: "SQLite-Pflanzeninventar",
              description: "Verbinde Pflanzen, Standorte und Pflegeereignisse in relationalen Tabellen und beantworte Fragen mit SQL.",
              href: "/app/learn/?catalog=storage-learning-story&lesson=development_lesson.storage.sqlite",
            },
            {
              model: "Lernprojekt · Server",
              title: "Lokales Projektarchiv mit SQLite-Metadaten",
              description: "Speichere Dateien getrennt von ihren suchbaren Metadaten; WebDAV kann später als freiwilliger Zugriffsweg ergänzt werden.",
              href: "/app/learn/?catalog=storage-learning-story&lesson=development_lesson.storage.file_archive",
            },
          ],
        },
      ],
      relatedTopics: [
        "software-basics-introduction",
        "microcontroller-basics",
        "local-servers",
        "server-systems",
      ],
    },
    "workers-and-queues": {
      title: "Worker, Queues und Hintergrundaufgaben",
      summary: "Worker erledigen Aufgaben außerhalb der direkten Benutzeranfrage. Sie entkoppeln Systeme, brauchen aber klare Grenzen für Zeit, Menge und Wiederholungen.",
      access: "premium",
      sections: [
        {
          heading: "Was ein Worker ist",
          paragraphs: [
            "Ein Worker ist ein Hintergrundprozess: Er bearbeitet Aufgaben, die nicht sofort in einer Webseite oder App fertig sein müssen. Beispiele sind das Versenden einer Benachrichtigung, das Umwandeln eines Bildes, die Auswertung einer Messreihe oder das Erzeugen eines Berichts.",
            "Eine Queue ist eine Warteschlange für solche Aufgaben. Die Anwendung legt eine Aufgabe ab; ein oder mehrere Worker holen sie ab und verarbeiten sie. Damit bleibt die direkte Bedienung schnell, auch wenn die Hintergrundarbeit länger dauert.",
          ],
        },
        {
          heading: "Warum das Konzept wichtig ist",
          list: [
            "Entkopplung: Ein Fehler oder eine langsame externe Schnittstelle blockiert nicht automatisch die Benutzeroberfläche.",
            "Skalierung: Bei mehr Aufgaben können kontrolliert weitere Worker arbeiten.",
            "Zuverlässigkeit: Aufgaben lassen sich nachvollziehbar speichern, begrenzt wiederholen oder in eine Fehlerwarteschlange verschieben.",
            "Reihenfolge: Nicht jede Aufgabe darf parallel laufen. Für ein einzelnes Gerät oder Konto kann eine definierte Reihenfolge wichtig sein.",
          ],
        },
        {
          heading: "Sichere Grenzen für Hintergrundarbeit",
          list: [
            "Jede Aufgabe erhält ein Timeout, eine maximale Anzahl von Wiederholungen und eine eindeutige Abbruchbedingung.",
            "Die Queue und die Anzahl paralleler Worker werden begrenzt. Sonst kann ein Fehler zu einer Kosten- oder Lastspirale werden.",
            "Fehlgeschlagene Aufgaben werden sichtbar gemacht und untersucht, statt sie unendlich erneut auszuführen.",
            "Eine Aufgabe muss möglichst idempotent sein: Wird sie nach einem Fehler erneut gestartet, darf sie nicht ungewollt doppelt buchen, schalten oder benachrichtigen.",
          ],
        },
        {
          heading: "Bezug zu GerNetiX",
          paragraphs: [
            "Im Wissensportal bleibt dieses Modell bewusst allgemein. Die Hilfe erklärt anschließend, wie Ereignis-Worker und der Ereignis-Dispatcher innerhalb eines GerNetiX-Projekts eingerichtet und begrenzt werden.",
          ],
        },
      ],
      relatedTopics: [
        "event-worker-rules",
        "event-dispatcher",
        "server-systems",
      ],
    },
};
