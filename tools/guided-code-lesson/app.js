const lessons = [
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
      step("06_connected_extension", "step_pattern.variant_comparison", "Von einem Sensor zu vielen", "Mehrere Sensoren fuehren zur Architekturfrage: lokal, Master-Knoten oder Server.", [7]),
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
      "Monitoring: Verlauf, Pumpenlaufzeit und Nachfuellmenge sichtbar machen.",
    ],
    steps: [
      step("01_motivation", "step_pattern.motivation_application", "Wofür ist die Steuerung gut?", "Der Nutzen und das Risiko werden gleichzeitig sichtbar.", [2]),
      step("02_sensor", "step_pattern.system_boundary", "Feuchtigkeit messen", "Sensorwerte werden zur Eingangsseite der Steuerung.", [3]),
      step("03_actor", "step_pattern.minimal_local_function", "Pumpe schalten", "Die Pumpe ist die Ausgangsseite der Steuerung.", [4]),
      step("04_control", "step_pattern.observable_effect", "Erste Steuerlogik", "Ein einfacher Grenzwert koppelt Sensor und Aktor.", [5]),
      step("05_problem", "step_pattern.problem_observation", "Flattern und Nachlauf", "Das reale System verhält sich träger als die if-Bedingung.", [6]),
      step("06_safety", "step_pattern.failure_safety_boundaries", "Fehlerfälle begrenzen", "Sicherheit wird Teil der Funktion, nicht ein später Zusatz.", [7]),
      step("07_monitoring", "step_pattern.reflection_inspiration_sales_bridge", "Was wird sichtbar?", "Mess- und Pumpenverlauf bilden die Bruecke zu Logging und Connected-Projekten.", [8]),
    ],
  }),
  createIdeaPreviewLesson({
    projectIdeaId: "project_idea.climate_box_control",
    projectVariantId: "variant.local_climate_box_control",
    slug: "climate-box-control",
    title: "Klimabox regeln",
    file: "climate-box-control.yaml",
    summary: "Temperatursensoren, Lüfter, Peltier-Element und Regelverhalten in einer kleinen kontrollierten Umgebung zusammenfuehren.",
    lines: [
      "Projektidee: Klimabox",
      "Motivation: kontrollierte Temperatur für Teig, Pflanzen, Tests oder Elektronik.",
      "Hardware: Box, mehrere Temperatursensoren, Lüfter, Peltier-Element, Leistungsstufen.",
      "Erster Betrieb: Temperatur messen und Lüfter schalten.",
      "Problem: Ein/Aus-Regelung erzeugt Schwingen und Verschleiß.",
      "Regelung: Stellgrößen, Schwellen, Hysterese und langsame Zyklen betrachten.",
      "Sicherheit: Thermoplastik, Überhitzung, Peltier-Schutz und Luftfuehrung beachten.",
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
      step("05_authorization", "step_pattern.solution_introduction", "Rechte pruefen", "Autorisierung wird getrennt von Identifizierung modelliert.", [6]),
      step("06_enrollment", "step_pattern.observable_effect", "Tag anlernen", "Der Nutzer erzeugt lokal eine neue Berechtigung.", [7]),
      step("07_connected", "step_pattern.variant_comparison", "Wann braucht man ESP32?", "Benachrichtigung und Netzwerk werden als Variantenerweiterung eingeordnet.", [8]),
    ],
  }),
];

let lesson = lessons[0];
let currentStepIndex = 0;
let isComplete = false;
let codeLines = [];
let isEditMode = false;

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

function createActuatorOutputBasicsLesson() {
  return {
    projectIdeaId: "project_idea.actuator_output_basics",
    projectVariantId: "variant.basic_gpio_pwm_node",
    slug: "actuator-output-basics",
    title: "Aktorik-Schnupperkurs: LED verstehen",
    file: "blink.ino",
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
    source: `${config.lines.join("\n")}\n`,
    learnerProfile: { boardKey: "unknown" },
    boardProfiles: { unknown: { title: "Nicht relevant für diese Vorschau" } },
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
  isComplete = false;
  codeLines = lesson.source.replace(/\n$/, "").split("\n");

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("project", lesson.slug);
    window.history.replaceState({}, "", url);
  }

  render();
}

