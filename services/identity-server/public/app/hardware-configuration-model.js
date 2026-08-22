/*
 * Modell der Hardwarekonfiguration eines Entwicklungsprojekts.
 *
 * Herausgeloest aus development-platform.js: Bauteilkataloge, Pinbelegung,
 * Schaltungsableitung und die Pruefung einer Konfiguration. Alle Funktionen
 * arbeiten nur mit ihren Parametern.
 *
 * boardPins und hardwareConnectionPathAssessment bekommen die Boardliste
 * uebergeben. In der Plattform lasen sie sie aus deren Zustand; als Parameter
 * ist die Abhaengigkeit sichtbar und die Funktion ohne Plattform pruefbar.
 *
 * Das Aufbauen der Formulare und das Anzeigen der Befunde bleibt in der
 * Plattform: beides braucht deren Zustand und DOM-Helfer.
 */

function processorLabel(processor) {
  const familyLabels = {
    esp32: "ESP32",
    esp8266: "ESP8266",
    avr_8bit: "AVR 8-bit",
    raspberry_pi: "Raspberry Pi",
  };
  const family = familyLabels[processor.family] || processor.family;
  if (processor.family === "esp32") {
    return processor.variant === "ESP32" ? "ESP32 (klassisch)" : processor.variant;
  }
  return processor.variant.toLowerCase() === String(family).toLowerCase()
    ? processor.variant
    : `${processor.variant} (${family})`;
}

function hardwareComponentType(label, plantUmlType, componentId = "") {
  return globalThis.DevelopmentComponentMetamodel?.componentTypeForPlantUml(label, plantUmlType, componentId) || "structural";
}

function abstractArchitectureComponents(source) {
  const components = [];
  String(source || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(actor|node|component|rectangle|database|cloud|queue|artifact)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (!match) return;
    const label = match[2].replace(/\\n/g, " ").trim();
    components.push({
      component_id: match[3],
      label,
      plantuml_type: match[1].toLowerCase(),
      abstract_type: hardwareComponentType(label, match[1], match[3]),
      concrete_type: "",
      sensor_category: "",
      signal_type: "",
      processor_family: "",
      processor_variant: "",
      board_profile_id: "",
      inventory_device_id: "",
      target_device_id: "",
      pin: "",
      secondary_pin: "",
      properties: {},
      circuit: null,
    });
  });
  return components;
}

function parseDevelopmentBoardPins(value) {
  const result = {};
  String(value || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean).forEach((entry) => {
    const match = entry.match(/^([a-z0-9_ -]+)\s*[=:]\s*(?:(?:gpio)?\s*(-?\d+)|nicht verbunden)$/i);
    if (!match) return;
    result[match[1].trim().toLowerCase().replace(/\s+/g, "_")] = /nicht verbunden/i.test(entry) ? -1 : Number(match[2]);
  });
  return result;
}

function actuatorTypes() {
  return [
    { id: "dc_motor", label: "DC-Motor" },
    { id: "stepper_motor", label: "Schrittmotor" },
    { id: "synchronous_motor", label: "Synchronmotor / BLDC / PMSM" },
    { id: "relay", label: "Relais" },
    { id: "servo", label: "Servo" },
    { id: "led", label: "LED" },
    { id: "buzzer", label: "Summer" },
  ];
}

function motorDriverTypes(concreteType) {
  const drivers = {
    dc_motor: [
      { id: "h_bridge", label: "H-Brücke (Drehrichtung und Drehzahl)", resources: "PWM + 2 GPIO" },
      { id: "low_side_mosfet", label: "MOSFET-Treiber (eine Drehrichtung)", resources: "PWM + GPIO" },
    ],
    servo: [
      { id: "servo_pwm", label: "Servo-PWM-Treiber", resources: "PWM + Zeitgeber" },
    ],
    stepper_motor: [
      { id: "step_dir", label: "STEP/DIR-Schrittmotortreiber", resources: "Zeitgeber/RMT + 2 GPIO" },
      { id: "four_phase", label: "4-Phasen-Treiber", resources: "4 GPIO + Zeitgeber" },
    ],
    synchronous_motor: [
      { id: "three_phase_foc", label: "3-Phasen-Treiber mit FOC", resources: "Motor-PWM + 3 Phasen + ADC + Rotorlage" },
      { id: "three_phase_six_step", label: "3-Phasen-Treiber mit 6-Step-Kommutierung", resources: "Motor-PWM + 3 Phasen + Rotorlage" },
    ],
  };
  return drivers[concreteType] || [];
}

function requiresAdditionalCircuit(component) {
  return ["pt1000", "ntc", "ptc", "dc_motor", "servo", "stepper_motor", "synchronous_motor"].includes(component.concrete_type);
}

