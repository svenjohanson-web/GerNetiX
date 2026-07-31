// Wissensspeicher: Funktechnologien.
const KnowledgeArticlesRadio = {
    "radio-technologies-understand": {
      title: "Funktechnologien verstehen",
      summary: "Funk verbindet Geräte ohne Leitung, aber nicht ohne physikalische Grenzen. Dieses Kapitel erklärt die gemeinsamen Grundlagen und vergleicht Bluetooth, WLAN, LoRa, Zigbee, NFC und RC-Funksysteme anhand ihrer Eigenschaften, Vor- und Nachteile.",
      access: "premium",
      sections: [
        {
          id: "radio-systems-introduction",
          heading: "Generelle Einleitung zu Funksystemen",
          paragraphs: [
            "Bei einer Funkübertragung überträgt ein Sender die Daten auf ein schnell schwingendes elektrisches Signal. Die Antenne strahlt daraus eine elektromagnetische Welle ab. Ein Empfänger nimmt nur einen sehr kleinen Teil dieser Energie auf und gewinnt daraus die gesendete Information zurück. Frequenz, Frequenzband, Kanal, Bandbreite, Modulation, Sendeleistung, Antenne und Protokoll bestimmen gemeinsam, wie die Verbindung arbeitet.",
            "Funk ist kein unsichtbares Kabel. Alle Teilnehmer teilen sich das Spektrum mit anderen Sendern und mit physikalischen Störungen. Mauern, Metall, Wasser, Menschen, die Lage der Antenne und Reflexionen verändern das Signal. Reichweite ist deshalb keine feste Produkteigenschaft, sondern das Ergebnis aus Sender, Empfänger, Antennen, Umgebung, Datenrate und geforderter Zuverlässigkeit.",
            "Funktechniken lassen sich nur für einen festgelegten Anwendungsfall sinnvoll vergleichen. Eine Satellitenverbindung kann gleichzeitig eine sehr große Entfernung und eine hohe Datenrate erreichen, nutzt dafür aber beispielsweise leistungsfähige Bodenstationen, gerichtete Antennen, zugeteilte Bandbreite und eine aufwendige Infrastruktur. Das widerspricht keiner physikalischen Regel. Es ist lediglich ein anderer technischer Aufwand als bei einem batteriebetriebenen Sensor mit kleiner Leiterplattenantenne.",
            "Darum genügt es nicht, einer Funktechnik pauschal eine Reichweite oder Datenrate zuzuschreiben. Zu jedem Vergleich gehören Randbedingungen: Sendeleistung, Antennen, Frequenz und Bandbreite, Umgebung, Gegenstelle, Infrastruktur, Bewegungszustand und die geforderte Erfolgsquote. Erst dann lassen sich die folgenden Größen belastbar gegenüberstellen.",
          ],
          table: {
            headers: [
              "Vergleichsgröße",
              "Was bedeutet dieser Begriff?",
              "Wichtige Randbedingungen",
            ],
            rows: [
              [
                "Reichweite und Abdeckung",
                "Die Reichweite ist die überbrückbare Entfernung zwischen Sender und Empfänger. Die Abdeckung beschreibt den räumlichen Bereich, in dem eine Verbindung möglich ist.",
                "Freie Sicht oder Gebäude, Sendeleistung, Antennen, Höhe, Wetter, Frequenz sowie direkte Verbindung oder Infrastruktur.",
              ],
              [
                "Nutzdatenrate",
                "Die Menge der tatsächlich nutzbaren Anwendungsdaten, die pro Sekunde ankommt. Protokollinformationen, Fehlerkorrektur und Wiederholungen zählen nicht zu den Nutzdaten.",
                "Richtung, Entfernung, Kanalbandbreite, Signalqualität, Teilnehmerzahl und betrachtete Paketgröße.",
              ],
              [
                "Latenz und Schwankung",
                "Die Latenz ist die Zeit zwischen dem Absenden und dem Eintreffen einer Information. Ihre Schwankung beschreibt, wie unterschiedlich diese Übertragungszeit von Nachricht zu Nachricht ausfällt.",
                "Schlafmodus, Kanalzugriff, Netzlast, Weiterleitungen, Entfernung und Angabe als Einwegzeit oder Round Trip Time.",
              ],
              [
                "Zuverlässigkeit und Fehlertoleranz",
                "Zuverlässigkeit beschreibt, mit welcher Wahrscheinlichkeit Nachrichten rechtzeitig und fehlerfrei ankommen. Fehlertoleranz bezeichnet die Fähigkeit, trotz Störungen, Übertragungsfehlern oder ausgefallenen Wegen weiterzuarbeiten.",
                "Störpegel, Abschattung, Bewegung, Paketverlustrate sowie Verfahren wie Prüfsummen, Wiederholungen, Fehlerkorrektur, Frequenzwechsel, Diversity oder alternative Routen.",
              ],
              [
                "Infrastrukturabhängigkeit und Verfügbarkeit",
                "Infrastrukturabhängigkeit bedeutet, dass zusätzliche Einrichtungen wie Access Point, Basisstation, Gateway, Betreiberkernnetz oder Satellit benötigt werden. Verfügbarkeit beschreibt, wie häufig die Verbindung tatsächlich nutzbar ist.",
                "Lokale Abdeckung, Internet- beziehungsweise Betreiberabhängigkeit, Sicht zum Himmel, Redundanz und Verhalten bei Ausfall einer Zwischenstation.",
              ],
              [
                "Energiebedarf",
                "Die elektrische Energie, die für Senden, Empfangen, Bereitschaft und Aufwachen benötigt wird. Sie kann pro Nachricht, pro Nutzbit oder für einen vollständigen Betriebszyklus angegeben werden.",
                "Sendeintervall, Empfangsbereitschaft, Verbindungsaufbau, Wiederholungen, Sendeleistung und Stromversorgung des konkreten Geräts.",
              ],
              [
                "Kapazität und Koexistenz",
                "Die Kapazität beschreibt, wie viele Geräte oder gleichzeitige Übertragungen ein Funkbereich verkraftet. Koexistenz ist die Fähigkeit verschiedener Funknutzer, denselben räumlichen und spektralen Bereich möglichst störungsarm zu teilen.",
                "Verfügbare Kanäle, Kanalbreite, Zugriffsverfahren, Duty Cycle, räumliche Wiederverwendung, Störer und gewünschte Datenrate je Teilnehmer.",
              ],
              [
                "Mobilität und Netzstruktur",
                "Mobilität beschreibt den Betrieb während sich Teilnehmer bewegen oder zwischen Funkzellen wechseln. Die Netzstruktur legt fest, ob Geräte direkt, über eine zentrale Station oder über mehrere vermaschte Zwischenstationen kommunizieren.",
                "Geschwindigkeit, Übergabezeit, Zahl der Zwischenstationen, Routing und Verhalten beim Verlassen der Abdeckung.",
              ],
            ],
          },
        },
        {
          id: "radio-basic-terms",
          heading: "Warum Funk eine Frequenz braucht",
          illustration: {
            src: "/assets/radio-frequency-and-spectrum.png",
            alt: "Oben eine Sinusschwingung über der Zeit mit markierter Periodendauer, unten dieselbe Schwingung als einzelner Strich bei ihrer Frequenz im Frequenzspektrum",
            caption: "Dieselbe reine Sinusschwingung in zwei Darstellungen: über der Zeit und als einzelner Strich im Frequenzspektrum.",
          },
          paragraphs: [
            "Stell dir regelmäßige Wellen auf einer Wasseroberfläche vor. An einer festen Stelle kommt ein Wellenberg nach dem anderen vorbei. Die Frequenz sagt, wie viele vollständige Wellen dort pro Sekunde vorbeikommen. Bei Funkwellen bewegt sich zwar kein Wasser, aber auch sie wiederholen sich regelmäßig. Eine vollständige Wiederholung pro Sekunde heißt ein Hertz. Eine Million Wiederholungen pro Sekunde heißt ein Megahertz.",
            "Warum ist das nützlich? Denke an ein gewöhnliches Radio: Mehrere Sender senden gleichzeitig, aber auf unterschiedlichen Frequenzen. Wenn du eine Frequenz einstellst, wählt das Radio den passenden Sender aus und blendet die anderen weitgehend aus. Digitale Funktechniken stimmen ebenfalls ab, welche Frequenzen oder Kanäle sie nach welchen Regeln verwenden. So kann ein Empfänger die für ihn bestimmte Übertragung erkennen.",
          ],
        },
        {
          id: "radio-modulation-bandwidth",
          heading: "Wie aus dem Spektralstrich eine Signalbandbreite wird",
          illustration: {
            src: "/assets/radio-modulation-bandwidth.png",
            alt: "Ein einzelner Spektralstrich wird durch Modulation zu einem Signal mit belegter Bandbreite; darunter liegen Signalbandbreite und Kanal innerhalb eines vorgegebenen Frequenzbands",
            caption: "Modulation erzeugt zusätzliche Frequenzanteile. Das dadurch breitere Signal liegt in einem Kanal, der wiederum Teil eines vorgegebenen Frequenzbands ist.",
          },
          paragraphs: [
            "Die erste Grafik zeigt einen idealen Sonderfall: eine reine Sinusschwingung, die unverändert und ohne Anfang oder Ende weiterläuft. Im hier gezeigten Frequenzspektrum erscheint sie als genau ein Strich bei ihrer Frequenz. Weil sich an dieser Schwingung nichts ändert, überträgt sie allein noch keine Folge unterschiedlicher Daten.",
            "Um Daten zu übertragen, verändert der Sender die Schwingung gezielt. Er verändert zum Beispiel ihre Stärke, ihre Frequenz oder ihre Phasenlage. Das heißt Modulation. Dadurch besteht das gesendete Signal nicht mehr nur aus der einen Trägerfrequenz f₀. Im Spektrum entstehen zusätzliche Frequenzanteile um f₀. Der Abstand von der niedrigsten bis zur höchsten belegten Frequenz ist die belegte Signalbandbreite.",
            "Die Modulation erzeugt also kein Frequenzband. Ein Frequenzband wird unabhängig vom einzelnen Signal durch Regulierung und technische Festlegungen vorgegeben, zum Beispiel ein ISM-Band. Eine Funktechnik legt darin Kanäle fest. Jeder Kanal stellt einen begrenzten Frequenzbereich für eine Übertragung bereit. Das modulierte Signal muss mit seiner belegten Signalbandbreite in den vorgesehenen Kanal passen.",
          ],
          table: {
            headers: [
              "Begriff",
              "Einfach erklärt",
              "Warum er wichtig ist",
            ],
            rows: [
              [
                "Frequenz",
                "Sie sagt, wie schnell eine Funkwelle hin und her schwingt. Gemessen wird sie in Hertz.",
                "Eine reine, unveränderte Sinusschwingung erscheint im einseitigen Spektrum als ein Strich bei dieser Frequenz.",
              ],
              [
                "Frequenzband",
                "Ein vorgegebener Frequenzbereich, der für bestimmte Nutzungen vorgesehen ist, zum Beispiel ein ISM-Band.",
                "Das Frequenzband existiert unabhängig von einem einzelnen Signal und enthält meist mehrere Kanäle.",
              ],
              [
                "Kanal",
                "Ein durch die Funktechnik definierter Teil innerhalb eines Frequenzbands.",
                "Er gibt einer Übertragung einen begrenzten Platz und hilft, mehrere Übertragungen voneinander zu trennen.",
              ],
              [
                "Bandbreite",
                "Ein Maß für die Breite eines Frequenzbereichs. Gemeint sein kann die belegte Breite eines Signals oder die bereitgestellte Breite eines Kanals.",
                "Darum sollte immer dazugesagt werden, ob von Signalbandbreite oder Kanalbandbreite die Rede ist.",
              ],
              [
                "Modulation",
                "Die Art, wie Daten auf die Funkwelle übertragen werden, etwa durch gezielte Änderungen ihrer Stärke, Frequenz oder Phasenlage.",
                "Sie erzeugt zusätzliche Frequenzanteile und bestimmt dadurch mit, welche Signalbandbreite benötigt wird.",
              ],
              [
                "Sendeleistung",
                "Die elektrische Leistung, mit der das Funksignal abgestrahlt wird.",
                "Mehr Leistung kann den Empfang verbessern, benötigt aber mehr Energie und ist gesetzlich begrenzt.",
              ],
              [
                "Antenne",
                "Sie wandelt das elektrische Signal in eine elektromagnetische Welle um – und beim Empfang wieder zurück.",
                "Bauform, Ausrichtung, Einbauort und Abstimmung auf die Frequenz beeinflussen die Verbindung stark.",
              ],
              [
                "Protokoll",
                "Gemeinsame Regeln für Aufbau, Reihenfolge, Adressen, Bestätigungen und Fehlerbehandlung der übertragenen Nachrichten.",
                "Nur wenn Sender und Empfänger dieselben Regeln verwenden, können sie die Daten richtig verstehen.",
              ],
            ],
          },
        },
        {
          id: "radio-ask-ook-example",
          heading: "Beispiel: 100 Prozent ASK – Träger an und aus",
          illustration: {
            src: "/assets/radio-ask-ook-spectrum.png",
            alt: "Ein Träger wird durch ein rechteckiges Ein-Aus-Signal geschaltet; die Spektren zeigen Seitenlinien im Abstand von 1 Hertz und 1 Kilohertz um die Trägerfrequenz",
            caption: "Bei periodischem Ein- und Ausschalten entstehen symmetrische Seitenlinien um die Trägerfrequenz. Schnelleres Schalten vergrößert ihre Abstände.",
          },
          paragraphs: [
            "Ein besonders anschauliches Beispiel ist Amplitude Shift Keying, kurz ASK. Dabei verändert der Sender die Stärke des Trägers. Im einfachsten Grenzfall gibt es nur zwei Zustände: volle Stärke bedeutet „an“, null bedeutet „aus“. Diese 100-Prozent-ASK wird auch On-Off Keying, kurz OOK, genannt.",
            "Für die Schaltfrequenz zählt eine vollständige Wiederholung. Ein Zyklus besteht hier aus einer An-Zeit und einer Aus-Zeit. Dauert beides zusammen eine Sekunde, beträgt die Schaltfrequenz 1 Hertz. Wird dagegen nur einmal pro Sekunde zwischen an und aus umgeschaltet, dauert ein vollständiger Zyklus zwei Sekunden und die Schaltfrequenz beträgt 0,5 Hertz.",
            "Beim Schalten mit einem vollständigen Zyklus pro Sekunde entsteht keine neue Funklinie bei absolut 1 Hertz. Die Trägerlinie bei f₀ bleibt erhalten. Zusätzlich entstehen Seitenlinien im Abstand von 1 Hertz um den Träger, also zunächst bei f₀ minus 1 Hertz und f₀ plus 1 Hertz. Weil hartes Ein- und Ausschalten eine Rechteckform besitzt, kommen weitere, schwächere Seitenlinien bei f₀ plus oder minus 3 Hertz, 5 Hertz und weiteren ungeraden Vielfachen hinzu.",
            "Bei 1000 vollständigen Ein-/Aus-Zyklen pro Sekunde beträgt der erste Abstand 1 Kilohertz; weitere Seitenlinien folgen bei 3 Kilohertz, 5 Kilohertz und so weiter. Das Spektrum wird dadurch weiter auseinandergezogen. Ein ideal scharfes Rechteck hätte unendlich viele immer schwächere Seitenlinien. Reale Sender begrenzen sie durch endliche Schaltzeiten und Filter. Bei einer unregelmäßigen Datenfolge sind außerdem keine einzelnen, gleichmäßig angeordneten Linien mehr zu sehen; es entsteht ein zusammenhängenderes Spektrum. Datenrate und Signalformung bestimmen dann wesentlich die belegte Signalbandbreite.",
          ],
        },
        {
          id: "radio-data-rate-limits",
          heading: "Warum die Datenrate nicht unendlich sein kann",
          paragraphs: [
            "Je mehr Daten pro Sekunde übertragen werden sollen, desto schneller muss sich das Signal ändern. Schnellere Signaländerungen benötigen höhere Frequenzanteile und damit mehr Bandbreite. Unendlich viele Daten in beliebig kurzer Zeit würden deshalb unendlich schnelle Änderungen und beliebig hohe Frequenzanteile verlangen.",
            "Das ist mit realer Schaltungstechnik nicht möglich. Transistoren, Verstärker, Wandler, Leiterbahnen, Steckverbinder, Filter und Antennen können nur einen begrenzten Frequenzbereich verarbeiten. Parasitäre Kapazitäten und Induktivitäten, endliche Schaltzeiten und zunehmende Verluste dämpfen hohe Frequenzanteile und verhindern unendlich steile Signalflanken.",
            "Auch der Funkweg stellt keinen unbegrenzten Frequenzbereich bereit. Bei gleicher Entfernung und gleichbleibenden Antennengewinnen steigt die Freifelddämpfung mit der Frequenz. Luft, Regen, Wände und andere Materialien dämpfen oder absorbieren bestimmte hohe Frequenzbereiche zusätzlich. Sehr hochfrequente elektromagnetische Wellen existieren zwar weiterhin – bis hin zu Infrarot und Licht –, sie lassen sich aber nicht mit derselben Funktechnik beliebig erzeugen, abstrahlen und empfangen.",
            "Damit ist bereits die grundlegende Grenze erreicht: Weder Schaltung noch Antenne noch Übertragungsweg unterstützen beliebig hohe Frequenzen oder unendlich große Bandbreiten. Weitere praktische Grenzen wie Rauschen, Störungen, erlaubte Sendeleistung und gemeinsam genutzte Kanäle verringern die tatsächlich erreichbare Datenrate zusätzlich.",
          ],
          table: {
            headers: [
              "Größe",
              "Was sie tatsächlich begrenzt",
            ],
            rows: [
              [
                "Mehr Daten pro Sekunde",
                "Erfordern schnellere Signaländerungen und dadurch höhere Frequenzanteile.",
              ],
              [
                "Schaltungstechnik",
                "Kann wegen endlicher Schaltzeiten, parasitärer Bauteile und Verlusten nicht beliebig hohe Frequenzen verarbeiten.",
              ],
              [
                "Funkweg",
                "Freifelddämpfung und frequenzabhängige Absorption erschweren die Übertragung bei hohen Frequenzen.",
              ],
              [
                "Ergebnis",
                "Der nutzbare Frequenzbereich und die Bandbreite bleiben endlich – und damit auch die Datenrate.",
              ],
            ],
          },
        },
        {
          id: "radio-electromagnetic-spectrum",
          heading: "Wo im elektromagnetischen Spektrum gefunkt wird",
          illustration: {
            src: "/assets/electromagnetic-spectrum-radio-applications.png",
            alt: "Das elektromagnetische Spektrum von Funk über Infrarot und sichtbares Licht bis Gammastrahlung sowie eine Übersicht der Funkbereiche VLF bis EHF mit typischen Anwendungen",
            caption: "Schematische, nicht maßstäbliche Übersicht: Mit steigender Frequenz ändern sich Wellenlänge, Ausbreitung, mögliche Bandbreite und typische Anwendung.",
          },
          paragraphs: [
            "Funkwellen, Infrarot, sichtbares Licht, Ultraviolett-, Röntgen- und Gammastrahlung gehören zum selben elektromagnetischen Spektrum. Nach rechts steigt in der Grafik die Frequenz, während die Wellenlänge kleiner wird. Für Funk werden die klassischen Bereiche von VLF bis EHF verwendet. Weil jeder Bereich den zehnfachen Frequenzumfang des vorherigen umfasst, wird ein vollständiges Frequenzspektrum normalerweise auf einer logarithmischen Achse dargestellt. Die gleich breiten Felder der Grafik dienen nur der gut lesbaren Übersicht.",
            "Niedrige Funkfrequenzen besitzen große Wellenlängen. Sie können Hindernisse besser umgehen, sich teilweise entlang der Erdoberfläche ausbreiten oder – im Kurzwellenbereich – über die Ionosphäre große Entfernungen überbrücken. Dafür werden große Antennen benötigt und es steht meist nur wenig Bandbreite für Daten zur Verfügung.",
            "Mit steigender Frequenz werden Antennen kleiner und häufig größere Kanalbandbreiten möglich. Dadurch eignen sich höhere Bereiche gut für Mobilfunk, WLAN, Richtfunk, Satellitenverbindungen und Radar. Gleichzeitig werden Sichtverbindung, genaue Antennenausrichtung und freie Ausbreitungswege wichtiger. Wände, Regen und atmosphärische Absorption können hohe Frequenzen stärker beeinträchtigen.",
            "Die genannten Anwendungen sind Beispiele und keine vollständige Frequenzzuweisung. Welche Teilbereiche tatsächlich verwendet werden dürfen, mit welcher Leistung und unter welchen Bedingungen, wird regional festgelegt. In Deutschland ist dafür der Frequenzplan der Bundesnetzagentur maßgeblich; Funkstandards teilen geeignete Bereiche anschließend in konkrete Kanäle auf.",
          ],
          table: {
            headers: [
              "Funkbereich",
              "Typische Eigenschaften",
              "Typische Anwendungen",
            ],
            rows: [
              [
                "VLF / LF – 3 bis 300 kHz",
                "Sehr große Wellenlängen und Reichweiten, große Antennen, geringe Datenrate",
                "Zeitzeichen, Navigation und spezialisierte Langstreckenkommunikation",
              ],
              [
                "MF / HF – 0,3 bis 30 MHz",
                "Bodenwelle oder große Reichweite über die Ionosphäre, begrenzte Bandbreite",
                "Mittel- und Kurzwelle, CB-, Amateur-, See- und internationaler Funk",
              ],
              [
                "VHF – 30 bis 300 MHz",
                "Gute regionale Ausbreitung mit noch handlichen Antennen",
                "UKW-Radio, DAB+, Flugfunk und Seefunk",
              ],
              [
                "UHF – 0,3 bis 3 GHz",
                "Kompakte Antennen und guter Kompromiss aus Reichweite und Datenrate",
                "Mobilfunk, GNSS, 433-/868-MHz-Kurzstreckenfunk sowie WLAN und Bluetooth bei 2,4 GHz",
              ],
              [
                "SHF – 3 bis 30 GHz",
                "Mehr verfügbare Bandbreite, stärker gerichtete Ausbreitung und häufiger Sichtverbindung",
                "WLAN bei 5 und 6 GHz, Richtfunk, Satellitenfunk und Radar",
              ],
              [
                "EHF – 30 bis 300 GHz",
                "Sehr kleine Wellenlängen, hohe mögliche Bandbreite, kurze oder stark gerichtete Funkwege",
                "60-/77-GHz-Radar und Millimeterwellen-Richtfunk",
              ],
            ],
          },
        },
        {
          id: "radio-frequency-allocation-ism",
          heading: "Warum nicht jeder beliebig funken darf",
          paragraphs: [
            "Das nutzbare Funkspektrum ist eine gemeinsam verwendete und begrenzte Ressource. Wenn mehrere starke Sender gleichzeitig denselben Frequenzbereich belegen, überdecken sich ihre Signale. Ein Empfänger kann die gewünschte Nachricht dann möglicherweise nicht mehr erkennen. Ohne gemeinsame Regeln würden immer mehr Sender Leistung und Bandbreite beanspruchen, bis zuverlässiger Funk für alle Beteiligten kaum noch möglich wäre.",
            "Deshalb benötigt jede Frequenznutzung in Deutschland eine Frequenzzuteilung. Dafür gibt es zwei grundlegende Wege. Bei einer Einzelzuteilung beantragt ein Nutzer bestimmte Frequenzen für einen vorgesehenen Zweck. Die Bundesnetzagentur kann Frequenz, Standort und technische Bedingungen koordinieren, damit beispielsweise Mobilfunk, Rundfunk, Betriebsfunk, Richtfunk oder sicherheitsrelevante Dienste geschützt betrieben werden können. Bei einer Allgemeinzuteilung gibt die Bundesnetzagentur einen Frequenzbereich für die Allgemeinheit oder eine festgelegte Gerätegruppe frei. Ein einzelner Antrag ist dann nicht nötig, alle veröffentlichten Nutzungsbedingungen gelten aber trotzdem.",
            "Der Begriff ISM-Band wird dabei häufig missverstanden. ISM steht für industrielle, wissenschaftliche und medizinische Anwendungen, die Hochfrequenzenergie lokal nutzen, etwa zum Erwärmen, Messen oder Behandeln. Ein ISM-Band ist nicht automatisch ein rechtsfreier Funkbereich. Dass WLAN, Bluetooth oder Kurzstreckengeräte Teile solcher Bereiche ohne Einzelantrag verwenden dürfen, beruht auf passenden Allgemeinzuteilungen und den darin festgelegten Bedingungen.",
            "Eine Allgemeinzuteilung kann unter anderem den erlaubten Frequenzbereich, den Verwendungszweck, die maximale Sendeleistung oder Leistungsdichte, die belegte Bandbreite, den Kanalabstand, die zulässige Sendezeit und Verfahren für Kanalzugang oder Störungsminderung festlegen. Auch unerwünschte Aussendungen, Antennennutzung sowie Innen- oder Außeneinsatz können begrenzt sein. Modulation und Kodierung sind nicht in jedem Bereich vollständig vorgeschrieben. Sie dürfen aber nur so gewählt werden, dass sämtliche Vorgaben der Zuteilung, des verwendeten Funkstandards und der Gerätekonformität eingehalten werden.",
            "Allgemein zugeteilte Frequenzen ermöglichen preiswerte und unkomplizierte Anwendungen wie WLAN, Bluetooth, Sensoren, Fernbedienungen und viele IoT-Geräte. Dafür werden sie gemeinsam, nicht exklusiv und häufig ohne Anspruch auf störungsfreien Betrieb genutzt. Wer dort sendet, muss Störungen durch andere zulässige Nutzer hinnehmen und darf selbst keine schädlichen Störungen verursachen. Genau dieser Kompromiss ermöglicht offene Nutzung, ohne das gemeinsame Spektrum vollständig dem stärksten oder rücksichtslosesten Sender zu überlassen.",
          ],
          table: {
            headers: [
              "Zugangsweg",
              "Was er bedeutet",
              "Typische Folge",
            ],
            rows: [
              [
                "Allgemeinzuteilung",
                "Nutzung ohne individuellen Antrag, aber nur für die festgelegten Geräte, Zwecke und technischen Bedingungen",
                "Einfache Nutzung durch viele Teilnehmer; Frequenzen werden geteilt und sind häufig nicht gegen Störungen geschützt",
              ],
              [
                "Einzelzuteilung",
                "Frequenzen werden auf Antrag für einen bestimmten Nutzer, Dienst, Ort oder Zeitraum koordiniert",
                "Mehr Planbarkeit und Schutz, aber Antrag, Bedingungen und gegebenenfalls Gebühren oder Beiträge",
              ],
              [
                "ISM-Band",
                "Bezeichnung bestimmter Bereiche für industrielle, wissenschaftliche und medizinische Hochfrequenzanwendungen",
                "Keine automatische Erlaubnis für beliebigen Datenfunk; hierfür ist zusätzlich die passende Zuteilung maßgeblich",
              ],
            ],
          },
          list: [
            "Vor dem Senden prüfen, ob für Frequenz und Anwendung eine gültige Allgemeinzuteilung besteht oder eine Einzelzuteilung nötig ist.",
            "Nur Funkgeräte einsetzen, die für den vorgesehenen Einsatz und Frequenzbereich konform sind.",
            "Grenzen für Sendeleistung, Bandbreite, Sendezeit, Kanalzugang und Einsatzort einhalten.",
            "Eine Allgemeinzuteilung niemals mit garantierter Störungsfreiheit oder beliebiger technischer Freiheit verwechseln.",
          ],
        },
        {
          id: "radio-interference-safety",
          heading: "Störungen und sicherheitskritische Anwendungen",
          paragraphs: [
            "Jede Funkübertragung kann gestört werden. Unbeabsichtigt geschieht das durch andere Sender, überfüllte Kanäle, defekte Geräte, elektromagnetisches Rauschen, Abschattung oder Mehrwegeausbreitung. Absichtliches Jamming sendet gezielt Energie oder passende Signale in den genutzten Frequenzbereich, damit der Empfänger die eigentliche Nachricht nicht mehr zuverlässig erkennt.",
            "Verschlüsselung verhindert, dass Unbefugte den Inhalt einfach lesen oder verändern. Authentifizierung hilft zu prüfen, wer eine Nachricht gesendet hat. Beides kann jedoch keinen freien Funkkanal garantieren. Frequenzwechsel, Spreizverfahren, Wiederholungen, mehrere Antennen und unabhängige Funkwege können Störungen erschweren oder überbrücken, aber eine physikalisch garantierte Verfügbarkeit entsteht dadurch nicht.",
            "Darum eignet sich eine einzelne Funkverbindung nicht als alleinige Grundlage für eine sicherheitskritische Funktion. Der technische Entwurf muss Verbindungsverlust erkennen, rechtzeitig in einen sicheren Zustand wechseln und – passend zum Risiko – unabhängige Rückfallebenen besitzen. Funk darf Teil eines sicherheitsgerichteten Gesamtsystems sein, wenn Ausfälle ausdrücklich beherrscht und nach den anzuwendenden Normen nachgewiesen werden.",
            "Ein ziviles Passagierflugzeug darf beispielsweise nicht ausschließlich davon abhängen, dass eine externe Fernsteuerverbindung jederzeit verfügbar ist. Besatzung, Bordautonomie, zertifizierte Navigation und redundante Systeme erhalten die Handlungsfähigkeit auch bei einer gestörten Außenverbindung. Dass Pilotinnen und Piloten in der zivilen Passagierluftfahrt an Bord sind, hat zusätzlich rechtliche, operative, menschliche und historische Gründe; die Störbarkeit einer Fernsteuerstrecke ist ein wichtiger Systemgrund, aber nicht die einzige Begründung.",
          ],
          list: [
            "Sicheren Zustand für den vollständigen Verbindungsverlust definieren.",
            "Timeouts, Plausibilitätsprüfungen und den tatsächlichen Funkzustand überwachen.",
            "Bei hohem Risiko unabhängige Sensorik, lokale Entscheidungsfähigkeit oder einen zweiten Kommunikationsweg vorsehen.",
            "Reichweiten- und Störungstests unter realistischen Bedingungen durchführen.",
            "Verschlüsselung nicht mit garantierter Verfügbarkeit verwechseln.",
          ],
        },
        {
          id: "radio-bluetooth",
          heading: "Bluetooth",
          paragraphs: [
            "Bluetooth ist für Verbindungen im persönlichen Nahbereich gedacht. Bluetooth Classic wird unter anderem für kontinuierliche Audio- und Zubehörverbindungen verwendet. Bluetooth Low Energy, kurz BLE, ist auf kleine Datenmengen und lange Batterielaufzeiten zugeschnitten. Geräte können sich direkt verbinden oder kurze Broadcast-Nachrichten aussenden.",
            "Bluetooth nutzt das weltweit verbreitete 2,4-GHz-Band. Die reale Reichweite reicht je nach Funkklasse, BLE-PHY, Sendeleistung, Antenne und Umgebung von unmittelbarer Nähe bis deutlich darüber. Eine pauschale Meterangabe wäre deshalb irreführend.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Nahbereich, direkte Verbindung, BLE-Broadcast und standardisierte Profile",
                "In Smartphones weit verbreitet; BLE kann sehr energiesparend arbeiten; kein vorhandenes WLAN nötig",
                "Geteiltes 2,4-GHz-Band; geringerer Durchsatz als WLAN; Pairing, Profile und Herstellerdetails können die Kompatibilität erschweren",
              ],
              [
                "Bluetooth Classic für kontinuierliche Daten, BLE für sparsame kurze Übertragungen",
                "Gut für Zubehör, Wearables, Sensoren und die lokale Gerätekonfiguration",
                "Nicht automatisch ein routbares IP-Netz und keine garantierte Funkverfügbarkeit",
              ],
            ],
          },
        },
        {
          id: "radio-wifi",
          heading: "WLAN",
          paragraphs: [
            "WLAN verbindet Geräte über einen Access Point oder in besonderen Betriebsarten direkt miteinander. Es transportiert Netzwerkpakete und bindet ein Gerät dadurch unmittelbar in ein lokales IP-Netz ein. Browseroberflächen, Videodaten, große Messwertmengen und Firmware-Updates können dieselben Protokolle verwenden wie kabelgebundene Computer.",
            "Je nach WLAN-Generation werden unterschiedliche Frequenzbänder, Kanalbreiten und Modulationsverfahren genutzt. Niedrigere Frequenzen erreichen unter vergleichbaren Bedingungen häufig größere Reichweiten, während breitere Kanäle und höhere Frequenzen mehr Daten übertragen können, aber empfindlicher auf Dämpfung reagieren.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Hohe Datenrate, IP-Netz, meist Infrastruktur mit Access Point",
                "Direkte Nutzung von HTTP, MQTT und anderen Internetprotokollen; vorhandene Heim- und Firmennetze; gut für größere Datenmengen",
                "Höherer Energiebedarf als viele Sensornetze; Zugangsdaten und sichere Netzkonfiguration nötig; Kanäle können überlastet sein",
              ],
              [
                "Mehrere Frequenzbänder und Standards mit unterschiedlichen Reichweiten",
                "Geeignet für lokale Webserver, Kameras, OTA-Updates und netzversorgte IoT-Geräte",
                "Abschattung, Roaming und Access-Point-Ausfall müssen berücksichtigt werden",
              ],
            ],
          },
        },
        {
          id: "radio-lora",
          heading: "LoRa und LoRaWAN",
          paragraphs: [
            "LoRa ist ein proprietäres Modulationsverfahren für robuste Übertragung kleiner Datenmengen über große Entfernungen. LoRa allein beschreibt die Funkübertragung; LoRaWAN ist ein darauf aufbauendes Netzwerkprotokoll, bei dem Endgeräte über ein oder mehrere Gateways mit einem Netzwerkserver kommunizieren.",
            "LoRa-Systeme arbeiten häufig in regional freigegebenen Sub-GHz-Bändern. Reichweite und Robustheit steigen mit passenden Spreizfaktoren und kleinen Datenraten, gleichzeitig belegt ein Telegramm den Kanal länger. Frequenzplan, Sendeleistung, Sendezeitbegrenzungen und weitere Vorschriften müssen zur jeweiligen Region passen.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Große Reichweite, geringe Datenrate, kleine Telegramme und oft lange Schlafzeiten",
                "Sehr niedriger mittlerer Energiebedarf; gute Gebäudedurchdringung; entfernte Sensoren lassen sich mit wenigen Gateways erreichen",
                "Nicht für Audio, Video oder häufige große Datenmengen; lange Sendezeit, begrenzte Kanalkapazität und höhere Latenz",
              ],
              [
                "LoRa als Funkstrecke, LoRaWAN als Gateway- und Servernetz",
                "Private Punkt-zu-Punkt-Lösungen und größere Sensornetze möglich",
                "Downlink und häufige Bestätigungen sind begrenzt; Netzbetrieb, Schlüssel und regionale Regeln benötigen Planung",
              ],
            ],
          },
        },
        {
          id: "radio-zigbee",
          heading: "Zigbee",
          paragraphs: [
            "Zigbee ist ein Funkprotokoll für stromsparende Sensoren und Aktoren und baut auf IEEE 802.15.4 auf. Ein Zigbee-Netz besitzt einen Koordinator. Dauerhaft versorgte Geräte können als Router Nachrichten weiterleiten; sparsame Endgeräte dürfen lange schlafen und melden sich nur zu bestimmten Zeiten.",
            "Ein Mesh erweitert die Flächenabdeckung, weil Nachrichten über mehrere Router laufen können. Das ist kein automatisches Reichweitenversprechen: Routerposition, Gerätekompatibilität, Kanalwahl und das Verhalten bei Ausfällen entscheiden über die Qualität des Netzes.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Kleine Datenmengen, Koordinator, Router und schlafende Endgeräte",
                "Lange Batterielaufzeit für Sensoren; viele Smart-Home-Geräte; lokale Netze ohne zwingende Cloud",
                "Koordinator oder Bridge erforderlich; Herstellerbesonderheiten und Geräteprofile können die Integration erschweren",
              ],
              [
                "Stern- und Mesh-Strukturen, häufig im 2,4-GHz-Band",
                "Netzversorgte Router können die Abdeckung schrittweise erweitern",
                "Mesh-Planung und Diagnose sind komplexer; Überschneidungen mit WLAN sind möglich",
              ],
            ],
          },
        },
        {
          id: "radio-nfc",
          heading: "NFC",
          paragraphs: [
            "Near Field Communication, kurz NFC, arbeitet bei 13,56 MHz über magnetische Nahfeldkopplung. Die beabsichtigte Reichweite liegt typischerweise bei wenigen Zentimetern. Ein aktives Lesegerät kann dabei einen passiven Tag mit Energie versorgen, sodass der Tag keine eigene Batterie benötigt.",
            "Die kurze Reichweite ist nicht nur eine Einschränkung, sondern häufig Teil der Bedienidee: Eine Person hält Karte, Smartphone oder Werkzeug bewusst an einen markierten Punkt. Nähe allein ist jedoch kein vollständiger Sicherheitsnachweis; einfache Tag-IDs können je nach Technik ausgelesen oder kopiert werden.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Sehr kurze Reichweite, kleine Datenmengen, aktive Geräte oder passive Tags",
                "Bewusste Bediengeste; günstige Tags ohne Batterie; breite Smartphone-Unterstützung",
                "Keine Fernkommunikation; Ausrichtung und Metall beeinflussen die Kopplung; geringe Datenrate",
              ],
              [
                "Kartenerkennung, Peer-to-Peer und Lesen/Schreiben von Tags",
                "Gut für Zugang, Bezahlen, Pairing, Inventar und Konfigurationsübergabe",
                "Nähe und eine sichtbare ID ersetzen keine sichere Authentifizierung oder Berechtigungsprüfung",
              ],
            ],
          },
        },
        {
          id: "radio-rc-model",
          heading: "Speziallösungen für den RC-Modellbau",
          paragraphs: [
            "Funkfernsteuerungen im RC-Modellbau übertragen wenige, aber zeitkritische Steuerwerte mit möglichst kurzer und gleichmäßiger Verzögerung. Moderne Anlagen arbeiten überwiegend digital im 2,4-GHz-Band, binden einen Empfänger an einen Sender und verwenden herstellerspezifische Protokolle mit Frequenzwechseln oder Spreizverfahren. Telemetrie kann Empfang, Akkuspannung, Höhe oder andere Modelldaten zurückmelden.",
            "Ältere Anlagen nutzten regional zugewiesene feste Kanäle beispielsweise in Bereichen um 27, 35, 40 oder 72 MHz. Kanalabsprachen und passende Quarze waren dort entscheidend. Für besondere Reichweiten existieren heute auch Sub-GHz-Systeme. Welche Frequenzen, Sendeleistungen und Einsatzzwecke erlaubt sind, hängt von Land, Gerätezulassung und Modellart ab.",
            "Die Funkstrecke ist nur ein Teil der Sicherheit. Antennen dürfen nicht durch Akku, Carbon oder Metall ungünstig abgeschattet werden. Vor dem Betrieb gehören Reichweitentest, korrekte Stromversorgung und ein definierter Failsafe dazu. Bei Signalverlust muss das Modell in den für seine Art möglichst ungefährlichen Zustand wechseln; ein Failsafe kann jedoch keine sichere Landung oder vollständige Gefahrenfreiheit garantieren.",
          ],
          table: {
            headers: [
              "Eigenschaften",
              "Vorteile",
              "Nachteile",
            ],
            rows: [
              [
                "Digitale Steuerkanäle, geringe Latenz, gebundener Empfänger und oft Telemetrie",
                "Viele Kanäle; störungsärmerer Parallelbetrieb als bei alten festen Kanälen; Rückmeldung aus dem Modell",
                "Herstellerbindung; Antenneneinbau, Stromversorgung und Reichweite bleiben kritisch",
              ],
              [
                "Frequenzwechsel, Spreizverfahren und optional Antennen- oder Empfängerdiversität",
                "Robustheit gegen einzelne belegte Kanäle und ungünstige Antennenlagen kann steigen",
                "Keine Technik verhindert jede Störung oder absichtliches Jamming; regionale Funkregeln müssen eingehalten werden",
              ],
              [
                "Failsafe bei ungültigem oder fehlendem Signal",
                "Definiertes Verhalten ist besser als das Halten zufälliger letzter Steuerwerte",
                "Der sichere Zustand ist modellabhängig und muss getestet werden",
              ],
            ],
          },
        },
        {
          id: "radio-selection",
          heading: "Funktechnologien vergleichen und auswählen",
          paragraphs: [
            "Beginne nicht mit dem Namen einer Funktechnik, sondern mit der Aufgabe. Bestimme Entfernung und Umgebung, Datenmenge, maximale Latenz, Energiequelle, Teilnehmerzahl, vorhandene Infrastruktur und das Verhalten bei Ausfall. Prüfe danach regionale Zulassung, Geräteverfügbarkeit, Sicherheitsfunktionen und Wartbarkeit.",
            "Mehr Reichweite ist nicht automatisch besser. NFC begrenzt eine Interaktion bewusst auf Nähe. Bluetooth spart Energie bei direktem Smartphone-Bezug. WLAN liefert hohe Datenraten und IP. Zigbee organisiert viele sparsame Hausgeräte. LoRa überbrückt große Entfernungen mit wenigen Daten. RC-Systeme optimieren direkte Steuerung und Failsafe. Die passende Grenze ist Teil der Lösung.",
          ],
          table: {
            headers: [
              "Aufgabe",
              "Naheliegende Technik",
              "Zuerst prüfen",
            ],
            rows: [
              [
                "Smartphone-Zubehör oder lokale Gerätekonfiguration",
                "Bluetooth Low Energy",
                "Profile, Pairing, Reichweite und Batterielaufzeit",
              ],
              [
                "Sehr bewusste Berührung oder Identifikation",
                "NFC",
                "Tag-Sicherheit, Metallumgebung und sehr kleine Reichweite",
              ],
              [
                "Hohe Datenrate, lokales IP-Netz oder Firmware-Update",
                "WLAN",
                "Energie, Abdeckung, Zugangsschutz und Access Point",
              ],
              [
                "Viele sparsame Sensoren und Aktoren im Gebäude",
                "Zigbee",
                "Koordinator, Routerdichte, Profile und Kanalplanung",
              ],
              [
                "Entfernter Sensor mit wenigen Telegrammen",
                "LoRa oder LoRaWAN",
                "Frequenzplan, Sendezeit, Gateway und Downlinkbedarf",
              ],
              [
                "Direkte Steuerung eines RC-Modells",
                "Zugelassenes RC-System",
                "Latenz, Reichweitentest, Antennen, Stromversorgung und Failsafe",
              ],
            ],
          },
        },
        {
          id: "radio-learning-project",
          heading: "Im Lernprojekt selbst vergleichen",
          paragraphs: [
            "Das kostenlose browserbasierte Lernprojekt „Funktechnologien verstehen“ führt durch dieselben Grundlagen und stellt jede Technik in kompakten Vergleichskarten gegenüber. Am Ende leitest du aus einer Anwendung eine begründete Funkentscheidung und das notwendige Verhalten bei Verbindungsverlust ab.",
            "Du findest es nach der Anmeldung im Lernprojekt-Katalog. Für den Grundlagenkurs ist keine Hardware erforderlich. Ein späteres Praxisprojekt kann die ausgewählte Technik mit realen Boards, Antennen, Messwerten und Reichweitentests untersuchen.",
          ],
        },
      ],
      relatedTopics: [
        "communication-basics",
        "security-basics",
        "embedded-safety",
        "bus-systems",
      ],
    },
};
