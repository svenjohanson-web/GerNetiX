"use strict";

const { createStaticLearningProjectModel } = require("./static-learning-project-model");

function createArduinoBlinkCourseModel() {
  return createStaticLearningProjectModel({
    slug: "arduino-blink",
    title: "Arduino Blink",
    area: "Firmware",
    summary: "Kleines Blink-Projekt fuer den ersten USB-Flash auf ein Arduino-kompatibles Board.",
    steps: [
      { title: "Projekt waehlen", text: "Arduino Blink ist das kleinste sinnvolle Firmware-Projekt fuer Arduino-kompatible Boards.", insight: "Der Sketch bleibt gleich, das Boardprofil bestimmt die Zielplattform." },
      { title: "Board anschliessen", text: "Ein ESP32 DevKit, Arduino Nano oder ein anderes Arduino-kompatibles Board haengt per USB am Rechner.", insight: "USB-Flash ist der schnellste lokale MVP-Nachweis." },
      { title: "Flash starten", text: "Die IDE startet Build und Upload ueber den Build-&-Deploy-Server.", insight: "Der Button prueft die Plattformkette Ende zu Ende." },
    ],
    options: {
      access_model: "free",
      learning_category: "embedded",
      required_capability_ids: ["capability.arduino_framework_runtime", "capability.flash_firmware"],
      tags: ["platform:arduino", "platform:esp32", "topic:firmware", "level:beginner"],
    },
    sources: [{
      role: "user_code",
      content: ["#include <Arduino.h>", "", "const int blinkPin = LED_BUILTIN;", "", "void setup() {", "  pinMode(blinkPin, OUTPUT);", "}", "", "void loop() {", "  digitalWrite(blinkPin, HIGH);", "  delay(500);", "  digitalWrite(blinkPin, LOW);", "  delay(500);", "}", ""].join("\n"),
    }],
  });
}

module.exports = { createArduinoBlinkCourseModel };
