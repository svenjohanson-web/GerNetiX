"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
      projectIdeaId: "project_idea.connected_tamagotchi",
      projectVariantId: "variant.backend_authoritative_clients",
      slug: "connected-tamagotchi",
      title: "Connected Tamagotchi",
      file: "connected-tamagotchi.yaml",
      summary: "State Machines, Persistenz, Zeit, Backend-Logik und mehrere Clients an einem spielerischen System verstehen.",
      lines: [
        "Projektidee: Connected Tamagotchi",
        "Motivation: Ein virtuelles Wesen soll Zustand, Alter und Interaktionen behalten.",
        "Lokale Grenze: Nach Reset sind RAM-Zustände weg.",
        "Persistenz: Zustand wird dauerhaft gespeichert.",
        "Zeitproblem: Ohne RTC oder Netzwerkzeit altert das System nicht sinnvoll offline.",
        "Architekturwechsel: Logik wandert ins Backend, Clients senden nur Eingaben.",
        "Kommunikation: Client -> Server als Request, Server -> Clients als Broadcast/PubSub.",
        "Reflexion: Online-Synchronität gegen Offline-Fähigkeit abwägen.",
      ],
      steps: [
        step("01_motivation", "step_pattern.motivation_application", "Warum Tamagotchi?", "Ein vertrautes Spiel macht State, Zeit und Persistenz konkret.", [2]),
        step("02_state_boundary", "step_pattern.system_boundary", "State geht verloren", "Reset und Stromausfall zeigen, warum RAM nicht reicht.", [3]),
        step("03_persistence", "step_pattern.solution_introduction", "Persistenz einführen", "Zustand wird als Datenmodell dauerhaft abgelegt.", [4]),
        step("04_time_problem", "step_pattern.problem_observation", "Zeit als Systemgrenze", "Ohne belastbare Zeitbasis kann Alterung nicht korrekt berechnet werden.", [5]),
        step("05_backend_logic", "step_pattern.solution_introduction", "Backend wird autoritativ", "Programmlogik zentralisieren reduziert Versions- und Nebenläufigkeitsprobleme.", [6]),
        step("06_communication", "step_pattern.variant_comparison", "Request und Broadcast trennen", "Client-Eingaben und Server-Updates bekommen unterschiedliche Kommunikationsmuster.", [7]),
        step("07_reflection", "step_pattern.reflection_inspiration_sales_bridge", "Online oder offline?", "Die Architekturentscheidung wird als Business- und Technikabwägung sichtbar.", [8]),
      ],
    });
  }

  registry.register({
    slug: "connected-tamagotchi",
    create: createLesson,
  });
})(window.LearningProjectRegistry);
