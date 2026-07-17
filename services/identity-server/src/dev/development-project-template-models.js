const DEVELOPMENT_PROJECT_TEMPLATE_MODELS = Object.freeze({
  empty: templateModel({
    id: "empty",
    title: "Leeres Projekt",
    defaultTitle: "",
    description: "Architektur und Anforderungen gemeinsam von Grund auf klaeren.",
    hint: "Architektur und Anforderungen gemeinsam von Grund auf klaeren.",
  }),
  esp32_device_only: templateModel({
    id: "esp32_device_only",
    title: "IoT-Device only",
    description: "Eigenstaendiges IoT-Device mit lokaler Sensorik, ohne Webserver und ohne Internet-Abhaengigkeit.",
    hint: "IoT-Device und Sensoren als logische Bausteine.",
    architecture: {
      elements: [
        element("user", "Nutzer", "actor"),
        element("device", "IoT-Device 1", "iot_device"),
        element("sensors", "Sensoren", "sensor"),
      ],
      relations: [
        relation("user", "device", "lokale Bedienung"),
        relation("sensors", "device", "Messwerte"),
      ],
    },
  }),
  sensor_actuator_control: templateModel({
    id: "sensor_actuator_control",
    title: "Sensor-Aktor-Steuerung",
    description: "IoT-Device erfasst einen Sensorwert, wertet ihn in einer lokalen Steuerlogik aus und steuert damit einen Aktor.",
    hint: "Sensor, lokale Steuerlogik und Aktor als durchgaengige Wirkungskette.",
    architecture: {
      elements: [
        element("sensor", "Sensor 1", "sensor"),
        element("device", "IoT-Device 1", "iot_device"),
        element("actuator", "Aktor 1", "actuator"),
      ],
      relations: [
        relation("sensor", "device", "liefert Messwert"),
        relation("device", "actuator", "steuert anhand der lokalen Logik"),
      ],
    },
  }),
  distributed_home_automation: templateModel({
    id: "distributed_home_automation",
    title: "Verteilte Hausautomatisierung",
    description: "Mehrere Sensor-, Aktor- und Bediengeraete synchronisieren Befehle, Sollzustaende und Istzustaende ueber eine optional zentrale Hausautomationsinstanz.",
    hint: "Geraete, Rollen, Kommunikation, Zustandsmodell und Ausfallverhalten werden nach dem Anlegen im Konfigurationsassistenten festgelegt.",
    architecture: {
      elements: [
        element("sensor_node", "IoT-Device 1\nSensor-Node", "iot_device"),
        element("actuator_node", "IoT-Device 2\nAktor-Node", "iot_device"),
        element("control_node", "IoT-Device 3\nBediengeraet", "iot_device"),
        element("coordination", "Zustandskoordination", "service"),
      ],
      relations: [
        relation("sensor_node", "coordination", "Messwerte / Ereignisse"),
        relation("control_node", "coordination", "Befehle / Sollzustand"),
        relation("coordination", "actuator_node", "Sollzustand"),
        relation("actuator_node", "coordination", "Istzustand"),
      ],
    },
  }),
  touchscreen_game_collection: templateModel({
    id: "touchscreen_game_collection",
    title: "Touchscreen-Spielesammlung",
    description: "Ein Nutzer bedient eine Spielesammlung auf einem Board mit Touchdisplay.",
    hint: "Die statische Architektur zeigt nur Nutzer und Board; Spielablauf und Spiele gehoeren in Verhalten und Code.",
    architecture: {
      elements: [
        element("user", "Nutzer", "actor"),
        element("device", "Board mit Touchdisplay", "iot_device"),
      ],
      relations: [],
    },
    realization: {
      hardwareProfileId: "hardware.processor_board.generic_esp32_s3_touch_display",
      buildConfig: {
        platform: "espressif32",
        framework: "espidf",
        board: "esp32-s3-devkitc-1",
        environment: "esp32-s3-devkitc-1",
        firmware_basis_id: "gernetix-runtime-basissoftware",
        firmware_basis_version: "workspace",
        firmware_basis_variant: "comfort",
        user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
        user_target_path: "src/user/user_app.cpp",
        libraries: [],
      },
    },
  }),
  esp32_datalogger_local_web: templateModel({
    id: "esp32_datalogger_local_web",
    title: "Datenlogger mit lokalem Webserver",
    description: "IoT-Device-Datenlogger mit Sensoren, lokaler Speicherung und einem nur im lokalen Netzwerk erreichbaren Webserver.",
    hint: "IoT-Device, Messwerthistorie und Browserzugriff im lokalen WLAN.",
    architecture: {
      elements: [
        element("user", "Nutzer im lokalen Netz", "actor"),
        element("device", "IoT-Device Datenlogger", "iot_device"),
        element("sensors", "Sensoren", "sensor"),
        element("web", "Lokaler Webserver", "service"),
      ],
      relations: [
        relation("sensors", "device", "Messwerte"),
        relation("device", "web", "Status und Messwerte"),
        relation("user", "web", "WLAN / HTTP im LAN"),
      ],
    },
  }),
  esp32_datalogger_internet_web: templateModel({
    id: "esp32_datalogger_internet_web",
    title: "IoT-Device Datenlogger mit Internet-Webserver",
    description: "IoT-Device-Datenlogger uebertraegt Messwerte sicher an einen internet-erreichbaren Server mit Datenbank und Browser-Dashboard.",
    hint: "IoT-Device, Internetanbindung, Server, Datenbank und Browser-Dashboard.",
    architecture: {
      elements: [
        element("user", "Nutzer", "actor"),
        element("device", "IoT-Device Datenlogger", "iot_device"),
        element("sensors", "Sensoren", "sensor"),
        element("server", "Webserver / API\nSoftware: SQL-Datenbank", "service"),
        element("browser", "Browser Dashboard", "client"),
      ],
      relations: [
        relation("sensors", "device", "Messwerte"),
        relation("device", "server", "Telemetrie und Befehle (GerNetiX-Infrastruktur)"),
        relation("user", "browser"),
        relation("browser", "server", "HTTPS"),
      ],
    },
  }),
  iot_datalogger_web_push_pwa: templateModel({
    id: "iot_datalogger_web_push_pwa",
    title: "Datenlogger mit Projekt-PWA und optionalem Push",
    description: "Ein Datenlogger erfasst Messwerte. Der angemeldete Nutzer richtet Datenerfassung, Messwertverlauf und optionalen Push in seiner Projekt-PWA ein.",
    hint: "Konfiguriert werden Datenlogger und Projekt-PWA. Telemetrie, Speicherung und Versand bleiben unsichtbare GerNetiX-Infrastruktur.",
    // Push ist kein Einstiegskriterium: Das Projekt funktioniert auch ohne
    // Benachrichtigungen. Eine Aktivierung wird erst bei einer Ereignisregel
    // und der PWA-Push-Erlaubnis relevant.
    requiredEntitlements: [],
    dataLogger: {
      required: true,
      storageScope: "project_private",
      configurationState: "requires_sensor_configuration",
      userConfiguration: ["Messquelle und Messintervall", "Messwertbezeichnung und Einheit", "Aufbewahrungsdauer", "Ereignisregel; optional Push aktivieren"],
    },
    architecture: {
      elements: [
        element("user", "Nutzer", "actor"),
        element("device", "IoT-Device Datenlogger", "iot_device"),
        element("pwa", "Projekt-PWA auf dem iPhone", "client"),
      ],
      relations: [
        relation("user", "device", "richtet Datenerfassung ein"),
        relation("user", "pwa", "nutzt Messwertverlauf und optionalen Push"),
      ],
    },
  }),
  event_driven_project_application: templateModel({
    id: "event_driven_project_application",
    title: "Ereignisgesteuerte Projektanwendung",
    description: "Eine IoT-Ereignisquelle loest eine projektdefinierte Worker-Regel aus. Der Dispatcher stellt das freigegebene Ergebnis an die gewaehlten IoT-Zielgeraete zu.",
    hint: "Startmuster: Ereignisquelle → Worker-Regel → Dispatcher-Regel → Zielgeraet. Die technische Annahme, Speicherung und Zustellung sind GerNetiX-Infrastruktur und erscheinen nicht in der Projektarchitektur.",
    architecture: {
      elements: [
        element("source_device", "IoT-Device Ereignisquelle", "iot_device"),
        element("worker", "Ereignis-Worker", "event_worker"),
        element("dispatcher", "Ereignis-Dispatcher", "event_dispatcher"),
        element("target_devices", "IoT-Zielgeraet(e)", "iot_device"),
      ],
      relations: [
        relation("source_device", "worker", "Ereignis ausloesen"),
        relation("worker", "dispatcher", "freigegebenes Folgeereignis"),
        relation("dispatcher", "target_devices", "Aktion zustellen"),
      ],
    },
  }),
});

function templateModel(input) {
  return Object.freeze({
    schemaVersion: 1,
    architecture: { elements: [], relations: [] },
    realization: null,
    ...input,
  });
}

function element(id, label, kind) {
  return Object.freeze({ id, label, kind });
}

function relation(source, target, label = "") {
  return Object.freeze({ source, target, label });
}

module.exports = { DEVELOPMENT_PROJECT_TEMPLATE_MODELS };
