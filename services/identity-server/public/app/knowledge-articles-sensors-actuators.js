// Wissensspeicher: Sensorik und Aktorik.
const KnowledgeArticlesSensorsActuators = {
    "sensors": {
      title: "Sensoren",
      summary: "Sensoren übersetzen Eigenschaften der realen Welt in elektrische Signale. Erst die passende Messschaltung und Auswertung machen daraus einen verlässlichen Messwert.",
      access: "premium",
      sections: [
        {
          id: "sensor-from-analog-to-digital",
          heading: "Wie ein kontinuierliches Sensorsignal digital wird",
          paragraphs: [
            "Viele Messgrößen der realen Welt sind kontinuierlich: Die Temperatur kann sich jederzeit ändern und zwischen 20 °C und 21 °C jeden Zwischenwert annehmen. Liefert ein Sensor dazu beispielsweise eine Spannung, ist auch dieses analoge Signal zeitkontinuierlich und wertkontinuierlich: Es existiert jederzeit und kann innerhalb seines Bereichs jeden Zwischenwert annehmen.",
            "Ein Mikrocontroller kann ein solches Signal nicht ununterbrochen speichern und rechnen. Sein Analog-Digital-Wandler (ADC) misst deshalb nur zu einzelnen Zeitpunkten – etwa alle 10 Millisekunden. Das heißt Abtastung: Aus dem zeitkontinuierlichen Signal wird eine Folge von Messzeitpunkten, also ein zeitdiskretes Signal.",
            "An jedem Messzeitpunkt ordnet der ADC die gemessene Spannung einer von endlich vielen Zahlenstufen zu. Das heißt Quantisierung. Ein 12-Bit-ADC unterscheidet zum Beispiel 4096 Stufen, von 0 bis 4095. Danach ist der Messwert nicht nur zeitdiskret, sondern auch wertdiskret: Der Computer arbeitet mit einer zeit- und wertdiskreten Zahlenfolge. Wie oft abgetastet werden muss und warum zu seltenes Abtasten täuschen kann, behandelt das Kapitel Abtastrate und Shannon-Theorem.",
            "Bei einer einfachen Ja-Nein-Frage genügt häufig ein digitaler Eingang oder ein Komparator. Er vergleicht die Spannung mit einer Schaltschwelle und erzeugt daraus nur zwei Zustände: logisch 0 oder logisch 1. Ein Taster, ein Endschalter oder ein digitaler Näherungssensor kann so ohne ADC abgefragt werden. Für eine Temperatur von 23,4 °C braucht man dagegen mehrere Zahlenstufen und damit eine Messung mit ADC oder einen Sensor, der den Messwert bereits digital liefert.",
          ],
          table: {
            headers: ["Schritt", "Beispiel Temperatursensor", "Ergebnis"],
            rows: [
              ["Reale Größe", "Temperatur verändert sich fortlaufend.", "zeit- und wertkontinuierlich"],
              ["Sensorsignal", "Der Sensor erzeugt dazu eine passende Spannung.", "zeit- und wertkontinuierlich"],
              ["Abtastung", "Der ADC misst etwa alle 10 Millisekunden.", "zeitdiskrete Messzeitpunkte"],
              ["Quantisierung", "Jede Messung wird einer ADC-Zahl, zum Beispiel 0 bis 4095, zugeordnet.", "zeit- und wertdiskrete Zahlenfolge"],
            ],
          },
        },
        {
          id: "sensor-types",
          heading: "Sensoren nach Messgröße und Wirkprinzip ordnen",
          paragraphs: [
            "Sensoren lassen sich auf zwei Arten beschreiben. Die Messgröße sagt, was erfasst wird – zum Beispiel Position, Abstand, Temperatur, Licht, Beschleunigung, Druck oder Feuchte. Das Wirkprinzip sagt, wie daraus ein elektrisches Signal entsteht – zum Beispiel mechanisch, magnetisch, optisch, akustisch, kapazitiv, induktiv, resistiv, piezoelektrisch oder elektrochemisch.",
            "Diese Trennung ist wichtig, weil dieselbe Aufgabe mit verschiedenen Wirkprinzipien gelöst werden kann. Abstand lässt sich etwa mit Infrarotlicht, Ultraschall oder Radar messen. Umgekehrt kann dasselbe Wirkprinzip mehreren Aufgaben dienen: Ein Hall-Sensor kann einen Magneten erkennen, Drehzahl zählen oder Strom berührungslos erfassen.",
            "Analoge Sensoren liefern beispielsweise Widerstand, Spannung, Strom oder Frequenz. Digitale Sensoren bereiten den Messwert bereits auf und übertragen ihn über I²C, SPI, UART, 1-Wire oder einen Schaltausgang. Unabhängig vom Ausgang zählen Messbereich, Auflösung, Genauigkeit, Wiederholbarkeit, Reaktionszeit, Drift, Umgebung, Energiebedarf und mögliche Fehlerbilder.",
          ],
          table: {
            headers: [
              "Messgröße oder Aufgabe",
              "Typische Wirkprinzipien",
            ],
            rows: [
              [
                "Position, Endlage, Anwesenheit",
                "Mechanischer Kontakt, Reed, Hall, induktiv, kapazitiv, optisch, Encoder",
              ],
              [
                "Abstand und Annäherung",
                "Infrarot-Reflexion, optische Laufzeitmessung, Ultraschall, Radar, LiDAR",
              ],
              [
                "Temperatur",
                "NTC, PTC, Widerstandsthermometer, Thermoelement, Halbleiter-IC",
              ],
              [
                "Bewegung und Orientierung",
                "Beschleunigungssensor, Gyroskop, Magnetometer, PIR",
              ],
              [
                "Kraft, Gewicht und Druck",
                "Dehnungsmessstreifen, piezoresistiv, kapazitiv, piezoelektrisch",
              ],
              [
                "Umwelt und Stoffe",
                "Feuchte, Luftdruck, Gase, Partikel, Schall, elektrochemische Messzellen",
              ],
              [
                "Füllstand und Durchfluss",
                "Schwimmer, Druck, kapazitiv, Ultraschall, Radar, Turbine, thermisch",
              ],
              [
                "Elektrische Größen",
                "Shunt, Hall-Effekt, Stromwandler, Spannungsteiler, isolierter Messverstärker",
              ],
            ],
          },
        },
        {
          id: "sensor-position-presence",
          heading: "Positions-, Endlagen- und Anwesenheitssensoren",
          paragraphs: [
            "Die bisher betrachteten Bauteile gehören überwiegend in diese Familie. Ein Reed-Kontakt erkennt einen Magneten, ein Endschalter wird mechanisch betätigt und ein induktiver Näherungssensor erkennt ein Metallziel. Sie liefern meist keinen Weg in Millimetern, sondern eine Aussage wie „Ziel vorhanden“ oder „Endlage erreicht“.",
            "Eine Lichtschranke ist zunächst ein Anwesenheitssensor: Sie erkennt, ob ihr Lichtweg frei oder unterbrochen ist. Erst durch die festgelegte Einbauposition wird dieses Ereignis zur Positions- oder Endlageninformation. Für eine kontinuierliche Position oder einen Drehwinkel sind Potentiometer, magnetische Winkelsensoren, Drehgeber sowie lineare oder optische Messsysteme geeigneter.",
            "Auch kapazitive Näherungssensoren gehören hierher. Sie reagieren auf die Änderung eines elektrischen Feldes und können neben Metall auch viele nichtmetallische Stoffe erkennen. Feuchte, Ablagerungen und die Einbausituation können ihre Schaltschwelle jedoch beeinflussen.",
          ],
          table: {
            headers: [
              "Sensor",
              "Typische Aussage",
              "Besondere Stärke",
            ],
            rows: [
              [
                "Reed- oder Hall-Sensor",
                "Magnet vorhanden oder Magnetposition erreicht",
                "Berührungslos und gut gekapselt realisierbar",
              ],
              [
                "Mechanischer Endschalter",
                "Mechanische Endlage tatsächlich betätigt",
                "Direkte und leicht nachvollziehbare Rückmeldung",
              ],
              [
                "Induktiver Näherungssensor",
                "Metallziel im Schaltbereich",
                "Robust und berührungslos in Industrieumgebungen",
              ],
              [
                "Kapazitiver Näherungssensor",
                "Material verändert das elektrische Feld",
                "Erkennt auch viele nichtmetallische Materialien",
              ],
              [
                "Lichtschranke",
                "Lichtweg frei oder unterbrochen",
                "Schnelle berührungslose Anwesenheitserkennung",
              ],
              [
                "Encoder oder Längenmesssystem",
                "Winkel, Weg oder Positionsänderung",
                "Viele aufeinanderfolgende Positionswerte statt nur eines Schaltpunkts",
              ],
            ],
          },
        },
        {
          id: "sensor-reed-contact",
          heading: "Reed-Kontakt: Schalten mit einem Magneten",
          paragraphs: [
            "Ein Reed-Kontakt besteht aus zwei ferromagnetischen Kontaktzungen in einem hermetisch geschlossenen Glaskörper. Nähert sich ein Magnet, werden die Zungen magnetisiert und schließen oder öffnen den Stromkreis. An einer Tür sitzt deshalb meist der Reed-Kontakt am festen Rahmen und der Magnet am bewegten Teil.",
            "Für einen Mikrocontroller ist ein Reed-Kontakt ein einfacher digitaler Eingang. Er benötigt für das eigentliche Schließen des Kontakts keine eigene Versorgung, braucht aber eine passende Eingangsschaltung, meist mit Pull-up oder Pull-down. Wie bei mechanischen Kontakten können kurze Prellimpulse auftreten; Software oder ein kleines Filter muss den Zustand deshalb für eine kurze Zeit stabil bestätigen.",
          ],
          table: {
            headers: [
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Berührungslos betätigt; kein offen liegender Schaltkontakt; sehr geringer Energiebedarf; gekapselte Kontakte sind gut gegen die Umgebung geschützt; für Tür- und Positionsabfragen bewährt.",
                "Magnet und Kontakt müssen mit passendem Abstand und passender Orientierung montiert sein; ein loser Magnet führt zu falschen Zuständen; der nackte Glaskörper ist mechanisch empfindlich; Schaltstrom und Spannung sind begrenzt.",
              ],
            ],
          },
        },
        {
          id: "sensor-photoelectric",
          heading: "Lichtschranke: Eine unterbrochene Lichtstrecke erkennen",
          paragraphs: [
            "Eine Lichtschranke erkennt, ob Licht vom Sender zum Empfänger gelangt. Bei einer Einweg-Lichtschranke stehen sich Sender und Empfänger gegenüber. Unterbricht ein Objekt den Strahl, ändert sich das Ausgangssignal. Andere Bauformen arbeiten mit einem Reflektor oder werten das vom Objekt zurückgeworfene Licht aus.",
            "Die Lichtschranke arbeitet berührungslos und kann über größere Abstände erkennen. Für eine Tür-Endlage muss der Strahl jedoch so angeordnet sein, dass wirklich die Tür oder ein festes Zielstück erkannt wird – nicht zufällig ein Tier, ein Flügel, ein Blatt oder ein anderes Objekt.",
          ],
          table: {
            headers: [
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Berührungslos und damit ohne mechanischen Verschleiß am Messpunkt; größere Erfassungsabstände möglich; viele Materialien lassen sich erkennen; die Position kann ohne Magnet bestimmt werden.",
                "Staub, Federn, Spinnweben, Schlamm oder Kondenswasser können Sender, Empfänger oder Reflektor verdecken; Sender und Empfänger müssen ausgerichtet bleiben; Fremdlicht und ungeeignete Oberflächen können die Erkennung erschweren; benötigt Energie und meist mehr Verdrahtung.",
              ],
            ],
          },
        },
        {
          id: "sensor-limit-switch",
          heading: "Mechanischer Endschalter: Die Endlage direkt betätigen",
          paragraphs: [
            "Der korrekte Fachbegriff ist mechanischer Endschalter oder Positionsschalter. Im Inneren sitzt häufig ein Mikroschalter; außen überträgt ein Stößel, Hebel oder Rollenhebel die Bewegung. Erreicht die Tür die Endlage, drückt ein festes Betätigungsteil den Schalter.",
            "Ein industrieller Endschalter ist nicht dasselbe wie ein ungeschützter kleiner Taster. Geeignete Gehäuse und Dichtungen können den inneren Kontakt gegen Wasser, Öl, Staub und Schmutz schützen. Trotzdem bleibt die Betätigung mechanisch: Weg, Kraft, Überlaufweg und die sichere Rückstellung müssen zur Konstruktion passen.",
          ],
          table: {
            headers: [
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Direkte und leicht verständliche Bestätigung der physischen Endlage; einfaches digitales Signal; viele Betätigerformen; gekapselte Industrievarianten können mechanisch und gegenüber der Umgebung sehr robust sein.",
                "Betätiger und Mechanik werden belastet und können verschleißen; falscher Überlaufweg kann den Schalter beschädigen; Schlamm, Eis oder Fremdkörper können die Bewegung blockieren; die Tür muss den Schalter zuverlässig erreichen und mit passender Kraft betätigen.",
              ],
            ],
          },
        },
        {
          id: "sensor-contact-bridge",
          heading: "Leitende Kontaktbrücke: Zwei Metallflächen direkt verbinden",
          paragraphs: [
            "Die vorgeschlagene Lösung mit zwei Metallstiften und einem Metallblatt ist eine leitende Kontaktbrücke. In der Endlage verbindet das Metallblatt beide Kontakte; der Mikrocontroller erkennt den geschlossenen Stromkreis. Das Prinzip ist elektrisch einfach und kann in einem Versuchsaufbau anschaulich sein.",
            "Für eine dauerhaft zuverlässige Außenanwendung sind offen liegende Kontakte jedoch kritisch. Feuchtigkeit, Stallstaub, Schmutz, Oxidation und Korrosion verändern den Kontaktwiderstand. Das Metallblatt kann nur teilweise aufliegen, die Flächen können sich abnutzen oder leitfähiger Schmutz kann einen falschen Kontakt herstellen. Ohne gekapselte, korrosionsbeständige und selbstreinigende Konstruktion ist diese Variante deshalb eher ein Lernversuch als eine robuste Endlagenerkennung.",
          ],
          table: {
            headers: [
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Sehr einfach zu verstehen; wenige Bauteile; preiswert; Endlage wird unmittelbar durch elektrischen Kontakt bestätigt.",
                "Offene Kontaktflächen sind anfällig für Schmutz, Feuchtigkeit, Oxidation und Korrosion; Kontaktwiderstand kann schwanken; mechanische Ausrichtung und Anpressdruck sind nötig; Kurzschluss- und Fehlkontaktpfade müssen begrenzt werden.",
              ],
            ],
          },
        },
        {
          id: "sensor-inductive",
          heading: "Weiterdenken: Induktiver Näherungssensor",
          paragraphs: [
            "Wenn ein Metallziel erkannt werden soll, ist ein induktiver Näherungssensor eine berührungslose Alternative zur offenen Kontaktbrücke. Er erkennt ein Metallstück, ohne es elektrisch zu berühren. Dadurch gibt es an der Messstelle keinen offenen Schaltkontakt und keinen mechanischen Kontaktverschleiß.",
            "Induktive Sensoren können in schmutziger Umgebung sehr robust sein, benötigen aber eine Versorgung, eine passende Ausgangsschaltung und ein Metallziel innerhalb ihres begrenzten Schaltabstands. Sie sind meist teurer und größer als ein Reed-Kontakt. Für ein Lernprojekt sind sie eine gute Erinnerung daran, dass dieselbe fachliche Aufgabe mit unterschiedlichen physikalischen Prinzipien gelöst werden kann.",
          ],
        },
        {
          id: "sensor-chicken-door-task",
          heading: "Denkaufgabe: Endlagen einer automatischen Hühnerklappe",
          paragraphs: [
            "Eine motorisierte Hühnerklappe soll zuverlässig melden, ob sie vollständig geöffnet oder vollständig geschlossen ist. Der Sensor sitzt in einem Stall: Staub, Federn, Spinnweben, Feuchtigkeit und gelegentlicher Schlamm sind realistische Einflüsse. Die Lösung soll langlebig sein und möglichst wenig Wartung benötigen.",
            "Vergleiche Reed-Kontakt, Lichtschranke, mechanischen Endschalter und leitende Kontaktbrücke. Du darfst zusätzlich einen induktiven Näherungssensor mit Metallziel berücksichtigen. Entscheide nicht nur nach dem Kaufpreis, sondern begründe deine Wahl aus dem Wirkprinzip und den Randbedingungen.",
          ],
          list: [
            "Welches Prinzip würdest du für die vollständig geöffnete Endlage wählen – und warum?",
            "Welches Prinzip würdest du für die vollständig geschlossene Endlage wählen? Würdest du bewusst zweimal denselben Sensortyp einsetzen?",
            "Welche Lösung ist gegenüber Staub, Federn und Spinnweben am unempfindlichsten?",
            "Was passiert bei einem verrutschten Magneten, einem verdeckten Lichtweg, einem klemmenden Schalter oder korrodierten Kontakten?",
            "Welcher Fehler könnte fälschlich „Tür geschlossen“ melden? Wie müsste die Steuerung reagieren, wenn beide Endlagen gleichzeitig aktiv oder beide über längere Zeit inaktiv sind?",
            "Wie würdest du Sensor, Kabel und Befestigung montieren, damit ein Huhn sie nicht beschädigt und die Tür trotzdem sicher stoppen kann?",
          ],
        },
        {
          id: "sensor-selection-games",
          heading: "Frage-Antwort-Spiele: Welcher Sensor passt?",
          paragraphs: [
            "Wähle zuerst selbst eine Antwort. Danach kannst du prüfen, welches Prinzip unter den genannten Randbedingungen am besten passt. In einem echten Projekt muss anschließend immer ein konkretes Datenblatt gegen Genauigkeit, Schutzart, Temperatur, Schaltabstand und Lebensdauer geprüft werden.",
          ],
          quizzes: [
            {
              id: "cnc-reference",
              title: "CNC-Maschine: reproduzierbare Referenzfahrt",
              situation: "Eine CNC-Achse fährt bei jeder Referenzfahrt aus derselben Richtung langsam auf ihren Referenzpunkt zu. Metallspäne und Kühlschmierstoff sind möglich. Das Signal soll verschleißfrei und sehr gut wiederholbar sein.",
              question: "Welches der bisher vorgestellten Prinzipien ist für das robuste Referenzsignal die naheliegendste Wahl?",
              answer: "inductive",
              options: [
                {
                  id: "reed",
                  label: "Reed-Kontakt mit Magnet",
                },
                {
                  id: "photoelectric",
                  label: "Offene Lichtschranke",
                },
                {
                  id: "limit",
                  label: "Einfacher ungekapselter Endschalter",
                },
                {
                  id: "inductive",
                  label: "Industriegeeigneter induktiver Näherungssensor mit Metallfahne",
                },
                {
                  id: "bridge",
                  label: "Offene leitende Kontaktbrücke",
                },
              ],
              correctText: "Für das robuste Referenzsignal ist hier ein geeigneter induktiver Näherungssensor mit Metallfahne die naheliegende Wahl.",
              wrongText: "Prüfe noch einmal, welches Prinzip berührungslos arbeitet und in Varianten für Metallspäne sowie Kühlschmierstoff ausgelegt ist.",
              explanation: "Induktive Sensoren erkennen ein Metallziel berührungslos und sind in öl- und schmutzbeständigen Industrieausführungen erhältlich. Hohe Wiederholgenauigkeit entsteht trotzdem nicht allein durch das Wort „induktiv“: Schaltabstand, Hysterese, Temperaturdrift, Einbaulage und immer gleiche langsame Anfahrrichtung müssen spezifiziert werden. Für die eigentliche hochgenaue Achsposition braucht die CNC zusätzlich einen Encoder oder ein Längenmesssystem; der Näherungssensor liefert vor allem Referenz- oder Endlagensignal. Ein gekapselter Präzisions-Endschalter kann ebenfalls funktionieren, hat aber eine mechanische Betätigung.",
            },
            {
              id: "window-alarm",
              title: "Fensteralarm: offen oder geschlossen",
              situation: "Ein Fenster in einem trockenen Wohnraum soll batteriebetrieben auf Öffnen reagieren. Schmutz und hohe Positioniergenauigkeit sind kaum relevant; der Sensor soll klein, leise und langlebig sein.",
              question: "Welches Prinzip passt am besten?",
              answer: "reed",
              options: [
                {
                  id: "reed",
                  label: "Reed-Kontakt mit Magnet",
                },
                {
                  id: "photoelectric",
                  label: "Lichtschranke quer durch den Fensterrahmen",
                },
                {
                  id: "limit",
                  label: "Großer mechanischer Endschalter",
                },
                {
                  id: "inductive",
                  label: "Induktiver Sensor mit Metallfahne",
                },
              ],
              correctText: "Der Reed-Kontakt ist für diesen Fensteralarm eine typische und gut begründbare Wahl.",
              wrongText: "Achte besonders auf geringen Energiebedarf, kleine Bauform und berührungslose Betätigung.",
              explanation: "Ein Reed-Sensor mit Magnet lässt sich klein oder verdeckt montieren, benötigt für das Schließen des Kontakts keine eigene Sensorversorgung und bietet für die Zustandsmeldung genügend Wiederholbarkeit. Magnetabstand und Montage müssen dennoch geprüft werden. Bei einem echten Alarmsystem kommen außerdem Leitungsüberwachung, Sabotageerkennung und eine sichere Auswertung hinzu.",
            },
            {
              id: "conveyor-count",
              title: "Förderband: Werkstücke zählen",
              situation: "Unterschiedliche nicht transparente Werkstücke fahren berührungslos an einer festen Stelle vorbei. Gezählt werden soll jedes Objekt; die Umgebung ist weitgehend sauber.",
              question: "Welcher Sensor erkennt die vorbeifahrenden Werkstücke am direktesten?",
              answer: "photoelectric",
              options: [
                {
                  id: "reed",
                  label: "Reed-Kontakt",
                },
                {
                  id: "photoelectric",
                  label: "Einweg-Lichtschranke",
                },
                {
                  id: "limit",
                  label: "Mechanischer Endschalter im Förderweg",
                },
                {
                  id: "bridge",
                  label: "Leitende Kontaktbrücke",
                },
              ],
              correctText: "Eine Einweg-Lichtschranke erkennt jedes Werkstück berührungslos durch die Unterbrechung des Lichtstrahls.",
              wrongText: "Gesucht ist eine schnelle, berührungslose Erkennung unabhängig von einem Magneten oder elektrischer Leitfähigkeit.",
              explanation: "Sender und Empfänger stehen sich gegenüber; ein Werkstück unterbricht den Lichtweg. Das vermeidet mechanischen Kontakt mit dem Fördergut. Für zuverlässiges Zählen müssen Strahlhöhe, Mindestobjektgröße, Objektabstand und mögliche Verschmutzung berücksichtigt werden.",
            },
            {
              id: "outdoor-gate",
              title: "Außentor: Endlage mit Schlamm und Regen",
              situation: "Ein metallisches Schiebetor soll seine geschlossene Endlage melden. Regen, Staub und Schlamm sind zu erwarten; eine Metallfahne kann fest am Tor montiert werden.",
              question: "Welches Prinzip ist unter diesen Randbedingungen besonders robust?",
              answer: "inductive",
              options: [
                {
                  id: "photoelectric",
                  label: "Ungeschützte Lichtschranke in Bodennähe",
                },
                {
                  id: "bridge",
                  label: "Zwei offene Metallkontakte",
                },
                {
                  id: "inductive",
                  label: "Gekapselter induktiver Näherungssensor",
                },
                {
                  id: "limit",
                  label: "Offener kleiner Taster",
                },
              ],
              correctText: "Ein passend gekapselter induktiver Näherungssensor kann die Metallfahne berührungslos und schmutzunempfindlich erkennen.",
              wrongText: "Suche nach einer gekapselten, berührungslosen Lösung, die ein vorhandenes Metallziel direkt erkennen kann.",
              explanation: "Das induktive Prinzip braucht weder einen freien Lichtweg noch offene elektrische Kontakte. Entscheidend bleiben Schutzart, korrosionsfeste Montage, zulässiger Schaltabstand und eine Position, an der sich kein massiver Metallbelag vor der aktiven Fläche aufbauen kann. Ein abgedichteter Industrie-Endschalter wäre eine mögliche mechanische Alternative.",
            },
          ],
        },
        {
          id: "sensor-application-map",
          heading: "Welcher Sensor passt wohin?",
          paragraphs: [
            "Die Zuordnung ist kein universelles Rezept. Sie zeigt, welches Wirkprinzip häufig gut zu einer Aufgabe passt und welche zusätzliche Bedingung die Auswahl verändern kann.",
          ],
          table: {
            headers: [
              "Anwendung",
              "Naheliegendes Prinzip",
              "Entscheidender Grund oder Vorbehalt",
            ],
            rows: [
              [
                "Fenster- oder Türalarm",
                "Reed-Kontakt mit Magnet",
                "Klein, berührungslos und stromsparend; Montageabstand und Sabotagekonzept beachten.",
              ],
              [
                "Hühnerklappe",
                "Reed-Kontakte oder gekapselte induktive Sensoren",
                "Schmutzresistent und berührungslos; zwei Endlagen getrennt und widerspruchsfrei auswerten.",
              ],
              [
                "CNC-Referenz- oder Endsignal",
                "Industriegeeigneter induktiver Sensor oder gekapselter Präzisions-Endschalter",
                "Späne und Kühlschmierstoff berücksichtigen; Wiederholgenauigkeit spezifizieren. Die genaue Achsposition liefert ein Encoder oder Längenmesssystem.",
              ],
              [
                "Werkstücke auf einem sauberen Förderband zählen",
                "Einweg-Lichtschranke",
                "Schnelle berührungslose Unterbrechungserkennung; Optik sauber und ausgerichtet halten.",
              ],
              [
                "Metallisches Außentor",
                "Gekapselter induktiver Näherungssensor",
                "Metallziel berührungslos erkennen; passende Schutzart und Montage wählen.",
              ],
              [
                "Einfacher Laborversuch",
                "Leitende Kontaktbrücke",
                "Sehr anschaulich und preiswert, aber ohne gekapselte Spezialkonstruktion nicht für schmutzige oder feuchte Daueranwendungen.",
              ],
              [
                "Sicherheitskritische Schutztür",
                "Zertifizierter Sicherheitssensor und Sicherheitsauswertung",
                "Ein gewöhnlicher Sensor allein genügt nicht; erforderliche Sicherheitsfunktion und Diagnose bestimmen die Komponenten.",
              ],
            ],
          },
        },
        {
          id: "sensor-distance-proximity",
          heading: "Abstands- und Näherungssensoren",
          paragraphs: [
            "Abstandssensoren liefern mehr als nur „da“ oder „nicht da“: Sie schätzen oder messen die Entfernung zu einem Objekt. Dabei sind Infrarotsensoren keine einheitliche Bauart. Ein einfacher reflektiver IR-Sensor bewertet die Stärke des zurückkommenden Lichts; ein Time-of-Flight-Sensor misst dagegen die Laufzeit ausgesendeter Lichtimpulse. Farbe, Oberfläche, Fremdlicht, Schutzscheiben und Messbereich wirken je nach Verfahren unterschiedlich.",
            "Ultraschallsensoren bestimmen die Laufzeit eines Schallimpulses. Sie sind unabhängig von der sichtbaren Farbe eines Ziels, können aber durch weiche oder schräg stehende Flächen, Luftbewegung, Temperatur und gegenseitige Störung beeinflusst werden. Optische LiDAR- und ToF-Systeme arbeiten mit Licht und können präzise Entfernungs- oder Tiefendaten liefern, brauchen jedoch eine passende Optik und Bewertung der Augensicherheit.",
            "Radar sendet elektromagnetische Wellen aus und wertet Reflexionen aus. Je nach Verfahren lassen sich Entfernung, Relativgeschwindigkeit und Richtung bestimmen. Radar kann auch bei Dunkelheit und in manchen staubigen oder feuchten Situationen Vorteile haben, ist aber aufwendiger auszuwerten und kann mehrere Ziele, Reflexionen und störende Geometrien sehen.",
          ],
          table: {
            headers: [
              "Verfahren",
              "Gut geeignet für",
              "Typische Stolperstelle",
            ],
            rows: [
              [
                "Reflektives Infrarot",
                "Kurze Annäherung, Linienfolger, einfache Objekterkennung",
                "Reflexion hängt von Oberfläche, Winkel und Fremdlicht ab",
              ],
              [
                "Optisches Time-of-Flight oder LiDAR",
                "Direkte Distanz- und Tiefenmessung",
                "Messbereich, Sichtfeld, Schutzscheibe und starkes Umgebungslicht beachten",
              ],
              [
                "Ultraschall",
                "Abstand zu ausreichend großen Flächen, Füllstand",
                "Schallkegel, tote Zone, Temperatur und weiche oder schräge Ziele",
              ],
              [
                "Radar",
                "Präsenz, Bewegung, Abstand, Geschwindigkeit oder Füllstand",
                "Mehrdeutige Reflexionen und anspruchsvollere Signalverarbeitung",
              ],
              [
                "Kapazitiv",
                "Sehr kurze Annäherung, Berührung, Material hinter einer Wand",
                "Feuchte und Ablagerungen können die Schaltschwelle verschieben",
              ],
            ],
          },
        },
        {
          id: "sensor-fmcw-radar",
          heading: "FMCW-Radar: Entfernung und Bewegung aus Chirps",
          paragraphs: [
            "FMCW bedeutet Frequency Modulated Continuous Wave. Das Radar sendet fortlaufend kurze Frequenzrampen, sogenannte Chirps. Ein Ziel reflektiert das Signal zeitlich verzögert. Im Empfänger werden Sende- und Empfangssignal gemischt; die entstehende Beat-Frequenz enthält Information über den Abstand. Phasenänderungen über mehrere Chirps liefern Information über die Relativgeschwindigkeit. Eine Winkelbestimmung erfordert einen geeigneten Antennenaufbau mit mehreren Empfangskanälen und zusätzliche Auswertung.",
            "Ein FMCW-Radarmodul ist deshalb nicht automatisch ein fertiger Näherungsschalter. Manche Module liefern Rohdaten, andere Zielpunkte mit Abstand und Geschwindigkeit, wieder andere nur ein aufbereitetes Präsenzsignal. Frequenzband, Antennen, Bandbreite, Firmware, Schnittstelle und Hersteller-API bestimmen, was tatsächlich messbar ist. Vor dem Anschluss müssen die exakte Typbezeichnung, Versorgung, Logikpegel, Pinbelegung und regionalen Herstellerhinweise geprüft werden.",
            "Für eine Näherungserkennung wird aus den Radarwerten eine fachliche Regel: Welche Ziele liegen in der gewünschten Zone, wie lange müssen sie dort erkannt werden und welche Bewegungen oder Reflexionen sollen ausgeschlossen werden? Leerer Raum, feste Abstände, Stillstand, Annäherung, Querbewegung, mehrere Ziele und reflektierende Gegenstände gehören deshalb in den Versuchsplan.",
          ],
          table: {
            headers: [
              "Vergleich",
              "Vorteil von FMCW-Radar",
              "Nachteil oder Grenze",
            ],
            rows: [
              [
                "Gegenüber reflektivem Infrarot",
                "Nicht von sichtbarer Objektfarbe abhängig; funktioniert ohne sichtbares Licht; kann je nach Modul Abstand und Bewegung trennen.",
                "Höhere Kosten und komplexere Auswertung; Reflexionen und mehrere Ziele können mehrdeutig sein.",
              ],
              [
                "Gegenüber IR-Time-of-Flight",
                "Kein optischer Lichtweg im gleichen Sinn; kann in manchen staubigen, dunklen oder optisch schwierigen Situationen robuster sein und zusätzlich Geschwindigkeit liefern.",
                "Radar- und ToF-Eigenschaften hängen stark vom konkreten Modul ab; Radar hat oft gröbere räumliche Abgrenzung und sieht störende Reflexionen.",
              ],
              [
                "Gegenüber Ultraschall",
                "Keine Abhängigkeit von Schallgeschwindigkeit, Luftbewegung oder weichen schallabsorbierenden Oberflächen; schnelle Bewegungsinformation möglich.",
                "Material, Geometrie und Mehrwegeausbreitung beeinflussen Radarreflexionen; Signalverarbeitung ist meist anspruchsvoller.",
              ],
              [
                "Gegenüber PIR",
                "Kann je nach Ausführung Entfernung und sehr kleine Bewegungen erfassen und ist nicht auf Änderungen der Wärmestrahlung beschränkt.",
                "Benötigt mehr Energie und Rechenaufwand; eine stabile Personenerkennung braucht Zonen, Filter und Tests.",
              ],
              [
                "Grundsätzliche Stärke",
                "Ein Sensorprinzip kann Präsenz, Entfernung, Relativgeschwindigkeit und bei geeigneter Antennenanordnung Winkelinformation liefern.",
                "Nicht jedes FMCW-Modul stellt alle Größen bereit; Datenblatt, SDK und reale Messungen entscheiden.",
              ],
            ],
          },
          learningProjects: [
            {
              model: "Lernprojekt · Projektstufe 1",
              title: "Baue deinen eigenen Näherungssensor",
              description: "Identifiziere dein gekauftes FMCW-Radarmodul, verstehe die Messkette und entwickle mit einem kontrollierten Versuchsplan eine erste Näherungs- oder Präsenzerkennung.",
              href: "/app/learn/?catalog=build-your-own-proximity-sensor",
            },
          ],
        },
        {
          id: "sensor-temperature",
          heading: "Temperatursensoren: NTC, PTC und weitere Bauarten",
          paragraphs: [
            "Ein NTC ist ein temperaturabhängiger Widerstand mit negativem Temperaturkoeffizienten: Steigt die Temperatur, sinkt sein Widerstand. NTCs sind preiswert, klein und empfindlich, aber deutlich nichtlinear. Für einen Messwert braucht man eine Messschaltung, eine Kennlinie oder Berechnungsformel und oft eine Kalibrierung.",
            "Bei einem PTC steigt der Widerstand mit der Temperatur. Manche PTCs eignen sich zur Temperaturerfassung; stark schaltende PTC-Ausführungen werden häufig eher zum Schutz vor Übertemperatur oder Überstrom eingesetzt. Deshalb sind „PTC“ und „genauer Temperatursensor“ nicht automatisch dasselbe.",
            "Widerstandsthermometer wie Pt100 oder Pt1000 bieten gute Stabilität und eine vergleichsweise gut definierte Kennlinie, benötigen aber eine präzise Auswertung und je nach Leitungslänge eine Drei- oder Vierleiterschaltung. Thermoelemente erzeugen eine kleine Spannung aus der Temperaturdifferenz zweier verschiedener Metalle und eignen sich für große Temperaturbereiche; sie brauchen Verstärkung und Kaltstellenkompensation. Halbleiter-Temperatursensoren liefern eine analoge Spannung oder bereits einen digitalen Messwert und sind für viele Elektronik- und Raumtemperaturaufgaben bequem.",
          ],
          table: {
            headers: [
              "Bauart",
              "Stärke",
              "Zu beachten",
            ],
            rows: [
              [
                "NTC-Thermistor",
                "Preiswert, klein, hohe Empfindlichkeit",
                "Widerstand sinkt bei Wärme; nichtlinear und durch Messstrom selbst erwärmbar",
              ],
              [
                "PTC-Thermistor",
                "Temperaturabhängiger Grenzwert oder Schutz",
                "Widerstand steigt; schaltende Typen sind nicht für jede Messaufgabe geeignet",
              ],
              [
                "Pt100/Pt1000 (RTD)",
                "Stabil und gut für präzise Messungen",
                "Präziser Messstrom, Leitungswiderstand und Auswertung nötig",
              ],
              [
                "Thermoelement",
                "Sehr große Temperaturbereiche und robuste Fühler möglich",
                "Sehr kleine Spannung sowie Kaltstellenkompensation erforderlich",
              ],
              [
                "Halbleiter-IC",
                "Einfacher analoger oder digitaler Messwert",
                "Begrenzter Temperaturbereich und thermische Ankopplung beachten",
              ],
            ],
          },
        },
        {
          id: "sensor-light-radiation",
          heading: "Licht-, Farb- und Strahlungssensoren",
          paragraphs: [
            "Ein Fotowiderstand verändert seinen Widerstand mit der Helligkeit und eignet sich für einfache, langsame Hell-Dunkel-Erkennung. Fotodioden und Fototransistoren reagieren schneller und definierter; mit einer passenden Verstärkerschaltung können sie sehr kleine Lichtströme messen.",
            "Integrierte Umgebungslicht- und Farbsensoren enthalten Filter und digitale Auswertung. Sie können Helligkeit an die Wahrnehmung des Menschen annähern oder mehrere Farbkanäle liefern. UV- und Infrarotsensoren reagieren auf andere Wellenlängenbereiche. Eine Wärmebildkamera oder Thermopile misst abgegebene Infrarotstrahlung und darf nicht mit einem einfachen reflektiven IR-Abstandssensor verwechselt werden.",
            "Bei optischen Messungen gehören Lichtquelle, Wellenlänge, Blickwinkel, Oberfläche, Fremdlicht, Verschmutzung und Alterung immer zur Messkette.",
          ],
          table: {
            headers: [
              "Bauart",
              "Typische Aufgabe",
            ],
            rows: [
              [
                "Fotowiderstand (LDR)",
                "Einfache und eher langsame Helligkeitserkennung",
              ],
              [
                "Fotodiode oder Fototransistor",
                "Schnelle Lichtmessung, Lichtschranke, optische Kommunikation",
              ],
              [
                "Umgebungslicht- oder Farbsensor",
                "Helligkeitsanpassung, Farb- oder Materialunterscheidung",
              ],
              [
                "UV-Sensor",
                "UV-Anteil oder UV-Index abschätzen",
              ],
              [
                "Thermopile oder Wärmebildsensor",
                "Berührungslose Oberflächen- oder Wärmestrahlungsmessung",
              ],
            ],
          },
        },
        {
          id: "sensor-motion-orientation",
          heading: "Bewegungs-, Lage- und Orientierungssensoren",
          paragraphs: [
            "Ein Beschleunigungssensor misst Beschleunigung entlang einer oder mehrerer Achsen. Im Stillstand sieht er auch die Erdbeschleunigung und kann daraus eine Neigung ableiten. Ein Gyroskop misst Drehgeschwindigkeit; durch Integration lässt sich eine Winkeländerung bestimmen, wobei sich Fehler mit der Zeit aufsummieren können.",
            "Ein Magnetometer misst das Magnetfeld und kann als elektronischer Kompass dienen, wird aber von Metall, Motoren und Strömen beeinflusst. Eine IMU kombiniert meist Beschleunigungssensor und Gyroskop, manchmal zusätzlich ein Magnetometer. Erst Sensorfusion verbindet diese unvollkommenen Messungen zu einer stabileren Lage- oder Bewegungsabschätzung.",
            "Ein PIR-Sensor reagiert auf Änderungen der Wärmestrahlung in mehreren Sichtbereichen. Er eignet sich für die Bewegung warmer Körper, liefert aber weder ein Kamerabild noch automatisch einen genauen Abstand oder eine sichere Personenerkennung.",
          ],
          table: {
            headers: [
              "Sensor",
              "Misst unmittelbar",
            ],
            rows: [
              [
                "Beschleunigungssensor",
                "Lineare Beschleunigung einschließlich Erdgravitation",
              ],
              [
                "Gyroskop",
                "Drehgeschwindigkeit",
              ],
              [
                "Magnetometer",
                "Magnetfeldstärke und -richtung",
              ],
              [
                "IMU",
                "Kombinierte Bewegungsgrößen mehrerer Sensoren",
              ],
              [
                "PIR",
                "Änderungen einfallender Wärmestrahlung in seinem Sichtfeld",
              ],
            ],
          },
        },
        {
          id: "sensor-force-pressure",
          heading: "Kraft-, Gewichts-, Druck- und Berührungssensoren",
          paragraphs: [
            "Ein Dehnungsmessstreifen ändert seinen Widerstand, wenn er gedehnt oder gestaucht wird. Mehrere davon bilden häufig eine Wheatstone-Brücke in einer Wägezelle. Das Signal ist klein und benötigt einen geeigneten Messverstärker; Mechanik, Temperatur und Krafteinleitung bestimmen die Qualität der Messung wesentlich mit.",
            "Piezoresistive oder kapazitive Drucksensoren wandeln die Verformung einer Membran in ein elektrisches Signal um. Sie messen je nach Aufbau Absolutdruck, Relativdruck oder Differenzdruck. Barometer, Reifendrucksensoren und Drucktransmitter beruhen auf solchen Prinzipien.",
            "Piezoelektrische Sensoren erzeugen bei schneller Kraftänderung oder Vibration eine elektrische Ladung. Sie sind sehr gut für Stoß, Klopfen und Schwingung, aber ohne besondere Elektronik weniger für eine dauerhaft unveränderte statische Kraft. Ein Force-Sensitive Resistor reagiert einfach auf Druck, ist jedoch meist weniger genau und reproduzierbar als eine Wägezelle.",
          ],
          table: {
            headers: [
              "Bauart",
              "Typische Aufgabe",
            ],
            rows: [
              [
                "Wägezelle mit Dehnungsmessstreifen",
                "Gewicht und statische Kraft",
              ],
              [
                "Piezoresistiver oder kapazitiver Drucksensor",
                "Luft-, Flüssigkeits- oder Differenzdruck",
              ],
              [
                "Piezoelement",
                "Stoß, Klopfen, Vibration und schnelle Kraftänderung",
              ],
              [
                "Force-Sensitive Resistor",
                "Einfache Berührungs- oder Druckstufenerkennung",
              ],
              [
                "Kapazitiver Touchsensor",
                "Berührung oder Annäherung eines Fingers",
              ],
            ],
          },
        },
        {
          id: "sensor-environment-chemical",
          heading: "Umwelt-, Schall- und chemische Sensoren",
          paragraphs: [
            "Feuchtesensoren bestimmen meist die relative Luftfeuchte über ein kapazitives oder resistives Messelement. Luftdrucksensoren messen den atmosphärischen Druck und können daraus Wetteränderungen oder relative Höhenänderungen abschätzen. Mikrofone wandeln Schalldruck in ein elektrisches Signal; Lautstärke, Frequenzanalyse und Spracherkennung entstehen erst in der nachfolgenden Verarbeitung.",
            "Bei Gassensoren muss genau benannt werden, was gemessen wird. Metalloxid-Sensoren reagieren oft auf mehrere Gase und benötigen Heizung, Aufwärmzeit und Kalibrierung. Elektrochemische Zellen können für bestimmte Gase empfindlicher sein, altern aber. Nichtdispersive Infrarotsensoren bestimmen beispielsweise CO₂ über Lichtabsorption. Ein allgemeiner „Luftqualitätssensor“ liefert daher nicht automatisch eine genaue Konzentration jedes Schadstoffs.",
            "Partikelsensoren beleuchten angesaugte Luft und werten gestreutes Licht aus. Sie schätzen Partikelkonzentrationen, benötigen aber einen kontrollierten Luftweg und können durch Feuchte, Staubablagerung und unterschiedliche Partikeleigenschaften beeinflusst werden. Chemische Messungen brauchen besonders sorgfältige Kalibrierung, Querempfindlichkeits- und Lebensdauerbetrachtung.",
          ],
          table: {
            headers: [
              "Messgröße",
              "Typische Bauart",
            ],
            rows: [
              [
                "Relative Luftfeuchte",
                "Kapazitives oder resistives Feuchteelement",
              ],
              [
                "Luftdruck",
                "Mikromechanischer Absolutdrucksensor",
              ],
              [
                "Schall",
                "MEMS- oder Elektretmikrofon",
              ],
              [
                "CO₂",
                "NDIR-Infrarotmessung",
              ],
              [
                "Bestimmte Gase",
                "Elektrochemische Zelle oder Metalloxid-Sensor",
              ],
              [
                "Feinstaub",
                "Optische Streulichtmessung mit Luftstrom",
              ],
            ],
          },
        },
        {
          id: "sensor-level-flow",
          heading: "Füllstands- und Durchflusssensoren",
          paragraphs: [
            "Füllstand kann punktuell oder kontinuierlich erfasst werden. Ein Schwimmerschalter meldet einen Grenzstand mechanisch oder magnetisch. Leitfähige Elektroden funktionieren nur bei ausreichend leitfähigen Flüssigkeiten und können korrodieren. Kapazitive Sensoren können durch eine nichtleitende Behälterwand erkennen, reagieren aber auf Material, Wandstärke und Ablagerungen.",
            "Ultraschall und Radar messen berührungslos den Abstand zur Oberfläche. Drucksensoren am Behälterboden können aus dem hydrostatischen Druck auf die Füllhöhe schließen, benötigen dafür aber Dichte und Geometrie. Für aggressive, schäumende oder dampfende Medien muss das Verfahren besonders sorgfältig gewählt werden.",
            "Durchfluss lässt sich unter anderem mit Turbinenrad und Hall-Sensor, Druckdifferenz, Ultraschall, thermischem Prinzip oder magnetisch-induktiv messen. Jedes Verfahren stellt andere Anforderungen an Medium, Rohr, Einbaulage, Mindestdurchfluss und Wartung.",
          ],
          table: {
            headers: [
              "Aufgabe",
              "Mögliche Prinzipien",
            ],
            rows: [
              [
                "Grenzstand",
                "Schwimmer, Reed, kapazitiv, leitfähig, optisch",
              ],
              [
                "Kontinuierlicher Füllstand",
                "Druck, Ultraschall, Radar, kapazitive Sonde",
              ],
              [
                "Einfacher Wasserdurchfluss",
                "Turbinenrad mit Hall-Sensor",
              ],
              [
                "Berührungsloser Durchfluss",
                "Ultraschall",
              ],
              [
                "Leitfähige Flüssigkeit industriell",
                "Magnetisch-induktive Durchflussmessung",
              ],
            ],
          },
        },
        {
          id: "sensor-electrical",
          heading: "Sensoren für Spannung, Strom und Leistung",
          paragraphs: [
            "Spannung wird häufig über einen Spannungsteiler und einen ADC gemessen. Der Teiler muss Grenzspannung, Toleranz, Eingangsimpedanz und Schutz berücksichtigen. Bei hohen oder netzbezogenen Spannungen sind sichere Trennung, geeignete Bauteile und normgerechter Aufbau erforderlich; ein einfacher Spannungsteiler genügt dort nicht.",
            "Strom kann über den Spannungsabfall an einem Shunt-Widerstand gemessen werden. Das ist direkt und präzise möglich, erzeugt aber Verlustleistung und liegt elektrisch im gemessenen Stromkreis. Hall-Stromsensoren und Stromwandler können galvanische Trennung ermöglichen; klassische Stromwandler eignen sich für Wechselstrom, nicht für unveränderten Gleichstrom.",
            "Leistung ist normalerweise keine einzelne unmittelbare Sensorgröße. Sie wird aus synchron gemessener Spannung und Strom berechnet. Bei Wechselstrom müssen außerdem Phasenlage, Effektivwerte und die Signalform berücksichtigt werden.",
          ],
          table: {
            headers: [
              "Verfahren",
              "Geeignet für",
              "Wichtiger Vorbehalt",
            ],
            rows: [
              [
                "Spannungsteiler und ADC",
                "Kleine, sicher bezogene Gleichspannungen",
                "Eingang schützen und zulässige Spannung niemals überschreiten",
              ],
              [
                "Shunt und Messverstärker",
                "Gleich- und Wechselstrom",
                "Verlustleistung und gemeinsames Potential beachten",
              ],
              [
                "Hall-Stromsensor",
                "Gleich- und Wechselstrom, oft galvanisch getrennt",
                "Offset, Temperaturdrift und externer Magnetismus",
              ],
              [
                "Stromwandler",
                "Galvanisch getrennte Wechselstrommessung",
                "Nicht für statischen Gleichstrom; Sekundärkreis sicher behandeln",
              ],
              [
                "Energie-Mess-IC",
                "Spannung, Strom, Leistung und Energie",
                "Messwandler, Isolation und Kalibrierung bleiben Teil des Systems",
              ],
            ],
          },
        },
        {
          id: "measurement-circuits",
          heading: "Messschaltungen",
          paragraphs: [
            "Eine Messschaltung verbindet Sensor und Mikrocontroller so, dass das Signal im erlaubten Spannungs-, Strom- und Frequenzbereich ankommt. Sie schützt Eingänge, legt Bezugspotenziale fest und bereitet das Signal für ADC oder digitale Schnittstelle auf.",
            "Typische Bausteine sind Vorwiderstände, Spannungsteiler, Pull-up- oder Pull-down-Widerstände, Filterkondensatoren, Referenzspannungen, Operationsverstärker und galvanische Trennung. Welche davon nötig sind, entscheidet das Sensordatenblatt – nicht nur der Anschlussname am Board.",
            "Beispiel: Ein Spannungsteiler kann eine zu hohe Sensorspannung für einen ADC verringern. Ein Tiefpass kann Rauschen dämpfen, verändert aber zugleich die Reaktionszeit. Ein Pull-up sorgt bei offenen Eingängen für einen definierten Zustand. Prüfe deshalb immer Versorgung, gemeinsame Masse, Signalpegel und die zulässigen Grenzwerte, bevor du misst oder verbindest.",
          ],
        },
      ],
      relatedTopics: [
        "microcontroller-adc",
        "sampling-rate",
        "embedded-measurement-debugging",
        "physical-limits",
      ],
    },
    "actuators": {
      title: "Aktoren",
      summary: "Aktoren setzen elektrische Signale in eine sichtbare oder physische Wirkung um: Licht, Bewegung, Wärme, Schall oder einen Schaltvorgang. Sie brauchen fast immer mehr als einen Mikrocontroller-Pin.",
      access: "premium",
      sections: [
        {
          id: "actuator-current-magnetic-field",
          heading: "Der Anfang: Strom erzeugt ein Magnetfeld",
          illustration: {
            src: "/assets/motor-learning-current-magnetic-field.svg",
            alt: "Ein gerader stromdurchflossener Draht mit kreisförmigen Magnetfeldlinien und daneben eine Drahtspule um einen magnetischen Kern mit gebündeltem Magnetfeld.",
            caption: "Um jeden stromdurchflossenen Draht entsteht ein Magnetfeld. Viele Windungen addieren ihre Wirkung; ein geeigneter weichmagnetischer Kern bündelt das Feld zusätzlich.",
          },
          paragraphs: [
            "Ein elektrischer Strom ist bewegte elektrische Ladung. Wo Strom durch einen Draht fließt, entsteht um den Draht ein Magnetfeld. Es ist nicht erst ein fertiger Motor nötig: Schon ein gerader Leiter kann eine Kompassnadel ablenken. Wird die Stromrichtung vertauscht, kehrt sich auch die Richtung des Magnetfelds um.",
            "Wickelt man isolierten Draht zu einer Spule, wirken die Magnetfelder der einzelnen Windungen zusammen. Die Spule besitzt dann eine Nord- und eine Südseite. Ein geeigneter weichmagnetischer Kern im Inneren wird magnetisiert und bündelt das nutzbare Feld. Dafür kommen je nach Frequenz, gewünschter Flussdichte und Verlusten beispielsweise weichmagnetische Eisenwerkstoffe oder Ferrite infrage. Wird der Strom abgeschaltet, verschwindet der größte Teil dieser magnetischen Wirkung wieder: Die Anordnung ist ein Elektromagnet.",
            "Ein sicher aufgebauter erster Versuch verwendet eine für die Spannungsquelle ausgelegte Spule oder einen fertigen Kleinspannungs-Elektromagneten. Ein Taster schaltet nur für kurze Zeit ein; eine Strombegrenzung verhindert eine überlastete Wicklung. Draht, Spule und Spannungsquelle müssen so gewählt werden, dass der zulässige Strom nicht überschritten wird.",
          ],
          table: {
            headers: [
              "Beobachtung",
              "Was sie zeigt",
            ],
            rows: [
              [
                "Kompassnadel neben einem bestromten Draht dreht sich",
                "Strom erzeugt ein Magnetfeld.",
              ],
              [
                "Stromrichtung wird vertauscht",
                "Auch die Feldrichtung kehrt sich um.",
              ],
              [
                "Viele Windungen statt eines Drahts",
                "Die Magnetfelder der Windungen addieren sich.",
              ],
              [
                "Weichmagnetischer Kern in der Spule",
                "Der magnetische Fluss wird gebündelt und verstärkt.",
              ],
            ],
          },
          rebuildProjects: [
            {
              model: "Nachbauprojekt",
              title: "Einfache Elektromotoren bauen",
              description: "Beginne mit einem strombegrenzten Elektromagneten und beobachte, wie Strom, Windungszahl und Kernmaterial das Magnetfeld verändern.",
              href: "/nachbauprojekte/einfache-elektromotoren/#elektromagnet",
            },
          ],
        },
        {
          id: "actuator-magnetic-core",
          heading: "Was ein magnetischer Kern ist",
          expertKnowledge: "Für den Einstieg genügt: Ein geeigneter Kern bündelt das Magnetfeld einer Spule. Die folgenden Materialeigenschaften werden erst wichtig, wenn ein Kern gezielt ausgelegt oder ausgewählt werden soll.",
          paragraphs: [
            "Der Kern ist ein Bauteil aus einem dafür geeigneten Material, zum Beispiel Ferrit, im oder um das Magnetfeld einer Spule. Er ist kein Dauermagnet und erzeugt keine Energie. Die Spule erzeugt durch ihre Stromstärke und Windungszahl die magnetische Feldstärke H. Der Kern bündelt und führt den magnetischen Fluss gezielter als Luft und erhöht dadurch im nutzbaren Bereich die magnetische Flussdichte B.",
            "Die entscheidende physikalische Eigenschaft heißt magnetische Permeabilität μ. Sie beschreibt, wie gut sich in einem Material unter einem angelegten Magnetfeld magnetischer Fluss ausbildet. Vereinfacht gilt B = μ × H. Häufig wird die relative Permeabilität μr angegeben: Luft liegt ungefähr bei 1, geeignete weichmagnetische Werkstoffe können deutlich darüber liegen. Deshalb kann dieselbe Spule mit einem passenden Kern wesentlich mehr Fluss durch einen gewünschten Querschnitt führen als ohne Kern.",
            "Der Fachbegriff für das gewünschte Verhalten lautet weichmagnetisch: Das Material führt das angelegte Magnetfeld gut, soll nach dem Abschalten aber möglichst wenig Magnetisierung behalten. Seine Remanenz und Koerzitivfeldstärke sollen für diese Aufgabe also niedrig sein. Das unterscheidet es von hartmagnetischen Werkstoffen für Dauermagnete, die ihre Magnetisierung bewusst behalten sollen. Weichmagnetische Eisenwerkstoffe sind bei niedrigen Frequenzen verbreitet; Ferrite sind keramische ferrimagnetische Werkstoffe mit hohem elektrischem Widerstand und deshalb häufig bei höheren Frequenzen vorteilhaft.",
            "Ein Kern funktioniert nur innerhalb seiner Materialgrenzen. Bei magnetischer Sättigung steigt der Fluss trotz mehr Strom kaum noch an; die Wicklung kann sich dann vor allem stärker erwärmen. Hystereseverluste entstehen beim ständigen Ummagnetisieren. Elektrisch leitfähige Kerne können außerdem Wirbelströme bilden und dadurch warm werden. Material, Form, Luftspalt, Frequenz und zulässige Flussdichte müssen deshalb zur Anwendung passen.",
          ],
          table: {
            headers: ["Physikalische Eigenschaft", "Bedeutung für den Kern"],
            rows: [
              ["Magnetische Permeabilität μ", "Bestimmt, wie leicht sich magnetischer Fluss im Material ausbildet."],
              ["Sättigungsflussdichte", "Begrenzt den maximal sinnvoll erreichbaren magnetischen Fluss."],
              ["Koerzitivfeldstärke und Hysterese", "Bestimmen, wie leicht der Kern ummagnetisiert wird und wie viel Energie dabei verloren geht."],
              ["Elektrischer Widerstand", "Ein hoher Widerstand verringert Wirbelströme; das ist ein Vorteil vieler Ferrite bei höheren Frequenzen."],
            ],
          },
        },
        {
          id: "actuator-current-force",
          heading: "Ein Magnetfeld kann einen stromdurchflossenen Draht bewegen",
          illustration: {
            src: "/assets/motor-learning-current-force.svg",
            alt: "Dreidimensionale Darstellung eines zusammenhängenden Hufeisenmagneten mit Batterie und einem geraden Kupferleiter. Der Leiter verläuft berührungslos in der Mitte des Luftspalts von vorn nach hinten. Strom, Magnetfeld und Kraft stehen jeweils senkrecht zueinander.",
            caption: "Der Leiter sitzt mittig im Luftspalt und berührt keinen Magnetpol. Der Strom fließt in die Bildtiefe, das Magnetfeld vom Nord- zum Südpol nach oben; daraus folgt die Kraft nach rechts.",
          },
          paragraphs: [
            "Ein Permanentmagnet erzeugt bereits ein Magnetfeld. Legt man einen stromdurchflossenen Draht in dieses Feld, wirken beide Magnetfelder zusammen. Auf den Draht entsteht eine Kraft quer zur Stromrichtung und quer zur Feldrichtung. Kehrt man den Strom oder die Magnetpole um, kehrt sich die Kraftrichtung um.",
            "Damit ist das Grundprinzip des Motors erreicht: Elektrische Energie erzeugt eine mechanische Kraft. Ein einzelner frei beweglicher Draht würde nur zur Seite ausweichen. Für eine fortlaufende Drehbewegung muss diese Kraft mit Abstand zu einer Drehachse angreifen und im passenden Moment umgeschaltet werden.",
          ],
          rebuildProjects: [
            {
              model: "Nachbauprojekt",
              title: "Kraftversuch zwischen Magnetpolen",
              description: "Beobachte zuerst eine einzelne Leiterbewegung, bevor daraus im nächsten Aufbau ein Drehmoment wird.",
              href: "/nachbauprojekte/einfache-elektromotoren/#kraftversuch",
            },
          ],
        },
        {
          id: "actuator-simple-coil-motor",
          heading: "Der einfache Spulenmotor: Ein Kräftepaar erzeugt ein Drehmoment",
          illustration: {
            src: "/assets/motor-learning-simple-coil-force-pair-v2.png",
            alt: "Dreidimensionale Darstellung eines einfachen Spulenmotors: Der gut sichtbare rote Plusleiter führt von der Batterie außen am Hufeisenmagneten entlang zum linken Bürstenkontakt; der schwarze Minusleiter führt zum rechten Kontakt. Im Luftspalt dreht sich eine Kupferspule auf einer senkrechten Welle. Türkise Pfeile zeigen das Magnetfeld, orange Pfeile den Strom, grüne Pfeile die entgegengesetzten Kräfte und ein violetter Pfeil das Drehmoment.",
            caption: "N und S sind die beiden Enden desselben Hufeisenmagneten. Türkis: Magnetfeld B im Luftspalt von N nach S. Orange: entgegengesetzte Stromrichtungen I in den beiden Leiterseiten. Grün: die daraus entstehenden Kräfte in entgegengesetzte Bildtiefe. Violett: das daraus entstehende Drehmoment M um die Welle.",
          },
          paragraphs: [
            "Der Hufeisenmagnet ist ein einziger magnetischer Körper: Nord- und Südpol sind seine beiden Enden, keine getrennten Einzelpole. Zwischen ihnen verläuft das äußere Magnetfeld B. Von einer rechteckigen Drahtspule sind vor allem die beiden langen Leiterseiten wirksam: Sie stehen senkrecht zum Feld. In der 3D-Ansicht fließt der Strom in der linken Leiterseite nach oben und in der rechten nach unten. Daraus entstehen zwei gleich große Kräfte in entgegengesetzte Bildtiefe: eine bewegt sich von dir weg, die andere zu dir hin. Die kurzen Verbindungsstücke der Spule verlaufen näherungsweise parallel zum Feld und tragen in diesem vereinfachten Bild nicht zum Drehmoment bei.",
            "Die beiden Kräfte heben sich als seitliche Gesamtbewegung auf, weil sie gleich groß und entgegengesetzt sind. Sie greifen aber auf verschiedenen Seiten der Achse an. Genau diese Anordnung heißt Kräftepaar: Ihre Drehwirkungen addieren sich zum Drehmoment. Je weiter die Kräfte von der Achse entfernt angreifen, desto größer ist bei gleicher Kraft das Drehmoment.",
            "Beim einfachen Experiment dienen die beiden geraden Drahtenden der Spule zugleich als Achse und elektrische Kontakte. Wird die Lackisolierung nur auf einer Hälfte dieser Achsenden entfernt, unterbrechen sie den Strom nahe der ungünstigen Stellung; sie kehren die Stromrichtung nicht um. Während der stromlosen Hälfte trägt die Trägheit die Spule weiter. Diese halb abisolierten Achsenden sind eine sehr einfache, aber unvollständige Form der Kommutierung.",
            "Der Versuch zeigt das Prinzip, ist aber noch kein leistungsfähiger Motor. Ein realer Bürstenmotor verwendet einen laminierten Rotor, mehrere Wicklungen, viele Kommutatorsegmente und feste Bürsten. Der Kommutator kehrt die Stromrichtung in einer passenden Rotorwicklung gezielt um, damit das Drehmoment möglichst gleichgerichtet und gleichmäßig bleibt.",
          ],
          list: [
            "Stator: der feste, durchgehende Hufeisenmagnet mit seinen N- und S-Enden.",
            "Rotor: Drahtspule mit ihrer Achse.",
            "Kräftepaar: zwei gleich große Gegenkräfte an verschiedenen Seiten der Achse.",
            "Einfache Umschaltung: halb abisolierte Achsenden unterbrechen den Strom in der ungünstigen Stellung.",
            "Lernziel: Einzelkraft, Kräftepaar, Drehmoment und Kommutierung unterscheiden.",
          ],
          rebuildProjects: [
            {
              model: "Nachbauprojekt",
              title: "Motor 1 · Einfacher Spulenmotor",
              description: "Wickle einen frei drehenden Rotor und beobachte, wie ein Kräftepaar durch halb abisolierte Achsenden in Drehbewegung übergeht.",
              href: "/nachbauprojekte/einfache-elektromotoren/#spulenmotor",
            },
          ],
        },
        {
          id: "actuator-reed-motor",
          heading: "Reedkontakt-Motor: Die Rotorlage bestimmt den Einschaltzeitpunkt",
          illustrationSeries: [
            {
              src: "/assets/motor-learning-reed-timing-before.svg",
              alt: "Rotorlage vor dem Schaltfenster: Der Permanentmagnet sitzt am Rotorrand und bewegt sich im Uhrzeigersinn auf den fest montierten Reedkontakt und die danach angeordnete Spule zu. Der Reedkontakt ist offen und die Spule stromlos.",
              caption: "Bild 1: Der Randmagnet läuft im Pfeilsinn auf den fest montierten Reedkontakt zu. Außerhalb des cyan markierten Schaltfensters bleibt der Kontakt offen und die Spule stromlos.",
            },
            {
              src: "/assets/motor-learning-reed-timing-on.svg",
              alt: "Rotorlage im Schaltfenster: Der Permanentmagnet am Rotorrand steht parallel und nahe am fest montierten Reedkontakt. Der Kontakt ist geschlossen, die feststehende Spule ist bestromt und zieht den Nordpol des Magneten in Drehrichtung zur Spulenachse.",
              caption: "Bild 2: Nur im Schaltfenster liegt der Magnet nah und parallel zum Reedkontakt. Der geschlossene Kontakt bestromt die Spule; deren S-Pol zieht den roten N-Pol zur Spulenachse.",
            },
            {
              src: "/assets/motor-learning-reed-timing-after.svg",
              alt: "Rotorlage nach der Spulenachse: Der Permanentmagnet am Rotorrand hat die Spule passiert und ist wieder vom fest montierten Reedkontakt entfernt. Kontakt und Spule sind aus; der Rotor läuft durch Trägheit weiter.",
              caption: "Bild 3: Hinter der Spulenachse ist der Randmagnet wieder außerhalb des Schaltfensters. Der Reedkontakt öffnet, die Spule wird stromlos und der Rotor läuft durch Trägheit weiter.",
            },
          ],
          paragraphs: [
            "In Bild 1, 2 und 3 bleiben Reedkontakt und Spule an derselben Stelle. Nur der Rotor mit Randmagnet und gegenüberliegendem Gegengewicht bewegt sich im Pfeilsinn weiter. Dadurch lässt sich die jeweilige Rotorlage direkt vergleichen.",
            "Bild 1 zeigt den offenen Stromkreis vor dem Schaltfenster. In Bild 2 liegt der Randmagnet nah am Reedkontakt: Der Kontakt schließt und die Spule zieht den roten N-Pol in Drehrichtung zur Spulenachse. Bild 3 zeigt den Magneten hinter der Spule; der Reedkontakt ist wieder offen, sodass die Spule den Rotor nicht zurückzieht.",
            "Der genaue Abstand und Winkel sind keine festen Universalwerte: Magnetstärke, Orientierung, Reed-Empfindlichkeit, Spulenstrom und Mechanik bestimmen das Schaltfenster. Deshalb werden Reedkontakt und Spule im Nachbau verschiebbar montiert und zunächst bei kleiner Spannung eingestellt.",
            "Der Reedkontakt darf nur den Strom schalten, für den er ausgelegt ist. Bei größeren Spulenströmen übernimmt deshalb im nächsten Schritt ein Transistor das Schalten; der Kontakt oder Sensor liefert dann nur noch ein kleines Steuersignal.",
          ],
          rebuildProjects: [
            {
              model: "Nachbauprojekt",
              title: "Motor 2 · Reedkontakt-Impulsmotor",
              description: "Baue einen Magnetrotor, dessen Lage eine feststehende Spule im richtigen Moment einschaltet.",
              href: "/nachbauprojekte/einfache-elektromotoren/#reedmotor",
            },
          ],
        },
        {
          id: "actuator-transistor-motor",
          heading: "Sensor und Transistor: vom Experiment zur elektronischen Kommutierung",
          illustration: {
            src: "/assets/motor-learning-transistor-switch.svg",
            alt: "Ein Hall-Sensor erkennt den Permanentmagneten auf dem Rotor und sendet ein kleines Signal an einen Transistor. Der Transistor schaltet den stärkeren Strom durch eine feststehende Spule.",
            caption: "Der Sensor erkennt die Rotorlage, ohne den Spulenstrom selbst tragen zu müssen. Der Transistor arbeitet als schneller Leistungsschalter.",
          },
          paragraphs: [
            "Ein Hall-Sensor kann die Rotorlage berührungslos erkennen. Sein Ausgang steuert einen Transistor oder einen geeigneten Motortreiber. Der Sensor verarbeitet dabei nur ein kleines Signal; der Leistungsschalter übernimmt den deutlich größeren Spulenstrom. Eine Freilauf- oder Klemmbeschaltung führt die Energie der Spule beim Abschalten sicher weiter.",
            "Das Prinzip ist bereits elektronische Kommutierung: messen, entscheiden, schalten. Ein BLDC-Motor erweitert es auf mehrere feststehende Phasenwicklungen. Die Elektronik bestromt sie nacheinander so, dass ein wanderndes Magnetfeld entsteht und der Permanentmagnet-Rotor diesem Feld folgt.",
          ],
          rebuildProjects: [
            {
              model: "Nachbauprojekt",
              title: "Motor 3 · Hall-Sensor und Transistor",
              description: "Trenne Rotorerkennung und Spulenstrom mit Hall-Sensor, MOSFET und Freilaufdiode.",
              href: "/nachbauprojekte/einfache-elektromotoren/#hallmotor",
            },
          ],
        },
        {
          id: "actuator-homopolar-motor",
          heading: "Homopolarmotor: ein verblüffender Sonderfall",
          illustration: {
            src: "/assets/motor-learning-homopolar.svg",
            alt: "Eine Batterie steht auf einem Scheibenmagneten. Ein symmetrisch gebogener Kupferdraht berührt den oberen Batteriepol und den Rand des Magneten; ein Pfeil zeigt die Drehbewegung.",
            caption: "Beim Homopolarmotor fließt Strom durch Draht und Magnet. Die Kraft wirkt tangential – der Draht dreht sich um die Batterie.",
          },
          paragraphs: [
            "Der Homopolarmotor kommt mit Batterie, Scheibenmagnet und gebogenem Draht aus. Der Strom fließt vom Batteriepol durch den Draht und über den leitfähigen Magneten zurück. Im Magnetfeld wirkt auf den stromdurchflossenen Draht eine tangentiale Kraft; der frei gelagerte Draht beginnt sich zu drehen.",
            "Der Versuch zeigt die Kraft auf einen stromdurchflossenen Leiter besonders unmittelbar, ist aber kein verkleinerter normaler Bürstenmotor. Er besitzt weder eine drehende Spule noch einen Kommutator. Viele Varianten haben außerdem einen sehr kleinen elektrischen Widerstand und dürfen nur mit einer geeigneten Spannungsquelle und für kurze Zeit betrieben werden.",
            "Für den eigentlichen Lernweg sind Elektromagnet, Kraftversuch, Spulenmotor und Reedkontakt-Motor aussagekräftiger. Der Homopolarmotor bleibt ein ergänzendes Experiment, mit dem sich die Richtung von Strom, Magnetfeld und Bewegung untersuchen lässt.",
          ],
          rebuildProjects: [
            {
              model: "Strombegrenzter Sonderversuch",
              title: "Homopolarmotor vergleichen",
              description: "Nur mit Kleinspannung und Strombegrenzung: Der Aufbau zeigt die Leiterkraft, ist aber kein normaler Bürstenmotor.",
              href: "/nachbauprojekte/einfache-elektromotoren/#homopolarmotor",
            },
          ],
        },
        {
          id: "actuator-motor-theory",
          heading: "Zwei Motorfamilien: Wechselstrom und Gleichstrom",
          paragraphs: [
            "Für den Einstieg hilft eine einfache Einteilung: Es gibt Motoren, die an Wechselstrom arbeiten, und Motoren, die an Gleichstrom arbeiten. Beide verwandeln elektrische Energie in Bewegung, aber sie erzeugen ihr drehendes Magnetfeld auf unterschiedliche Weise. Welche Familie passt, entscheidet nicht nur die Steckdose, sondern auch die Aufgabe, die gewünschte Regelbarkeit und die verfügbare Elektronik.",
            "Wechselstrommotoren haben mehrere Statorspulen. Werden diese zeitlich versetzt bestromt, wandert das Magnetfeld einmal rund im Kreis. Dieses wandernde Feld zieht oder treibt den Rotor an. Die zwei wichtigen Varianten heißen Synchron- und Asynchronmotor. Bei Gleichstrommotoren wird die Energie dagegen als Gleichspannung zugeführt. Beim klassischen Bürstenmotor sorgt ein mechanischer Kommutator dafür, dass die Rotorwicklung beim Drehen passend umgeschaltet wird.",
            "Diese Familien sind eine Landkarte, keine Kaufentscheidung. Kleine Bastel- und Roboterprojekte beginnen oft mit permanent erregten Bürsten-DC-Motoren, Servos oder Schrittmotoren. Pumpen, Lüfter und Maschinen nutzen häufig Wechselstrommotoren. BLDC- und PMSM-Motoren verbinden eine Gleichspannungsversorgung mit einem elektronisch erzeugten Drehfeld und werden deshalb später als eigene, fortgeschrittene Variante erklärt.",
          ],
        },
        {
          id: "actuator-synchronous-machines",
          heading: "Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen",
          paragraphs: [
            "Stell dir einen Stabmagneten auf einem kleinen Drehteller vor. Wenn du außen herum ein Magnetfeld langsam im Kreis wandern lässt, versucht der Magnet, diesem Feld zu folgen. Genau dieses Grundprinzip ist bei einer Synchronmaschine leicht zu sehen: In dieser Bildserie erzeugen Spulen im festen äußeren Teil, dem Stator, ein wanderndes Magnetfeld. Im drehbaren inneren Teil, dem Rotor, sitzt ein Magnet oder ein elektromagnetisch erzeugtes Magnetfeld.",
            "Rotor und Stator werden nicht über innen oder außen definiert, sondern über die Bewegung: Der Rotor dreht sich, der Stator bleibt stehen. Die Bildserie zeigt einen Innenläufer, bei dem der Rotor innen liegt. Bei einem Außenläufer – etwa bei vielen Drohnen- und Modellbaumotoren – dreht sich dagegen der äußere Becher mit den Magneten; der innere Teil mit den Spulen kann der feststehende Stator sein.",
            "Der Begriff Anker ist kein allgemeines Synonym für Rotor. Bei klassischen Bürsten-Gleichstrommotoren meint er meist die drehende, bestromte Wicklung mit Kommutator und ist daher Teil des Rotors. Bei vielen großen Synchronmaschinen liegt die Arbeits- oder Ankerwicklung dagegen im Stator; auf dem Rotor sitzt die Erregung. Bei Relais oder Hubmagneten kann ein Anker sogar ein geradlinig bewegtes Eisenteil sein. Deshalb verwenden wir hier für die Bewegung bewusst die eindeutigen Begriffe Rotor und Stator.",
            "Das wandernde Feld zieht den Rotor immer weiter mit. Dreht sich das Feld einmal pro Sekunde, dreht sich der Rotor – solange er nicht überlastet ist – ebenfalls einmal pro Sekunde. Deshalb heißt diese Maschine synchron: Rotor und Magnetfeld laufen im gleichen Takt. Die Spulen des Stators werden dafür in einer passenden Reihenfolge bestromt. Bei großen Maschinen kommt die Reihenfolge meist aus dem Stromnetz oder einem Frequenzumrichter, bei kleinen bürstenlosen Motoren aus einer Elektronik.",
            "Die Bildserie zeigt das Prinzip bewusst als drei einzeln weitergeschaltete Spulenpaare der Phasen A, B und C. Jedes Spulenpaar wirkt auf zwei gegenüberliegende Statorpole; die drei gerichteten Feldachsen liegen jeweils 120 Grad auseinander. Wird zum nächsten Spulenpaar weitergeschaltet, dreht sich die bevorzugte Feldrichtung weiter und der Dauermagnet-Rotor folgt.",
            "Ein realer dreiphasiger Synchronmotor schaltet normalerweise nicht nur ein Polpaar hart ein und die anderen vollständig aus. Die Ströme der drei Phasen überlagern sich zeitlich und bilden dadurch ein gleichmäßiger rotierendes Magnetfeld. Die vier Bilder sind deshalb ein anschauliches Schrittmodell für das Grundprinzip, kein vollständiges Strom- oder Regelungsdiagramm.",
            "Das Bild hilft auch bei der Auswahl: Eine Synchronmaschine ist besonders gut, wenn die Elektronik das Drehfeld gezielt formen und die Bewegung effizient oder genau steuern soll. Viele BLDC- und PMSM-Motoren gehören in diese Familie. Wie die Elektronik erkennt, wo der Rotor gerade steht, und die Spulen weiterschaltet, folgt später beim BLDC.",
          ],
          illustrationSeries: [
            {
              src: "/assets/synchronous-motor-step-0-unpowered.svg",
              alt: "Unbestromter Synchronmotor mit drei gegenüberliegenden Spulenpaaren der Phasen A, B und C sowie einem frei drehbaren Dauermagnet-Rotor",
              caption: "Stromlos: Kein Statorpol erzeugt ein gerichtetes Magnetfeld. Im idealisierten Lernmodell lässt sich der Rotor frei drehen.",
            },
            {
              src: "/assets/synchronous-motor-step-1-phase-a.svg",
              alt: "Polpaar A ist bestromt und richtet den Dauermagnet-Rotor horizontal aus",
              caption: "Spulenpaar A: Der Rotor richtet sich an der ersten Feldrichtung aus.",
            },
            {
              src: "/assets/synchronous-motor-step-2-phase-b.svg",
              alt: "Polpaar B ist bestromt: Nord und Süd stehen direkt in den beiden aktiven Statorpolen. Der Dauermagnet-Rotor folgt der um 120 Grad weitergewanderten Feldrichtung.",
              caption: "Spulenpaar B: N und S markieren die beiden aktiven Statorpole; die Feldrichtung wandert um 120 Grad weiter.",
            },
            {
              src: "/assets/synchronous-motor-step-3-phase-c.svg",
              alt: "Polpaar C ist bestromt: Nord und Süd stehen direkt in den beiden aktiven Statorpolen. Der Dauermagnet-Rotor folgt erneut um 120 Grad.",
              caption: "Spulenpaar C: N und S markieren die beiden aktiven Statorpole. Danach beginnt die Folge wieder bei A.",
            },
          ],
          table: {
            headers: [
              "Teil",
              "Einfache Aufgabe",
            ],
            rows: [
              [
                "Stator",
                "bleibt fest und erzeugt mit Spulen ein wanderndes Magnetfeld",
              ],
              [
                "Rotor",
                "dreht sich und folgt diesem Magnetfeld",
              ],
              [
                "Innen- oder Außenläufer",
                "beschreibt nur die Bauform: Der Rotor kann innen liegen oder als äußerer Becher umlaufen",
              ],
              [
                "Anker",
                "Fachbegriff für einen funktionalen Maschinenteil, nicht pauschal für den Rotor",
              ],
              [
                "Elektronik oder Netz",
                "bestromt die Spulen in der richtigen Reihenfolge",
              ],
              [
                "Synchron",
                "Rotor und Magnetfeld drehen sich im gleichen Takt",
              ],
            ],
          },
        },
        {
          id: "actuator-synchronous-back-emf",
          heading: "Drei Phasen, Gegen-EMK und Kurzschlussbremsung",
          expertKnowledge: "Die Gegen-EMK ist die vom drehenden Permanentmagnet-Rotor in den Statorwicklungen induzierte Spannung. Sie wächst näherungsweise mit der Drehzahl. Beim Kurzschluss der Phasen treibt diese Spannung Strom; dessen Magnetfeld erzeugt gemäß der Lenz'schen Regel ein Bremsmoment entgegen der Bewegung. Das ist eine generatorische Bremse, kein zusätzliches Antriebsmoment.",
          illustration: {
            src: "/assets/synchronous-motor-three-phase-back-emf.svg",
            alt: "Zweiteilige Darstellung einer permanent erregten Synchronmaschine: Oben erzeugen drei geregelte Phasenströme ein resultierendes Drehfeld und Drehmoment. Unten erzeugt der drehende Rotor Gegen-EMK; kurzgeschlossene Statorphasen führen Strom und erzeugen ein Bremsmoment entgegen der Drehung.",
            caption: "Drei geregelte Phasen erzeugen im Antrieb ein gleichmäßigeres Drehfeld. Ein Phasenkurzschluss ist ein anderer Betriebsfall: Die Gegen-EMK treibt Strom und bremst den Rotor.",
          },
          paragraphs: [
            "Die Bildserie davor schaltet die Phasen A, B und C nacheinander, damit das wandernde Feld leicht zu sehen ist. Im realen PMSM- oder BLDC-Antrieb werden die drei Phasen jedoch vom Wechselrichter geregelt und zeitversetzt bestromt. Ihre Feldanteile überlagern sich zu einem resultierenden Statorfeld. Das erzeugt ein deutlich gleichmäßigeres Drehmoment als das harte Ein-Phasen-Schrittmodell. Wie groß das Drehmoment wird, hängt von Strom, Rotorfluss, Winkel und Motorgeometrie ab – nicht allein davon, dass drei Phasen vorhanden sind.",
            "Gegen-EMK bedeutet Gegen-Elektromotorische-Kraft: Dreht sich der Permanentmagnet-Rotor, ändert sich der magnetische Fluss durch die Statorwicklungen und induziert dort eine Spannung. In der Motorbetriebsart wirkt sie der angelegten Spannung entgegen und begrenzt bei höherer Drehzahl den Strom. Sie entsteht auch dann, wenn keine Phase kurzgeschlossen ist; bei Stillstand ist sie praktisch null.",
            "Werden die drei Statorphasen tatsächlich kurzgeschlossen oder über einen kleinen Bremswiderstand verbunden, treibt die Gegen-EMK einen Strom durch die Wicklungen. Dieser Strom erzeugt ein Magnetfeld, das der Bewegung entgegenwirkt. Das resultierende Moment ist ein Bremsmoment. Die Bewegungsenergie des Rotors wird dabei überwiegend in Wärme in Wicklungen, Widerstand und Leistungselektronik umgesetzt. Ein Kurzschluss ist daher keine Methode, das Antriebsmoment zu erhöhen.",
          ],
          table: {
            headers: ["Betriebsfall", "Elektrische Wirkung", "Mechanische Wirkung"],
            rows: [
              ["Antrieb", "Wechselrichter regelt iA, iB und iC", "Resultierendes Drehfeld erzeugt Antriebsmoment"],
              ["Rotor dreht, Phasen offen", "Gegen-EMK vorhanden, kaum Strom", "Keine gezielte elektrische Bremsung"],
              ["Phasen kurzgeschlossen", "Gegen-EMK treibt Kurzschlussstrom", "Bremsmoment entgegen der Drehung"],
            ],
          },
        },
        {
          id: "actuator-electrical-mechanical-angle",
          heading: "Elektrische und mechanische Drehung",
          expertKnowledge: "Für die erste Motoransteuerung meist nicht zu berechnen, weil Motortreiber und Regelung die Kommutierung übernehmen. Für Drehzahl, Rotorlage, Encoderauflösung und die Auswahl eines Frequenzumrichters ist die Polpaarzahl jedoch entscheidend.",
          paragraphs: [
            "Eine mechanische Drehung beschreibt die wirkliche Bewegung der Welle: 360 mechanische Grad sind genau eine vollständige Rotorumdrehung. Eine elektrische Drehung beschreibt dagegen einen vollständigen Zyklus des magnetischen Feldes beziehungsweise der Phasenströme: 360 elektrische Grad reichen von einer Feldlage bis zur elektrisch gleichen Feldlage.",
            "Wie beide Winkel zusammenhängen, bestimmt die Polpaarzahl p. Ein Polpaar besteht aus einem magnetischen Nord- und einem Südpol. Es gilt: elektrischer Winkel = Polpaarzahl × mechanischer Winkel. Bei p = 1 entsprechen 360 elektrische Grad einer ganzen mechanischen Umdrehung. Bei p = 3 entsprechen 360 elektrische Grad nur 120 mechanischen Grad; während einer mechanischen Umdrehung durchläuft das elektrische System drei vollständige Zyklen.",
            "Die drei Phasen A, B und C sind nicht dasselbe wie drei Polpaare. Ein dreiphasiger Motor kann eine, zwei, drei oder mehr Polpaarzahlen besitzen. Die Bildserie darüber zeigt drei Spulenpaare beziehungsweise Phasenachsen und einen zweipoligen Stabmagnet-Rotor; ihr vereinfachtes Drehfeld besitzt ein magnetisches Polpaar. Ein tatsächlicher Motor mit drei Polpaaren hätte ein sechspoliges Feld und einen dazu passenden Rotor mit insgesamt drei Nord-Süd-Paaren statt nur eines einfachen Stabmagneten.",
            "Auch die synchrone Drehzahl folgt daraus: Bei gleicher elektrischer Frequenz dreht ein Motor mit mehr Polpaaren mechanisch langsamer. Vereinfacht gilt n = 60 × f ÷ p, wobei n die synchrone Drehzahl in Umdrehungen pro Minute und f die elektrische Frequenz in Hertz ist.",
          ],
          table: {
            headers: ["Polpaarzahl p", "360° elektrisch entsprechen", "Elektrische Zyklen pro mechanischer Umdrehung"],
            rows: [
              ["1", "360° mechanisch", "1"],
              ["2", "180° mechanisch", "2"],
              ["3", "120° mechanisch", "3"],
              ["4", "90° mechanisch", "4"],
            ],
          },
        },
        {
          id: "actuator-asynchronous-machines",
          heading: "Asynchronmaschinen: das Feld zieht den Rotor hinter sich her",
          paragraphs: [
            "Bei einem Asynchronmotor erzeugt der Stator ebenfalls ein drehendes Magnetfeld. Der Rotor enthält aber oft keinen eigenen Permanentmagneten. Stattdessen besteht er vereinfacht aus leitenden Stäben. Das wandernde Feld erzeugt darin elektrische Ströme – ähnlich wie ein bewegter Magnet in einer Spule Strom erzeugen kann.",
            "Diese Ströme machen den Rotor selbst zu einem Magneten. Er wird vom Statorfeld mitgezogen, bleibt aber immer ein kleines Stück langsamer. Nur wenn das Feld am Rotor vorbeiwandert, werden weiter Ströme induziert und kann Drehmoment entstehen. Dieser kleine Geschwindigkeitsunterschied heißt Schlupf. Darum heißt der Motor asynchron: Rotor und Statorfeld drehen nicht exakt gleich schnell.",
            "Asynchronmotoren sind robust und in Pumpen, Lüftern und vielen Maschinen sehr verbreitet. Direkt am Wechselstromnetz laufen sie mit einer durch Netzfrequenz und Motoraufbau bestimmten Drehzahl. Soll die Drehzahl gezielt verändert werden, nutzt man einen Frequenzumrichter – also eine Leistungselektronik, die ein passendes neues Drehfeld erzeugt.",
          ],
        },
        {
          id: "actuator-dc-motors",
          heading: "Gleichstrommotoren: Reihenschluss, Nebenschluss und permanent erregt",
          paragraphs: [
            "Beim klassischen Bürsten-Gleichstrommotor übernimmt der Motor selbst das Weiterschalten der Rotorwicklung. Während sich der Rotor dreht, schalten Bürsten und Kommutator die Wicklung um. So bleibt das Rotorfeld passend zum festen Feld des Stators ausgerichtet und der Motor dreht weiter. Von außen genügt eine Gleichspannung; für die andere Richtung vertauscht eine H-Brücke die Polarität am Motor.",
            "Die Namen beschreiben, wie das Statorfeld entsteht. Beim Reihenschlussmotor liegen Feldwicklung und Rotorwicklung in Reihe. Er kann ein sehr hohes Anlaufdrehmoment liefern, seine Drehzahl kann ohne passende Last aber stark ansteigen. Beim Nebenschlussmotor liegt die Feldwicklung parallel zum Rotor. Sein Feld bleibt dadurch vergleichsweise konstant und die Drehzahl ist unter wechselnder Last besser beherrschbar. Beide Bauarten sind klassische Maschinenkonzepte mit Feldwicklungen.",
            "Beim permanent erregten Bürsten-DC-Motor erzeugen stattdessen feste Magnete das Statorfeld. Das spart eine Feldwicklung und macht kleine Motoren günstig, kompakt und einfach anzusteuern. Deshalb findet man diese Bauart häufig in Spielzeug, kleinen Pumpen, Getriebemotoren und ersten Lernaufbauten. Günstig bedeutet aber nicht unkritisch: Anlauf- und Blockierstrom, Bürstenverschleiß, Störungen und mechanische Last gehören weiterhin zur Auslegung.",
          ],
          table: {
            headers: [
              "DC-Bauart",
              "Statorfeld",
              "Einsteiger-Einordnung",
            ],
            rows: [
              [
                "Reihenschluss",
                "Feldwicklung liegt in Reihe mit dem Rotor",
                "hohes Anlaufdrehmoment; ohne Last nicht einfach unbeaufsichtigt betreiben",
              ],
              [
                "Nebenschluss",
                "Feldwicklung liegt parallel zum Rotor",
                "vergleichsweise konstantes Feld und besser beherrschbare Drehzahl",
              ],
              [
                "Permanent erregt",
                "feste Magnete statt Feldwicklung",
                "typischer kleiner, günstiger Bürsten-DC-Motor für Lern- und Hobbyprojekte",
              ],
            ],
          },
        },
        {
          id: "actuator-bldc-basics",
          heading: "BLDC: Gleichspannung hinein, elektronisches Drehfeld heraus",
          paragraphs: [
            "Ein BLDC-Motor hat keine Bürsten und keinen mechanischen Kommutator. Sein Rotor trägt meist Permanentmagnete, seine Spulen sitzen im Stator. Eine Elektronik muss die Spulen im richtigen Moment weiterschalten. Dieses elektronische Weiterschalten heißt Kommutierung. Sie braucht die Rotorlage – zum Beispiel von Hall-Sensoren, einem Encoder oder einer sensorlosen Schätzung aus den Motorsignalen.",
            "Die typische Leistungsschaltung dafür ist eine B6-Brücke: sechs Schalter bilden drei Halbbrücken für die drei Motorphasen. Die Brücke kennt nur die festen Spannungen des Gleichspannungs-Zwischenkreises; sie kann also keine perfekte Sinusspannung direkt ausgeben. Mit schnellem PWM-Schalten wird eine gewünschte mittlere Phasenspannung angenähert. Die Induktivität der Motorwicklungen glättet die schnellen Schaltanteile. Mit einer Stromregelung können dadurch annähernd sinusförmige Phasenströme entstehen – das sorgt für ein gleichmäßiges Drehfeld und ruhigen Lauf.",
            "Der BLDC wird meist aus einer Gleichspannungsquelle wie Akku oder Netzteil versorgt, ist von seinem Motorprinzip aber eine permanent erregte Synchronmaschine: Der Rotor folgt dem elektronisch erzeugten Drehfeld. Für ein erstes Lernprojekt ist deshalb ein Bürsten-DC-Motor mit Transistor oder H-Brücke viel einfacher. BLDC-Regelung ist die nächste Stufe, wenn Grundlagen zu PWM, Treibern, Strom und Rotorlage sicher sitzen.",
          ],
          table: {
            headers: [
              "Motor",
              "Wer übernimmt die Kommutierung?",
              "Einfacher Einstieg",
            ],
            rows: [
              [
                "Bürsten-DC",
                "Bürsten und Kommutator im Motor",
                "Transistor für eine Richtung, H-Brücke für zwei Richtungen",
              ],
              [
                "BLDC / PMSM",
                "Elektronik schaltet die Statorphasen nach Rotorlage",
                "dreiphasiger Inverter, oft B6-Brücke; für Fortgeschrittene",
              ],
              [
                "Schrittmotor",
                "Treiber bestromt Phasen in einer Schrittfolge",
                "STEP/DIR- oder 4-Phasen-Treiber",
              ],
              [
                "Servo",
                "Regler im Servo kombiniert Motor, Sensor und Getriebe",
                "Positions- oder Geschwindigkeitssignal",
              ],
            ],
          },
        },
        {
          id: "actuator-motors-and-drives",
          heading: "Motoren und Antriebe auswählen",
          paragraphs: [
            "Die Auswahl beginnt nicht mit einem Motortyp, sondern mit der Bewegungsaufgabe: Soll sich etwas dauerhaft drehen, eine genaue Position erreichen, eine definierte Strecke fahren oder eine Klappe gegen eine Last öffnen? Dazu kommen Drehmoment, Geschwindigkeit, Weg, Einschaltdauer, Geräusch und die Frage, was bei einem Fehler passieren darf.",
            "Ein Gleichstrommotor dreht kontinuierlich und ist für Lüfter, Räder oder kleine Pumpen geeignet. Seine Drehzahl lässt sich häufig über PWM beeinflussen; für die Drehrichtung braucht er eine H-Brücke. Ein Servo enthält Motor, Getriebe, Positionsmessung und Regelung bereits im Gehäuse. Er folgt einem Positionssignal und eignet sich für begrenzte Winkel, etwa einen kleinen Riegel. Ein Schrittmotor bewegt sich in diskreten Schritten und ist praktisch für reproduzierbare Wege, braucht aber einen passenden Treiber und verliert ohne Rückmeldung bei Überlast möglicherweise seine reale Position.",
            "Ein Linearantrieb wandelt eine Drehbewegung in einen Hub um und wird nach Kraft, Weg und Geschwindigkeit gewählt. BLDC- und PMSM-Antriebe sind effizient und leistungsfähig, ihre Regelung mit Leistungsteil und Rotorlage ist jedoch deutlich anspruchsvoller. Getriebe, Mechanik und Endlagen sind immer Teil des Antriebs: Ein passender Motor allein garantiert noch keine sichere Bewegung.",
          ],
          table: {
            headers: [
              "Antrieb",
              "Passt gut, wenn …",
              "Wichtig für die Steuerung",
            ],
            rows: [
              [
                "DC-Motor",
                "eine Welle kontinuierlich drehen soll",
                "PWM für Drehzahl; H-Brücke für Richtung; echte Position nur mit zusätzlichem Sensor",
              ],
              [
                "Servo",
                "ein begrenzter Winkel gezielt erreicht werden soll",
                "Positionssignal, stabile Versorgung und mechanische Begrenzung",
              ],
              [
                "Schrittmotor",
                "ein Weg in kleinen, reproduzierbaren Schritten gefahren wird",
                "STEP/DIR-Treiber, Beschleunigung; Endschalter oder Encoder für sichere Referenz",
              ],
              [
                "Linearantrieb",
                "eine Klappe, ein Riegel oder eine Schiene bewegt wird",
                "Richtung, Endlagen, Einklemmschutz und ausreichende Stromversorgung",
              ],
              [
                "BLDC / PMSM",
                "Effizienz oder Leistung entscheidend ist",
                "spezialisierter 3-Phasen-Treiber, Rotorlage und Schutzfunktionen",
              ],
            ],
          },
        },
        {
          id: "actuator-motor-control",
          heading: "Motoransteuerung: Leistungsteil und Firmware",
          paragraphs: [
            "Motoransteuerung verbindet Elektronik und Software. Die Firmware entscheidet, wann, wie schnell und in welche Richtung sich etwas bewegen soll. Ein Leistungsteil setzt diesen kleinen Steuerbefehl in den benötigten Strom um. Der GPIO steuert deshalb einen Treiber – nie direkt den Motor.",
            "Für einen DC-Motor mit nur einer Richtung kann ein geeigneter MOSFET-Treiber genügen. Soll der Motor vorwärts und rückwärts laufen, schaltet eine H-Brücke die Polarität. PWM legt dabei nicht einfach eine kleinere Spannung an, sondern schaltet die Versorgung schnell ein und aus; Motor und Treiber reagieren auf den mittleren Energieeintrag. Frequenz, Tastgrad, Stromspitzen und Erwärmung müssen zum Motor und Treiber passen.",
            "Die Stromversorgung wird nach Anlauf- und Blockierstrom ausgelegt, nicht nur nach dem Wert im Leerlauf. Ein Motor kann beim Start oder wenn er mechanisch blockiert deutlich mehr Strom ziehen. Gemeinsame Masse, kurze Leistungswege, Schutz gegen Verpolung, passende Sicherung und ausreichende Pufferung verhindern, dass der Motor die Versorgung des Mikrocontrollers einbrechen lässt. Der Treiber oder eine Schutzbeschaltung übernimmt außerdem den sicheren Weg für die beim Abschalten entstehende Energie.",
          ],
          learningProjects: [
            {
              model: "Lernprojekt",
              title: "Motoransteuerung mit einem kleinen DC-Motor",
              description: "Wähle eine Bewegungsaufgabe, verbinde einen Motor über einen fertigen H-Brücken-Treiber und entwickle eine sichere PWM-Steuerung mit Endschalter und Zeitlimit.",
              href: "/app/learn/?catalog=motor-control-basics",
            },
          ],
        },
        {
          id: "actuator-safe-motion",
          heading: "Sicher bewegen: Rückmeldung und Fehlerfälle",
          paragraphs: [
            "Eine Bewegung ist erst abgeschlossen, wenn das System sie überprüft hat. Ein Endschalter, Reed-Kontakt, Encoder oder Stromsensor kann melden, ob eine Endlage erreicht wurde, sich die Welle tatsächlich dreht oder etwas blockiert. Ohne Rückmeldung weiß die Firmware bei einem DC-Motor meist nur, dass sie Energie angefordert hat – nicht, ob die Mechanik ihr Ziel erreicht hat.",
            "Für jede Bewegung gehört ein sicherer Abbruch dazu: maximale Laufzeit, klarer Stopp bei Endlage, Verhalten bei widersprüchlichen Sensoren und ein definierter Zustand nach Neustart. Bei Klappen, Türen oder anderen bewegten Teilen muss außerdem über Einklemmen, unerwartete Hindernisse und manuelle Bedienung nachgedacht werden. Eine Fernverbindung darf keine lokale Sicherheitslogik ersetzen.",
            "Beginne beim Lernen mit ungefährlicher Kleinspannung und einem kleinen, frei laufenden Motor oder einer Testmechanik. Leistungsstarke Motoren, große Akkus, Netzspannung oder Bewegungen in der Nähe von Menschen brauchen zusätzliche Schutztechnik, geeignete Mechanik und fachkundige Prüfung.",
          ],
        },
        {
          id: "actuator-driver-circuits",
          heading: "Schaltungen zur Ansteuerung",
          paragraphs: [
            "Ein GPIO-Pin liefert nur ein schwaches Logiksignal. Er darf Motoren, Relais, Pumpen oder Magnetventile nicht direkt versorgen. Eine Treiberschaltung übernimmt die Leistung: Der Mikrocontroller gibt den Befehl, der Treiber schaltet die Energie für den Aktor.",
            "Für Gleichstromlasten werden häufig Transistoren oder MOSFETs verwendet. Relais, Motoren und Magnetventile erzeugen beim Abschalten eine Spannungsspitze; eine passende Freilaufdiode oder ein spezialisierter Treiber schützt die Schaltung. Motoren brauchen je nach Richtung und Regelung H-Brücken oder fertige Motortreiber. Servos benötigen eine stabile, ausreichend dimensionierte Versorgung und ein PWM-Steuersignal.",
            "Versorgung und Signalmasse müssen bewusst geplant werden. Eine getrennte Aktorversorgung kann Störungen vom Mikrocontroller fernhalten, braucht aber bei nicht galvanisch getrennter Ansteuerung meist einen definierten gemeinsamen Bezug. Sicherungen, Strombegrenzung, korrekte Leitungsquerschnitte und Schutz vor Verpolung gehören zur Schaltung. Vor dem Anschluss Datenblatt, Spannungsbereich, Spitzenstrom und Wärmeentwicklung prüfen.",
          ],
        },
      ],
      relatedTopics: [
        "microcontroller-gpio",
        "microcontroller-pwm",
        "physical-limits",
        "embedded-safety",
      ],
    },
};
