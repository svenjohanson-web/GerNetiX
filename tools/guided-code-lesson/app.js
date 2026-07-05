const lessons = [
  createSoftwareEngineeringTamagotchiLesson(),
  createActuatorOutputBasicsLesson(),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.temperature_data_logger",
    projectVariantId: "variant.local_temperature_logger",
    slug: "temperature-data-logger",
    title: "Temperatur-Datenlogger",
    file: "temperature-data-logger.yaml",
    summary: "Sensorik verstehen: physikalische Temperatur wird elektrisch messbar, digitalisiert, kalibriert, gespeichert und als zeitlicher Verlauf sichtbar gemacht.",
    lines: [
      "Projektidee: Temperatur-Datenlogger",
      "Motivation: Temperaturverlauf in Raum, Keller, K�hlschrank oder Prozess verstehen.",
      "Systemgrenze: Temperatur -> Sensor -> elektrische Gr��e -> ADC/Digitalwert.",
      "Minimalaufbau: ein Temperatursensor, ein Mikrocontroller, eine Messroutine.",
      "Experiment: Rohwert lesen und in Temperatur umrechnen.",
      "Problem: Messabweichung, Wiederholgenauigkeit und Kalibrierung.",
      "Erweiterung: mehrere Sensoren, zentrale Visualisierung, Webserver oder Backend.",
      "Reflexion: Wann reicht ein lokaler Webserver, wann braucht man einen zentralen Server?",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum messen wir Temperatur?", "Die Anwendung macht klar, warum ein einzelner Messwert weniger wert ist als ein zeitlicher Verlauf.", [2]),
      step("02_system_boundary", "step_pattern.system_boundary", "Physikalisch zu elektrisch", "Die Temperatur wird nicht direkt verstanden, sondern �ber Sensorik in eine elektrische Gr��e �bersetzt.", [3]),
      step("03_minimal_setup", "step_pattern.minimal_local_function", "Ersten Sensor lesen", "Ein einzelner Sensor reicht, um die komplette Messkette einmal zu verstehen.", [4]),
      step("04_measurement_experiment", "step_pattern.parameter_experiment", "Rohwert und Temperatur vergleichen", "Der Lernende erkennt, dass Digitalwerte erst durch Umrechnung Bedeutung bekommen.", [5]),
      step("05_problem_accuracy", "step_pattern.problem_observation", "Messfehler sichtbar machen", "Genauigkeit, Toleranz und Wiederholbarkeit werden als echte technische Begriffe greifbar.", [6]),
      step("06_connected_extension", "step_pattern.variant_comparison", "Von einem Sensor zu vielen", "Mehrere Sensoren fuehren zur Architekturfrage: lokal, Master-Knoten oder Server.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Was kann daraus entstehen?", "Der Logger wird zur Grundlage f�r Regenfass, Klimabox, Monitoring und Home Assistant.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.connected_tamagotchi",
    projectVariantId: "variant.backend_authoritative_clients",
    slug: "connected-tamagotchi",
    title: "Connected Tamagotchi",
    file: "connected-tamagotchi.yaml",
    summary: "State Machines, Persistenz, Zeit, Backend-Logik und mehrere Clients an einem spielerischen System verstehen.",
    lines: [
      "Projektidee: Connected Tamagotchi",
      "Motivation: Ein virtuelles Wesen soll Zustand, Alter und Interaktionen behalten.",
      "Lokale Grenze: Nach Reset sind RAM-Zust�nde weg.",
      "Persistenz: Zustand wird dauerhaft gespeichert.",
      "Zeitproblem: Ohne RTC oder Netzwerkzeit altert das System nicht sinnvoll offline.",
      "Architekturwechsel: Logik wandert ins Backend, Clients senden nur Eingaben.",
      "Kommunikation: Client -> Server als Request, Server -> Clients als Broadcast/PubSub.",
      "Reflexion: Online-Synchronit�t gegen Offline-F�higkeit abw�gen.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Tamagotchi?", "Ein vertrautes Spiel macht State, Zeit und Persistenz konkret.", [2]),
      step("02_state_boundary", "step_pattern.system_boundary", "State geht verloren", "Reset und Stromausfall zeigen, warum RAM nicht reicht.", [3]),
      step("03_persistence", "step_pattern.solution_introduction", "Persistenz einf�hren", "Zustand wird als Datenmodell dauerhaft abgelegt.", [4]),
      step("04_time_problem", "step_pattern.problem_observation", "Zeit als Systemgrenze", "Ohne belastbare Zeitbasis kann Alterung nicht korrekt berechnet werden.", [5]),
      step("05_backend_logic", "step_pattern.solution_introduction", "Backend wird autoritativ", "Programmlogik zentralisieren reduziert Versions- und Nebenl�ufigkeitsprobleme.", [6]),
      step("06_communication", "step_pattern.variant_comparison", "Request und Broadcast trennen", "Client-Eingaben und Server-Updates bekommen unterschiedliche Kommunikationsmuster.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Online oder offline?", "Die Architekturentscheidung wird als Business- und Technikabw�gung sichtbar.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.plant_watering_control",
    projectVariantId: "variant.local_soil_moisture_pump_control",
    slug: "plant-watering-control",
    title: "Pflanzenbew�sserung",
    file: "plant-watering-control.yaml",
    summary: "Sensorwert und Aktor verbinden: Bodenfeuchtigkeit messen, Pumpe schalten, Fehlerf�lle und Sicherheitsgrenzen betrachten.",
    lines: [
      "Projektidee: Pflanzenbew�sserung",
      "Motivation: Eine Pflanze soll nicht austrocknen und das Wohnzimmer nicht geflutet werden.",
      "Sensorik: Feuchtigkeitssensor liefert einen Messwert.",
      "Aktorik: Pumpe wird digital ein- und ausgeschaltet.",
      "Einfache Steuerung: Wenn zu trocken, Pumpe an; wenn feucht genug, Pumpe aus.",
      "Problem: harte Kopplung f�hrt zu Flattern, Nachlauf und Grenzf�llen.",
      "Sicherheit: Sensorfehler, Laufzeitbegrenzung und Wasserstand beachten.",
      "Monitoring: Verlauf, Pumpenlaufzeit und Nachfuellmenge sichtbar machen.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Wof�r ist die Steuerung gut?", "Der Nutzen und das Risiko werden gleichzeitig sichtbar.", [2]),
      step("02_sensor", "step_pattern.system_boundary", "Feuchtigkeit messen", "Sensorwerte werden zur Eingangsseite der Steuerung.", [3]),
      step("03_actor", "step_pattern.minimal_local_function", "Pumpe schalten", "Die Pumpe ist die Ausgangsseite der Steuerung.", [4]),
      step("04_control", "step_pattern.observable_effect", "Erste Steuerlogik", "Ein einfacher Grenzwert koppelt Sensor und Aktor.", [5]),
      step("05_problem", "step_pattern.problem_observation", "Flattern und Nachlauf", "Das reale System verh�lt sich tr�ger als die if-Bedingung.", [6]),
      step("06_safety", "step_pattern.failure_safety_boundaries", "Fehlerf�lle begrenzen", "Sicherheit wird Teil der Funktion, nicht ein sp�ter Zusatz.", [7]),
      step("07_monitoring", "step_pattern.reflection_inspiration_sales_bridge", "Was wird sichtbar?", "Mess- und Pumpenverlauf bilden die Bruecke zu Logging und Connected-Projekten.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.climate_box_control",
    projectVariantId: "variant.local_climate_box_control",
    slug: "climate-box-control",
    title: "Klimabox regeln",
    file: "climate-box-control.yaml",
    summary: "Temperatursensoren, L�fter, Peltier-Element und Regelverhalten in einer kleinen kontrollierten Umgebung zusammenfuehren.",
    lines: [
      "Projektidee: Klimabox",
      "Motivation: kontrollierte Temperatur f�r Teig, Pflanzen, Tests oder Elektronik.",
      "Hardware: Box, mehrere Temperatursensoren, L�fter, Peltier-Element, Leistungsstufen.",
      "Erster Betrieb: Temperatur messen und L�fter schalten.",
      "Problem: Ein/Aus-Regelung erzeugt Schwingen und Verschlei�.",
      "Regelung: Stellgr��en, Schwellen, Hysterese und langsame Zyklen betrachten.",
      "Sicherheit: Thermoplastik, �berhitzung, Peltier-Schutz und Luftfuehrung beachten.",
      "Reflexion: Tr�ge Systeme brauchen andere Taktung als schnelle PWM-Aktoren.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Klimabox?", "Ein realer Zweck tr�gt die vielen technischen Bausteine zusammen.", [2]),
      step("02_hardware", "step_pattern.system_boundary", "Rollen der Hardware", "Sensoren, Aktoren und Leistungsstufen werden klar getrennt.", [3]),
      step("03_minimal", "step_pattern.minimal_local_function", "Messen und schalten", "Vor der Regelung steht die einfache Beobachtung und Aktion.", [4]),
      step("04_problem", "step_pattern.problem_observation", "Ein/Aus reicht nicht immer", "Schwingen und Verschlei� motivieren Hysterese und Regelung.", [5]),
      step("05_control", "step_pattern.solution_introduction", "Regelung einf�hren", "Stellgr��en und Tr�gheit bestimmen die L�sung.", [6]),
      step("06_safety", "step_pattern.failure_safety_boundaries", "Thermische Grenzen", "Mechanik, Material und Leistung werden Teil der Softwareanforderung.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Was ist anders als bei LED-PWM?", "Der Lernende erkennt den Unterschied zwischen schnellen und tr�gen Systemen.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.smartbox_rfid_access_control",
    projectVariantId: "variant.local_rfid_servo_lock",
    slug: "smartbox-rfid-access-control",
    title: "RFID Smartbox",
    file: "smartbox-rfid-access-control.yaml",
    summary: "RFID, Servo-Schloss, Chip-zu-Chip-Kommunikation sowie Identifizierung und Autorisierung an einer kleinen Box lernen.",
    lines: [
      "Projektidee: RFID Smartbox",
      "Motivation: Eine Box soll nur f�r berechtigte Tags �ffnen.",
      "Hardware: Mikrocontroller, RFID-Reader, RFID-Tag, Servo, Boxmechanik.",
      "Kommunikation: Mikrocontroller spricht mit dem RFID-Chip.",
      "Identifizierung: Wer ist dieses Tag?",
      "Autorisierung: Darf dieses Tag wirklich �ffnen oder schlie�en?",
      "Anlernen: Ein Tag wird lokal registriert und bekommt Rechte.",
      "Erweiterung: ESP32-Variante f�r Benachrichtigung oder Ereignisprotokoll.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Smartbox?", "Zugriffskontrolle wird als greifbares Objekt verstanden.", [2]),
      step("02_hardware", "step_pattern.system_boundary", "Bauteile und Rollen", "Reader, Tag, Servo und Controller bekommen klare Aufgaben.", [3]),
      step("03_chip_to_chip", "step_pattern.minimal_local_function", "RFID-Reader auslesen", "Chip-zu-Chip-Kommunikation wird als eigene Lernstufe sichtbar.", [4]),
      step("04_identification", "step_pattern.problem_observation", "Identit�t reicht nicht", "Ein erkanntes Tag ist noch keine Berechtigung.", [5]),
      step("05_authorization", "step_pattern.solution_introduction", "Rechte pruefen", "Autorisierung wird getrennt von Identifizierung modelliert.", [6]),
      step("06_enrollment", "step_pattern.observable_effect", "Tag anlernen", "Der Nutzer erzeugt lokal eine neue Berechtigung.", [7]),
      step("07_connected", "step_pattern.variant_comparison", "Wann braucht man ESP32?", "Benachrichtigung und Netzwerk werden als Variantenerweiterung eingeordnet.", [8]),
    ],
  }),
];

let lesson = lessons[0];
let currentStepIndex = 0;
let navigationHistory = [];
let isComplete = false;
let isWelcomeVisible = true;
let codeLines = [];
let isEditMode = false;

const lessonShell = document.querySelector(".lesson-shell");
const editor = document.querySelector("#editor");
const sidePanel = document.querySelector("#sidePanel");
const fileName = document.querySelector("#fileName");
const editorMode = document.querySelector("#editorMode");
const lineRuleBadge = document.querySelector("#lineRuleBadge");
const projectSelector = document.querySelector("#projectSelector");
const editModeButton = document.querySelector("#editModeButton");

applyStoredLessonEdits();
initProjectSelector();
selectInitialLesson();
render();

function createSoftwareEngineeringTamagotchiLesson() {
  return {
    projectIdeaId: "project_idea.cross_platform_tamagotchi",
    projectVariantId: "variant.model_first_runtime_choice",
    slug: "software-engineering-tamagotchi",
    title: "Software Engineering mit Tamagotchi",
    file: "tamagotchi-verhaltensmodell.yaml",
    welcome: {
      eyebrow: "Modellbasierte Entwicklung",
      title: "Tamagotchi als Software-Engineering-Projekt",
      text: "In diesem Projekt geht es nicht darum, sofort Code zu schreiben. Du lernst, wie ein fachliches Modell Verhalten beschreibt und wie daraus spaeter unterschiedliche Apps entstehen koennen.",
      topics: [
        "warum Quellcode fuer den Einstieg oft zu technisch ist",
        "wie Zustaende, Werte, Regeln und Aktionen als Modell beschrieben werden",
        "warum das Modell unabhaengig von Browser App und Embedded bleibt",
        "wann eine Browser App fuer den schnellen Einstieg sinnvoll ist",
        "welche Fragen spaeter durch Zeitsteuerung und Speichern entstehen",
      ],
      startLabel: "Tamagotchi-Lektion starten",
    },
    completionSummary: {
      eyebrow: "Lernrueckblick",
      title: "Was du im Tamagotchi-Projekt gelernt hast",
      text: "Du hast das Tamagotchi nicht zuerst als Code betrachtet, sondern als fachliches Modell. Dadurch wird sichtbar, warum modellbasierte Entwicklung hilft, Verhalten zu verstehen und spaeter fuer verschiedene Runtimes umzusetzen.",
      learned: [
        "Quellcode ist eine technische Umsetzung, aber nicht die beste erste Erklaerung fuer Verhalten.",
        "Ein Modell kann Zustaende, Werte, Regeln und Aktionen lesbar beschreiben.",
        "Browser App und Embedded sind unterschiedliche Ausfuehrungsformen desselben Modells.",
        "Die Browser App eignet sich fuer den schnellen Einstieg, zeigt aber auch Grenzen wie fehlende Persistenz.",
        "Die naechste Entwicklungsstufe ist eine zeitgesteuerte State-Machine mit gespeichertem Zustand.",
      ],
      next: "Als naechstes kann aus dem Modell eine einfache Browser App entstehen, danach folgen Tick-Logik und Speichern.",
    },
    learnerProfile: {
      boardKey: "unknown",
      selectedRuntime: "",
    },
    runtimeDefaults: {
      selectedRuntime: "",
    },
    boardProfiles: {
      unknown: { title: "Modellansicht" },
    },
    source: `Quellcode-Ausschnitt

void tamagotchi_tick(uint64_t now_us) {
  if (pet.life == TAMAGOTCHI_LIFE_DEAD) {
    return;
  }

  if (now_us - pet.last_fed_at_us >= ONE_DAY_US) {
    pet.life = TAMAGOTCHI_LIFE_DEAD;
    return;
  }

  if (pet.hunger < 50) {
    pet.alive_state = TAMAGOTCHI_ALIVE_SATIATED;
  } else {
    pet.alive_state = TAMAGOTCHI_ALIVE_HUNGRY;
  }
}

Tamagotchi Verhaltensmodell

problem:
  code_is_not_explanation: Quellcode zeigt Details, aber nicht sofort die Idee.

model:
  source_of_truth: Das Modell beschreibt das Verhalten.
  runtime_independent: Dasselbe Modell kann mehrere Runtime-Apps erzeugen.

states:
  life:
    initial: alive
    values:
      - alive
      - dead
  alive_substate:
    only_when: life == alive
    values:
      - hungry
      - satt

values:
  hunger:
    scale: 0..100
    initial: 55

rules:
  - if: hunger < 50
    then: alive_substate = satt
  - if: one_day_without_feeding
    then: life = dead

actions:
  feed:
    effect:
      hunger: 0
      last_fed_at: now

runtime_choice:
  question: Welche App soll aus dem Modell zuerst erzeugt werden?
  options:
    - browser_app
    - embedded

runtime_apps:
  browser_app:
    why_first: schnell sichtbar auf Mac, PC und Mobile
    advantage: keine Installation, kein Board, kein Flashen
    disadvantage: ohne Speichern ist beim Browser-Schliessen alles weg
  embedded:
    later: gleiches Modell, aber echte Hardware, Build, Flash, OTA und Geraetespeicher

next_lesson:
  from: event_driven_user_interactions
  to: time_driven_state_machine_with_persistence
`,
    steps: [
      {
        id: "step.tamagotchi_model.01_code_problem",
        flowItemId: "project_flow_item.tamagotchi_model.01",
        pattern: "step_pattern.motivation_problem",
        title: "Schau dir den Quellcode an",
        text:
          "Schau dir diesen Quellcode-Ausschnitt an. Verstehst du sofort, wann das Tamagotchi lebt, wann es hungrig oder satt ist und wann es stirbt?",
        outcome: "Der Lernende erlebt zuerst: Code enthaelt zwar die Logik, erklaert die fachliche Idee aber nicht gut.",
        focusLines: [1, 3, 4, 8, 9, 13, 14, 16],
        editableLines: [],
        completion: { type: "acknowledge", label: "Code angeschaut" },
      },
      {
        id: "step.tamagotchi_model.02_state_intro",
        flowItemId: "project_flow_item.tamagotchi_model.02",
        pattern: "step_pattern.state_introduction",
        title: "Einf�hrung in Zust�nde",
        text:
          "Quellcode ist fuer Maschinen gemacht. Menschen koennen ihn schreiben, aber fuer andere Personen ist er oft schwer nachvollziehbar. Menschen verstehen viele Dinge leichter, wenn sie sie zuerst als Zustaende betrachten. Eine Regentonne kann leer, halb voll oder voll sein. Ein Akku kann leer, halb voll oder voll sein.",
        outcome: "Der Lernende erkennt: Ein Objekt kann ueber einfache benannte Zustaende beschrieben werden.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Objekte in Zust�nden",
          rows: [
            {
              label: "Regentonne",
              states: [
                { label: "leer", kind: "barrel", level: 0 },
                { label: "halb voll", kind: "barrel", level: 50 },
                { label: "voll", kind: "barrel", level: 100 },
              ],
            },
            {
              label: "Akku",
              states: [
                { label: "leer", kind: "battery", level: 8 },
                { label: "halb voll", kind: "battery", level: 50 },
                { label: "voll", kind: "battery", level: 100 },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Zustaende gesehen" },
      },
      {
        id: "step.tamagotchi_model.03_state_categories",
        flowItemId: "project_flow_item.tamagotchi_model.03",
        pattern: "step_pattern.state_classification",
        title: "Einteilung von Zust�nden",
        text:
          "Am Bild aus Schritt 2 sieht man bereits eine Einteilung. Manche Zustaende sind direkt definiert, zum Beispiel an oder aus, vorhanden oder nicht vorhanden. Andere Eigenschaften sind fliessend und haben von sich aus keine klaren Stufen. Temperatur veraendert sich kontinuierlich. Punkte in einem Test koennen viele Werte haben. Damit Menschen trotzdem damit arbeiten koennen, teilen sie solche Werte in benannte Zustaende oder Klassen ein.",
        outcome: "Der Lernende unterscheidet direkte diskrete Zustaende von fliessenden Eigenschaften, die erst eingeteilt werden muessen.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Direkt definiert oder eingeteilt",
          rows: [
            {
              label: "Direkt definiert",
              description: "Der Zustand ist bereits klar getrennt.",
              states: [
                { label: "aus", kind: "label", value: "0" },
                { label: "an", kind: "label", value: "1" },
                { label: "vorhanden", kind: "label", value: "ja" },
              ],
            },
            {
              label: "Fliessend",
              description: "Der Wert veraendert sich kontinuierlich und wird erst spaeter klassifiziert.",
              states: [
                { label: "Temperatur", kind: "stone", tone: "warm", value: "0..100 Grad" },
                { label: "Punktzahl", kind: "label", value: "0..100" },
                { label: "Fuellstand", kind: "barrel", level: 50, value: "0..100 %" },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Einteilung verstanden" },
      },
      {
        id: "step.tamagotchi_model.04_discrete_states",
        flowItemId: "project_flow_item.tamagotchi_model.04",
        pattern: "step_pattern.discrete_state_intro",
        title: "Direkte diskrete Zust�nde",
        text:
          "Wenn ein Objekt nur klar getrennte Zustaende besitzt, kann man den Zustand direkt benennen. Eine Kaffeemaschine ist an oder aus. Ein Fernseher ist an oder aus. Etwas ist vorhanden oder nicht vorhanden. Hat ein System genau zwei Zustaende, nennt man es binaer. Binaer bedeutet: zwei.",
        outcome: "Der Lernende versteht: Diskrete Zustaende sind direkt unterscheidbar; bei zwei Zustaenden spricht man von binaer.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Diskrete Zust�nde",
          rows: [
            {
              label: "Kaffeemaschine",
              description: "Zwei klare Zustaende: binaer.",
              states: [
                { label: "aus", kind: "label", value: "0" },
                { label: "an", kind: "label", value: "1" },
              ],
            },
            {
              label: "Fernseher",
              description: "Auch hier ist der Zustand direkt unterscheidbar.",
              states: [
                { label: "aus", kind: "label", value: "0" },
                { label: "an", kind: "label", value: "1" },
              ],
            },
            {
              label: "Vorhandenheit",
              description: "Ein Objekt ist da oder nicht da.",
              states: [
                { label: "nicht vorhanden", kind: "label", value: "nein" },
                { label: "vorhanden", kind: "label", value: "ja" },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Diskrete Zustaende verstanden" },
      },
      {
        id: "step.tamagotchi_model.05_physical_property_rule",
        flowItemId: "project_flow_item.tamagotchi_model.05",
        pattern: "step_pattern.model_rule_introduction",
        title: "Aus Messwerten werden Zust�nde",
        text:
          "Wenn eine Eigenschaft fliessend ist, brauchen wir eine Messgroesse und Grenzen. Beim Stein ist die Messgroesse die Temperatur, zum Beispiel gemessen mit PT1000 oder IR-Sensor. Fuer das Modell reduzieren wir sie auf drei Zustaende: unter 10 Grad Celsius ist kalt, ab 10 Grad bis unter 55 Grad ist warm und ab 55 Grad ist heiss. Beim Fuellstand einer Regentonne kann der Messwert zum Beispiel ueber Reedkontakte, Kamera mit Bildverarbeitung oder einen Schwimmer mit Seillaenge erfasst werden. Beim Akku kann der Ladezustand vereinfacht ueber die Spannung erfasst werden: niedrige Spannung bedeutet leer, mittlere Spannung halb voll und hohe Spannung voll.",
        outcome: "Der Lernende erkennt: Aus einem kontinuierlichen Messwert werden durch Schwellen diskrete Zustaende abgeleitet.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Messwert, Schwelle und Zustand",
          rows: [
            {
              label: "Stein: Temperatur",
              description: "Messbar mit PT1000 oder IR-Sensor. Schwellen: unter 10 Grad kalt, ab 10 Grad warm, ab 55 Grad heiss.",
              states: [
                { label: "unter 10 Grad", kind: "stone", tone: "cold", value: "Zustand = kalt" },
                { label: "10 bis unter 55 Grad", kind: "stone", tone: "warm", value: "Zustand = warm" },
                { label: "ab 55 Grad", kind: "stone", tone: "hot", value: "Zustand = heiss" },
              ],
            },
            {
              label: "Regentonne: Fuellstand",
              description: "Erfassbar mit Reedkontakten, Kamera oder Schwimmer mit Seillaenge.",
              states: [
                { label: "niedrig", kind: "barrel", level: 10, value: "Zustand = leer" },
                { label: "mittel", kind: "barrel", level: 50, value: "Zustand = halb voll" },
                { label: "hoch", kind: "barrel", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Akku: Spannung",
              description: "Der Ladezustand kann vereinfacht ueber die Spannung erfasst werden.",
              states: [
                { label: "niedrige Spannung", kind: "battery", level: 8, value: "Zustand = leer" },
                { label: "mittlere Spannung", kind: "battery", level: 50, value: "Zustand = halb voll" },
                { label: "hohe Spannung", kind: "battery", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Notensystem: Punktzahl",
              description: "Eine Punktzahl wird durch Grenzen in eine Note von 1 bis 6 uebersetzt.",
              states: [
                { label: "wenige Punkte", kind: "label", value: "Note 6" },
                { label: "mittlere Punkte", kind: "label", value: "Note 3" },
                { label: "viele Punkte", kind: "label", value: "Note 1" },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Schwellen verstanden" },
      },
      {
        id: "step.tamagotchi_model.06_runtime_independent",
        flowItemId: "project_flow_item.tamagotchi_model.06",
        pattern: "step_pattern.runtime_independence",
        title: "Das Modell ist unabh�ngig von der Runtime",
        text:
          "Das Modell sagt nicht Browser App oder Embedded. Es beschreibt Verhalten. Daraus koennen verschiedene Runtime-Apps erzeugt werden.",
        outcome: "Runtime und Modell sind getrennt.",
        focusLines: [27, 57, 58, 62, 63, 67],
        editableLines: [],
        completion: { type: "acknowledge", label: "Runtime-Trennung verstanden" },
      },
      {
        id: "step.tamagotchi_model.07_runtime_choice",
        flowItemId: "project_flow_item.tamagotchi_model.07",
        pattern: "step_pattern.runtime_choice",
        title: "Browser App oder Embedded ausw�hlen",
        text:
          "Jetzt wird der Runtime-Pfad sichtbar entschieden. Fuer den schnellen Einstieg waehlen wir normalerweise die Browser App; Embedded bleibt derselbe fachliche Kern mit anderen technischen Randbedingungen.",
        outcome: "Der Lernende sieht: Eine Runtime ist eine Ausfuehrungsform des Modells, nicht das Modell selbst.",
        focusLines: [57, 58, 59, 60, 62, 63, 67],
        editableLines: [],
        decision: {
          type: "singleChoice",
          profileField: "selectedRuntime",
          title: "Runtime-Pfad",
          options: [
            { key: "browser_app", label: "Browser App", nextStepId: "step.tamagotchi_model.08_browser_first" },
            { key: "embedded", label: "Embedded", nextStepId: "step.tamagotchi_model.08_embedded_preview" },
          ],
        },
        completion: {
          type: "decisionRequired",
          label: "Runtime-Pfad wurde ausgewaehlt",
          resultSource: "selectedRuntime",
        },
      },
      {
        id: "step.tamagotchi_model.08_browser_first",
        flowItemId: "project_flow_item.tamagotchi_model.08_browser",
        pattern: "step_pattern.observable_effect",
        title: "Browser App zuerst erzeugen",
        text:
          "Die Browser App ist der schnellste Weg, das Modell sichtbar zu machen. Sie laeuft auf Mac, PC und Mobile ohne Board, ohne Flashen und ohne Installationshuerde.",
        outcome: "Die Browser App ist als erste erzeugte App eingeordnet.",
        focusLines: [62, 63, 64, 65, 66],
        editableLines: [],
        completion: { type: "acknowledge", label: "Browser-Pfad verstanden" },
        nextStepId: "step.tamagotchi_model.09_browser_limits",
      },
      {
        id: "step.tamagotchi_model.08_embedded_preview",
        flowItemId: "project_flow_item.tamagotchi_model.08_embedded",
        pattern: "step_pattern.variant_comparison",
        title: "Embedded ist derselbe Modellkern",
        text:
          "Embedded ist kein anderes Tamagotchi. Dasselbe Modell wird spaeter fuer Hardware, Build, Flash, OTA und Geraetespeicher erzeugt.",
        outcome: "Embedded ist als spaetere Runtime-Variante eingeordnet.",
        focusLines: [67, 68],
        editableLines: [],
        completion: { type: "acknowledge", label: "Embedded-Pfad eingeordnet" },
        nextStepId: "step.tamagotchi_model.11_next_runtime_apps",
      },
      {
        id: "step.tamagotchi_model.09_browser_limits",
        flowItemId: "project_flow_item.tamagotchi_model.09",
        pattern: "step_pattern.problem_observation",
        title: "Vorteile und Nachteile sichtbar machen",
        text:
          "Die erste Browser App darf einfach sein: Benutzer klickt, Zustand aendert sich. Wenn nichts gespeichert wird, ist nach dem Schliessen alles weg.",
        outcome: "Der Nachteil der ersten Browser-Version motiviert Persistenz.",
        focusLines: [64, 65, 66, 71, 72],
        editableLines: [],
        completion: { type: "acknowledge", label: "Grenze erkannt" },
      },
      {
        id: "step.tamagotchi_model.10_time_and_persistence",
        flowItemId: "project_flow_item.tamagotchi_model.10",
        pattern: "step_pattern.solution_introduction",
        title: "Naechste Lektion: Zeit und Speichern",
        text:
          "Danach wechseln wir von reinen Benutzerinteraktionen zu einer zeitgesteuerten State-Machine und speichern Modell/Zustand.",
        outcome: "Die naechste Lernstufe ist vorbereitet: Tick, State-Machine und Persistenz.",
        focusLines: [71, 72],
        editableLines: [],
        completion: { type: "acknowledge", label: "Naechste Lektion verstanden" },
      },
      {
        id: "step.tamagotchi_model.11_next_runtime_apps",
        flowItemId: "project_flow_item.tamagotchi_model.11",
        pattern: "step_pattern.reflection_inspiration_sales_bridge",
        title: "Weitere Apps aus demselben Modell",
        text:
          "Die Browser App ist nur der erste sichtbare Pfad. Danach kann dasselbe Modell in weitere Runtime-Apps uebertragen werden, inklusive Embedded.",
        outcome: "Die langfristige Idee ist sichtbar: Modell zuerst, Runtime danach.",
        focusLines: [27, 59, 60, 62, 67],
        editableLines: [],
        completion: { type: "acknowledge", label: "Runtime-Idee verstanden" },
      },    ],
  };
}
function createActuatorOutputBasicsLesson() {
  return {
    projectIdeaId: "project_idea.actuator_output_basics",
    projectVariantId: "variant.basic_gpio_pwm_node",
    slug: "actuator-output-basics",
    title: "Aktorik-Schnupperkurs: LED verstehen",
    file: "blink.ino",
    welcome: {
      eyebrow: "Aktorik verstehen",
      title: "LED als erster sichtbarer Ausgang",
      text: "In diesem Projekt lernst du, wie Software einen elektrischen Ausgang steuert und daraus eine sichtbare Wirkung entsteht.",
      topics: [
        "welche Rolle ein Mikrocontroller-Pin spielt",
        "wie ein Ausgang vorbereitet wird",
        "wie ein sichtbares Signal entsteht",
        "warum Zeitverhalten fuer Aktoren wichtig wird",
      ],
      startLabel: "Aktorik-Lektion starten",
    },
    completionSummary: {
      eyebrow: "Lernrueckblick",
      title: "Was du im Aktorik-Projekt gelernt hast",
      text: "Du hast eine LED nicht nur blinken lassen, sondern die Grenze zwischen Software, Mikrocontroller-Pin und sichtbarer Wirkung verstanden.",
      learned: [
        "Ein GPIO-Pin ist die elektrische Schnittstelle zwischen Software und Hardware.",
        "Ein Ausgang muss vorbereitet werden, bevor Software ihn aktiv schalten kann.",
        "Parameter wie Wartezeiten veraendern sichtbares Verhalten, ohne die Grundlogik zu ersetzen.",
        "Blockierendes Warten motiviert spaeter Timer, PWM und nebenlaeufige Ablaufe.",
      ],
      next: "Aus dieser Grundlage koennen spaeter Buzzer, Motoren, PWM und vernetzte Steuerungen entstehen.",
    },
    learnerProfile: {
      boardKey: "esp32_devkit_v1",
    },
    boardProfiles: {
      esp32_devkit_v1: {
        title: "ESP32 DevKit V1",
        defaultLedPin: 2,
      },
      unknown: {
        title: "Unbekanntes Board",
        defaultLedPin: null,
      },
    },
    source:
      "#include <Arduino.h>\n\nconst int LED_PIN = 2;\nconst int BLINK_DELAY_MS = 1000;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  delay(BLINK_DELAY_MS);\n  digitalWrite(LED_PIN, LOW);\n  delay(BLINK_DELAY_MS);\n}\n",
    steps: [
      {
        id: "step.actuator_output_basics.01_system_boundary",
        flowItemId: "project_flow_item.actuator_output_basics.01",
        pattern: "step_pattern.system_boundary",
        title: "Systemgrenze sichtbar machen",
        text:
          "Der Mikrocontroller ver�ndert nicht direkt die Welt. Er setzt ein elektrisches Signal an einem Pin. Die angeschlossene LED macht daraus eine sichtbare Wirkung.",
        outcome: "Der Pin wird als Grenze zwischen Software und Hardware verstanden.",
        focusLines: [3],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.02_pin_definition",
        flowItemId: "project_flow_item.actuator_output_basics.02",
        pattern: "step_pattern.guided_code_walkthrough",
        title: "Den verwendeten Pin benennen",
        text:
          "Diese Zeile legt fest, welcher GPIO f�r die LED benutzt wird. Wenn dein Board-Profil bekannt ist, validieren wir gegen dessen hinterlegten LED-Pin. Sonst reicht eine plausible Pin-Zahl.",
        outcome: "Der Lernende erkennt die Verbindung zwischen Board-Profil, Board-Pin und Code-Konstante.",
        focusLines: [3],
        editableLines: [3],
        validation: {
          type: "knownBoardPinOrIntegerRange",
          line: 3,
          label: "LED_PIN",
          min: 0,
          max: 8,
          profileField: "boardKey",
          knownBoardPins: {
            esp32_devkit_v1: 2,
          },
        },
      },
      {
        id: "step.actuator_output_basics.03_output_mode",
        flowItemId: "project_flow_item.actuator_output_basics.03",
        pattern: "step_pattern.minimal_local_function",
        title: "Pin als Ausgang konfigurieren",
        text:
          "Im setup wird der Pin als Ausgang deklariert. Erst dadurch darf die Software den elektrischen Zustand aktiv setzen.",
        outcome: "Input und Output werden als unterschiedliche Rollen eines Pins verstanden.",
        focusLines: [7],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.04_first_blink",
        flowItemId: "project_flow_item.actuator_output_basics.04",
        pattern: "step_pattern.observable_effect",
        title: "High, Pause, Low, Pause",
        text:
          "Der loop setzt den Pin auf HIGH, wartet, setzt ihn auf LOW und wartet wieder. Daraus entsteht das Blinkmuster.",
        outcome: "Ein zeitlicher Programmablauf wird als sichtbares Hardwareverhalten gelesen.",
        focusLines: [11, 12, 13, 14],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.05_parameter_experiment",
        flowItemId: "project_flow_item.actuator_output_basics.05",
        pattern: "step_pattern.parameter_experiment",
        title: "Blinkgeschwindigkeit �ndern",
        text:
          "�ndere die Wartezeit von 1000 ms auf 500 ms. Danach blinkt die LED schneller, ohne dass sich die eigentliche Schaltlogik �ndert.",
        outcome: "Ein Parameter wird als Stellgr��e f�r beobachtbares Verhalten verstanden.",
        focusLines: [4, 12, 14],
        editableLines: [4],
        expectedContains: "BLINK_DELAY_MS = 500",
      },
      {
        id: "step.actuator_output_basics.06_problem_cpu_busy",
        flowItemId: "project_flow_item.actuator_output_basics.06",
        pattern: "step_pattern.problem_observation",
        title: "Das Delay blockiert die CPU",
        text:
          "Die LED blinkt, aber die CPU verbringt die Zeit im Warten. Genau hier entsteht die Frage, warum Peripherieeinheiten wie Timer und PWM n�tzlich sind.",
        outcome: "Die Grenze der naiven Delay-L�sung wird als echtes technisches Problem sichtbar.",
        focusLines: [12, 14],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.07_solution_pwm",
        flowItemId: "project_flow_item.actuator_output_basics.07",
        pattern: "step_pattern.solution_introduction",
        title: "PWM als Entlastung einf�hren",
        text:
          "PWM wird vorkonfiguriert und erzeugt das periodische Signal in Hardware. Die Software muss sp�ter nur noch Werte wie das Tastverh�ltnis �ndern.",
        outcome: "PWM wird nicht als Zauberfunktion, sondern als ausgelagerte zeitkritische Arbeit verstanden.",
        focusLines: [11, 12, 13, 14],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.08_reflection",
        flowItemId: "project_flow_item.actuator_output_basics.08",
        pattern: "step_pattern.reflection_inspiration_sales_bridge",
        title: "Was wurde wirklich gelernt?",
        text:
          "Du hast nicht nur eine LED blinken lassen. Du hast Systemgrenzen, Parameter, zeitliches Verhalten und den Grund f�r PWM kennengelernt. Das ist die Basis f�r Buzzer, Motoren und sp�ter Webserver-Steuerung.",
        outcome: "Der Schnupperkurs endet mit Transfer auf weitere Aktoren und Connected-Projekte.",
        focusLines: [3, 4, 7, 11, 12, 13, 14],
        editableLines: [],
      },
    ],
  };
}

function createIdeaPreviewLesson(config) {
  return {
    ...config,
    welcome: config.welcome || createDefaultWelcome(config),
    source: `${config.lines.join("\n")}\n`,
    learnerProfile: { boardKey: "unknown" },
    boardProfiles: { unknown: { title: "Nicht relevant f�r diese Vorschau" } },
  };
}

function createDefaultWelcome(config) {
  return {
    eyebrow: "Projektidee",
    title: config.title,
    text: config.summary || "In diesem Projekt lernst du die fachliche Idee, die Systemgrenzen und die naechsten technischen Fragen kennen.",
    topics: (config.lines || [])
      .filter((line) => !line.startsWith("Projektidee:"))
      .slice(0, 4),
    startLabel: "Projekt starten",
  };
}
function step(idSuffix, pattern, title, outcome, focusLines) {
  return {
    id: `step.${idSuffix}`,
    flowItemId: `project_flow_item.${idSuffix}`,
    pattern,
    title,
    text: outcome,
    outcome,
    focusLines,
    editableLines: [],
  };
}

function initProjectSelector() {
  projectSelector.innerHTML = lessons
    .map((item) => `<option value="${item.slug}">${item.title}</option>`)
    .join("");
  projectSelector.addEventListener("change", () => selectLesson(projectSelector.value, true));
  editModeButton.addEventListener("click", toggleEditMode);
}

function selectInitialLesson() {
  const params = new URLSearchParams(window.location.search);
  selectLesson(params.get("project") || lessons[0].slug, false);
}

function selectLesson(slug, updateUrl) {
  lesson = lessons.find((item) => item.slug === slug) || lessons[0];
  projectSelector.value = lesson.slug;
  currentStepIndex = 0;
  navigationHistory = [];
  isComplete = false;
  isWelcomeVisible = true;
  resetLessonRuntimeState(lesson);
  codeLines = lesson.source.replace(/\n$/, "").split("\n");

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("project", lesson.slug);
    window.history.replaceState({}, "", url);
  }

  render();
}

function resetLessonRuntimeState(lessonItem) {
  lessonItem.learnerProfile = {
    ...(lessonItem.learnerProfile || {}),
    ...(lessonItem.runtimeDefaults || {}),
  };
}

function currentStep() {
  return lesson.steps[currentStepIndex];
}

function render() {
  lessonShell.classList.toggle("welcome-mode", isWelcomeVisible);

  if (isWelcomeVisible) {
    renderWelcome();
    return;
  }

  fileName.textContent = lesson.file;
  renderEditor();
  renderPanel();
}

function renderWelcome() {
  const welcome = lesson.welcome || createDefaultWelcome(lesson);
  sidePanel.innerHTML = `
    <div class="welcome-panel">
      <p class="step-kicker">${escapeHtml(welcome.eyebrow || "Projektstart")}</p>
      <h2>${escapeHtml(welcome.title || lesson.title)}</h2>
      <p class="welcome-text">${escapeHtml(welcome.text || "Hier beginnt das Lernprojekt.")}</p>
      ${renderWelcomeTopics(welcome.topics)}
      <label class="welcome-project-select">Projektidee
        <select data-action="select-welcome-project">
          ${lessons.map((item) => `<option value="${escapeAttribute(item.slug)}" ${item.slug === lesson.slug ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
        </select>
      </label>
      <div class="panel-spacer"></div>
      <div class="actions single-action">
        <button type="button" class="primary" data-action="start-lesson">${escapeHtml(welcome.startLabel || "Lektion starten")}</button>
      </div>
    </div>
  `;
  wirePanelButtons();
}

function renderWelcomeTopics(topics) {
  if (!topics?.length) return "";
  return `
    <section class="welcome-topics" aria-label="Lerninhalte">
      <h3>Was wir lernen werden</h3>
      <ul>${topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ul>
    </section>
  `;
}

function renderEditor() {
  const step = currentStep();

  if (!isComplete && step.visual) {
    renderVisualStage(step);
    return;
  }

  editor.classList.remove("visual-mode");
  const focusLines = new Set(isComplete ? [] : step.focusLines);
  const editableLines = new Set(isComplete ? codeLines.map((_, index) => index + 1) : step.editableLines);

  editor.classList.toggle("complete", isComplete);
  editor.innerHTML = "";

  codeLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const isEditable = editableLines.has(lineNumber);
    const row = document.createElement("div");
    row.className = [
      "code-line",
      isEditable ? "editable" : "readonly",
      focusLines.has(lineNumber) ? "focus" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const number = document.createElement("div");
    number.className = "code-line-number";
    number.textContent = lineNumber;

    const text = document.createElement("div");
    text.className = "code-text";
    text.textContent = line || " ";
    text.dataset.line = String(lineNumber);
    text.contentEditable = String(isEditable);
    text.spellcheck = false;
    text.addEventListener("keydown", handleLineKeydown);
    text.addEventListener("input", handleLineInput);
    text.addEventListener("paste", handlePaste);

    row.append(number, text);
    editor.append(row);
  });

  editorMode.textContent = isComplete
    ? "Abschlussansicht"
    : `${lesson.projectIdeaId} / ${currentStep().flowItemId}`;
  lineRuleBadge.textContent = isComplete
    ? "Alle Zeilen frei sichtbar"
    : renderEditableLineLabel(currentStep());
}

function renderVisualStage(step) {
  editor.classList.remove("complete");
  editor.classList.add("visual-mode");
  fileName.textContent = step.visual.title || step.title;
  editorMode.textContent = "Bildfolge statt Code";
  lineRuleBadge.textContent = "Visualisierung";
  editor.innerHTML = `
    <div class="state-visual-stage">
      <h2>${escapeHtml(step.visual.title || step.title)}</h2>
      <div class="state-visual-rows">
        ${step.visual.rows.map(renderVisualRow).join("")}
      </div>
    </div>
  `;
}

function renderVisualRow(row) {
  return `
    <section class="state-visual-row">
      <h3>${escapeHtml(row.label)}</h3>
      ${row.description ? `<p>${escapeHtml(row.description)}</p>` : ""}
      <div class="state-sequence">
        ${row.states.map(renderVisualState).join("")}
      </div>
    </section>
  `;
}

function renderVisualState(state) {
  const value = state.value ? `<span class="state-value">${escapeHtml(state.value)}</span>` : "";
  return `
    <article class="state-card">
      ${renderStatePicture(state)}
      <strong>${escapeHtml(state.label)}</strong>
      ${value}
    </article>
  `;
}

function renderStatePicture(state) {
  if (state.kind === "barrel") {
    return `<div class="picture barrel"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "battery") {
    return `<div class="picture battery"><span style="width: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "label") {
    return `<div class="picture label-state"><span>${escapeHtml(state.value || state.label)}</span></div>`;
  }

  return `<div class="picture stone ${escapeAttribute(state.tone || "warm")}"><span></span></div>`;
}
function renderEditableLineLabel(stepItem) {
  if (stepItem.editableLines.length === 0) {
    return "Nur erkl�ren";
  }

  return `Editierbar: Zeile${stepItem.editableLines.length > 1 ? "n" : ""} ${stepItem.editableLines.join(", ")}`;
}

function renderPanel() {
  if (isComplete) {
    const summary = createCompletionSummary(lesson);
    sidePanel.innerHTML = `
      <p class="step-kicker">${escapeHtml(summary.eyebrow || "Lernrueckblick")}</p>
      <h2>${escapeHtml(summary.title || lesson.title)}</h2>
      <p class="complete-note">${escapeHtml(summary.text)}</p>
      ${renderSummaryList(summary.learned)}
      ${summary.next ? `<div class="next-box"><strong>Naechster Schritt:</strong> ${escapeHtml(summary.next)}</div>` : ""}
      <div class="meta-box">
        <span>${escapeHtml(lesson.projectIdeaId)}</span>
        <span>${escapeHtml(lesson.projectVariantId)}</span>
      </div>
      <div class="panel-spacer"></div>
      <div class="actions">
        <button type="button" data-action="back">Zur�ck</button>
        <button type="button" class="primary" data-action="restart">Neu starten</button>
      </div>
    `;
    wirePanelButtons();
    return;
  }

  const stepItem = currentStep();
  const validationState = getValidationState(stepItem);

  sidePanel.innerHTML = `
    <p class="step-kicker">${stepItem.pattern}</p>
    <h2>${lesson.title}</h2>
    <h3>${stepItem.title}</h3>
    <p class="step-text">${stepItem.text}</p>
    ${renderStepMedia(stepItem)}
    ${renderDecisionControl(stepItem)}
    ${renderCompletionCondition(stepItem, validationState)}
    ${renderValidation(validationState)}
    ${renderAuthoringEditor(stepItem)}
    <div class="panel-spacer"></div>
    <p class="step-progress">Schritt ${currentStepIndex + 1} von ${lesson.steps.length}</p>
    <div class="actions">
      <button type="button" data-action="back" ${currentStepIndex === 0 ? "disabled" : ""}>Zur�ck</button>
      <button type="button" class="primary" data-action="next" ${validationState.canContinue ? "" : "disabled"}>${currentStepIndex === lesson.steps.length - 1 ? "Abschlie�en" : "Weiter"}</button>
    </div>
    <div class="outcome-box secondary-info"><strong>Ergebnis:</strong> ${stepItem.outcome}</div>
    <div class="meta-box secondary-info">
      <span>${stepItem.id}</span>
      <span>${stepItem.flowItemId}</span>
      <span>${renderBoardProfileLabel()}</span>
    </div>
  `;
  wirePanelButtons();
  wireAuthoringInputs(stepItem);
}

function createCompletionSummary(lessonItem) {
  if (lessonItem.completionSummary) return lessonItem.completionSummary;

  return {
    eyebrow: "Lernrueckblick",
    title: `Was du in ${lessonItem.title} gelernt hast`,
    text: "Die Lektion ist abgeschlossen. Du hast die wichtigsten Beobachtungen Schritt fuer Schritt aufgebaut.",
    learned: lessonItem.steps
      .map((stepItem) => stepItem.outcome)
      .filter(Boolean)
      .slice(0, 5),
    next: "Von hier aus kann die Projektidee vertieft oder in eine konkrete Umsetzung ueberfuehrt werden.",
  };
}

function renderSummaryList(items) {
  if (!items?.length) return "";
  return `
    <section class="summary-list" aria-label="Gelernt">
      <h3>Das hast du gelernt</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}
function renderStepMedia(stepItem) {
  if (!stepItem.media?.imageSrc) return "";
  return `
    <figure class="step-media">
      <img src="${escapeAttribute(stepItem.media.imageSrc)}" alt="${escapeAttribute(stepItem.media.imageAlt || "Step-Bild")}">
      ${stepItem.media.imageAlt ? `<figcaption>${escapeHtml(stepItem.media.imageAlt)}</figcaption>` : ""}
    </figure>
  `;
}

function renderDecisionControl(stepItem) {
  if (stepItem.decision?.type !== "singleChoice") return "";

  const field = stepItem.decision.profileField;
  const selected = lesson.learnerProfile?.[field] || "";
  const buttons = stepItem.decision.options
    .map((option) => {
      const isActive = option.key === selected;
      return `<button type="button" class="${isActive ? "active" : ""}" data-action="select-decision" data-field="${escapeAttribute(field)}" data-value="${escapeAttribute(option.key)}">${escapeHtml(option.label)}</button>`;
    })
    .join("");

  return `
    <div class="decision-box">
      <strong>${escapeHtml(stepItem.decision.title || "Entscheidung")}</strong>
      <div class="decision-options">${buttons}</div>
    </div>
  `;
}

function renderCompletionCondition(stepItem, validationState) {
  if (!stepItem.completion) return "";

  const result = resolveCompletionResult(stepItem);
  const resultLabel = stepItem.completion.type === "acknowledge"
    ? "erf�llt"
    : result ? renderDecisionResultLabel(stepItem, result) : "offen";

  return `
    <div class="completion-box ${validationState.canContinue ? "ok" : "blocked"}">
      <strong>Abschlussbedingung:</strong> ${escapeHtml(stepItem.completion.label)}
      <span>Ergebnis: ${escapeHtml(resultLabel)}</span>
    </div>
  `;
}

function renderDecisionResultLabel(stepItem, result) {
  const option = stepItem.decision?.options?.find((item) => item.key === result);
  return option?.label || result;
}

function renderAuthoringEditor(stepItem) {
  if (!isEditMode) return "";
  return `
    <div class="authoring-box">
      <label>Titel<input data-field="title" value="${escapeAttribute(stepItem.title)}"></label>
      <label>Text<textarea data-field="text">${escapeHtml(stepItem.text)}</textarea></label>
      <label>Ergebnis<textarea data-field="outcome">${escapeHtml(stepItem.outcome)}</textarea></label>
      <label>Bildpfad oder URL<input data-field="imageSrc" value="${escapeAttribute(stepItem.media?.imageSrc || "")}"></label>
      <label>Bildbeschreibung<input data-field="imageAlt" value="${escapeAttribute(stepItem.media?.imageAlt || "")}"></label>
      <label>Bilddatei<input data-field="imageFile" type="file" accept="image/*"></label>
      <button type="button" class="primary full" data-action="save-step">Step speichern</button>
    </div>
  `;
}

function renderValidation(validationState) {
  if (!validationState.message) {
    return "";
  }

  return `<div class="validation ${validationState.canContinue ? "ok" : "blocked"}">${validationState.message}</div>`;
}

function getValidationState(stepItem) {
  if (stepItem.completion?.type === "decisionRequired") {
    const result = resolveCompletionResult(stepItem);
    return {
      canContinue: Boolean(result),
      message: result
        ? `Abschlussbedingung erf�llt: ${stepItem.completion.label}.`
        : `Weiter geht es, sobald die Abschlussbedingung erf�llt ist: ${stepItem.completion.label}.`,
    };
  }

  if (stepItem.validation?.type === "knownBoardPinOrIntegerRange") {
    return validateKnownBoardPinOrIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "integerRange") {
    return validateIntegerRange(stepItem.validation);
  }

  if (!stepItem.expectedContains) {
    return {
      canContinue: true,
      message: stepItem.completion?.label ? `Abschlussbedingung: ${stepItem.completion.label}.` : "",
    };
  }

  const code = codeLines.join("\n");
  const found = code.includes(stepItem.expectedContains);

  return {
    canContinue: found,
    message: found
      ? `Validierung erf�llt: ${stepItem.expectedContains}`
      : `Weiter geht es, sobald der Code ${stepItem.expectedContains} enth�lt.`,
  };
}

function validateKnownBoardPinOrIntegerRange(rule) {
  const boardKey = lesson.learnerProfile?.[rule.profileField];
  const expectedPin = boardKey ? rule.knownBoardPins?.[boardKey] : undefined;
  const parsed = parseIntegerAssignment(rule);

  if (!parsed.found) {
    return {
      canContinue: false,
      message: `${rule.label} muss als ganze Zahl zugewiesen werden, zum Beispiel ${rule.label} = ${expectedPin ?? rule.min};`,
    };
  }

  if (expectedPin !== undefined) {
    return validateKnownBoardPin(rule, parsed.value, boardKey, expectedPin);
  }

  return validateIntegerRangeValue(rule, parsed.value);
}

function validateKnownBoardPin(rule, value, boardKey, expectedPin) {
  const profile = lesson.boardProfiles?.[boardKey];
  const boardTitle = profile?.title || boardKey;
  const isExpected = value === expectedPin;

  return {
    canContinue: isExpected,
    message: isExpected
      ? `Validierung erf�llt: F�r ${boardTitle} ist ${rule.label} = ${expectedPin} hinterlegt.`
      : `Dein Profil kennt ${boardTitle}. Daf�r muss ${rule.label} auf ${expectedPin} stehen. Aktueller Wert: ${value}.`,
  };
}

function validateIntegerRange(rule) {
  const parsed = parseIntegerAssignment(rule);

  if (!parsed.found) {
    return {
      canContinue: false,
      message: `${rule.label} muss als ganze Zahl zugewiesen werden, zum Beispiel ${rule.label} = ${rule.min};`,
    };
  }

  return validateIntegerRangeValue(rule, parsed.value);
}

function validateIntegerRangeValue(rule, value) {
  const inRange = Number.isInteger(value) && value >= rule.min && value <= rule.max;

  return {
    canContinue: inRange,
    message: inRange
      ? `Validierung erf�llt: ${rule.label} liegt im Bereich ${rule.min}..${rule.max}.`
      : `${rule.label} muss zwischen ${rule.min} und ${rule.max} liegen. Aktueller Wert: ${value}.`,
  };
}

function parseIntegerAssignment(rule) {
  const line = codeLines[rule.line - 1] || "";
  const match = line.match(/=\s*(-?\d+)\s*;/);

  return {
    found: Boolean(match),
    value: match ? Number(match[1]) : null,
  };
}

function renderBoardProfileLabel() {
  const boardKey = lesson.learnerProfile?.boardKey || "unknown";
  const profile = lesson.boardProfiles?.[boardKey];
  return `Board-Profil: ${profile?.title || boardKey}`;
}

function wirePanelButtons() {
  sidePanel.querySelectorAll("select[data-action=\"select-welcome-project\"]").forEach((select) => {
    select.addEventListener("change", () => selectLesson(select.value, true));
  });

  sidePanel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "back") {
        goBack();
      }

      if (action === "next") {
        goNext();
      }

      if (action === "start-lesson") {
        isWelcomeVisible = false;
        render();
      }

      if (action === "save-step") {
        saveCurrentStepEdits();
      }

      if (action === "select-decision") {
        selectDecisionOption(button.dataset.field, button.dataset.value);
      }

      if (action === "restart") {
        currentStepIndex = 0;
        navigationHistory = [];
        isComplete = false;
        isWelcomeVisible = true;
        resetLessonRuntimeState(lesson);
        codeLines = lesson.source.replace(/\n$/, "").split("\n");
        render();
      }
    });
  });
}

function wireAuthoringInputs(stepItem) {
  sidePanel.querySelectorAll(".authoring-box [data-field]").forEach((field) => {
    if (field.type === "file") return;

    field.addEventListener("input", () => {
      if (field.dataset.field === "title") {
        stepItem.title = field.value;
      }

      if (field.dataset.field === "text") {
        stepItem.text = field.value;
      }

      if (field.dataset.field === "outcome") {
        stepItem.outcome = field.value;
      }

      if (field.dataset.field === "imageSrc" || field.dataset.field === "imageAlt") {
        const imageSrc = sidePanel.querySelector('[data-field="imageSrc"]')?.value.trim() || "";
        const imageAlt = sidePanel.querySelector('[data-field="imageAlt"]')?.value.trim() || "";
        stepItem.media = imageSrc ? { imageSrc, imageAlt } : undefined;
      }
    });
  });
}

function selectDecisionOption(field, value) {
  if (!field) return;
  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [field]: value,
  };
  render();
}

function goBack() {
  if (!isComplete && currentStepIndex === 0 && navigationHistory.length === 0) {
    isWelcomeVisible = true;
    render();
    return;
  }

  if (isComplete) {
    isComplete = false;
    render();
    return;
  }

  currentStepIndex = navigationHistory.length > 0
    ? navigationHistory.pop()
    : Math.max(0, currentStepIndex - 1);
  render();
}

function goNext() {
  if (!getValidationState(currentStep()).canContinue) {
    return;
  }

  const nextStepIndex = resolveNextStepIndex(currentStep());

  if (nextStepIndex === null) {
    isComplete = true;
  } else {
    navigationHistory.push(currentStepIndex);
    currentStepIndex = nextStepIndex;
  }

  render();
}

function resolveNextStepIndex(stepItem) {
  const result = resolveCompletionResult(stepItem);
  const decisionNextStepId = stepItem.decision?.options?.find((option) => option.key === result)?.nextStepId;
  const nextStepId = decisionNextStepId || stepItem.completion?.nextStepId || stepItem.nextStepId;

  if (nextStepId) {
    const foundIndex = lesson.steps.findIndex((item) => item.id === nextStepId);
    if (foundIndex >= 0) return foundIndex;
  }

  if (currentStepIndex === lesson.steps.length - 1) {
    return null;
  }

  return currentStepIndex + 1;
}

function resolveCompletionResult(stepItem) {
  const source = stepItem.completion?.resultSource;
  return source ? lesson.learnerProfile?.[source] || "" : "";
}

function handleLineKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

function handlePaste(event) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
  document.execCommand("insertText", false, text);
}

function handleLineInput(event) {
  const lineNumber = Number(event.currentTarget.dataset.line);
  const allowed = isComplete || currentStep().editableLines.includes(lineNumber);

  if (!allowed) {
    event.currentTarget.textContent = codeLines[lineNumber - 1] || " ";
    return;
  }

  codeLines[lineNumber - 1] = event.currentTarget.textContent.replace(/\u00a0/g, " ");
  renderPanel();
}



function toggleEditMode() {
  isEditMode = !isEditMode;
  editModeButton.classList.toggle("active", isEditMode);
  editModeButton.textContent = isEditMode ? "Vorschau" : "Bearbeiten";
  render();
}

function saveCurrentStepEdits() {
  const stepItem = currentStep();
  const title = sidePanel.querySelector('[data-field="title"]')?.value ?? stepItem.title;
  const text = sidePanel.querySelector('[data-field="text"]')?.value ?? stepItem.text;
  const outcome = sidePanel.querySelector('[data-field="outcome"]')?.value ?? stepItem.outcome;
  const imageSrc = sidePanel.querySelector('[data-field="imageSrc"]')?.value.trim() || "";
  const imageAlt = sidePanel.querySelector('[data-field="imageAlt"]')?.value.trim() || "";
  const file = sidePanel.querySelector('[data-field="imageFile"]')?.files?.[0];

  const apply = (finalImageSrc) => {
    stepItem.title = title;
    stepItem.text = text;
    stepItem.outcome = outcome;
    stepItem.media = finalImageSrc ? { imageSrc: finalImageSrc, imageAlt } : undefined;
    persistLessonEdits();
    render();
  };

  if (!file) {
    apply(imageSrc);
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => apply(String(reader.result || "")));
  reader.readAsDataURL(file);
}

function persistLessonEdits() {
  const payload = {
    steps: Object.fromEntries(lesson.steps.map((stepItem) => [
      stepItem.id,
      {
        title: stepItem.title,
        text: stepItem.text,
        outcome: stepItem.outcome,
        media: stepItem.media || null,
      },
    ])),
  };
  localStorage.setItem(storageKey(lesson.slug), JSON.stringify(payload));
}

function applyStoredLessonEdits() {
  for (const lessonItem of lessons) {
    const raw = localStorage.getItem(storageKey(lessonItem.slug));
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      for (const stepItem of lessonItem.steps) {
        const stored = payload.steps?.[stepItem.id];
        if (!stored) continue;
        stepItem.title = stored.title ?? stepItem.title;
        stepItem.text = stored.text ?? stepItem.text;
        stepItem.outcome = stored.outcome ?? stepItem.outcome;
        stepItem.media = stored.media || undefined;
      }
    } catch {
      localStorage.removeItem(storageKey(lessonItem.slug));
    }
  }
}

function storageKey(slug) {
  return `gernetix.guided-code-lesson.${slug}.authoring`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}


