"use strict";

(function registerLesson(registry) {
  function createActuatorOutputBasicsLesson() {
    return {
      projectIdeaId: "project_idea.actuator_output_basics",
      projectVariantId: "variant.basic_gpio_pwm_node",
      slug: "actuator-output-basics",
      title: "Aktorik-Schnupperkurs: LED verstehen",
      file: "blink.ino",
      welcome: {
        eyebrow: "Aktorik verstehen",
        title: "LED als erster sichtbarer Ausgang",
        text: "In diesem Projekt lernst du, wie Software einen elektrischen Ausgang steuert und daraus eine sichtbare Wirkung entsteht.",
        topics: [
          "welche Rolle ein Mikrocontroller-Pin spielt",
          "wie ein Ausgang vorbereitet wird",
          "wie ein sichtbares Signal entsteht",
          "warum Zeitverhalten für Aktoren wichtig wird",
        ],
        startLabel: "Aktorik-Lektion starten",
      },
      completionSummary: {
        eyebrow: "Lernrückblick",
        title: "Was du im Aktorik-Projekt gelernt hast",
        text: "Du hast eine LED nicht nur blinken lassen, sondern die Grenze zwischen Software, Mikrocontroller-Pin und sichtbarer Wirkung verstanden.",
        learned: [
          "Ein GPIO-Pin ist die elektrische Schnittstelle zwischen Software und Hardware.",
          "Ein Ausgang muss vorbereitet werden, bevor Software ihn aktiv schalten kann.",
          "Parameter wie Wartezeiten verändern sichtbares Verhalten, ohne die Grundlogik zu ersetzen.",
          "Blockierendes Warten motiviert später Timer, PWM und nebenläufige Abläufe.",
        ],
        next: "Aus dieser Grundlage können später Buzzer, Motoren, PWM und vernetzte Steuerungen entstehen.",
      },
      learnerProfile: {
        boardKey: "esp32_devkit_v1",
      },
      boardProfiles: {
        esp32_devkit_v1: {
          title: "ESP32 DevKit V1",
          defaultLedPin: 2,
        },
        unknown: {
          title: "Unbekanntes Board",
          defaultLedPin: null,
        },
      },
      source:
        "#include <Arduino.h>\n\nconst int LED_PIN = 2;\nconst int BLINK_DELAY_MS = 1000;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  delay(BLINK_DELAY_MS);\n  digitalWrite(LED_PIN, LOW);\n  delay(BLINK_DELAY_MS);\n}\n",
      steps: [
        {
          id: "step.actuator_output_basics.01_system_boundary",
          flowItemId: "project_flow_item.actuator_output_basics.01",
          pattern: "step_pattern.system_boundary",
          title: "Systemgrenze sichtbar machen",
          text:
            "Der Mikrocontroller verändert nicht direkt die Welt. Er setzt ein elektrisches Signal an einem Pin. Die angeschlossene LED macht daraus eine sichtbare Wirkung.",
          outcome: "Der Pin wird als Grenze zwischen Software und Hardware verstanden.",
          focusLines: [3],
          editableLines: [],
        },
        {
          id: "step.actuator_output_basics.02_pin_definition",
          flowItemId: "project_flow_item.actuator_output_basics.02",
          pattern: "step_pattern.guided_code_walkthrough",
          title: "Den verwendeten Pin benennen",
          text:
            "Diese Zeile legt fest, welcher GPIO für die LED benutzt wird. Wenn dein Board-Profil bekannt ist, validieren wir gegen dessen hinterlegten LED-Pin. Sonst reicht eine plausible Pin-Zahl.",
          outcome: "Der Lernende erkennt die Verbindung zwischen Board-Profil, Board-Pin und Code-Konstante.",
          focusLines: [3],
          editableLines: [3],
          validation: {
            type: "knownBoardPinOrIntegerRange",
            line: 3,
            label: "LED_PIN",
            min: 0,
            max: 8,
            profileField: "boardKey",
            knownBoardPins: {
              esp32_devkit_v1: 2,
            },
          },
        },
        {
          id: "step.actuator_output_basics.03_output_mode",
          flowItemId: "project_flow_item.actuator_output_basics.03",
          pattern: "step_pattern.minimal_local_function",
          title: "Pin als Ausgang konfigurieren",
          text:
            "Im setup wird der Pin als Ausgang deklariert. Erst dadurch darf die Software den elektrischen Zustand aktiv setzen.",
          outcome: "Input und Output werden als unterschiedliche Rollen eines Pins verstanden.",
          focusLines: [7],
          editableLines: [],
        },
        {
          id: "step.actuator_output_basics.04_first_blink",
          flowItemId: "project_flow_item.actuator_output_basics.04",
          pattern: "step_pattern.observable_effect",
          title: "High, Pause, Low, Pause",
          text:
            "Der loop setzt den Pin auf HIGH, wartet, setzt ihn auf LOW und wartet wieder. Daraus entsteht das Blinkmuster.",
          outcome: "Ein zeitlicher Programmablauf wird als sichtbares Hardwareverhalten gelesen.",
          focusLines: [11, 12, 13, 14],
          editableLines: [],
        },
        {
          id: "step.actuator_output_basics.05_parameter_experiment",
          flowItemId: "project_flow_item.actuator_output_basics.05",
          pattern: "step_pattern.parameter_experiment",
          title: "Blinkgeschwindigkeit ändern",
          text:
            "Ändere die Wartezeit von 1000 ms auf 500 ms. Danach blinkt die LED schneller, ohne dass sich die eigentliche Schaltlogik ändert.",
          outcome: "Ein Parameter wird als Stellgröße für beobachtbares Verhalten verstanden.",
          focusLines: [4, 12, 14],
          editableLines: [4],
          expectedContains: "BLINK_DELAY_MS = 500",
        },
        {
          id: "step.actuator_output_basics.06_problem_cpu_busy",
          flowItemId: "project_flow_item.actuator_output_basics.06",
          pattern: "step_pattern.problem_observation",
          title: "Das Delay blockiert die CPU",
          text:
            "Die LED blinkt, aber die CPU verbringt die Zeit im Warten. Genau hier entsteht die Frage, warum Peripherieeinheiten wie Timer und PWM nützlich sind.",
          outcome: "Die Grenze der naiven Delay-Lösung wird als echtes technisches Problem sichtbar.",
          focusLines: [12, 14],
          editableLines: [],
        },
        {
          id: "step.actuator_output_basics.07_solution_pwm",
          flowItemId: "project_flow_item.actuator_output_basics.07",
          pattern: "step_pattern.solution_introduction",
          title: "PWM als Entlastung einführen",
          text:
            "PWM wird vorkonfiguriert und erzeugt das periodische Signal in Hardware. Die Software muss später nur noch Werte wie das Tastverhältnis ändern.",
          outcome: "PWM wird nicht als Zauberfunktion, sondern als ausgelagerte zeitkritische Arbeit verstanden.",
          focusLines: [11, 12, 13, 14],
          editableLines: [],
        },
        {
          id: "step.actuator_output_basics.08_reflection",
          flowItemId: "project_flow_item.actuator_output_basics.08",
          pattern: "step_pattern.reflection_inspiration_sales_bridge",
          title: "Was wurde wirklich gelernt?",
          text:
            "Du hast nicht nur eine LED blinken lassen. Du hast Systemgrenzen, Parameter, zeitliches Verhalten und den Grund für PWM kennengelernt. Das ist die Basis für Buzzer, Motoren und später Webserver-Steuerung.",
          outcome: "Der Schnupperkurs endet mit Transfer auf weitere Aktoren und Connected-Projekte.",
          focusLines: [3, 4, 7, 11, 12, 13, 14],
          editableLines: [],
        },
      ],
    };
  }

  registry.register({
    slug: "actuator-output-basics",
    create: createActuatorOutputBasicsLesson,
  });
})(window.LearningProjectRegistry);