function currentStep() {
  return lesson.steps[currentStepIndex];
}

function render() {
  fileName.textContent = lesson.file;
  renderEditor();
  renderPanel();
}

function renderEditor() {
  const step = currentStep();
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

function renderEditableLineLabel(stepItem) {
  if (stepItem.editableLines.length === 0) {
    return "Nur erklären";
  }

  return `Editierbar: Zeile${stepItem.editableLines.length > 1 ? "n" : ""} ${stepItem.editableLines.join(", ")}`;
}

function renderPanel() {
  if (isComplete) {
    sidePanel.innerHTML = `
      <p class="step-kicker">Abgeschlossen</p>
      <h2>${lesson.title}</h2>
      <p class="complete-note">Diese Projektidee wurde Schritt für Schritt als Flow betrachtet. In der echten Plattform kann daraus ein LearningProject mit ProjectFlowItems, Lessons, ProjectSteps, Varianten und Conditions entstehen.</p>
      <div class="meta-box">
        <span>${lesson.projectIdeaId}</span>
        <span>${lesson.projectVariantId}</span>
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

  sidePanel.innerHTML = `
    <p class="step-kicker">${stepItem.pattern}</p>
    <h2>${lesson.title}</h2>
    <h3>${stepItem.title}</h3>
    <p class="step-text">${stepItem.text}</p>
    <div class="outcome-box"><strong>Ergebnis:</strong> ${stepItem.outcome}</div>
    ${renderStepMedia(stepItem)}
    <div class="meta-box">
      <span>${stepItem.id}</span>
      <span>${stepItem.flowItemId}</span>
      <span>${renderBoardProfileLabel()}</span>
    </div>
    ${renderValidation(validationState)}
    ${renderAuthoringEditor(stepItem)}
    <div class="panel-spacer"></div>
    <p class="step-progress">Schritt ${currentStepIndex + 1} von ${lesson.steps.length}</p>
    <div class="actions">
      <button type="button" data-action="back" ${currentStepIndex === 0 ? "disabled" : ""}>Zurück</button>
      <button type="button" class="primary" data-action="next" ${validationState.canContinue ? "" : "disabled"}>${currentStepIndex === lesson.steps.length - 1 ? "Abschließen" : "Weiter"}</button>
    </div>
  `;
  wirePanelButtons();
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
  if (stepItem.validation?.type === "knownBoardPinOrIntegerRange") {
    return validateKnownBoardPinOrIntegerRange(stepItem.validation);
  }

  if (stepItem.validation?.type === "integerRange") {
    return validateIntegerRange(stepItem.validation);
  }

  if (!stepItem.expectedContains) {
    return { canContinue: true, message: "" };
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
  sidePanel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "back") {
        goBack();
      }

      if (action === "next") {
        goNext();
      }

      if (action === "save-step") {
        saveCurrentStepEdits();
      }

      if (action === "restart") {
        currentStepIndex = 0;
        isComplete = false;
        codeLines = lesson.source.replace(/\n$/, "").split("\n");
        render();
      }
    });
  });
}

function goBack() {
  if (isComplete) {
    isComplete = false;
    currentStepIndex = lesson.steps.length - 1;
    render();
    return;
  }

  currentStepIndex = Math.max(0, currentStepIndex - 1);
  render();
}

function goNext() {
  if (!getValidationState(currentStep()).canContinue) {
    return;
  }

  if (currentStepIndex === lesson.steps.length - 1) {
    isComplete = true;
  } else {
    currentStepIndex += 1;
  }

  render();
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

