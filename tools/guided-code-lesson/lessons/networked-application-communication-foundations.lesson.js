"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
      projectIdeaId: "project_idea.networked_application_communication_foundations",
      projectVariantId: "variant.connected_climate_monitor",
      slug: "networked-application-communication-foundations",
      title: "Grundlagen vernetzte Anwendungen",
      file: "vernetzter-klimamonitor.yaml",
      summary: "Verbinde ein Gerät, ein Backend und eine Webansicht mit REST, MQTT und einem klaren Umgang mit Offline- und Fehlerfällen.",
      welcome: {
        eyebrow: "Praxisprojekt: Vernetzter Klimamonitor",
        title: "Nicht jedes Netzwerkproblem ist eine API-Aufgabe",
        text: "Ein Gerät sendet Messwerte, eine Webansicht liest den letzten Zustand und ein Nutzer löst einen Grenzwertalarm aus. Du wählst dafür Request-Response, Publish-Subscribe oder Live-Updates bewusst aus.",
        topics: ["Datenflüsse zwischen Gerät, Backend und Browser", "REST für klar abgefragte Ressourcen", "MQTT für Ereignisse und Telemetrie", "Wiederholung, Offline-Betrieb und sichere Zustandsänderungen"],
        startLabel: "Vernetzungs-Projekt starten",
      },
      lines: [
        "Projekt: Vernetzter Klimamonitor",
        "",
        "Gerät -> MQTT -> Backend",
        "  topic: project/werkstatt/temperature",
        "  payload: { \"value\": 22.4, \"measuredAt\": \"2026-08-09T10:00:00Z\" }",
        "",
        "Browser -> REST -> Backend",
        "  GET /api/projects/werkstatt/latest-temperature",
        "  Antwort: { \"value\": 22.4, \"measuredAt\": \"2026-08-09T10:00:00Z\" }",
        "",
        "Browser <- WebSocket <- Backend",
        "  Ereignis: temperature.updated",
        "  Zweck: Ansicht aktualisieren, wenn ein neuer Wert eintrifft",
        "",
        "Regel bei Netzverlust:",
        "  Gerät speichert noch nicht gesendete Werte lokal.",
        "  Beim Wiederverbinden sendet es sie mit eindeutiger messageId.",
        "  Das Backend akzeptiert dieselbe messageId nur einmal.",
        "",
        "Nicht im Grundlagenprojekt: Kafka.",
        "Kafka ist sinnvoll für interne, skalierte Ereignisströme zwischen Backend-Diensten – nicht als erster Weg vom einzelnen Sensor zum Server.",
      ],
      steps: [
        step("networked_communication.01_map", "step_pattern.motivation_application", "Erst den Datenfluss zeichnen", "Markiere drei Rollen: Gerät erzeugt einen Messwert, Backend nimmt ihn an und speichert ihn, Browser zeigt ihn an. Das Protokoll folgt erst aus dieser Aufgabe.", [1, 3, 7, 11]),
        step("networked_communication.02_rest", "step_pattern.system_boundary", "REST: gezielt etwas abfragen", "Der Browser fragt den letzten Messwert über eine klar benannte Ressource ab. Formuliere die Antwort in einem Satz: Welche Information liefert GET und verändert es dabei etwas?", [7, 8, 9]),
        step("networked_communication.03_mqtt", "step_pattern.minimal_local_function", "MQTT: ein Ereignis veröffentlichen", "Das Gerät muss nicht wissen, welche Ansicht zuhört. Es veröffentlicht eine Nachricht auf einem Topic; das Backend oder andere erlaubte Empfänger abonnieren sie. Das ist Publish-Subscribe.", [3, 4, 5]),
        step("networked_communication.04_live", "step_pattern.parameter_experiment", "Live-Ansicht ist keine zweite Datenbank", "WebSocket liefert der Browseransicht ein Update-Signal. Der gespeicherte Messwert bleibt aber im Backend. Entscheide: Reicht Polling alle 30 Sekunden oder braucht die Anwendung ein sofortiges Update?", [11, 12, 13]),
        step("networked_communication.05_resilience", "step_pattern.problem_observation", "Wenn das WLAN weg ist", "Ein Gerät darf Messwerte nicht still verlieren oder nach Wiederverbindung doppelt speichern. Erkläre die drei Schutzschritte: lokal puffern, eindeutige messageId senden, im Backend nur einmal verarbeiten.", [15, 16, 17, 18]),
        step("networked_communication.06_boundary", "step_pattern.variant_comparison", "REST, MQTT, WebSocket – und wann Kafka?", "Ordne zu: REST für eine explizite Abfrage oder Konfiguration, MQTT für Telemetrie und Befehle, WebSocket für aktive Browseransichten. Kafka bleibt eine spätere Backend-Vertiefung für viele interne Dienste und Ereignisse.", [3, 7, 11, 21, 22]),
        step("networked_communication.07_capstone", "step_pattern.reflection_inspiration_sales_bridge", "Abschluss: Ein belastbarer Klimamonitor", "Beschreibe für ein Gerät, eine API und eine Webansicht je einen Nachrichtenweg. Ergänze Topic, REST-Endpunkt, Datenformat, Offline-Verhalten und eine Regel gegen doppelte Verarbeitung.", [3, 7, 11, 15]),
      ],
    });
  }

  registry.register({ slug: "networked-application-communication-foundations", create: createLesson });
})(window.LearningProjectRegistry);
