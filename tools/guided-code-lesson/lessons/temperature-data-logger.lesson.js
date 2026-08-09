"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
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
    });
  }

  registry.register({
    slug: "temperature-data-logger",
    create: createLesson,
  });
})(window.LearningProjectRegistry);
