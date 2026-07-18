const HelpContent = (() => {
  const topics = [
    {
      id: "public-information",
      title: "Öffentliche Informationen",
      description: "GerNetiX kennenlernen, Hardware einschätzen und den Einstieg planen.",
      access: "public",
      children: [
        { id: "quick-start", title: "So startest du", articleId: "quick-start" },
        { id: "create-account", title: "Konto anlegen", articleId: "create-account" },
        { id: "ai-premium", title: "KI-Unterstuetzung und Premium", articleId: "ai-premium" },
      ],
    },
    {
      id: "hardware-basics",
      title: "Hardware verstehen",
      description: "Prozessorfamilien einordnen, bevor du ein konkretes Board auswaehlst.",
      access: "public",
      children: [
        { id: "processor-overview", title: "ESP32-Prozessorfamilien im Vergleich", articleId: "processor-overview" },
      ],
    },
    {
      id: "account-access",
      title: "Konto und Zugang",
      description: "Gastzugang, dauerhaftes Konto, Anmeldung, Wiederherstellung und Angebote verstehen.",
      access: "public",
      children: [
        { id: "account-types", title: "Kontotypen und Zugangsstufen", articleId: "account-types" },
        { id: "registration-login-recovery", title: "Registrierung, Anmeldung und Wiederherstellung", articleId: "registration-login-recovery" },
        { id: "entitlements-and-tokens", title: "Premium, Entitlements und Token", articleId: "entitlements-and-tokens" },
      ],
    },
    {
      id: "account-information",
      title: "Mit GerNetiX-Konto",
      description: "Board einrichten, registrieren und dein Inventar nutzen.",
      access: "account",
      children: [{ id: "provision-new-board", title: "Neues Board in Betrieb nehmen", articleId: "provision-new-board" }, { id: "register-device", title: "Board registrieren", articleId: "register-device" }, { id: "pair-device", title: "Board verbinden", articleId: "pair-device" }, { id: "flash-device", title: "Board flashen", articleId: "flash-device" }, { id: "usb-wifi-setup", title: "WLAN per USB einrichten", articleId: "usb-wifi-setup" }, { id: "supported-devices", title: "Unterstützte Boards", articleId: "supported-devices" }, { id: "device-not-detected", title: "Board wird nicht erkannt", articleId: "device-not-detected" }],
    },
    {
      id: "project-support",
      title: "Unterstützung bei Projekten",
      description: "Komponenten verstehen und für dein eigenes Projekt konfigurieren.",
      access: "account",
      children: [
        { id: "event-worker-rules", title: "Ereignis-Worker und Regelsprache", articleId: "event-worker-rules" },
        { id: "event-dispatcher", title: "Ereignis-Dispatcher", articleId: "event-dispatcher" }
      ],
    },
    {
      id: "premium-information",
      title: "Premium-Abo",
      description: "Geführte Projekte, vertiefende Anleitungen und Projektwissen.",
      access: "premium",
      children: [
        { id: "first-project", title: "Erstes Projekt umsetzen", articleId: "first-project" },
        { id: "update-profiles", title: "Update- und Speicherprofile", articleId: "update-profiles" },
      ],
    },
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
    "account-types": {
      title: "Kontotypen und Zugangsstufen",
      summary: "GerNetiX trennt einen kurzlebigen Einstieg von einem dauerhaften Konto. Erweiterungen sind keine eigenen Konten, sondern klar benannte Berechtigungen.",
      sections: [
        { heading: "Das geplante Zielbild", paragraphs: ["Diese Regeln werden derzeit vorbereitet. Bis sie in der Plattform verfuegbar sind, zeigt GerNetiX bei einer Funktion immer die aktuell wirksame Freischaltung an."] },
        { heading: "Die Zugangsstufen", table: { headers: ["Begriff", "Zweck", "Regeln"], rows: [
          ["Gastzugang", "Unverbindlich ausprobieren", "1 MB; endet nach 24 Stunden; keine Wiederherstellung."],
          ["Passkey-Konto", "Dauerhaft lernen und eigene Projekte speichern", "Passkey ist Pflicht; persoenliches Offline-Recovery-Set, Social Recovery und ESP32-Recovery-Token sind freiwillige Zusatzwege. Derzeit als Zielwert 5 MB; Loeschung erst nach konfigurierbarer Inaktivitaet."],
          ["Konto mit ESP32-Recovery-Token", "Zusaetzliche Wiederherstellung und hoehere Ressourcen", "Bis zu drei aktive Boards; Zielwert 10 MB und laengere Inaktivitaetsfrist."],
          ["Premium-Entitlement", "Zusaetzliche Inhalte und Dienste", "Kein eigener Kontotyp. Es erweitert ein bestehendes Konto fuer eine Laufzeit oder als bezahlte Leistung."],
        ] } },
        { heading: "Wichtig", paragraphs: ["Ein ESP32-Recovery-Token ist ein Board zur Wiederherstellung. Ein Kampagnen-Premium-Token ist dagegen ein einmal einloesbarer Gutschein. Beide Begriffe beschreiben unterschiedliche Dinge."] },
      ],
      relatedTopics: ["registration-login-recovery", "entitlements-and-tokens"],
    },
    "registration-login-recovery": {
      title: "Registrierung, Anmeldung und Wiederherstellung",
      summary: "So wird aus einem Gastzugang ein dauerhaftes Konto – ohne verpflichtende E-Mail-Adresse.",
      sections: [
        { heading: "Konto anlegen", list: ["Lege einen Spitznamen fest.", "Richte einen Passkey auf deinem Smartphone, Computer oder Sicherheitsschluessel ein. Er ist der verpflichtende Login für das dauerhafte Konto.", "Danach ist das Konto sofort nutzbar; weitere Absicherungen sind nicht Teil des Einstiegs."] },
        { heading: "Konto einrichten abschließen", paragraphs: ["Auf dem Dashboard findest du anschließend die Kachel Konto einrichten abschließen. Dort kannst du in Ruhe erklären lassen und freiwillig ein persönliches Offline-Recovery-Set, ESP32-Recovery-Token oder später Social Recovery ergänzen."] },
        { heading: "Anmelden", paragraphs: ["Das geplante Passkey-Konto kann sich mit Passwort oder Passkey anmelden. Ein Passkey bestaetigt lokal auf deinem Geraet, zum Beispiel mit PIN, Fingerabdruck oder Gesicht. Diese lokalen Daten werden nicht an GerNetiX uebertragen."] },
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
      relatedTopics: ["account-types", "registration-login-recovery", "ai-premium", "event-worker-rules", "event-dispatcher"],
    },
    "ai-premium": {
      title: "KI-Unterstuetzung und Premium",
      summary: "Die KI-Chats sind derzeit ein Bestandteil des Premium-Abos.",
      sections: [
        { heading: "Warum ist die KI kostenpflichtig?", paragraphs: ["GerNetiX nutzt fuer einzelne KI-Aufgaben externe KI-Anbieter. Dadurch entstehen je nach Anfrage laufende Kosten. Damit diese Kosten planbar bleiben und der Dienst nicht missbraucht wird, sind die KI-Chats aktuell nur mit Premium verfuegbar."] },
        { heading: "Unser Ausblick", paragraphs: ["Wir pruefen fortlaufend kostenguenstigere und lokale Loesungen. Unser Ziel ist, moeglichst viele KI-Funktionen spaeter auch Nutzerinnen und Nutzern mit kostenlosem Abo anbieten zu koennen."] },
      ],
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
      actions: [{ label: "Unterstuetzte Boards ansehen", route: "/app/help/#supported-devices" }],
      relatedTopics: ["supported-devices", "provision-new-board", "update-profiles"],
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
      title: "Unterstützte Boards",
      summary: "Eine Sammlung aller aktiven Boards aus dem GerNetiX Hardware Catalog – mit Fähigkeiten, Prüfstatus und Beschaffungsinformationen.",
      hardwareCatalog: true,
      sections: [
        { heading: "Die Sammlung", paragraphs: ["Jede Karte steht für eine konkrete unterstützte Boardvariante. Die Liste ist keine Sammlung eigener Hilfethemen: Eigenschaften, Schnittstellen und Hinweise stehen direkt bei dem Board."] },
        { heading: "Was bedeutet unterstützt?", paragraphs: ["Ein Katalogeintrag beschreibt die bekannte Boardfamilie, ihre Schnittstellen und den vorgesehenen GerNetiX-Provisionierungsweg. Erst nach USB-Flash, Registrierung und Pairing wird ein konkretes gekauftes Board als GerNetiX-verified geführt. Prüfe vor dem Kauf immer die vollständige Modulbezeichnung, Flash-Größe, USB-Datenanschluss und bei Sonderboards das Datenblatt."] },
        { heading: "Ersteinrichtung", list: ["Ein neues Board wird über ein USB-Datenkabel geflasht und provisioniert; ein reines Ladekabel reicht nicht.", "Für die browsergestützte USB-Provisionierung nutze einen PC oder Mac mit einem Chromium-Browser.", "iPhone und iPad eignen sich für die PWA, Push und Bedienung, aber nicht für Web Serial."] },
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

  const articleAccess = {
    "first-project": "premium",
    "update-profiles": "premium",
    "provision-new-board": "account",
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
