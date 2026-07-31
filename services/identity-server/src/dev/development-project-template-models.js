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
    schemaVersion: 2,
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
      hardwareProfileId: "hardware.processor_board.esp32_s3_es3c28p",
      buildConfig: {
        platform: "espressif32",
        framework: "arduino",
        board: "esp32-s3-devkitc-1",
        environment: "es3c28p",
        flash_size_mb: 16,
        monitor_speed: 115200,
        upload_protocol: "esptool",
        build_flags: ["-D ARDUINO_USB_MODE=1", "-D ARDUINO_USB_CDC_ON_BOOT=1"],
        firmware_basis_id: "",
        firmware_basis_version: "",
        firmware_basis_variant: "",
        user_source_path: "src/main.cpp",
        user_target_path: "src/main.cpp",
        libraries: ["lovyan03/LovyanGFX@^1.2.7"],
      },
    },
  }),
  esp32_camera_to_touch_display: templateModel({
    id: "esp32_camera_to_touch_display",
    schemaVersion: 3,
    title: "ESP32-Kamera auf Touchdisplay",
    description: "Zwei ESP32-S3 starten mit der GerNetiX-Basissoftware: Das Waveshare-Kameraboard ist als kuenftiger Bild-Host vorbereitet, das ES3C28P als kuenftiger Display-Client. Kameraaufnahme, Bildformat und Transport werden danach schrittweise entwickelt.",
    hint: "Vorkonfiguriertes Basissoftware-Projekt mit zwei Firmware-Zielen: Kamera-Host und Display-Client.",
    architecture: {
      elements: [
        element("camera", "Kamera", "sensor"),
        element("camera_device", "IoT-Device 1\nKameraeinheit", "iot_device"),
        element("display_device", "IoT-Device 2\nAnzeigeeinheit", "iot_device"),
        element("display", "Display", "actuator"),
        element("user", "Nutzer", "actor"),
      ],
      relations: [
        relation("camera", "camera_device", "liefert Bilddaten"),
        relation("camera_device", "display_device", "uebertraegt Bilddaten"),
        relation("display_device", "display", "zeigt Kamerabild"),
        relation("user", "display_device", "betrachtet Kamerabild"),
      ],
    },
    realization: {
      hardwareProfileId: "hardware.processor_board.waveshare_esp32_s3_cam_ov3660",
      hardwareConfiguration: {
        schema_version: 5,
        components: [
          {
            component_id: "camera",
            label: "Kamera",
            plantuml_type: "rectangle",
            abstract_type: "sensor",
            concrete_type: "integrated_camera",
            target_device_id: "camera_device",
          },
          {
            component_id: "camera_device",
            label: "IoT-Device 1 Kameraeinheit",
            plantuml_type: "rectangle",
            abstract_type: "iot_device",
            board_profile_id: "hardware.processor_board.waveshare_esp32_s3_cam_ov3660",
          },
          {
            component_id: "display_device",
            label: "IoT-Device 2 Anzeigeeinheit",
            plantuml_type: "rectangle",
            abstract_type: "iot_device",
            board_profile_id: "hardware.processor_board.esp32_s3_es3c28p",
          },
          {
            component_id: "display",
            label: "Display",
            plantuml_type: "rectangle",
            abstract_type: "actuator",
            concrete_type: "integrated_display",
            target_device_id: "display_device",
          },
          {
            component_id: "user",
            label: "Nutzer",
            plantuml_type: "actor",
            abstract_type: "actor",
          },
        ],
      },
      softwareUnits: [
        {
          software_unit_id: "camera_sender",
          title: "Kamera-Host",
          software_kind: "embedded_firmware",
          build_system: "platformio",
          source_root: "Software/Kamera-Host",
          entrypoint: "Komponenten/IoT-Device 1/src/user_main.cpp",
          hardwareProfileId: "hardware.processor_board.waveshare_esp32_s3_cam_ov3660",
          buildConfig: {
            platform: "espressif32",
            framework: "espidf",
            board: "4d_systems_esp32s3_gen4_r8n16",
            environment: "waveshare_esp32_s3_cam_ov3660",
            flash_size_mb: 16,
            monitor_speed: 115200,
            upload_protocol: "esptool",
            build_flags: [],
            platformio_options: { "board_build.cmake_extra_args": "-DSDKCONFIG_DEFAULTS=\"sdkconfig.esp32-s3-n16r8\"" },
            firmware_basis_id: "gernetix-runtime-basissoftware",
            firmware_basis_version: "workspace",
            firmware_basis_variant: "full",
            partition_profile_id: "full",
            user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
            user_target_path: "src/user/user_app.cpp",
          },
        },
        {
          software_unit_id: "display_receiver",
          title: "Display-Client",
          software_kind: "embedded_firmware",
          build_system: "platformio",
          source_root: "Software/Display-Client",
          entrypoint: "Komponenten/IoT-Device 1/src/user_main.cpp",
          hardwareProfileId: "hardware.processor_board.esp32_s3_es3c28p",
          buildConfig: {
            platform: "espressif32",
            framework: "espidf",
            board: "4d_systems_esp32s3_gen4_r8n16",
            environment: "es3c28p",
            flash_size_mb: 16,
            monitor_speed: 115200,
            upload_protocol: "esptool",
            libraries: [],
            build_flags: [],
            platformio_options: { "board_build.cmake_extra_args": "-DSDKCONFIG_DEFAULTS=\"sdkconfig.esp32-s3-n16r8\"" },
            firmware_basis_id: "gernetix-runtime-basissoftware",
            firmware_basis_version: "workspace",
            firmware_basis_variant: "full",
            partition_profile_id: "full",
            user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
            user_target_path: "src/user/user_app.cpp",
          },
        },
      ],
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
