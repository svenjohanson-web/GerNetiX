"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
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
        step("05_authorization", "step_pattern.solution_introduction", "Rechte prüfen", "Autorisierung wird getrennt von Identifizierung modelliert.", [6]),
        step("06_enrollment", "step_pattern.observable_effect", "Tag anlernen", "Der Nutzer erzeugt lokal eine neue Berechtigung.", [7]),
        step("07_connected", "step_pattern.variant_comparison", "Wann braucht man ESP32?", "Benachrichtigung und Netzwerk werden als Variantenerweiterung eingeordnet.", [8]),
      ],
    });
  }

  registry.register({
    slug: "smartbox-rfid-access-control",
    create: createLesson,
  });
})(window.LearningProjectRegistry);