function hardwareConnectionPathAssessment(component, targetDevice, mode, boards = []) {
  if (requiresAdditionalCircuit(component)) return "Dieser konkrete Typ benoetigt eine zusaetzliche Mess-, Treiber- oder Leistungsschaltung.";
  if (mode === "additional_circuit") return "Die Zusatzschaltung wird als eigener Teil der Signalkette gespeichert und im Verdrahtungsdiagramm dargestellt.";
  if (!component.concrete_type || !targetDevice?.board_profile_id) return "Nach Auswahl von konkretem Bauteil und Board prueft GerNetiX die verfuegbare Prozessorschnittstelle.";
  const compatiblePins = boardPins(targetDevice.board_profile_id, component, boards);
  return compatiblePins.length
    ? "Eine grundsaetzlich passende Prozessorschnittstelle ist vorhanden. Signalpegel, Strombedarf und Schutzbeschaltung muessen trotzdem zu den Datenblaettern passen."
    : "Am gewaehlten Board wurde keine passende Prozessorschnittstelle gefunden. Waehle eine Zusatzschaltung oder ein anderes Board.";
}

function pinLabel(component) {
  const type = typeof component === "object" ? component.concrete_type : component;
  const signalType = typeof component === "object" ? component.signal_type : "";
  if (signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(type)) return "Analogeingang";
  if (signalType === "i2c" || type === "i2c_sensor") return "I2C-Anschluss";
  if (signalType === "spi") return "SPI-Anschluss";
  if (signalType === "one_wire") return "1-Wire-Pin";
  if (signalType === "uart") return "UART-Anschluss";
  if (signalType === "pulse_counter") return "Zaehleingang";
  if (signalType === "incremental_ab") return "Kanal A";
  if (["dc_motor", "servo", "synchronous_motor"].includes(type)) return type === "synchronous_motor" ? "Phase U" : "PWM-Pin";
  if (type === "stepper_motor") return "STEP-Pin";
  return "GPIO-Pin";
}

function boardPins(boardId, componentOrType, boards = []) {
  const id = String(boardId || "").toLowerCase();
  if (!id) return [];
  const concreteType = typeof componentOrType === "object" ? componentOrType.concrete_type : componentOrType;
  const signalType = typeof componentOrType === "object" ? componentOrType.signal_type : "";
  const board = (Array.isArray(boards) ? boards : []).find((item) => String(item.hardware_item_id || item.hardware_profile_id || "").toLowerCase() === id);
  const profile = board?.pin_profile || {};
  if ((signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(concreteType)) && Array.isArray(profile.analog_inputs)) return profile.analog_inputs;
  if ((signalType === "i2c" || concreteType === "i2c_sensor") && Array.isArray(profile.i2c)) return profile.i2c;
  if (["dc_motor", "servo", "synchronous_motor"].includes(concreteType) && Array.isArray(profile.pwm_pins)) return profile.pwm_pins;
  if (Array.isArray(profile.digital_pins) && profile.digital_pins.length) return profile.digital_pins;
  const analog = id.includes("arduino_nano_r3") ? ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"]
    : id.includes("esp8266") || id.includes("d1_mini") ? ["A0"]
      : id.includes("raspberry") ? []
        : ["GPIO32 / ADC1_CH4", "GPIO33 / ADC1_CH5", "GPIO34 / ADC1_CH6", "GPIO35 / ADC1_CH7", "GPIO36 / ADC1_CH0", "GPIO39 / ADC1_CH3"];
  const digital = id.includes("arduino_nano_r3") ? ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"]
    : id.includes("esp8266") || id.includes("d1_mini") ? ["D1 / GPIO5", "D2 / GPIO4", "D5 / GPIO14", "D6 / GPIO12", "D7 / GPIO13"]
      : id.includes("raspberry") ? ["GPIO17", "GPIO18", "GPIO22", "GPIO23", "GPIO24", "GPIO25", "GPIO27"]
        : ["GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO16", "GPIO17", "GPIO18", "GPIO19", "GPIO21", "GPIO22", "GPIO23", "GPIO25", "GPIO26", "GPIO27"];
  if (signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(concreteType)) return analog;
  if (signalType === "i2c" || concreteType === "i2c_sensor") return id.includes("arduino_nano_r3") ? ["SDA A4 + SCL A5"] : id.includes("raspberry") ? ["SDA GPIO2 + SCL GPIO3"] : ["SDA GPIO21 + SCL GPIO22"];
  if (["dc_motor", "servo", "synchronous_motor"].includes(concreteType)) return digital.filter((pin) => /D3|D5|D6|D9|D10|D11|GPIO4|GPIO5|GPIO12|GPIO13|GPIO14|GPIO18|GPIO19|GPIO23|GPIO25|GPIO26|GPIO27/.test(pin));
  return digital;
}

