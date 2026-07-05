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
      "Motivation: Temperaturverlauf in Raum, Keller, Kühlschrank oder Prozess verstehen.",
      "Systemgrenze: Temperatur -> Sensor -> elektrische Größe -> ADC/Digitalwert.",
      "Minimalaufbau: ein Temperatursensor, ein Mikrocontroller, eine Messroutine.",
      "Experiment: Rohwert lesen und in Temperatur umrechnen.",
      "Problem: Messabweichung, Wiederholgenauigkeit und Kalibrierung.",
      "Erweiterung: mehrere Sensoren, zentrale Visualisierung, Webserver oder Backend.",
      "Reflexion: Wann reicht ein lokaler Webserver, wann braucht man einen zentralen Server?",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum messen wir Temperatur?", "Die Anwendung macht klar, warum ein einzelner Messwert weniger wert ist als ein zeitlicher Verlauf.", [2]),
      step("02_system_boundary", "step_pattern.system_boundary", "Physikalisch zu elektrisch", "Die Temperatur wird nicht direkt verstanden, sondern über Sensorik in eine elektrische Größe übersetzt.", [3]),
      step("03_minimal_setup", "step_pattern.minimal_local_function", "Ersten Sensor lesen", "Ein einzelner Sensor reicht, um die komplette Messkette einmal zu verstehen.", [4]),
      step("04_measurement_experiment", "step_pattern.parameter_experiment", "Rohwert und Temperatur vergleichen", "Der Lernende erkennt, dass Digitalwerte erst durch Umrechnung Bedeutung bekommen.", [5]),
      step("05_problem_accuracy", "step_pattern.problem_observation", "Messfehler sichtbar machen", "Genauigkeit, Toleranz und Wiederholbarkeit werden als echte technische Begriffe greifbar.", [6]),
      step("06_connected_extension", "step_pattern.variant_comparison", "Von einem Sensor zu vielen", "Mehrere Sensoren führen zur Architekturfrage: lokal, Master-Knoten oder Server.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Was kann daraus entstehen?", "Der Logger wird zur Grundlage für Regenfass, Klimabox, Monitoring und Home Assistant.", [8]),
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
      "Lokale Grenze: Nach Reset sind RAM-Zustände weg.",
      "Persistenz: Zustand wird dauerhaft gespeichert.",
      "Zeitproblem: Ohne RTC oder Netzwerkzeit altert das System nicht sinnvoll offline.",
      "Architekturwechsel: Logik wandert ins Backend, Clients senden nur Eingaben.",
      "Kommunikation: Client -> Server als Request, Server -> Clients als Broadcast/PubSub.",
      "Reflexion: Online-Synchronität gegen Offline-Fähigkeit abwägen.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Tamagotchi?", "Ein vertrautes Spiel macht State, Zeit und Persistenz konkret.", [2]),
      step("02_state_boundary", "step_pattern.system_boundary", "State geht verloren", "Reset und Stromausfall zeigen, warum RAM nicht reicht.", [3]),
      step("03_persistence", "step_pattern.solution_introduction", "Persistenz einführen", "Zustand wird als Datenmodell dauerhaft abgelegt.", [4]),
      step("04_time_problem", "step_pattern.problem_observation", "Zeit als Systemgrenze", "Ohne belastbare Zeitbasis kann Alterung nicht korrekt berechnet werden.", [5]),
      step("05_backend_logic", "step_pattern.solution_introduction", "Backend wird autoritativ", "Programmlogik zentralisieren reduziert Versions- und Nebenläufigkeitsprobleme.", [6]),
      step("06_communication", "step_pattern.variant_comparison", "Request und Broadcast trennen", "Client-Eingaben und Server-Updates bekommen unterschiedliche Kommunikationsmuster.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Online oder offline?", "Die Architekturentscheidung wird als Business- und Technikabwägung sichtbar.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.plant_watering_control",
    projectVariantId: "variant.local_soil_moisture_pump_control",
    slug: "plant-watering-control",
    title: "Pflanzenbewässerung",
    file: "plant-watering-control.yaml",
    summary: "Sensorwert und Aktor verbinden: Bodenfeuchtigkeit messen, Pumpe schalten, Fehlerfälle und Sicherheitsgrenzen betrachten.",
    lines: [
      "Projektidee: Pflanzenbewässerung",
      "Motivation: Eine Pflanze soll nicht austrocknen und das Wohnzimmer nicht geflutet werden.",
      "Sensorik: Feuchtigkeitssensor liefert einen Messwert.",
      "Aktorik: Pumpe wird digital ein- und ausgeschaltet.",
      "Einfache Steuerung: Wenn zu trocken, Pumpe an; wenn feucht genug, Pumpe aus.",
      "Problem: harte Kopplung führt zu Flattern, Nachlauf und Grenzfällen.",
      "Sicherheit: Sensorfehler, Laufzeitbegrenzung und Wasserstand beachten.",
      "Monitoring: Verlauf, Pumpenlaufzeit und Nachfüllmenge sichtbar machen.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Wofür ist die Steuerung gut?", "Der Nutzen und das Risiko werden gleichzeitig sichtbar.", [2]),
      step("02_sensor", "step_pattern.system_boundary", "Feuchtigkeit messen", "Sensorwerte werden zur Eingangsseite der Steuerung.", [3]),
      step("03_actor", "step_pattern.minimal_local_function", "Pumpe schalten", "Die Pumpe ist die Ausgangsseite der Steuerung.", [4]),
      step("04_control", "step_pattern.observable_effect", "Erste Steuerlogik", "Ein einfacher Grenzwert koppelt Sensor und Aktor.", [5]),
      step("05_problem", "step_pattern.problem_observation", "Flattern und Nachlauf", "Das reale System verhält sich träger als die if-Bedingung.", [6]),
      step("06_safety", "step_pattern.failure_safety_boundaries", "Fehlerfälle begrenzen", "Sicherheit wird Teil der Funktion, nicht ein später Zusatz.", [7]),
      step("07_monitoring", "step_pattern.reflection_inspiration_sales_bridge", "Was wird sichtbar?", "Mess- und Pumpenverlauf bilden die Brücke zu Logging und Connected-Projekten.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.climate_box_control",
    projectVariantId: "variant.local_climate_box_control",
    slug: "climate-box-control",
    title: "Klimabox regeln",
    file: "climate-box-control.yaml",
    summary: "Temperatursensoren, Lüfter, Peltier-Element und Regelverhalten in einer kleinen kontrollierten Umgebung zusammenführen.",
    lines: [
      "Projektidee: Klimabox",
      "Motivation: kontrollierte Temperatur für Teig, Pflanzen, Tests oder Elektronik.",
      "Hardware: Box, mehrere Temperatursensoren, Lüfter, Peltier-Element, Leistungsstufen.",
      "Erster Betrieb: Temperatur messen und Lüfter schalten.",
      "Problem: Ein/Aus-Regelung erzeugt Schwingen und Verschleiß.",
      "Regelung: Stellgrößen, Schwellen, Hysterese und langsame Zyklen betrachten.",
      "Sicherheit: Thermoplastik, Überhitzung, Peltier-Schutz und Luftführung beachten.",
      "Reflexion: Träge Systeme brauchen andere Taktung als schnelle PWM-Aktoren.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Klimabox?", "Ein realer Zweck trägt die vielen technischen Bausteine zusammen.", [2]),
      step("02_hardware", "step_pattern.system_boundary", "Rollen der Hardware", "Sensoren, Aktoren und Leistungsstufen werden klar getrennt.", [3]),
      step("03_minimal", "step_pattern.minimal_local_function", "Messen und schalten", "Vor der Regelung steht die einfache Beobachtung und Aktion.", [4]),
      step("04_problem", "step_pattern.problem_observation", "Ein/Aus reicht nicht immer", "Schwingen und Verschleiß motivieren Hysterese und Regelung.", [5]),
      step("05_control", "step_pattern.solution_introduction", "Regelung einführen", "Stellgrößen und Trägheit bestimmen die Lösung.", [6]),
      step("06_safety", "step_pattern.failure_safety_boundaries", "Thermische Grenzen", "Mechanik, Material und Leistung werden Teil der Softwareanforderung.", [7]),
      step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Was ist anders als bei LED-PWM?", "Der Lernende erkennt den Unterschied zwischen schnellen und trägen Systemen.", [8]),
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
      "Motivation: Eine Box soll nur für berechtigte Tags öffnen.",
      "Hardware: Mikrocontroller, RFID-Reader, RFID-Tag, Servo, Boxmechanik.",
      "Kommunikation: Mikrocontroller spricht mit dem RFID-Chip.",
      "Identifizierung: Wer ist dieses Tag?",
      "Autorisierung: Darf dieses Tag wirklich öffnen oder schließen?",
      "Anlernen: Ein Tag wird lokal registriert und bekommt Rechte.",
      "Erweiterung: ESP32-Variante für Benachrichtigung oder Ereignisprotokoll.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Warum Smartbox?", "Zugriffskontrolle wird als greifbares Objekt verstanden.", [2]),
      step("02_hardware", "step_pattern.system_boundary", "Bauteile und Rollen", "Reader, Tag, Servo und Controller bekommen klare Aufgaben.", [3]),
      step("03_chip_to_chip", "step_pattern.minimal_local_function", "RFID-Reader auslesen", "Chip-zu-Chip-Kommunikation wird als eigene Lernstufe sichtbar.", [4]),
      step("04_identification", "step_pattern.problem_observation", "Identität reicht nicht", "Ein erkanntes Tag ist noch keine Berechtigung.", [5]),
      step("05_authorization", "step_pattern.solution_introduction", "Rechte prüfen", "Autorisierung wird getrennt von Identifizierung modelliert.", [6]),
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
      text: "In diesem Projekt geht es nicht darum, sofort Code zu schreiben. Du lernst, wie ein fachliches Modell Verhalten beschreibt und wie daraus später unterschiedliche Apps entstehen können.",
      topics: [
        "warum Quellcode für den Einstieg oft zu technisch ist",
        "wie Zustände, Werte, Regeln und Aktionen als Modell beschrieben werden",
        "warum das Modell unabhängig von Browser App und Embedded bleibt",
        "wann eine Browser App für den schnellen Einstieg sinnvoll ist",
        "welche Fragen später durch Zeitsteuerung und Speichern entstehen",
      ],
      startLabel: "Tamagotchi-Lektion starten",
    },
    completionSummary: {
      eyebrow: "Lernrückblick",
      title: "Was du im Tamagotchi-Projekt gelernt hast",
      text: "Du hast das Tamagotchi nicht zuerst als Code betrachtet, sondern als fachliches Modell. Dadurch wird sichtbar, warum modellbasierte Entwicklung hilft, Verhalten zu verstehen und später für verschiedene Runtimes umzusetzen.",
      learned: [
        "Quellcode ist eine technische Umsetzung, aber nicht die beste erste Erklärung für Verhalten.",
        "Ein Modell kann Zustände, Werte, Regeln und Aktionen lesbar beschreiben.",
        "Browser App und Embedded sind unterschiedliche Ausführungsformen desselben Modells.",
        "Die Browser App eignet sich für den schnellen Einstieg, zeigt aber auch Grenzen wie fehlende Persistenz.",
        "Die nächste Entwicklungsstufe ist eine zeitgesteuerte State-Machine mit gespeichertem Zustand.",
      ],
      next: "Als nächstes kann aus dem Modell eine einfache Browser App entstehen, danach folgen Tick-Logik und Speichern.",
    },
    learnerProfile: {
      boardKey: "unknown",
      selectedRuntime: "",
      tamagotchiTransitions: {
        hungryToSatt: "füttern",
        sattToHungry: "Hunger >= 50",
        hungryToDead: "Hunger = 100",
      },
      tamagotchiPlantUmlSource: tamagotchiPlantUmlBaseSource(),
    },
    runtimeDefaults: {
      selectedRuntime: "",
      tamagotchiTransitions: {
        hungryToSatt: "füttern",
        sattToHungry: "Hunger >= 50",
        hungryToDead: "Hunger = 100",
      },
      tamagotchiPlantUmlSource: tamagotchiPlantUmlBaseSource(),
    },
    boardProfiles: {
      unknown: { title: "Modellansicht" },
    },
    source: `Statische Quellcode-Datei: assets/tamagotchi-complete-example.c

typedef enum {
  TAMA_LIFE_ALIVE,
  TAMA_LIFE_DEAD
} TamaLife;

typedef enum {
  TAMA_HUNGER_SATIATED,
  TAMA_HUNGER_HUNGRY,
  TAMA_HUNGER_STARVING
} TamaHungerState;

typedef enum {
  TAMA_THIRST_OK,
  TAMA_THIRST_THIRSTY,
  TAMA_THIRST_DEHYDRATED
} TamaThirstState;

typedef enum {
  TAMA_MOOD_HAPPY,
  TAMA_MOOD_BORED,
  TAMA_MOOD_SAD,
  TAMA_MOOD_ANGRY
} TamaMood;

typedef struct {
  uint8_t hunger;
  uint8_t thirst;
  uint8_t energy;
  uint8_t happiness;
  uint8_t hygiene;
  uint8_t health;
  uint8_t affection;
  uint16_t age_days;
  uint16_t coins;
} TamaNeeds;

typedef struct {
  char person_id[32];
  uint8_t trust;
  uint32_t successful_interactions;
  uint32_t rejected_interactions;
  bool can_feed;
  bool can_drink;
  bool can_play;
  bool can_admin;
} TamaKnownPerson;

typedef struct {
  char name[24];
  TamaLife life;
  TamaHungerState hunger_state;
  TamaThirstState thirst_state;
  TamaEnergyState energy_state;
  TamaMood mood;
  TamaNeeds needs;
  TamaKnownPerson people[8];
  TamaMemory memories[16];
  TamaSyncEvent sync_queue[12];
  uint32_t last_tick_second;
  uint32_t last_fed_second;
  uint32_t last_drink_second;
  uint32_t last_clean_second;
  uint32_t last_play_second;
  bool dirty;
} Tama;

static void recompute_states(void) {
  if (tama.needs.hunger >= 100 || tama.needs.thirst >= 100 || tama.needs.health == 0) {
    tama.life = TAMA_LIFE_DEAD;
    return;
  }

  if (tama.needs.hunger >= 85) {
    tama.hunger_state = TAMA_HUNGER_STARVING;
  } else if (tama.needs.hunger >= 50) {
    tama.hunger_state = TAMA_HUNGER_HUNGRY;
  } else {
    tama.hunger_state = TAMA_HUNGER_SATIATED;
  }

  if (tama.needs.thirst >= 85) {
    tama.thirst_state = TAMA_THIRST_DEHYDRATED;
  } else if (tama.needs.thirst >= 50) {
    tama.thirst_state = TAMA_THIRST_THIRSTY;
  } else {
    tama.thirst_state = TAMA_THIRST_OK;
  }

  if (tama.needs.happiness >= 70 && tama.needs.hygiene >= 40) {
    tama.mood = TAMA_MOOD_HAPPY;
  } else if (tama.needs.happiness < 25) {
    tama.mood = TAMA_MOOD_SAD;
  } else if (tama.needs.hunger >= 80 || tama.needs.thirst >= 80) {
    tama.mood = TAMA_MOOD_ANGRY;
  } else {
    tama.mood = TAMA_MOOD_BORED;
  }
}

static void apply_time(uint32_t now_second) {
  uint32_t elapsed = now_second - tama.last_tick_second;
  uint32_t ticks = elapsed / 3;

  for (uint32_t i = 0; i < ticks; i++) {
    change_need(&tama.needs.hunger, +1);
    change_need(&tama.needs.thirst, +1);
    change_need(&tama.needs.hygiene, -1);
    change_need(&tama.needs.energy, -1);

    if (tama.needs.hunger > 75 || tama.needs.thirst > 75) {
      change_need(&tama.needs.health, -1);
      change_need(&tama.needs.happiness, -2);
    }
  }

  tama.last_tick_second += ticks * 3;
  recompute_states();
  tama.dirty = true;
}

static bool apply_action(uint32_t now_second, const char *person_id, TamaAction action,
                         const char *payload) {
  TamaKnownPerson *person = find_person(person_id);
  if (!person_may_use_action(person, action) || tama.life == TAMA_LIFE_DEAD) {
    remember(now_second, person_id, action, "action rejected", -2, -1);
    return false;
  }

  switch (action) {
    case TAMA_ACTION_FEED:
      tama.needs.hunger = 0;
      tama.last_fed_second = now_second;
      remember(now_second, person_id, action, "fed Tama", +4, +1);
      break;
    case TAMA_ACTION_DRINK:
      tama.needs.thirst = 0;
      tama.last_drink_second = now_second;
      remember(now_second, person_id, action, "gave water", +3, +1);
      break;
    case TAMA_ACTION_PLAY:
      change_need(&tama.needs.happiness, +12);
      change_need(&tama.needs.energy, -8);
      change_need(&tama.needs.hygiene, -4);
      remember(now_second, person_id, action, payload, +7, +2);
      break;
    default:
      remember(now_second, person_id, action, "other action", 0, 0);
      break;
  }

  enqueue_sync(now_second, person_id, action);
  recompute_states();
  tama.dirty = true;
  return true;
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
    disadvantage: ohne Speichern ist beim Browser-Schließen alles weg
  embedded:
    later: gleiches Modell, aber echte Hardware, Build, Flash, OTA und Gerätespeicher

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
          "Schau dir diese statische Quellcode-Datei an. Sie bildet schon sehr viele Ideen eines vollstaendigen Tamagotchis ab: Zustaende, Hunger, Durst, Aktionen, Gedächtnis, bekannte Personen und Synchronisation. Verstehst du sofort, welche fachliche Idee dahinter steckt?",
        outcome: "Der Lernende erlebt zuerst: Code enthält zwar die Logik, erklärt die fachliche Idee aber nicht gut.",
        focusLines: [1, 3, 4, 8, 9, 13, 14, 16],
        editableLines: [],
        completion: { type: "acknowledge", label: "Code angeschaut" },
      },
      {
        id: "step.tamagotchi_model.02_state_intro",
        flowItemId: "project_flow_item.tamagotchi_model.02",
        pattern: "step_pattern.state_introduction",
        title: "Einführung in Zustände",
        text:
          "Quellcode ist für Maschinen gemacht. Menschen können ihn schreiben, aber für andere Personen ist er oft schwer nachvollziehbar. Menschen verstehen viele Dinge leichter, wenn sie sie zuerst als Zustände betrachten. Eine Regentonne kann leer, halb voll oder voll sein. Ein Akku kann leer, halb voll oder voll sein.",
        outcome: "Der Lernende erkennt: Ein Objekt kann über einfache benannte Zustände beschrieben werden.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Objekte in Zuständen",
          rows: [
            {
              label: "Regentonne",
              description: "Der Füllstand ist als Zustand leichter lesbar als als technische Messung.",
              states: [
                { label: "leer", kind: "barrel", level: 0 },
                { label: "halb voll", kind: "barrel", level: 50 },
                { label: "voll", kind: "barrel", level: 100 },
              ],
            },
            {
              label: "Akku",
              description: "Auch beim Akku helfen einfache Namen, bevor über Spannung gesprochen wird.",
              states: [
                { label: "leer", kind: "battery", level: 8 },
                { label: "halb voll", kind: "battery", level: 50 },
                { label: "voll", kind: "battery", level: 100 },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Zustände gesehen" },
      },
      {
        id: "step.tamagotchi_model.03_state_categories",
        flowItemId: "project_flow_item.tamagotchi_model.03",
        pattern: "step_pattern.state_classification",
        title: "Einteilung von Zuständen",
        text:
          "Am Bild aus Schritt 2 sieht man bereits eine Einteilung. Manche Zustände sind direkt definiert: Eine Kaffeemaschine oder ein Fernseher ist an oder aus. Andere Eigenschaften sind fließend und haben von sich aus keine klaren Stufen. Temperatur, Punktzahl und Füllstand können viele Werte haben. Damit Menschen trotzdem damit arbeiten können, teilen sie solche Werte in benannte Zustände oder Klassen ein.",
        outcome: "Der Lernende unterscheidet direkte diskrete Zustände von fließenden Eigenschaften, die erst eingeteilt werden müssen.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Direkt definiert oder eingeteilt",
          rows: [
            {
              label: "Direkt definiert",
              description: "Der Zustand ist bereits klar getrennt, zum Beispiel bei Kaffeemaschine oder Fernseher.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false },
              ],
            },
            {
              label: "Fliessend",
              description: "Der Wert verändert sich kontinuierlich und wird erst später klassifiziert.",
              states: [
                { label: "Temperatur", kind: "thermometer", level: 58, value: "0..100 Grad" },
                { label: "Punktzahl", kind: "label", value: "0..100" },
                { label: "Füllstand", kind: "barrel", level: 50, value: "0..100 %" },
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
        title: "Direkte diskrete Zustände",
        text:
          "Wenn ein Objekt klar getrennte Zustände besitzt, kann man den Zustand direkt benennen. Zustände beschreibt man meistens mit Adjektiven oder kurzen Eigenschaftswörtern: Ein Fernseher ist an oder aus. Das Wetter kann sonnig, bewölkt, regnerisch oder windig sein. Manchmal enthält ein Zustand weitere Unterzustände: Eine Siebträgermaschine kann aus oder an sein; wenn sie an ist, kann sie aufheizend oder bereit sein.",
        outcome: "Der Lernende versteht: Diskrete Zustände können binär sein, mehrere Werte haben oder als Oberzustand weitere Unterzustände enthalten.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Diskrete Zustände",
          rows: [
            {
              label: "Fernseher",
              description: "Zwei klare Zustände: an oder aus. Bei genau zwei Zuständen spricht man von binär.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false },
              ],
            },
            {
              label: "Wetter",
              description: "Diskrete Zustände müssen nicht nur zwei sein. Es können mehrere benannte Zustände nebeneinander stehen.",
              states: [
                { label: "sonnig", kind: "weather", value: "sunny", showValue: false },
                { label: "bewölkt", kind: "weather", value: "cloudy", showValue: false },
                { label: "regnerisch", kind: "weather", value: "rainy", showValue: false },
                { label: "windig", kind: "weather", value: "windy", showValue: false },
              ],
            },
            {
              label: "Siebträgermaschine",
              description: "Ein Oberzustand kann Unterzustände enthalten. In an liegen hier aufheizend und bereit.",
              states: [
                { label: "aus", kind: "power", value: "off", showValue: false },
                { label: "an", kind: "power", value: "on", showValue: false, substates: ["aufheizend", "bereit"] },
              ],
            },
          ],
        },
        completion: { type: "acknowledge", label: "Diskrete Zustände verstanden" },
      },
      {
        id: "step.tamagotchi_model.05_physical_property_rule",
        flowItemId: "project_flow_item.tamagotchi_model.05",
        pattern: "step_pattern.model_rule_introduction",
        title: "Aus Messwerten werden Zustände",
        text:
          "Wenn eine Eigenschaft fließend ist, brauchen wir eine Messgröße und Grenzen. Beim Stein ist die Messgröße die Temperatur, zum Beispiel gemessen mit PT1000 oder IR-Sensor. Für das Modell reduzieren wir sie auf drei Zustände: unter 10 Grad Celsius ist kalt, ab 10 Grad bis unter 55 Grad ist warm und ab 55 Grad ist heiß. Beim Füllstand einer Regentonne kann der Messwert zum Beispiel über Reedkontakte, Kamera mit Bildverarbeitung oder einen Schwimmer mit Seillänge erfasst werden. Beim Akku kann der Ladezustand vereinfacht über die Spannung erfasst werden: niedrige Spannung bedeutet leer, mittlere Spannung halb voll und hohe Spannung voll.",
        outcome: "Der Lernende erkennt: Aus einem kontinuierlichen Messwert werden durch Schwellen diskrete Zustände abgeleitet.",
        focusLines: [],
        editableLines: [],
        visual: {
          title: "Messwert, Schwelle und Zustand",
          rows: [
            {
              label: "Stein: Temperatur",
              description: "Messbar mit PT1000 oder IR-Sensor. Schwellen: unter 10 Grad kalt, ab 10 Grad warm, ab 55 Grad heiß.",
              states: [
                { label: "unter 10 Grad", kind: "stone", tone: "cold", value: "Zustand = kalt" },
                { label: "10 bis unter 55 Grad", kind: "stone", tone: "warm", value: "Zustand = warm" },
                { label: "ab 55 Grad", kind: "stone", tone: "hot", value: "Zustand = heiß" },
              ],
            },
            {
              label: "Regentonne: Füllstand",
              description: "Erfassbar mit Reedkontakten, Kamera oder Schwimmer mit Seillänge.",
              states: [
                { label: "niedrig", kind: "barrel", level: 10, value: "Zustand = leer" },
                { label: "mittel", kind: "barrel", level: 50, value: "Zustand = halb voll" },
                { label: "hoch", kind: "barrel", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Akku: Spannung",
              description: "Der Ladezustand kann vereinfacht über die Spannung erfasst werden.",
              states: [
                { label: "niedrige Spannung", kind: "battery", level: 8, value: "Zustand = leer" },
                { label: "mittlere Spannung", kind: "battery", level: 50, value: "Zustand = halb voll" },
                { label: "hohe Spannung", kind: "battery", level: 100, value: "Zustand = voll" },
              ],
            },
            {
              label: "Notensystem: Punktzahl",
              description: "Eine Punktzahl wird durch Grenzen in eine Note von 1 bis 6 übersetzt.",
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
        pattern: "step_pattern.state_machine_concept",
        title: "Aus Zuständen wird eine State Machine",
        text:
          "Jetzt haben wir die Grundlagen zusammen: Es gibt Zustände, und mit Transitionen wechselt ein System von einem Zustand in den nächsten. Eine Transition hat oft eine Bedingung, zum Beispiel eine messbare Größe mit Schwelle: Hunger >= 50 macht satt zu hungrig, oder Hunger = 100 macht hungrig zu tot. Dieses ganze Modell nennt man State Machine, auf Deutsch Zustandsmaschine. Bei der Regentonne sieht man das als kleinen Kreislauf: leer, Regen, voll, Gießen, wieder leer.",
        panelTextParts: [
          "Bei der Regentonne sieht man einen einfachen Kreislauf: Die Tonne ist leer. Durch Regen wird sie voll. Durch Gießen wird sie wieder leer.",
          "Damit sehen wir bereits eine State Machine, also eine Zustandsmaschine. Sie besteht aus States wie Tonne leer und Tonne voll sowie Transitionen wie Regen und Gießen. Transitionen beschreiben, wie ein System von einem State in den nächsten State wechselt.",
        ],
        outcome: "Der Lernende erkennt: Zustände, Transitionen und Bedingungen bilden zusammen eine State Machine beziehungsweise Zustandsmaschine.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "cycle",
          title: "Regentonnen-Zustandskreislauf",
          hideIntro: true,
          states: [
            { label: "Tonne leer", kind: "barrel", level: 0 },
            { label: "Tonne voll", kind: "barrel", level: 100 },
          ],
          transitions: [
            { label: "Regen" },
            { label: "Gießen" },
          ],
        },
        completion: { type: "acknowledge", label: "State Machine verstanden" },
      },
      {
        id: "step.tamagotchi_model.07_runtime_choice",
        flowItemId: "project_flow_item.tamagotchi_model.07",
        pattern: "step_pattern.state_machine_transition_conditions",
        title: "Eine State Machine mit PlantUML beschreiben",
        text:
          "Jetzt schreiben wir diese Zustandsmaschine als PlantUML. PlantUML beschreibt Diagramme mit Text: Zustände stehen als Zeilen im Text, Transitionen werden mit Pfeilen und Bedingungen beschrieben. Damit lassen sich State Machines komfortabel erzeugen, ohne Pfeile per Hand zu zeichnen. Der große Vorteil: KI und auch andere Tools können diese Sprache schnell und sicher verstehen und übersetzen. Aus einer präzisen PlantUML-Beschreibung kann später gezielter Code für die Ziel-Runtime erzeugt werden.",
        modelingNote: {
          title: "Hinweis zur Modellierung",
          paragraphs: [
            "In diesem Projekt verwenden wir ein UML-Statechart als Grundlage, um das Verhalten unseres Tamagotchis zu beschreiben. Unser Ziel ist dabei nicht, UML vollständig zu vermitteln oder eine UML-Schulung zu ersetzen.",
            "Viel wichtiger ist uns, die Ingenieurs-Denkweise zu vermitteln: Wie zerlegt man ein Problem? Wie beschreibt man Zustände, Übergänge und Regeln so, dass daraus später Software entstehen kann?",
            "Deshalb erweitern wir das Statechart an einigen Stellen um einfache Notizen, beispielsweise für Initialwerte oder zeitliche Regeln. Diese Notation ist kein offizieller Bestandteil der UML, sondern eine bewusst gewählte Erweiterung für unser Lernprojekt. Sie macht das Modell leichter verständlich und ermöglicht es, daraus automatisch lauffähigen Code zu erzeugen.",
            "Eine vollständige UML-Modellierung würde diese Informationen auf mehrere Diagrammtypen verteilen. Typischerweise würden:",
          ],
          bullets: [
            "Attribute und ihre Initialwerte in einem Klassendiagramm beschrieben,",
            "Zustände und Übergänge in einem Statechart modelliert,",
            "zeitliche Abläufe über Time Events, Aktivitäten oder Operationen definiert,",
            "komplexere Regeln gegebenenfalls mit OCL oder ergänzenden Spezifikationen beschrieben werden.",
          ],
          closing: [
            "Für unser Lernprojekt wäre dieser Umfang jedoch unnötig komplex und würde vom eigentlichen Lernziel ablenken. Deshalb konzentrieren wir uns auf die wesentlichen Konzepte und ergänzen das Statechart um wenige, leicht verständliche Angaben.",
            "Unser Ziel ist also nicht, UML auswendig zu lernen, sondern zu verstehen, wie man Software systematisch modelliert und daraus Schritt für Schritt eine funktionierende Anwendung entwickelt. Wer später professionell mit UML arbeitet, wird dieselben Ideen wiederfinden, allerdings auf mehrere, spezialisierte Modelle verteilt.",
          ],
        },
        outcome: "Der Lernende erkennt: PlantUML ist eine textuelle Schreibweise für die State Machine und kann von KI oder anderen Werkzeugen zuverlässig als Modellgrundlage verstanden werden.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          plantUmlSrc: "assets/tamagotchi-state-machine.puml",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          profileField: "tamagotchiTransitions",
          transitions: [
            {
              key: "sattToHungry",
              from: "satt",
              to: "hungrig",
              label: "satt -> hungrig",
              prompt: "Wann wird das Tamagotchi hungrig?",
            },
            {
              key: "hungryToSatt",
              from: "hungrig",
              to: "satt",
              label: "hungrig -> satt",
              prompt: "Was macht das Tamagotchi wieder satt?",
            },
            {
              key: "hungryToDead",
              from: "hungrig",
              to: "tot",
              label: "hungrig -> tot",
              prompt: "Wann stirbt das Tamagotchi?",
            },
          ],
        },
        completion: { type: "acknowledge", label: "PlantUML verstanden" },
        nextStepId: "step.tamagotchi_model.08_runtime_choice_duplicate",
      },
      {
        id: "step.tamagotchi_model.08_runtime_choice_duplicate",
        flowItemId: "project_flow_item.tamagotchi_model.08_runtime_choice_duplicate",
        pattern: "step_pattern.model_to_runtime_generation",
        title: "Aus PlantUML ein Browser-Programm erzeugen",
        text:
          "Das Ziel ist jetzt: Aus der PlantUML-State-Machine soll ein ausführbares Browser-Programm entstehen. Die PlantUML-Quelle beschreibt das Verhalten präzise. Wir erstellen daraus jetzt eine kleine Webanwendung.",
        outcome: "Der Lernende erkennt: PlantUML ist nicht nur ein Diagramm, sondern ein Modell, aus dem gezielt ausführbarer Browser-Code entstehen kann.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          plantUmlSrc: "assets/tamagotchi-state-machine.puml",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          profileField: "tamagotchiTransitions",
          transitions: [
            {
              key: "sattToHungry",
              from: "satt",
              to: "hungrig",
              label: "satt -> hungrig",
              prompt: "Wann wird das Tamagotchi hungrig?",
            },
            {
              key: "hungryToSatt",
              from: "hungrig",
              to: "satt",
              label: "hungrig -> satt",
              prompt: "Was macht das Tamagotchi wieder satt?",
            },
            {
              key: "hungryToDead",
              from: "hungrig",
              to: "tot",
              label: "hungrig -> tot",
              prompt: "Wann stirbt das Tamagotchi?",
            },
          ],
        },
        runtimePreview: {
          type: "tamagotchiBrowserApp",
          buttonLabel: "Run",
        },
        completion: { type: "acknowledge", label: "Browser-Ziel verstanden" },
        nextStepId: "step.tamagotchi_model.08_add_state",
      },
      {
        id: "step.tamagotchi_model.08_add_state",
        flowItemId: "project_flow_item.tamagotchi_model.08_add_state",
        pattern: "step_pattern.state_machine_extension",
        title: "Eine eigene Eigenschaft ergänzen",
        text:
          "Jetzt ergänzen wir eine weitere Eigenschaft des Tamagotchis. Beispiele wären Flüssigkeitsbedarf mit nicht durstig und durstig oder Stimmung mit ausgelastet und gelangweilt. In diesem Schritt befüllst du das Modell über den Button und siehst direkt, wie sich die PlantUML-Quelle und das Diagramm verändern.",
        outcome: "Der Lernende erkennt: Eigenschaften und ihre Zustände sind fachliche Modellierungsentscheidungen und können selbst gewählt werden.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          insertHint: 'Füge zwei neue States ein: state "nicht durstig" as nicht_durstig und state "durstig" as durstig',
          exampleInsert: {
            label: "Beispiel einfügen: durstig",
            block: 'state "lebendig"',
            lines: [
              '  state "nicht durstig" as nicht_durstig',
              '  state "durstig" as durstig',
            ],
          },
        },
        validation: {
          type: "plantUmlAdditionalStateInBlock",
          profileField: "tamagotchiPlantUmlSource",
          block: 'state "lebendig"',
          existingAliases: ["satt", "hungrig"],
          minStates: 2,
          label: "mindestens zwei selbst gewählte zusätzliche States",
        },
        completion: { type: "acknowledge", label: "Eigene Eigenschaft ergänzt" },
        nextStepId: "step.tamagotchi_model.09_add_transition",
      },
      {
        id: "step.tamagotchi_model.09_add_transition",
        flowItemId: "project_flow_item.tamagotchi_model.09_add_transition",
        pattern: "step_pattern.transition_condition_extension",
        title: "Eine neue Übergangsbedingung ergänzen",
        text:
          "Ergänze jetzt eine Transition zwischen zwei Zuständen deiner neuen Eigenschaft. Beispiel: nicht_durstig --> durstig : Durst >= 50 oder ausgelastet --> gelangweilt : zu lange nicht gespielt. Damit wird sichtbar, dass selbst gewählte Eigenschaften eigene Übergänge, Aktionen und Bedingungen bekommen können.",
        outcome: "Der Lernende beschreibt eine fachliche Bedingung als Transition im PlantUML-Modell.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          insertHint: "Verbinde zwei deiner neuen States mit einer Transition. Nach dem Einfügen kannst du die markierte Zeile ändern.",
          exampleInsert: {
            type: "transition",
            label: "Beispiel-Transition einfügen",
            block: 'state "lebendig"',
            existingAliases: ["satt", "hungrig"],
            fallback: {
              from: "nicht_durstig",
              to: "durstig",
              condition: "Durst >= 50",
            },
          },
        },
        validation: {
          type: "plantUmlTransitionToAdditionalState",
          profileField: "tamagotchiPlantUmlSource",
          block: 'state "lebendig"',
          existingAliases: ["satt", "hungrig"],
          minStates: 2,
          label: "Transition zwischen selbst gewählten neuen States",
        },
        completion: { type: "acknowledge", label: "Transition mit Bedingung ergänzt" },
        nextStepId: "step.tamagotchi_model.10_initial_values",
      },
      {
        id: "step.tamagotchi_model.10_initial_values",
        flowItemId: "project_flow_item.tamagotchi_model.10_initial_values",
        pattern: "step_pattern.transition_completeness",
        title: "Transition vollständig machen",
        text:
          "Prüfe jetzt die ergänzte Transition. Sie ist vollständig, wenn klar ist, von welchem State sie startet, in welchen State sie führt und welche Bedingung oder Aktion den Wechsel auslöst. Eine Vorlage wie Bedingung eintragen muss durch eine echte Regel ersetzt werden.",
        outcome: "Der Lernende erkennt: Eine Transition ist erst vollständig, wenn Start-State, Ziel-State und Auslöser klar beschrieben sind.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          insertHint: "Kontrolliere die Transition deiner neuen States: Quelle --> Ziel : Bedingung oder Aktion.",
          exampleInsert: {
            type: "initialValueLineWithTransition",
            label: "Durst-Initialwert und Tod-Transition einfügen",
            noteStart: "note right of lebendig",
            line: "  Durst = 45",
            transitionLine: "durstig --> tot : Hunger >= 100",
          },
        },
        validation: {
          type: "plantUmlTransitionToAdditionalState",
          profileField: "tamagotchiPlantUmlSource",
          block: 'state "lebendig"',
          existingAliases: ["satt", "hungrig"],
          minStates: 2,
          label: "vollständige Transition zwischen selbst gewählten States",
          rejectConditions: ["Bedingung eintragen"],
        },
        completion: { type: "acknowledge", label: "Transition vollständig" },
        nextStepId: "step.tamagotchi_model.08_browser_first",
      },
      {
        id: "step.tamagotchi_model.08_browser_first",
        flowItemId: "project_flow_item.tamagotchi_model.08_browser",
        pattern: "step_pattern.model_to_runtime_execution",
        title: "Beispiel als Web-App ausführen",
        text:
          "Jetzt führen wir das aktuelle PlantUML-Beispiel als kleine Web-App aus. Der Run-Button öffnet eine Browser-Vorschau, die Initialwerte, Zustände und Transitionen aus dem Modell übernimmt.",
        outcome: "Der Lernende sieht: Aus dem PlantUML-Modell kann eine lauffähige Browser-App abgeleitet werden.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          insertHint: "Das Modell links ist die Grundlage für die Web-App. Starte rechts die Vorschau mit Run.",
        },
        runtimePreview: {
          type: "tamagotchiBrowserApp",
          buttonLabel: "Run",
        },
        completion: { type: "acknowledge", label: "Web-App ausgeführt" },
        nextStepId: "step.tamagotchi_model.13_tick_rules",
      },
      {
        id: "step.tamagotchi_model.13_tick_rules",
        flowItemId: "project_flow_item.tamagotchi_model.13_tick_rules",
        pattern: "step_pattern.runtime_tick_rules",
        title: "Zählgeschwindigkeit ergänzen",
        text:
          "Wie du siehst, weiß das Modell noch nicht, wie schnell gezählt werden muss. Vielleicht ist euch das vorher schon aufgefallen. Falls nicht, ist das der nächste Aha-Moment. Damit wir weitere Effekte kurz nach dem Wechsel von satt zu hungrig und nicht durstig zu durstig sehen, ergänzen wir jetzt die Zählgeschwindigkeit für Hunger und Durst sowie die automatischen Zustandswechsel-Regeln explizit.",
        outcome: "Der Lernende erkennt: Neben States, Initialwerten und Transitionen braucht ein ausführbares Modell auch Regeln für zeitliche Veränderung.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiPlantUmlBaseSource(),
          readonly: true,
          insertHint: "Füge die Tick-Regeln ein: wie schnell Hunger und Durst steigen und welche automatischen Wechsel dadurch ausgelöst werden.",
          exampleInsert: {
            type: "initialValues",
            label: "Zählregeln einfügen",
            lines: [
              "note bottom of lebendig",
              "  Zählregeln",
              "  alle 3 Sekunden: Hunger = Hunger + 1",
              "  alle 3 Sekunden: Durst = Durst + 1",
              "  satt -> hungrig: Hunger >= 50",
              "  nicht_durstig -> durstig: Durst >= 50",
              "  hungrig -> tot: Hunger >= 100",
              "  durstig -> tot: Hunger >= 100",
              "end note",
            ],
          },
        },
        validation: {
          type: "profileTextContainsAll",
          profileField: "tamagotchiPlantUmlSource",
          contains: [
            "alle 3 Sekunden: Hunger = Hunger + 1",
            "alle 3 Sekunden: Durst = Durst + 1",
            "satt -> hungrig: Hunger >= 50",
            "nicht_durstig -> durstig: Durst >= 50",
            "hungrig -> tot: Hunger >= 100",
            "durstig -> tot: Hunger >= 100",
          ],
          label: "Zählgeschwindigkeit und automatische Zustandswechsel sind ergänzt",
        },
        runtimePreview: {
          type: "tamagotchiBrowserApp",
          buttonLabel: "Run",
        },
        completion: { type: "acknowledge", label: "Zählregeln ergänzt" },
        nextStepId: "step.tamagotchi_model.14_free_exploration",
      },
      {
        id: "step.tamagotchi_model.14_free_exploration",
        flowItemId: "project_flow_item.tamagotchi_model.14_free_exploration",
        pattern: "step_pattern.free_exploration",
        title: "Selber mit der State Machine forschen",
        text:
          "Jetzt darfst du die PlantUML-Quelle frei bearbeiten. Wenn das Diagramm danach angezeigt wird, ist die PlantUML-Syntax grundsätzlich gültig. Das heißt aber nicht automatisch, dass das Modell fachlich sinnvoll ist: Ein syntaktisch korrektes Modell kann widersprüchliche Zustände, unklare Übergänge oder wenig hilfreiche Regeln enthalten.",
        outcome: "Der Lernende erkennt: Syntaxprüfung und fachlich sinnvolle Modellierung sind zwei verschiedene Dinge.",
        focusLines: [],
        editableLines: [],
        visual: {
          type: "tamagotchiMachine",
          title: "Tamagotchi-State-Machine",
          sourceField: "tamagotchiPlantUmlSource",
          plantUmlSource: tamagotchiExplorationSource(),
          insertHint: "Bearbeite die PlantUML-Quelle frei. Das Diagramm zeigt dir, ob die Syntax noch verarbeitet werden kann.",
          resetSource: "exploration",
          resetLabel: "Zurücksetzen",
        },
        runtimePreview: {
          type: "tamagotchiBrowserApp",
          buttonLabel: "Run",
        },
        completion: { type: "acknowledge", label: "Freies Modell erforscht" },
        nextStepId: "step.tamagotchi_model.15_free_journey_summary",
      },
      {
        id: "step.tamagotchi_model.15_free_journey_summary",
        flowItemId: "project_flow_item.tamagotchi_model.15_free_journey_summary",
        pattern: "step_pattern.learning_summary_and_upgrade",
        title: "Tamas freie Reise endet hier",
        text:
          "Du hast Tama als Modell erforscht: Zustände beschrieben, Übergänge ergänzt, Bedingungen formuliert, Zählregeln eingefügt, eine Browser-App aus dem Modell gestartet und zuletzt frei mit PlantUML experimentiert. Damit ist die freie Reise mit Tama abgeschlossen. Im nächsten Kurs bekommt Tama neue spannende Funktionen:",
        endHighlights: [
          "Du kannst Tama füttern und tränken.",
          "Tama bekommt ein Gedächtnis.",
          "Tama wird zur echten Mobile App.",
          "Tama wird später zur Embedded App mit ESP32.",
          "Viele Geräte können auf ein und denselben Tama zugreifen.",
          "Tama spricht nur mit bekannten Leuten.",
          "Dieser nächste Abschnitt gehört in einen Bezahlplan.",
          "TODO: Bezahlplan definieren.",
        ],
        outcome: "Der Lernende erkennt, was im freien Tama-Pfad gelernt wurde und dass der anschließende vertiefende Pfad über einen noch zu definierenden Bezahlplan freigeschaltet werden soll.",
        focusLines: [],
        editableLines: [],
        endScreen: true,
        endButtonLabel: "Beenden",
        completion: { type: "acknowledge", label: "Freie Tama-Reise abgeschlossen" },
      },
      {
        id: "step.tamagotchi_model.08_embedded_preview",
        flowItemId: "project_flow_item.tamagotchi_model.08_embedded",
        pattern: "step_pattern.variant_comparison",
        title: "Embedded ist derselbe Modellkern",
        text:
          "Embedded ist kein anderes Tamagotchi. Dasselbe Modell wird später für Hardware, Build, Flash, OTA und Gerätespeicher erzeugt.",
        outcome: "Embedded ist als spätere Runtime-Variante eingeordnet.",
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
          "Die erste Browser App darf einfach sein: Benutzer klickt, Zustand ändert sich. Wenn nichts gespeichert wird, ist nach dem Schließen alles weg.",
        outcome: "Der Nachteil der ersten Browser-Version motiviert Persistenz.",
        focusLines: [64, 65, 66, 71, 72],
        editableLines: [],
        completion: { type: "acknowledge", label: "Grenze erkannt" },
      },
      {
        id: "step.tamagotchi_model.10_time_and_persistence",
        flowItemId: "project_flow_item.tamagotchi_model.10",
        pattern: "step_pattern.solution_introduction",
        title: "Nächste Lektion: Zeit und Speichern",
        text:
          "Danach wechseln wir von reinen Benutzerinteraktionen zu einer zeitgesteuerten State-Machine und speichern Modell/Zustand.",
        outcome: "Die nächste Lernstufe ist vorbereitet: Tick, State-Machine und Persistenz.",
        focusLines: [71, 72],
        editableLines: [],
        completion: { type: "acknowledge", label: "Nächste Lektion verstanden" },
      },
      {
        id: "step.tamagotchi_model.11_next_runtime_apps",
        flowItemId: "project_flow_item.tamagotchi_model.11",
        pattern: "step_pattern.reflection_inspiration_sales_bridge",
        title: "Weitere Apps aus demselben Modell",
        text:
          "Die Browser App ist nur der erste sichtbare Pfad. Danach kann dasselbe Modell in weitere Runtime-Apps übertragen werden, inklusive Embedded.",
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
        "warum Zeitverhalten für Aktoren wichtig wird",
      ],
      startLabel: "Aktorik-Lektion starten",
    },
    completionSummary: {
      eyebrow: "Lernrückblick",
      title: "Was du im Aktorik-Projekt gelernt hast",
      text: "Du hast eine LED nicht nur blinken lassen, sondern die Grenze zwischen Software, Mikrocontroller-Pin und sichtbarer Wirkung verstanden.",
      learned: [
        "Ein GPIO-Pin ist die elektrische Schnittstelle zwischen Software und Hardware.",
        "Ein Ausgang muss vorbereitet werden, bevor Software ihn aktiv schalten kann.",
        "Parameter wie Wartezeiten verändern sichtbares Verhalten, ohne die Grundlogik zu ersetzen.",
        "Blockierendes Warten motiviert später Timer, PWM und nebenläufige Abläufe.",
      ],
      next: "Aus dieser Grundlage können später Buzzer, Motoren, PWM und vernetzte Steuerungen entstehen.",
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
          "Der Mikrocontroller verändert nicht direkt die Welt. Er setzt ein elektrisches Signal an einem Pin. Die angeschlossene LED macht daraus eine sichtbare Wirkung.",
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
          "Diese Zeile legt fest, welcher GPIO für die LED benutzt wird. Wenn dein Board-Profil bekannt ist, validieren wir gegen dessen hinterlegten LED-Pin. Sonst reicht eine plausible Pin-Zahl.",
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
        title: "Blinkgeschwindigkeit ändern",
        text:
          "Ändere die Wartezeit von 1000 ms auf 500 ms. Danach blinkt die LED schneller, ohne dass sich die eigentliche Schaltlogik ändert.",
        outcome: "Ein Parameter wird als Stellgröße für beobachtbares Verhalten verstanden.",
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
          "Die LED blinkt, aber die CPU verbringt die Zeit im Warten. Genau hier entsteht die Frage, warum Peripherieeinheiten wie Timer und PWM nützlich sind.",
        outcome: "Die Grenze der naiven Delay-Lösung wird als echtes technisches Problem sichtbar.",
        focusLines: [12, 14],
        editableLines: [],
      },
      {
        id: "step.actuator_output_basics.07_solution_pwm",
        flowItemId: "project_flow_item.actuator_output_basics.07",
        pattern: "step_pattern.solution_introduction",
        title: "PWM als Entlastung einführen",
        text:
          "PWM wird vorkonfiguriert und erzeugt das periodische Signal in Hardware. Die Software muss später nur noch Werte wie das Tastverhältnis ändern.",
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
          "Du hast nicht nur eine LED blinken lassen. Du hast Systemgrenzen, Parameter, zeitliches Verhalten und den Grund für PWM kennengelernt. Das ist die Basis für Buzzer, Motoren und später Webserver-Steuerung.",
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
    boardProfiles: { unknown: { title: "Nicht relevant für diese Vorschau" } },
  };
}

function createDefaultWelcome(config) {
  return {
    eyebrow: "Projektidee",
    title: config.title,
    text: config.summary || "In diesem Projekt lernst du die fachliche Idee, die Systemgrenzen und die nächsten technischen Fragen kennen.",
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
  applyStoredRuntimeEdits(lesson);
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

  if (!isComplete && step.endScreen) {
    renderEndScreenStage(step);
    return;
  }

  if (!isComplete && step.visual) {
    renderVisualStage(step);
    return;
  }

  editor.classList.remove("visual-mode", "end-screen-mode");
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

function renderEndScreenStage(step) {
  editor.classList.remove("complete");
  editor.classList.add("visual-mode", "end-screen-mode");
  fileName.textContent = step.title;
  editorMode.textContent = "Kursabschluss";
  lineRuleBadge.textContent = "Ende";
  editor.innerHTML = `
    <section class="course-end-stage" aria-label="${escapeAttribute(step.title)}">
      <p class="step-kicker">${escapeHtml(step.pattern)}</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p>${escapeHtml(step.text)}</p>
      ${renderEndHighlightList(step.endHighlights)}
    </section>
  `;
}

function renderEndHighlightList(items) {
  if (!items?.length) return "";

  return `
    <ul class="course-end-highlights">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderVisualStage(step) {
  editor.classList.remove("complete");
  editor.classList.remove("end-screen-mode");
  editor.classList.add("visual-mode");
  fileName.textContent = step.visual.title || step.title;
  editorMode.textContent = "Bildfolge statt Code";
  lineRuleBadge.textContent = "Visualisierung";
  editor.innerHTML = `
    <div class="state-visual-stage">
      ${renderVisualIntro(step)}
      ${renderVisualContent(step.visual)}
    </div>
  `;
  wireVisualInputs(step);
  wirePlantUmlDiagrams(step);
}

