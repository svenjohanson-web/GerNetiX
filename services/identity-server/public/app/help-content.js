const HelpContent = (() => {
  const topics = [
    {
      id: "getting-started",
      title: "Getting Started",
      description: "Your first project and the platform basics.",
      children: [
        { id: "quick-start", title: "How to get started", articleId: "quick-start" },
        { id: "create-account", title: "Create an account", articleId: "create-account" },
        { id: "first-project", title: "Start your first project", articleId: "first-project" },
      ],
    },
    {
      id: "account",
      title: "Account and Registration",
      description: "Sign in, registration and account access.",
      children: [{ id: "create-account-link", title: "Create an account", articleId: "create-account" }],
    },
    {
      id: "devices",
      title: "Devices",
      description: "Register, pair and flash a board.",
      children: [
        { id: "provision-new-board", title: "Neues Board in Betrieb nehmen", articleId: "provision-new-board" },
        { id: "register-device", title: "Register a device", articleId: "register-device" },
        { id: "pair-device", title: "Pair a device", articleId: "pair-device" },
        { id: "flash-device", title: "Flash a device", articleId: "flash-device" },
      { id: "usb-wifi-setup", title: "WLAN per USB einrichten", articleId: "usb-wifi-setup" },
      { id: "update-profiles", title: "Update- und Speicherprofile", articleId: "update-profiles" },
      { id: "supported-devices", title: "Supported devices", articleId: "supported-devices" },
      { id: "compatible-hardware", title: "Kompatible Hardware", articleId: "compatible-hardware" },
      ],
    },
    { id: "hardware", title: "Hardware", description: "Boards, sensors and actuators.", children: [
      { id: "esp32-overview", title: "ESP32 overview", articleId: "esp32-overview" },
      { id: "esp32-s3", title: "ESP32-S3", articleId: "esp32-s3" },
      { id: "esp32-c6", title: "ESP32-C6", articleId: "esp32-c6" },
      { id: "arduino-overview", title: "Arduino overview" },
      { id: "sensors-actuators", title: "Sensors and actuators" },
    ] },
    { id: "programming", title: "Programming", description: "Core programming concepts.", children: [
      { id: "variables", title: "Variables" }, { id: "functions", title: "Functions" }, { id: "gpio", title: "GPIO" }, { id: "pwm", title: "PWM" }, { id: "interrupts", title: "Interrupts" },
    ] },
    { id: "communication", title: "Communication", description: "How devices exchange data.", children: [
      { id: "wifi", title: "Wi-Fi" }, { id: "bluetooth", title: "Bluetooth" }, { id: "mqtt", title: "MQTT" }, { id: "http", title: "HTTP" }, { id: "rest", title: "REST" },
    ] },
    { id: "electronics", title: "Electronics", description: "Electrical basics for connected projects.", children: [
      { id: "voltage", title: "Voltage and current" }, { id: "breadboard", title: "Using a breadboard" },
    ] },
    { id: "troubleshooting", title: "Troubleshooting", description: "Common setup and connection issues.", children: [
      { id: "device-not-detected", title: "Device is not detected", articleId: "device-not-detected" },
      { id: "pairing-failed", title: "Pairing failed", articleId: "pair-device" },
      { id: "flashing-failed", title: "Flashing failed", articleId: "flash-device" },
      { id: "wifi-failed", title: "Wi-Fi connection failed" },
    ] },
  ];

  const articles = {
    "quick-start": {
      title: "How to get started",
      summary: "Start with a learning project or turn your own idea into a GerNetiX project.",
      sections: [
        { heading: "Your first project", list: [
          "Choose the Learning Platform for a guided project, or Development Platform for your own idea.",
          "Create a project from a template or start with an empty project and describe its goal.",
          "Clarify the architecture, choose compatible hardware, then continue in the IDE.",
          "Register and pair a new board in Device Management before you build and flash.",
        ] },
        { heading: "What comes next?", paragraphs: ["Learning lessons teach a project step by step. Help articles stay short and searchable when you need to look something up."] },
      ],
      actions: [{ label: "Start a development project", route: "/app/development-platform/" }, { label: "Start a learning project", route: "/app/learn/" }],
      relatedTopics: ["register-device", "pair-device"],
    },
    "create-account": {
      title: "Create an account",
      summary: "Create one GerNetiX account to use projects, learning progress and your devices together.",
      sections: [{ heading: "Registration", paragraphs: ["Use the account creation form and confirm the required terms. After signing in, GerNetiX keeps projects, progress and registered devices connected to your account."] }],
      relatedTopics: ["quick-start", "register-device"],
    },
    "first-project": {
      title: "Start your first project",
      summary: "Choose a template when you want a starting point, or begin with a blank development project.",
      sections: [{ heading: "Choose a path", paragraphs: ["Templates give you a structure to adapt. A blank project is useful when you already know what you want to build."], code: "// Your project source is managed in the GerNetiX IDE.\nvoid setup() {\n}\n\nvoid loop() {\n}" }],
      relatedTopics: ["quick-start", "supported-devices"],
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
      title: "Flash a device",
      summary: "Flash writes GerNetiX base software or your project build to a board through the browser USB connection.",
      sections: [{ heading: "Before flashing", list: ["Use a data-capable USB cable.", "Allow the browser to access the serial port.", "Keep the board connected until GerNetiX reports the result."], code: "// Flashing is started from GerNetiX.\n// Do not disconnect the board while a flash is running." }],
      relatedTopics: ["register-device", "device-not-detected"],
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
      title: "Supported devices",
      summary: "GerNetiX guides board selection from the hardware catalog and its available capabilities.",
      sections: [{ heading: "Choosing a board", paragraphs: ["Choose a board with the interfaces and memory your project needs. ESP32 boards are a strong starting point for Wi-Fi-connected projects."], links: [{ topicId: "esp32-overview", label: "ESP32 overview" }, { topicId: "esp32-s3", label: "ESP32-S3" }, { topicId: "esp32-c6", label: "ESP32-C6" }] }],
      relatedTopics: ["esp32-overview", "esp32-s3", "esp32-c6"],
    },
    "compatible-hardware": {
      title: "Kompatible Hardware",
      summary: "Alle bekannten ProcessorBoards aus dem GerNetiX Hardware Catalog mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        { heading: "Was bedeutet kompatibel?", paragraphs: ["Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt."] },
        { heading: "Provisionierung braucht einen USB-Host", list: ["Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.", "Für die browsergestützte USB-Provisionierung nutze einen PC oder Mac mit einem Chromium-Browser. iPhone und iPad eignen sich für die PWA, Push und Bedienung, aber nicht für Web Serial.", "Android ist für kabelgebundenes Web Serial kein verlässlicher Provisionierungsweg. Plane für die erste Inbetriebnahme einen PC oder Mac ein."] },
        { heading: "Kauf- und Herstellerlinks", paragraphs: ["Links werden pro Hardwareeintrag im Hardware Catalog gepflegt. GerNetiX bevorzugt neutrale Hersteller- oder Datenblattlinks statt wechselnder Händlerangebote. Ein Kauf bei Amazon oder einem anderen Händler ist möglich, solange die genaue Boardvariante zum Katalogeintrag passt; die Provisionierung bleibt dabei deine eigene Aufgabe."] },
        { heading: "GerNetiX-Webshop", paragraphs: ["Für diese Fälle entsteht ein GerNetiX-Webshop: Dort werden passende Boards und Hardware-Bundles zu einem Projekt angeboten. Ziel ist, die Hardware bereits mit der geeigneten Basissoftware und dem passenden Provisionierungsprofil bereitzustellen. Damit entfällt bei einem solchen Angebot der erste manuelle USB-Flash; die projektbezogene Einrichtung und das Pairing werden anschließend im geführten Ablauf abgeschlossen."] },
      ],
      relatedTopics: ["provision-new-board", "device-not-detected", "update-profiles"],
    },
    "esp32-overview": { title: "ESP32 overview", summary: "ESP32 boards combine a microcontroller with wireless connectivity for many GerNetiX projects.", sections: [{ heading: "A practical default", paragraphs: ["An ESP32 is a good choice for Wi-Fi projects with sensors, actuators and web-connected features. Select a concrete board in GerNetiX so available interfaces are known."] }], relatedTopics: ["esp32-s3", "esp32-c6", "supported-devices"] },
    "esp32-s3": { title: "ESP32-S3", summary: "The ESP32-S3 is particularly suitable for USB, displays and AI-adjacent applications.", sections: [{ heading: "When to choose it", paragraphs: ["Choose an ESP32-S3 when native USB or display-oriented projects matter. Check the selected board's exact memory and pin capabilities before building."] }], relatedTopics: ["esp32-c6", "supported-devices"] },
    "esp32-c6": { title: "ESP32-C6", summary: "The ESP32-C6 is an ESP32 variant for modern wireless-focused projects.", sections: [{ heading: "When to choose it", paragraphs: ["Choose an ESP32-C6 when its supported connectivity and board capabilities match your project. GerNetiX shows the compatible functions for the selected board."] }], relatedTopics: ["esp32-s3", "supported-devices"] },
    "device-not-detected": { title: "Device is not detected", summary: "Check the cable, browser permission and the selected connection method.", sections: [{ heading: "Quick checks", list: ["Use a USB data cable, not a charging-only cable.", "Reconnect the board and choose its serial port in the browser permission dialog.", "Use USB for a new board; Wi-Fi works only for a previously provisioned and reachable board.", "If your browser does not support Web Serial, use the GerNetiX USB Serial Helper."] }], actions: [{ label: "Open downloads", route: "/app/downloads/" }], relatedTopics: ["register-device", "pair-device", "flash-device"] },
  };

  function findTopic(topicId) {
    for (const topic of topics) {
      if (topic.id === topicId) return topic;
      const child = topic.children?.find((item) => item.id === topicId);
      if (child) return child;
    }
    return null;
  }

  return { topics, articles, findTopic };
})();
