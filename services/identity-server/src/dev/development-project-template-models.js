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
        element("storage", "Lokaler Device-Speicher (NVS / LittleFS)", "storage"),
        element("web", "Lokaler Webserver", "service"),
      ],
      relations: [
        relation("sensors", "device", "Messwerte"),
        relation("device", "storage", "Historie"),
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
        element("internet", "Internet", "network"),
        element("server", "Webserver / API\nSoftware: SQL-Datenbank", "service"),
        element("browser", "Browser Dashboard", "client"),
      ],
      relations: [
        relation("sensors", "device", "Messwerte"),
        relation("device", "internet", "HTTPS / MQTT"),
        relation("internet", "server"),
        relation("user", "browser"),
        relation("browser", "server", "HTTPS"),
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