function renderVisualIntro(step) {
  if (step.visual.type === "tamagotchiMachine" || step.visual.hideIntro) return "";
  const parts = step.visual.introParts || [step.visual.intro || step.text];
  return `
    <div class="state-visual-intro">
      ${parts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}
    </div>
  `;
}

function tamagotchiPlantUmlBaseSource() {
  return `@startuml
title Tamagotchi State-Machine

hide empty description

skinparam shadowing false
skinparam state {
  BackgroundColor #fbfdff
  BorderColor #9db0ca
  FontColor #08142b
  FontStyle bold
}

state "lebendig" as lebendig {
  state "satt" as satt
  state "hungrig" as hungrig
}

state "tot" as tot #fff7f7

note right of lebendig
  Initialwerte
  Hunger = 45
end note

[*] --> lebendig
satt --> hungrig : Hunger >= 50
hungrig --> satt : füttern
hungrig --> tot : Hunger = 100
@enduml`;
}

function tamagotchiExplorationSource() {
  return `@startuml
title Tamagotchi State-Machine

hide empty description

skinparam shadowing false
skinparam state {
  BackgroundColor #fbfdff
  BorderColor #9db0ca
  FontColor #08142b
  FontStyle bold
}

state "lebendig" as lebendig {
  state "satt" as satt
  state "hungrig" as hungrig
  state "nicht durstig" as nicht_durstig
  state "durstig" as durstig
}

state "tot" as tot #fff7f7

note right of lebendig
  Initialwerte
  Hunger = 45
  Durst = 45
end note

note bottom of lebendig
  Zählregeln
  alle 3 Sekunden: Hunger = Hunger + 1
  alle 3 Sekunden: Durst = Durst + 1
  satt -> hungrig: Hunger >= 50
  nicht_durstig -> durstig: Durst >= 50
  hungrig -> tot: Hunger >= 100
  durstig -> tot: Hunger >= 100
end note

[*] --> lebendig
satt --> hungrig : Hunger >= 50
hungrig --> satt : füttern
hungrig --> tot : Hunger >= 100
nicht_durstig --> durstig : Durst >= 50
durstig --> tot : Hunger >= 100
@enduml`;
}

