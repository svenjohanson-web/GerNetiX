// Wissensspeicher: übergreifendes Fachwissen unabhängig von der Plattformhilfe.
const KnowledgeContent = (() => {
  const topics = [
    {
      id: "engineering-thinking",
      title: "Ingenieursmäßig denken",
      description: "Von einer echten Problemstellung zu einer nachvollziehbaren technischen Lösung.",
      access: "public",
      children: [
        {
          id: "from-problem-to-system",
          title: "Vom Problem zu technischen Grundlagen",
          articleId: "from-problem-to-system",
          access: "public",
        },
      ],
    },
    {
      id: "development-processes",
      title: "Entwicklungsprozesse",
      description: "Entwicklungsphasen und Vorgehensmodelle passend zu Klarheit, Risiko und Veränderung auswählen.",
      access: "public",
      children: [
        {
          id: "development-processes-overview",
          title: "Phasen und Vorgehensmodelle",
          articleId: "development-processes-overview",
          access: "public",
        },
      ],
    },
    {
      id: "electrical-engineering",
      title: "Elektrotechnik",
      description: "Physikalische Grundlagen, Messschaltungen sowie Ein- und Ausgangsbeschaltungen verstehen.",
      access: "public",
      children: [
        {
          id: "electrical-basics-and-component-protection",
          title: "Elektrische Grundbegriffe und Bauteilschutz",
          articleId: "electrical-basics-and-component-protection",
        },
        {
          id: "digital-signals-data-and-protocols",
          title: "Digitale Signale, Daten und Protokolle",
          articleId: "digital-signals-data-and-protocols",
        },
        {
          id: "physical-limits",
          title: "Grenzen der Physik",
          articleId: "physical-limits",
        },
        {
          id: "sampling-rate",
          title: "Abtastrate und Shannon-Theorem",
          articleId: "sampling-rate",
        },
        {
          id: "embedded-safety",
          title: "Elektrische und funktionale Sicherheit",
          articleId: "embedded-safety",
        },
      ],
    },
    {
      id: "sensors-and-actuators",
      title: "Sensorik und Aktorik",
      description: "Wie Systeme ihre Umgebung wahrnehmen, Entscheidungen treffen und darauf wirken – von Physik und Elektronik bis zur Firmware.",
      access: "premium",
      children: [
        {
          id: "sensors",
          title: "Sensoren",
          articleId: "sensors",
        },
        {
          id: "actuators",
          title: "Aktoren",
          articleId: "actuators",
        },
      ],
    },
    {
      id: "microcontrollers-and-embedded",
      title: "Mikrocontroller und Embedded",
      description: "Programmierbare Boards, Prozessoren, Firmware-nahe Schnittstellen und systematische Fehlersuche.",
      access: "public",
      children: [
        {
          id: "hardware-landscape",
          title: "Hardware-Landkarte: vom Akku bis Edge AI",
          articleId: "hardware-landscape",
        },
        {
          id: "processor-overview",
          title: "ESP32-Prozessorfamilien im Vergleich",
          articleId: "processor-overview",
        },
        {
          id: "microcontroller-basics",
          title: "Grundlagen Mikrocontroller",
          articleId: "microcontroller-basics",
        },
        {
          id: "bus-systems",
          title: "Bussysteme",
          articleId: "bus-systems",
        },
        {
          id: "embedded-measurement-debugging",
          title: "Embedded-Systeme: Messtechnik und Debugging",
          articleId: "embedded-measurement-debugging",
        },
      ],
    },
    {
      id: "radio-technologies",
      title: "Funktechnologien",
      description: "Drahtlose Übertragung verstehen und Bluetooth, WLAN, LoRa, Zigbee, NFC sowie RC-Funksysteme begründet auswählen.",
      access: "public",
      children: [
        {
          id: "radio-technologies-understand",
          title: "Funktechnologien verstehen",
          articleId: "radio-technologies-understand",
        },
      ],
    },
    {
      id: "software-basics",
      title: "Informatik und Software",
      description: "Wie Software Regeln und Abläufe beschreibt – auf Mikrocontrollern als Firmware, auf Computern als Anwendungen und Dienste.",
      access: "public",
      children: [
        {
          id: "software-basics-introduction",
          title: "Von der Idee zum ausführbaren Programm",
          articleId: "software-basics-introduction",
        },
        {
          id: "yaml-basics",
          title: "YAML: strukturierte Daten lesbar beschreiben",
          articleId: "yaml-basics",
        },
        {
          id: "databases-and-storage",
          title: "Datenbanken, Speicher und Dateiserver",
          articleId: "databases-and-storage",
        },
        {
          id: "workers-and-queues",
          title: "Worker, Queues und Hintergrundaufgaben",
          articleId: "workers-and-queues",
        },
      ],
    },
    {
      id: "distributed-systems",
      title: "Verteilte Systeme",
      description: "Wie Elektrotechnik, Firmware, Netzwerke, Server und Anwendungen zu einem gemeinsamen System werden.",
      serverLandscape: true,
      access: "public",
      children: [
        {
          id: "distributed-systems-introduction",
          title: "Wenn zwei Welten zusammenarbeiten",
          articleId: "distributed-systems-introduction",
        },
        {
          id: "software-basics",
          title: "Software in verteilten Systemen",
          articleId: "software-basics",
        },
        {
          id: "communication-basics",
          title: "Kommunikation und Schnittstellen",
          articleId: "communication-basics",
        },
        {
          id: "server-systems",
          title: "Systemlandschaften und Server",
          articleId: "server-systems",
        },
        {
          id: "local-servers",
          title: "Lokale Server und Gateways",
          articleId: "local-servers",
        },
        {
          id: "internet-vps",
          title: "Internet-Server und VPS",
          articleId: "internet-vps",
        },
        {
          id: "home-server-internet-security",
          title: "Home-Server sicher betreiben: Risiken der Internetfreigabe",
          articleId: "home-server-internet-security",
        },
        {
          id: "cloud-services",
          title: "Cloud-Dienste",
          articleId: "cloud-services",
        },
        {
          id: "choosing-servers",
          title: "Server passend auswählen",
          articleId: "choosing-servers",
        },
      ],
    },
    {
      id: "artificial-intelligence",
      title: "Die Künstliche Intelligenz",
      description: "KI als Werkzeug verstehen: von Sprachassistenten über GPT bis zu lokalen und internetbasierten Sprachmodellen.",
      access: "public",
      children: [
        {
          id: "ai-basics",
          title: "GPT, Alexa und LLMs",
          articleId: "ai-basics",
        },
      ],
    },
    {
      id: "cross-cutting-topics",
      title: "Querschnittsthemen",
      description: "Themen, die jede Systemebene und jedes Projekt betreffen.",
      access: "public",
      children: [
        {
          id: "privacy-basics",
          title: "Datenschutz in vernetzten Projekten",
          articleId: "privacy-basics",
        },
        {
          id: "security-basics",
          title: "Security in vernetzten Projekten",
          articleId: "security-basics",
        },
      ],
    },
    {
      id: "glossary",
      title: "Lexikon",
      description: "Fachbegriffe kurz, verständlich und mit einem praktischen Beispiel nachschlagen.",
      access: "public",
      children: [
        {
          id: "glossary-basics",
          title: "Fachbegriffe einfach erklärt",
          articleId: "glossary-basics",
        },
      ],
    },
  ];
  const articles = {
    "from-problem-to-system": {
      title: "Ingenieursmäßig denken: vom Problem zur Lösung",
      summary: "Ingenieursmäßiges Denken ist heute wichtiger denn je. Ein Studium kann wichtige Grundlagen vermitteln, doch entscheidend ist nicht der Abschluss allein: Ebenso wichtig sind praktische Erfahrung, Aufgeschlossenheit gegenüber neuen Technologien wie KI und die Fähigkeit, Anforderungen zu verstehen und Ergebnisse zu überprüfen.",
      sections: [
        {
          id: "engineering-thinking-problem",
          heading: "Nicht Technologie, sondern Problem",
          paragraphs: [
            "Gerade im Umgang mit KI wird diese Haltung besonders wirksam. Wer Anforderungen präzisiert, Zwischenergebnisse versteht, Annahmen prüft und passende Tests ableitet, kann mit einer KI sehr effektiv arbeiten. Dazu gehört auch zu lernen, wie eine KI eine Anforderung bestmöglich begreift – und zugleich zu wissen, wo die physikalischen, sicherheitstechnischen, normativen und systemischen Grenzen liegen, die eine plausibel klingende Antwort nicht außer Kraft setzen kann.",
            "Ein Ingenieur beginnt selten mit der Frage: Welche Technologie möchte ich einsetzen? Am Anfang steht eine Aufgabe. Ein Unternehmen will Kosten senken, ein Team will einen Fehler vermeiden, ein Mensch will ein Gerät einfacher bedienen oder ein eigenes Projekt umsetzen.",
            "Technik ist dabei ein Mittel, nicht das Ziel. Auch bei KI gilt das: Ein Versprechen wie 'mehr Effizienz durch KI' ist noch keine Lösung. Erst wenn klar ist, welcher Ablauf heute zu langsam, fehlerhaft oder teuer ist, kann man beurteilen, ob KI, eine Automatisierung oder vielleicht nur eine bessere Struktur wirklich hilft.",
            "Ingenieursmäßig denken bedeutet deshalb: Ziel, Rahmenbedingungen, Risiken und Erfolgskriterien zuerst sichtbar machen. Danach wird die kleinste Lösung gesucht, die das Problem zuverlässig löst.",
          ],
        },
        {
          id: "engineering-thinking-knowledge",
          heading: "Wissen, Analyse und KI",
          paragraphs: [
            "Ein technisches Studium ist nicht für jeden der passende Weg. Es verlangt Ausdauer für Mathematik, Modelle, unvollständige Informationen, Fehleranalyse und Verantwortung. Das bedeutet nicht, dass Menschen ohne Studium kein technisches Verständnis haben oder keine anspruchsvollen Projekte bauen können.",
            "Lange war tiefes technisches Wissen vor allem dort gut erreichbar, wo Zeit, Ausbildung oder ein erfahrener Mentor vorhanden waren. Ich möchte dieses Wissen weitergeben, ohne so zu tun, als könne eine einzelne Person jede Frage für alle beantworten.",
            "KI verändert den Zugang: Sie kann Begriffe erklären, Beispiele erzeugen, Code lesen und beim Nachdenken helfen. Sie hat aber keine eigenen Wünsche, kein eigenes Ziel und keine Verantwortung für die Folgen. Die Problemstellung, die Bewertung von Risiken und die Entscheidung, wann ein Ergebnis gut genug ist, bleiben beim Menschen. Genau deshalb passt KI gut zum ingenieursmäßigen Arbeiten: als Werkzeug für einen Menschen, der bewusst entscheidet.",
          ],
        },
        {
          id: "engineering-thinking-learning",
          heading: "Viele Wege ins Lernen",
          paragraphs: [
            "Meine Problemstellung für GerNetiX lautet: Wie kann ich Wissen und Fähigkeiten zu verteilten Systemen so vermitteln, dass Menschen wirklich eigene Projekte umsetzen können? Schon hier gibt es keine Einheitslösung. Manche lesen gern, andere verstehen durch Ausprobieren, wieder andere brauchen Rückfragen oder einen Mentor.",
            "Darum ist GerNetiX kein einzelnes Mammutprojekt und kein Kurs, den alle gleich durchlaufen müssen. Der Lernprojektkatalog bietet kleine Projekte mit unterschiedlichen Schwerpunkten. Du kannst lesen, experimentieren, eine Vorlage verändern oder dir gezielt Unterstützung holen.",
            "Ein gutes Lernprojekt soll Spaß machen, klein beginnen dürfen und keine große Anfangsinvestition verlangen. Gleichzeitig darf es wachsen, wenn du mehr lernen willst.",
          ],
        },
        {
          id: "engineering-thinking-tamagotchi",
          heading: "Die Tamagotchi-Lernreise: ein Projekt wächst mit dir",
          tamagotchiIllustration: true,
          aiIllustrationAfterParagraph: 4,
          paragraphs: [
            "Ein Tamagotchi ist ein gutes Beispiel, weil es klein anfangen kann und jede Erweiterung eine neue, nachvollziehbare Frage aufwirft. Zuerst lebt es als kleine Browser-App. Ein Zustandsautomat entscheidet etwa: satt, hungrig oder Warnung. Das ist bereits ein vollwertiges erstes Projekt.",
            "Soll das Tamagotchi seinen Zustand behalten, wenn die App geschlossen wird? Dann brauchst du dauerhaften Speicher und lernst, warum Daten modelliert und gespeichert werden. Soll es weiterleben, obwohl keine App geöffnet ist? Dann kommt ein Hintergrundprozess dazu. Soll es in deine Tasche? Dann brauchst du ein IoT-Gerät mit Anzeige, Eingaben, eventuell Ton und einer passenden Stromversorgung.",
            "Möchtest du dasselbe Tamagotchi auf Handy, Computer und Gerät sehen, entsteht die nächste Frage: Wie werden Zustände synchronisiert? Ein kleiner Server kann zuerst auf einem ESP-Board laufen. Soll er von mehreren Orten erreichbar sein, wird daraus ein Internet-Server. Wenn zwei Geräte gleichzeitig füttern, musst du Konflikte behandeln. Wenn Fremde es nicht füttern dürfen, brauchst du Identität und Berechtigungen.",
            "Bis hierhin ist dein Tamagotchi ein absolut vorhersehbares Modell. Es reagiert auf dieselben Ereignisse immer auf dieselbe Weise. Das nennt man deterministisch. Im Zeitalter der KI können wir den nächsten Schritt gehen: Das Tamagotchi darf überraschendere Bedürfnisse und Interaktionen entwickeln – und es kann zugleich zu einem kleinen persönlichen Assistenten werden.",
            "Dafür verbinden wir es mit KI. Hier trifft eine früher kaum umsetzbare Anforderung auf verfügbare Technik. Aber auch KI hat Grenzen: Sie beantwortet Fragen nicht von allein, sie braucht einen Auslöser. Außerdem kostet ein Online-Aufruf Geld und benötigt eine Internetverbindung. Die Ingenieursfrage lautet deshalb nicht nur: Können wir KI einsetzen? Sondern: Welches Modell erfüllt unsere Aufgabe mit vertretbarem Aufwand?",
            "Wir könnten die Online-KI jede Stunde fragen, ob das Tamagotchi mit uns interagieren möchte. Das wäre möglich, aber teuer und unnötig abhängig vom Internet. Wir könnten auch ein lokales KI-Modell einsetzen. Je nach Komplexität reicht dafür ein normaler PC, oder es wird spezielle Embedded-Hardware benötigt, etwa ein aktueller Raspberry Pi. Eine dritte Möglichkeit ist, die KI einmalig ein Verhaltensmodell entwickeln zu lassen. Dieses Modell läuft danach lokal und deterministisch. Wenn wir seine Regeln nicht im Detail analysieren, bleibt sein Verhalten für uns trotzdem überraschend.",
            "Für dieses Lernprojekt entscheide ich mich aus Kosten- und Verfügbarkeitsgründen für diese dritte Variante: Wir lassen eine KI einmalig ein Verhaltensmodell erstellen und beobachten anschließend, was daraus entsteht. So wird deutlich: KI ist nicht gleich KI. Je nachdem, was wir erreichen wollen, wählen wir Online-KI, lokale KI oder ein von KI erzeugtes Regelmodell – bewusst statt nur, weil die Technik gerade möglich ist.",
            "So lernst du nicht abstrakt 'alles über IT'. Du hast bei jedem Schritt einen Grund für Zustandsautomaten, Apps, Embedded-Hardware, Kommunikation, Datenspeicherung, Server, Synchronisierung, Sicherheit und nun auch für eine begründete KI-Architekturentscheidung.",
          ],
        },
        {
          id: "engineering-thinking-craft",
          heading: "Planung, Ausführung und Nachweis",
          paragraphs: [
            "Ingenieurmäßiges Denken endet nicht bei der Frage, ob eine Lösung grundsätzlich funktioniert. Es prüft, ob sie für die konkrete Aufgabe geeignet, sicher, wirtschaftlich und mit den geltenden Regeln und Normen vereinbar ist. Ebenso wichtig ist der nachvollziehbare Nachweis, dass die geplante Lösung korrekt umgesetzt wurde.",
            "Daraus entstehen gelegentlich Missverständnisse zwischen Ingenieuren und Handwerkern: Das Handwerk konzentriert sich häufig auf die fachgerechte praktische Ausführung, während die ingenieurmäßige Aufgabe Anforderungen klärt, Lösungswege bewertet, Risiken beherrscht und Ergebnisse überprüfbar macht. Das ist jedoch keine starre Trennung. Ingenieure bauen Prototypen, messen, testen und arbeiten praktisch; Handwerker lösen technische Probleme, beurteilen Randbedingungen und bringen wertvolles Erfahrungswissen in die Planung ein. Beides gehört zusammen.",
            "Ein Studium vermittelt dafür wichtige Grundlagen, Modelle und mathematische Werkzeuge. Viele Übungsaufgaben sind bewusst klar abgegrenzt: Die benötigten Größen sind bekannt, eine passende Formel kann angewendet werden und mit dem Ergebnis ist die Aufgabe abgeschlossen. Im Berufsleben ist die Problemstellung dagegen oft noch unvollständig. Materialien verhalten sich nicht ideal, Anforderungen widersprechen sich, Bauteile haben Toleranzen und eine rechnerisch richtige Lösung muss sich erst in der Praxis bewähren.",
            "Dieses praktische Wissen entsteht nicht allein am Schreibtisch. Basteln bedeutet in diesem Zusammenhang nicht, planlos irgendetwas zusammenzubauen. Es bedeutet, eine Idee greifbar zu machen, Bauteile und Software wirklich zu verstehen, einen eigenen Entwurf auszuprobieren, Fehler zu beobachten und die Lösung zu verbessern. So wird aus theoretischem Wissen belastbare Erfahrung: verstehen, entwickeln, erschaffen.",
          ],
        },
        {
          id: "engineering-thinking-industry",
          heading: "Was das mit Industrie zu tun hat",
          paragraphs: [
            "Auch in der Industrie wird meist nicht die Welt neu erfunden. Vorhandene Technologien werden so kombiniert, dass ein Ziel mit vertretbarem Risiko, nachvollziehbaren Kosten und passendem Aufwand erreicht wird. Forschung ist wichtig, aber sie ist nicht jede Aufgabe.",
            "Die beste technische Lösung ist nicht die größte oder modernste. Warum sollte jedes Auto einen KI-Supercomputer erhalten, wenn ein kleiner Mikrocontroller die Aufgabe sicherer, sparsamer und zuverlässiger erledigt? Die richtige Frage lautet: Welche Fähigkeit wird wirklich gebraucht, und welche Technik erfüllt sie mit möglichst wenig unnötiger Komplexität?",
            "Genau diese Denkweise übst du in GerNetiX. Du lernst Technologien nicht als Sammlung von Schlagwörtern kennen, sondern weil dein Projekt sie an einer bestimmten Stelle wirklich braucht.",
          ],
        },
        {
          id: "engineering-thinking-foundations",
          heading: "Welche Grundlagen verteilte Systeme brauchen",
          paragraphs: [
            "Ingenieursmäßiges Denken sagt noch nicht, wie ein Sensor misst, ein Widerstand eine Spannung begrenzt oder ein Mikrocontroller ein Programm ausführt. Um ein verteiltes System wirklich zu begreifen, brauchen wir deshalb Grundlagen aus zwei Welten: Elektrotechnik und Informatik.",
            "Die Elektrotechnik erklärt, was Hardware physikalisch kann und welche Grenzen sie hat. Ein Widerstand, Kondensator, Transistor oder fest verdrahtetes Logikgatter folgt Material, Schaltung und elektrischen Gesetzen. Diese Bauteile werden nicht durch Software neu beschrieben.",
            "Die Informatik erklärt, wie Software Regeln, Daten und Abläufe beschreibt. Ein Mikrocontroller ist Hardware mit einem Prozessor; auf ihm läuft Firmware – also Software, die die vorhandene Hardware innerhalb ihrer physikalischen Grenzen steuert. Sie entscheidet zum Beispiel, wann ein Sensor gelesen, ein Signal ausgewertet oder ein Ausgang geschaltet wird.",
            "Erst danach kommt das Zusammenspiel: Wenn Geräte, ihre Firmware, Netzwerke, Server und Anwendungen Informationen austauschen, entsteht ein verteiltes System. Die folgenden Kapitel bauen genau in dieser Reihenfolge auf: zuerst Elektrotechnik, dann Mikrocontroller und Embedded, danach Informatik und Software – und schließlich verteilte Systeme.",
            "Du musst dafür nicht von Anfang an alles können. Je nach Problemstellung braucht ein Projekt mehr Elektrotechnik, mehr Informatik oder nur ein grundlegendes Verständnis von einem Bereich. Manche Menschen starten lieber mit Schaltungen und Messungen, andere mit Programmierung, Daten oder Bedienoberflächen. Konzentriere dich zunächst auf deine Stärken und die nächste sinnvolle Aufgabe. Wenn dich der Ehrgeiz packt, kannst du dich Schritt für Schritt in das andere Fachgebiet einarbeiten – genau dafür ist dieses Wissensportal da.",
          ],
        },
      ],
      relatedTopics: [
        "development-processes-overview",
        "software-basics",
        "microcontroller-basics",
        "server-systems",
      ],
      access: "public",
    },
    "development-processes-overview": {
      title: "Entwicklungsprozesse: vom Plan zur Rückkopplung",
      summary: "Entwicklungsprozesse verbinden Anforderungen, Entwurf, Umsetzung, Prüfung und Betrieb. Ingenieurmäßiges Denken wählt das Vorgehen nach Klarheit, Risiko, Änderungsdynamik und notwendigem Nachweis.",
      sections: [
        {
          id: "development-processes-dimensions",
          heading: "Die Prozessdimensionen einer Entwicklungsaufgabe",
          paragraphs: [
            "Ein Entwicklungsprozess ist kein Selbstzweck und keine starre Schablone. Er macht ingenieurmäßiges Denken wiederholbar: Das Problem wird geklärt, Entscheidungen werden begründet, Risiken werden früh sichtbar und Ergebnisse werden gegen die Anforderungen geprüft.",
            "Für die Auswahl des Vorgehens sind mehrere Dimensionen wichtig: Wie klar und stabil sind die Anforderungen? Wie hoch sind Sicherheits-, Qualitäts- und Kostenrisiken? Wie schnell und günstig kann Rückmeldung eingeholt werden? Wie teuer sind späte Änderungen? Wie viel Nachvollziehbarkeit oder formaler Nachweis ist erforderlich? Und wie viele Menschen, Fachgebiete und Systemteile müssen koordiniert werden?",
            "Diese Dimensionen führen selten alle zum gleichen Modell. Ein Projekt kann beispielsweise eine agile Bedienoberfläche mit kurzen Nutzerzyklen entwickeln, während die sicherheitsrelevante Gerätesteuerung nach einem stärker dokumentierten V-Modell abgesichert wird. Ein bewusst begründetes hybrides Vorgehen ist deshalb oft sinnvoller als ein Methodenetikett für das gesamte Projekt.",
          ],
        },
        {
          id: "engineering-thinking-models",
          heading: "Vorgehensmodelle: Struktur für unterschiedliche Aufgaben",
          paragraphs: [
            "Wasserfallmodell, V-Modell und agiles Arbeiten sind keine konkurrierenden Glaubensrichtungen. Sie unterstützen je nach Umfang, Risiko und Problemstellung unterschiedlich: Wie klar ist die Aufgabe schon? Wie teuer wäre ein Fehler? Wie schnell kann sich das Ziel noch verändern?",
          ],
          developmentPhases: true,
          phaseDescriptions: [
            {
              title: "Anforderungen klären:",
              description: "Das Problem, die Ziele, Rahmenbedingungen und Erfolgskriterien werden verständlich beschrieben. Es wird festgelegt, was die Lösung leisten muss – und was ausdrücklich nicht dazugehört.",
            },
            {
              title: "Entwurf erstellen:",
              description: "Es wird entschieden, wie die Lösung grundsätzlich aufgebaut sein soll: Komponenten, Daten, Schnittstellen, Bedienung und technische Risiken werden geplant.",
            },
            {
              title: "Umsetzung realisieren:",
              description: "Der Entwurf wird in funktionierende Hardware, Software, Konfiguration oder Dokumentation überführt. Dabei entsteht etwas, das tatsächlich ausprobiert werden kann.",
            },
            {
              title: "Testen und bewerten:",
              description: "Es wird gezielt geprüft, ob die Lösung die Anforderungen erfüllt. Fehler, Abweichungen und offene Risiken werden sichtbar gemacht und nachvollziehbar bearbeitet.",
            },
            {
              title: "Betrieb und Weiterentwicklung:",
              description: "Die Lösung wird genutzt, überwacht, gewartet und bei Bedarf verbessert. Rückmeldungen aus der Praxis können neue oder veränderte Anforderungen erzeugen.",
            },
          ],
          followUpParagraphs: [
            "Die Phasen werden je nach Vorgehensmodell unterschiedlich verbunden. Man springt nicht beliebig mittendrin zu einem anderen Abschnitt. Wenn neue Erkenntnisse eine Änderung verlangen, wird bewusst zu der Phase zurückgegangen, deren Ergebnis überarbeitet werden muss – mit klarer Begründung und erneutem Durchlaufen der betroffenen Schritte.",
            "Das Wasserfallmodell passt, wenn das Problem sehr genau bekannt ist und sich Anforderungen kaum ändern. Eine große Idee wird schrittweise konkret beschrieben, realisiert und am Ende getestet. Sein Schwerpunkt liegt auf Planbarkeit: Man weiß früh, was wann entstehen soll. Genau das ist aber auch sein Nachteil. Stellt ein später Test fest, dass die Umsetzung oder schon der Entwurf falsch war, muss das starre Modell durch Rücksprünge und Ausnahmeregeln ergänzt werden. Deshalb wird es heute vor allem noch in klar abgegrenzten Bereichen eingesetzt.",
            "Das V-Modell eignet sich besonders für sicherheitsrelevante oder sehr qualitätskritische Systeme. Zu jeder Entwicklungsstufe auf der linken Seite gehört eine passende Prüfstufe auf der rechten Seite: Der Software-Entwurf wird mit Unit-Tests geprüft, der System-Entwurf mit Integrationstests und die Systemanforderung mit Systemtest und Abnahme. Findet ein Test einen Fehler, führt die Rückmeldung gezielt zu der zugehörigen Anforderung oder Entwurfsstufe zurück. So bleibt nachvollziehbar, was geprüft wurde, warum etwas geändert wird und welche Tests danach erneut nötig sind.",
            "Agiles Arbeiten ist sinnvoll, wenn das Ziel noch nicht vollständig klar ist oder sich durch Rückmeldung verändern kann. Statt einen sehr großen Plan einmal komplett umzusetzen, wird in kurzen Zyklen gearbeitet: ein kleines Ziel klären, entwerfen, bauen, prüfen, mit Nutzern bewerten und aus den Erkenntnissen den nächsten Schritt ableiten. Auch hier werden die Entwicklungsphasen nicht ausgelassen; sie werden nur in kleinen, wiederholbaren Abschnitten durchlaufen. Das schafft frühes Feedback und senkt das Risiko, lange an einer Lösung zu arbeiten, die am Ende niemand braucht.",
            "Kein Modell ersetzt Denken. Für ein kleines Lernprojekt kann ein kurzer agiler Zyklus reichen. Für ein fest definiertes Gerät hilft eine wasserfallartige Planung. Für Systeme, bei denen Fehler Menschen gefährden oder hohe Schäden verursachen können, braucht es die nachweisbare Absicherung des V-Modells. Gute Ingenieursarbeit wählt den Prozess, der das Risiko der jeweiligen Aufgabe sinnvoll beherrscht.",
          ],
          waterfallModelAfterFollowUp: 0,
          vModelAfterFollowUp: 1,
          agileModelAfterFollowUp: 2,
          engineeringModels: true,
        },
        {
          id: "development-processes-next-steps",
          heading: "Mit Beispielen weiterlernen",
          paragraphs: [
            "Du hast noch nicht alles verstanden? Kein Problem. Vorgehensmodelle, Tests und Rückkopplungen lernt man nicht durch einen kurzen Text. Sie werden greifbar, wenn du sie in einem konkreten Projekt anwendest, Entscheidungen triffst und die Folgen davon siehst.",
            "Deshalb wird es für jedes Modell ein Lernprojekt mit einer nachvollziehbaren Problemstellung geben. Die folgenden Einträge sind zunächst Platzhalter für diese Beispiele.",
          ],
          learningProjects: [
            {
              model: "Wasserfallmodell",
              title: "Wetterstation mit festem Auftrag",
              description: "Eine klar beschriebene Aufgabe von der Anforderung bis zum Test planen.",
              href: "/app/learn/?project=waterfall-wetterstation",
            },
            {
              model: "V-Modell",
              title: "Zutrittsanzeige mit Prüfnachweisen",
              description: "Anforderungen, Entwurf und passende Tests gezielt miteinander verbinden.",
              href: "/app/learn/?project=v-modell-zutrittsanzeige",
            },
            {
              model: "Agil",
              title: "Tamagotchi in kleinen Zyklen",
              description: "Eine Idee schrittweise bauen, erproben und aus Rückmeldungen weiterentwickeln.",
              href: "/app/learn/?project=agil-tamagotchi",
            },
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "software-basics",
        "embedded-safety",
      ],
      access: "public",
    },
    "ai-basics": {
      title: "Die Künstliche Intelligenz: GPT, Alexa und LLMs",
      summary: "KI ist kein einzelnes Produkt. Entscheidend ist, welche Aufgabe sie lösen soll, wo sie laufen darf und welche Kosten sowie Datenwege dazu passen.",
      access: "premium",
      sections: [
        {
          id: "ai-gpt-and-alexa",
          heading: "GPT und Alexa sind nicht dasselbe",
          paragraphs: [
            "GPT bezeichnet eine Familie großer Sprachmodelle. Solche Modelle können Sprache verstehen und erzeugen, Texte zusammenfassen, Ideen ausarbeiten, Code erklären oder bei Entscheidungen unterstützen. GPT ist dabei das Modell – nicht automatisch eine fertige Anwendung mit Mikrofon, Lautsprecher und Haussteuerung.",
            "Alexa ist dagegen vor allem ein Sprachassistent und ein Produkt: Du sprichst mit einem Gerät oder einer App, die Sprache wird erkannt, eine Anfrage wird verarbeitet und eine Antwort oder Aktion ausgelöst. Klassische Sprachassistenten arbeiten häufig mit fest definierten Befehlen und Diensten, etwa für Timer, Musik oder Smart Home. Sie können LLMs nutzen, sind aber nicht selbst gleichbedeutend mit einem LLM.",
            "Für dein Projekt ist diese Trennung wichtig: Ein Assistent beschreibt die sichtbare Bedienung. Ein LLM ist eine mögliche Denk- und Sprachkomponente dahinter. Dazwischen liegen weiterhin klare Regeln, Berechtigungen, Schnittstellen und die Entscheidung, welche Aktion ein System tatsächlich ausführen darf.",
          ],
        },
        {
          id: "ai-llm",
          heading: "LLM: ein großes Sprachmodell",
          paragraphs: [
            "LLM steht für Large Language Model, also großes Sprachmodell. Vereinfacht gesagt verarbeitet es Text in kleinen Einheiten und berechnet, welche nächste Einheit zu einer Eingabe wahrscheinlich sinnvoll passt. Dadurch kann es Gespräche führen, Inhalte umformulieren und Muster aus vielen Beispielen anwenden.",
            "Ein LLM hat dabei kein eigenes Ziel, keine Wünsche und kein verlässliches Weltverständnis wie ein Mensch. Es erzeugt plausible Antworten auf Grundlage seiner Eingabe und seines Trainings. Deshalb braucht es eine gute Aufgabenbeschreibung, überprüfbare Regeln und bei wichtigen Entscheidungen immer eine menschliche oder technisch klar definierte Kontrolle.",
            "Ein LLM kann als Gesprächspartner dienen, ein Regelmodell für dein Tamagotchi entwerfen oder Texte in strukturierte Daten überführen. Es sollte aber nicht ohne zusätzliche Schutzmechanismen selbstständig Türen öffnen, Geld ausgeben oder sicherheitsrelevante Geräte steuern.",
          ],
        },
        {
          id: "ai-vectors-and-embeddings",
          heading: "Vektoren und Embeddings: Bedeutung als Zahlenraum",
          embeddingVisual: true,
          paragraphs: [
            "Die obere Grafik beginnt links mit einem Inhalt, hier dem Satz: „Das Tamagotchi ist hungrig.“ Ein Vektor ist eine geordnete Liste von Zahlen. In der KI wird dieser Inhalt in sehr viele solche Zahlen übersetzt. Mit Vektorgrafiken hat das nur den Namen gemeinsam: Hier geht es nicht um gezeichnete Linien, sondern um eine technische Zahlenbeschreibung.",
            "In der Mitte entsteht daraus ein Embedding, also ein Zahlenvektor wie [0.12, −0.64, 0.81, …]. Rechts zeigt der Bedeutungsraum, was damit möglich wird: Ähnliche Inhalte liegen als Punkte näher beieinander, deutlich andere Inhalte weiter entfernt. So kann eine Anfrage zu Mikrocontrollern und Netzwerk auch Dokumente finden, die andere, aber fachlich ähnliche Wörter verwenden.",
            "Die untere Grafik zeigt den nächsten Schritt. Eigene Dokumente werden einmal als Dokument-Embeddings gespeichert. Wenn ein Nutzer später eine Anfrage stellt, wird auch diese Anfrage in ein Anfrage-Embedding übersetzt. Das System vergleicht beide Zahlenbeschreibungen und findet die Dokumente, deren Bedeutung am besten zur Frage passt.",
            "Erst danach folgen die eigentliche Systemlogik: passende Quellen auswählen, Regeln und Berechtigungen prüfen und dann eine Antwort oder eine ausdrücklich freigegebene Aktion auslösen. Das wird zum Beispiel für semantische Suche und Retrieval Augmented Generation, kurz RAG, verwendet. Ein Vektor zeigt nur Ähnlichkeit – er ist kein Wahrheitsbeweis und trifft keine Entscheidung selbst.",
          ],
        },
        {
          id: "ai-local-or-online",
          heading: "Lokal oder über das Internet?",
          paragraphs: [
            "Ein internetbasiertes LLM läuft bei einem Anbieter. Dein Gerät sendet die Anfrage über das Internet an dessen Dienst und erhält eine Antwort zurück. Das kann leistungsfähige Modelle ohne eigene starke Hardware ermöglichen. Dafür brauchst du eine Verbindung, musst den Datenweg bewusst bewerten und bist von Verfügbarkeit, Regeln und Preisen des Dienstes abhängig.",
            "Ein lokales LLM läuft auf eigener Hardware: zum Beispiel auf einem PC, einem Server zu Hause oder – bei kleineren Modellen – auf geeigneter Edge-Hardware. Das kann auch ohne Internet funktionieren und gibt dir mehr Kontrolle über Daten und Verfügbarkeit. Im Gegenzug musst du Rechenleistung, Speicher, Energiebedarf, Updates und Betrieb selbst einplanen.",
            "Es gibt keine grundsätzlich bessere Variante. Für eine seltene, anspruchsvolle Frage kann ein Online-Modell sinnvoll sein. Für private Daten, häufige kleine Anfragen oder einen offlinefähigen Assistenten kann ein lokales Modell die bessere Wahl sein. Manchmal ist ein Mischmodell passend: Die eigentliche Steuerung bleibt lokal, nur freiwillige Wissens- oder Kreativaufgaben gehen an einen Online-Dienst.",
          ],
        },
        {
          id: "ai-payment-models",
          heading: "Kosten und Zahlungsmodelle",
          paragraphs: [
            "Bei Online-KI gibt es häufig zwei unterschiedliche Zahlungsarten. Ein Abo bezahlt meist den Zugang zu einer fertigen Anwendung mit bestimmten Funktionen und Grenzen. Es ist nicht automatisch dasselbe wie ein technischer Zugang für deine eigene App oder dein IoT-Projekt.",
            "Für die direkte Einbindung in eigene Software wird oft nutzungsbasiert abgerechnet. Dabei zählen Eingabe und Antwort, meist in Textmengen oder Tokens. Eine einzelne Anfrage kann sehr günstig sein, viele regelmäßige Aufrufe können sich aber summieren. Deshalb gehört zur Architektur immer eine Kostenfrage: Wie oft ist eine KI-Antwort wirklich nötig, und welche günstigere Logik kann dieselbe Aufgabe lokal erledigen?",
            "Ein lokales Modell hat normalerweise keine Abrechnung pro Anfrage durch einen Anbieter. Die Kosten verschwinden dadurch nicht: Hardware, Strom, Speicher, Wartung und gegebenenfalls ein leistungsfähiger PC oder Server gehören zur Rechnung. Ingenieursmäßig gedacht vergleichst du also nicht nur den Preis pro KI-Aufruf, sondern auch Datenschutz, Verfügbarkeit, Antwortzeit, Energiebedarf und den Aufwand für den Betrieb.",
          ],
        },
      ],
      relatedTopics: [
        "from-problem-to-system",
        "server-systems",
        "microcontroller-basics",
      ],
    },
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
            "Jede Technik setzt andere Schwerpunkte. Eine hohe Datenrate benötigt meist mehr Bandbreite und Energie. Eine große Reichweite wird häufig mit geringer Datenrate und längerer Übertragungszeit erreicht. Kurze Latenz, lange Batterielaufzeit, hohe Teilnehmerzahl und große Reichweite lassen sich nicht gleichzeitig maximieren.",
          ],
          table: {
            headers: [
              "Eigenschaft",
              "Bedeutung für die Auswahl",
            ],
            rows: [
              [
                "Reichweite und Umgebung",
                "Entfernung, Wände, Gelände, Metall und Antennenlage bestimmen die reale Funkstrecke.",
              ],
              [
                "Datenrate und Datenmenge",
                "Ein Temperaturwert stellt andere Anforderungen als Audio, Video oder ein Firmware-Update.",
              ],
              [
                "Latenz und Aktualisierungsrate",
                "Steuerbefehle brauchen oft kurze und gleichmäßige Reaktionszeiten; Messwerte dürfen häufig später eintreffen.",
              ],
              [
                "Energiebedarf",
                "Netzversorgte Geräte können häufiger und leistungsstärker senden als ein Sensor mit Knopfzelle.",
              ],
              [
                "Netzstruktur",
                "Direktverbindung, Access Point, Koordinator, Mesh oder Gateway verändern Aufwand und Ausfallverhalten.",
              ],
              [
                "Regulierung",
                "Frequenz, Sendeleistung, Kanalnutzung und zulässiger Einsatzzweck richten sich nach Region und Anwendung.",
              ],
            ],
          },
        },
        {
          id: "radio-basic-terms",
          heading: "Frequenz, Bandbreite und weitere Grundbegriffe",
          paragraphs: [
            "Warum braucht Funk überhaupt eine Frequenz? Eine Funkwelle schwingt regelmäßig. Die Frequenz gibt an, wie oft sie pro Sekunde schwingt, und wird in Hertz gemessen. Sie legt damit den Platz des Signals im Funkspektrum fest. Der Empfänger muss diesen Platz kennen, damit er gezielt auf das gewünschte Signal „hören“ kann und nicht alle Funkübertragungen gleichzeitig verarbeiten muss.",
            "Für unterschiedliche Anwendungen werden zusammenhängende Teile des Funkspektrums als Frequenzbänder festgelegt, zum Beispiel das 2,4-Gigahertz-Band. Innerhalb eines solchen Bandes liegen einzelne Kanäle. Die Bandbreite beschreibt dagegen, wie breit ein Kanal oder ein konkretes Signal im Spektrum ist. Frequenzband und Bandbreite meinen daher nicht dasselbe.",
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
                "Anzahl der Schwingungen pro Sekunde, gemessen in Hertz. 2,4 Gigahertz bedeutet 2,4 Milliarden Schwingungen pro Sekunde.",
                "Sie bestimmt, an welcher Stelle im Funkspektrum Sender und Empfänger arbeiten.",
              ],
              [
                "Frequenzband",
                "Ein zusammenhängender Frequenzbereich, der für bestimmte Funkanwendungen vorgesehen ist, etwa das 2,4-Gigahertz-Band.",
                "Es legt den groben Arbeitsbereich fest und unterliegt regionalen Regeln.",
              ],
              [
                "Kanal",
                "Ein festgelegter Teil innerhalb eines Frequenzbandes – vergleichbar mit einer Fahrspur auf einer mehrspurigen Straße.",
                "Geräte auf unterschiedlichen Kanälen können sich besser ausweichen; überlappende Kanäle können sich stören.",
              ],
              [
                "Bandbreite",
                "Die Breite des Frequenzbereichs, den ein Kanal oder Signal belegt, zum Beispiel 20 Megahertz.",
                "Mehr Bandbreite ermöglicht meist eine höhere Datenrate, belegt aber auch mehr Platz im Funkspektrum.",
              ],
              [
                "Modulation",
                "Die Art, wie Daten auf die Funkwelle übertragen werden, etwa durch gezielte Änderungen ihrer Stärke, Frequenz oder Phasenlage.",
                "Sie beeinflusst Datenrate, Reichweite und Robustheit gegenüber Störungen.",
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
    "privacy-basics": {
      title: "Datenschutz in vernetzten Projekten",
      summary: "Vernetzte Geräte können schnell personenbezogene Daten erzeugen. Gute Projekte erfassen nur, was sie wirklich brauchen, erklären den Zweck und schützen Daten über ihren gesamten Lebenszyklus.",
      access: "premium",
      sections: [
        {
          heading: "Was personenbezogene Daten sein können",
          paragraphs: [
            "Personenbezogene Daten sind Informationen, die eine Person direkt oder indirekt erkennbar machen können. Dazu gehören nicht nur Name und E-Mail-Adresse, sondern je nach Zusammenhang auch Standort, Gerätekennung, Sprachaufnahme, Kamerabild, Bewegungsprofil, Zeitstempel oder Nutzungsverhalten.",
            "Ein einzelner Temperaturwert ist meist unkritisch. Wird er aber einer Wohnung, einem Konto und festen Zeitpunkten zugeordnet, kann er Rückschlüsse auf Anwesenheit oder Gewohnheiten erlauben. Der Kontext entscheidet.",
          ],
        },
        {
          heading: "Datenschutz durch Gestaltung",
          list: [
            "Zweck festlegen: Vor dem Erfassen klar benennen, wofür ein Datum gebraucht wird. Ohne Zweck keine Sammlung.",
            "Daten minimieren: Nur die benötigten Werte, Genauigkeiten und Zeiträume erfassen. Ein Ereignis kann oft besser sein als ein dauerhafter Rohdatenstrom.",
            "Lokal verarbeiten, wenn möglich: Edge Computing kann vermeiden, dass Rohbilder, Audiodaten oder detaillierte Sensordaten den Ort verlassen.",
            "Transparenz schaffen: Nutzerinnen und Nutzer verständlich informieren, welche Daten wohin fließen, wie lange sie gespeichert bleiben und wer Zugriff hat.",
            "Schützen und löschen: Zugriffe begrenzen, Übertragung absichern, Daten getrennt speichern und Lösch- beziehungsweise Aufbewahrungsregeln umsetzen.",
          ],
        },
        {
          heading: "Beispiele",
          table: {
            headers: [
              "Projekt",
              "Datensparsame Lösung",
              "Warum",
            ],
            rows: [
              [
                "Bewegungsmelder für Licht",
                "Nur Bewegung erkannt / nicht erkannt lokal verarbeiten; keine dauerhafte Personenhistorie speichern.",
                "Die Lichtfunktion benötigt keine Identität und kein Bewegungsprofil.",
              ],
              [
                "Kamera zur Qualitätsprüfung",
                "Bild direkt am Edge-Gerät auswerten; nur Qualitätskennzahl oder Fehlerbild bei Bedarf übertragen.",
                "Rohbilder können Personen oder Betriebsgeheimnisse enthalten.",
              ],
              [
                "Smartes Raumklima",
                "Messwerte pro Raum mit begrenzter Aufbewahrung; Kontodaten und Telemetrie getrennt behandeln.",
                "Lange Zeitreihen können Rückschlüsse auf Anwesenheit ermöglichen.",
              ],
              [
                "iPhone-App",
                "Nur notwendige Berechtigungen anfragen und klar erklären; Standort, Kamera oder Kontakte nicht vorsorglich sammeln.",
                "Mobile Berechtigungen geben tiefen Zugriff auf persönliche Informationen.",
              ],
            ],
          },
        },
        {
          heading: "Datenschutz und Sicherheit gehören zusammen",
          paragraphs: [
            "Datenschutz beantwortet zuerst: Dürfen und müssen wir diese Daten verarbeiten? Sicherheit beantwortet: Wie verhindern wir, dass Unbefugte darauf zugreifen oder sie verändern? Gute Technik braucht beides. Bei echten Produkten kommen außerdem Rechtsgrundlage, Verantwortlichkeiten, Verträge und gegebenenfalls eine Datenschutz-Folgenabschätzung hinzu.",
          ],
        },
      ],
      relatedTopics: [
        "server-systems",
        "embedded-safety",
        "ai-premium",
      ],
    },
    "security-basics": {
      title: "Security in vernetzten Projekten",
      summary: "Security schützt Identitäten, Geräte, Dienste und Daten vor unbefugtem Zugriff und vor ungewollter Veränderung. Sie ist ein Querschnittsthema von der lokalen Hardware bis zum Cloud-Dienst.",
      sections: [
        {
          id: "security-goals",
          heading: "Risikoanalyse: Was müssen wir schützen?",
          securityDoorIllustrations: [
            {
              afterParagraph: 0,
              src: "/assets/security-smart-door-lock.png",
              alt: "Vergleich eines vernetzten Türschlosses im verriegelten und offenen Zustand; nur die berechtigte Person erhält die Statusinformation",
              title: "1. Türstatus ist eine sensible Information",
              caption: "An der realen Tür kann jemand den Zustand nur an diesem Ort und zu diesem Zeitpunkt sehen. Der Fernstatus lässt sich dagegen leise, wiederholt und von weit weg abfragen – deshalb ist er eine schützenswerte Information.",
            },
            {
              afterParagraph: 1,
              src: "/assets/security-smart-door-status-privacy.png",
              alt: "Offene vernetzte Tür; ihr Status wird nur an ein berechtigtes Smartphone gesendet und für andere Personen verborgen",
              title: "2. Eine offene Tür ist keine öffentliche Information",
              caption: "Die cyanfarbene Verbindung zeigt: Nur das berechtigte Smartphone erfährt den Status. Die durchgestrichenen Augen stehen für Personen, die diese Information nicht erhalten sollen.",
            },
            {
              afterParagraph: 2,
              src: "/assets/security-smart-door-remote-attack.png",
              alt: "Ein Krimineller sendet über das Internet einen unberechtigten Öffnungsbefehl an ein vernetztes Türschloss; die Tür steht offen, ohne dass eine Brechstange verwendet wird",
              title: "3. Ein unberechtigter Fernbefehl wäre gefährlich",
              caption: "Der rote Weg führt vom Angreifer über das Internet zum Schloss. Die offene Tür zeigt die Folge. Die durchgestrichene Brechstange steht für den entscheidenden Unterschied: Ein digitaler Angriff kann ohne sichtbare Gewalt und nahezu lautlos erfolgen.",
            },
            {
              afterParagraph: 3,
              src: "/assets/security-smart-door-access-rights.png",
              alt: "Eine Administration fügt einer Person ein zeitlich begrenztes Öffnungsrecht für ein vernetztes Türschloss hinzu",
              title: "3. Eine Administration vergibt ein begrenztes Öffnungsrecht",
              caption: "Links die Administration, in der Mitte die kontrollierte Einladung, rechts die neue Person. Die Uhr bedeutet: Das Öffnungsrecht kann zeitlich begrenzt sein.",
            },
          ],
          paragraphs: [
            "Security beantwortet eine sehr praktische Frage: Wer oder was darf welche Funktion benutzen – und wie prüft das System, ob diese Person oder dieses Gerät dafür berechtigt ist? Ein vernetztes Türschloss zeigt das gut. In der realen Welt kann grundsätzlich jede Person, die direkt vor der Tür steht, sehen oder vorsichtig prüfen, ob sie verriegelt ist. Das kostet aber Zeit, setzt die Person selbst der Beobachtung aus und liefert nur einen einzelnen Moment. Ein Fernstatus ist technisch etwas anderes: Er kann unbemerkt, von überall und beliebig oft abgefragt werden. Aus einer Beobachtung vor Ort wird damit ein dauerhaft erreichbarer Informationsdienst.",
            "Das ist keine theoretische Vorsicht. Wer wiederholt sieht, wann eine Tür geschlossen bleibt, wann sie geöffnet wird oder wie lange niemand kommt und geht, kann Abwesenheiten und Gewohnheiten ableiten. Menschen mit krimineller Absicht könnten solche Informationen nutzen, um Einbrüche zu planen. Aber auch ein Unternehmen oder Verkäufer sollte daraus nicht erkennen können, wann jemand wahrscheinlich zu Hause ist, um diese Person gezielt für ein Verkaufsgespräch anzusprechen. Der Türstatus ist kein Werbedatum, sondern private Sicherheitsinformation.",
            "Noch kritischer als ein ausgespähter Türstatus wäre ein unberechtigter Öffnungsbefehl. Gelingt es jemandem, eine Schwachstelle, ein gestohlenes Konto oder einen zu weitreichenden Fernzugang auszunutzen, kann die Person das Schloss aus der Ferne über das Internet ansprechen. Das kann viel leiser und unauffälliger geschehen als ein Einbruch mit einer Brechstange: Keine Person muss am Haus stehen, keine Tür wird aufgebrochen und Nachbarn sehen oder hören möglicherweise nichts.",
            "Der legitime Anwendungsfall folgt danach: Eine andere Person darf die Tür vielleicht nur zu bestimmten Zeiten öffnen. Das Schloss darf dafür nur signierte, berechtigte Öffnungsbefehle annehmen. Die Eigentümerin kann weitere Personen einladen oder deren Öffnungsrecht wieder entfernen. Rechte werden also gezielt für eine Identität und die konkrete Aktion ‚Tür öffnen‘ vergeben.",
            "Ein Gast erhält zum Beispiel ein zeitlich begrenztes Recht zum Öffnen, die Reinigungskraft nur montags zwischen 9 und 12 Uhr, ein Familienmitglied dauerhaft und die Verwaltung zusätzlich das Recht, andere Zugänge zu vergeben. Läuft eine Berechtigung ab oder geht ein Smartphone verloren, kann das Recht serverseitig widerrufen werden. Die Tür muss dabei auch ohne Internet sicher funktionieren: Ein Netzausfall darf sie nicht unkontrolliert öffnen.",
            "Dabei geht es um vier Ziele. Vertraulichkeit bedeutet: Fremde können nicht sehen, ob jemand zu Hause ist oder wann die Tür geöffnet wurde. Integrität bedeutet: Niemand kann einen Öffnungsbefehl, eine Berechtigung oder das Türprotokoll unbemerkt verfälschen. Verfügbarkeit bedeutet: Berechtigte Personen können die Tür im vorgesehenen Rahmen nutzen und das Schloss bleibt bei Störungen in einem sicheren Zustand. Nachvollziehbarkeit bedeutet: Wichtige Öffnungen, Einladungen, Rechteänderungen und Fehler können später geprüft werden.",
            "Security ist keine Anhäufung einzelner Maßnahmen, sondern ein zusammenhängendes Konzept. Es beginnt mit vier Fragen: Welche Funktionen und Daten möchten wir schützen? Was passiert, wenn sie kompromittiert werden? Wo können potenzielle Angreifer überhaupt ansetzen? Und wie halten wir sie davon ab? Die folgenden Abschnitte beantworten vor allem diese letzte Frage: Identifikation, Authentifizierung und Autorisierung begrenzen, wer etwas darf; Sitzungen und Tokens sind zeitlich begrenzte Zugangsnachweise; TLS, Zertifikate und Certificate Authorities schützen die Verbindung; Firewall, VPN und Reverse Proxy begrenzen den erreichbaren Weg. Jedes Werkzeug schützt einen anderen Teil des Systems.",
          ],
        },
        {
          id: "security-prevent-attacks",
          heading: "Wie halten wir Angreifer ab?",
          paragraphs: [
            "Angreifer halten wir nicht mit einem einzelnen Produkt ab, sondern mit mehreren Hürden. Das System prüft Identitäten, gibt nur die nötigen Rechte, schützt Verbindungen und macht unnötige Dienste gar nicht erst erreichbar. So wird ein gestohlenes Konto, ein erratener Zugang oder eine öffentlich erreichbare Schwachstelle nicht sofort zum vollständigen Zugriff.",
            "Die folgenden Kapitel erklären diese Hürden: Identifikation, Authentifizierung und Autorisierung entscheiden über Rechte; Sessions und Tokens tragen einen begrenzten Zugangsnachweis; TLS und Zertifikate schützen die Verbindung; Firewall, VPN, Reverse Proxy und geschlossene Ports begrenzen die Angriffsfläche. Updates, sichere Konfiguration, Eingabeprüfung und Rate Limits ergänzen diese Schutzschichten.",
          ],
        },
        {
          id: "security-detect-attacks",
          heading: "Wie erkennen wir Angreifer?",
          paragraphs: [
            "Nicht jeder Angriff lässt sich sicher verhindern. Deshalb brauchen wir Hinweise darauf, dass etwas Ungewöhnliches geschieht: viele fehlgeschlagene Anmeldungen, Zugriffe aus unerwarteten Netzen, ein neues Gerät, ungewöhnlich viele Befehle oder Änderungen an Berechtigungen.",
            "Protokolle machen solche Ereignisse nachvollziehbar. Monitoring fasst sie zusammen, und Alarmierung informiert bei wichtigen oder wiederholten Auffälligkeiten. Protokolle dürfen dabei keine Passwörter, Tokens oder privaten Inhalte enthalten – sie sollen bei der Untersuchung helfen, nicht selbst ein neues Risiko schaffen.",
          ],
        },
        {
          id: "security-limit-damage",
          heading: "Wie begrenzen wir den Schaden?",
          paragraphs: [
            "Wenn ein Konto, Gerät oder Dienst kompromittiert ist, darf es nicht automatisch das ganze Zuhause oder alle Daten betreffen. Kleine Rechte, getrennte Rollen, getrennte Netze oder VLANs und klar begrenzte Dienste verringern den möglichen Schaden. Ein Sensor darf etwa Messwerte senden, aber keine Tür öffnen oder neue Nutzer einladen.",
            "Zugangsnachweise müssen widerrufbar sein. Bei Verlust werden Sitzungen, Tokens, Schlüssel oder Gerätezugänge gesperrt und ersetzt. Getestete Backups und ein geübter Wiederherstellungsweg helfen nach Fehlern oder Angriffen. Das Ziel ist nicht nur, einen Angriff zu überleben, sondern sicher und nachvollziehbar in einen kontrollierten Zustand zurückzukehren.",
          ],
        },
        {
          id: "security-identity-authentication-authorization",
          heading: "Identifikation, Authentifizierung und Autorisierung",
          table: {
            headers: [
              "Begriff",
              "Frage",
              "Beispiel",
            ],
            rows: [
              [
                "Identifikation",
                "Welche Identität behauptet jemand oder etwas zu haben?",
                "Ein Nutzer nennt seinen Kontonamen; ein ESP32 meldet seine Geräte-ID.",
              ],
              [
                "Authentifizierung",
                "Kann diese Identität den Nachweis erbringen?",
                "Der Nutzer bestätigt einen Passkey; das Gerät weist einen privaten Schlüssel nach.",
              ],
              [
                "Autorisierung",
                "Welche Aktion darf die bestätigte Identität ausführen?",
                "Das Konto darf nur eigene Projekte sehen; das Gerät darf nur in sein eigenes MQTT-Thema schreiben.",
              ],
            ],
          },
          paragraphs: [
            "Diese drei Schritte gehören zusammen. Ein Name oder eine Geräte-ID allein ist keine Sicherheit, denn beides kann kopiert oder geraten werden. Erst ein belastbarer Nachweis authentifiziert eine Identität. Erst danach entscheidet die Autorisierung für jede Funktion, ob Lesen, Ändern, Löschen oder Administrieren erlaubt ist.",
            "Rechte sollten so klein wie möglich sein: Eine Messstation braucht keinen Administratorzugang, ein normaler Nutzer braucht keine Daten anderer Konten und eine öffentliche Website braucht keinen direkten Datenbankzugriff. Dieses Prinzip heißt Least Privilege – minimale, klar begrenzte Rechte.",
          ],
        },
        {
          id: "security-sessions-tokens",
          heading: "Sessions, Tokens und Rechte",
          paragraphs: [
            "Nach einer erfolgreichen Anmeldung muss ein Dienst nicht bei jedem Klick erneut nach dem Passkey fragen. Er erstellt deshalb eine kurzlebige Sitzung. Im Browser liegt dafür meist ein geschütztes Session-Cookie; bei Programmschnittstellen ist häufig ein Token üblich. Beides ist ein Nachweis für eine bereits geprüfte Anmeldung – kein Passwort und keine dauerhafte Identität.",
            "Ein Token kann zum Beispiel festhalten, für welches Konto es gilt, wann es abläuft und welche Zielgruppe es verwenden darf. Der Server muss trotzdem bei jeder Anfrage prüfen, ob Signatur, Ablaufzeit, Aussteller und beabsichtigter Dienst stimmen. Ein Token darf nicht einfach als vertrauenswürdiger Text behandelt werden.",
            "Tokens und Sessions sind wie Zugangskarten: Wer sie besitzt, kann im erlaubten Umfang handeln. Sie gehören daher nie in Quelltext, öffentliche Repositories, Screenshots oder frei lesbare Browser-Speicher. Begrenzte Laufzeiten, Widerruf nach Sicherheitsereignissen, getrennte Tokens je Dienst und sichere Übertragung über HTTPS verringern den Schaden bei Verlust.",
          ],
        },
        {
          id: "security-cryptography-certificates",
          heading: "Verschlüsselung, Zertifikate und Certificate Authorities",
          paragraphs: [
            "Verschlüsselung schützt den Weg zwischen zwei Endpunkten. Bei HTTPS oder TLS verschlüsselt der Browser die Verbindung zur Website; Dritte im Netzwerk sollen Inhalte, Passwörter oder Tokens nicht mitlesen oder unbemerkt verändern können. TLS allein entscheidet jedoch nicht, wer nach der Verbindung welche Rechte hat – dafür bleiben Authentifizierung und Autorisierung nötig.",
            "Ein Zertifikat ist eine signierte Aussage: Dieser öffentliche Schlüssel gehört zu dieser Internetadresse oder diesem Dienst. Der Server besitzt dazu den passenden privaten Schlüssel und beweist damit beim Verbindungsaufbau seine Identität. Der private Schlüssel bleibt geheim; das Zertifikat darf verteilt werden.",
            "Eine Certificate Authority (CA) ist eine vertrauenswürdige Stelle, deren Signaturen Browser und Betriebssysteme prüfen können. Sie bestätigt nach einem definierten Verfahren, dass ein Zertifikat zu einer Domain gehört. Bei Geräten oder internen Diensten kann eine eigene, private CA sinnvoll sein: Sie stellt Zertifikate nur für bekannte Geräte und Dienste aus. Dann müssen deren Zertifikate, Schlüssel, Laufzeiten und Widerruf genauso sorgfältig verwaltet werden wie Benutzerkonten.",
          ],
        },
        {
          id: "security-attack-scenarios",
          heading: "Typische Angriffsszenarien verstehen",
          table: {
            headers: [
              "Szenario",
              "Was dabei passiert",
              "Wichtige Gegenmaßnahmen",
            ],
            rows: [
              [
                "Man in the Middle",
                "Jemand versucht, sich zwischen Client und Dienst zu schieben – etwa in einem fremden WLAN – um Daten mitzulesen oder Antworten zu verändern.",
                "HTTPS/TLS verwenden, Zertifikatswarnungen ernst nehmen und die Domain prüfen. Ein gültiges Zertifikat bindet den Dienst an seinen Schlüssel und erschwert das unbemerkte Einschleusen eines falschen Servers.",
              ],
              [
                "Gestohlene Sitzung oder gestohlenes Token",
                "Ein Angreifer erhält eine noch gültige Zugangskarte und nutzt sie innerhalb ihrer Rechte.",
                "Tokens kurz halten, nur verschlüsselt übertragen, nicht in Logs oder Browser-Speicher preisgeben, Sitzungen bei Verlust widerrufen und Rechte klein halten.",
              ],
              [
                "Phishing",
                "Eine täuschend echte Seite oder Nachricht bringt Menschen dazu, Zugangsdaten oder Freigaben preiszugeben.",
                "Adresse und Ursprung prüfen, keine geheimen Codes weitergeben, Passkeys und Mehrfaktor-Authentisierung nutzen. Passkeys helfen, weil sie an die echte Website gebunden sind.",
              ],
              [
                "Offener oder ungepatchter Dienst",
                "Ein unnötig erreichbarer oder veralteter Dienst bietet eine zusätzliche Angriffsfläche.",
                "Nicht benötigte Ports schließen, Adminzugänge privat halten, Updates einspielen, Protokolle überwachen und Backups testen.",
              ],
              [
                "Zu weitreichende Berechtigung",
                "Ein echtes Konto oder Gerät darf mehr als seine Aufgabe verlangt; ein Fehler oder Verlust hat dadurch größere Folgen.",
                "Least Privilege, getrennte Rollen und regelmäßige Prüfung von Konten, Schlüssel und Berechtigungen.",
              ],
            ],
          },
          paragraphs: [
            "Die Szenarien zeigen, warum Security aus mehreren Schichten besteht. TLS schützt den Transportweg, aber nicht gegen eine freiwillig auf einer Phishing-Seite eingegebene Freigabe. Ein korrektes Konto schützt nicht, wenn es unnötig Administratorrechte besitzt. Jede Maßnahme begrenzt einen Teil des Risikos; zusammen entstehen robuste Systeme.",
          ],
        },
        {
          id: "security-network-technologies",
          heading: "Netzwerktechnologien: IP, DNS, URLs und Ports",
          paragraphs: [
            "Ein Netzwerk braucht Adressen und Regeln für den Weg dorthin. Eine IP-Adresse benennt eine Netzwerkschnittstelle, ähnlich wie eine Zustelladresse. Im Heimnetz sind häufig private Bereiche wie 192.168.x.x oder 10.x.x.x im Einsatz; sie sind im öffentlichen Internet nicht direkt routbar. Eine öffentliche IP-Adresse kann dagegen aus dem Internet erreichbar sein, wenn Router und Firewall dies erlauben.",
            "Menschen verwenden Namen statt Zahlfolgen. DNS übersetzt einen Namen wie beispiel.de in die passende IP-Adresse. Eine URL beschreibt anschließend genauer, was angesprochen wird: https://beispiel.de:443/app enthält das Protokoll https, den Hostnamen beispiel.de, den optional sichtbaren Port 443 und den Pfad /app. Der Pfad ist nur eine Regel der Web-Anwendung; er öffnet keinen eigenen Netzwerkzugang.",
            "Ein Port unterscheidet Dienste auf derselben IP-Adresse. Vereinfacht hört ein Webserver auf Port 443 für HTTPS, während ein anderer Dienst auf einem anderen Port wartet. Die Zuordnung IP-Adresse plus Port heißt Socket-Endpunkt. Ein Dienst wird erst erreichbar, wenn er dort lauscht und Netzgrenzen wie Firewall, Router oder Cloud-Regeln den Weg erlauben. Nicht benötigte Ports bleiben geschlossen.",
          ],
        },
        {
          id: "security-mqtt",
          heading: "MQTT sicher einsetzen",
          paragraphs: [
            "MQTT verbindet Geräte und Dienste über einen Broker. Ein Gerät veröffentlicht Nachrichten zu einem Topic, andere Systeme abonnieren es. Sicherheit bedeutet hier nicht nur, den Broker mit einem Passwort zu versehen: Der Broker muss erkennen, welches konkrete Gerät oder welcher Dienst verbunden ist und exakt festlegen, welche Topics diese Identität lesen oder beschreiben darf.",
            "TLS verschlüsselt die Verbindung zum Broker. Bei gegenseitigem TLS (mTLS) weist nicht nur der Broker sein Zertifikat vor; auch jedes Gerät besitzt ein eigenes Zertifikat und einen privaten Schlüssel. Der Broker kann dadurch ein Gerät eindeutig prüfen. Alternativ können kurzlebige, gerätespezifische Zugangsdaten verwendet werden. Gemeinsame Zugangsdaten für alle Geräte sind riskant, weil bei Verlust nicht nur ein einzelnes Gerät betroffen ist.",
            "Eine MQTT-ACL ist eine Liste erlaubter Aktionen pro Identität. Ein Temperatursensor darf zum Beispiel nur unter seinem eigenen Mess-Topic veröffentlichen; er darf weder Befehle für andere Geräte schreiben noch fremde Messwerte abonnieren. Die Geräte-ID sollte der Server aus der geprüften Identität ableiten und nicht allein aus einem frei wählbaren Topic-Text übernehmen.",
          ],
          list: [
            "Broker nur auf den tatsächlich benötigten Netzwerkwegen erreichbar machen; Administration und Diagnoseports privat halten.",
            "TLS-Zertifikate, Gerätezugänge und ACLs eindeutig je Gerät oder Dienst verwalten und bei Verlust sperren beziehungsweise rotieren.",
            "Keine Zugangsdaten, Tokens oder privaten Schlüssel in Firmware-Quelltext, Logs oder öffentliche Repositories legen.",
            "Nachrichtenformate, Größenlimits, Raten und erlaubte Topics begrenzen; auffällige fehlgeschlagene Anmeldungen und ACL-Verstöße überwachen.",
            "Wichtige Steuerfunktionen lokal sicher gestalten: Der Ausfall oder Missbrauch einer MQTT-Verbindung darf keinen gefährlichen Zustand verursachen.",
          ],
        },
        {
          id: "security-network-boundaries",
          heading: "Netzgrenzen: Firewall, NAT und Reverse Proxy",
          paragraphs: [
            "Eine Firewall entscheidet anhand von Regeln, welche Verbindungen passieren dürfen. Gute Regeln erlauben nur erwartete Wege: etwa HTTPS für eine öffentliche Website und einen getrennten, privaten Zugang für Administration. Sie ersetzt keine sicheren Anwendungen, reduziert aber die Angriffsfläche erheblich.",
            "NAT (Network Address Translation) übersetzt private Adressen eines Heimnetzes auf eine öffentliche Adresse. Von innen nach außen funktioniert das meist automatisch. Eine Portfreigabe oder Weiterleitung hebt diese Grenze für einen ausgewählten Dienst teilweise auf: Anfragen an den öffentlichen Router-Port werden an einen lokalen Server weitergegeben. Das macht genau diesen Dienst zu einem Internetdienst und muss bewusst entschieden werden.",
            "Ein Reverse Proxy ist ein vorgeschalteter Webserver. Er nimmt HTTPS-Anfragen entgegen, prüft beziehungsweise beendet die TLS-Verbindung und leitet nur erlaubte Pfade an interne Anwendungen weiter. Er kann öffentliche Web-Funktionen von Administration und Datenbanken trennen – aber nur, wenn die internen Dienste nicht zusätzlich frei erreichbar sind. Ein VPN schafft dagegen einen privaten Netzwerkweg für bekannte Geräte und ist für persönliche Administration oft besser geeignet als eine öffentliche Portfreigabe.",
          ],
        },
        {
          id: "security-home-server-strategy",
          heading: "Strategie für einen sicher erreichbaren Home-Server",
          table: {
            headers: [
              "Bedarf",
              "Bevorzugter Weg",
              "Was öffentlich erreichbar ist",
            ],
            rows: [
              [
                "Nur du oder wenige bekannte Personen administrieren den Server",
                "Keine Portfreigabe für die Anwendung; privater Zugang über VPN oder eine gleichwertig starke, identitätsgebundene Zugriffslösung.",
                "Idealerweise nur der VPN-Einstieg. Administration, Home-Server-Oberfläche, SSH und Datenbanken bleiben privat.",
              ],
              [
                "Eine klar abgegrenzte Web-Funktion soll für andere Personen erreichbar sein",
                "Einen vorgeschalteten, gepflegten Reverse Proxy oder einen vertrauenswürdigen Tunnel nutzen. Dahinter nur genau die öffentliche Anwendung freigeben.",
                "Der öffentliche Einstieg der Web-Anwendung, typischerweise HTTPS. Keine Adminoberfläche, Datenbank oder Fernwartung.",
              ],
              [
                "Eine direkte Portfreigabe ist unvermeidbar",
                "Nur einen einzelnen, dokumentierten Dienst über HTTPS veröffentlichen und ihn wie einen kleinen Produktivdienst betreiben.",
                "Genau der weitergeleitete Port zu genau einer internen Adresse und Anwendung – nicht der ganze Rechner und nicht das gesamte Heimnetz.",
              ],
            ],
          },
          paragraphs: [
            "Eine Portfreigabe ist eine gezielte Übersetzung am Router: Sie leitet beispielsweise Anfragen an dessen öffentlichen HTTPS-Port zu einem bestimmten Rechner und Port im Heimnetz weiter. Dadurch erhält nicht automatisch jede Person Zugriff auf deinen Rechner. Sie kann aber genau den Dienst erreichen, der dort lauscht. Hat dieser Dienst eine Sicherheitslücke oder wird sein Konto übernommen, kann ein Angreifer unter Umständen auf die Daten und Netzwerkrechte zugreifen, die dieser Dienst besitzt. Wie weit ein Schaden reicht, hängt von der Anwendung, ihren Berechtigungen und der Netztrennung ab.",
            "Für einen persönlichen Home-Server ist die sichere Standardstrategie deshalb: erst lokal betreiben, Fernadministration über VPN, automatische Portfreigaben durch UPnP deaktivieren oder genau kontrollieren und Router sowie Server aktuell halten. Ein Tunnel oder Reverse Proxy ersetzt diese Regeln nicht; er verschiebt und begrenzt die öffentliche Kante. Für eine wirklich öffentliche Anwendung gehören TLS, starke Anmeldung, getrennte Adminzugänge, minimale Rechte, Updates, Logs, Alarmierung und getestete Backups fest zum Betrieb.",
          ],
          list: [
            "Nie Datenbank-, SSH-, MQTT-Admin- oder Router-Verwaltung direkt für das Internet freigeben.",
            "Auf dem Router nur die exakte Weiterleitung prüfen: öffentlicher Port, internes Ziel, Protokoll und Zweck. Alle anderen eingehenden Wege bleiben gesperrt.",
            "Den Home-Server nach Möglichkeit in ein separates Netz oder VLAN legen. So kann eine kompromittierte Anwendung nicht automatisch auf PCs, Drucker oder andere Geräte zugreifen.",
            "Vor dem Freigeben testen: Ist nur der erwartete Dienst von außen sichtbar? Funktioniert die Anmeldung? Gibt es aktuelle Backups und einen Plan zum Sperren von Zugängen?",
          ],
        },
        {
          id: "security-operation",
          heading: "Sicherer Betrieb",
          list: [
            "Eine einfache Architektur wählen und jede zusätzliche Schnittstelle begründen. Weniger öffentliche Dienste und Rechte bedeuten weniger Angriffsfläche.",
            "Updates für Betriebssystem, Firmware, Bibliotheken und Anwendungen regelmäßig einspielen; nicht mehr benötigte Dienste, Konten und Schlüssel entfernen.",
            "Starke, individuelle Identitäten nutzen: Passkeys oder Schlüssel für Administration, Mehrfaktor-Authentisierung wo möglich, keine gemeinsam genutzten Standardzugänge.",
            "Geheimnisse getrennt vom Quelltext verwalten. Dazu gehören Passwörter, API-Schlüssel, Tokens, private Schlüssel und Wiederherstellungscodes.",
            "Protokolle, fehlgeschlagene Anmeldungen, Konfigurationsänderungen und Dienstzustand überwachen. Ein Alarm ist nur hilfreich, wenn klar ist, wer ihn prüft und was dann geschieht.",
            "Backups getrennt speichern und Wiederherstellungen üben. Ein Backup, das nie erfolgreich zurückgespielt wurde, ist kein belastbarer Schutz.",
            "Vorab festlegen, wie bei Verlust eines Geräts, eines Tokens oder eines Schlüssels reagiert wird: Zugang sperren, Schlüssel rotieren, Sitzungen beenden, Ursache prüfen und betroffene Daten bewerten.",
          ],
        },
      ],
      relatedTopics: [
        "privacy-basics",
        "communication-basics",
        "home-server-internet-security",
        "internet-vps",
        "embedded-safety",
      ],
      access: "premium",
    },
    "glossary-basics": {
      title: "Fachbegriffe einfach erklärt",
      summary: "Dieses Lexikon erklärt häufige Begriffe aus modernen Systemlandschaften kurz, ohne vorauszusetzen, dass du sie bereits kennst.",
      access: "premium",
      sections: [
        {
          heading: "Systeme und Vernetzung",
          table: {
            headers: [
              "Begriff",
              "Bedeutung",
              "Praktisches Beispiel",
            ],
            rows: [
              [
                "Edge Computing",
                "Rechenarbeit findet nahe an der Datenquelle statt, also auf dem Gerät oder im lokalen Netzwerk – nicht erst in einem weit entfernten Rechenzentrum.",
                "Eine Kamera erkennt ein fehlerhaftes Teil direkt am lokalen Industrie-PC. Nur das Ergebnis oder ein Alarm wird weitergegeben.",
              ],
              [
                "Gateway",
                "Ein Vermittler zwischen Geräten, Netzen oder Protokollen. Es sammelt, übersetzt oder schützt den Weg zu anderen Systemen.",
                "Ein Raspberry Pi nimmt Werte von ESP32-Geräten entgegen und gibt sie gesammelt an einen Server weiter.",
              ],
              [
                "Latenz",
                "Die Zeit vom Senden einer Anfrage bis zur Reaktion. Kurze Latenz ist für direkte Bedienung und Steuerung wichtig.",
                "Ein Not-Aus oder ein Lichtschalter darf nicht von einer langsamen Internetverbindung abhängen.",
              ],
              [
                "API",
                "Eine klar definierte Schnittstelle, über die Programme Daten oder Funktionen anfordern können. Menschen nutzen meist eine App, Programme eine API.",
                "Die iPhone-App fragt über eine API den aktuellen Temperaturwert ab oder sendet einen Schaltbefehl.",
              ],
              [
                "Offline-first",
                "Die Kernfunktion funktioniert auch ohne Internet. Eine spätere Verbindung synchronisiert Daten oder erweitert Funktionen.",
                "Die Bewässerung läuft nach lokalen Regeln weiter; Messwerte werden übertragen, sobald die Verbindung zurück ist.",
              ],
            ],
          },
        },
        {
          heading: "Server und Betrieb",
          table: {
            headers: [
              "Begriff",
              "Bedeutung",
              "Praktisches Beispiel",
            ],
            rows: [
              [
                "Container",
                "Eine abgegrenzte Laufzeitumgebung für eine Anwendung und ihre Abhängigkeiten. Mehrere Container können auf einem VPS laufen.",
                "Web-App, Datenbank und Hintergrunddienst laufen getrennt, lassen sich aber gemeinsam betreiben und aktualisieren.",
              ],
              [
                "Cloud Computing",
                "Rechenleistung, Speicher oder fertige Plattformdienste werden über das Internet nach Bedarf bezogen.",
                "Ein verwalteter Speicher bewahrt Bilder auf, ohne dass ein eigener Dateiserver betrieben werden muss.",
              ],
              [
                "VPS",
                "Ein Virtual Private Server ist ein virtueller Server im Rechenzentrum. Er verhält sich für dich wie ein eigener Server, teilt aber die physische Hardware mit anderen Instanzen.",
                "Eine kleine Plattform mit API, Website und Datenbank läuft kostengünstig auf einem VPS.",
              ],
              [
                "Worker",
                "Ein Hintergrunddienst, der einzelne Aufgaben abarbeitet, ohne dass eine App darauf warten muss.",
                "Nach dem Upload eines Bildes erzeugt ein Worker eine kleinere Vorschau.",
              ],
              [
                "Queue",
                "Eine Warteschlange für Aufgaben oder Ereignisse. Sie verteilt Arbeit kontrolliert an Worker.",
                "Viele Messwerte warten geordnet, bis ein Worker sie speichert oder auswertet.",
              ],
            ],
          },
        },
        {
          heading: "Embedded und Entwicklung",
          table: {
            headers: [
              "Begriff",
              "Bedeutung",
              "Praktisches Beispiel",
            ],
            rows: [
              [
                "Firmware",
                "Software, die direkt auf einem eingebetteten Gerät läuft und seine Hardware steuert.",
                "Die Firmware eines ESP32 liest einen Temperatursensor und schaltet bei Bedarf ein Relais.",
              ],
              [
                "JTAG",
                "Eine Schnittstelle, über die Entwicklungswerkzeuge ein eingebettetes System gezielt prüfen und debuggen können.",
                "Ein Debugger hält die Firmware an und zeigt, welche Variable gerade einen unerwarteten Wert hat.",
              ],
              [
                "Funktionale Sicherheit",
                "Die Eigenschaft eines Systems, bei Fehlern oder Fehlbedienung keine unvertretbare Gefahr zu verursachen.",
                "Eine Maschine stoppt sicher, wenn ein Sensor ausfällt, statt unkontrolliert weiterzulaufen.",
              ],
            ],
          },
        },
        {
          heading: "Begriffe im Zusammenhang lesen",
          paragraphs: [
            "Ein Fachbegriff beschreibt selten allein eine gute oder schlechte Lösung. Edge Computing kann Latenz senken, ersetzt aber keine sichere Software. Ein VPS kann einfach zu betreiben sein, braucht aber weiterhin Updates und Backups. Nutze das Lexikon zum Nachschlagen und lies für Entscheidungen anschließend das passende Kapitel im Wissensportal.",
          ],
        },
      ],
      relatedTopics: [
        "server-systems",
        "local-servers",
        "software-basics",
        "embedded-measurement-debugging",
      ],
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
  };

  topics
    .flatMap((topic) => topic.children || [])
    .forEach((chapter) => {
      const article = articles[chapter.articleId];
      if (!article) return;
      article.access = chapter.access || "premium";
      chapter.subchapters = (article.sections || [])
        .filter((section) => section.id)
        .map((section) => ({ id: section.id, title: section.heading }));
    });

  function findTopic(topicId) {
    for (const topic of topics) {
      if (topic.id === topicId) return topic;
      const child = topic.children?.find((item) => item.id === topicId);
      if (child) return child;
    }
    return null;
  }

  function findParentTopic(topicId) {
    return topics.find((topic) => topic.children?.some((item) => item.id === topicId)) || null;
  }

  return { topics, articles, findTopic, findParentTopic };
})();