function circuitFor(component) {
  if (component.concrete_type === "pt1000") return { type: "pt1000_measurement", label: "PT1000-Messschaltung", stages: ["PT1000", "Konstantstromquelle / Messbruecke", "Messverstaerker", "ADC"] };
  if (["ntc", "ptc"].includes(component.concrete_type)) return { type: "resistive_divider", label: "Widerstands-Messschaltung", stages: [component.concrete_type.toUpperCase(), "Spannungsteiler", "ADC"] };
  const driver = component.properties?.motor_driver_type || "";
  if (component.concrete_type === "dc_motor") return { type: "motor_driver", label: "DC-Motorsteuerung", stages: ["PWM / Richtung", driver === "low_side_mosfet" ? "MOSFET-Treiber" : "H-Bruecke", "DC-Motor"] };
  if (component.concrete_type === "servo") return { type: "servo_driver", label: "Servo-Steuerung", stages: ["Zeitgeber", "Servo-PWM", "Servo"] };
  if (component.concrete_type === "stepper_motor") return { type: "stepper_driver", label: "Schrittmotor-Steuerung", stages: ["Zeitgeber / RMT", driver === "four_phase" ? "4-Phasen-Treiber" : "STEP/DIR-Treiber", "Schrittmotor"] };
  if (component.concrete_type === "synchronous_motor") return { type: "synchronous_motor_driver", label: "Synchronmotor-Steuerung", stages: [driver === "three_phase_six_step" ? "6-Step-Kommutierung" : "FOC", "Motor-PWM / ADC / Rotorlage", "3-Phasen-Leistungstreiber", "BLDC / PMSM"] };
  if (component.properties?.connection_mode === "additional_circuit") {
    const label = component.properties?.circuit_label
      || (component.abstract_type === "actuator" ? "Treiber- / Leistungsschaltung" : "Signalaufbereitung / Schutzschaltung");
    return component.abstract_type === "actuator"
      ? { type: "actuator_interface_circuit", label, stages: ["Prozessorausgang", label, component.label] }
      : { type: "sensor_interface_circuit", label, stages: [component.label, label, "Prozessoreingang"] };
  }
  return null;
}

function boardFeatureForHardwareComponent(component, configuration) {
  const device = configuration.components.find((item) => item.abstract_type === "iot_device" && item.component_id === component.target_device_id);
  if (!device) return null;
  const featureId = component.abstract_type === "sensor" && component.sensor_category === "image"
    ? "camera"
    : component.abstract_type === "sensor" && component.sensor_category === "audio_input"
      ? "microphone"
    : component.abstract_type === "actuator" && component.concrete_type === "integrated_display"
      ? "display"
      : component.abstract_type === "actuator" && component.concrete_type === "integrated_speaker"
        ? "speaker"
      : "";
  const feature = featureId ? device.board_configuration?.board_features?.[featureId] : null;
  if (!feature?.enabled || !Object.keys(feature.pins || {}).length) return null;
  if (featureId === "camera" && component.concrete_type && feature.hardware && component.concrete_type !== feature.hardware) return null;
  return feature;
}

function hardwareConfigurationValidation(configuration) {
  const missing = [];
  const issues = [];
  const addIssue = (component, field, detail) => {
    const message = `${component.label}: ${detail}`;
    missing.push(message);
    issues.push({ componentId: component.component_id, field, message });
  };
  configuration.components.forEach((component) => {
    if (component.abstract_type === "iot_device" && (!component.processor_family || !component.processor_variant)) addIssue(component, "processor", "Prozessor");
    if (component.abstract_type === "iot_device" && !component.board_profile_id) addIssue(component, "board_profile_id", "reales Board");
    if (component.abstract_type === "iot_device" && component.board_configuration?.source === "custom_draft") addIssue(component, "board_configuration", "geänderte Boardkonfiguration als eigenes Board speichern");
    if (component.abstract_type === "sensor") {
      if (!component.sensor_category) addIssue(component, "sensor_category", "Sensorart");
      if (!component.signal_type) addIssue(component, "signal_type", "Erfassung");
      if (component.properties?.measurement_mode === "periodic_log") {
        if (!(Number(component.properties?.sampling_interval_value) > 0)) addIssue(component, "sampling_interval_value", "Messintervall");
        if (!(Number(component.properties?.samples_per_record) >= 1)) addIssue(component, "samples_per_record", "Werte pro Datensatz");
        if (!component.properties?.aggregation) addIssue(component, "aggregation", "Auswertung");
        if (!component.properties?.storage_mode) addIssue(component, "storage_mode", "Speicherziel");
      }
    }
    if (["sensor", "actuator"].includes(component.abstract_type)) {
      const driverSpecific = component.abstract_type === "actuator" && motorDriverTypes(component.concrete_type).length > 0;
      const boardIntegrated = String(component.concrete_type || "").startsWith("integrated_");
      const boardSuppliedPins = boardFeatureForHardwareComponent(component, configuration);
      if (!component.concrete_type) addIssue(component, "concrete_type", "konkreter Typ");
      if (!component.target_device_id) addIssue(component, "target_device_id", "IoT-Device");
      if (!boardIntegrated && !driverSpecific && !boardSuppliedPins && !component.pin) addIssue(component, "pin", "Pin");
      if (component.signal_type === "incremental_ab" && !component.secondary_pin) addIssue(component, "secondary_pin", "Kanal B");
      if (component.signal_type === "incremental_ab" && component.pin && component.secondary_pin === component.pin) {
        addIssue(component, "pin_pair", "Kanal A und B muessen verschieden sein");
      }
    }
  });
  return { complete: missing.length === 0, missing, issues };
}