function renderVisualContent(visual) {
  if (visual.type === "cycle") return renderStateCycle(visual);
  if (visual.type === "tamagotchiMachine") return renderTamagotchiMachine(visual);
  return renderVisualRows(visual);
}

function renderVisualRows(visual) {
  return `
    <div class="state-visual-rows">
      ${visual.rows.map(renderVisualRow).join("")}
    </div>
  `;
}

function renderStateCycle(visual) {
  const firstState = visual.states[0];
  const secondState = visual.states[1];
  const firstTransition = visual.transitions[0];
  const secondTransition = visual.transitions[1];

  return `
    <section class="state-cycle" aria-label="${escapeAttribute(visual.title || "Zustandskreislauf")}">
      <svg class="cycle-arrows" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
        <defs>
          <marker id="cycleArrowHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        <path class="cycle-path" d="M 230 132 C 310 18, 410 18, 490 132"></path>
        <path class="cycle-path" d="M 490 228 C 410 342, 310 342, 230 228"></path>
      </svg>
      <article class="state-card cycle-state">
        ${renderStatePicture(firstState)}
        <strong>${escapeHtml(firstState.label)}</strong>
      </article>
      <div class="cycle-transition cycle-top">
        <span>${escapeHtml(firstTransition.label)}</span>
      </div>
      <article class="state-card cycle-state">
        ${renderStatePicture(secondState)}
        <strong>${escapeHtml(secondState.label)}</strong>
      </article>
      <div class="cycle-transition cycle-bottom">
        <span>${escapeHtml(secondTransition.label)}</span>
      </div>
    </section>
  `;
}

