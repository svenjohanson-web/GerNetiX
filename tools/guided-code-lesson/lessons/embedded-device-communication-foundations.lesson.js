"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
      projectIdeaId: "project_idea.embedded_device_communication_foundations",
      projectVariantId: "variant.sensor_station",
      slug: "embedded-device-communication-foundations",
      title: "Grundlagen Gerätekommunikation",
      file: "sensorstation-schnittstellen.yaml",
      summary: "Lerne UART, I²C und SPI an einer kleinen Sensorstation unterscheiden, gezielt auswählen und typische Fehler systematisch eingrenzen.",
      welcome: {
        eyebrow: "Praxisprojekt: Sensorstation",
        title: "Ein Mikrocontroller spricht mit seinen Bausteinen",
        text: "Die Station liest einen I²C-Sensor, zeigt Werte auf einem SPI-Display und sendet Diagnosemeldungen über UART. Du entscheidest nicht aus Gewohnheit, sondern aus den Anforderungen.",
        topics: ["Signale, Rollen und Leitungen verstehen", "UART, I²C und SPI passend einsetzen", "Datenblatt, Adresse und Timing lesen", "einen Busfehler ohne Raten eingrenzen"],
        startLabel: "Schnittstellen-Projekt starten",
      },
      lines: [
        "Projekt: Umwelt-Sensorstation",
        "Mikrocontroller: ESP32 oder Arduino-kompatibles Board",
        "",
        "UART: PC <-> Mikrocontroller",
        "  Leitungen: TX, RX, GND",
        "  Zweck: lesbare Debug-Ausgabe und einfache Punkt-zu-Punkt-Verbindung",
        "",
        "I2C: Mikrocontroller <-> BME280-Sensor",
        "  Leitungen: SDA, SCL, GND, VCC",
        "  Rollen: ein Controller, mehrere adressierte Geräte",
        "  Beispieladresse: 0x76",
        "  Hinweis: SDA und SCL brauchen passende Pull-up-Widerstände",
        "",
        "SPI: Mikrocontroller <-> Display",
        "  gemeinsame Leitungen: SCK, MOSI, MISO",
        "  pro Gerät: eigener CS-Pin",
        "  Zweck: schnelle, klar getaktete Datenübertragung",
        "",
        "Fehlerbild: I2C-Scan findet kein Gerät.",
        "Prüfreihenfolge: Versorgung -> gemeinsame Masse -> SDA/SCL -> Adresse -> Pull-ups -> Logikanalysator.",
      ],
      steps: [
        step("embedded_communication.01_need", "step_pattern.motivation_application", "Drei Aufgaben, drei Schnittstellen", "Die Sensorstation hat drei Kommunikationsaufgaben: Diagnose zum PC, Sensor lesen und Display beschreiben. Benenne zuerst die Aufgabe, dann die Schnittstelle.", [4, 8, 15]),
        step("embedded_communication.02_uart", "step_pattern.system_boundary", "UART: zwei Partner, klare Richtung", "UART verbindet hier PC und Mikrocontroller. TX und RX werden gekreuzt, eine gemeinsame Masse ist Pflicht. Es gibt keine Geräteadresse – deshalb eignet sich UART gut für eine direkte Verbindung.", [4, 5, 6]),
        step("embedded_communication.03_i2c", "step_pattern.minimal_local_function", "I²C: mehrere Geräte an zwei Datenleitungen", "Beim I²C-Bus teilen sich Geräte SDA und SCL. Der Controller spricht ein Gerät über seine Adresse an. Prüfe im Datenblatt, ob dein Sensor 0x76 oder 0x77 verwendet.", [8, 9, 10, 11, 12]),
        step("embedded_communication.04_spi", "step_pattern.parameter_experiment", "SPI: Takt und Chip-Select", "SPI teilt Takt und Datenleitungen, wählt aber jedes Gerät mit einem eigenen CS-Pin aus. Zeichne für ein zweites Display ein, welche Leitungen geteilt und welche ergänzt werden müssen.", [15, 16, 17, 18]),
        step("embedded_communication.05_choose", "step_pattern.problem_observation", "Nicht die schnellste Schnittstelle gewinnt", "Vergleiche: Ein einzelner GPS-Empfänger mit Textausgabe passt gut zu UART, mehrere kleine Sensoren oft zu I²C, ein schnelles Display häufig zu SPI. Begründe jeweils mit Topologie statt nur mit Geschwindigkeit.", [4, 8, 15]),
        step("embedded_communication.06_debug", "step_pattern.variant_comparison", "Ein Fehlerbild systematisch prüfen", "Der I²C-Scan findet keinen Sensor. Arbeite die Prüfreihenfolge durch und halte nach jedem Schritt fest, welche Fehlerursache du ausgeschlossen hast. Erst danach hilft ein Logikanalysator bei Timing oder Pegeln.", [21, 22]),
        step("embedded_communication.07_capstone", "step_pattern.reflection_inspiration_sales_bridge", "Abschluss: Sensorstation erweitern", "Plane eine echte oder simulierte Station mit einem I²C-Sensor, UART-Diagnose und einem SPI-Gerät. Gib Pinplan, Geräteadressen, eine Testausgabe und deinen ersten Debug-Schritt für jedes Fehlerbild an.", [1, 4, 8, 15, 21]),
      ],
    });
  }

  registry.register({ slug: "embedded-device-communication-foundations", create: createLesson });
})(window.LearningProjectRegistry);