function hardwareValidationTargets(row, field) {
  const selectors = {
    processor: "[data-hardware-processor]",
    board_profile_id: '[data-hardware-field="board_profile_id"], [data-hardware-field="inventory_device_id"]',
    board_configuration: "[data-development-board-configuration]",
    sensor_category: "[data-hardware-sensor-category]",
    signal_type: "[data-hardware-signal-type]",
    concrete_type: '[data-hardware-field="concrete_type"]',
    target_device_id: '[data-hardware-field="target_device_id"]',
    pin: '[data-hardware-field="pin"]',
    secondary_pin: '[data-hardware-field="secondary_pin"]',
    pin_pair: '[data-hardware-field="pin"], [data-hardware-field="secondary_pin"]',
    sampling_interval_value: '[data-hardware-property="sampling_interval_value"]',
    samples_per_record: '[data-hardware-property="samples_per_record"]',
    aggregation: '[data-hardware-property="aggregation"]',
    storage_mode: '[data-hardware-property="storage_mode"]',
  };
  return selectors[field] ? [...row.querySelectorAll(selectors[field])] : [];
}

function recommendedHardwareAction(item) {
  const detail = String(item || "").split(":").slice(1).join(":").trim();
  if (/Kanal A und B/.test(detail)) return "Wähle für Kanal A und Kanal B unterschiedliche Pins.";
  if (/Richtungspin/.test(detail)) return "Wähle einen zweiten freien Pin für die Motor-Richtung.";
  if (/Kanal B/.test(detail)) return "Wähle einen zweiten freien Pin für Kanal B.";
  if (/Prozessor/.test(detail)) return "Wähle Prozessorfamilie und Prozessorvariante für dieses IoT-Device.";
  if (/reales Board/.test(detail)) return "Wähle ein zum Prozessor passendes reales Board aus dem Hardware-Katalog.";
  if (/geänderte Boardkonfiguration/.test(detail)) return "Gib dem geänderten Boardprofil einen Namen und wähle „Als eigenes Board speichern“; das Katalogboard bleibt unverändert.";
  if (/Sensorart/.test(detail)) return "Wähle die Sensorart beziehungsweise Messgröße.";
  if (/Erfassung/.test(detail)) return "Wähle die passende Erfassungs- oder Signalart.";
  if (/Messintervall/.test(detail)) return "Gib ein positives Intervall für die zyklische Messung an.";
  if (/Werte pro Datensatz/.test(detail)) return "Lege fest, wie viele Rohwerte zu einem Datensatz zusammengefasst werden.";
  if (/Auswertung/.test(detail)) return "Wähle beispielsweise Mittelwert, Minimum, Maximum oder RMS.";
  if (/Speicherziel/.test(detail)) return "Wähle lokale Historie, Übertragung oder nur den letzten Datensatz.";
  if (/konkreter Typ/.test(detail)) return "Wähle den konkreten Sensor- oder Aktortyp.";
  if (/IoT-Device/.test(detail)) return "Ordne den Sensor oder Aktor dem zuständigen IoT-Device zu.";
  if (/Pin/.test(detail)) return "Wähle einen geeigneten freien Pin am zugeordneten Board.";
  return "Ergänze die fehlende Hardware-Angabe in der zugehörigen Tabellenzeile.";
}

export {
  abstractArchitectureComponents,
  actuatorTypes,
  boardFeatureForHardwareComponent,
  boardPins,
  circuitFor,
  hardwareComponentType,
  hardwareConfigurationValidation,
  hardwareConnectionPathAssessment,
  hardwareValidationTargets,
  motorDriverTypes,
  parseDevelopmentBoardPins,
  pinLabel,
  processorLabel,
  recommendedHardwareAction,
  requiresAdditionalCircuit,
};