function renderTamagotchiMachine(visual) {
  const sourceField = visual.sourceField || "tamagotchiPlantUmlSource";
  const source = lesson.learnerProfile?.[sourceField] || visual.plantUmlSource || "";

  return `
    <section class="machine-workspace" aria-label="${escapeAttribute(visual.title || "State-Machine")}">
      <div class="machine-diagram">
        ${source ? `
          <figure class="plantuml-viewer">
            <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(visual.title || "PlantUML-Diagramm")}">
            <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
          </figure>
        ` : ""}
      </div>
      <aside class="plantuml-editor-pane" aria-label="PlantUML-Eingabe">
        ${visual.insertHint ? `<div class="plantuml-insert-hint">${escapeHtml(visual.insertHint)}</div>` : ""}
        ${visual.exampleInsert ? `
          <button type="button" class="plantuml-example-button" data-action="insert-plantuml-example">
            ${escapeHtml(visual.exampleInsert.label)}
          </button>
        ` : ""}
        ${visual.resetSource ? `
          <button type="button" class="plantuml-example-button" data-action="reset-plantuml-source">
            ${escapeHtml(visual.resetLabel || "Zurücksetzen")}
          </button>
        ` : ""}
        ${visual.readonly
          ? `<pre class="plantuml-readonly"><code>${renderPlantUmlReadonlySource(source)}</code></pre>`
          : `<textarea class="plantuml-editor" data-action="edit-plantuml-source" data-field="${escapeAttribute(sourceField)}" spellcheck="false">${escapeHtml(source)}</textarea>`}
      </aside>
    </section>
  `;
}

