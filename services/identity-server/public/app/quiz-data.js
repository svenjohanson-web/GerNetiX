(() => {
  const categoryDefinitions = [
    {
      id: "embedded",
      icon: "µC",
      translations: {
        de: { title: "Embedded", description: "Mikrocontroller, Speicher, Peripherie und hardwarenahe Software" },
        en: { title: "Embedded", description: "Microcontrollers, memory, peripherals and hardware-related software" },
        nl: { title: "Embedded", description: "Microcontrollers, geheugen, randapparatuur en hardwarenabije software" },
      },
      questions: [
        {
          id: "embedded-volatile-memory",
          translations: {
            de: {
              prompt: "Welcher Speicherinhalt geht bei einem normalen Neustart typischerweise verloren?",
              options: ["Daten im RAM", "Firmware im Flash", "Kalibrierwerte im NVS", "Dateien im LittleFS"],
              explanation: "RAM ist flüchtig. Flash, NVS und LittleFS bleiben ohne gezieltes Löschen über einen Neustart hinweg erhalten.",
            },
            en: {
              prompt: "Which memory content is typically lost during a normal restart?",
              options: ["Data in RAM", "Firmware in flash", "Calibration values in NVS", "Files in LittleFS"],
              explanation: "RAM is volatile. Flash, NVS and LittleFS remain intact across a restart unless deliberately erased.",
            },
            nl: {
              prompt: "Welke geheugeninhoud gaat bij een normale herstart meestal verloren?",
              options: ["Gegevens in RAM", "Firmware in flash", "Kalibratiewaarden in NVS", "Bestanden in LittleFS"],
              explanation: "RAM is vluchtig. Flash, NVS en LittleFS blijven zonder doelbewust wissen behouden na een herstart.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "embedded-interrupt",
          translations: {
            de: {
              prompt: "Wofür ist eine Interrupt-Service-Routine besonders geeignet?",
              options: ["Ein kurzes zeitkritisches Ereignis erfassen", "Eine lange Netzwerkabfrage ausführen", "Große Dateien formatieren", "Die gesamte Programmlogik ersetzen"],
              explanation: "Eine ISR sollte ein Ereignis schnell erfassen und aufwendige Arbeit an den normalen Programmablauf übergeben.",
            },
            en: {
              prompt: "What is an interrupt service routine particularly suitable for?",
              options: ["Capturing a short time-critical event", "Running a long network request", "Formatting large files", "Replacing all program logic"],
              explanation: "An ISR should capture an event quickly and hand expensive work over to the normal program flow.",
            },
            nl: {
              prompt: "Waarvoor is een interrupt-serviceroutine bijzonder geschikt?",
              options: ["Een korte tijdkritische gebeurtenis vastleggen", "Een lange netwerkaanvraag uitvoeren", "Grote bestanden formatteren", "De volledige programmalogica vervangen"],
              explanation: "Een ISR moet een gebeurtenis snel vastleggen en zwaar werk aan de normale programmastroom doorgeven.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "embedded-watchdog",
          translations: {
            de: {
              prompt: "Was ist die Hauptaufgabe eines Watchdogs?",
              options: ["Ein festhängendes System erkennen und zurücksetzen", "Den Prozessortakt erhöhen", "Analoge Signale verstärken", "Flash-Speicher vergrößern"],
              explanation: "Der Watchdog erwartet regelmäßige Lebenszeichen. Bleiben sie aus, bringt er das System in einen definierten Zustand zurück.",
            },
            en: {
              prompt: "What is the main purpose of a watchdog?",
              options: ["Detecting and resetting a stuck system", "Increasing the processor clock", "Amplifying analogue signals", "Increasing flash memory"],
              explanation: "The watchdog expects regular signs of life. If they stop, it returns the system to a defined state.",
            },
            nl: {
              prompt: "Wat is de belangrijkste taak van een watchdog?",
              options: ["Een vastgelopen systeem detecteren en resetten", "De processorklok verhogen", "Analoge signalen versterken", "Het flashgeheugen vergroten"],
              explanation: "De watchdog verwacht regelmatige levenstekens. Als die uitblijven, brengt hij het systeem terug naar een gedefinieerde toestand.",
            },
          },
          correctIndex: 0,
        },
      ],
    },
    {
      id: "electrical-engineering",
      icon: "⚡",
      translations: {
        de: { title: "Elektrotechnik", description: "Spannung, Strom, Bauteile, Messung und sichere Auslegung" },
        en: { title: "Electrical engineering", description: "Voltage, current, components, measurement and safe design" },
        nl: { title: "Elektrotechniek", description: "Spanning, stroom, componenten, metingen en veilig ontwerp" },
      },
      questions: [
        {
          id: "electrical-ohm",
          translations: {
            de: {
              prompt: "Welcher Strom fließt bei 5 V über einen Widerstand von 1 kΩ?",
              options: ["5 mA", "0,2 mA", "50 mA", "5 A"],
              explanation: "Nach I = U / R gilt: 5 V / 1000 Ω = 0,005 A = 5 mA.",
            },
            en: {
              prompt: "What current flows through a 1 kΩ resistor at 5 V?",
              options: ["5 mA", "0.2 mA", "50 mA", "5 A"],
              explanation: "Using I = U / R: 5 V / 1000 Ω = 0.005 A = 5 mA.",
            },
            nl: {
              prompt: "Welke stroom loopt bij 5 V door een weerstand van 1 kΩ?",
              options: ["5 mA", "0,2 mA", "50 mA", "5 A"],
              explanation: "Volgens I = U / R: 5 V / 1000 Ω = 0,005 A = 5 mA.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "electrical-flyback",
          translations: {
            de: {
              prompt: "Warum wird an einer Gleichstrom-Relaisspule häufig eine Freilaufdiode eingesetzt?",
              options: ["Sie begrenzt die Abschaltspannung der Spule", "Sie erhöht die Versorgungsspannung", "Sie misst den Spulenstrom", "Sie ersetzt den Schalttransistor"],
              explanation: "Beim Abschalten erzeugt die Induktivität eine hohe Gegenspannung. Die Freilaufdiode bietet dem Strom einen sicheren Abklingpfad.",
            },
            en: {
              prompt: "Why is a flyback diode commonly used across a DC relay coil?",
              options: ["It limits the coil's switch-off voltage", "It increases the supply voltage", "It measures coil current", "It replaces the switching transistor"],
              explanation: "When switched off, the inductance produces a high reverse voltage. The flyback diode provides a safe decay path for the current.",
            },
            nl: {
              prompt: "Waarom wordt vaak een vrijloopdiode over een gelijkstroomrelaisspoel geplaatst?",
              options: ["Ze begrenst de uitschakelspanning van de spoel", "Ze verhoogt de voedingsspanning", "Ze meet de spoelstroom", "Ze vervangt de schakeltransistor"],
              explanation: "Bij het uitschakelen veroorzaakt de inductie een hoge tegenspanning. De vrijloopdiode biedt de stroom een veilig afbouwpad.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "electrical-absolute-maximum",
          translations: {
            de: {
              prompt: "Was bedeutet ein Wert unter „Absolute Maximum Ratings“ im Datenblatt?",
              options: ["Eine Grenze, die im Normalbetrieb nicht erreicht werden darf", "Ein empfohlener Dauerbetriebswert", "Ein typischer Messwert ohne Toleranz", "Eine garantierte Mindestleistung"],
              explanation: "Absolute Grenzwerte beschreiben die Schadensgrenze, nicht den empfohlenen Arbeitspunkt. Die Auslegung braucht Abstand dazu.",
            },
            en: {
              prompt: "What does a value under “Absolute Maximum Ratings” in a data sheet mean?",
              options: ["A limit that normal operation must not reach", "A recommended continuous operating value", "A typical measurement without tolerance", "A guaranteed minimum performance"],
              explanation: "Absolute limits describe the damage boundary, not the recommended operating point. A design needs margin below it.",
            },
            nl: {
              prompt: "Wat betekent een waarde onder ‘Absolute Maximum Ratings’ in een datasheet?",
              options: ["Een grens die bij normaal gebruik niet bereikt mag worden", "Een aanbevolen continue bedrijfswaarde", "Een typische meetwaarde zonder tolerantie", "Een gegarandeerde minimale prestatie"],
              explanation: "Absolute grenzen beschrijven de schadegrens, niet het aanbevolen werkpunt. Het ontwerp heeft daaronder marge nodig.",
            },
          },
          correctIndex: 0,
        },
      ],
    },
    {
      id: "software",
      icon: "</>",
      translations: {
        de: { title: "Software", description: "Programmstruktur, Daten, Tests und zuverlässiges Verhalten" },
        en: { title: "Software", description: "Program structure, data, tests and reliable behaviour" },
        nl: { title: "Software", description: "Programmastructuur, gegevens, tests en betrouwbaar gedrag" },
      },
      questions: [
        {
          id: "software-unit-test",
          translations: {
            de: {
              prompt: "Was prüft ein guter Unit-Test hauptsächlich?",
              options: ["Eine abgegrenzte Logikeinheit mit kontrollierten Eingaben", "Die komplette Produktionsumgebung", "Nur die optische Darstellung", "Ob alle Nutzer gleichzeitig online sind"],
              explanation: "Unit-Tests isolieren eine kleine Logikeinheit. System- und End-to-End-Tests prüfen größere Zusammenhänge.",
            },
            en: {
              prompt: "What does a good unit test primarily verify?",
              options: ["A bounded unit of logic with controlled inputs", "The complete production environment", "Only the visual presentation", "Whether all users are online simultaneously"],
              explanation: "Unit tests isolate a small unit of logic. System and end-to-end tests verify larger interactions.",
            },
            nl: {
              prompt: "Wat controleert een goede unit-test voornamelijk?",
              options: ["Een afgebakende logica-eenheid met gecontroleerde invoer", "De volledige productieomgeving", "Alleen de visuele weergave", "Of alle gebruikers tegelijk online zijn"],
              explanation: "Unit-tests isoleren een kleine logica-eenheid. Systeem- en end-to-end-tests controleren grotere samenhangen.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "software-source-truth",
          translations: {
            de: {
              prompt: "Warum sollte fachlicher Zustand nicht nur im Browser-localStorage liegen?",
              options: ["Er ist gerätegebunden und keine verlässliche zentrale Wahrheit", "Er ist immer langsamer als PostgreSQL", "Er kann keine Zeichenketten speichern", "Er funktioniert nur ohne JavaScript"],
              explanation: "localStorage gehört zu genau einem Browserprofil, ist leicht löschbar und nicht für gemeinsamen accountgebundenen Zustand geeignet.",
            },
            en: {
              prompt: "Why should business state not live only in browser localStorage?",
              options: ["It is device-bound and not a reliable central source of truth", "It is always slower than PostgreSQL", "It cannot store strings", "It only works without JavaScript"],
              explanation: "localStorage belongs to one browser profile, is easily erased and is unsuitable for shared account-bound state.",
            },
            nl: {
              prompt: "Waarom hoort functionele toestand niet alleen in browser-localStorage?",
              options: ["Het is apparaatgebonden en geen betrouwbare centrale waarheid", "Het is altijd trager dan PostgreSQL", "Het kan geen tekenreeksen opslaan", "Het werkt alleen zonder JavaScript"],
              explanation: "localStorage hoort bij één browserprofiel, kan eenvoudig worden gewist en is ongeschikt voor gedeelde accountgebonden toestand.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "software-state-machine",
          translations: {
            de: {
              prompt: "Wann ist ein Zustandsautomat besonders hilfreich?",
              options: ["Wenn ein System klar definierte Zustände und Übergänge besitzt", "Wenn jede Funktion nur eine Zeile hat", "Wenn keine Ereignisse auftreten", "Nur bei grafischen Benutzeroberflächen"],
              explanation: "Ein Zustandsautomat macht erlaubte Zustände, Ereignisse und Übergänge explizit und damit prüfbar.",
            },
            en: {
              prompt: "When is a state machine particularly useful?",
              options: ["When a system has clearly defined states and transitions", "When every function is only one line", "When no events occur", "Only for graphical user interfaces"],
              explanation: "A state machine makes allowed states, events and transitions explicit and therefore testable.",
            },
            nl: {
              prompt: "Wanneer is een toestandsautomaat bijzonder nuttig?",
              options: ["Wanneer een systeem duidelijk gedefinieerde toestanden en overgangen heeft", "Wanneer elke functie maar één regel bevat", "Wanneer er geen gebeurtenissen zijn", "Alleen voor grafische gebruikersinterfaces"],
              explanation: "Een toestandsautomaat maakt toegestane toestanden, gebeurtenissen en overgangen expliciet en daardoor toetsbaar.",
            },
          },
          correctIndex: 0,
        },
      ],
    },
    {
      id: "distributed-systems",
      icon: "⇄",
      translations: {
        de: { title: "Verteilte Systeme", description: "Netzwerke, APIs, Nachrichten, Ausfälle und Datenkonsistenz" },
        en: { title: "Distributed systems", description: "Networks, APIs, messages, failures and data consistency" },
        nl: { title: "Gedistribueerde systemen", description: "Netwerken, API's, berichten, storingen en gegevensconsistentie" },
      },
      questions: [
        {
          id: "distributed-timeout",
          translations: {
            de: {
              prompt: "Warum benötigt ein Netzwerkaufruf einen Timeout?",
              options: ["Damit ein fehlender Antwortweg nicht unbegrenzt blockiert", "Damit jede Antwort schneller berechnet wird", "Damit TLS nicht mehr nötig ist", "Damit Daten automatisch gespeichert werden"],
              explanation: "In verteilten Systemen können Gegenstelle oder Netzwerk ausfallen. Ein Timeout begrenzt die Wartezeit und ermöglicht eine definierte Fehlerbehandlung.",
            },
            en: {
              prompt: "Why does a network request need a timeout?",
              options: ["So a missing response cannot block indefinitely", "So every response is computed faster", "So TLS is no longer necessary", "So data is stored automatically"],
              explanation: "In distributed systems, the peer or network can fail. A timeout bounds the wait and enables defined error handling.",
            },
            nl: {
              prompt: "Waarom heeft een netwerkaanroep een time-out nodig?",
              options: ["Zodat een ontbrekend antwoord niet onbeperkt blokkeert", "Zodat elk antwoord sneller wordt berekend", "Zodat TLS niet meer nodig is", "Zodat gegevens automatisch worden opgeslagen"],
              explanation: "In gedistribueerde systemen kunnen de andere partij of het netwerk uitvallen. Een time-out begrenst de wachttijd en maakt gedefinieerde foutafhandeling mogelijk.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "distributed-idempotency",
          translations: {
            de: {
              prompt: "Was bewirkt eine idempotente Operation?",
              options: ["Wiederholtes Ausführen führt zum selben fachlichen Ergebnis", "Sie funktioniert nur einmal", "Sie benötigt keine Authentifizierung", "Sie ist immer schreibgeschützt"],
              explanation: "Idempotenz hilft bei Wiederholungen nach unklaren Netzwerkfehlern: Derselbe Auftrag erzeugt nicht mehrfach dieselbe fachliche Wirkung.",
            },
            en: {
              prompt: "What does an idempotent operation achieve?",
              options: ["Repeating it leads to the same business result", "It works only once", "It requires no authentication", "It is always read-only"],
              explanation: "Idempotency helps with retries after ambiguous network failures: the same request does not create the same business effect multiple times.",
            },
            nl: {
              prompt: "Wat bereikt een idempotente bewerking?",
              options: ["Herhaald uitvoeren leidt tot hetzelfde functionele resultaat", "Ze werkt maar één keer", "Ze vereist geen authenticatie", "Ze is altijd alleen-lezen"],
              explanation: "Idempotentie helpt bij herhalingen na onduidelijke netwerkfouten: hetzelfde verzoek veroorzaakt niet meerdere keren hetzelfde functionele effect.",
            },
          },
          correctIndex: 0,
        },
        {
          id: "distributed-mqtt",
          translations: {
            de: {
              prompt: "Welche Rolle hat ein MQTT-Broker?",
              options: ["Er vermittelt Nachrichten zwischen Publishern und Subscribern", "Er kompiliert Firmware", "Er ersetzt jedes Datenbanksystem", "Er misst analoge Spannungen"],
              explanation: "Publisher senden an Topics, Subscriber abonnieren Topics. Der Broker nimmt Nachrichten an und verteilt sie entsprechend.",
            },
            en: {
              prompt: "What is the role of an MQTT broker?",
              options: ["It routes messages between publishers and subscribers", "It compiles firmware", "It replaces every database system", "It measures analogue voltages"],
              explanation: "Publishers send to topics and subscribers subscribe to topics. The broker accepts and distributes the messages accordingly.",
            },
            nl: {
              prompt: "Wat is de rol van een MQTT-broker?",
              options: ["Hij verdeelt berichten tussen publishers en subscribers", "Hij compileert firmware", "Hij vervangt elk databasesysteem", "Hij meet analoge spanningen"],
              explanation: "Publishers sturen naar topics en subscribers abonneren zich op topics. De broker ontvangt en verdeelt de berichten.",
            },
          },
          correctIndex: 0,
        },
      ],
    },
  ];

  const labels = {
    de: {
      eyebrow: "Wissen prüfen",
      title: "GerNetiX Quiz",
      intro: "Wähle eine Rubrik. Nach jeder Antwort erhältst du sofort die technische Begründung.",
      questions: "3 Fragen",
      start: "Quiz starten",
      back: "Rubriken",
      question: "Frage {current} von {total}",
      select: "Wähle eine Antwort.",
      correct: "Richtig",
      incorrect: "Noch nicht richtig",
      answer: "Richtige Antwort:",
      next: "Nächste Frage",
      finish: "Ergebnis ansehen",
      resultEyebrow: "Runde abgeschlossen",
      result: "{score} von {total} richtig",
      resultStrong: "Sehr sicher – die Grundlagen sitzen.",
      resultMedium: "Gute Basis – die Erklärungen zeigen dir die nächsten Lücken.",
      resultStart: "Ein guter Start – lies die Begründungen noch einmal in Ruhe.",
      retry: "Rubrik wiederholen",
      categories: "Andere Rubrik wählen",
      sessionNotice: "Diese erste Version speichert noch keinen dauerhaften Lernstand.",
    },
    en: {
      eyebrow: "Check your knowledge",
      title: "GerNetiX quiz",
      intro: "Choose a category. After every answer, you immediately receive the technical reasoning.",
      questions: "3 questions",
      start: "Start quiz",
      back: "Categories",
      question: "Question {current} of {total}",
      select: "Choose an answer.",
      correct: "Correct",
      incorrect: "Not quite",
      answer: "Correct answer:",
      next: "Next question",
      finish: "View result",
      resultEyebrow: "Round complete",
      result: "{score} of {total} correct",
      resultStrong: "Very confident – your fundamentals are solid.",
      resultMedium: "A good foundation – the explanations show your next gaps.",
      resultStart: "A good start – read through the explanations once more.",
      retry: "Repeat category",
      categories: "Choose another category",
      sessionNotice: "This first version does not yet store permanent learning progress.",
    },
    nl: {
      eyebrow: "Test je kennis",
      title: "GerNetiX-quiz",
      intro: "Kies een categorie. Na elk antwoord krijg je meteen de technische uitleg.",
      questions: "3 vragen",
      start: "Quiz starten",
      back: "Categorieën",
      question: "Vraag {current} van {total}",
      select: "Kies een antwoord.",
      correct: "Juist",
      incorrect: "Nog niet juist",
      answer: "Juiste antwoord:",
      next: "Volgende vraag",
      finish: "Resultaat bekijken",
      resultEyebrow: "Ronde voltooid",
      result: "{score} van {total} juist",
      resultStrong: "Zeer zeker – de basis zit goed.",
      resultMedium: "Een goede basis – de uitleg toont je volgende hiaten.",
      resultStart: "Een goed begin – lees de uitleg nog eens rustig door.",
      retry: "Categorie herhalen",
      categories: "Andere categorie kiezen",
      sessionNotice: "Deze eerste versie slaat nog geen permanente leervoortgang op.",
    },
  };

  function localeValue(locale) {
    return ["de", "en", "nl"].includes(locale) ? locale : "de";
  }

  function getCatalog(locale = "de") {
    const selectedLocale = localeValue(locale);
    return {
      labels: labels[selectedLocale],
      categories: categoryDefinitions.map((category, categoryIndex) => ({
        id: category.id,
        icon: category.icon,
        ...category.translations[selectedLocale],
        questions: category.questions.map((question, questionIndex) => {
          const translatedQuestion = question.translations[selectedLocale];
          const shift = (categoryIndex + questionIndex + 1) % translatedQuestion.options.length;
          return {
            id: question.id,
            ...translatedQuestion,
            options: translatedQuestion.options.map((_option, optionIndex, options) =>
              options[(optionIndex - shift + options.length) % options.length]),
            correctIndex: (question.correctIndex + shift) % translatedQuestion.options.length,
          };
        }),
      })),
    };
  }

  window.GerNetiXQuizData = {
    getCatalog,
    categoryDefinitions,
  };
})();
