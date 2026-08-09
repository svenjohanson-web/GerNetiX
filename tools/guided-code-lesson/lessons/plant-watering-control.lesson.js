"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
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
    });
  }

  registry.register({
    slug: "plant-watering-control",
    create: createLesson,
  });
})(window.LearningProjectRegistry);
