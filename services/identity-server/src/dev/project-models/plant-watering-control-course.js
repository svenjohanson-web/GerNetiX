"use strict";

const { createStaticLearningProjectModel } = require("./static-learning-project-model");

function createPlantWateringControlCourseModel() {
  return createStaticLearningProjectModel({
    slug: "plant-watering-control",
    title: "Pflanzenbewaesserung",
    area: "Sensor und Aktor",
    summary: "Feuchtigkeit messen und eine Pumpe kontrolliert schalten.",
    steps: [
      { title: "Nutzen und Risiko", text: "Die Pflanze soll Wasser bekommen, ohne Ueberschwemmung.", insight: "Automatisierung braucht Grenzen." },
      { title: "Sensor lesen", text: "Bodenfeuchte wird zur Eingangsseite der Steuerung.", insight: "Ein Sensor liefert Hinweise, keine fertige Entscheidung." },
      { title: "Pumpe schalten", text: "Die Pumpe ist die Ausgangsseite des Systems.", insight: "Aktorik macht Software in der Welt wirksam." },
      { title: "Sicherheit", text: "Laufzeitbegrenzung und Fehlerfaelle gehoeren zur Funktion.", insight: "Sichere Software plant Stoerungen mit ein." },
    ],
    options: {
      access_model: "purchased",
      learning_category: "embedded",
      required_capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
      tags: ["platform:esp32", "topic:sensors", "topic:actuators"],
    },
    sources: [{
      role: "user_code",
      content: (project) => ["#include <Arduino.h>", "", "void setup() {", "  Serial.begin(115200);", "}", "", "void loop() {", `  Serial.println("${project.title}");`, "  delay(1000);", "}", ""].join("\n"),
    }],
  });
}

module.exports = { createPlantWateringControlCourseModel };