function renderPlantUmlReadonlySource(source) {
  return escapeHtml(source).replace(/\b\d+\b/g, (value) =>
    `<mark class="plantuml-number-highlight">${value}</mark>`
  );
}

function renderVisualRow(row) {
  return `
    <section class="state-visual-row">
      <div class="state-visual-copy">
        <h3>${escapeHtml(row.label)}</h3>
        ${row.description ? `<p>${escapeHtml(row.description)}</p>` : ""}
      </div>
      <div class="state-sequence">
        ${row.states.map(renderVisualState).join("")}
      </div>
    </section>
  `;
}

function renderVisualState(state) {
  const value = state.value && state.showValue !== false ? `<span class="state-value">${escapeHtml(state.value)}</span>` : "";
  const substates = state.substates?.length
    ? `<div class="substate-list">${state.substates.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";
  return `
    <article class="state-card">
      ${renderStatePicture(state)}
      <strong>${escapeHtml(state.label)}</strong>
      ${value}
      ${substates}
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

  if (state.kind === "thermometer") {
    return `<div class="picture thermometer"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "weather") {
    return renderWeatherPicture(state.value || state.label);
  }

  if (state.kind === "power") {
    return renderPowerPicture(state.value || state.label);
  }

  if (state.kind === "label") {
    return `<div class="picture label-state"><span>${escapeHtml(state.value || state.label)}</span></div>`;
  }

  return `<div class="picture stone ${escapeAttribute(state.tone || "warm")}"><span></span></div>`;
}

function renderWeatherPicture(kind) {
  const icons = {
    sunny: `
      <circle cx="41" cy="41" r="17" fill="#facc15"></circle>
      <g stroke="#f59e0b" stroke-width="5" stroke-linecap="round">
        <line x1="41" y1="9" x2="41" y2="18"></line>
        <line x1="41" y1="64" x2="41" y2="73"></line>
        <line x1="9" y1="41" x2="18" y2="41"></line>
        <line x1="64" y1="41" x2="73" y2="41"></line>
        <line x1="18" y1="18" x2="24" y2="24"></line>
        <line x1="58" y1="58" x2="64" y2="64"></line>
        <line x1="64" y1="18" x2="58" y2="24"></line>
        <line x1="24" y1="58" x2="18" y2="64"></line>
      </g>
    `,
    cloudy: `
      <path d="M25 55h33a14 14 0 0 0 0-28 18 18 0 0 0-34-2 15 15 0 0 0 1 30z" fill="#cbd5e1"></path>
      <path d="M31 48h27a10 10 0 0 0 0-20 15 15 0 0 0-28 0 11 11 0 0 0 1 20z" fill="#e2e8f0"></path>
    `,
    rainy: `
      <path d="M25 49h33a14 14 0 0 0 0-28 18 18 0 0 0-34-2 15 15 0 0 0 1 30z" fill="#cbd5e1"></path>
      <path d="M31 42h27a10 10 0 0 0 0-20 15 15 0 0 0-28 0 11 11 0 0 0 1 20z" fill="#e2e8f0"></path>
      <g stroke="#0284c7" stroke-width="5" stroke-linecap="round">
        <line x1="29" y1="59" x2="25" y2="72"></line>
        <line x1="43" y1="59" x2="39" y2="72"></line>
        <line x1="57" y1="59" x2="53" y2="72"></line>
      </g>
    `,
    windy: `
      <g fill="none" stroke="#0f766e" stroke-width="5" stroke-linecap="round">
        <path d="M14 28h43a9 9 0 0 1 9 9"></path>
        <path d="M14 43h55a9 9 0 0 1 9 9"></path>
        <path d="M14 58h37a9 9 0 0 1 9 9"></path>
      </g>
    `,
  };

  return `
    <div class="picture weather">
      <svg class="weather-svg" viewBox="0 0 82 82" aria-hidden="true" focusable="false">
        ${icons[kind] || icons.cloudy}
      </svg>
    </div>
  `;
}

function renderPowerPicture(kind) {
  const isOn = kind === "on";
  return `
    <div class="picture power ${isOn ? "on" : "off"}">
      <svg class="power-svg" viewBox="0 0 82 82" aria-hidden="true" focusable="false">
        ${isOn
          ? `<path d="M41 16v22" fill="none" stroke="#0f766e" stroke-width="7" stroke-linecap="round"></path>
             <path d="M28 25a25 25 0 1 0 26 0" fill="none" stroke="#0f766e" stroke-width="7" stroke-linecap="round"></path>`
          : `<circle cx="41" cy="41" r="24" fill="none" stroke="#64748b" stroke-width="7"></circle>
             <path d="M25 57 57 25" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"></path>`}
      </svg>
    </div>
  `;
}

function wireVisualInputs(stepItem) {
  if (stepItem.visual?.type !== "tamagotchiMachine") return;

  editor.querySelectorAll('[data-action="insert-plantuml-example"]').forEach((button) => {
    button.addEventListener("click", () => {
      insertPlantUmlExample(stepItem);
    });
  });

  editor.querySelectorAll('[data-action="reset-plantuml-source"]').forEach((button) => {
    button.addEventListener("click", () => {
      resetPlantUmlSource(stepItem);
    });
  });

  editor.querySelectorAll('[data-action="edit-plantuml-source"]').forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      if (!field) return;

      lesson.learnerProfile = {
        ...(lesson.learnerProfile || {}),
        [field]: input.value,
      };
      persistRuntimeEdits();
      renderPanel();

      const image = editor.querySelector("[data-plantuml-source]");
      if (image) {
        image.dataset.plantumlSource = input.value;
        renderPlantUmlImage(image, input.value);
      }
    });
  });

  editor.querySelectorAll('[data-action="edit-machine-condition"]').forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      const key = input.dataset.key;
      if (!field || !key) return;

      lesson.learnerProfile = {
        ...(lesson.learnerProfile || {}),
        [field]: {
          ...(lesson.learnerProfile?.[field] || {}),
          [key]: input.value,
        },
      };
      persistRuntimeEdits();
    });
  });

}

function insertPlantUmlExample(stepItem) {
  const example = stepItem.visual?.exampleInsert;
  const input = editor.querySelector('[data-action="edit-plantuml-source"]');
  if (!example) return;

  const sourceField = stepItem.visual.sourceField || "tamagotchiPlantUmlSource";
  const currentSource = input?.value ?? lesson.learnerProfile?.[sourceField] ?? stepItem.visual.plantUmlSource ?? "";
  const result = resolvePlantUmlExampleInsert(currentSource, example);

  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [sourceField]: result.source,
  };
  persistRuntimeEdits();

  if (!input) {
    render();
    scrollPlantUmlReadonlyToOffset(result.source, result.selectionStart);
    return;
  }

  input.value = result.source;
  renderPanel();

  const image = editor.querySelector("[data-plantuml-source]");
  if (image) {
    image.dataset.plantumlSource = result.source;
    renderPlantUmlImage(image, result.source);
  }

  input.focus();
  input.setSelectionRange(result.selectionStart, result.selectionEnd);
}

function scrollPlantUmlReadonlyToOffset(source, offset) {
  const readonlyBlock = editor.querySelector(".plantuml-readonly");
  if (!readonlyBlock) return;

  const lineIndex = source.slice(0, offset).split("\n").length - 1;
  const computedStyle = window.getComputedStyle(readonlyBlock);
  const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : 20;
  readonlyBlock.scrollTop = Math.max(0, (lineIndex - 2) * lineHeight);
}

function resetPlantUmlSource(stepItem) {
  const sourceField = stepItem.visual?.sourceField || "tamagotchiPlantUmlSource";
  const source = resolvePlantUmlResetSource(stepItem.visual);

  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [sourceField]: source,
  };
  persistRuntimeEdits();
  render();
}

function resolvePlantUmlResetSource(visual) {
  if (visual?.resetSource === "exploration") {
    return tamagotchiExplorationSource();
  }

  return visual?.plantUmlSource || tamagotchiPlantUmlBaseSource();
}

function resolvePlantUmlExampleInsert(source, example) {
  if (example.type === "transition") {
    return insertPlantUmlTransitionExample(source, example);
  }

  if (example.type === "initialValues") {
    return insertPlantUmlLinesBeforeEnd(source, example.lines);
  }

  if (example.type === "initialValueLine") {
    return insertPlantUmlLineIntoNote(source, example.noteStart, example.line);
  }

  if (example.type === "initialValueLineWithTransition") {
    const withInitialValue = insertPlantUmlLineIntoNote(source, example.noteStart, example.line);
    return insertPlantUmlLineBeforeEnd(withInitialValue.source, example.transitionLine);
  }

  return insertLinesIntoPlantUmlBlock(source, example.block, example.lines);
}

function insertPlantUmlTransitionExample(source, example) {
  const customStates = getPlantUmlStatesInBlockFromText(source, example.block)
    .filter((state) => !(example.existingAliases || []).includes(state.alias));
  const from = customStates[0]?.alias || example.fallback?.from || "state_a";
  const to = customStates[1]?.alias || example.fallback?.to || "state_b";
  const condition = chooseTransitionExampleCondition(from, to, example);
  const transitionLine = `${from} --> ${to} : ${condition}`;
  return insertPlantUmlLineBeforeEnd(source, transitionLine);
}

function chooseTransitionExampleCondition(from, to, example) {
  if (from === example.fallback?.from && to === example.fallback?.to) {
    return example.fallback.condition;
  }

  return "Bedingung eintragen";
}

function insertPlantUmlLineBeforeEnd(source, lineToInsert) {
  return insertPlantUmlLinesBeforeEnd(source, [lineToInsert]);
}

function insertPlantUmlLinesBeforeEnd(source, linesToInsert) {
  const lines = source.split("\n");
  const existingIndex = findExistingLineSequence(lines, linesToInsert);

  if (existingIndex >= 0) {
    const selectionStart = lineOffset(source, existingIndex);
    const selectedText = linesToInsert.join("\n");
    return {
      source,
      selectionStart,
      selectionEnd: selectionStart + selectedText.length,
    };
  }

  const endIndex = lines.findIndex((line) => line.trim() === "@enduml");
  const insertIndex = endIndex >= 0 ? endIndex : lines.length;
  lines.splice(insertIndex, 0, ...linesToInsert);

  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  const selectedText = linesToInsert.join("\n");
  return {
    source: nextSource,
    selectionStart,
    selectionEnd: selectionStart + selectedText.length,
  };
}

function findExistingLineSequence(lines, sequence) {
  return lines.findIndex((_, index) =>
    sequence.every((line, offset) => lines[index + offset]?.trim() === line.trim())
  );
}

function insertPlantUmlLineIntoNote(source, noteStart, lineToInsert) {
  const lines = source.split("\n");
  const noteStartIndex = lines.findIndex((line) => line.trim() === noteStart.trim());
  const existingIndex = lines.findIndex((line) => line.trim() === lineToInsert.trim());

  if (existingIndex >= 0) {
    const selectionStart = lineOffset(source, existingIndex);
    return {
      source,
      selectionStart,
      selectionEnd: selectionStart + lines[existingIndex].length,
    };
  }

  let insertIndex = -1;
  if (noteStartIndex >= 0) {
    insertIndex = lines.findIndex((line, index) => index > noteStartIndex && line.trim() === "end note");
  }

  if (insertIndex < 0) {
    return insertPlantUmlLinesBeforeEnd(source, [noteStart, lineToInsert, "end note"]);
  }

  lines.splice(insertIndex, 0, lineToInsert);
  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  return {
    source: nextSource,
    selectionStart,
    selectionEnd: selectionStart + lineToInsert.length,
  };
}

function insertLinesIntoPlantUmlBlock(source, block, linesToInsert) {
  const lines = source.split("\n");
  const existingAliases = new Set(
    parsePlantUmlStates(source)
      .map((state) => state.alias)
      .filter(Boolean)
  );
  const linesToAdd = linesToInsert.filter((line) => {
    const state = parsePlantUmlStateLine(line);
    return !state?.alias || !existingAliases.has(state.alias);
  });

  if (!linesToAdd.length) {
    const firstExistingIndex = lines.findIndex((line) => linesToInsert.includes(line));
    const selectionStart = firstExistingIndex >= 0
      ? lineOffset(source, firstExistingIndex)
      : 0;
    const selectionEnd = firstExistingIndex >= 0
      ? selectionStart + linesToInsert.join("\n").length
      : 0;
    return { source, selectionStart, selectionEnd };
  }

  let blockDepth = 0;
  let blockStartIndex = -1;
  let insertIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (blockStartIndex === -1 && isPlantUmlBlockStart(lines[index], block)) {
      blockStartIndex = index;
      blockDepth = 1;
      continue;
    }

    if (blockStartIndex === -1) continue;

    if (trimmed.endsWith("{")) blockDepth += 1;
    if (trimmed === "}") blockDepth -= 1;

    if (blockDepth === 0) {
      insertIndex = index;
      break;
    }
  }

  if (insertIndex === -1) {
    insertIndex = Math.max(lines.length - 1, 0);
  }

  lines.splice(insertIndex, 0, ...linesToAdd);
  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  const selectionEnd = selectionStart + linesToAdd.join("\n").length;
  return { source: nextSource, selectionStart, selectionEnd };
}

function parsePlantUmlStates(source) {
  return source
    .split(/\r?\n/)
    .map(parsePlantUmlStateLine)
    .filter(Boolean);
}

function parsePlantUmlStateLine(line) {
  const match = line.trim().match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!match) return null;
  return { label: match[1], alias: match[2] };
}

function lineOffset(source, lineIndex) {
  if (lineIndex <= 0) return 0;
  return source
    .split("\n")
    .slice(0, lineIndex)
    .join("\n").length + 1;
}

function wirePlantUmlDiagrams(stepItem) {
  if (stepItem.visual?.type !== "tamagotchiMachine") return;

  editor.querySelectorAll("[data-plantuml-source]").forEach((image) => {
    renderPlantUmlImage(image, image.dataset.plantumlSource || "");
  });
}

async function renderPlantUmlImage(image, source) {
  const status = image.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
  image.classList.remove("loaded");

  if (!source) return;

  try {
    image.src = await createPlantUmlSvgUrl(source);
    image.addEventListener("load", () => {
      image.classList.add("loaded");
      if (status) status.textContent = "Gerendert aus PlantUML.";
    }, { once: true });
    image.addEventListener("error", () => {
      if (status) status.textContent = "PlantUML-Bild konnte nicht geladen werden.";
    }, { once: true });
  } catch {
    if (status) status.textContent = "PlantUML-Bild konnte im Browser nicht erzeugt werden.";
  }
}

async function createPlantUmlSvgUrl(source) {
  const bytes = new TextEncoder().encode(source);
  const compressed = await deflateForPlantUml(bytes);
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
}

async function deflateForPlantUml(bytes) {
  if (typeof CompressionStream === "undefined") {
    throw new Error("CompressionStream unavailable");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.slice(2, -4);
}

function encodePlantUmlBytes(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    output += appendPlantUml3Bytes(
      bytes[index],
      bytes[index + 1] ?? 0,
      bytes[index + 2] ?? 0,
    );
  }
  return output;
}

function appendPlantUml3Bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return encodePlantUml6Bit(c1 & 0x3f)
    + encodePlantUml6Bit(c2 & 0x3f)
    + encodePlantUml6Bit(c3 & 0x3f)
    + encodePlantUml6Bit(c4 & 0x3f);
}

function encodePlantUml6Bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}
function renderEditableLineLabel(stepItem) {
  if (stepItem.editableLines.length === 0) {
    return "Nur erklären";
  }

  return `Editierbar: Zeile${stepItem.editableLines.length > 1 ? "n" : ""} ${stepItem.editableLines.join(", ")}`;
}

function renderPanel() {
  if (isComplete) {
    const summary = createCompletionSummary(lesson);
    sidePanel.innerHTML = `
      <p class="step-kicker">${escapeHtml(summary.eyebrow || "Lernrückblick")}</p>
      <h2>${escapeHtml(summary.title || lesson.title)}</h2>
      <p class="complete-note">${escapeHtml(summary.text)}</p>
      ${renderSummaryList(summary.learned)}
      ${summary.next ? `<div class="next-box"><strong>Nächster Schritt:</strong> ${escapeHtml(summary.next)}</div>` : ""}
      <div class="meta-box">
        <span>${escapeHtml(lesson.projectIdeaId)}</span>
        <span>${escapeHtml(lesson.projectVariantId)}</span>
      </div>
      <div class="panel-spacer"></div>
      <div class="actions">
        <button type="button" data-action="back">Zurück</button>
        <button type="button" class="primary" data-action="restart">Neu starten</button>
      </div>
    `;
    wirePanelButtons();
    return;
  }

  const stepItem = currentStep();
  const validationState = getValidationState(stepItem);
  const primaryActionLabel = stepItem.endButtonLabel
    || (currentStepIndex === lesson.steps.length - 1 ? "Abschließen" : "Weiter");

  sidePanel.innerHTML = `
    <p class="step-kicker">${stepItem.pattern}</p>
    <h2>${lesson.title}</h2>
    <h3>${stepItem.title}</h3>
    ${renderPanelStepText(stepItem)}
    ${renderModelingNote(stepItem)}
    ${renderStepMedia(stepItem)}
    ${renderDecisionControl(stepItem)}
    ${renderCompletionCondition(stepItem, validationState)}
    ${renderValidationApplyAction(stepItem)}
    ${renderValidation(validationState)}
    ${renderRuntimePreviewAction(stepItem, validationState)}
    ${renderAuthoringEditor(stepItem)}
    <div class="panel-spacer"></div>
    <p class="step-progress">Schritt ${currentStepIndex + 1} von ${lesson.steps.length}</p>
    <div class="actions">
      <button type="button" data-action="back" ${currentStepIndex === 0 ? "disabled" : ""}>Zurück</button>
      <button type="button" class="primary" data-action="next" ${validationState.canContinue ? "" : "disabled"}>${escapeHtml(primaryActionLabel)}</button>
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

function renderPanelStepText(stepItem) {
  if (stepItem.endScreen) {
    return `<p class="step-text">${escapeHtml(stepItem.panelText || "Der freie Kurs ist abgeschlossen. Beende den Kurs, wenn du bereit bist.")}</p>`;
  }

  if (stepItem.panelTextParts?.length) {
    return `
      <div class="step-text">
        ${stepItem.panelTextParts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}
      </div>
    `;
  }

  if (stepItem.visual?.type === "tamagotchiMachine") {
    return `<p class="step-text">${escapeHtml(stepItem.text)}</p>`;
  }

  const text = stepItem.visual
    ? "Lies die Erklärung links direkt zusammen mit den Bildern. Rechts bestätigst du nur den Schritt und siehst das Ergebnis."
    : stepItem.text;

  return `<p class="step-text">${escapeHtml(text)}</p>`;
}

function renderModelingNote(stepItem) {
  const note = stepItem.modelingNote;
  if (!note) return "";

  return `
    <section class="modeling-note">
      <h4>${escapeHtml(note.title)}</h4>
      ${(note.paragraphs || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      ${note.bullets?.length ? `<ul>${note.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${(note.closing || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
    </section>
  `;
}

function createCompletionSummary(lessonItem) {
  if (lessonItem.completionSummary) return lessonItem.completionSummary;

  return {
    eyebrow: "Lernrückblick",
    title: `Was du in ${lessonItem.title} gelernt hast`,
    text: "Die Lektion ist abgeschlossen. Du hast die wichtigsten Beobachtungen Schritt für Schritt aufgebaut.",
    learned: lessonItem.steps
      .map((stepItem) => stepItem.outcome)
      .filter(Boolean)
      .slice(0, 5),
    next: "Von hier aus kann die Projektidee vertieft oder in eine konkrete Umsetzung überführt werden.",
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
    ? validationState.canContinue ? "erfüllt" : "offen"
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

function renderValidationApplyAction(stepItem) {
  if (!stepItem.validation?.applyLabel) return "";

  return `
    <div class="validation-action">
      <button type="button" class="primary full" data-action="apply-validation">${escapeHtml(stepItem.validation.applyLabel)}</button>
    </div>
  `;
}

function renderRuntimePreviewAction(stepItem, validationState) {
  if (stepItem.runtimePreview?.type !== "tamagotchiBrowserApp") return "";

  const disabled = validationState.canContinue ? "" : "disabled";
  const title = validationState.canContinue
    ? "App ausführen"
    : "Run ist verfügbar, sobald die Abschlussbedingungen erfüllt sind.";

  return `
    <div class="runtime-preview-action">
      <button type="button" class="primary full" data-action="run-tamagotchi-preview" ${disabled} title="${escapeAttribute(title)}">${escapeHtml(stepItem.runtimePreview.buttonLabel || "Run")}</button>
    </div>
  `;
}

function getValidationState(stepItem) {
  if (stepItem.completion?.type === "decisionRequired") {
    const result = resolveCompletionResult(stepItem);
    return {
      canContinue: Boolean(result),
      message: result
        ? `Abschlussbedingung erfüllt: ${stepItem.completion.label}.`
        : `Weiter geht es, sobald die Abschlussbedingung erfüllt ist: ${stepItem.completion.label}.`,
    };
  }

  if (stepItem.validation?.type === "knownBoardPinOrIntegerRange") {
    return validateKnownBoardPinOrIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "integerRange") {
    return validateIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "profileTextContainsAll") {
    return validateProfileTextContainsAll(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlStateInBlock") {
    return validatePlantUmlStateInBlock(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlAdditionalStateInBlock") {
    return validatePlantUmlAdditionalStateInBlock(stepItem.validation);
  }

  if (stepItem.validation?.type === "plantUmlTransitionToAdditionalState") {
    return validatePlantUmlTransitionToAdditionalState(stepItem.validation);
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
      ? `Validierung erfüllt: ${stepItem.expectedContains}`
      : `Weiter geht es, sobald der Code ${stepItem.expectedContains} enthält.`,
  };
}

function validateProfileTextContainsAll(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const missing = (rule.contains || []).filter((item) => !text.includes(item));

  return {
    canContinue: missing.length === 0,
    message: missing.length === 0
      ? `Validierung erfüllt: ${rule.label}.`
      : `Weiter geht es, sobald die PlantUML-Quelle enthält: ${missing[0]}.`,
  };
}

function validatePlantUmlStateInBlock(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const lines = text.split(/\r?\n/);
  const blockStartIndex = lines.findIndex((line) => isPlantUmlBlockStart(line, rule.block));
  const expectedLine = rule.line;

  if (blockStartIndex < 0) {
    return {
      canContinue: false,
      message: `Der Block ${rule.block} wurde nicht gefunden.`,
    };
  }

  for (let index = blockStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "}") break;
    if (line === expectedLine) {
      return {
        canContinue: true,
        message: `Syntax geprüft: ${rule.label} steht im Block ${rule.block}.`,
      };
    }
  }

  return {
    canContinue: false,
    message: `Füge im Block ${rule.block} die Zeile hinzu: ${expectedLine}.`,
  };
}

function validatePlantUmlAdditionalStateInBlock(rule) {
  const states = getPlantUmlStatesInBlock(rule);
  const existingAliases = new Set(rule.existingAliases || []);
  const addedStates = states.filter((state) => !existingAliases.has(state.alias));
  const minStates = rule.minStates || 1;

  if (addedStates.length >= minStates) {
    return {
      canContinue: true,
      message: `Syntax geprüft: ${addedStates.map((state) => state.label).join(", ")} wurden als neue States im Block ${rule.block} erkannt.`,
    };
  }

  return {
    canContinue: false,
    message: `Füge im Block ${rule.block} mindestens ${minStates} neue States nach dem Schema state "Name" as alias hinzu.`,
  };
}

function validatePlantUmlTransitionToAdditionalState(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  const states = getPlantUmlStatesInBlock(rule);
  const existingAliases = new Set(rule.existingAliases || []);
  const minStates = rule.minStates || 1;
  const addedAliases = new Set(states
    .filter((state) => !existingAliases.has(state.alias))
    .map((state) => state.alias));

  if (addedAliases.size < minStates) {
    return {
      canContinue: false,
      message: `Ergänze zuerst mindestens ${minStates} selbst gewählte neue States.`,
    };
  }

  const rejectedConditions = new Set((rule.rejectConditions || []).map((item) => item.toLowerCase()));
  const transition = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      const condition = match?.[3]?.trim() || "";
      return match
        && addedAliases.has(match[1])
        && addedAliases.has(match[2])
        && condition.length > 0
        && !rejectedConditions.has(condition.toLowerCase());
    });

  if (transition) {
    return {
      canContinue: true,
      message: `Syntax geprüft: Transition zwischen deinen neuen States erkannt: ${transition}.`,
    };
  }

  return {
    canContinue: false,
    message: "Ergänze eine vollständige Transition mit echter Bedingung oder Aktion, zum Beispiel nicht_durstig --> durstig : Durst >= 50.",
  };
}

function getPlantUmlStatesInBlock(rule) {
  const text = lesson.learnerProfile?.[rule.profileField] || "";
  return getPlantUmlStatesInBlockFromText(text, rule.block);
}

function getPlantUmlStatesInBlockFromText(text, block) {
  const lines = text.split(/\r?\n/);
  const blockStartIndex = lines.findIndex((line) => isPlantUmlBlockStart(line, block));

  if (blockStartIndex < 0) return [];

  const states = [];
  for (let index = blockStartIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "}") break;

    const match = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
    if (match) {
      states.push({ label: match[1], alias: match[2] });
    }
  }

  return states;
}

function isPlantUmlBlockStart(line, block) {
  const trimmed = line.trim();
  return trimmed.startsWith(block) && trimmed.endsWith("{");
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
      ? `Validierung erfüllt: Für ${boardTitle} ist ${rule.label} = ${expectedPin} hinterlegt.`
      : `Dein Profil kennt ${boardTitle}. Dafür muss ${rule.label} auf ${expectedPin} stehen. Aktueller Wert: ${value}.`,
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
      ? `Validierung erfüllt: ${rule.label} liegt im Bereich ${rule.min}..${rule.max}.`
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

      if (action === "apply-validation") {
        renderPanel();
      }

      if (action === "run-tamagotchi-preview") {
        if (!getValidationState(currentStep()).canContinue) return;
        openTamagotchiRunPreview();
      }

      if (action === "restart") {
        currentStepIndex = 0;
        navigationHistory = [];
        isComplete = false;
        isWelcomeVisible = true;
        localStorage.removeItem(runtimeStorageKey(lesson.slug));
        resetLessonRuntimeState(lesson);
        codeLines = lesson.source.replace(/\n$/, "").split("\n");
        render();
      }
    });
  });
}

function openTamagotchiRunPreview() {
  closeTamagotchiRunPreview();

  const transitions = lesson.learnerProfile?.tamagotchiTransitions || {};
  const source = lesson.learnerProfile?.tamagotchiPlantUmlSource || "";
  const customStates = getCustomTamagotchiStatesFromSource(source);
  getCustomTamagotchiTransitionsFromSource(source, customStates);
  const runtimeModel = parseTamagotchiRuntimeModel(source);
  let hunger = parsePlantUmlInitialValue(source, "Hunger", 45);
  let thirst = parsePlantUmlInitialValue(source, "Durst", null);
  let canClose = false;

  const overlay = document.createElement("div");
  overlay.className = "runtime-modal";
  overlay.dataset.runtimeModal = "tamagotchi";
  overlay.innerHTML = `
    <section class="runtime-dialog" role="dialog" aria-modal="true" aria-label="Tamagotchi Webanwendung">
      <div class="runtime-dialog-header">
        <div>
          <p class="step-kicker">Ausführbare Webanwendung</p>
          <h2>Tamagotchi</h2>
        </div>
        <button type="button" class="runtime-close" data-action="close-runtime-preview" aria-label="Schließen" disabled title="Schließen ist möglich, sobald das Tamagotchi hungrig ist.">×</button>
      </div>
      <div class="tamagotchi-app-preview">
        <div class="tamagotchi-pet" data-tamagotchi-pet aria-hidden="true">
          <div class="tamagotchi-face">
            <span></span>
            <span></span>
            <i></i>
          </div>
        </div>
        <div class="tamagotchi-data">
          <dl>
            <div>
              <dt>Name</dt>
              <dd>Tama</dd>
            </div>
            <div>
              <dt>Zustand</dt>
              <dd data-tamagotchi-life>lebendig</dd>
            </div>
            <div>
              <dt>Unterzustand</dt>
              <dd data-tamagotchi-substate>satt</dd>
            </div>
            <div>
              <dt>Hunger</dt>
              <dd data-tamagotchi-hunger>${hunger} / 100</dd>
            </div>
            ${thirst === null ? "" : `
              <div>
                <dt>Durst</dt>
                <dd data-tamagotchi-thirst>${thirst} / 100</dd>
              </div>
            `}
            <div>
              <dt>Letzte Fütterung</dt>
              <dd>gerade eben</dd>
            </div>
          </dl>
        </div>
      </div>
      <div class="runtime-transition-list">
        <strong>Übergänge aus dem Modell</strong>
        <ul>
          <li>satt → hungrig: ${escapeHtml(transitions.sattToHungry || "Hunger >= 50")}</li>
          <li>hungrig → satt: ${escapeHtml(transitions.hungryToSatt || "füttern")}</li>
          <li>hungrig → tot: ${escapeHtml(transitions.hungryToDead || "Hunger = 100")}</li>
          ${customStates.map((state) => `<li>${escapeHtml(state.from || "eigener State")} → ${escapeHtml(state.label)}: ${escapeHtml(state.condition || "noch offen")}</li>`).join("")}
        </ul>
      </div>
      <p class="runtime-close-note" data-runtime-close-note>Das Fenster lässt sich schließen, sobald der Zustand zu hungrig wechselt.</p>
    </section>
  `;

  overlay.addEventListener("click", (event) => {
    const action = event.target.dataset?.action;
    if ((action === "close-runtime-preview" || event.target === overlay) && canClose) {
      closeTamagotchiRunPreview();
    }
  });

  document.body.append(overlay);

  updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel);

  overlay.runtimeTimer = window.setInterval(() => {
    hunger = Math.min(100, hunger + runtimeModel.hungerIncrement);
    if (thirst !== null && runtimeModel.thirstIncrement > 0) {
      thirst = Math.min(100, thirst + runtimeModel.thirstIncrement);
    }
    updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel);
    const state = resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel);
    canClose = state.isHungry || state.isThirsty || state.isDead;
    updateTamagotchiRunPreviewCloseState(overlay, canClose);
  }, 3000);
}

function getCustomTamagotchiStatesFromSource(source) {
  const states = getPlantUmlStatesInBlockFromText(source, 'state "lebendig"');
  const builtInAliases = new Set(["satt", "hungrig"]);
  return states.filter((state) => !builtInAliases.has(state.alias));
}

function getCustomTamagotchiTransitionsFromSource(source, states) {
  const byAlias = new Map(states.map((state) => [state.alias, state]));

  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      if (!match || !byAlias.has(match[2])) return;
      const state = byAlias.get(match[2]);
      state.from = match[1];
      state.condition = match[3].trim();
    });

  return states;
}

function parsePlantUmlInitialValue(source, name, fallback) {
  const match = source.match(new RegExp(`^\\s*${escapeRegExp(name)}\\s*=\\s*(-?\\d+)\\s*$`, "mi"));
  return match ? Number(match[1]) : fallback;
}

function parseTamagotchiRuntimeModel(source) {
  return {
    hungerIncrement: parsePlantUmlTickIncrement(source, "Hunger"),
    thirstIncrement: parsePlantUmlTickIncrement(source, "Durst"),
    transitions: parsePlantUmlTransitions(source),
  };
}

function parsePlantUmlTickIncrement(source, name) {
  const match = source.match(new RegExp(`${escapeRegExp(name)}\\s*=\\s*${escapeRegExp(name)}\\s*\\+\\s*(\\d+)`, "i"));
  return match ? Number(match[1]) : 0;
}

function parsePlantUmlTransitions(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      from: match[1],
      to: match[2],
      condition: match[3].trim(),
    }));
}

function updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel) {
  const state = resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel);
  const hungerDisplay = overlay.querySelector("[data-tamagotchi-hunger]");
  const thirstDisplay = overlay.querySelector("[data-tamagotchi-thirst]");
  const lifeDisplay = overlay.querySelector("[data-tamagotchi-life]");
  const substateDisplay = overlay.querySelector("[data-tamagotchi-substate]");
  const petDisplay = overlay.querySelector("[data-tamagotchi-pet]");

  if (hungerDisplay) hungerDisplay.textContent = `${hunger} / 100`;
  if (thirstDisplay) thirstDisplay.textContent = `${thirst} / 100`;
  if (lifeDisplay) lifeDisplay.textContent = state.isDead ? "tot" : "lebendig";
  if (substateDisplay) substateDisplay.textContent = state.isDead ? "-" : renderTamagotchiSubstateLabel(state.isHungry, state.isThirsty);
  if (petDisplay) petDisplay.classList.toggle("is-hungry", state.isHungry || state.isThirsty);
  if (petDisplay) petDisplay.classList.toggle("is-dead", state.isDead);
}

function resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel) {
  const isHungry = hasTriggeredTransition(runtimeModel, "satt", "hungrig", { Hunger: hunger, Durst: thirst });
  const isThirsty = thirst !== null
    && hasTriggeredTransition(runtimeModel, "nicht_durstig", "durstig", { Hunger: hunger, Durst: thirst });
  const activeAliases = new Set(["satt", "nicht_durstig"]);
  if (isHungry) activeAliases.add("hungrig");
  if (isThirsty) activeAliases.add("durstig");

  const isDead = runtimeModel.transitions.some((transition) =>
    transition.to === "tot"
    && activeAliases.has(transition.from)
    && evaluateSimpleCondition(transition.condition, { Hunger: hunger, Durst: thirst })
  );

  return { isDead, isHungry, isThirsty };
}

function hasTriggeredTransition(runtimeModel, from, to, values) {
  return runtimeModel.transitions.some((transition) =>
    transition.from === from
    && transition.to === to
    && evaluateSimpleCondition(transition.condition, values)
  );
}

function evaluateSimpleCondition(condition, values) {
  const match = condition.match(/^(Hunger|Durst)\s*(>=|=|==|>|<=|<)\s*(-?\d+)$/i);
  if (!match) return false;

  const valueName = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const currentValue = values[valueName];
  const targetValue = Number(match[3]);
  if (currentValue === null || currentValue === undefined) return false;

  if (match[2] === ">=") return currentValue >= targetValue;
  if (match[2] === ">" ) return currentValue > targetValue;
  if (match[2] === "<=") return currentValue <= targetValue;
  if (match[2] === "<") return currentValue < targetValue;
  return currentValue === targetValue;
}

function renderTamagotchiSubstateLabel(isHungry, isThirsty) {
  if (isHungry && isThirsty) return "hungrig / durstig";
  if (isHungry) return "hungrig";
  if (isThirsty) return "durstig";
  return "satt";
}

function updateTamagotchiRunPreviewCloseState(overlay, canClose) {
  const closeButton = overlay.querySelector('[data-action="close-runtime-preview"]');
  const closeNote = overlay.querySelector("[data-runtime-close-note]");

  if (closeButton) {
    closeButton.disabled = !canClose;
    closeButton.title = canClose
      ? "Schließen"
      : "Schließen ist möglich, sobald das Tamagotchi hungrig ist.";
  }

  if (closeNote) {
    closeNote.textContent = canClose
      ? "Das Tamagotchi ist hungrig. Das Fenster kann jetzt geschlossen werden."
      : "Das Fenster lässt sich schließen, sobald der Zustand zu hungrig wechselt.";
    closeNote.classList.toggle("ok", canClose);
  }
}

function closeTamagotchiRunPreview() {
  const overlay = document.querySelector('[data-runtime-modal="tamagotchi"]');
  if (!overlay) return;
  window.clearInterval(overlay.runtimeTimer);
  overlay.remove();
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

function persistRuntimeEdits() {
  normalizeTamagotchiRuntimeState(lesson);
  localStorage.setItem(runtimeStorageKey(lesson.slug), JSON.stringify({
    tamagotchiTransitions: lesson.learnerProfile?.tamagotchiTransitions || {},
  }));
}

function applyStoredRuntimeEdits(lessonItem) {
  const raw = localStorage.getItem(runtimeStorageKey(lessonItem.slug));
  if (!raw) return;

  try {
    const payload = JSON.parse(raw);
    lessonItem.learnerProfile = {
      ...(lessonItem.learnerProfile || {}),
      tamagotchiTransitions: {
        ...(lessonItem.learnerProfile?.tamagotchiTransitions || {}),
        ...(payload.tamagotchiTransitions || {}),
      },
      tamagotchiPlantUmlSource: lessonItem.runtimeDefaults?.tamagotchiPlantUmlSource || tamagotchiPlantUmlBaseSource(),
    };
    normalizeTamagotchiRuntimeState(lessonItem);
  } catch {
    localStorage.removeItem(runtimeStorageKey(lessonItem.slug));
  }
}

function normalizeTamagotchiRuntimeState(lessonItem) {
  if (!lessonItem?.learnerProfile) return;

  const oldDeathCondition = "1 Tag nicht gefüttert";
  const newDeathCondition = "Hunger = 100";
  const source = lessonItem.learnerProfile.tamagotchiPlantUmlSource || "";
  const transitions = lessonItem.learnerProfile.tamagotchiTransitions || {};

  lessonItem.learnerProfile = {
    ...lessonItem.learnerProfile,
    tamagotchiTransitions: {
      ...transitions,
      hungryToDead: transitions.hungryToDead === oldDeathCondition
        ? newDeathCondition
        : transitions.hungryToDead || newDeathCondition,
    },
    tamagotchiPlantUmlSource: source
      .replaceAll(`hungrig --> tot : ${oldDeathCondition}`, `hungrig --> tot : ${newDeathCondition}`),
  };
}

function storageKey(slug) {
  return `gernetix.guided-code-lesson.${slug}.authoring`;
}

function runtimeStorageKey(slug) {
  return `gernetix.guided-code-lesson.${slug}.runtime`;
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
