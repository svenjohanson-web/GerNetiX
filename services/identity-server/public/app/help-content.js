const HelpContent = (() => {
  const topics = [
    {
      id: "start-and-access",
      title: "Start und Zugang",
      description: "Konto, Anmeldung, Wiederherstellung und die ersten Schritte verstehen.",
      surface: "help",
      access: "public",
      children: [
        { id: "registration-login-recovery", title: "Einloggen und Konto anlegen", articleId: "registration-login-recovery" },
        { id: "create-account", title: "Konto anlegen", articleId: "create-account" },
        { id: "quick-start", title: "So startest du", articleId: "quick-start" },
        { id: "account-types", title: "Kontotypen und Zugangsstufen", articleId: "account-types" },
        { id: "entitlements-and-tokens", title: "Premium, Entitlements und Token", articleId: "entitlements-and-tokens" },
        { id: "webshop-activation-codes", title: "Webshop, E-Mail und Aktivierungscodes", articleId: "webshop-activation-codes" },
        { id: "plan-comparison", title: "Basis, Basis Plus und Premium vergleichen", articleId: "plan-comparison" },
      ],
    },
    {
      id: "engineering-thinking",
      title: "Ingenieursmäßig denken",
      description: "Von einer echten Problemstellung zu einer nachvollziehbaren technischen Lösung.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "from-problem-to-system", title: "Vom Problem zu technischen Grundlagen", articleId: "from-problem-to-system", access: "public", subchapters: [
          { id: "engineering-thinking-problem", title: "Nicht Technologie, sondern Problem" },
          { id: "engineering-thinking-knowledge", title: "Wissen, Analyse und KI" },
          { id: "engineering-thinking-learning", title: "Viele Wege ins Lernen" },
          { id: "engineering-thinking-tamagotchi", title: "Die Tamagotchi-Lernreise" },
          { id: "engineering-thinking-models", title: "Vorgehensmodelle" },
          { id: "engineering-thinking-industry", title: "Was das mit Industrie zu tun hat" },
          { id: "engineering-thinking-foundations", title: "Welche Grundlagen verteilte Systeme brauchen" },
          { id: "engineering-thinking-next-steps", title: "Mit Beispielen weiterlernen" },
        ] },
      ],
    },
    {
      id: "electrical-engineering",
      title: "Elektrotechnik",
      description: "Physikalische Grundlagen, Messschaltungen sowie Ein- und Ausgangsbeschaltungen verstehen.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "physical-limits", title: "Grenzen der Physik", articleId: "physical-limits", subchapters: [
          { id: "physical-limits-ratings", title: "Absolute Maximum Ratings – absolute Grenzwerte" },
          { id: "physical-limits-current", title: "Strom pro Pin und Gesamtstrom" },
          { id: "physical-limits-frequency", title: "Maximale Frequenz und Prozessortakt" },
        ] },
        { id: "sampling-rate", title: "Abtastrate und Shannon-Theorem", articleId: "sampling-rate", subchapters: [
          { id: "sampling-rate-shannon", title: "Nyquist-Shannon-Abtasttheorem" },
          { id: "sampling-rate-aliasing", title: "Aliasing – wenn hohe Frequenzen täuschen" },
          { id: "sampling-rate-practice", title: "Abtastrate praktisch wählen" },
        ] },
        { id: "sensors", title: "Sensoren", articleId: "sensors", subchapters: [
          { id: "sensor-types", title: "Messgröße und Wirkprinzip" },
          { id: "sensor-position-presence", title: "Position und Anwesenheit" },
          { id: "sensor-reed-contact", title: "Reed-Kontakt" },
          { id: "sensor-photoelectric", title: "Lichtschranke" },
          { id: "sensor-limit-switch", title: "Mechanischer Endschalter" },
          { id: "sensor-contact-bridge", title: "Leitende Kontaktbrücke" },
          { id: "sensor-inductive", title: "Induktiver Näherungssensor" },
          { id: "sensor-chicken-door-task", title: "Denkaufgabe Hühnerklappe" },
          { id: "sensor-selection-games", title: "Frage-Antwort-Spiele" },
          { id: "sensor-application-map", title: "Welcher Sensor passt wohin?" },
          { id: "sensor-distance-proximity", title: "Abstand und Näherung" },
          { id: "sensor-fmcw-radar", title: "FMCW-Radar" },
          { id: "sensor-temperature", title: "Temperatur" },
          { id: "sensor-light-radiation", title: "Licht und Strahlung" },
          { id: "sensor-motion-orientation", title: "Bewegung und Orientierung" },
          { id: "sensor-force-pressure", title: "Kraft, Gewicht und Druck" },
          { id: "sensor-environment-chemical", title: "Umwelt und chemische Größen" },
          { id: "sensor-level-flow", title: "Füllstand und Durchfluss" },
          { id: "sensor-electrical", title: "Elektrische Größen" },
          { id: "measurement-circuits", title: "Messschaltungen" },
        ] },
        { id: "actuators", title: "Aktoren", articleId: "actuators", subchapters: [
          { id: "actuator-types", title: "Aktor-Typen" },
          { id: "actuator-driver-circuits", title: "Ausgangsbeschaltungen und Treiber" },
        ] },
        { id: "embedded-safety", title: "Elektrische und funktionale Sicherheit", articleId: "embedded-safety" },
      ],
    },
    {
      id: "microcontrollers-and-embedded",
      title: "Mikrocontroller und Embedded",
      description: "Programmierbare Boards, Prozessoren, Firmware-nahe Schnittstellen und systematische Fehlersuche.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "hardware-landscape", title: "Hardware-Landkarte: vom Akku bis Edge AI", articleId: "hardware-landscape" },
        { id: "processor-overview", title: "ESP32-Prozessorfamilien im Vergleich", articleId: "processor-overview" },
        { id: "microcontroller-basics", title: "Grundlagen Mikrocontroller", articleId: "microcontroller-basics", subchapters: [
          { id: "microcontroller-flashing", title: "Flashen" },
          { id: "microcontroller-flash-build", title: "Aus Quelltext wird Firmware" },
          { id: "microcontroller-flash-bootloader", title: "Bootloader und Programmierweg" },
          { id: "microcontroller-flash-write", title: "Löschen, schreiben und prüfen" },
          { id: "microcontroller-flash-start", title: "Start nach dem Flashen" },
          { id: "microcontroller-memory", title: "Speicherorganisation" },
          { id: "microcontroller-registers", title: "Register" },
          { id: "microcontroller-gpio", title: "GPIO" },
          { id: "microcontroller-adc", title: "ADC" },
          { id: "microcontroller-timer", title: "Timer" },
          { id: "microcontroller-pwm", title: "PWM" },
        ] },
        { id: "bus-systems", title: "Bussysteme", articleId: "bus-systems", subchapters: [
          { id: "chip-to-chip-buses", title: "Chip-zu-Chip-Schnittstellen" },
          { id: "field-and-system-buses", title: "Feld- und Systembusse" },
        ] },
        { id: "embedded-measurement-debugging", title: "Embedded-Systeme: Messtechnik und Debugging", articleId: "embedded-measurement-debugging" },
      ],
    },
    {
      id: "software-basics",
      title: "Informatik und Software",
      description: "Wie Software Regeln und Abläufe beschreibt – auf Mikrocontrollern als Firmware, auf Computern als Anwendungen und Dienste.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "software-basics-introduction", title: "Von der Idee zum ausführbaren Programm", articleId: "software-basics-introduction", subchapters: [
          { id: "software-purpose", title: "Warum gibt es Software?" },
          { id: "software-source-code", title: "Quelltext: Anweisungen für Maschinen" },
          { id: "software-compilation", title: "Kompilieren: in Maschinencode übersetzen" },
          { id: "software-libraries", title: "Bibliotheken: bewährte Bausteine nutzen" },
          { id: "software-scripts", title: "Skripte, Interpreter und Laufzeitumgebungen" },
          { id: "software-embedded", title: "Firmware auf Mikrocontrollern" },
          { id: "software-backend", title: "Backend: Entwicklungsgeschwindigkeit zählt" },
          { id: "software-client-devices", title: "PC, Tablet und Smartphone: beide Welten" },
        ] },
        { id: "workers-and-queues", title: "Worker, Queues und Hintergrundaufgaben", articleId: "workers-and-queues" },
      ],
    },
    {
      id: "distributed-systems",
      title: "Verteilte Systeme",
      description: "Wie Elektrotechnik, Firmware, Netzwerke, Server und Anwendungen zu einem gemeinsamen System werden.",
      serverLandscape: true,
      surface: "knowledge",
      access: "public",
      children: [
        { id: "distributed-systems-introduction", title: "Wenn zwei Welten zusammenarbeiten", articleId: "distributed-systems-introduction" },
        { id: "software-basics", title: "Software in verteilten Systemen", articleId: "software-basics" },
        { id: "communication-basics", title: "Kommunikation und Schnittstellen", articleId: "communication-basics", subchapters: [
          { id: "communication-rest", title: "REST und HTTP" },
          { id: "communication-events", title: "Ereignisse, Webhooks und WebSockets" },
          { id: "communication-mqtt", title: "MQTT für IoT" },
          { id: "communication-data-security", title: "JSON, Identität und Berechtigungen" },
        ] },
        { id: "server-systems", title: "Systemlandschaften und Server", articleId: "server-systems" },
        { id: "local-servers", title: "Lokale Server und Gateways", articleId: "local-servers" },
        { id: "internet-vps", title: "Internet-Server und VPS", articleId: "internet-vps" },
        { id: "cloud-services", title: "Cloud-Dienste", articleId: "cloud-services" },
        { id: "choosing-servers", title: "Server passend auswählen", articleId: "choosing-servers" },
      ],
    },
    {
      id: "artificial-intelligence",
      title: "Die Künstliche Intelligenz",
      description: "KI als Werkzeug verstehen: von Sprachassistenten über GPT bis zu lokalen und internetbasierten Sprachmodellen.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "ai-basics", title: "GPT, Alexa und LLMs", articleId: "ai-basics", subchapters: [
          { id: "ai-gpt-and-alexa", title: "GPT und Alexa sind nicht dasselbe" },
          { id: "ai-llm", title: "Was ist ein LLM?" },
          { id: "ai-vectors-and-embeddings", title: "Vektoren und Embeddings" },
          { id: "ai-local-or-online", title: "Lokal oder über das Internet?" },
          { id: "ai-payment-models", title: "Kosten und Zahlungsmodelle" },
        ] },
      ],
    },
    {
      id: "cross-cutting-topics",
      title: "Querschnittsthemen",
      description: "Themen, die jede Systemebene und jedes Projekt betreffen.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "privacy-basics", title: "Datenschutz in vernetzten Projekten", articleId: "privacy-basics" },
      ],
    },
    {
      id: "glossary",
      title: "Lexikon",
      description: "Fachbegriffe kurz, verständlich und mit einem praktischen Beispiel nachschlagen.",
      surface: "knowledge",
      access: "public",
      children: [
        { id: "glossary-basics", title: "Fachbegriffe einfach erklärt", articleId: "glossary-basics" },
      ],
    },
    {
      id: "devices-and-projects",
      title: "Geräte und Projekte",
      description: "Boards einrichten und Projektfunktionen konfigurieren.",
      surface: "help",
      access: "account",
      children: [
        { id: "provision-new-board", title: "Neues Board in Betrieb nehmen", articleId: "provision-new-board" },
        { id: "board-definition", title: "Warum eine Board Definition?", articleId: "board-definition" },
        { id: "register-device", title: "Board registrieren", articleId: "register-device" },
        { id: "pair-device", title: "Board verbinden", articleId: "pair-device" },
        { id: "flash-device", title: "Geräte flashen", articleId: "flash-device" },
        { id: "usb-wifi-setup", title: "WLAN per USB einrichten", articleId: "usb-wifi-setup" },
        { id: "supported-devices", title: "Unterstützte Boards", articleId: "supported-devices" },
        { id: "device-not-detected", title: "Board wird nicht erkannt", articleId: "device-not-detected" },
        { id: "event-worker-rules", title: "Ereignis-Worker und Regelsprache", articleId: "event-worker-rules" },
        { id: "event-dispatcher", title: "Ereignis-Dispatcher", articleId: "event-dispatcher" }
      ],
    },
    {
      id: "premium-information",
      title: "Premium-Abo",
      description: "Geführte Projekte, vertiefende Anleitungen und Projektwissen.",
      surface: "help",
      access: "premium",
      children: [
        { id: "ai-premium", title: "KI-Unterstuetzung und Premium", articleId: "ai-premium" },
        { id: "first-project", title: "Erstes Projekt umsetzen", articleId: "first-project" },
        { id: "update-profiles", title: "Update- und Speicherprofile", articleId: "update-profiles" },
      ],
    },
  ];

  const articles = {
    "from-problem-to-system": {
      title: "Ingenieursmäßig denken: vom Problem zur Lösung",
      summary: "Technisches Interesse ist ein guter Anfang. Ingenieursmäßiges Denken beginnt dort, wo aus einer Idee eine klare Problemstellung, nachvollziehbare Entscheidungen und eine prüfbare Lösung werden.",
      access: "public",
      sections: [
        { id: "engineering-thinking-problem", heading: "Nicht Technologie, sondern Problem", paragraphs: [
          "Ein Ingenieur beginnt selten mit der Frage: Welche Technologie möchte ich einsetzen? Am Anfang steht eine Aufgabe. Ein Unternehmen will Kosten senken, ein Team will einen Fehler vermeiden, ein Mensch will ein Gerät einfacher bedienen oder ein eigenes Projekt umsetzen.",
          "Technik ist dabei ein Mittel, nicht das Ziel. Auch bei KI gilt das: Ein Versprechen wie 'mehr Effizienz durch KI' ist noch keine Lösung. Erst wenn klar ist, welcher Ablauf heute zu langsam, fehlerhaft oder teuer ist, kann man beurteilen, ob KI, eine Automatisierung oder vielleicht nur eine bessere Struktur wirklich hilft.",
          "Ingenieursmäßig denken bedeutet deshalb: Ziel, Rahmenbedingungen, Risiken und Erfolgskriterien zuerst sichtbar machen. Danach wird die kleinste Lösung gesucht, die das Problem zuverlässig löst."
        ] },
        { id: "engineering-thinking-knowledge", heading: "Wissen, Analyse und KI", paragraphs: [
          "Ein technisches Studium ist nicht für jeden der passende Weg. Es verlangt Ausdauer für Mathematik, Modelle, unvollständige Informationen, Fehleranalyse und Verantwortung. Das bedeutet nicht, dass Menschen ohne Studium kein technisches Verständnis haben oder keine anspruchsvollen Projekte bauen können.",
          "Lange war tiefes technisches Wissen vor allem dort gut erreichbar, wo Zeit, Ausbildung oder ein erfahrener Mentor vorhanden waren. Ich möchte dieses Wissen weitergeben, ohne so zu tun, als könne eine einzelne Person jede Frage für alle beantworten.",
          "KI verändert den Zugang: Sie kann Begriffe erklären, Beispiele erzeugen, Code lesen und beim Nachdenken helfen. Sie hat aber keine eigenen Wünsche, kein eigenes Ziel und keine Verantwortung für die Folgen. Die Problemstellung, die Bewertung von Risiken und die Entscheidung, wann ein Ergebnis gut genug ist, bleiben beim Menschen. Genau deshalb passt KI gut zum ingenieursmäßigen Arbeiten: als Werkzeug für einen Menschen, der bewusst entscheidet."
        ] },
        { id: "engineering-thinking-learning", heading: "Viele Wege ins Lernen", paragraphs: [
          "Meine Problemstellung für GerNetiX lautet: Wie kann ich Wissen und Fähigkeiten zu verteilten Systemen so vermitteln, dass Menschen wirklich eigene Projekte umsetzen können? Schon hier gibt es keine Einheitslösung. Manche lesen gern, andere verstehen durch Ausprobieren, wieder andere brauchen Rückfragen oder einen Mentor.",
          "Darum ist GerNetiX kein einzelnes Mammutprojekt und kein Kurs, den alle gleich durchlaufen müssen. Der Lernprojektkatalog bietet kleine Projekte mit unterschiedlichen Schwerpunkten. Du kannst lesen, experimentieren, eine Vorlage verändern oder dir gezielt Unterstützung holen.",
          "Ein gutes Lernprojekt soll Spaß machen, klein beginnen dürfen und keine große Anfangsinvestition verlangen. Gleichzeitig darf es wachsen, wenn du mehr lernen willst."
        ] },
        { id: "engineering-thinking-tamagotchi", heading: "Die Tamagotchi-Lernreise: ein Projekt wächst mit dir", tamagotchiIllustration: true, aiIllustrationAfterParagraph: 4, paragraphs: [
          "Ein Tamagotchi ist ein gutes Beispiel, weil es klein anfangen kann und jede Erweiterung eine neue, nachvollziehbare Frage aufwirft. Zuerst lebt es als kleine Browser-App. Ein Zustandsautomat entscheidet etwa: satt, hungrig oder Warnung. Das ist bereits ein vollwertiges erstes Projekt.",
          "Soll das Tamagotchi seinen Zustand behalten, wenn die App geschlossen wird? Dann brauchst du dauerhaften Speicher und lernst, warum Daten modelliert und gespeichert werden. Soll es weiterleben, obwohl keine App geöffnet ist? Dann kommt ein Hintergrundprozess dazu. Soll es in deine Tasche? Dann brauchst du ein IoT-Gerät mit Anzeige, Eingaben, eventuell Ton und einer passenden Stromversorgung.",
          "Möchtest du dasselbe Tamagotchi auf Handy, Computer und Gerät sehen, entsteht die nächste Frage: Wie werden Zustände synchronisiert? Ein kleiner Server kann zuerst auf einem ESP-Board laufen. Soll er von mehreren Orten erreichbar sein, wird daraus ein Internet-Server. Wenn zwei Geräte gleichzeitig füttern, musst du Konflikte behandeln. Wenn Fremde es nicht füttern dürfen, brauchst du Identität und Berechtigungen.",
          "Bis hierhin ist dein Tamagotchi ein absolut vorhersehbares Modell. Es reagiert auf dieselben Ereignisse immer auf dieselbe Weise. Das nennt man deterministisch. Im Zeitalter der KI können wir den nächsten Schritt gehen: Das Tamagotchi darf überraschendere Bedürfnisse und Interaktionen entwickeln – und es kann zugleich zu einem kleinen persönlichen Assistenten werden.",
          "Dafür verbinden wir es mit KI. Hier trifft eine früher kaum umsetzbare Anforderung auf verfügbare Technik. Aber auch KI hat Grenzen: Sie beantwortet Fragen nicht von allein, sie braucht einen Auslöser. Außerdem kostet ein Online-Aufruf Geld und benötigt eine Internetverbindung. Die Ingenieursfrage lautet deshalb nicht nur: Können wir KI einsetzen? Sondern: Welches Modell erfüllt unsere Aufgabe mit vertretbarem Aufwand?",
          "Wir könnten die Online-KI jede Stunde fragen, ob das Tamagotchi mit uns interagieren möchte. Das wäre möglich, aber teuer und unnötig abhängig vom Internet. Wir könnten auch ein lokales KI-Modell einsetzen. Je nach Komplexität reicht dafür ein normaler PC, oder es wird spezielle Embedded-Hardware benötigt, etwa ein aktueller Raspberry Pi. Eine dritte Möglichkeit ist, die KI einmalig ein Verhaltensmodell entwickeln zu lassen. Dieses Modell läuft danach lokal und deterministisch. Wenn wir seine Regeln nicht im Detail analysieren, bleibt sein Verhalten für uns trotzdem überraschend.",
          "Für dieses Lernprojekt entscheide ich mich aus Kosten- und Verfügbarkeitsgründen für diese dritte Variante: Wir lassen eine KI einmalig ein Verhaltensmodell erstellen und beobachten anschließend, was daraus entsteht. So wird deutlich: KI ist nicht gleich KI. Je nachdem, was wir erreichen wollen, wählen wir Online-KI, lokale KI oder ein von KI erzeugtes Regelmodell – bewusst statt nur, weil die Technik gerade möglich ist.",
          "So lernst du nicht abstrakt 'alles über IT'. Du hast bei jedem Schritt einen Grund für Zustandsautomaten, Apps, Embedded-Hardware, Kommunikation, Datenspeicherung, Server, Synchronisierung, Sicherheit und nun auch für eine begründete KI-Architekturentscheidung."
        ] },
        { id: "engineering-thinking-models", heading: "Vorgehensmodelle: Struktur für unterschiedliche Aufgaben", paragraphs: [
          "Wasserfallmodell, V-Modell und agiles Arbeiten sind keine konkurrierenden Glaubensrichtungen. Sie unterstützen je nach Umfang, Risiko und Problemstellung unterschiedlich: Wie klar ist die Aufgabe schon? Wie teuer wäre ein Fehler? Wie schnell kann sich das Ziel noch verändern?"
        ], developmentPhases: true, phaseDescriptions: [
          { title: "Anforderungen klären:", description: "Das Problem, die Ziele, Rahmenbedingungen und Erfolgskriterien werden verständlich beschrieben. Es wird festgelegt, was die Lösung leisten muss – und was ausdrücklich nicht dazugehört." },
          { title: "Entwurf erstellen:", description: "Es wird entschieden, wie die Lösung grundsätzlich aufgebaut sein soll: Komponenten, Daten, Schnittstellen, Bedienung und technische Risiken werden geplant." },
          { title: "Umsetzung realisieren:", description: "Der Entwurf wird in funktionierende Hardware, Software, Konfiguration oder Dokumentation überführt. Dabei entsteht etwas, das tatsächlich ausprobiert werden kann." },
          { title: "Testen und bewerten:", description: "Es wird gezielt geprüft, ob die Lösung die Anforderungen erfüllt. Fehler, Abweichungen und offene Risiken werden sichtbar gemacht und nachvollziehbar bearbeitet." },
          { title: "Betrieb und Weiterentwicklung:", description: "Die Lösung wird genutzt, überwacht, gewartet und bei Bedarf verbessert. Rückmeldungen aus der Praxis können neue oder veränderte Anforderungen erzeugen." }
        ], followUpParagraphs: [
          "Die Phasen werden je nach Vorgehensmodell unterschiedlich verbunden. Man springt nicht beliebig mittendrin zu einem anderen Abschnitt. Wenn neue Erkenntnisse eine Änderung verlangen, wird bewusst zu der Phase zurückgegangen, deren Ergebnis überarbeitet werden muss – mit klarer Begründung und erneutem Durchlaufen der betroffenen Schritte.",
          "Das Wasserfallmodell passt, wenn das Problem sehr genau bekannt ist und sich Anforderungen kaum ändern. Eine große Idee wird schrittweise konkret beschrieben, realisiert und am Ende getestet. Sein Schwerpunkt liegt auf Planbarkeit: Man weiß früh, was wann entstehen soll. Genau das ist aber auch sein Nachteil. Stellt ein später Test fest, dass die Umsetzung oder schon der Entwurf falsch war, muss das starre Modell durch Rücksprünge und Ausnahmeregeln ergänzt werden. Deshalb wird es heute vor allem noch in klar abgegrenzten Bereichen eingesetzt.",
          "Das V-Modell eignet sich besonders für sicherheitsrelevante oder sehr qualitätskritische Systeme. Zu jeder Entwicklungsstufe auf der linken Seite gehört eine passende Prüfstufe auf der rechten Seite: Der Software-Entwurf wird mit Unit-Tests geprüft, der System-Entwurf mit Integrationstests und die Systemanforderung mit Systemtest und Abnahme. Findet ein Test einen Fehler, führt die Rückmeldung gezielt zu der zugehörigen Anforderung oder Entwurfsstufe zurück. So bleibt nachvollziehbar, was geprüft wurde, warum etwas geändert wird und welche Tests danach erneut nötig sind.",
          "Agiles Arbeiten ist sinnvoll, wenn das Ziel noch nicht vollständig klar ist oder sich durch Rückmeldung verändern kann. Statt einen sehr großen Plan einmal komplett umzusetzen, wird in kurzen Zyklen gearbeitet: ein kleines Ziel klären, entwerfen, bauen, prüfen, mit Nutzern bewerten und aus den Erkenntnissen den nächsten Schritt ableiten. Auch hier werden die Entwicklungsphasen nicht ausgelassen; sie werden nur in kleinen, wiederholbaren Abschnitten durchlaufen. Das schafft frühes Feedback und senkt das Risiko, lange an einer Lösung zu arbeiten, die am Ende niemand braucht.",
          "Kein Modell ersetzt Denken. Für ein kleines Lernprojekt kann ein kurzer agiler Zyklus reichen. Für ein fest definiertes Gerät hilft eine wasserfallartige Planung. Für Systeme, bei denen Fehler Menschen gefährden oder hohe Schäden verursachen können, braucht es die nachweisbare Absicherung des V-Modells. Gute Ingenieursarbeit wählt den Prozess, der das Risiko der jeweiligen Aufgabe sinnvoll beherrscht."
        ], waterfallModelAfterFollowUp: 0, vModelAfterFollowUp: 1, agileModelAfterFollowUp: 2, engineeringModels: true },
        { id: "engineering-thinking-industry", heading: "Was das mit Industrie zu tun hat", paragraphs: [
          "Auch in der Industrie wird meist nicht die Welt neu erfunden. Vorhandene Technologien werden so kombiniert, dass ein Ziel mit vertretbarem Risiko, nachvollziehbaren Kosten und passendem Aufwand erreicht wird. Forschung ist wichtig, aber sie ist nicht jede Aufgabe.",
          "Die beste technische Lösung ist nicht die größte oder modernste. Warum sollte jedes Auto einen KI-Supercomputer erhalten, wenn ein kleiner Mikrocontroller die Aufgabe sicherer, sparsamer und zuverlässiger erledigt? Die richtige Frage lautet: Welche Fähigkeit wird wirklich gebraucht, und welche Technik erfüllt sie mit möglichst wenig unnötiger Komplexität?",
          "Genau diese Denkweise übst du in GerNetiX. Du lernst Technologien nicht als Sammlung von Schlagwörtern kennen, sondern weil dein Projekt sie an einer bestimmten Stelle wirklich braucht."
        ] },
        { id: "engineering-thinking-foundations", heading: "Welche Grundlagen verteilte Systeme brauchen", paragraphs: [
          "Ingenieursmäßiges Denken sagt noch nicht, wie ein Sensor misst, ein Widerstand eine Spannung begrenzt oder ein Mikrocontroller ein Programm ausführt. Um ein verteiltes System wirklich zu begreifen, brauchen wir deshalb Grundlagen aus zwei Welten: Elektrotechnik und Informatik.",
          "Die Elektrotechnik erklärt, was Hardware physikalisch kann und welche Grenzen sie hat. Ein Widerstand, Kondensator, Transistor oder fest verdrahtetes Logikgatter folgt Material, Schaltung und elektrischen Gesetzen. Diese Bauteile werden nicht durch Software neu beschrieben.",
          "Die Informatik erklärt, wie Software Regeln, Daten und Abläufe beschreibt. Ein Mikrocontroller ist Hardware mit einem Prozessor; auf ihm läuft Firmware – also Software, die die vorhandene Hardware innerhalb ihrer physikalischen Grenzen steuert. Sie entscheidet zum Beispiel, wann ein Sensor gelesen, ein Signal ausgewertet oder ein Ausgang geschaltet wird.",
          "Erst danach kommt das Zusammenspiel: Wenn Geräte, ihre Firmware, Netzwerke, Server und Anwendungen Informationen austauschen, entsteht ein verteiltes System. Die folgenden Kapitel bauen genau in dieser Reihenfolge auf: zuerst Elektrotechnik, dann Mikrocontroller und Embedded, danach Informatik und Software – und schließlich verteilte Systeme.",
          "Du musst dafür nicht von Anfang an alles können. Je nach Problemstellung braucht ein Projekt mehr Elektrotechnik, mehr Informatik oder nur ein grundlegendes Verständnis von einem Bereich. Manche Menschen starten lieber mit Schaltungen und Messungen, andere mit Programmierung, Daten oder Bedienoberflächen. Konzentriere dich zunächst auf deine Stärken und die nächste sinnvolle Aufgabe. Wenn dich der Ehrgeiz packt, kannst du dich Schritt für Schritt in das andere Fachgebiet einarbeiten – genau dafür ist dieses Wissensportal da."
        ] },
        { id: "engineering-thinking-next-steps", heading: "Mit Beispielen weiterlernen", paragraphs: [
          "Du hast noch nicht alles verstanden? Kein Problem. Vorgehensmodelle, Tests und Rückkopplungen lernt man nicht durch einen kurzen Text. Sie werden greifbar, wenn du sie in einem konkreten Projekt anwendest, Entscheidungen triffst und die Folgen davon siehst.",
          "Deshalb wird es für jedes Modell ein Lernprojekt mit einer nachvollziehbaren Problemstellung geben. Die folgenden Einträge sind zunächst Platzhalter für diese Beispiele."
        ], learningProjects: [
          { model: "Wasserfallmodell", title: "Wetterstation mit festem Auftrag", description: "Eine klar beschriebene Aufgabe von der Anforderung bis zum Test planen.", href: "/app/learn/?project=waterfall-wetterstation" },
          { model: "V-Modell", title: "Zutrittsanzeige mit Prüfnachweisen", description: "Anforderungen, Entwurf und passende Tests gezielt miteinander verbinden.", href: "/app/learn/?project=v-modell-zutrittsanzeige" },
          { model: "Agil", title: "Tamagotchi in kleinen Zyklen", description: "Eine Idee schrittweise bauen, erproben und aus Rückmeldungen weiterentwickeln.", href: "/app/learn/?project=agil-tamagotchi" }
        ] },
      ],
      relatedTopics: ["software-basics", "microcontroller-basics", "server-systems"],
    },
    "ai-basics": {
      title: "Die Künstliche Intelligenz: GPT, Alexa und LLMs",
      summary: "KI ist kein einzelnes Produkt. Entscheidend ist, welche Aufgabe sie lösen soll, wo sie laufen darf und welche Kosten sowie Datenwege dazu passen.",
      access: "public",
      sections: [
        { id: "ai-gpt-and-alexa", heading: "GPT und Alexa sind nicht dasselbe", paragraphs: [
          "GPT bezeichnet eine Familie großer Sprachmodelle. Solche Modelle können Sprache verstehen und erzeugen, Texte zusammenfassen, Ideen ausarbeiten, Code erklären oder bei Entscheidungen unterstützen. GPT ist dabei das Modell – nicht automatisch eine fertige Anwendung mit Mikrofon, Lautsprecher und Haussteuerung.",
          "Alexa ist dagegen vor allem ein Sprachassistent und ein Produkt: Du sprichst mit einem Gerät oder einer App, die Sprache wird erkannt, eine Anfrage wird verarbeitet und eine Antwort oder Aktion ausgelöst. Klassische Sprachassistenten arbeiten häufig mit fest definierten Befehlen und Diensten, etwa für Timer, Musik oder Smart Home. Sie können LLMs nutzen, sind aber nicht selbst gleichbedeutend mit einem LLM.",
          "Für dein Projekt ist diese Trennung wichtig: Ein Assistent beschreibt die sichtbare Bedienung. Ein LLM ist eine mögliche Denk- und Sprachkomponente dahinter. Dazwischen liegen weiterhin klare Regeln, Berechtigungen, Schnittstellen und die Entscheidung, welche Aktion ein System tatsächlich ausführen darf."
        ] },
        { id: "ai-llm", heading: "LLM: ein großes Sprachmodell", paragraphs: [
          "LLM steht für Large Language Model, also großes Sprachmodell. Vereinfacht gesagt verarbeitet es Text in kleinen Einheiten und berechnet, welche nächste Einheit zu einer Eingabe wahrscheinlich sinnvoll passt. Dadurch kann es Gespräche führen, Inhalte umformulieren und Muster aus vielen Beispielen anwenden.",
          "Ein LLM hat dabei kein eigenes Ziel, keine Wünsche und kein verlässliches Weltverständnis wie ein Mensch. Es erzeugt plausible Antworten auf Grundlage seiner Eingabe und seines Trainings. Deshalb braucht es eine gute Aufgabenbeschreibung, überprüfbare Regeln und bei wichtigen Entscheidungen immer eine menschliche oder technisch klar definierte Kontrolle.",
          "Ein LLM kann als Gesprächspartner dienen, ein Regelmodell für dein Tamagotchi entwerfen oder Texte in strukturierte Daten überführen. Es sollte aber nicht ohne zusätzliche Schutzmechanismen selbstständig Türen öffnen, Geld ausgeben oder sicherheitsrelevante Geräte steuern."
        ] },
        { id: "ai-vectors-and-embeddings", heading: "Vektoren und Embeddings: Bedeutung als Zahlenraum", embeddingVisual: true, paragraphs: [
          "Die obere Grafik beginnt links mit einem Inhalt, hier dem Satz: „Das Tamagotchi ist hungrig.“ Ein Vektor ist eine geordnete Liste von Zahlen. In der KI wird dieser Inhalt in sehr viele solche Zahlen übersetzt. Mit Vektorgrafiken hat das nur den Namen gemeinsam: Hier geht es nicht um gezeichnete Linien, sondern um eine technische Zahlenbeschreibung.",
          "In der Mitte entsteht daraus ein Embedding, also ein Zahlenvektor wie [0.12, −0.64, 0.81, …]. Rechts zeigt der Bedeutungsraum, was damit möglich wird: Ähnliche Inhalte liegen als Punkte näher beieinander, deutlich andere Inhalte weiter entfernt. So kann eine Anfrage zu Mikrocontrollern und Netzwerk auch Dokumente finden, die andere, aber fachlich ähnliche Wörter verwenden.",
          "Die untere Grafik zeigt den nächsten Schritt. Eigene Dokumente werden einmal als Dokument-Embeddings gespeichert. Wenn ein Nutzer später eine Anfrage stellt, wird auch diese Anfrage in ein Anfrage-Embedding übersetzt. Das System vergleicht beide Zahlenbeschreibungen und findet die Dokumente, deren Bedeutung am besten zur Frage passt.",
          "Erst danach folgen die eigentliche Systemlogik: passende Quellen auswählen, Regeln und Berechtigungen prüfen und dann eine Antwort oder eine ausdrücklich freigegebene Aktion auslösen. Das wird zum Beispiel für semantische Suche und Retrieval Augmented Generation, kurz RAG, verwendet. Ein Vektor zeigt nur Ähnlichkeit – er ist kein Wahrheitsbeweis und trifft keine Entscheidung selbst."
        ] },
        { id: "ai-local-or-online", heading: "Lokal oder über das Internet?", paragraphs: [
          "Ein internetbasiertes LLM läuft bei einem Anbieter. Dein Gerät sendet die Anfrage über das Internet an dessen Dienst und erhält eine Antwort zurück. Das kann leistungsfähige Modelle ohne eigene starke Hardware ermöglichen. Dafür brauchst du eine Verbindung, musst den Datenweg bewusst bewerten und bist von Verfügbarkeit, Regeln und Preisen des Dienstes abhängig.",
          "Ein lokales LLM läuft auf eigener Hardware: zum Beispiel auf einem PC, einem Server zu Hause oder – bei kleineren Modellen – auf geeigneter Edge-Hardware. Das kann auch ohne Internet funktionieren und gibt dir mehr Kontrolle über Daten und Verfügbarkeit. Im Gegenzug musst du Rechenleistung, Speicher, Energiebedarf, Updates und Betrieb selbst einplanen.",
          "Es gibt keine grundsätzlich bessere Variante. Für eine seltene, anspruchsvolle Frage kann ein Online-Modell sinnvoll sein. Für private Daten, häufige kleine Anfragen oder einen offlinefähigen Assistenten kann ein lokales Modell die bessere Wahl sein. Manchmal ist ein Mischmodell passend: Die eigentliche Steuerung bleibt lokal, nur freiwillige Wissens- oder Kreativaufgaben gehen an einen Online-Dienst."
        ] },
        { id: "ai-payment-models", heading: "Kosten und Zahlungsmodelle", paragraphs: [
          "Bei Online-KI gibt es häufig zwei unterschiedliche Zahlungsarten. Ein Abo bezahlt meist den Zugang zu einer fertigen Anwendung mit bestimmten Funktionen und Grenzen. Es ist nicht automatisch dasselbe wie ein technischer Zugang für deine eigene App oder dein IoT-Projekt.",
          "Für die direkte Einbindung in eigene Software wird oft nutzungsbasiert abgerechnet. Dabei zählen Eingabe und Antwort, meist in Textmengen oder Tokens. Eine einzelne Anfrage kann sehr günstig sein, viele regelmäßige Aufrufe können sich aber summieren. Deshalb gehört zur Architektur immer eine Kostenfrage: Wie oft ist eine KI-Antwort wirklich nötig, und welche günstigere Logik kann dieselbe Aufgabe lokal erledigen?",
          "Ein lokales Modell hat normalerweise keine Abrechnung pro Anfrage durch einen Anbieter. Die Kosten verschwinden dadurch nicht: Hardware, Strom, Speicher, Wartung und gegebenenfalls ein leistungsfähiger PC oder Server gehören zur Rechnung. Ingenieursmäßig gedacht vergleichst du also nicht nur den Preis pro KI-Aufruf, sondern auch Datenschutz, Verfügbarkeit, Antwortzeit, Energiebedarf und den Aufwand für den Betrieb."
        ] }
      ],
      relatedTopics: ["from-problem-to-system", "server-systems", "microcontroller-basics"],
    },
    "distributed-systems-introduction": {
      title: "Verteilte Systeme: Wenn zwei Welten zusammenarbeiten",
      summary: "Ein verteiltes System verbindet die physische Welt mit Software, Kommunikation und Bedienung. Keine einzelne Komponente löst die Aufgabe allein.",
      access: "public",
      sections: [
        { heading: "Von der einzelnen Aufgabe zum System", paragraphs: ["Ein Temperatursensor kann eine Temperatur messen. Ein Mikrocontroller kann den Messwert lesen und mit seiner Firmware bewerten. Damit daraus eine verständliche Anzeige, eine Benachrichtigung oder eine Regel für mehrere Orte wird, kommen Netzwerk, Server und eine Anwendung hinzu. Diese Teile arbeiten getrennt, müssen aber zuverlässig zusammenpassen – deshalb sprechen wir von einem verteilten System."] },
        { heading: "Die Rollen sind verschieden", table: { headers: ["Teil", "Stärke", "Typische Aufgabe"], rows: [["Elektrotechnik und Hardware", "misst, schaltet, speichert Energie und überträgt Signale", "Sensor, Stromversorgung, Aktor und Board"], ["Firmware", "reagiert nah an der Hardware und mit begrenzten Ressourcen", "Messwert auswerten, Motor sicher ansteuern, WLAN verbinden"], ["Netzwerk und Server", "verbindet mehrere Geräte und Nutzer", "Daten speichern, Regeln koordinieren, Fernzugriff anbieten"], ["Apps und Web-Oberflächen", "machen Informationen und bewusste Befehle für Menschen zugänglich", "Status zeigen, Einstellungen ändern, Warnungen darstellen"]] } },
        { heading: "Die richtige Verteilung wählen", paragraphs: ["Nicht jedes Projekt braucht Cloud, App und mehrere Server. Eine lokale Temperaturregelung muss auch ohne Internet sicher funktionieren. Ein Server ist sinnvoll, wenn Geräte oder Menschen über mehrere Orte hinweg zusammenarbeiten, Daten langfristig ausgewertet werden oder ein zentraler Zugang gebraucht wird. Gute Architektur verteilt Aufgaben nur dort, wo es einen klaren Nutzen gibt."] },
        { heading: "So geht es weiter", paragraphs: ["In diesem Kapitel geht es nun um die Verbindungen zwischen den Teilen: Software auf mehreren Ebenen, Schnittstellen, Nachrichten und passende Server. Die vorherigen Kapitel liefern dafür die Grundlagen: Hardware bestimmt die physikalischen Möglichkeiten, Software und Firmware beschreiben das Verhalten innerhalb dieser Grenzen."] },
      ],
      relatedTopics: ["from-problem-to-system", "hardware-landscape", "software-basics-introduction", "communication-basics", "server-systems"],
    },
    "communication-basics": {
      title: "Kommunikation und Schnittstellen",
      summary: "Verteilte Systeme werden erst dann zu einem gemeinsamen Projekt, wenn sie zuverlässig, verständlich und sicher miteinander kommunizieren können.",
      access: "public",
      sections: [
        { id: "communication-rest", heading: "REST und HTTP: fragen und antworten", paragraphs: [
          "REST ist ein verbreiteter Stil für Web-Schnittstellen. Eine App oder ein Gerät sendet über HTTP eine Anfrage an eine Adresse, der Server verarbeitet sie und sendet eine Antwort zurück. Ein Beispiel: Die Tamagotchi-App fragt den Server nach dem aktuellen Zustand oder sendet den Wunsch, das Tamagotchi zu füttern.",
          "HTTP-Methoden machen die Absicht lesbar: GET liest Daten, POST legt etwas Neues an oder löst eine Aktion aus, PUT oder PATCH aktualisieren vorhandene Daten und DELETE entfernt etwas. Eine gute REST-API beschreibt klar, welche Adresse welche Daten erwartet, welche Antwort zurückkommt und was bei einem Fehler passiert.",
          "REST passt besonders gut, wenn ein Nutzer oder eine App bewusst etwas abfragt oder auslöst. Es ist leicht zu testen, gut dokumentierbar und funktioniert über viele Plattformen hinweg. Für ständig neue Ereignisse oder sehr viele kleine Sensormeldungen ist ein anderes Kommunikationsmuster oft besser geeignet."
        ] },
        { id: "communication-events", heading: "Ereignisse, Webhooks und WebSockets", paragraphs: [
          "Bei einem Ereignis informiert ein System ein anderes darüber, dass etwas passiert ist: Ein Grenzwert wurde überschritten, ein Update steht bereit oder dein Tamagotchi wird hungrig. Der Empfänger muss nicht ständig nachfragen. Das ist ein anderes Muster als die klassische REST-Anfrage.",
          "Ein Webhook ist eine vorher vereinbarte HTTP-Adresse, die ein System bei einem Ereignis aufruft. WebSockets halten dagegen eine offene Verbindung zwischen Client und Server. So können beide Seiten schnell Nachrichten austauschen, etwa für einen Live-Status in einer Web-App.",
          "Ereignisorientierte Kommunikation braucht klare Regeln: Welche Ereignisnamen gibt es? Welche Daten dürfen sie enthalten? Was passiert, wenn der Empfänger kurz offline ist? Ein Ereignis sollte auch doppelt eintreffen können, ohne ungewollt zweimal dieselbe Aktion auszulösen."
        ] },
        { id: "communication-mqtt", heading: "MQTT: Nachrichten für IoT", paragraphs: [
          "MQTT ist ein leichtgewichtiges Nachrichtenprotokoll für Geräte, Sensoren und Aktoren. Geräte veröffentlichen Nachrichten zu einem Thema, zum Beispiel 'haus/wohnzimmer/temperatur'. Andere Systeme abonnieren dieses Thema und erhalten die Nachricht, wenn sie dafür berechtigt sind.",
          "Dazwischen steht ein MQTT-Broker. Er nimmt Nachrichten entgegen und verteilt sie an die passenden Empfänger. Dadurch müssen Geräte einander nicht direkt kennen. Ein ESP32 kann einen Messwert senden, während eine App, ein Home Server und ein Regelwerk ihn gleichzeitig verwenden.",
          "MQTT passt gut zu vielen kleinen Meldungen, wechselnden Verbindungen und verteilten IoT-Geräten. Es ersetzt REST nicht vollständig: Konfigurationen, Konten oder einmalige Abfragen können weiterhin sinnvoll über eine REST-API laufen. Gute Systeme kombinieren beide Muster bewusst."
        ] },
        { id: "communication-data-security", heading: "JSON, Identität und Berechtigungen", paragraphs: [
          "JSON ist ein einfaches Textformat für strukturierte Daten. Statt nur '23' zu senden, kann eine Nachricht zum Beispiel Temperatur, Einheit, Zeit und Gerätekennung enthalten. Ein klar definiertes Datenformat verhindert Missverständnisse zwischen App, Server und Gerät.",
          "Eine Schnittstelle darf nicht nur technisch erreichbar sein, sondern muss auch wissen, wer kommuniziert. Identität beantwortet die Frage: Wer ist dieses Gerät oder dieser Nutzer? Berechtigung beantwortet: Was darf diese Identität lesen, ändern oder auslösen? Diese beiden Fragen gehören zu jeder API und zu jedem MQTT-Thema.",
          "Plane außerdem Fehlerfälle mit ein: ungültige Daten, fehlende Verbindung, abgelaufene Zugangsdaten oder doppelte Nachrichten. Eine gute Schnittstelle beantwortet nicht nur den Idealfall, sondern bleibt auch dann nachvollziehbar und sicher, wenn etwas schiefgeht."
        ] }
      ],
      relatedTopics: ["from-problem-to-system", "server-systems", "microcontroller-basics"],
    },
    "software-basics-introduction": {
      title: "Was Software ist: von der Idee zum ausführbaren Programm",
      summary: "Software beschreibt, welche Aufgabe ein Gerät erfüllen soll. Je nach Zielsystem wird sie direkt in Maschinencode übersetzt oder mit einer Laufzeitumgebung ausgeführt.",
      access: "public",
      sections: [
        { id: "software-purpose", heading: "Warum gibt es Software?", paragraphs: [
          "Hardware kann rechnen, speichern, messen und Signale ausgeben. Ohne Software weiß sie aber nicht, welche Aufgabe sie in welcher Reihenfolge erledigen soll. Software macht aus derselben Hardware eine Uhr, eine Wetterstation, eine Musik-App oder einen Server für viele Nutzer.",
          "Sie hält Regeln und Abläufe fest: Was passiert, wenn ein Taster gedrückt wird? Welche Temperatur soll angezeigt werden? Wer darf eine Einstellung ändern? Gute Software übersetzt eine fachliche Aufgabe in eindeutige Schritte, die ein Computer wiederholt und zuverlässig ausführen kann. Sie verändert dabei nicht die physikalischen Eigenschaften eines Widerstands, eines Transistors oder eines fest verdrahteten Logikgatters; sie steuert nur die vorhandenen programmierbaren Teile innerhalb ihrer Grenzen."
        ] },
        { id: "software-source-code", heading: "Quelltext: Anweisungen für Maschinen", paragraphs: [
          "Menschen schreiben Software meist als Quelltext in einer Programmiersprache wie C, C++, Rust, Java, Python oder JavaScript. Dieser Text ist für Menschen lesbar genug, um ihn zu erklären, zu prüfen und zu verändern. Für den Prozessor ist er zunächst noch nicht direkt ausführbar.",
          "Ein Programm besteht nicht nur aus Rechenbefehlen. Es beschreibt auch Daten, Entscheidungen, Wiederholungen, Fehlerfälle und die Zusammenarbeit mit Anzeige, Netzwerk, Speicher oder Sensoren. Das Ergebnis kann eine App, eine Website, Firmware für ein Gerät oder ein Hintergrunddienst sein."
        ] },
        { id: "software-compilation", heading: "Kompilieren: in Maschinencode übersetzen", paragraphs: [
          "Beim Kompilieren übersetzt ein Compiler den Quelltext vor dem Start in Befehle für eine bestimmte Prozessorfamilie. Diese sehr einfachen Befehle heißen Maschinencode. Ein Programm für einen ESP32 enthält daher andere Maschinenbefehle als ein Programm für einen Windows-PC oder ein iPhone.",
          "Oft folgt danach das Linken: Der Linker verbindet den eigenen Code mit benötigten Programmteilen zu einer ausführbaren Datei oder Firmware. Beim Flashen wird diese Firmware in den nichtflüchtigen Speicher des Mikrocontrollers geschrieben. Beim Start kann der Prozessor die Befehle direkt ausführen.",
          "Kompilieren findet nicht nur bei C oder C++ statt. Auch andere Sprachen können vorher oder während der Ausführung in Maschinencode überführt werden. Entscheidend ist: Für die CPU müssen am Ende immer passende Maschinenbefehle entstehen."
        ] },
        { id: "software-libraries", heading: "Bibliotheken: bewährte Bausteine nutzen", paragraphs: [
          "Eine Bibliothek ist ein wiederverwendeter Programmbaustein. Sie kann zum Beispiel eine Anzeige ansteuern, verschlüsselte Netzwerkverbindungen aufbauen, Daten speichern oder eine Schaltfläche darstellen. So muss nicht jedes Projekt dieselben Grundlagen neu schreiben.",
          "Bibliotheken sparen Zeit, bringen aber Verantwortung mit: Sie müssen zum Zielsystem passen, gepflegt und aktualisiert werden und dürfen nicht mehr Speicher oder Rechenzeit verbrauchen, als das Projekt verträgt. Eine Bibliothek ist kein Zauberpaket, sondern Code mit einer klaren Aufgabe und Abhängigkeiten."
        ] },
        { id: "software-scripts", heading: "Skripte, Interpreter und Laufzeitumgebungen", paragraphs: [
          "Ein Skript ist Quelltext, der häufig erst beim Start von einem Interpreter gelesen und ausgeführt wird. Python ist ein typisches Beispiel: Das Python-Programm braucht eine Python-Laufzeitumgebung. JavaScript im Browser braucht eine JavaScript-Engine. Diese Laufzeitumgebung übernimmt viele allgemeine Aufgaben, benötigt aber selbst Speicher und Rechenzeit.",
          "Die Grenze ist in der Praxis fließend. Java und C# werden oft zuerst in einen Zwischencode übersetzt; eine virtuelle Maschine führt ihn aus oder übersetzt häufig genutzte Teile später mit einem Just-in-Time-Compiler in Maschinencode. Moderne JavaScript-Engines tun Ähnliches. 'Interpretiert' heißt also nicht automatisch langsam, sondern beschreibt vor allem, dass zwischen Quelltext und Prozessor noch eine Laufzeitumgebung arbeitet.",
          "Der Vorteil solcher Umgebungen ist oft eine schnelle Entwicklung: Viele Funktionen, gute Diagnosewerkzeuge und dieselbe Anwendung auf verschiedenen Systemen. Der Nachteil ist zusätzlicher Platzbedarf, ein späterer Start und weniger direkte Kontrolle über Ressourcen."
        ] },
        { id: "software-embedded", heading: "Firmware auf Mikrocontrollern: klein, schnell und berechenbar", paragraphs: [
          "Embedded-Software läuft in Geräten mit klarer Aufgabe, etwa in einem Sensor, einer Fernbedienung, einer Maschine oder einem ESP32-Projekt. Dort sind Flash-Speicher, Arbeitsspeicher, Energie und Rechenzeit begrenzt. Deshalb wird Firmware häufig in C, C++ oder Rust kompiliert und direkt als schlanke Firmware ausgeführt.",
          "Ein großer Interpreter wäre für viele Mikrocontroller unnötiger Ballast: Er belegt Speicher, erzeugt zusätzliche Prozessorlast und kann die Antwortzeit schlechter berechenbar machen. Gerade wenn Sensorwerte rechtzeitig verarbeitet, Motoren gesteuert oder Energie gespart werden muss, zählt ein überschaubares und vorhersehbares Programm.",
          "Das ist keine absolute Regel. Es gibt Mikrocontroller mit MicroPython, Lua oder anderen Laufzeitumgebungen, besonders zum Lernen oder für leistungsfähigere Geräte. Für ein dauerhaftes, ressourcenarmes oder zeitkritisches Produkt wird jedoch meist eine direkt kompilierte Firmware gewählt."
        ] },
        { id: "software-backend", heading: "Backend: Entwicklungsgeschwindigkeit zählt", paragraphs: [
          "Ein Backend ist Software, die im Hintergrund läuft: Es verwaltet Daten, prüft Berechtigungen, stellt Schnittstellen bereit oder verarbeitet Nachrichten von Apps und Geräten. Server haben oft deutlich mehr Arbeitsspeicher und Rechenleistung als ein Mikrocontroller. Speicher und Rechenzeit sind dort nicht kostenlos, aber für viele Anwendungen weniger knapp.",
          "Darum sind im Backend Sprachen mit produktiven Laufzeitumgebungen beliebt, zum Beispiel JavaScript mit Node.js, Python, Java oder C#. Sie ermöglichen schnelle Änderungen, umfangreiche Bibliotheken und gute Werkzeuge für Tests, Fehlersuche und Betrieb. Wenn viel Leistung nötig ist, können einzelne Teile gezielt optimiert oder in kompilierten Sprachen umgesetzt werden.",
          "Die passende Entscheidung hängt nicht nur von Geschwindigkeit ab: Zuverlässigkeit, Sicherheit, Teamwissen, Wartbarkeit, Kosten und Antwortzeiten gehören genauso dazu. Ein kleiner Dienst braucht keine komplizierte Hochleistungsarchitektur, aber ein stark belasteter Dienst braucht klare Grenzen und Messwerte."
        ] },
        { id: "software-client-devices", heading: "PC, Tablet und Smartphone: beide Welten", paragraphs: [
          "Auf PC, Tablet und Smartphone existieren beide Welten nebeneinander. Betriebssysteme und anspruchsvolle Teile von Apps sind häufig nativ kompiliert, damit sie schnell und direkt mit Hardware arbeiten können. Gleichzeitig laufen Web-Apps und viele Programme in Browsern, virtuellen Maschinen oder anderen Laufzeitumgebungen.",
          "Eine Smartphone-App kann zum Beispiel einen nativen Teil für Kamera oder Bluetooth haben, eine Web-Oberfläche anzeigen und mit einem JavaScript- oder Dart-Framework entwickelt sein. Ein PC kann ein kompiliertes Spiel, ein Python-Werkzeug und mehrere Browser-Tabs gleichzeitig ausführen. Leistungsfähige Geräte machen diese Mischung möglich.",
          "Für ein Projekt wählst du daher nicht 'kompiliert gegen interpretiert' als Glaubensfrage. Du fragst: Wo läuft die Software? Wie knapp sind Speicher, Energie und Antwortzeit? Wie schnell muss sich das Produkt ändern? Welche Bibliotheken und Kenntnisse stehen zur Verfügung? So kann ein System aus schlanker Embedded-Firmware, einem entwicklungsfreundlichen Backend und einer plattformübergreifenden App bestehen."
        ] }
      ],
      relatedTopics: ["from-problem-to-system", "server-systems", "microcontroller-basics", "communication-basics"],
    },
    "quick-start": {
      title: "So startest du",
      summary: "Starte mit einem Lernprojekt oder entwickle aus deiner eigenen Idee ein GerNetiX-Projekt.",
      sections: [
        { heading: "Dein erstes Projekt", list: [
          "Wähle für ein geführtes Projekt die Lernplattform oder für deine eigene Idee die Entwicklungsplattform.",
          "Erstelle ein Projekt aus einer Vorlage oder beginne mit einem leeren Projekt und beschreibe sein Ziel.",
          "Klär zuerst die Architektur, wähle passende Hardware und arbeite dann in der IDE weiter.",
          "Registriere und verbinde ein neues Board in der Geräteverwaltung, bevor du es baust und flashst.",
        ] },
        { heading: "Wie geht es weiter?", paragraphs: ["Lernlektionen führen dich Schritt für Schritt durch ein Projekt. Hilfeartikel bleiben kurz und durchsuchbar, wenn du etwas nachschlagen möchtest."] },
      ],
      actions: [{ label: "Entwicklungsprojekt starten", route: "/app/development-platform/" }, { label: "Lernprojekt starten", route: "/app/learn/" }],
      relatedTopics: ["register-device", "pair-device"],
    },
    "create-account": {
      title: "Konto anlegen",
      summary: "Lege ein GerNetiX-Konto an, um Projekte, Lernfortschritt und deine Geräte gemeinsam zu nutzen.",
      sections: [{ heading: "Registrierung", paragraphs: ["Nutze das Formular zur Kontoerstellung und bestätige die erforderlichen Bedingungen. Nach dem Einloggen verbindet GerNetiX Projekte, Lernfortschritt und registrierte Geräte mit deinem Konto."] }],
      relatedTopics: ["quick-start", "register-device"],
    },
    "plan-comparison": {
      title: "Basis, Basis Plus und Premium im Vergleich",
      summary: "Diese Übersicht trennt Funktionen, die heute technisch freigeschaltet sind, von geplanten Angeboten.",
      sections: [
        { heading: "Was heute gilt", table: { headers: ["Funktion", "Basis (kostenlos)", "Basis Plus", "Premium"], rows: [
          ["Eigene Projekte in der IDE bearbeiten", "Ja", "Geplant", "Ja"],
          ["Per USB bauen und flashen", "Ja", "Geplant", "Ja"],
          ["Geführte Lernprojekte", "Nein", "Geplant", "Ja"],
          ["KI-Hilfe in Entwicklung, Code Explorer und Hilfe", "Nein", "Geplant", "Ja, innerhalb der verfügbaren Credits und Limits"],
          ["Web Push für Projektbenachrichtigungen", "Nein", "Geplant", "Ja"],
          ["Premium-Lerninhalte und verbundene Projekterweiterungen", "Nein", "Geplant", "Ja, sofern das jeweilige Projekt diese Freischaltung nutzt"],
        ] } },
        { heading: "Basis Plus ist noch nicht buchbar", paragraphs: ["Basis Plus ist derzeit kein technisch aktiver Plan. Es gibt noch kein eigenes serverseitiges Entitlement, keine separate Abrechnung und keine Funktion, die ausschließlich Basis Plus verlangt.", "Für Basis Plus sind zusätzliche, klar begrenzte Projektressourcen vorgesehen, zum Beispiel Background Worker, Dispatcher-Zugriff und höhere Ausführungsfrequenzen. Welche davon tatsächlich enthalten sind, wird erst mit der Einführung verbindlich angezeigt."] },
        { heading: "Was Premium heute konkret freischaltet", list: ["Geführte Lernprojekte.", "KI-Assistenten in der Entwicklungsplattform, im Code Explorer und im Hilfe-Bereich. KI-Aufrufe bleiben durch Credits, Größenlimits und serverseitige Prüfungen begrenzt.", "Web Push für Projekte, wenn ein Projekt diese Funktion verwendet und du die Browser-Erlaubnis erteilst.", "Premium-Inhalte und Erweiterungen, sobald das jeweilige Lernprojekt oder Angebot sie verlangt."] },
        { heading: "Wichtig", paragraphs: ["Ein ESP32-Recovery-Token erweitert die Wiederherstellung deines Kontos, ist aber kein Premium-Abo. Ebenso ist ein Kampagnen- oder Hardware-Bundle-Token nur dann Premium, wenn er ausdrücklich ein Premium-Entitlement aktiviert."] },
      ],
      relatedTopics: ["ai-premium", "entitlements-and-tokens", "account-types"],
    },
    "account-types": {
      title: "Kontotypen und Zugangsstufen",
      summary: "GerNetiX trennt einen kurzlebigen Einstieg von einem dauerhaften Konto. Erweiterungen sind keine eigenen Konten, sondern klar benannte Berechtigungen.",
      sections: [
        { heading: "Das geplante Zielbild", paragraphs: ["Diese Regeln werden derzeit vorbereitet. Bis sie in der Plattform verfuegbar sind, zeigt GerNetiX bei einer Funktion immer die aktuell wirksame Freischaltung an."] },
        { heading: "Die Zugangsstufen", table: { headers: ["Begriff", "Zweck", "Regeln"], rows: [
          ["Gastzugang", "Unverbindlich ausprobieren", "1 MB; endet nach 24 Stunden; keine Wiederherstellung."],
          ["Passkey-Konto", "Dauerhaft lernen und eigene Projekte speichern", "Passkey ist Pflicht; persoenliches Offline-Recovery-Set, Social Recovery und ESP32-Recovery-Token sind freiwillige Zusatzwege. Derzeit als Zielwert 5 MB; Loeschung erst nach konfigurierbarer Inaktivitaet."],
          ["Konto mit ESP32-Recovery-Token", "Zusaetzliche Wiederherstellung und hoehere Ressourcen", "Der erste angemeldete ESP32 wird automatisch zum Recovery-Board; bis zu drei aktive Boards. Zielwert 10 MB und laengere Inaktivitaetsfrist."],
          ["Premium-Entitlement", "Zusaetzliche Inhalte und Dienste", "Kein eigener Kontotyp. Es erweitert ein bestehendes Konto fuer eine Laufzeit oder als bezahlte Leistung."],
        ] } },
        { heading: "Wichtig", paragraphs: ["Der erste ESP32, den du deinem Konto hinzufuegst, wird zwingend als ESP32-Recovery-Token gefuehrt. Er erweitert damit das Basiskonto zum ESP32-Konto. Ein Kampagnen-Premium-Token ist dagegen ein einmal einloesbarer Gutschein. Beide Begriffe beschreiben unterschiedliche Dinge."] },
      ],
      relatedTopics: ["registration-login-recovery", "entitlements-and-tokens", "webshop-activation-codes"],
    },
    "registration-login-recovery": {
      title: "Registrierung, Anmeldung und Wiederherstellung",
      summary: "So wird aus einem Gastzugang ein dauerhaftes Konto – ohne verpflichtende E-Mail-Adresse.",
      sections: [
        { heading: "Konto anlegen", list: ["Lege einen Spitznamen fest.", "Richte einen Passkey auf deinem Smartphone, Computer oder Sicherheitsschluessel ein. Er ist der verpflichtende Login für das dauerhafte Konto.", "Danach ist das Konto sofort nutzbar; weitere Absicherungen sind nicht Teil des Einstiegs."] },
        { heading: "Konto einrichten abschließen", paragraphs: ["Auf dem Dashboard findest du anschließend die Kachel Konto einrichten abschließen. Dort kannst du in Ruhe erklären lassen und freiwillig ein persönliches Offline-Recovery-Set, ESP32-Recovery-Token oder später Social Recovery ergänzen."] },
        { heading: "Anmelden", paragraphs: ["Wähle beim Anmelden einfach deinen gespeicherten Passkey. GerNetiX ordnet das ausgewählte Credential deinem Konto zu; dein Spitzname ist dafür nicht erforderlich. Der Spitzname bleibt nur als freiwilliger Kompatibilitätsweg verfügbar. Ein Passkey bestätigt lokal auf deinem Gerät, zum Beispiel mit PIN, Fingerabdruck oder Gesicht. Diese lokalen Daten werden nicht an GerNetiX übertragen."] },
        { heading: "Passwort vergessen", paragraphs: ["Ein neues Passwort kann jeweils allein durch einen eingerichteten Passkey, dein persoenliches Offline-Recovery-Set, Social Recovery mit zwei von drei Anteilen oder ein aktives ESP32-Recovery-Token gesetzt werden. Nach einer Wiederherstellung enden bestehende Sitzungen."] },
        { heading: "Wenn ein Recovery-Weg verloren geht", paragraphs: ["Melde dich ueber einen anderen vorhandenen Weg an und widerrufe oder ersetze den verlorenen Passkey beziehungsweise das Board. Nach einer endgueltigen Kontoloeschung kann kein Recovery-Weg das alte Konto wiederherstellen."] },
      ],
      relatedTopics: ["account-types", "entitlements-and-tokens", "register-device"],
    },
    "entitlements-and-tokens": {
      title: "Premium, Entitlements und Token",
      summary: "Entitlements steuern Zusatzfunktionen. Sie sind von Kontotypen und Recovery-Wege getrennt.",
      sections: [
        { heading: "Heute in der Plattform", table: { headers: ["Plan", "Derzeit freigeschaltet"], rows: [
          ["Kostenlos", "Code in der IDE bearbeiten und per USB bauen beziehungsweise flashen."],
          ["Premium", "Zusaetzlich gefuehrte Lernprojekte, KI-Assistent und Web Push."],
        ] } },
        { heading: "Geplante Angebote", paragraphs: ["Basis Plus, Kampagnen und Hardware-Bundles werden als zeitlich begrenzte oder dauerhafte Entitlements eingefuehrt. Geplant sind zum Beispiel zusaetzliche Background Worker, Dispatcher-Zugriff und hoehere, aber nie unbegrenzte Ausfuehrungsfrequenzen."] },
        { heading: "Die Token unterscheiden", table: { headers: ["Begriff", "Wirkung"], rows: [
          ["ESP32-Recovery-Token", "Ein aktives, provisioniertes Board kann ein Passwort zuruecksetzen."],
          ["Kampagnen-Premium-Token", "Ein einmaliger Gutschein aus Workshop, Partneraktion oder Hardware-Bundle. Er aktiviert ein festgelegtes Premium-Entitlement und wird danach ungueltig."],
        ] } },
        { heading: "Paywall in Lernprojekten", paragraphs: ["Ein Lernprojekt kann bis zu einem Schritt offen sein, der zum Beispiel Dispatcher oder Background Worker braucht. Dort erklaert GerNetiX, welche Faehigkeit fehlt und welches Angebot sie freischaltet. Die Sperre wird auch serverseitig geprueft."] },
      ],
      relatedTopics: ["account-types", "registration-login-recovery", "webshop-activation-codes", "ai-premium", "event-worker-rules", "event-dispatcher"],
    },
    "webshop-activation-codes": {
      title: "Webshop, E-Mail und Aktivierungscodes",
      summary: "Der Webshop verkauft Produkte. GerNetiX verwaltet die technische Nutzung. Aktivierungscodes verbinden beides bewusst.",
      access: "public",
      sections: [
        { heading: "Warum getrennt?", paragraphs: ["Der GerNetiX-Webshop und dein GerNetiX-Account sind fachlich getrennt. Im Webshop kaufst du Hardware, Bundles, Software-Lizenzen oder Abos. In GerNetiX nutzt du Projekte, Geraete, Lizenzen und Entitlements.", "Ein Kauf erzeugt nicht automatisch ein GerNetiX-Konto und verknuepft die Shop-E-Mail nicht automatisch mit deinem GerNetiX-Account. Das schuetzt deine Zahlungs-, Rechnungs- und Versanddaten vor unnoetiger Vermischung mit der technischen Plattform."] },
        { heading: "Wofuer braucht der Webshop eine E-Mail?", list: ["Bestellbestaetigung und Rechnung senden.", "Versandstatus und Rueckfragen zur Lieferung klaeren.", "Support, Reklamation oder Gewaehrleistung einer Bestellung zuordnen.", "Aktivierungscode oder Bestellreferenz zusenden, wenn ein Produkt ein Nutzungsrecht enthaelt."] },
        { heading: "Was ist ein Aktivierungscode?", paragraphs: ["Ein Aktivierungscode ist die Bruecke zwischen Kauf und GerNetiX-Account. Du kaufst zum Beispiel Premium jaehrlich, eine Home-Server-Lizenz oder ein Hardware-Bundle im Webshop. Danach loest du den Code in GerNetiX ein und ordnest das Nutzungsrecht bewusst deinem Account zu."] },
        { heading: "Typischer Ablauf", list: ["Du kaufst im Webshop und gibst dort eine E-Mail fuer Bestellung, Rechnung und Kontakt an.", "Der Webshop sendet dir Rechnung, Bestellreferenz und gegebenenfalls einen Aktivierungscode.", "Du meldest dich in GerNetiX mit deinem Passkey an oder legst ein Konto an.", "Du gibst den Aktivierungscode in GerNetiX ein.", "GerNetiX prueft den Code und aktiviert das passende Entitlement fuer deinen Account."] },
        { heading: "Beispiele", table: { headers: ["Angebot", "Webshop", "GerNetiX"], rows: [
          ["Hardware ohne Lizenz", "E-Mail fuer Rechnung, Versand und Support.", "Kein Konto noetig, solange keine technische Aktivierung gebraucht wird."],
          ["Hardware-Bundle mit Lizenz", "E-Mail und Bestellreferenz; Code per E-Mail oder im Paket.", "Code aktiviert das enthaltene Nutzungsrecht."],
          ["GerNetiX Home Server Software-Lizenz", "Verkauft das Nutzungsrecht.", "Account aktiviert und verwaltet die Home-Server-Lizenz."],
          ["Premium jaehrlich inkl. Home Server", "Kann als Abo oder Code verkauft werden.", "Aktivierungscode schaltet Premium und Home-Server-Nutzung frei."],
        ] } },
        { heading: "Wichtig", paragraphs: ["Die Webshop-E-Mail ist keine Passwort-Anmeldung fuer GerNetiX. GerNetiX bleibt passkey- und accountbasiert. Der Aktivierungscode ist die ausdrueckliche Entscheidung, einen Kauf mit einem GerNetiX-Account zu verbinden."] },
      ],
      relatedTopics: ["entitlements-and-tokens", "account-types", "plan-comparison", "ai-premium"],
    },
    "ai-premium": {
      title: "KI-Unterstuetzung und Premium",
      summary: "Die KI-Chats sind derzeit ein Bestandteil des Premium-Abos.",
      sections: [
        { heading: "Warum ist die KI kostenpflichtig?", paragraphs: ["GerNetiX nutzt fuer einzelne KI-Aufgaben externe KI-Anbieter. Dadurch entstehen je nach Anfrage laufende Kosten. Damit diese Kosten planbar bleiben und der Dienst nicht missbraucht wird, sind die KI-Chats aktuell nur mit Premium verfuegbar."] },
        { heading: "Unser Ausblick", paragraphs: ["Wir pruefen fortlaufend kostenguenstigere und lokale Loesungen. Unser Ziel ist, moeglichst viele KI-Funktionen spaeter auch Nutzerinnen und Nutzern mit kostenlosem Abo anbieten zu koennen."] },
      ],
    },
    "hardware-landscape": {
      title: "Hardware-Landkarte: vom Akku bis Edge AI",
      summary: "Hardware ist keine Rangliste. Die Aufgabe entscheidet, ob ein kleiner Mikrocontroller, ein ESP32, Embedded Linux oder GPU-Edge-Computing sinnvoll ist.",
      access: "public",
      hardwareLandscape: true,
      sections: [
        { heading: "Eine Rechenlandschaft statt einer Leistungspyramide", paragraphs: ["Ein Mikrocontroller führt ein einzelnes Programm direkt auf der Hardware aus. Er startet schnell, braucht wenig Energie und ist ideal für eine konkrete Aufgabe. Ein Embedded-Linux-System kann dagegen Prozesse, Netzwerkdienste und Dateien verwalten – dafür braucht es mehr Energie, Pflege und eine saubere Abschaltstrategie."], hardwareVisual: true },
        { heading: "Die fünf Systemebenen", table: { headers: ["Systemebene", "Typische Beispiele", "Wofür sie passt"], rows: [["Einfache I/O-Steuerung", "Mikrocontroller mit wenigen Ein- und Ausgängen", "Ein Sensor, Taster, LED oder Relais mit geringem Energiebedarf und einer klaren Aufgabe."], ["Vernetztes Embedded-System", "ESP32-C3, ESP32-S3, ESP32-C6, vernetzter STM32", "Direkter Hardwarezugriff, Sensoren und Aktoren, lokale Bedienung sowie Funk oder Netzwerk."], ["Embedded Linux", "Raspberry Pi Zero 2 W, Compute Module, Industrie-SBC", "Gateway, Kamera, lokale Dienste, Datenpuffer oder umfangreichere Bedienoberflächen."], ["Industriesystem", "Industrie-Mikrocontroller, SPS, Industrie-PC", "Robuste Echtzeitsteuerung, Feldschnittstellen, lange Produktzyklen und definierte Betriebsanforderungen."], ["Edge-KI-System", "NVIDIA Jetson, Industrie-PC mit GPU, KI-fähiger SBC", "Bildverarbeitung und KI-Inferenz nahe an Kamera oder Maschine; kein Ersatz für Echtzeit-I/O."]] } },
        { heading: "Erst die Aufgabe, dann die Systemebene", table: { headers: ["Wenn dein Projekt …", "meist passende Ebene", "Beispiel"], rows: [["lange mit Akku läuft und nur wenige Ein- und Ausgänge bedient", "Einfache I/O-Steuerung", "Temperatur-Node, Taster, LED, Relais"], ["nah an Pins und Sensoren bleibt und Daten oder Bedienung bereitstellt", "Vernetztes Embedded-System", "GerNetiX-Device, Bewässerung, kleines Touch-UI"], ["lokal mehrere Dienste, eine Kamera oder ein Gateway braucht", "Embedded Linux", "Haus-Gateway, Datenablage, Kamera-Bridge"], ["eine Maschine mit definierten Echtzeit- und Lebenszyklusvorgaben steuert", "Industriesystem", "Feldbus-Knoten, Serienprodukt"], ["Kamera- oder KI-Modelle ohne Cloud-Latenz auswertet", "Edge-KI-System", "Qualitätsprüfung, Objekterkennung"]] } },
        { heading: "Begriffe richtig einordnen", paragraphs: ["Einen Raspberry Pi Nano gibt es nicht als gängige Produktlinie. Für die kleine Mikrocontroller-Ebene passt der Raspberry Pi Pico; der Raspberry Pi Zero 2 W gehört wegen Linux bereits zur nächsten Ebene.", "STM32- und aktuelle Renesas-Familien sind typische Wege in professionelle und industrielle Produkte. Die Renesas-H8-Familie ist vor allem in bestehenden Anlagen anzutreffen; für ein neues Design wird normalerweise eine aktuelle, aktiv gepflegte Familie gewählt."] },
        { heading: "Was GerNetiX heute nutzt", paragraphs: ["GerNetiX konzentriert Basissoftware und geführte Inbetriebnahme auf kompatible ESP32-Boards. Sie sind die praktische Mitte: genug Rechenleistung und Konnektivität für vernetzte Geräte, aber weiterhin nah genug an Sensoren, Aktoren und energieeffizientem Betrieb.", "Ein gutes System verteilt Aufgaben: Der Mikrocontroller liest und schaltet zuverlässig. Ein Linux-Gateway bündelt Geräte, Bedienung und lokale Dienste. Eine GPU kommt nur dazu, wenn Bild- oder KI-Rechenlast sie rechtfertigt. Cloud-Dienste bleiben optional für Fernzugriff und Auswertung."] },
      ],
      relatedTopics: ["processor-overview", "supported-devices"],
    },
    "server-systems": {
      title: "Moderne Systemlandschaften verstehen",
      summary: "Ein Embedded-Gerät, ein lokaler Server, globale Dienste und eine iPhone-App sind mögliche Bausteine – keine Pflichtkette. Die Aufgabe bestimmt, was wirklich gebraucht wird.",
      access: "public",
      sections: [
        { heading: "Vom IoT-Device-Bus zur App", paragraphs: ["Die Grafik zeigt drei Hauptbereiche. IoT-Geräte arbeiten an der realen Umgebung. Server verbinden, speichern oder verarbeiten Daten. Apps machen Funktionen für Menschen bedienbar. Die Server- und App-Varianten werden hier bewusst einzeln erklärt."], systemLandscape: true, table: { headers: ["Baustein aus der Übersicht", "Aufgabe", "Wann er sinnvoll ist"], rows: [
          ["IoT-Geräte", "Embedded-Systeme lesen Sensoren, steuern Aktoren und reagieren direkt vor Ort.", "Wenn kurze Reaktionszeit, geringer Energiebedarf oder Betrieb ohne Internet wichtig sind – zum Beispiel ESP32-Sensor, Türkontakt oder Bewässerungssteuerung."],
          ["Server: Lokal", "Ein lokaler Server oder Gateway bündelt Geräte im Haus, Betrieb oder Fahrzeug; er kann Daten puffern und Regeln ausführen.", "Wenn Geräte bei Internet-Ausfall zusammenarbeiten sollen, Daten vor Ort bleiben oder verschiedene Funknetze verbunden werden."],
          ["Server: Internet/VPS", "Ein Internet-Server oder VPS stellt APIs, Konten, Synchronisation und zentrale Dienste bereit.", "Wenn Fernzugriff, gemeinsame Nutzung, zentrale Backups oder mehrere Standorte erforderlich sind."],
          ["Server: Cloud", "Cloud-Dienste liefern nach Bedarf verwalteten Speicher, Datenbanken, Auswertung oder skalierbare Verarbeitung.", "Wenn Last stark schwankt, weltweite Reichweite gebraucht wird oder verwaltete Dienste Betriebsaufwand sparen."],
          ["Apps: Mobil", "Mobile Apps auf iPhone, iPad oder Android zeigen Werte, senden Bedienbefehle und empfangen Benachrichtigungen.", "Wenn Menschen unterwegs informiert werden oder Funktionen mobil bedienen sollen."],
          ["Apps: PC/Mac und Web", "Desktop- und Web-Apps bieten größere Übersichten, Konfiguration und Analyse im Browser oder auf dem Rechner.", "Wenn längere Bedienabläufe, Planung, Auswertung oder Administration im Vordergrund stehen."]
        ] } },
        { heading: "Nicht jedes Projekt braucht alles", table: { headers: ["Beispiel", "Sinnvolle Bausteine", "Warum"], rows: [
          ["Batteriebetriebener Temperatursensor", "IoT-Gerät", "Er misst und sendet in Intervallen. Ein Server oder eine App ist erst nötig, wenn Werte dauerhaft gesammelt oder aus der Ferne gesehen werden sollen."],
          ["Bewässerung im Gewächshaus", "IoT-Geräte, optional Server: lokal", "Die Steuerung muss auch ohne Internet funktionieren. Ein lokales Gateway kann mehrere Sensoren und Zeitpläne koordinieren."],
          ["Hausautomation mit Fernzugriff", "IoT-Geräte, Server: lokal und Internet/VPS, Apps: mobil oder Web", "Lokal bleiben Automationen reaktionsfähig; über Internet-Server und Apps kommen Fernzugriff und sichere Benachrichtigungen dazu."],
          ["Produkt mit Kunden-App", "IoT-Gerät, Server: Internet/VPS oder Cloud, Apps: mobil", "Das Gerät arbeitet vor Ort; Server verwalten Konten und Synchronisation; die mobile App ist die persönliche Bedienung."],
          ["Maschinenüberwachung an mehreren Standorten", "IoT-Geräte, Server: lokal und Cloud/VPS, Apps: PC/Mac oder Web", "Der lokale Server puffert und filtert Daten vor Ort, während zentrale Server Standorte vergleichen und Alarme verteilen."]
        ] } },
        { heading: "GerNetiX einordnen", paragraphs: ["GerNetiX nutzt für seine Plattform einen VPS als gemeinsame Deployment-Umgebung für getrennte Dienste. Das ist kein Cloud-Autopilot: Zugänge, Updates, Container-Netzwerk, Backups und Monitoring bleiben bewusst kontrollierte Betriebsaufgaben. Hardware-nahe Funktionen wie USB-Provisionierung bleiben lokal beim Gerät und werden nicht auf den VPS verlagert.", "Ein GerNetiX-Projekt kann deshalb klein beginnen: ESP32 plus lokale Bedienung. Erst wenn es einen fachlichen Nutzen gibt, kommen ein lokales Gateway, der VPS für Fernzugriff oder eine iPhone-App dazu. Die verlässliche Reaktion auf Sensoren und Aktoren bleibt dabei am Embedded-System oder lokalen Gateway."] },
      ],
      relatedTopics: ["hardware-landscape", "processor-overview", "glossary-basics"],
    },
    "local-servers": {
      title: "Lokale Server und Gateways",
      summary: "Ein lokaler Server läuft im Haus, Büro oder Werk und verbindet Geräte nahe an ihrem Einsatzort.",
      access: "public",
      sections: [
        { heading: "Wofür ein lokaler Server da ist", paragraphs: ["Ein lokaler Server oder Gateway sammelt Daten von IoT-Geräten, führt Regeln aus, puffert Informationen und stellt bei Bedarf eine lokale Bedienoberfläche bereit. Weil er nah bei den Geräten ist, kann die Kernfunktion auch ohne Internet weiterlaufen."] },
        { heading: "Typische Anwendungen", list: ["Hausautomation mit lokalen Regeln und Funk-Bridges.", "Maschinen- oder Kameradaten, die das Gebäude nicht verlassen sollen.", "Lokale Datenpufferung bei unzuverlässigem Internet.", "Protokollübersetzung zwischen IoT-Geräten und weiteren Systemen."] },
        { heading: "Verantwortung", paragraphs: ["Lokale Kontrolle bedeutet auch lokaler Betrieb: Stromausfall, Netzwerk, Updates, Backups und Fernwartung müssen geplant werden. Ein lokaler Server ersetzt kein Sicherheitskonzept, kann aber Latenz, Datenschutz und Ausfallsicherheit verbessern."] },
      ],
      relatedTopics: ["server-systems", "internet-vps", "cloud-services"],
    },
    "internet-vps": {
      title: "Internet-Server und VPS",
      summary: "Ein Internet-Server macht Dienste von außen erreichbar. Ein VPS ist dafür oft ein ausgewogener Startpunkt.",
      access: "public",
      sections: [
        { heading: "Internet-Server", paragraphs: ["Ein öffentlich erreichbarer Server stellt beispielsweise APIs, Konten, Synchronisation oder eine Web-Anwendung bereit. Er verbindet Nutzer, Apps und Standorte über das Internet, muss aber besonders sorgfältig gegen unbefugte Zugriffe geschützt werden."] },
        { heading: "VPS: Virtual Private Server", paragraphs: ["Ein VPS ist eine logisch getrennte virtuelle Serverinstanz im Rechenzentrum. Er fühlt sich wie ein eigener Linux-Server an, ohne dass du die physische Hardware betreiben musst. Web-App, API, kleine bis mittlere Datenbanken, VPN, Staging und getrennte Container sind typische Anwendungen."] },
        { heading: "Die vier verbreiteten Betriebsmodelle", table: { headers: ["Modell", "Was es ist", "Typische Anwendungen"], rows: [
          ["Lokaler Server", "Ein Rechner im eigenen Haus, Büro oder Werk; er läuft im lokalen Netzwerk oder hinter einem eigenen Internetanschluss.", "Home Assistant, lokale Datenablage, Maschinen-Gateway, Kameraaufzeichnung, Entwicklung und Offline-Betrieb."],
          ["Klassischer dedizierter Server", "Ein vollständig gemieteter physischer Server im Rechenzentrum. Die Hardware gehört nur einem Kunden.", "Dauerlast mit festen Anforderungen, große Datenbanken, spezielle Hardware, Anwendungen mit planbarer Auslastung."],
          ["VPS (Virtual Private Server)", "Eine virtuelle, logisch getrennte Serverinstanz auf einem gemeinsamen physischen Host im Rechenzentrum.", "Web-App, API, kleine bis mittlere Datenbanken, VPN, Staging und mehrere Container-Dienste wie bei GerNetiX."],
          ["Cloud-Dienste", "Bedarfsgerecht bereitgestellte Rechen-, Speicher- oder Plattformdienste; oft als verwaltete Bausteine statt eigener Server.", "Weltweit erreichbare Anwendungen, verwaltete Datenbanken, Objektspeicher, Lastspitzen, Analyse und Event-Verarbeitung."]
        ] } },
        { heading: "Auswirkungen im Alltag", table: { headers: ["Kriterium", "Lokal", "Dediziert", "VPS", "Cloud"], rows: [
          ["Performance", "Sehr kurze Wege zu lokalen Geräten; Internetzugriff hängt am eigenen Anschluss.", "Konstant und gut planbar, da keine Hardware geteilt wird.", "Für viele Anwendungen stark genug; Leistung ist zugesichert, der physische Host wird jedoch geteilt.", "Ressourcen können sehr groß werden; Netzlatenz und Dienstwahl beeinflussen das Ergebnis."],
          ["Sicherheit", "Volle Kontrolle, aber Updates, Backups, Stromausfall und Netzabsicherung liegen bei dir.", "Klare Hardware-Trennung; Betriebssystem, Firewall, Patches und Backups bleiben deine Aufgabe.", "Provider schützt Rechenzentrum und Virtualisierung; du verantwortest Betriebssystem, Zugänge, Updates und Daten.", "Provider übernimmt Teile der Plattform-Sicherheit; Identitäten, Rechte, Konfiguration, Daten und Kostenlimits bleiben deine Verantwortung."],
          ["Skalierbarkeit", "Begrenzt durch die vorhandene Hardware; Aufrüstung oder zweiter Server sind Handarbeit.", "Vertikal durch stärkere Hardware, horizontal mit mehreren Servern – meist mit Planung und Vertrag.", "Meist schnell auf einen größeren Tarif wechselbar; für hohe Last sind mehrere Instanzen nötig.", "Am flexibelsten: Instanzen, Speicher und verwaltete Dienste können je nach Angebot automatisch oder kurzfristig wachsen."],
          ["Betriebsaufwand", "Hoch: Hardware, Netzwerk, USV, Monitoring und Fernzugriff selbst organisieren.", "Mittel bis hoch: Hardware ist gemietet, Softwarebetrieb bleibt selbst verwaltet.", "Mittel: kein Hardwarebetrieb, aber Linux, Container, Updates, Monitoring und Backups bleiben wichtig.", "Niedrig bis mittel bei verwalteten Diensten; Architektur, Rechte und Kostenkontrolle benötigen weiterhin Fachwissen."]
        ] } },
        { heading: "Betrieb und Sicherheit", list: ["Zugänge mit Schlüsseln und starken Identitäten schützen; unnötige Dienste und offene Ports vermeiden.", "Betriebssystem und Anwendungen zeitnah aktualisieren sowie Backups und Wiederherstellung testen.", "Logs, Erreichbarkeit, Speicher und Ressourcen überwachen.", "Verlässliche Echtzeit- oder Schutzfunktionen nicht vom Internet abhängig machen."] },
      ],
      relatedTopics: ["local-servers", "cloud-services", "server-systems"],
    },
    "cloud-services": {
      title: "Cloud-Dienste",
      summary: "Cloud-Dienste liefern Rechenleistung, Speicher und verwaltete Plattformbausteine nach Bedarf – mit hoher Flexibilität und eigener Kostenverantwortung.",
      access: "public",
      sections: [
        { heading: "Wann Cloud sinnvoll ist", paragraphs: ["Cloud-Dienste passen zu stark schwankender Last, globaler Reichweite oder verwalteten Datenbanken und Speichern. Sie können Infrastrukturarbeit reduzieren, ersetzen aber keine gute Architektur und keine Verantwortung für Daten, Rechte und Ausgaben."] },
        { heading: "Die Kostenfalle Cloud-Computing", paragraphs: ["Cloud-Plattformen wie AWS können bei steigender Last automatisch zusätzliche Ressourcen bereitstellen. Das ist ein großer Vorteil: Anwendungen wachsen, ohne dass jemand Server manuell nachbestellen muss. Genau dieselbe Automatik kann aber einen Fehler sehr schnell und teuer verstärken.", "Läuft eine Funktion, ein Worker oder Hintergrundprozess unbegrenzt, startet sich ständig neu oder erzeugt ohne Grenze neue Aufgaben, kann die Cloud dieses Verhalten mit immer weiteren Ausführungen beantworten. Ein kleiner Fehler im Code kann so in kurzer Zeit hohe Kosten verursachen.", "Automatische Skalierung verstärkt nicht nur erfolgreiche Anwendungen, sondern auch Fehler. Wer Cloud-Systeme entwickelt, muss deshalb neben der technischen Funktion auch die wirtschaftliche Wirkung jeder einzelnen Ausführung verstehen."] },
        { heading: "Typische Ursachen", list: ["Endlosschleifen oder fehlende Abbruchbedingungen.", "Unbegrenzte Wiederholungsversuche und fehlende Timeouts bei externen Aufrufen.", "Rekursiv erzeugte Events oder Cloud-Funktionen, die sich gegenseitig erneut auslösen.", "Unkontrolliert skalierende Queue-Consumer und zu große Batch-Mengen.", "Dauerhaft laufende, blockierende oder nach Fehlern sofort neu gestartete Prozesse."] },
        { heading: "Jede Ausführung muss begrenzt sein", list: ["Im Code: maximale Laufzeit, klare Abbruchbedingungen, begrenzte Wiederholungsversuche und kontrollierte Batch- oder Mengenlimits festlegen.", "Bei externen Diensten: verbindliche Timeouts setzen und Fehler nicht ohne Pause sofort erneut ausführen.", "In der Cloud-Infrastruktur: Parallelität, Queue-Größen, Skalierungsgrenzen und Ausgaben begrenzen; Budgets und Warnmeldungen aktivieren.", "Der Dienst soll sich selbst kontrolliert beenden oder in einen sicheren Fehlerzustand wechseln. Infrastruktur-Limits sind das letzte Sicherheitsnetz, nicht die einzige Schutzmaßnahme."] },
      ],
      relatedTopics: ["local-servers", "internet-vps", "workers-and-queues"],
    },
    "choosing-servers": {
      title: "Server passend auswählen",
      summary: "Die passende Serverart folgt aus Aufgabe, Reichweite, Reaktionszeit, Datenschutz und dem Aufwand, den du dauerhaft übernehmen kannst.",
      access: "public",
      sections: [
        { heading: "Wie du auswählst", list: [
          "Wähle lokal, wenn Geräte auch ohne Internet zuverlässig funktionieren müssen oder Daten das Gebäude nicht verlassen sollen. Plane Stromausfall, Fernwartung und externe Backups mit ein.",
          "Wähle einen dedizierten Server bei dauerhaft hoher, gut planbarer Last oder wenn spezielle Hardware und maximale Kontrolle nötig sind.",
          "Wähle einen VPS als ausgewogenen Start für öffentlich erreichbare Web-Anwendungen und klar abgegrenzte Dienste. Sichere ihn wie einen eigenen Server ab: Schlüssel statt Passwörter, Updates, Firewall, Backups und Monitoring.",
          "Wähle Cloud-Dienste bei stark schwankender Last, globaler Reichweite oder wenn verwaltete Datenbanken und Speicher den Betriebsaufwand senken sollen. Prüfe vorher Datenschutz, Region, Anbieterbindung und laufende Kosten.",
          "Viele Systeme kombinieren beides: Ein ESP32 oder lokales Gateway reagiert schnell vor Ort; VPS oder Cloud liefern Fernzugriff, Benachrichtigungen, Auswertung und zentrale Datensicherung."
        ] },
        { heading: "Mit kleinster sinnvoller Architektur beginnen", paragraphs: ["Baue keine globale Plattform, wenn ein Gerät mit lokaler Regelung die Aufgabe vollständig löst. Ergänze erst dann Gateway, VPS, Cloud oder App, wenn ein konkreter Nutzen entsteht: mehrere Geräte koordinieren, Fernzugriff anbieten, Daten langfristig auswerten oder Menschen informieren. Jede zusätzliche Komponente schafft auch zusätzlichen Betriebs-, Sicherheits- und Datenschutzaufwand."] },
      ],
      relatedTopics: ["local-servers", "internet-vps", "cloud-services", "server-systems"],
    },
    "software-basics": {
      title: "Software in verteilten Systemen",
      summary: "Ein modernes Produkt besteht oft aus mehreren Softwareteilen: Firmware im Gerät, Diensten auf Servern und Apps für Menschen. Zusammen müssen sie klar zusammenspielen.",
      access: "public",
      sections: [
        { heading: "Software auf jeder Ebene", table: { headers: ["Ebene", "Typische Software", "Aufgabe"], rows: [
          ["IoT-Gerät", "Firmware", "Liest Sensoren, steuert Aktoren und setzt die Kernfunktion mit begrenzten Ressourcen um."],
          ["Lokaler Server", "Gateway- oder Automatisierungsdienst", "Verbindet Geräte, übersetzt Protokolle, puffert Daten und führt lokale Regeln aus."],
          ["Internet/VPS oder Cloud", "API, Datenbank, Hintergrunddienste", "Verwaltet Konten, Synchronisation, zentrale Daten und Dienste für mehrere Nutzer oder Standorte."],
          ["Apps", "Mobile, Desktop- und Web-Anwendungen", "Machen Funktionen bedienbar, zeigen Informationen und senden bewusst ausgelöste Befehle."]
        ] } },
        { heading: "Schnittstellen statt Vermischung", paragraphs: ["Die Teile sollten über klar definierte Schnittstellen zusammenarbeiten: Datenformate, APIs, Ereignisse und Fehlerfälle werden bewusst beschrieben. Eine App sollte nicht die einzige Stelle sein, an der ein Gerät korrekt funktioniert; eine Internetverbindung sollte keine lokale Schutzfunktion ersetzen.", "Gute Software trennt Verantwortung: Die Firmware reagiert zuverlässig am Gerät, ein Server koordiniert und speichert, Apps stellen Menschen eine verständliche Bedienung bereit. Diese Trennung macht Änderungen, Tests und Fehlersuche beherrschbar."] },
        { heading: "Ein praktischer Ablauf", list: ["Zuerst Kernfunktion und Fehlergrenzen am Gerät oder in der lokalen Logik klären.", "Dann Schnittstellen und Datenflüsse zwischen Geräten, Servern und Apps benennen.", "Zeitaufwändige Arbeit in klar begrenzte Hintergrundaufgaben auslagern.", "Logs, Tests und Messwerte nutzen, um jedes Teil einzeln und im Zusammenspiel zu prüfen."] },
      ],
      relatedTopics: ["workers-and-queues", "server-systems", "hardware-landscape"],
    },
    "workers-and-queues": {
      title: "Worker, Queues und Hintergrundaufgaben",
      summary: "Worker erledigen Aufgaben außerhalb der direkten Benutzeranfrage. Sie entkoppeln Systeme, brauchen aber klare Grenzen für Zeit, Menge und Wiederholungen.",
      access: "public",
      sections: [
        { heading: "Was ein Worker ist", paragraphs: ["Ein Worker ist ein Hintergrundprozess: Er bearbeitet Aufgaben, die nicht sofort in einer Webseite oder App fertig sein müssen. Beispiele sind das Versenden einer Benachrichtigung, das Umwandeln eines Bildes, die Auswertung einer Messreihe oder das Erzeugen eines Berichts.", "Eine Queue ist eine Warteschlange für solche Aufgaben. Die Anwendung legt eine Aufgabe ab; ein oder mehrere Worker holen sie ab und verarbeiten sie. Damit bleibt die direkte Bedienung schnell, auch wenn die Hintergrundarbeit länger dauert."] },
        { heading: "Warum das Konzept wichtig ist", list: ["Entkopplung: Ein Fehler oder eine langsame externe Schnittstelle blockiert nicht automatisch die Benutzeroberfläche.", "Skalierung: Bei mehr Aufgaben können kontrolliert weitere Worker arbeiten.", "Zuverlässigkeit: Aufgaben lassen sich nachvollziehbar speichern, begrenzt wiederholen oder in eine Fehlerwarteschlange verschieben.", "Reihenfolge: Nicht jede Aufgabe darf parallel laufen. Für ein einzelnes Gerät oder Konto kann eine definierte Reihenfolge wichtig sein."] },
        { heading: "Sichere Grenzen für Hintergrundarbeit", list: ["Jede Aufgabe erhält ein Timeout, eine maximale Anzahl von Wiederholungen und eine eindeutige Abbruchbedingung.", "Die Queue und die Anzahl paralleler Worker werden begrenzt. Sonst kann ein Fehler zu einer Kosten- oder Lastspirale werden.", "Fehlgeschlagene Aufgaben werden sichtbar gemacht und untersucht, statt sie unendlich erneut auszuführen.", "Eine Aufgabe muss möglichst idempotent sein: Wird sie nach einem Fehler erneut gestartet, darf sie nicht ungewollt doppelt buchen, schalten oder benachrichtigen."] },
        { heading: "Bezug zu GerNetiX", paragraphs: ["Im Wissensportal bleibt dieses Modell bewusst allgemein. Die Hilfe erklärt anschließend, wie Ereignis-Worker und der Ereignis-Dispatcher innerhalb eines GerNetiX-Projekts eingerichtet und begrenzt werden."] },
      ],
      relatedTopics: ["event-worker-rules", "event-dispatcher", "server-systems"],
    },
    "embedded-measurement-debugging": {
      title: "Embedded-Systeme: Messtechnik und Debugging",
      summary: "Embedded-Entwicklung verbindet Software mit Elektrotechnik. Verständnis für Schaltungen, sorgfältiges Aufbauen und passende Messmittel sind genauso wichtig wie der Programmcode.",
      access: "public",
      sections: [
        { heading: "Embedded heißt: Software trifft Elektronik", paragraphs: ["Ein Embedded-System steuert reale elektrische Signale. Deshalb gehören neben dem Programmieren Grundlagen wie Spannung, Strom, Widerstand, Massebezug, Pegel und sichere Spannungsversorgung dazu. Praktische Fähigkeiten – sauber verdrahten, löten, Datenblätter lesen und Messwerte einordnen – entscheiden oft schneller über Erfolg als noch mehr Code.", "Das ist kein Grund, sich abschrecken zu lassen: Starte mit ungefährlichen Kleinspannungen und einfachen Schaltungen. Baue Schritt für Schritt, ändere immer nur eine Sache und prüfe sie anschließend. Arbeiten an Netzspannung oder leistungsstarken Akkus gehören nur in erfahrene Hände und mit passender Schutztechnik."] },
        { heading: "Messtechnik: erst messen, dann raten", paragraphs: ["Messtechnik macht unsichtbare elektrische Zustände sichtbar. Die Werkzeuge ergänzen sich: Ein Multimeter prüft einzelne Werte, ein Oszilloskop zeigt deren Verlauf über die Zeit und ein Logikanalysator erklärt digitale Kommunikation."], table: { headers: ["Kapitel", "Werkzeug", "Wofür es da ist", "Erste typische Fragen"], rows: [
          ["1. Multimeter", "Multimeter", "Misst Gleichspannung, Strom, Widerstand und oft Durchgang. Es ist das wichtigste erste Messgerät.", "Liegt wirklich 3,3 V oder 5 V an? Ist ein Kabel unterbrochen? Verursacht ein Bauteil einen Kurzschluss?"],
          ["2. Oszilloskop", "Oszilloskop", "Zeigt Spannung als Kurve über die Zeit. Damit werden Impulse, Störungen, Takt und Signalform sichtbar.", "Kommt der PWM-Impuls wirklich an? Bricht die Versorgung beim Schalten ein? Gibt es Störungen auf einem Signal?"],
          ["3. Logikanalysator", "Logikanalysator", "Zeichnet digitale Pegel und Protokolle wie I²C, SPI oder UART auf. Er ist besonders hilfreich bei der Kommunikation zwischen Bauteilen.", "Sendet der Sensor eine Antwort? Stimmen Adresse und Daten? Sind Takt, Datenleitung und Timing plausibel?"]
        ] } },
        { heading: "1. Multimeter", list: [
          "Vor dem Einschalten: Widerstand oder Durchgang prüfen, um vertauschte Verbindungen und mögliche Kurzschlüsse zu finden. Dabei muss die Schaltung spannungsfrei sein.",
          "Nach dem Einschalten: Spannung immer zwischen dem Messpunkt und dem passenden Massebezug (GND) messen. Bei ESP32-Schaltungen sind 3,3 V ein häufiger Referenzwert.",
          "Strom misst man in Reihe zur Last. Das ist ein anderer Anschluss und Messbereich als bei Spannungsmessung – bei Unsicherheit zuerst die Anleitung des Multimeters lesen.",
          "Ein Messwert ist ein Hinweis, keine automatische Diagnose: Vergleiche ihn mit Schaltplan, Datenblatt und erwarteter Versorgung."] },
        { heading: "2. Oszilloskop", list: [
          "Ein Oszilloskop hilft, wenn ein Multimeter zwar einen Mittelwert zeigt, das System aber trotzdem unzuverlässig arbeitet. Kurze Spannungseinbrüche oder Impulse bleiben im Multimeter oft unsichtbar.",
          "Die Masseklemme der Tastspitze verbindet sich elektrisch mit der Masse des Messgeräts. Prüfe deshalb den Massebezug, bevor du sie anschließt; bei netzbetriebenen Geräten gelten zusätzliche Sicherheitsregeln.",
          "Für erste Projekte reichen Fragen wie: Welche Spannung liegt an? Wie lang ist der Impuls? Wiederholt er sich? Bricht die Versorgung beim Schalten ein?"] },
        { heading: "3. Logikanalysator", list: [
          "Ein Logikanalysator liest digitale Zustände als 0 und 1. Er ersetzt kein Oszilloskop für analoge Signalqualität, ist aber oft leichter für Bus-Protokolle auszuwerten.",
          "Verbinde immer auch eine gemeinsame Masse. Prüfe vorab, ob die Eingänge zum Pegel passen – bei ESP32 in der Regel 3,3 V, nicht 5 V.",
          "Mit Protokoll-Decodern werden Folgen aus Bits zu lesbaren I²C-, SPI- oder UART-Nachrichten. Das grenzt Fehler in Verdrahtung, Adresse, Timing oder Firmware schnell ein."] },
        { heading: "Debugwerkzeuge: moderne Hilfe statt unnötiger Hürden", paragraphs: ["Debugging ist die systematische Suche nach der Ursache eines Fehlers. Früher bedeutete das oft teure Zusatzhardware und schwer zugängliche Debug-Schnittstellen. Bei vielen heutigen Entwicklungsboards sind USB-Serielle Ausgabe, Bootloader und Debug-Schnittstellen wie JTAG bereits auf dem Board integriert oder einfach erreichbar.", "JTAG ist eine standardisierte Schnittstelle, mit der ein Debugger den Prozessor anhalten, Variablen ansehen und Schritt für Schritt durch Code gehen kann. Nicht jedes Projekt braucht das sofort: Serielle Logs, klare Fehlermeldungen, Messgeräte und kleine reproduzierbare Tests lösen viele Probleme schneller.", "Auch KI kann heute Logausgaben, Compilerfehler, Protokollmitschnitte und einfache Schaltbilder gut strukturieren und mögliche Ursachen priorisieren. Sie ersetzt aber keine Messung: Prüfe Vorschläge immer gegen Datenblatt, Sicherheitsregeln und reale Messwerte. So nimmt KI Komplexität heraus, ohne Verantwortung vorzutäuschen."] },
        { heading: "Ein ruhiger Debug-Ablauf", list: [
          "Problem klein machen: Eine LED, ein Sensor oder eine Verbindung isoliert testen.",
          "Versorgung und Masse zuerst mit dem Multimeter prüfen.",
          "Serielle Logs und eindeutige Fehlermeldungen erfassen.",
          "Bei digitalen Schnittstellen einen Logikanalysator, bei Signalform oder Einbrüchen ein Oszilloskop einsetzen.",
          "Ergebnisse mit Datenblatt und Schaltplan vergleichen; erst danach Firmware oder Verdrahtung gezielt ändern.",
          "KI für die Einordnung nutzen: Messwerte, Logs und Fragestellung gemeinsam beschreiben – aber Änderungen bewusst und einzeln übernehmen."] },
      ],
      relatedTopics: ["hardware-landscape", "processor-overview", "server-systems", "supported-devices"],
    },
    "embedded-safety": {
      title: "Elektrische und funktionale Sicherheit",
      summary: "Sicherheit beginnt bei der Elektronik und endet nicht beim Code. Elektrische Gefährdungen und Fehlfunktionen können Menschen gefährden – beides braucht klare Grenzen und fachgerechte Lösungen.",
      access: "public",
      sections: [
        { heading: "Elektrische Sicherheit: Strom durch den Körper ist entscheidend", paragraphs: ["Eine elektrische Verletzung hängt vor allem davon ab, welcher Strom wie lange und auf welchem Weg durch den Körper fließt. Wechselstrom und Gleichstrom wirken unterschiedlich; auch Frequenz, Feuchtigkeit, Kontaktfläche und der Weg durch den Körper beeinflussen das Risiko. Spannung ist trotzdem entscheidend, weil sie den Strom durch den Körperwiderstand antreibt: Vereinfacht gilt Strom = Spannung geteilt durch Widerstand.", "Der Körperwiderstand ist nicht verlässlich: Trockene Haut kann stark isolieren, feuchte oder verletzte Haut deutlich weniger. Deshalb wird Sicherheit nicht dadurch hergestellt, dass man auf einen hohen Körperwiderstand hofft. Stattdessen begrenzen Schutzkonzepte die berührbare Spannung, die verfügbare Energie und den möglichen Fehlerstrom.", "Als grobe Einordnung werden in Normen für gewöhnliche, trockene Bedingungen oft Schutzkleinspannungen bis 50 V Wechselspannung und 120 V Gleichspannung genannt. Bei Feuchtigkeit, leitfähiger Umgebung oder besonderen Bedingungen gelten niedrigere Grenzen, häufig 25 V AC oder 60 V DC. Diese Werte sind keine persönliche Sicherheitsfreigabe und ersetzen weder eine Gefährdungsbeurteilung noch die jeweils geltenden Normen."] },
        { heading: "Praktische Regeln für Embedded-Projekte", list: [
          "Zum Lernen bei sicherer Kleinspannung bleiben, zum Beispiel USB-versorgte 3,3-V- oder 5-V-Schaltungen. Netzspannung, Schaltnetzteile, große Akkupacks und leistungsstarke Motoren nur mit passender Fachkenntnis, Schutzaufbau und Aufsicht bearbeiten.",
          "Nie unter Spannung umverdrahten oder löten. Vor Änderungen Energiequellen trennen und gespeicherte Energie in Kondensatoren beachten.",
          "Sicherungen, Strombegrenzung, passende Leitungsquerschnitte, Zugentlastung, isolierte Gehäuse und sichere Steckverbinder sind Teil der Funktion – keine optionalen Extras.",
          "Messgeräte und Tastköpfe nur innerhalb ihrer Kategorie, ihres Messbereichs und gemäß Anleitung einsetzen. Ein falscher Masseanschluss oder Messbereich kann selbst einen Fehler erzeugen."] },
        { heading: "Funktionale Sicherheit: Wenn korrektes Funktionieren Leben schützt", paragraphs: ["Funktionale Sicherheit verbindet die Wörter bewusst: Sie betrifft Systeme, bei denen eine Fehlfunktion unter bestimmten Randbedingungen zu einer Gefahr für Leib und Leben führen kann. Es reicht nicht, dass ein System meistens funktioniert. Es muss nachweisbar mit Fehlern umgehen und in einen sicheren Zustand gelangen oder dort bleiben.", "Eine Lenkung, die auf der Autobahn ohne Eingriffsmöglichkeit stark einschlägt, kann katastrophale Folgen haben. Dreht sich dieselbe Lenkung im stehenden Fahrzeug in einer abgesicherten Werkstatt, ist die Fehlfunktion weiterhin relevant, aber die Randbedingung und damit die mögliche Folge ist eine andere. Für die Sicherheitsbetrachtung wird nicht der günstige Alltag angenommen, sondern die ungünstigste vorhersehbare Situation.", "Dasselbe gilt für Bremsen, Schutzabschaltungen oder Antriebe. Man betrachtet Fehler, Fehlbedienung, Ausfall von Sensoren, Kabelbruch, Spannungsabfall, Softwarefehler und Diagnoseversagen – und legt fest, wie das System eine gefährliche Wirkung verhindert oder begrenzt."] },
        { heading: "Keine Basteländerungen an sicherheitskritischen Fahrzeugfunktionen", paragraphs: ["Fahrzeuge enthalten mehrere Bussysteme und Steuergeräte. Auch Daten, die harmlos wirken – etwa eine Lichtinformation – können in Netzen liegen, über die weitere sicherheitsrelevante Zustände, Diagnose oder Abschaltbedingungen ausgetauscht werden. Ohne vollständige Fahrzeugarchitektur lässt sich nicht zuverlässig erkennen, welche Wechselwirkung eine Änderung hat.", "Jede zusätzliche Klemme, Lötstelle, Stromabnahme, Leitung oder Verbindung kann Kontaktprobleme, Unterbrechungen, Störungen oder unerwartete Lasten verursachen. Im ungünstigsten Fall wird ein Signalweg unterbrochen, ein Steuergerät meldet einen Fehler oder das Fahrzeug geht in einen Notlauf. Deshalb keine Änderungen an Fahrzeugbussen, Lenkung, Bremse, Airbag-, Rückhalte- oder Antriebssystemen vornehmen. Solche Arbeiten gehören in freigegebene Entwicklungs- und Prüfprozesse mit Systemwissen, Risikoanalyse, validierter Hardware und rechtlicher Zulassung."] },
        { heading: "Sicher entwickeln heißt Grenzen kennen", paragraphs: ["Für Lern- und Prototyping-Projekte bedeutet das: Die Funktion klar begrenzen, Energie klein halten, Fehler erwarten und sicher testen. Wenn ein Projekt Menschen, Straßenverkehr, Maschinen oder hohe Energien beeinflussen könnte, ist der nächste Schritt nicht ein schneller Code-Patch, sondern eine fachliche Sicherheitsbewertung."] },
      ],
      relatedTopics: ["embedded-measurement-debugging", "hardware-landscape", "server-systems"],
    },
    "privacy-basics": {
      title: "Datenschutz in vernetzten Projekten",
      summary: "Vernetzte Geräte können schnell personenbezogene Daten erzeugen. Gute Projekte erfassen nur, was sie wirklich brauchen, erklären den Zweck und schützen Daten über ihren gesamten Lebenszyklus.",
      access: "public",
      sections: [
        { heading: "Was personenbezogene Daten sein können", paragraphs: ["Personenbezogene Daten sind Informationen, die eine Person direkt oder indirekt erkennbar machen können. Dazu gehören nicht nur Name und E-Mail-Adresse, sondern je nach Zusammenhang auch Standort, Gerätekennung, Sprachaufnahme, Kamerabild, Bewegungsprofil, Zeitstempel oder Nutzungsverhalten.", "Ein einzelner Temperaturwert ist meist unkritisch. Wird er aber einer Wohnung, einem Konto und festen Zeitpunkten zugeordnet, kann er Rückschlüsse auf Anwesenheit oder Gewohnheiten erlauben. Der Kontext entscheidet."] },
        { heading: "Datenschutz durch Gestaltung", list: [
          "Zweck festlegen: Vor dem Erfassen klar benennen, wofür ein Datum gebraucht wird. Ohne Zweck keine Sammlung.",
          "Daten minimieren: Nur die benötigten Werte, Genauigkeiten und Zeiträume erfassen. Ein Ereignis kann oft besser sein als ein dauerhafter Rohdatenstrom.",
          "Lokal verarbeiten, wenn möglich: Edge Computing kann vermeiden, dass Rohbilder, Audiodaten oder detaillierte Sensordaten den Ort verlassen.",
          "Transparenz schaffen: Nutzerinnen und Nutzer verständlich informieren, welche Daten wohin fließen, wie lange sie gespeichert bleiben und wer Zugriff hat.",
          "Schützen und löschen: Zugriffe begrenzen, Übertragung absichern, Daten getrennt speichern und Lösch- beziehungsweise Aufbewahrungsregeln umsetzen."] },
        { heading: "Beispiele", table: { headers: ["Projekt", "Datensparsame Lösung", "Warum"], rows: [
          ["Bewegungsmelder für Licht", "Nur Bewegung erkannt / nicht erkannt lokal verarbeiten; keine dauerhafte Personenhistorie speichern.", "Die Lichtfunktion benötigt keine Identität und kein Bewegungsprofil."],
          ["Kamera zur Qualitätsprüfung", "Bild direkt am Edge-Gerät auswerten; nur Qualitätskennzahl oder Fehlerbild bei Bedarf übertragen.", "Rohbilder können Personen oder Betriebsgeheimnisse enthalten."],
          ["Smartes Raumklima", "Messwerte pro Raum mit begrenzter Aufbewahrung; Kontodaten und Telemetrie getrennt behandeln.", "Lange Zeitreihen können Rückschlüsse auf Anwesenheit ermöglichen."],
          ["iPhone-App", "Nur notwendige Berechtigungen anfragen und klar erklären; Standort, Kamera oder Kontakte nicht vorsorglich sammeln.", "Mobile Berechtigungen geben tiefen Zugriff auf persönliche Informationen."]
        ] } },
        { heading: "Datenschutz und Sicherheit gehören zusammen", paragraphs: ["Datenschutz beantwortet zuerst: Dürfen und müssen wir diese Daten verarbeiten? Sicherheit beantwortet: Wie verhindern wir, dass Unbefugte darauf zugreifen oder sie verändern? Gute Technik braucht beides. Bei echten Produkten kommen außerdem Rechtsgrundlage, Verantwortlichkeiten, Verträge und gegebenenfalls eine Datenschutz-Folgenabschätzung hinzu."] },
      ],
      relatedTopics: ["server-systems", "embedded-safety", "ai-premium"],
    },
    "glossary-basics": {
      title: "Fachbegriffe einfach erklärt",
      summary: "Dieses Lexikon erklärt häufige Begriffe aus modernen Systemlandschaften kurz, ohne vorauszusetzen, dass du sie bereits kennst.",
      access: "public",
      sections: [
        { heading: "Systeme und Vernetzung", table: { headers: ["Begriff", "Bedeutung", "Praktisches Beispiel"], rows: [
          ["Edge Computing", "Rechenarbeit findet nahe an der Datenquelle statt, also auf dem Gerät oder im lokalen Netzwerk – nicht erst in einem weit entfernten Rechenzentrum.", "Eine Kamera erkennt ein fehlerhaftes Teil direkt am lokalen Industrie-PC. Nur das Ergebnis oder ein Alarm wird weitergegeben."],
          ["Gateway", "Ein Vermittler zwischen Geräten, Netzen oder Protokollen. Es sammelt, übersetzt oder schützt den Weg zu anderen Systemen.", "Ein Raspberry Pi nimmt Werte von ESP32-Geräten entgegen und gibt sie gesammelt an einen Server weiter."],
          ["Latenz", "Die Zeit vom Senden einer Anfrage bis zur Reaktion. Kurze Latenz ist für direkte Bedienung und Steuerung wichtig.", "Ein Not-Aus oder ein Lichtschalter darf nicht von einer langsamen Internetverbindung abhängen."],
          ["API", "Eine klar definierte Schnittstelle, über die Programme Daten oder Funktionen anfordern können. Menschen nutzen meist eine App, Programme eine API.", "Die iPhone-App fragt über eine API den aktuellen Temperaturwert ab oder sendet einen Schaltbefehl."],
          ["Offline-first", "Die Kernfunktion funktioniert auch ohne Internet. Eine spätere Verbindung synchronisiert Daten oder erweitert Funktionen.", "Die Bewässerung läuft nach lokalen Regeln weiter; Messwerte werden übertragen, sobald die Verbindung zurück ist."]
        ] } },
        { heading: "Server und Betrieb", table: { headers: ["Begriff", "Bedeutung", "Praktisches Beispiel"], rows: [
          ["Container", "Eine abgegrenzte Laufzeitumgebung für eine Anwendung und ihre Abhängigkeiten. Mehrere Container können auf einem VPS laufen.", "Web-App, Datenbank und Hintergrunddienst laufen getrennt, lassen sich aber gemeinsam betreiben und aktualisieren."],
          ["Cloud Computing", "Rechenleistung, Speicher oder fertige Plattformdienste werden über das Internet nach Bedarf bezogen.", "Ein verwalteter Speicher bewahrt Bilder auf, ohne dass ein eigener Dateiserver betrieben werden muss."],
          ["VPS", "Ein Virtual Private Server ist ein virtueller Server im Rechenzentrum. Er verhält sich für dich wie ein eigener Server, teilt aber die physische Hardware mit anderen Instanzen.", "Eine kleine Plattform mit API, Website und Datenbank läuft kostengünstig auf einem VPS."],
          ["Worker", "Ein Hintergrunddienst, der einzelne Aufgaben abarbeitet, ohne dass eine App darauf warten muss.", "Nach dem Upload eines Bildes erzeugt ein Worker eine kleinere Vorschau."],
          ["Queue", "Eine Warteschlange für Aufgaben oder Ereignisse. Sie verteilt Arbeit kontrolliert an Worker.", "Viele Messwerte warten geordnet, bis ein Worker sie speichert oder auswertet."]
        ] } },
        { heading: "Embedded und Entwicklung", table: { headers: ["Begriff", "Bedeutung", "Praktisches Beispiel"], rows: [
          ["Firmware", "Software, die direkt auf einem eingebetteten Gerät läuft und seine Hardware steuert.", "Die Firmware eines ESP32 liest einen Temperatursensor und schaltet bei Bedarf ein Relais."],
          ["JTAG", "Eine Schnittstelle, über die Entwicklungswerkzeuge ein eingebettetes System gezielt prüfen und debuggen können.", "Ein Debugger hält die Firmware an und zeigt, welche Variable gerade einen unerwarteten Wert hat."],
          ["Funktionale Sicherheit", "Die Eigenschaft eines Systems, bei Fehlern oder Fehlbedienung keine unvertretbare Gefahr zu verursachen.", "Eine Maschine stoppt sicher, wenn ein Sensor ausfällt, statt unkontrolliert weiterzulaufen."]
        ] } },
        { heading: "Begriffe im Zusammenhang lesen", paragraphs: ["Ein Fachbegriff beschreibt selten allein eine gute oder schlechte Lösung. Edge Computing kann Latenz senken, ersetzt aber keine sichere Software. Ein VPS kann einfach zu betreiben sein, braucht aber weiterhin Updates und Backups. Nutze das Lexikon zum Nachschlagen und lies für Entscheidungen anschließend das passende Kapitel im Wissensportal."] },
      ],
      relatedTopics: ["server-systems", "local-servers", "software-basics", "embedded-measurement-debugging"],
    },
    "microcontroller-basics": {
      title: "Grundlagen Mikrocontroller",
      summary: "Ein Mikrocontroller verbindet Prozessor, Speicher und Hardware-Schnittstellen in einem Baustein. Diese Grundlagen helfen dir, Firmware und Schaltungen bewusst zusammenzubringen.",
      access: "public",
      sections: [
        { id: "microcontroller-flashing", heading: "Wie Software in einen Mikrocontroller kommt – und warum das Flashen heißt", paragraphs: [
          "Ein Mikrocontroller startet nicht mit einem Betriebssystem, das ein Programm von einer Festplatte lädt. Seine Software heißt Firmware und liegt dauerhaft in einem speziellen, nichtflüchtigen Speicher: dem Flash-Speicher. Nichtflüchtig bedeutet: Auch ohne Strom bleibt sie erhalten. Beim Einschalten liest der Chip seine Startinformationen aus diesem Speicher und führt anschließend die dort abgelegten Maschinenbefehle aus.",
          "Umgangssprachlich heißt das Übertragen der Firmware deshalb Flashen. Der Name kommt vom Flash-Speicher selbst. Diese Speichertechnik konnte im Vergleich zu älteren, einzeln löschbaren EEPROMs größere Bereiche schnell – wie einen kurzen Lichtblitz, englisch flash – löschen. Heute ist Flashen einfach der gebräuchliche Begriff dafür, eine Firmware in diesen Speicher zu schreiben; es hat nichts mit einer blinkenden LED oder einem Webbrowser-Plugin zu tun."
        ], list: ["Der Flash-Speicher enthält Firmware, Bootloader und oft Einstellungen oder Dateidaten dauerhaft.", "RAM ist nur Arbeitsspeicher für den laufenden Betrieb und wird beim Ausschalten gelöscht.", "Die Firmware muss zur Prozessorfamilie, zum Board und zur vorgesehenen Speicheraufteilung passen."] },
        { id: "microcontroller-flash-build", heading: "1. Aus Quelltext wird eine Firmware-Datei", paragraphs: [
          "Zuerst übersetzt der Compiler den Quelltext in Maschinenbefehle für genau diese Prozessorfamilie, etwa für einen ESP32-S3. Der Linker fügt den eigenen Code, Bibliotheken und die Startteile zusammen. Das Ergebnis ist nicht mehr der für Menschen geschriebene Quelltext, sondern eine oder mehrere Binärdateien.",
          "Bei vielen ESP32-Projekten gehören dazu ein Bootloader, eine Partitionstabelle und die eigentliche Anwendung. Die Partitionstabelle legt fest, an welchen Stellen des Flash-Speichers diese Teile liegen und ob zum Beispiel zwei Bereiche für OTA-Updates reserviert sind. Ein Build-Werkzeug erzeugt diese Dateien vor dem Übertragen und prüft dabei Größe, Adressen und Abhängigkeiten." ] },
        { id: "microcontroller-flash-bootloader", heading: "2. Der Bootloader öffnet den Programmierweg", paragraphs: [
          "Ein Mikrocontroller besitzt einen kleinen Startcode im Chip oder im Flash-Speicher: den Bootloader. Er kann entscheiden, ob das Gerät die vorhandene Firmware normal startet oder auf neue Daten wartet. Beim ESP32 wird dafür häufig die USB- oder serielle Schnittstelle verwendet. Manche Boards brauchen dafür einen Reset und eine BOOT-Taste, andere können automatisch in den Download-Modus wechseln.",
          "Das Flash-Werkzeug auf dem Computer, die FlashBox oder ein anderer Programmer verbindet sich mit diesem Bootloader. Es ermittelt den Chip, liest wichtige Eigenschaften wie Flash-Größe und sendet die Firmware in einem festgelegten Protokoll. Der Bootloader schreibt die empfangenen Daten nicht in den RAM, sondern an die vorgesehenen Adressen im Flash-Speicher." ] },
        { id: "microcontroller-flash-write", heading: "3. Löschen, schreiben und prüfen", paragraphs: [
          "Flash-Speicher kann nicht wie ein Notizblock einzelne Zeichen beliebig überschreiben. Er wird in größeren Bereichen, sogenannten Sektoren oder Blöcken, gelöscht und anschließend in kleineren Einheiten beschrieben. Deshalb löscht ein Flash-Werkzeug zuerst nur die benötigten Bereiche und schreibt dann Bootloader, Partitionstabelle und Anwendung an ihre festgelegten Adressen.",
          "Während des Vorgangs prüfen Werkzeug und Bootloader Prüfsummen. Sie helfen zu erkennen, ob Daten beim Übertragen beschädigt wurden oder an der falschen Stelle gelandet sind. Erst wenn das Schreiben und die Prüfung erfolgreich sind, wird das Gerät neu gestartet. Ein Fortschrittsbalken zeigt daher nicht nur das Senden der Datei, sondern auch Lösch- und Prüfschritte." ], list: ["Stromversorgung und Datenverbindung bis zum Abschluss nicht trennen.", "Ein USB-Ladekabel ohne Datenleitungen kann keinen Flash-Vorgang übertragen.", "Bei einem Fehler erneut verbinden, den Boot-Modus prüfen und die passende Firmware verwenden – nicht wahllos andere Images schreiben."] },
        { id: "microcontroller-flash-start", heading: "4. Start nach dem Flashen", paragraphs: [
          "Nach dem Neustart liest der Bootloader die Partitionstabelle und startet die ausgewählte Anwendung. Die Firmware richtet anschließend Pins, Speicher, Netzwerk und ihre eigentliche Aufgabe ein. Bei einem OTA-fähigen Gerät kann sie später eine neue Anwendung in eine zweite, freie Partition laden und erst nach erfolgreicher Prüfung darauf umschalten.",
          "Die erste Basissoftware wird meist über USB oder eine FlashBox aufgespielt, weil ein neues Gerät noch nicht im WLAN ist. Spätere Projekt-Updates können, wenn die Basissoftware und das Netzwerk eingerichtet sind, per OTA kommen. Der technische Kern bleibt derselbe: Eine geprüfte Binärdatei wird in einen vorgesehenen Bereich des nichtflüchtigen Flash-Speichers geschrieben." ] },
        { id: "microcontroller-memory", heading: "Speicherorganisation", paragraphs: ["Mikrocontroller verwenden unterschiedliche Speicherarten für unterschiedliche Aufgaben. Flash speichert Firmware dauerhaft. RAM enthält während des Betriebs Variablen, Zwischenergebnisse und den Programmstapel. Manche Systeme haben zusätzlich nichtflüchtigen Datenspeicher oder externen PSRAM.", "Wichtig ist die Unterscheidung: Viel Flash schafft Platz für Programm und Assets, viel RAM erlaubt größere Datenstrukturen und mehr parallele Aufgaben. Ein Neustart löscht normalen RAM, aber nicht die Firmware im Flash."] },
        { id: "microcontroller-registers", heading: "Register", paragraphs: ["Register sind sehr kleine Speicherplätze direkt im Prozessor oder in einem Hardware-Modul. Sie enthalten zum Beispiel einen Messwert, eine Konfiguration oder einen Status.", "Firmware schreibt gezielt in Konfigurationsregister und liest Statusregister aus. Bibliotheken nehmen dir viele Details ab, aber beim Debuggen hilft es zu wissen: Hinter GPIO, Timer oder ADC stehen immer Register mit klaren Bitfeldern und Datenblatt-Beschreibungen."] },
        { id: "microcontroller-gpio", heading: "GPIO", paragraphs: ["GPIO bedeutet General Purpose Input/Output: frei nutzbare Pins für digitale Ein- und Ausgänge. Als Eingang liest ein Pin etwa einen Tasterzustand. Als Ausgang schaltet er ein Signal für LED, Transistor oder ein anderes Logikmodul.", "Ein GPIO-Pin ist kein universeller Leistungsausgang. Strom, Spannung, Schutzbeschaltung und die zulässige Pin-Funktion müssen zum Datenblatt passen. Größere Lasten wie Motoren oder Relais werden über geeignete Treiberstufen geschaltet."] },
        { id: "microcontroller-adc", heading: "ADC", paragraphs: ["Ein Analog-Digital-Converter (ADC) wandelt eine analoge Spannung in einen digitalen Zahlenwert. Damit kann ein Mikrocontroller beispielsweise Potentiometer, Batteriespannung oder analoge Sensoren auswerten.", "Die Auflösung bestimmt, wie fein der Zahlenbereich ist; Messbereich, Referenzspannung, Störungen und Kalibrierung bestimmen, wie aussagekräftig der Messwert wirklich ist. Analoge Messung braucht deshalb oft Mittelwerte, Filter oder eine saubere elektrische Umgebung."] },
        { id: "microcontroller-timer", heading: "Timer", paragraphs: ["Timer sind Hardware-Zähler im Mikrocontroller. Sie zählen Takte unabhängig vom eigentlichen Programmablauf und können zu festen Zeitpunkten Ereignisse oder Interrupts auslösen.", "Sie eignen sich für regelmäßige Abtastungen, Zeitmessungen, präzise Schaltfolgen und als Grundlage für PWM. Ein Timer ist verlässlicher als eine lange Warteschleife, weil die Firmware währenddessen andere Aufgaben erledigen kann."] },
        { id: "microcontroller-pwm", heading: "PWM", paragraphs: ["Pulsweitenmodulation (PWM) schaltet ein digitales Signal schnell ein und aus. Das Verhältnis von Ein- zu Auszeit heißt Tastgrad und bestimmt die mittlere Wirkung.", "PWM kann LEDs dimmen, Motoren über passende Treiber ansteuern oder Steuersignale erzeugen. Sie ersetzt keine echte analoge Spannung in jeder Anwendung: Frequenz, Filter, Treiber und die angeschlossene Last müssen bewusst gewählt werden."] },
      ],
      relatedTopics: ["processor-overview", "embedded-measurement-debugging", "embedded-safety", "glossary-basics"],
    },
    "physical-limits": {
      title: "Grenzen der Physik",
      summary: "Datenblattwerte sind keine Wunschliste. Strom, Spannung, Temperatur und Geschwindigkeit haben Grenzen, die für jedes einzelne Bauteil und für das gesamte System gelten.",
      access: "public",
      sections: [
        { id: "physical-limits-ratings", heading: "Absolute Maximum Ratings – absolute Grenzwerte", paragraphs: ["Absolute Maximum Ratings, auf Deutsch absolute Grenzwerte, beschreiben Belastungen, die ein Bauteil keinesfalls überschreiten darf: etwa Spannung an einem Pin, Strom, Temperatur oder maximale Verlustleistung. Sie sind eine Schadensgrenze, kein normaler Arbeitspunkt.", "Für die Auslegung werden die empfohlenen Betriebsbedingungen (Recommended Operating Conditions) verwendet. Dort ist beschrieben, in welchem Bereich Funktionen, Pegel und Genauigkeit zugesichert sind. Wer dauerhaft direkt am absoluten Grenzwert arbeitet, plant keinen Sicherheitsabstand ein und riskiert vorzeitige Alterung, Fehlverhalten oder sofortigen Schaden."] },
        { id: "physical-limits-current", heading: "Strom pro Pin und Gesamtstrom", paragraphs: ["Ein GPIO-Pin darf nur einen begrenzten Strom liefern oder aufnehmen. Dieser Strom pro Pin ist nicht mit dem Gesamtstrom aller Pins gleichzusetzen. Viele gleichzeitig betriebene LEDs, Sensoren oder Logikeingänge können zusammen eine zweite, oft strengere Grenze des Mikrocontrollers oder seiner Versorgung erreichen.", "Das Datenblatt nennt je nach Baustein Grenzen für einzelne Pins, Pin-Gruppen, Versorgungspins und die gesamte Verlustleistung. Plane mit Reserve und benutze für größere Lasten geeignete Treiber: Transistoren, MOSFETs, Treiber-ICs oder Relaismodule mit eigener, passend abgesicherter Versorgung. Ein Mikrocontroller-Pin steuert dann den Treiber, nicht die Last direkt.", "Auch ein Ausgang, der nur kurzzeitig überlastet wird, kann sich stark erwärmen oder intern beschädigt werden. Widerstände für LEDs, Strombegrenzung und eine gemeinsame, korrekt geführte Masse sind keine optionalen Details."] },
        { id: "physical-limits-frequency", heading: "Maximale Frequenz und Prozessortakt", paragraphs: ["Die Prozessortaktrate sagt, wie schnell der Kern Befehle ausführen kann. Sie ist nicht automatisch die höchste brauchbare Frequenz an einem GPIO-Pin, auf einer Leitung oder bei einem angeschlossenen Bauteil.", "Eine Signalkette hat eigene Grenzen: GPIO-Schaltzeit, Timer-Auflösung, Bus- und Peripherietakt, Leitungslänge, Flankensteilheit, Lastkapazität, Störungen und die Anforderungen des Empfängers. Deshalb kann ein Prozessor mit hoher Taktrate ein externes Signal nur deutlich langsamer zuverlässig erzeugen, messen oder übertragen.", "Prüfe für jede Schnittstelle den passenden Datenblattwert und messe bei kritischen Signalen. Ein Oszilloskop oder Logikanalysator zeigt, ob Frequenz, Tastgrad, Pegel und Flanken am tatsächlichen Ziel noch korrekt ankommen. Für schnelle oder leistungsstarke Anwendungen sind spezialisierte Treiber, kürzere Leitungen, saubere Versorgung und ein passendes Übertragungsverfahren oft wichtiger als ein höherer Prozessortakt."] },
      ],
      relatedTopics: ["microcontroller-basics", "embedded-measurement-debugging", "embedded-safety"],
    },
    "sampling-rate": {
      title: "Abtastrate und Shannon-Theorem",
      summary: "Ein Mikrocontroller sieht ein analoges Signal nicht kontinuierlich, sondern als Folge einzelner Messwerte. Die Abtastrate entscheidet, welche Veränderungen zuverlässig erkennbar sind.",
      access: "public",
      sections: [
        { id: "sampling-rate-shannon", heading: "Nyquist-Shannon-Abtasttheorem", paragraphs: ["Das Nyquist-Shannon-Abtasttheorem beschreibt die Grundgrenze: Ein Signal mit einer höchsten relevanten Frequenz f lässt sich nur dann aus seinen Messwerten rekonstruieren, wenn die Abtastrate größer als das Doppelte dieser Frequenz ist. Die Nyquist-Frequenz ist die halbe Abtastrate.", "Beispiel: Sollen Signalanteile bis 100 Hz erfasst werden, muss mindestens mit mehr als 200 Messungen pro Sekunde abgetastet werden. Das ist eine theoretische Mindestgrenze unter idealen Bedingungen, nicht automatisch eine gute praktische Wahl."] },
        { id: "sampling-rate-aliasing", heading: "Aliasing – wenn hohe Frequenzen täuschen", paragraphs: ["Liegt ein Signalanteil oberhalb der Nyquist-Frequenz, kann er in den Messwerten als falsche, niedrigere Frequenz erscheinen. Dieses Phänomen heißt Aliasing. Die nachträgliche Software kann dann nicht mehr sicher erkennen, welche hohe Frequenz tatsächlich vorhanden war.", "Ein bekanntes Bild ist ein Rad im Film, das scheinbar langsam rückwärts dreht: Die Bildrate tastet seine Bewegung zu selten ab. Bei Sensoren kann dieselbe Täuschung Vibrationen, Störungen oder schnelle Wechsel falsch darstellen."] },
        { id: "sampling-rate-practice", heading: "Abtastrate praktisch wählen", paragraphs: ["Zuerst wird festgelegt, welche schnellste Signaländerung fachlich relevant ist. Danach wählt man eine Abtastrate mit ausreichender Reserve – oft deutlich höher als das bloße Zweifache. Reserve schaffen Abweichungen von Sensor, ADC, Zeitplanung und Filterung beherrschbar.", "Ein analoger Tiefpass vor dem ADC, ein Anti-Aliasing-Filter, dämpft Frequenzen oberhalb des gewünschten Bereichs schon vor der Messung. Erst dann kann die digitale Verarbeitung sinnvoll mitteln, filtern oder auswerten. Abtastrate, Messdauer, Datenmenge und Energieverbrauch gehören dabei zusammen: schnelleres Messen erzeugt mehr Daten und kostet häufig mehr Energie."] },
      ],
      relatedTopics: ["microcontroller-adc", "microcontroller-timer", "embedded-measurement-debugging", "physical-limits"],
    },
    "sensors": {
      title: "Sensoren",
      summary: "Sensoren übersetzen Eigenschaften der realen Welt in elektrische Signale. Erst die passende Messschaltung und Auswertung machen daraus einen verlässlichen Messwert.",
      access: "public",
      sections: [
        { id: "sensor-types", heading: "Sensoren nach Messgröße und Wirkprinzip ordnen", paragraphs: ["Sensoren lassen sich auf zwei Arten beschreiben. Die Messgröße sagt, was erfasst wird – zum Beispiel Position, Abstand, Temperatur, Licht, Beschleunigung, Druck oder Feuchte. Das Wirkprinzip sagt, wie daraus ein elektrisches Signal entsteht – zum Beispiel mechanisch, magnetisch, optisch, akustisch, kapazitiv, induktiv, resistiv, piezoelektrisch oder elektrochemisch.", "Diese Trennung ist wichtig, weil dieselbe Aufgabe mit verschiedenen Wirkprinzipien gelöst werden kann. Abstand lässt sich etwa mit Infrarotlicht, Ultraschall oder Radar messen. Umgekehrt kann dasselbe Wirkprinzip mehreren Aufgaben dienen: Ein Hall-Sensor kann einen Magneten erkennen, Drehzahl zählen oder Strom berührungslos erfassen.", "Analoge Sensoren liefern beispielsweise Widerstand, Spannung, Strom oder Frequenz. Digitale Sensoren bereiten den Messwert bereits auf und übertragen ihn über I²C, SPI, UART, 1-Wire oder einen Schaltausgang. Unabhängig vom Ausgang zählen Messbereich, Auflösung, Genauigkeit, Wiederholbarkeit, Reaktionszeit, Drift, Umgebung, Energiebedarf und mögliche Fehlerbilder."], table: { headers: ["Messgröße oder Aufgabe", "Typische Wirkprinzipien"], rows: [
          ["Position, Endlage, Anwesenheit", "Mechanischer Kontakt, Reed, Hall, induktiv, kapazitiv, optisch, Encoder"],
          ["Abstand und Annäherung", "Infrarot-Reflexion, optische Laufzeitmessung, Ultraschall, Radar, LiDAR"],
          ["Temperatur", "NTC, PTC, Widerstandsthermometer, Thermoelement, Halbleiter-IC"],
          ["Bewegung und Orientierung", "Beschleunigungssensor, Gyroskop, Magnetometer, PIR"],
          ["Kraft, Gewicht und Druck", "Dehnungsmessstreifen, piezoresistiv, kapazitiv, piezoelektrisch"],
          ["Umwelt und Stoffe", "Feuchte, Luftdruck, Gase, Partikel, Schall, elektrochemische Messzellen"],
          ["Füllstand und Durchfluss", "Schwimmer, Druck, kapazitiv, Ultraschall, Radar, Turbine, thermisch"],
          ["Elektrische Größen", "Shunt, Hall-Effekt, Stromwandler, Spannungsteiler, isolierter Messverstärker"]
        ] } },
        { id: "sensor-position-presence", heading: "Positions-, Endlagen- und Anwesenheitssensoren", paragraphs: ["Die bisher betrachteten Bauteile gehören überwiegend in diese Familie. Ein Reed-Kontakt erkennt einen Magneten, ein Endschalter wird mechanisch betätigt und ein induktiver Näherungssensor erkennt ein Metallziel. Sie liefern meist keinen Weg in Millimetern, sondern eine Aussage wie „Ziel vorhanden“ oder „Endlage erreicht“.", "Eine Lichtschranke ist zunächst ein Anwesenheitssensor: Sie erkennt, ob ihr Lichtweg frei oder unterbrochen ist. Erst durch die festgelegte Einbauposition wird dieses Ereignis zur Positions- oder Endlageninformation. Für eine kontinuierliche Position oder einen Drehwinkel sind Potentiometer, magnetische Winkelsensoren, Drehgeber sowie lineare oder optische Messsysteme geeigneter.", "Auch kapazitive Näherungssensoren gehören hierher. Sie reagieren auf die Änderung eines elektrischen Feldes und können neben Metall auch viele nichtmetallische Stoffe erkennen. Feuchte, Ablagerungen und die Einbausituation können ihre Schaltschwelle jedoch beeinflussen."], table: { headers: ["Sensor", "Typische Aussage", "Besondere Stärke"], rows: [
          ["Reed- oder Hall-Sensor", "Magnet vorhanden oder Magnetposition erreicht", "Berührungslos und gut gekapselt realisierbar"],
          ["Mechanischer Endschalter", "Mechanische Endlage tatsächlich betätigt", "Direkte und leicht nachvollziehbare Rückmeldung"],
          ["Induktiver Näherungssensor", "Metallziel im Schaltbereich", "Robust und berührungslos in Industrieumgebungen"],
          ["Kapazitiver Näherungssensor", "Material verändert das elektrische Feld", "Erkennt auch viele nichtmetallische Materialien"],
          ["Lichtschranke", "Lichtweg frei oder unterbrochen", "Schnelle berührungslose Anwesenheitserkennung"],
          ["Encoder oder Längenmesssystem", "Winkel, Weg oder Positionsänderung", "Viele aufeinanderfolgende Positionswerte statt nur eines Schaltpunkts"]
        ] } },
        { id: "sensor-reed-contact", heading: "Reed-Kontakt: Schalten mit einem Magneten", paragraphs: ["Ein Reed-Kontakt besteht aus zwei ferromagnetischen Kontaktzungen in einem hermetisch geschlossenen Glaskörper. Nähert sich ein Magnet, werden die Zungen magnetisiert und schließen oder öffnen den Stromkreis. An einer Tür sitzt deshalb meist der Reed-Kontakt am festen Rahmen und der Magnet am bewegten Teil.", "Für einen Mikrocontroller ist ein Reed-Kontakt ein einfacher digitaler Eingang. Er benötigt für das eigentliche Schließen des Kontakts keine eigene Versorgung, braucht aber eine passende Eingangsschaltung, meist mit Pull-up oder Pull-down. Wie bei mechanischen Kontakten können kurze Prellimpulse auftreten; Software oder ein kleines Filter muss den Zustand deshalb für eine kurze Zeit stabil bestätigen."], table: { headers: ["Vorteile", "Nachteile"], rows: [
          ["Berührungslos betätigt; kein offen liegender Schaltkontakt; sehr geringer Energiebedarf; gekapselte Kontakte sind gut gegen die Umgebung geschützt; für Tür- und Positionsabfragen bewährt.", "Magnet und Kontakt müssen mit passendem Abstand und passender Orientierung montiert sein; ein loser Magnet führt zu falschen Zuständen; der nackte Glaskörper ist mechanisch empfindlich; Schaltstrom und Spannung sind begrenzt."]
        ] } },
        { id: "sensor-photoelectric", heading: "Lichtschranke: Eine unterbrochene Lichtstrecke erkennen", paragraphs: ["Eine Lichtschranke erkennt, ob Licht vom Sender zum Empfänger gelangt. Bei einer Einweg-Lichtschranke stehen sich Sender und Empfänger gegenüber. Unterbricht ein Objekt den Strahl, ändert sich das Ausgangssignal. Andere Bauformen arbeiten mit einem Reflektor oder werten das vom Objekt zurückgeworfene Licht aus.", "Die Lichtschranke arbeitet berührungslos und kann über größere Abstände erkennen. Für eine Tür-Endlage muss der Strahl jedoch so angeordnet sein, dass wirklich die Tür oder ein festes Zielstück erkannt wird – nicht zufällig ein Tier, ein Flügel, ein Blatt oder ein anderes Objekt."], table: { headers: ["Vorteile", "Nachteile"], rows: [
          ["Berührungslos und damit ohne mechanischen Verschleiß am Messpunkt; größere Erfassungsabstände möglich; viele Materialien lassen sich erkennen; die Position kann ohne Magnet bestimmt werden.", "Staub, Federn, Spinnweben, Schlamm oder Kondenswasser können Sender, Empfänger oder Reflektor verdecken; Sender und Empfänger müssen ausgerichtet bleiben; Fremdlicht und ungeeignete Oberflächen können die Erkennung erschweren; benötigt Energie und meist mehr Verdrahtung."]
        ] } },
        { id: "sensor-limit-switch", heading: "Mechanischer Endschalter: Die Endlage direkt betätigen", paragraphs: ["Der korrekte Fachbegriff ist mechanischer Endschalter oder Positionsschalter. Im Inneren sitzt häufig ein Mikroschalter; außen überträgt ein Stößel, Hebel oder Rollenhebel die Bewegung. Erreicht die Tür die Endlage, drückt ein festes Betätigungsteil den Schalter.", "Ein industrieller Endschalter ist nicht dasselbe wie ein ungeschützter kleiner Taster. Geeignete Gehäuse und Dichtungen können den inneren Kontakt gegen Wasser, Öl, Staub und Schmutz schützen. Trotzdem bleibt die Betätigung mechanisch: Weg, Kraft, Überlaufweg und die sichere Rückstellung müssen zur Konstruktion passen."], table: { headers: ["Vorteile", "Nachteile"], rows: [
          ["Direkte und leicht verständliche Bestätigung der physischen Endlage; einfaches digitales Signal; viele Betätigerformen; gekapselte Industrievarianten können mechanisch und gegenüber der Umgebung sehr robust sein.", "Betätiger und Mechanik werden belastet und können verschleißen; falscher Überlaufweg kann den Schalter beschädigen; Schlamm, Eis oder Fremdkörper können die Bewegung blockieren; die Tür muss den Schalter zuverlässig erreichen und mit passender Kraft betätigen."]
        ] } },
        { id: "sensor-contact-bridge", heading: "Leitende Kontaktbrücke: Zwei Metallflächen direkt verbinden", paragraphs: ["Die vorgeschlagene Lösung mit zwei Metallstiften und einem Metallblatt ist eine leitende Kontaktbrücke. In der Endlage verbindet das Metallblatt beide Kontakte; der Mikrocontroller erkennt den geschlossenen Stromkreis. Das Prinzip ist elektrisch einfach und kann in einem Versuchsaufbau anschaulich sein.", "Für eine dauerhaft zuverlässige Außenanwendung sind offen liegende Kontakte jedoch kritisch. Feuchtigkeit, Stallstaub, Schmutz, Oxidation und Korrosion verändern den Kontaktwiderstand. Das Metallblatt kann nur teilweise aufliegen, die Flächen können sich abnutzen oder leitfähiger Schmutz kann einen falschen Kontakt herstellen. Ohne gekapselte, korrosionsbeständige und selbstreinigende Konstruktion ist diese Variante deshalb eher ein Lernversuch als eine robuste Endlagenerkennung."], table: { headers: ["Vorteile", "Nachteile"], rows: [
          ["Sehr einfach zu verstehen; wenige Bauteile; preiswert; Endlage wird unmittelbar durch elektrischen Kontakt bestätigt.", "Offene Kontaktflächen sind anfällig für Schmutz, Feuchtigkeit, Oxidation und Korrosion; Kontaktwiderstand kann schwanken; mechanische Ausrichtung und Anpressdruck sind nötig; Kurzschluss- und Fehlkontaktpfade müssen begrenzt werden."]
        ] } },
        { id: "sensor-inductive", heading: "Weiterdenken: Induktiver Näherungssensor", paragraphs: ["Wenn ein Metallziel erkannt werden soll, ist ein induktiver Näherungssensor eine berührungslose Alternative zur offenen Kontaktbrücke. Er erkennt ein Metallstück, ohne es elektrisch zu berühren. Dadurch gibt es an der Messstelle keinen offenen Schaltkontakt und keinen mechanischen Kontaktverschleiß.", "Induktive Sensoren können in schmutziger Umgebung sehr robust sein, benötigen aber eine Versorgung, eine passende Ausgangsschaltung und ein Metallziel innerhalb ihres begrenzten Schaltabstands. Sie sind meist teurer und größer als ein Reed-Kontakt. Für ein Lernprojekt sind sie eine gute Erinnerung daran, dass dieselbe fachliche Aufgabe mit unterschiedlichen physikalischen Prinzipien gelöst werden kann."] },
        { id: "sensor-chicken-door-task", heading: "Denkaufgabe: Endlagen einer automatischen Hühnerklappe", paragraphs: ["Eine motorisierte Hühnerklappe soll zuverlässig melden, ob sie vollständig geöffnet oder vollständig geschlossen ist. Der Sensor sitzt in einem Stall: Staub, Federn, Spinnweben, Feuchtigkeit und gelegentlicher Schlamm sind realistische Einflüsse. Die Lösung soll langlebig sein und möglichst wenig Wartung benötigen.", "Vergleiche Reed-Kontakt, Lichtschranke, mechanischen Endschalter und leitende Kontaktbrücke. Du darfst zusätzlich einen induktiven Näherungssensor mit Metallziel berücksichtigen. Entscheide nicht nur nach dem Kaufpreis, sondern begründe deine Wahl aus dem Wirkprinzip und den Randbedingungen."], list: [
          "Welches Prinzip würdest du für die vollständig geöffnete Endlage wählen – und warum?",
          "Welches Prinzip würdest du für die vollständig geschlossene Endlage wählen? Würdest du bewusst zweimal denselben Sensortyp einsetzen?",
          "Welche Lösung ist gegenüber Staub, Federn und Spinnweben am unempfindlichsten?",
          "Was passiert bei einem verrutschten Magneten, einem verdeckten Lichtweg, einem klemmenden Schalter oder korrodierten Kontakten?",
          "Welcher Fehler könnte fälschlich „Tür geschlossen“ melden? Wie müsste die Steuerung reagieren, wenn beide Endlagen gleichzeitig aktiv oder beide über längere Zeit inaktiv sind?",
          "Wie würdest du Sensor, Kabel und Befestigung montieren, damit ein Huhn sie nicht beschädigt und die Tür trotzdem sicher stoppen kann?"
        ] },
        { id: "sensor-selection-games", heading: "Frage-Antwort-Spiele: Welcher Sensor passt?", paragraphs: ["Wähle zuerst selbst eine Antwort. Danach kannst du prüfen, welches Prinzip unter den genannten Randbedingungen am besten passt. In einem echten Projekt muss anschließend immer ein konkretes Datenblatt gegen Genauigkeit, Schutzart, Temperatur, Schaltabstand und Lebensdauer geprüft werden."], quizzes: [
          {
            id: "cnc-reference",
            title: "CNC-Maschine: reproduzierbare Referenzfahrt",
            situation: "Eine CNC-Achse fährt bei jeder Referenzfahrt aus derselben Richtung langsam auf ihren Referenzpunkt zu. Metallspäne und Kühlschmierstoff sind möglich. Das Signal soll verschleißfrei und sehr gut wiederholbar sein.",
            question: "Welches der bisher vorgestellten Prinzipien ist für das robuste Referenzsignal die naheliegendste Wahl?",
            answer: "inductive",
            options: [
              { id: "reed", label: "Reed-Kontakt mit Magnet" },
              { id: "photoelectric", label: "Offene Lichtschranke" },
              { id: "limit", label: "Einfacher ungekapselter Endschalter" },
              { id: "inductive", label: "Industriegeeigneter induktiver Näherungssensor mit Metallfahne" },
              { id: "bridge", label: "Offene leitende Kontaktbrücke" }
            ],
            correctText: "Für das robuste Referenzsignal ist hier ein geeigneter induktiver Näherungssensor mit Metallfahne die naheliegende Wahl.",
            wrongText: "Prüfe noch einmal, welches Prinzip berührungslos arbeitet und in Varianten für Metallspäne sowie Kühlschmierstoff ausgelegt ist.",
            explanation: "Induktive Sensoren erkennen ein Metallziel berührungslos und sind in öl- und schmutzbeständigen Industrieausführungen erhältlich. Hohe Wiederholgenauigkeit entsteht trotzdem nicht allein durch das Wort „induktiv“: Schaltabstand, Hysterese, Temperaturdrift, Einbaulage und immer gleiche langsame Anfahrrichtung müssen spezifiziert werden. Für die eigentliche hochgenaue Achsposition braucht die CNC zusätzlich einen Encoder oder ein Längenmesssystem; der Näherungssensor liefert vor allem Referenz- oder Endlagensignal. Ein gekapselter Präzisions-Endschalter kann ebenfalls funktionieren, hat aber eine mechanische Betätigung."
          },
          {
            id: "window-alarm",
            title: "Fensteralarm: offen oder geschlossen",
            situation: "Ein Fenster in einem trockenen Wohnraum soll batteriebetrieben auf Öffnen reagieren. Schmutz und hohe Positioniergenauigkeit sind kaum relevant; der Sensor soll klein, leise und langlebig sein.",
            question: "Welches Prinzip passt am besten?",
            answer: "reed",
            options: [
              { id: "reed", label: "Reed-Kontakt mit Magnet" },
              { id: "photoelectric", label: "Lichtschranke quer durch den Fensterrahmen" },
              { id: "limit", label: "Großer mechanischer Endschalter" },
              { id: "inductive", label: "Induktiver Sensor mit Metallfahne" }
            ],
            correctText: "Der Reed-Kontakt ist für diesen Fensteralarm eine typische und gut begründbare Wahl.",
            wrongText: "Achte besonders auf geringen Energiebedarf, kleine Bauform und berührungslose Betätigung.",
            explanation: "Ein Reed-Sensor mit Magnet lässt sich klein oder verdeckt montieren, benötigt für das Schließen des Kontakts keine eigene Sensorversorgung und bietet für die Zustandsmeldung genügend Wiederholbarkeit. Magnetabstand und Montage müssen dennoch geprüft werden. Bei einem echten Alarmsystem kommen außerdem Leitungsüberwachung, Sabotageerkennung und eine sichere Auswertung hinzu."
          },
          {
            id: "conveyor-count",
            title: "Förderband: Werkstücke zählen",
            situation: "Unterschiedliche nicht transparente Werkstücke fahren berührungslos an einer festen Stelle vorbei. Gezählt werden soll jedes Objekt; die Umgebung ist weitgehend sauber.",
            question: "Welcher Sensor erkennt die vorbeifahrenden Werkstücke am direktesten?",
            answer: "photoelectric",
            options: [
              { id: "reed", label: "Reed-Kontakt" },
              { id: "photoelectric", label: "Einweg-Lichtschranke" },
              { id: "limit", label: "Mechanischer Endschalter im Förderweg" },
              { id: "bridge", label: "Leitende Kontaktbrücke" }
            ],
            correctText: "Eine Einweg-Lichtschranke erkennt jedes Werkstück berührungslos durch die Unterbrechung des Lichtstrahls.",
            wrongText: "Gesucht ist eine schnelle, berührungslose Erkennung unabhängig von einem Magneten oder elektrischer Leitfähigkeit.",
            explanation: "Sender und Empfänger stehen sich gegenüber; ein Werkstück unterbricht den Lichtweg. Das vermeidet mechanischen Kontakt mit dem Fördergut. Für zuverlässiges Zählen müssen Strahlhöhe, Mindestobjektgröße, Objektabstand und mögliche Verschmutzung berücksichtigt werden."
          },
          {
            id: "outdoor-gate",
            title: "Außentor: Endlage mit Schlamm und Regen",
            situation: "Ein metallisches Schiebetor soll seine geschlossene Endlage melden. Regen, Staub und Schlamm sind zu erwarten; eine Metallfahne kann fest am Tor montiert werden.",
            question: "Welches Prinzip ist unter diesen Randbedingungen besonders robust?",
            answer: "inductive",
            options: [
              { id: "photoelectric", label: "Ungeschützte Lichtschranke in Bodennähe" },
              { id: "bridge", label: "Zwei offene Metallkontakte" },
              { id: "inductive", label: "Gekapselter induktiver Näherungssensor" },
              { id: "limit", label: "Offener kleiner Taster" }
            ],
            correctText: "Ein passend gekapselter induktiver Näherungssensor kann die Metallfahne berührungslos und schmutzunempfindlich erkennen.",
            wrongText: "Suche nach einer gekapselten, berührungslosen Lösung, die ein vorhandenes Metallziel direkt erkennen kann.",
            explanation: "Das induktive Prinzip braucht weder einen freien Lichtweg noch offene elektrische Kontakte. Entscheidend bleiben Schutzart, korrosionsfeste Montage, zulässiger Schaltabstand und eine Position, an der sich kein massiver Metallbelag vor der aktiven Fläche aufbauen kann. Ein abgedichteter Industrie-Endschalter wäre eine mögliche mechanische Alternative."
          }
        ] },
        { id: "sensor-application-map", heading: "Welcher Sensor passt wohin?", paragraphs: ["Die Zuordnung ist kein universelles Rezept. Sie zeigt, welches Wirkprinzip häufig gut zu einer Aufgabe passt und welche zusätzliche Bedingung die Auswahl verändern kann."], table: { headers: ["Anwendung", "Naheliegendes Prinzip", "Entscheidender Grund oder Vorbehalt"], rows: [
          ["Fenster- oder Türalarm", "Reed-Kontakt mit Magnet", "Klein, berührungslos und stromsparend; Montageabstand und Sabotagekonzept beachten."],
          ["Hühnerklappe", "Reed-Kontakte oder gekapselte induktive Sensoren", "Schmutzresistent und berührungslos; zwei Endlagen getrennt und widerspruchsfrei auswerten."],
          ["CNC-Referenz- oder Endsignal", "Industriegeeigneter induktiver Sensor oder gekapselter Präzisions-Endschalter", "Späne und Kühlschmierstoff berücksichtigen; Wiederholgenauigkeit spezifizieren. Die genaue Achsposition liefert ein Encoder oder Längenmesssystem."],
          ["Werkstücke auf einem sauberen Förderband zählen", "Einweg-Lichtschranke", "Schnelle berührungslose Unterbrechungserkennung; Optik sauber und ausgerichtet halten."],
          ["Metallisches Außentor", "Gekapselter induktiver Näherungssensor", "Metallziel berührungslos erkennen; passende Schutzart und Montage wählen."],
          ["Einfacher Laborversuch", "Leitende Kontaktbrücke", "Sehr anschaulich und preiswert, aber ohne gekapselte Spezialkonstruktion nicht für schmutzige oder feuchte Daueranwendungen."],
          ["Sicherheitskritische Schutztür", "Zertifizierter Sicherheitssensor und Sicherheitsauswertung", "Ein gewöhnlicher Sensor allein genügt nicht; erforderliche Sicherheitsfunktion und Diagnose bestimmen die Komponenten."]
        ] } },
        { id: "sensor-distance-proximity", heading: "Abstands- und Näherungssensoren", paragraphs: ["Abstandssensoren liefern mehr als nur „da“ oder „nicht da“: Sie schätzen oder messen die Entfernung zu einem Objekt. Dabei sind Infrarotsensoren keine einheitliche Bauart. Ein einfacher reflektiver IR-Sensor bewertet die Stärke des zurückkommenden Lichts; ein Time-of-Flight-Sensor misst dagegen die Laufzeit ausgesendeter Lichtimpulse. Farbe, Oberfläche, Fremdlicht, Schutzscheiben und Messbereich wirken je nach Verfahren unterschiedlich.", "Ultraschallsensoren bestimmen die Laufzeit eines Schallimpulses. Sie sind unabhängig von der sichtbaren Farbe eines Ziels, können aber durch weiche oder schräg stehende Flächen, Luftbewegung, Temperatur und gegenseitige Störung beeinflusst werden. Optische LiDAR- und ToF-Systeme arbeiten mit Licht und können präzise Entfernungs- oder Tiefendaten liefern, brauchen jedoch eine passende Optik und Bewertung der Augensicherheit.", "Radar sendet elektromagnetische Wellen aus und wertet Reflexionen aus. Je nach Verfahren lassen sich Entfernung, Relativgeschwindigkeit und Richtung bestimmen. Radar kann auch bei Dunkelheit und in manchen staubigen oder feuchten Situationen Vorteile haben, ist aber aufwendiger auszuwerten und kann mehrere Ziele, Reflexionen und störende Geometrien sehen."], table: { headers: ["Verfahren", "Gut geeignet für", "Typische Stolperstelle"], rows: [
          ["Reflektives Infrarot", "Kurze Annäherung, Linienfolger, einfache Objekterkennung", "Reflexion hängt von Oberfläche, Winkel und Fremdlicht ab"],
          ["Optisches Time-of-Flight oder LiDAR", "Direkte Distanz- und Tiefenmessung", "Messbereich, Sichtfeld, Schutzscheibe und starkes Umgebungslicht beachten"],
          ["Ultraschall", "Abstand zu ausreichend großen Flächen, Füllstand", "Schallkegel, tote Zone, Temperatur und weiche oder schräge Ziele"],
          ["Radar", "Präsenz, Bewegung, Abstand, Geschwindigkeit oder Füllstand", "Mehrdeutige Reflexionen und anspruchsvollere Signalverarbeitung"],
          ["Kapazitiv", "Sehr kurze Annäherung, Berührung, Material hinter einer Wand", "Feuchte und Ablagerungen können die Schaltschwelle verschieben"]
        ] } },
        { id: "sensor-fmcw-radar", heading: "FMCW-Radar: Entfernung und Bewegung aus Chirps", paragraphs: ["FMCW bedeutet Frequency Modulated Continuous Wave. Das Radar sendet fortlaufend kurze Frequenzrampen, sogenannte Chirps. Ein Ziel reflektiert das Signal zeitlich verzögert. Im Empfänger werden Sende- und Empfangssignal gemischt; die entstehende Beat-Frequenz enthält Information über den Abstand. Phasenänderungen über mehrere Chirps liefern Information über die Relativgeschwindigkeit. Eine Winkelbestimmung erfordert einen geeigneten Antennenaufbau mit mehreren Empfangskanälen und zusätzliche Auswertung.", "Ein FMCW-Radarmodul ist deshalb nicht automatisch ein fertiger Näherungsschalter. Manche Module liefern Rohdaten, andere Zielpunkte mit Abstand und Geschwindigkeit, wieder andere nur ein aufbereitetes Präsenzsignal. Frequenzband, Antennen, Bandbreite, Firmware, Schnittstelle und Hersteller-API bestimmen, was tatsächlich messbar ist. Vor dem Anschluss müssen die exakte Typbezeichnung, Versorgung, Logikpegel, Pinbelegung und regionalen Herstellerhinweise geprüft werden.", "Für eine Näherungserkennung wird aus den Radarwerten eine fachliche Regel: Welche Ziele liegen in der gewünschten Zone, wie lange müssen sie dort erkannt werden und welche Bewegungen oder Reflexionen sollen ausgeschlossen werden? Leerer Raum, feste Abstände, Stillstand, Annäherung, Querbewegung, mehrere Ziele und reflektierende Gegenstände gehören deshalb in den Versuchsplan."], table: { headers: ["Vergleich", "Vorteil von FMCW-Radar", "Nachteil oder Grenze"], rows: [
          ["Gegenüber reflektivem Infrarot", "Nicht von sichtbarer Objektfarbe abhängig; funktioniert ohne sichtbares Licht; kann je nach Modul Abstand und Bewegung trennen.", "Höhere Kosten und komplexere Auswertung; Reflexionen und mehrere Ziele können mehrdeutig sein."],
          ["Gegenüber IR-Time-of-Flight", "Kein optischer Lichtweg im gleichen Sinn; kann in manchen staubigen, dunklen oder optisch schwierigen Situationen robuster sein und zusätzlich Geschwindigkeit liefern.", "Radar- und ToF-Eigenschaften hängen stark vom konkreten Modul ab; Radar hat oft gröbere räumliche Abgrenzung und sieht störende Reflexionen."],
          ["Gegenüber Ultraschall", "Keine Abhängigkeit von Schallgeschwindigkeit, Luftbewegung oder weichen schallabsorbierenden Oberflächen; schnelle Bewegungsinformation möglich.", "Material, Geometrie und Mehrwegeausbreitung beeinflussen Radarreflexionen; Signalverarbeitung ist meist anspruchsvoller."],
          ["Gegenüber PIR", "Kann je nach Ausführung Entfernung und sehr kleine Bewegungen erfassen und ist nicht auf Änderungen der Wärmestrahlung beschränkt.", "Benötigt mehr Energie und Rechenaufwand; eine stabile Personenerkennung braucht Zonen, Filter und Tests."],
          ["Grundsätzliche Stärke", "Ein Sensorprinzip kann Präsenz, Entfernung, Relativgeschwindigkeit und bei geeigneter Antennenanordnung Winkelinformation liefern.", "Nicht jedes FMCW-Modul stellt alle Größen bereit; Datenblatt, SDK und reale Messungen entscheiden."]
        ] }, learningProjects: [
          {
            model: "Lernprojekt · Projektstufe 1",
            title: "Baue deinen eigenen Näherungssensor",
            description: "Identifiziere dein gekauftes FMCW-Radarmodul, verstehe die Messkette und entwickle mit einem kontrollierten Versuchsplan eine erste Näherungs- oder Präsenzerkennung.",
            href: "/app/learn/?catalog=build-your-own-proximity-sensor"
          }
        ] },
        { id: "sensor-temperature", heading: "Temperatursensoren: NTC, PTC und weitere Bauarten", paragraphs: ["Ein NTC ist ein temperaturabhängiger Widerstand mit negativem Temperaturkoeffizienten: Steigt die Temperatur, sinkt sein Widerstand. NTCs sind preiswert, klein und empfindlich, aber deutlich nichtlinear. Für einen Messwert braucht man eine Messschaltung, eine Kennlinie oder Berechnungsformel und oft eine Kalibrierung.", "Bei einem PTC steigt der Widerstand mit der Temperatur. Manche PTCs eignen sich zur Temperaturerfassung; stark schaltende PTC-Ausführungen werden häufig eher zum Schutz vor Übertemperatur oder Überstrom eingesetzt. Deshalb sind „PTC“ und „genauer Temperatursensor“ nicht automatisch dasselbe.", "Widerstandsthermometer wie Pt100 oder Pt1000 bieten gute Stabilität und eine vergleichsweise gut definierte Kennlinie, benötigen aber eine präzise Auswertung und je nach Leitungslänge eine Drei- oder Vierleiterschaltung. Thermoelemente erzeugen eine kleine Spannung aus der Temperaturdifferenz zweier verschiedener Metalle und eignen sich für große Temperaturbereiche; sie brauchen Verstärkung und Kaltstellenkompensation. Halbleiter-Temperatursensoren liefern eine analoge Spannung oder bereits einen digitalen Messwert und sind für viele Elektronik- und Raumtemperaturaufgaben bequem."], table: { headers: ["Bauart", "Stärke", "Zu beachten"], rows: [
          ["NTC-Thermistor", "Preiswert, klein, hohe Empfindlichkeit", "Widerstand sinkt bei Wärme; nichtlinear und durch Messstrom selbst erwärmbar"],
          ["PTC-Thermistor", "Temperaturabhängiger Grenzwert oder Schutz", "Widerstand steigt; schaltende Typen sind nicht für jede Messaufgabe geeignet"],
          ["Pt100/Pt1000 (RTD)", "Stabil und gut für präzise Messungen", "Präziser Messstrom, Leitungswiderstand und Auswertung nötig"],
          ["Thermoelement", "Sehr große Temperaturbereiche und robuste Fühler möglich", "Sehr kleine Spannung sowie Kaltstellenkompensation erforderlich"],
          ["Halbleiter-IC", "Einfacher analoger oder digitaler Messwert", "Begrenzter Temperaturbereich und thermische Ankopplung beachten"]
        ] } },
        { id: "sensor-light-radiation", heading: "Licht-, Farb- und Strahlungssensoren", paragraphs: ["Ein Fotowiderstand verändert seinen Widerstand mit der Helligkeit und eignet sich für einfache, langsame Hell-Dunkel-Erkennung. Fotodioden und Fototransistoren reagieren schneller und definierter; mit einer passenden Verstärkerschaltung können sie sehr kleine Lichtströme messen.", "Integrierte Umgebungslicht- und Farbsensoren enthalten Filter und digitale Auswertung. Sie können Helligkeit an die Wahrnehmung des Menschen annähern oder mehrere Farbkanäle liefern. UV- und Infrarotsensoren reagieren auf andere Wellenlängenbereiche. Eine Wärmebildkamera oder Thermopile misst abgegebene Infrarotstrahlung und darf nicht mit einem einfachen reflektiven IR-Abstandssensor verwechselt werden.", "Bei optischen Messungen gehören Lichtquelle, Wellenlänge, Blickwinkel, Oberfläche, Fremdlicht, Verschmutzung und Alterung immer zur Messkette."], table: { headers: ["Bauart", "Typische Aufgabe"], rows: [
          ["Fotowiderstand (LDR)", "Einfache und eher langsame Helligkeitserkennung"],
          ["Fotodiode oder Fototransistor", "Schnelle Lichtmessung, Lichtschranke, optische Kommunikation"],
          ["Umgebungslicht- oder Farbsensor", "Helligkeitsanpassung, Farb- oder Materialunterscheidung"],
          ["UV-Sensor", "UV-Anteil oder UV-Index abschätzen"],
          ["Thermopile oder Wärmebildsensor", "Berührungslose Oberflächen- oder Wärmestrahlungsmessung"]
        ] } },
        { id: "sensor-motion-orientation", heading: "Bewegungs-, Lage- und Orientierungssensoren", paragraphs: ["Ein Beschleunigungssensor misst Beschleunigung entlang einer oder mehrerer Achsen. Im Stillstand sieht er auch die Erdbeschleunigung und kann daraus eine Neigung ableiten. Ein Gyroskop misst Drehgeschwindigkeit; durch Integration lässt sich eine Winkeländerung bestimmen, wobei sich Fehler mit der Zeit aufsummieren können.", "Ein Magnetometer misst das Magnetfeld und kann als elektronischer Kompass dienen, wird aber von Metall, Motoren und Strömen beeinflusst. Eine IMU kombiniert meist Beschleunigungssensor und Gyroskop, manchmal zusätzlich ein Magnetometer. Erst Sensorfusion verbindet diese unvollkommenen Messungen zu einer stabileren Lage- oder Bewegungsabschätzung.", "Ein PIR-Sensor reagiert auf Änderungen der Wärmestrahlung in mehreren Sichtbereichen. Er eignet sich für die Bewegung warmer Körper, liefert aber weder ein Kamerabild noch automatisch einen genauen Abstand oder eine sichere Personenerkennung."], table: { headers: ["Sensor", "Misst unmittelbar"], rows: [
          ["Beschleunigungssensor", "Lineare Beschleunigung einschließlich Erdgravitation"],
          ["Gyroskop", "Drehgeschwindigkeit"],
          ["Magnetometer", "Magnetfeldstärke und -richtung"],
          ["IMU", "Kombinierte Bewegungsgrößen mehrerer Sensoren"],
          ["PIR", "Änderungen einfallender Wärmestrahlung in seinem Sichtfeld"]
        ] } },
        { id: "sensor-force-pressure", heading: "Kraft-, Gewichts-, Druck- und Berührungssensoren", paragraphs: ["Ein Dehnungsmessstreifen ändert seinen Widerstand, wenn er gedehnt oder gestaucht wird. Mehrere davon bilden häufig eine Wheatstone-Brücke in einer Wägezelle. Das Signal ist klein und benötigt einen geeigneten Messverstärker; Mechanik, Temperatur und Krafteinleitung bestimmen die Qualität der Messung wesentlich mit.", "Piezoresistive oder kapazitive Drucksensoren wandeln die Verformung einer Membran in ein elektrisches Signal um. Sie messen je nach Aufbau Absolutdruck, Relativdruck oder Differenzdruck. Barometer, Reifendrucksensoren und Drucktransmitter beruhen auf solchen Prinzipien.", "Piezoelektrische Sensoren erzeugen bei schneller Kraftänderung oder Vibration eine elektrische Ladung. Sie sind sehr gut für Stoß, Klopfen und Schwingung, aber ohne besondere Elektronik weniger für eine dauerhaft unveränderte statische Kraft. Ein Force-Sensitive Resistor reagiert einfach auf Druck, ist jedoch meist weniger genau und reproduzierbar als eine Wägezelle."], table: { headers: ["Bauart", "Typische Aufgabe"], rows: [
          ["Wägezelle mit Dehnungsmessstreifen", "Gewicht und statische Kraft"],
          ["Piezoresistiver oder kapazitiver Drucksensor", "Luft-, Flüssigkeits- oder Differenzdruck"],
          ["Piezoelement", "Stoß, Klopfen, Vibration und schnelle Kraftänderung"],
          ["Force-Sensitive Resistor", "Einfache Berührungs- oder Druckstufenerkennung"],
          ["Kapazitiver Touchsensor", "Berührung oder Annäherung eines Fingers"]
        ] } },
        { id: "sensor-environment-chemical", heading: "Umwelt-, Schall- und chemische Sensoren", paragraphs: ["Feuchtesensoren bestimmen meist die relative Luftfeuchte über ein kapazitives oder resistives Messelement. Luftdrucksensoren messen den atmosphärischen Druck und können daraus Wetteränderungen oder relative Höhenänderungen abschätzen. Mikrofone wandeln Schalldruck in ein elektrisches Signal; Lautstärke, Frequenzanalyse und Spracherkennung entstehen erst in der nachfolgenden Verarbeitung.", "Bei Gassensoren muss genau benannt werden, was gemessen wird. Metalloxid-Sensoren reagieren oft auf mehrere Gase und benötigen Heizung, Aufwärmzeit und Kalibrierung. Elektrochemische Zellen können für bestimmte Gase empfindlicher sein, altern aber. Nichtdispersive Infrarotsensoren bestimmen beispielsweise CO₂ über Lichtabsorption. Ein allgemeiner „Luftqualitätssensor“ liefert daher nicht automatisch eine genaue Konzentration jedes Schadstoffs.", "Partikelsensoren beleuchten angesaugte Luft und werten gestreutes Licht aus. Sie schätzen Partikelkonzentrationen, benötigen aber einen kontrollierten Luftweg und können durch Feuchte, Staubablagerung und unterschiedliche Partikeleigenschaften beeinflusst werden. Chemische Messungen brauchen besonders sorgfältige Kalibrierung, Querempfindlichkeits- und Lebensdauerbetrachtung."], table: { headers: ["Messgröße", "Typische Bauart"], rows: [
          ["Relative Luftfeuchte", "Kapazitives oder resistives Feuchteelement"],
          ["Luftdruck", "Mikromechanischer Absolutdrucksensor"],
          ["Schall", "MEMS- oder Elektretmikrofon"],
          ["CO₂", "NDIR-Infrarotmessung"],
          ["Bestimmte Gase", "Elektrochemische Zelle oder Metalloxid-Sensor"],
          ["Feinstaub", "Optische Streulichtmessung mit Luftstrom"]
        ] } },
        { id: "sensor-level-flow", heading: "Füllstands- und Durchflusssensoren", paragraphs: ["Füllstand kann punktuell oder kontinuierlich erfasst werden. Ein Schwimmerschalter meldet einen Grenzstand mechanisch oder magnetisch. Leitfähige Elektroden funktionieren nur bei ausreichend leitfähigen Flüssigkeiten und können korrodieren. Kapazitive Sensoren können durch eine nichtleitende Behälterwand erkennen, reagieren aber auf Material, Wandstärke und Ablagerungen.", "Ultraschall und Radar messen berührungslos den Abstand zur Oberfläche. Drucksensoren am Behälterboden können aus dem hydrostatischen Druck auf die Füllhöhe schließen, benötigen dafür aber Dichte und Geometrie. Für aggressive, schäumende oder dampfende Medien muss das Verfahren besonders sorgfältig gewählt werden.", "Durchfluss lässt sich unter anderem mit Turbinenrad und Hall-Sensor, Druckdifferenz, Ultraschall, thermischem Prinzip oder magnetisch-induktiv messen. Jedes Verfahren stellt andere Anforderungen an Medium, Rohr, Einbaulage, Mindestdurchfluss und Wartung."], table: { headers: ["Aufgabe", "Mögliche Prinzipien"], rows: [
          ["Grenzstand", "Schwimmer, Reed, kapazitiv, leitfähig, optisch"],
          ["Kontinuierlicher Füllstand", "Druck, Ultraschall, Radar, kapazitive Sonde"],
          ["Einfacher Wasserdurchfluss", "Turbinenrad mit Hall-Sensor"],
          ["Berührungsloser Durchfluss", "Ultraschall"],
          ["Leitfähige Flüssigkeit industriell", "Magnetisch-induktive Durchflussmessung"]
        ] } },
        { id: "sensor-electrical", heading: "Sensoren für Spannung, Strom und Leistung", paragraphs: ["Spannung wird häufig über einen Spannungsteiler und einen ADC gemessen. Der Teiler muss Grenzspannung, Toleranz, Eingangsimpedanz und Schutz berücksichtigen. Bei hohen oder netzbezogenen Spannungen sind sichere Trennung, geeignete Bauteile und normgerechter Aufbau erforderlich; ein einfacher Spannungsteiler genügt dort nicht.", "Strom kann über den Spannungsabfall an einem Shunt-Widerstand gemessen werden. Das ist direkt und präzise möglich, erzeugt aber Verlustleistung und liegt elektrisch im gemessenen Stromkreis. Hall-Stromsensoren und Stromwandler können galvanische Trennung ermöglichen; klassische Stromwandler eignen sich für Wechselstrom, nicht für unveränderten Gleichstrom.", "Leistung ist normalerweise keine einzelne unmittelbare Sensorgröße. Sie wird aus synchron gemessener Spannung und Strom berechnet. Bei Wechselstrom müssen außerdem Phasenlage, Effektivwerte und die Signalform berücksichtigt werden."], table: { headers: ["Verfahren", "Geeignet für", "Wichtiger Vorbehalt"], rows: [
          ["Spannungsteiler und ADC", "Kleine, sicher bezogene Gleichspannungen", "Eingang schützen und zulässige Spannung niemals überschreiten"],
          ["Shunt und Messverstärker", "Gleich- und Wechselstrom", "Verlustleistung und gemeinsames Potential beachten"],
          ["Hall-Stromsensor", "Gleich- und Wechselstrom, oft galvanisch getrennt", "Offset, Temperaturdrift und externer Magnetismus"],
          ["Stromwandler", "Galvanisch getrennte Wechselstrommessung", "Nicht für statischen Gleichstrom; Sekundärkreis sicher behandeln"],
          ["Energie-Mess-IC", "Spannung, Strom, Leistung und Energie", "Messwandler, Isolation und Kalibrierung bleiben Teil des Systems"]
        ] } },
        { id: "measurement-circuits", heading: "Messschaltungen", paragraphs: ["Eine Messschaltung verbindet Sensor und Mikrocontroller so, dass das Signal im erlaubten Spannungs-, Strom- und Frequenzbereich ankommt. Sie schützt Eingänge, legt Bezugspotenziale fest und bereitet das Signal für ADC oder digitale Schnittstelle auf.", "Typische Bausteine sind Vorwiderstände, Spannungsteiler, Pull-up- oder Pull-down-Widerstände, Filterkondensatoren, Referenzspannungen, Operationsverstärker und galvanische Trennung. Welche davon nötig sind, entscheidet das Sensordatenblatt – nicht nur der Anschlussname am Board.", "Beispiel: Ein Spannungsteiler kann eine zu hohe Sensorspannung für einen ADC verringern. Ein Tiefpass kann Rauschen dämpfen, verändert aber zugleich die Reaktionszeit. Ein Pull-up sorgt bei offenen Eingängen für einen definierten Zustand. Prüfe deshalb immer Versorgung, gemeinsame Masse, Signalpegel und die zulässigen Grenzwerte, bevor du misst oder verbindest."] },
      ],
      relatedTopics: ["microcontroller-adc", "sampling-rate", "embedded-measurement-debugging", "physical-limits"],
    },
    "actuators": {
      title: "Aktoren",
      summary: "Aktoren setzen elektrische Signale in eine sichtbare oder physische Wirkung um: Licht, Bewegung, Wärme, Schall oder einen Schaltvorgang. Sie brauchen fast immer mehr als einen Mikrocontroller-Pin.",
      access: "public",
      sections: [
        { id: "actuator-types", heading: "Aktor-Typen", paragraphs: ["Zu den einfachen Aktoren gehören LEDs, Summer und Displays. Sie zeigen oder signalisieren etwas. Schaltaktoren wie Relais, Ventile, Magnetventile und Leistungsschalter verändern einen Stromkreis. Bewegungsaktoren wie Gleichstrommotoren, Servos, Schrittmotoren und Linearantriebe bewegen mechanische Teile.", "Auch Heizungen, Lüfter, Pumpen und elektromagnetische Schlösser sind Aktoren. Ihre Auswahl hängt von benötigter Kraft, Geschwindigkeit, Betriebsdauer, Versorgung, Umgebung, Geräusch, Wärmeentwicklung und Sicherheitsanforderungen ab. Ein Aktor ist nicht nur das bewegte Bauteil: Mechanik, Stromversorgung, Treiber und Rückmeldung gehören zur gesamten Funktion.", "Für Lern- und Prototyping-Projekte sollten Aktoren mit geringer Energie und klaren Fehlergrenzen gewählt werden. Sobald Kräfte, hohe Temperaturen, Netzspannung oder Menschen gefährdende Bewegungen beteiligt sind, gelten zusätzliche Sicherheits- und Prüfanforderungen."] },
        { id: "actuator-driver-circuits", heading: "Schaltungen zur Ansteuerung", paragraphs: ["Ein GPIO-Pin liefert nur ein schwaches Logiksignal. Er darf Motoren, Relais, Pumpen oder Magnetventile nicht direkt versorgen. Eine Treiberschaltung übernimmt die Leistung: Der Mikrocontroller gibt den Befehl, der Treiber schaltet die Energie für den Aktor.", "Für Gleichstromlasten werden häufig Transistoren oder MOSFETs verwendet. Relais, Motoren und Magnetventile erzeugen beim Abschalten eine Spannungsspitze; eine passende Freilaufdiode oder ein spezialisierter Treiber schützt die Schaltung. Motoren brauchen je nach Richtung und Regelung H-Brücken oder fertige Motortreiber. Servos benötigen eine stabile, ausreichend dimensionierte Versorgung und ein PWM-Steuersignal.", "Versorgung und Signalmasse müssen bewusst geplant werden. Eine getrennte Aktorversorgung kann Störungen vom Mikrocontroller fernhalten, braucht aber bei nicht galvanisch getrennter Ansteuerung meist einen definierten gemeinsamen Bezug. Sicherungen, Strombegrenzung, korrekte Leitungsquerschnitte und Schutz vor Verpolung gehören zur Schaltung. Vor dem Anschluss Datenblatt, Spannungsbereich, Spitzenstrom und Wärmeentwicklung prüfen."] },
      ],
      relatedTopics: ["microcontroller-gpio", "microcontroller-pwm", "physical-limits", "embedded-safety"],
    },
    "bus-systems": {
      title: "Bussysteme",
      summary: "Ein Bussystem überträgt Daten zwischen elektronischen Teilnehmern. Die passende Wahl hängt vor allem davon ab, ob Chips auf einer Platine oder Geräte über längere Strecken verbunden werden.",
      access: "public",
      sections: [
        { id: "chip-to-chip-buses", heading: "Chip-zu-Chip-Schnittstellen", paragraphs: ["Chip-zu-Chip-Schnittstellen verbinden Bausteine auf derselben Platine oder über sehr kurze Leitungen: Mikrocontroller, Sensoren, Speicher, Displays oder Wandler. Typische Beispiele sind I²C, SPI und UART.", "I²C benötigt meist nur zwei Signalleitungen und erlaubt mehrere adressierbare Teilnehmer; es ist praktisch für viele Sensoren und Konfigurationsbausteine. SPI verwendet getrennte Daten- und Taktleitungen sowie meist eine Auswahlleitung pro Ziel; es ist oft schneller und passt zu Displays, Speichern oder schnellen Wandlern. UART ist eine einfache serielle Punkt-zu-Punkt-Verbindung, häufig für Debug-Ausgaben, Module oder eine direkte Gerätekommunikation.", "Diese Schnittstellen sind nicht für beliebig lange Kabel oder raue Umgebungen gedacht. Leitungslänge, Taktfrequenz, Pull-up-Widerstände, Massebezug, Pegel und die Anzahl der Teilnehmer begrenzen, was zuverlässig funktioniert."] },
        { id: "field-and-system-buses", heading: "Feld- und Systembusse", paragraphs: ["Die zweite wichtige Kategorie sind Feld- und Systembusse. Sie verbinden eigenständige Geräte, Steuergeräte oder Maschinen über längere Leitungen und sind auf störungsärmere Übertragung, mehrere Teilnehmer und definierte Protokolle ausgelegt.", "CAN und LIN sind typische Fahrzeug- und Steuergerätebusse. RS-485 ist eine robuste elektrische Grundlage für serielle Feldkommunikation und wird oft mit Protokollen wie Modbus kombiniert. Ethernet verbindet Geräte mit hoher Datenrate in lokalen Netzwerken und industriellen Varianten. Je nach Anwendung kommen weitere Feldbusse und industrielle Ethernet-Protokolle hinzu.", "Ein Bus besteht nie nur aus zwei Datenpins: Topologie, Abschlusswiderstände, Leitungstyp, Teilnehmerzahl, Bitrate, galvanische Trennung, Fehlerbehandlung und das konkrete Protokoll gehören zusammen. Besonders in Fahrzeugen oder Maschinen dürfen unbekannte Bussysteme nicht durch Bastelanschlüsse verändert oder unterbrochen werden; auch vermeintlich harmlose Informationen können Teil sicherheitskritischer Abläufe sein."] },
      ],
      relatedTopics: ["sensors", "actuators", "embedded-measurement-debugging", "embedded-safety"],
    },
    "processor-overview": {
      title: "ESP32-Prozessorfamilien im Vergleich",
      summary: "Die ESP32-Bezeichnung beschreibt zuerst den Chip. Ein Board ergaenzt ihn um Flash, USB, Spannungsversorgung, Antenne und oft Display, Sensoren oder weitere Anschluesse.",
      sections: [
        { heading: "Erst die Aufgabe, dann der Chip", paragraphs: ["Die Buchstaben sind keine Reihenfolge von gut nach schlecht. C steht vor allem fuer kompakte, vernetzte RISC-V-Controller, S fuer umfangreichere WLAN-Controller, H fuer 802.15.4 ohne WLAN und P fuer einen leistungsstarken Prozessor ohne eingebauten Funk. Entscheidend sind Funkweg, Energieversorgung, lokale Bedienung und die benoetigten Anschluesse."] },
        { heading: "Familienuebersicht", table: { headers: ["Familie", "Funk", "Fuer Hausautomation besonders passend", "Einordnung"], rows: [
          ["ESP32 (klassisch)", "WLAN 2,4 GHz, Bluetooth Classic und BLE", "Bestehende Maker-Projekte, einfache WLAN-Nodes", "Sehr weit verbreitet; fuer neue Projekte nur waehlen, wenn ein konkretes Board oder Beispiel dafuer spricht."],
          ["ESP32-S2", "WLAN 2,4 GHz", "WLAN-Sensor, USB-Geraet, einfache lokale Webseite", "Kein Bluetooth und kein Zigbee/Thread."],
          ["ESP32-S3", "WLAN 2,4 GHz, BLE", "Touchdisplay, lokale Weboberflaeche, Audio, Kamera oder mehr lokale Logik", "Gute Wahl fuer sichtbare, interaktive Home Nodes; kein Zigbee/Thread."],
          ["ESP32-C2", "WLAN 2,4 GHz, BLE", "Sehr kleine, preiswerte WLAN-Sensoren oder Aktoren", "Weniger Reserven und Anschluesse; nicht fuer Display- oder umfangreiche Projekte."],
          ["ESP32-C3", "WLAN 2,4 GHz, BLE", "Einfacher WLAN-Home-Node, Sensor, Relais oder lokale Statusseite", "Solider Einstieg fuer WLAN. C3 hat kein Zigbee und kein Thread."],
          ["ESP32-C5", "Dual-Band WLAN 6 (2,4/5 GHz), BLE", "Anforderungsvolle WLAN-Umgebungen oder 5-GHz-WLAN", "Kein Zigbee/Thread. Fuer einen ersten Home-Node meist mehr als erforderlich."],
          ["ESP32-C6", "WLAN 6 (2,4 GHz), BLE, 802.15.4", "WLAN-Node mit spaeterem Zigbee- oder Thread-Pfad; versorgte Bridge oder Gateway", "Der flexible Funkchip: 802.15.4 ist die Grundlage fuer Zigbee und Thread. Funk-Koexistenz muss im Projekt bewusst geplant werden."],
          ["ESP32-C61", "WLAN 6 (2,4 GHz), BLE", "Moderne WLAN-Sensoren, Aktoren und energieoptimierte WLAN-Nodes", "Kein Zigbee/Thread; moderne Alternative im WLAN-Zweig."],
          ["ESP32-H2", "BLE, 802.15.4 Zigbee/Thread", "Batterie-Sensor oder Aktor als Zigbee-/Thread-Endgeraet", "Kein WLAN. Ein H2 kann keine lokale WLAN-Webseite anbieten und braucht fuer den Weg ins Netzwerk einen passenden Koordinator oder eine Bridge."],
          ["ESP32-P4", "kein eingebauter Funk", "Grosse lokale Bedienoberflaechen, Kamera, Multimedia oder leistungsfaehige Steuerung", "Funk kommt bei Bedarf von einem zusaetzlichen C-, S- oder H-Chip. Kein Einstiegschip fuer einen einzelnen WLAN-Sensor."],
        ] } },
        { heading: "Schnellauswahl fuer das Lernprojekt", table: { headers: ["Wenn du moechtest ...", "sinnvoller Start"], rows: [
          ["Temperatur messen und die Werte im Browser des Heimnetzes sehen", "C3, S3 oder C6 als WLAN-Home-Node."],
          ["Ein Display, Touch oder eine umfangreiche lokale Ansicht", "S3; bei sehr anspruchsvoller Grafik oder Kamera spaeter P4 mit getrenntem Funkchip."],
          ["Einen moeglichst sparsamen Batterie-Sensor im Zigbee-Netz", "H2 als schlafendes Endgeraet plus vorhandener Zigbee-Koordinator."],
          ["Heute WLAN nutzen, Zigbee oder Thread aber als Lernpfad offenhalten", "C6. Erst den WLAN-Teil sauber bauen, dann den 802.15.4-Pfad gezielt ergaenzen."],
          ["Viele Zigbee-Geraete mit einer lokalen Oberflaeche verbinden", "Eine dauerhaft versorgte Bridge; bei anspruchsvolleren Varianten ein S3 plus H2 als getrennte Funk- und Bedienkomponenten."],
        ] } },
        { heading: "Akku und Funk realistisch beurteilen", paragraphs: ["Eine Chipfamilie allein bestimmt nicht die Batterielaufzeit. Entscheidend sind Messintervall, Schlafdauer, Sendezeit, Sensor und die Rolle im Funknetz. Ein batteriebetriebenes Zigbee-Geraet ist normalerweise ein schlafendes Endgeraet; ein Router oder Koordinator muss dagegen erreichbar bleiben und wird typischerweise dauerhaft versorgt. WLAN kann ebenfalls sparsam sein, wenn ein Node nur selten aufwacht und sendet, braucht aber fuer eine staendig erreichbare lokale Webseite deutlich mehr Energie."] },
        { heading: "Was die Tabelle nicht behauptet", paragraphs: ["Es gibt keine allgemeine ESP32-C-Familie und aktuell keine ESP32-S6-Familie. C5 und C61 gibt es, P4 ebenfalls. Die Tabelle ist eine Orientierung, keine Freigabeliste. Ob ein konkretes Board fuer GerNetiX flashbar und passend ist, pruefst du anschliessend in Unterstuetzte Boards anhand der exakten Boardvariante, ihres Flash-Speichers und der Anschluesse."] },
      ],
      actions: [{ label: "Unterstuetzte Boards ansehen", route: "/hilfe/#supported-devices" }],
      relatedTopics: ["supported-devices", "provision-new-board", "update-profiles"],
    },
    "first-project": {
      title: "Start your first project",
      summary: "Choose a template when you want a starting point, or begin with a blank development project.",
      sections: [{ heading: "Choose a path", paragraphs: ["Templates give you a structure to adapt. A blank project is useful when you already know what you want to build."], code: "// Your project source is managed in the GerNetiX IDE.\nvoid setup() {\n}\n\nvoid loop() {\n}" }],
      relatedTopics: ["quick-start", "supported-devices"],
    },
    "board-definition": {
      title: "Warum eine Board Definition?",
      summary: "Der erkannte ESP32-Chip reicht nicht aus, um eine sichere und passende Basissoftware auszuwählen.",
      sections: [
        { heading: "Chip ist nicht gleich Board", paragraphs: ["Die USB-Erkennung sieht den ESP32 und oft dessen Flash-Größe. Sie kann aber nicht zuverlässig erkennen, welches konkrete Board, Display, welche Pins oder welche externe Speicherbestückung verbaut sind."] },
        { heading: "Wofür wir die Definition brauchen", list: ["Sie wählt das passende Firmware- und Partitionsprofil für die bestätigte Flash-Größe.", "Sie übernimmt bei bekannten Boards geprüfte Hardwareeigenschaften.", "Sie verhindert, dass eine unpassende Firmware oder Speicheraufteilung auf das Board geschrieben wird.", "Bei einem unbekannten Board kannst du die Ausstattung anhand des Datenblatts selbst festlegen."] },
      ],
      relatedTopics: ["supported-devices", "update-profiles"],
    },
    "register-device": {
      title: "Register a device",
      summary: "Register a board after GerNetiX has detected and flashed it, then give it a clear name in your inventory.",
      sections: [
        { heading: "USB or Wi-Fi", paragraphs: ["Wi-Fi takes over a board that has already been provisioned and is reachable in your local network. USB is the right choice for a new board or one that cannot be reached."], list: ["Open Device Management > Provisioning.", "Choose USB or Wi-Fi and let GerNetiX detect the board.", "Flash a new board when prompted, then register it with a meaningful board name."] },
        { heading: "Why register first?", paragraphs: ["Registration establishes the device identity and makes the board available in your account inventory. Pairing then connects that registered board to your account."] },
      ],
      actions: [{ label: "Open provisioning", route: "/app/device-management/provisioning/" }],
      relatedTopics: ["pair-device", "flash-device", "device-not-detected"],
    },
    "pair-device": {
      title: "Pair a device",
      summary: "Pairing links a registered board to your GerNetiX account so it can be used in projects.",
      sections: [
        { heading: "Pairing sequence", list: ["Detect the board by USB or Wi-Fi.", "Complete flashing for a new or unreachable board.", "Register the board and confirm the account pairing."] },
        { heading: "USB and virtual COM ports", paragraphs: ["A USB-connected board provides a virtual serial port. On Windows this appears as a COM port. A newly connected board needs one browser permission, even when Windows already shows the port in Device Manager."], links: [{ topicId: "device-not-detected", label: "Device is not detected" }] },
      ],
      actions: [{ label: "Open Device Management", route: "/app/device-management/" }],
      relatedTopics: ["register-device", "flash-device", "device-not-detected"],
    },
    "flash-device": {
      title: "Geräte flashen: USB, OTA oder FlashBox?",
      summary: "Beim Flashen wird die Basissoftware oder ein Projekt-Build auf ein Gerät geschrieben. GerNetiX bietet dafür drei Wege.",
      sections: [
        { heading: "Den passenden Weg wählen", list: ["Das Gerät ist neu, hat noch kein WLAN oder liegt direkt am Rechner: USB verwenden.", "Das Gerät ist bereits eingerichtet, im WLAN und online: OTA verwenden.", "Du arbeitest mit iPad, Android oder ohne USB-Serial-Anschluss am Arbeitsgerät: FlashBox verwenden." ] },
        { heading: "1. Direkt per USB", paragraphs: ["Verbinde das Zielgerät mit einem USB-Datenkabel mit deinem Computer. GerNetiX benötigt einmalig die Freigabe für den seriellen Anschluss und schreibt die Firmware direkt auf das Board. Das ist der einfachste Weg für neue Geräte und für die erste Basissoftware."], list: ["Ein Ladekabel ohne Datenleitungen funktioniert nicht.", "Das Board während des Flashens nicht abziehen."] },
        { heading: "2. OTA über WLAN", paragraphs: ["OTA bedeutet Over-the-Air. Es funktioniert nur, wenn die GerNetiX-Basissoftware bereits auf dem Gerät läuft, das Gerät im WLAN erreichbar ist und OTA aktiviert wurde. Der Projekt-Build wird dann ohne Kabel über das Netzwerk übertragen."], list: ["Ideal für Updates bereits eingerichteter Geräte.", "Für ein neues oder nicht erreichbares Gerät zuerst USB oder FlashBox nutzen."] },
        { heading: "3. Über die FlashBox", paragraphs: ["Die FlashBox ist eine WLAN-zu-USB-/Serial-Brücke. Sie steht bei dem Zielgerät und verbindet dessen USB-Anschluss mit GerNetiX über WLAN. So kannst du ein Gerät auch vom iPad, Android oder einem Rechner ohne passenden USB-Serial-Anschluss flashen."], list: ["Die FlashBox zuerst einrichten und bei Bedarf deinem Inventar hinzufügen.", "Das Zielgerät per Target-USB an die FlashBox anschließen.", "In einem Projekt bei Flashen die FlashBox auswählen; sie übernimmt die USB-Verbindung zum Zielgerät."] },
        { heading: "Was wird geschrieben?", paragraphs: ["Bei einem neuen Gerät schreibt GerNetiX zunächst die Basissoftware. Sie richtet die sichere Geräteidentität, WLAN und spätere OTA-Updates ein. Danach können Projekt-Builds per USB, OTA oder FlashBox aufgespielt werden."] },
      ],
      actions: [{ label: "Provisionierung öffnen", route: "/app/device-management/provisioning/" }, { label: "FlashBox einrichten", route: "/flashbox-einrichten/" }],
      relatedTopics: ["provision-new-board", "usb-wifi-setup", "register-device", "device-not-detected"],
    },
    "provision-new-board": {
      title: "Neues Board in Betrieb nehmen",
      summary: "Dieser geführte Ablauf verbindet ein neues Board sicher mit deinem WLAN und deinem GerNetiX-Account.",
      sections: [
        { heading: "1. Verbindungsweg wählen", paragraphs: ["Wähle USB, wenn das Board neu ist, über WLAN nicht gefunden wird oder bisher nur minimal eingerichtet wurde. WLAN wählst du nur für ein bereits vollständig eingerichtetes und im gleichen Netzwerk erreichbares Board."] },
        { heading: "2. Board erkennen und auswählen", list: ["Starte die automatische USB-Suche und wähle die angefragte serielle Schnittstelle im Browser aus.", "Wähle ein bekanntes Board aus der Liste. Ist dein Modell nicht dabei, wähle Manuell konfigurieren und übernimm die Angaben aus dem Datenblatt.", "Wähle danach das passende Update- und Speicherprofil. Die Beispiele und die Erklärung findest du über das Fragezeichen."] },
        { heading: "3. Basissoftware flashen", paragraphs: ["Klicke auf Basissoftware flashen und lasse das USB-Kabel verbunden, bis GerNetiX den Erfolg meldet."] },
        { heading: "4. WLAN lokal einrichten", list: ["Klicke auf WLANs suchen. Dein Board sucht die verfügbaren Netzwerke selbst.", "Wähle dein WLAN aus oder gib ein verborgenes WLAN manuell ein.", "Gib das WLAN-Passwort ein und verbinde das Board."] },
        { heading: "Deine Daten bleiben lokal", paragraphs: ["SSID und Passwort werden nicht an GerNetiX übertragen und nicht im Browser gespeichert. Sie werden ausschließlich per USB an dein Board übertragen und dort lokal abgelegt."] },
        { heading: "5. Fertigstellen", paragraphs: ["Sobald das Board mit dem WLAN verbunden ist, beendet GerNetiX die Registrierung und verbindet das Board mit deinem Account. Anschließend findest du es in deinem Geräte-Inventar und kannst es in Projekten auswählen."] },
        { heading: "Alternative", paragraphs: ["Wenn du das WLAN-Passwort nicht über USB eingeben möchtest, nutze nach dem Flashen das Captive Portal des Boards. Verbinde dich dafür mit dem vom Board bereitgestellten WLAN und öffne die lokale Einrichtungsseite."] },
      ],
      actions: [{ label: "Provisionierung öffnen", route: "/app/device-management/provisioning/" }],
      relatedTopics: ["usb-wifi-setup", "update-profiles", "device-not-detected"],
    },
    "usb-wifi-setup": {
      title: "WLAN per USB einrichten",
      summary: "Nach dem Flashen kann das Board sein WLAN direkt und lokal ueber die USB-Verbindung erhalten.",
      sections: [
        { heading: "So funktioniert es", list: ["Wähle in der Provisionierung WLANs suchen. Das Board sucht die sichtbaren Netzwerke selbst.", "Wähle dein WLAN aus oder gib ein verborgenes Netzwerk manuell ein.", "Gib das Passwort ein und bestätige. Das Board speichert die Daten lokal und verbindet sich."] },
        { heading: "Deine Zugangsdaten", paragraphs: ["SSID und Passwort werden weder an GerNetiX übertragen noch im Browser gespeichert. Sie werden nur über die USB-Verbindung an dein Board übergeben und dort lokal abgelegt."] },
        { heading: "Alternative: Captive Portal", paragraphs: ["Wenn du die USB-Übergabe nicht verwenden möchtest, kannst du nach dem Flashen das Captive Portal des Boards nutzen. Verbinde dich dafür mit dem vom Board bereitgestellten WLAN und öffne die lokale Einrichtungsseite. Auch dabei bleiben die Zugangsdaten auf dem Board."] },
      ],
      actions: [{ label: "Provisionierung öffnen", route: "/app/device-management/provisioning/" }],
      relatedTopics: ["flash-device", "register-device", "device-not-detected"],
    },
    "update-profiles": {
      title: "Update- und Speicherprofile",
      summary: "FULL, MEDIUM und LOW bestimmen, wie viel Flash für sichere Updates oder für deine Anwendung reserviert wird.",
      sections: [
        { heading: "Die drei Profile", list: [
          "FULL – maximale Ausfallsicherheit: Zwei Firmwarebereiche erhalten die letzte funktionierende Software, auch wenn ein Update fehlschlägt.",
          "MEDIUM – speicheroptimiert: Ein kleiner Wiederherstellungsbereich lässt mehr Platz für Display, Sound und Anwendung. Ein fehlgeschlagenes Update wird erneut ausgeführt.",
          "LOW – Minimalkonfiguration: Der größtmögliche Speicherbereich steht der Anwendung zur Verfügung. Updates und Wiederherstellung erfolgen ausschließlich über USB.",
        ] },
        { heading: "Wann wählt man was?", table: {
          headers: ["Interner Flash", "FULL", "MEDIUM", "LOW"],
          rows: [
            ["4 MB", "Kleine Regelungen, Sensoren, Relais und LEDs", "Kleines OLED, einfache Menüs, wenige Fonts", "Vollgrafik, viele Ansichten, größere Bilder oder Sound"],
            ["8 MB", "Regelungen mit OLED, einfache TFT- und Touch-Oberflächen", "Umfangreiche Touch-Oberflächen, mehrere Ansichten und lokale Daten", "Sehr große Medienanwendungen oder konsequent offline betriebene Spezialprojekte"],
            ["16 MB", "Übliche Touchdisplays, Sound, mehrere Ansichten und sichere Updates", "Sehr große Font-, Bild-, Audio- oder Datenbestände", "Außergewöhnlich große Offline-Anwendungen; normalerweise nicht erforderlich"],
          ],
        } },
        { heading: "Später ändern", paragraphs: ["Du kannst das Profil jederzeit wechseln. Ändert sich dabei die Speicheraufteilung oder war OTA bisher nicht vorhanden, muss das Board einmal per USB verbunden und neu geflasht werden."] },
        { heading: "SD-Karte und PSRAM", paragraphs: ["Bilder, Fonts, Audio und Webseiten können auf einer externen SD-Karte liegen. Firmwarecode und OTA-Partitionen müssen trotzdem in den internen Flash passen. Externe PSRAM vergrößert nur den Arbeitsspeicher, nicht den Firmware-Flash."] },
      ],
      actions: [{ label: "Provisionierung öffnen", route: "/app/device-management/provisioning/" }],
      relatedTopics: ["flash-device", "supported-devices"],
    },
    "supported-devices": {
      title: "Unterstützte Boards",
      summary: "Eine Sammlung aller aktiven Boards aus dem GerNetiX Hardware Catalog – mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        { heading: "Die Sammlung", paragraphs: ["Jede Karte steht für eine konkrete unterstützte Boardvariante. Die Liste ist keine Sammlung eigener Hilfethemen: Eigenschaften, Schnittstellen und Hinweise stehen direkt bei dem Board."] },
        { heading: "Was bedeutet unterstützt?", paragraphs: ["Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt."] },
        { heading: "Ersteinrichtung", list: ["Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.", "Auf dem Mac installiert GerNetiX einmalig den Serial Service. Danach erfolgen Erkennung, Flash und Einrichtung vollständig in der GerNetiX-Plattform.", "iPhone und iPad eignen sich für die PWA, Push und Bedienung, aber nicht für die kabelgebundene Ersteinrichtung."] },
        { heading: "Kauf und Herstellerinformationen", paragraphs: ["Datenblatt- und Beschaffungslinks stehen direkt bei dem jeweiligen Board. Entscheidend ist immer die genaue Boardvariante, nicht nur die allgemeine ESP32-Familie."] }
      ],
      relatedTopics: ["provision-new-board", "device-not-detected", "update-profiles"],
    },
    "event-worker-rules": {
      title: "Ereignis-Worker und Regelsprache",
      summary: "Lege fest, wann ein Ereignis verarbeitet wird – ohne allgemeine Skripte oder unkontrollierte Zugriffe.",
      sections: [
        { heading: "Aufgabe des Workers", paragraphs: ["Ein IoT-Gerät meldet ein Ereignis. Der Worker bewertet es anhand einer Regel und kann ein Folgeereignis freigeben. Der Dispatcher stellt dieses Folgeereignis anschließend an ein Ziel zu. Push ist nur eine mögliche Zustellart und nicht Aufgabe des Workers."] },
        { heading: "Gültige Werte", table: { headers: ["Wert", "Bedeutung"], rows: [["event.type", "Name des eingegangenen Ereignisses"], ["event.value", "Mitgelieferter Text- oder Zahlenwert"], ["state.<name>", "Nur eine im Projektmodell ausdrücklich deklarierte Zustandsvariable"]] } },
        { heading: "Was bedeutet true oder false?", paragraphs: ["Ein Regelausdruck beantwortet immer genau eine Frage mit true (wahr) oder false (falsch). true bedeutet: Die Regel trifft zu und der Worker darf ein Folgeereignis freigeben. false bedeutet: Die Regel trifft nicht zu; dieser Durchlauf endet ohne Folgeereignis."] },
        { heading: "Vergleichsoperatoren", table: { headers: ["Operator", "Bedeutung", "Beispiel"], rows: [["==", "ist gleich", "event.type == taste_gedrueckt"], ["!=", "ist nicht gleich", "state.life_state != warnung"], ["<", "kleiner als", "state.hunger < 10"], ["<=", "kleiner oder gleich", "state.hunger <= 10"], [">", "größer als", "state.hunger > 20"], [">=", "größer oder gleich", "state.hunger >= 80"]] } },
        { heading: "Verknüpfungen", table: { headers: ["Operator", "Bedeutung", "Beispiel"], rows: [["&&", "und – beide Seiten müssen wahr sein", "event.type == timer_tick && state.hunger >= 80"], ["||", "oder – mindestens eine Seite muss wahr sein", "event.type == fuettern || event.type == schlafenszeit"], ["!", "nicht – kehrt wahr und falsch um", "!(state.life_state == warnung)"]] } },
        { heading: "So wird ein Ausdruck gelesen", paragraphs: ["event.type == timer_tick && state.hunger >= 80 bedeutet: Der Worker reagiert nur, wenn ein Zeitereignis eingegangen ist und gleichzeitig der deklarierte Hungerwert mindestens 80 beträgt. Bei einer und-Verknüpfung reicht eine falsche Seite aus, damit das Gesamtergebnis false ist."] },
        { heading: "Beispiel: Tamagotchi-Zustandsmaschine", paragraphs: ["Ein Tamagotchi verändert seinen Zustand durch Ereignisse. Der Worker bewertet nur die Übergänge; der Dispatcher kann danach optional eine Smartphone-Benachrichtigung zustellen."], stateChart: { title: "Tamagotchi – vereinfachte Zustände", states: [{ title: "Satt", initial: true }, { title: "Hungrig" }, { title: "Warnung" }], transitions: [{ from: "Satt", to: "Hungrig", when: "timer_tick und state.hunger >= 50" }, { from: "Hungrig", to: "Warnung", when: "timer_tick und state.hunger >= 80" }, { from: "Hungrig", to: "Satt", when: "event.type == fuettern" }, { from: "Warnung", to: "Satt", when: "event.type == fuettern" }] } },
        { heading: "UML-Statechart lesen", paragraphs: ["Der ausgefüllte Punkt ist der Start. Ab dort beginnt das Tamagotchi im Zustand satt. Abgerundete Rechtecke sind Zustände; genau einer davon ist als state.life_state gespeichert. Ein Pfeil ist ein erlaubter Übergang. Der Text am Pfeil wird als Ereignis [Bedingung] gelesen: timer_tick [hunger ≥ 50] bedeutet, dass das Ereignis timer_tick eingegangen sein muss und der deklarierte Wert state.hunger mindestens 50 beträgt. Bei Erreichen eines Zielzustands aktualisiert die Plattform state.life_state, zum Beispiel von satt auf hungrig. Der Worker darf keine anderen Zustände oder Variablen verwenden als die, die dieses Modell erklärt."], umlStateChart: true },
        { heading: "So wird das Diagramm als Variablenmodell abgebildet", paragraphs: ["Die Zustandsnamen aus dem Diagramm werden nicht frei im Ausdruck geschrieben. Das Projektmodell erklärt zunächst, welche Variablen es gibt. Nur diese Namen stehen dem Worker zur Verfügung."], table: { headers: ["Diagramm", "Deklarierte Zustandsvariable", "Erlaubte Werte"], rows: [["Satt, Hungrig, Warnung", "state.life_state", "satt, hungrig, warnung"], ["Hunger als Übergangsbedingung", "state.hunger", "0 bis 100"], ["Auslösendes Ereignis", "event.type", "timer_tick, fuettern"]] } },
        { heading: "Daraus abgeleitete Worker-Regel", paragraphs: ["Für den Übergang zur Warnung genügt ein einzelner, prüfbarer Regelausdruck. Ergibt er true, gibt die Plattform das Folgeereignis hunger_warnung frei. Der Nutzer schreibt dafür kein allgemeines JavaScript."], code: "event.type == \"timer_tick\" && state.hunger >= 80\n\n// Plattformwirkung bei true:\nfolgeereignis = \"hunger_warnung\"\n// Dispatcher kann dieses Ereignis optional per Push zustellen." },
        { heading: "Beispiele", code: "event.type == \"taste_gedrueckt\"\n\nevent.type == \"timer_tick\" && state.life_state == \"hungrig\"\n\nevent.type == \"fuettern\" || state.life_state == \"warnung\"" },
        { heading: "Klare Grenzen", list: ["Keine Schleifen und keine eigenen Funktionen", "Keine Netzwerk- oder Dateizugriffe", "Keine beliebigen Datenbankabfragen oder Speicherzugriffe", "Zeitplan, Zugriffsdauer und erlaubte Aktion werden außerhalb der Regel konfiguriert"] }
      ],
      relatedTopics: ["event-dispatcher", "first-project"],
    },
    "event-dispatcher": {
      title: "Ereignis-Dispatcher",
      summary: "Stelle ein vom Worker freigegebenes Folgeereignis an das konfigurierte Ziel zu.",
      sections: [
        { heading: "Aufgabe des Dispatchers", paragraphs: ["Der Dispatcher verarbeitet keine Rohdaten vom IoT-Gerät und führt keine Projektregel aus. Er prüft, ob ein freigegebenes Folgeereignis zu seiner Bedingung passt, und stellt es dann zu."] },
        { heading: "Was wird konfiguriert?", table: { headers: ["Konfiguration", "Bedeutung"], rows: [["Bedingung", "Zum Beispiel: Folgeereignis liegt vor oder ein Ereigniswert entspricht einem erwarteten Wert."], ["Zielgerät", "Ein IoT-Zielgerät aus demselben Projekt."], ["PWA-Push", "Optional: Benachrichtigt registrierte Smartphone-PWAs für genau dieses Projekt."]] } },
        { heading: "Dispatcher ist nicht Push", paragraphs: ["Push ist nur ein möglicher Zustellweg. Derselbe Dispatcher kann auch ein IoT-Zielgerät erreichen. Wird Push nicht aktiviert oder ist keine PWA registriert, bleibt die Ereignisverarbeitung davon unabhängig."] },
        { heading: "Beispiel", code: "Worker gibt frei: benachrichtigung_anfordern\nDispatcher-Bedingung: Folgeereignis liegt vor\nZiel: Smartphone-PWA dieses Projekts\nOptionaler Weg: Push-Benachrichtigung" }
      ],
      relatedTopics: ["event-worker-rules"],
    },
    "compatible-hardware": {
      title: "Kompatible Hardware",
      summary: "Alle bekannten ProcessorBoards aus dem GerNetiX Hardware Catalog mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        { heading: "Was bedeutet kompatibel?", paragraphs: ["Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt."] },
        { heading: "Provisionierung braucht einen USB-Host", list: ["Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.", "Auf dem Mac verbindet der lokal installierte GerNetiX Serial Service die Plattform mit dem Board. Alle Schritte bleiben in der GerNetiX-Oberfläche.", "iPhone, iPad und Android eignen sich für mobile Bedienung, aber nicht als verlässlicher USB-Host für die kabelgebundene Ersteinrichtung. Plane dafür einen PC oder Mac ein."] },
        { heading: "Kauf- und Herstellerlinks", paragraphs: ["Links werden pro Hardwareeintrag im Hardware Catalog gepflegt. GerNetiX bevorzugt neutrale Hersteller- oder Datenblattlinks statt wechselnder Händlerangebote. Ein Kauf bei Amazon oder einem anderen Händler ist möglich, solange die genaue Boardvariante zum Katalogeintrag passt; die Provisionierung bleibt dabei deine eigene Aufgabe."] },
        { heading: "GerNetiX-Webshop", paragraphs: ["Für diese Fälle entsteht ein GerNetiX-Webshop: Dort werden passende Boards und Hardware-Bundles zu einem Projekt angeboten. Ziel ist, die Hardware bereits mit der geeigneten Basissoftware und dem passenden Provisionierungsprofil bereitzustellen. Damit entfällt bei einem solchen Angebot der erste manuelle USB-Flash; die projektbezogene Einrichtung und das Pairing werden anschließend im geführten Ablauf abgeschlossen."] },
      ],
      relatedTopics: ["provision-new-board", "device-not-detected", "update-profiles"],
    },
    "esp32-overview": { title: "ESP32 overview", summary: "ESP32 boards combine a microcontroller with wireless connectivity for many GerNetiX projects.", sections: [{ heading: "A practical default", paragraphs: ["An ESP32 is a good choice for Wi-Fi projects with sensors, actuators and web-connected features. Select a concrete board in GerNetiX so available interfaces are known."] }], relatedTopics: ["esp32-s3", "esp32-c6", "supported-devices"] },
    "esp32-s3": { title: "ESP32-S3", summary: "The ESP32-S3 is particularly suitable for USB, displays and AI-adjacent applications.", sections: [{ heading: "When to choose it", paragraphs: ["Choose an ESP32-S3 when native USB or display-oriented projects matter. Check the selected board's exact memory and pin capabilities before building."] }], relatedTopics: ["esp32-c6", "supported-devices"] },
    "esp32-c6": { title: "ESP32-C6", summary: "The ESP32-C6 is an ESP32 variant for modern wireless-focused projects.", sections: [{ heading: "When to choose it", paragraphs: ["Choose an ESP32-C6 when its supported connectivity and board capabilities match your project. GerNetiX shows the compatible functions for the selected board."] }], relatedTopics: ["esp32-s3", "supported-devices"] },
    "device-not-detected": { title: "Device is not detected", summary: "Check the cable, the GerNetiX Serial Service and the selected connection method.", sections: [{ heading: "Quick checks", list: ["Use a USB data cable, not a charging-only cable.", "Reconnect the board and refresh the USB devices in GerNetiX.", "Use USB for a new board; Wi-Fi works only for a previously provisioned and reachable board.", "On macOS, install or repair the GerNetiX Serial Service from Downloads. It runs invisibly; continue in this GerNetiX window."] }], actions: [{ label: "Open downloads", route: "/app/downloads/" }], relatedTopics: ["register-device", "pair-device", "flash-device"] },
  };

  const articleAccess = {
    "first-project": "premium",
    "update-profiles": "premium",
    "provision-new-board": "account",
    "board-definition": "account",
    "register-device": "account",
    "pair-device": "account",
    "flash-device": "account",
    "usb-wifi-setup": "account",
    "supported-devices": "account",
    "event-worker-rules": "account",
    "event-dispatcher": "account",
    "compatible-hardware": "account",
    "device-not-detected": "account",
  };
  Object.entries(articleAccess).forEach(([articleId, access]) => {
    if (articles[articleId]) articles[articleId].access = access;
  });
  topics
    .filter((topic) => topic.surface === "knowledge")
    .flatMap((topic) => topic.children || [])
    .forEach((chapter) => {
      if (articles[chapter.articleId]) articles[chapter.articleId].access = chapter.access || "premium";
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
