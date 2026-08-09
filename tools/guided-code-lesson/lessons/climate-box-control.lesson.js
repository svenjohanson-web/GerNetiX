"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
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
    });
  }

  registry.register({
    slug: "climate-box-control",
    create: createLesson,
  });
})(window.LearningProjectRegistry);
