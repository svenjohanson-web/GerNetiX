"use strict";

(function registerLesson(registry) {
  function createLesson({ createIdeaPreviewLesson, step }) {
    return createIdeaPreviewLesson({
      projectIdeaId: "project_idea.database_foundations",
      projectVariantId: "variant.local_sensor_log",
      slug: "database-foundations",
      title: "Grundlagen Datenbanken",
      file: "raumklima-datenbank.sql",
      summary: "Baue eine kleine, belastbare Datenbasis für Messwerte: vom Datenmodell über SQL bis zur Abfrage und einer nachvollziehbaren Änderung.",
      welcome: {
        eyebrow: "Praxisprojekt: Raumklima-Logger",
        title: "Messwerte so speichern, dass sie später noch nützlich sind",
        text: "Ein Sensorwert auf dem Display ist nur ein Moment. In diesem Projekt modellierst du Räume, Sensoren und Messwerte so, dass du Verläufe abfragen und Fehler vermeiden kannst.",
        topics: ["Tabellen aus einem realen Datenmodell ableiten", "SQL zum Anlegen, Speichern und Abfragen", "Schlüssel und Regeln gegen falsche Daten", "eine kleine Datenbank als Grundlage für spätere APIs"],
        startLabel: "Datenbank-Projekt starten",
      },
      lines: [
        "Projekt: Raumklima-Logger",
        "Ziel: Temperaturwerte eines Sensors je Raum langfristig speichern.",
        "",
        "CREATE TABLE room (",
        "  id INTEGER PRIMARY KEY,",
        "  name TEXT NOT NULL UNIQUE",
        ");",
        "",
        "CREATE TABLE sensor (",
        "  id INTEGER PRIMARY KEY,",
        "  room_id INTEGER NOT NULL REFERENCES room(id),",
        "  serial_number TEXT NOT NULL UNIQUE",
        ");",
        "",
        "CREATE TABLE measurement (",
        "  id INTEGER PRIMARY KEY,",
        "  sensor_id INTEGER NOT NULL REFERENCES sensor(id),",
        "  measured_at TEXT NOT NULL,",
        "  temperature_c REAL NOT NULL CHECK (temperature_c BETWEEN -40 AND 85)",
        ");",
        "",
        "INSERT INTO room (name) VALUES ('Werkstatt');",
        "INSERT INTO sensor (room_id, serial_number) VALUES (1, 'BME280-01');",
        "INSERT INTO measurement (sensor_id, measured_at, temperature_c)",
        "VALUES (1, '2026-08-09T10:00:00Z', 22.4);",
        "",
        "SELECT room.name, measurement.measured_at, measurement.temperature_c",
        "FROM measurement",
        "JOIN sensor ON sensor.id = measurement.sensor_id",
        "JOIN room ON room.id = sensor.room_id",
        "ORDER BY measurement.measured_at DESC;",
      ],
      steps: [
        step("database_foundations.01_problem", "step_pattern.motivation_application", "Warum reicht eine Liste nicht?", "Überlege: Zu welchem Raum gehört ein Messwert, welcher Sensor hat ihn geliefert und wann wurde er gemessen? Genau diese Beziehungen macht eine Datenbank dauerhaft und abfragbar.", [1, 2]),
        step("database_foundations.02_model", "step_pattern.system_boundary", "Vom Projekt zur Tabelle", "Trenne die Dinge, über die du etwas wissen willst: Raum, Sensor und Messwert. Eine Tabelle beschreibt eine Sorte Dinge; jede Zeile steht für genau einen konkreten Raum, Sensor oder Messwert.", [4, 9, 15]),
        step("database_foundations.03_keys", "step_pattern.minimal_local_function", "Eindeutige Identität und Beziehungen", "Lege Primärschlüssel an und verbinde den Sensor mit seinem Raum. Der Fremdschlüssel verhindert, dass ein Sensor zu einem nicht vorhandenen Raum gehört.", [5, 11]),
        step("database_foundations.04_store", "step_pattern.parameter_experiment", "Den ersten Messwert speichern", "Führe die drei INSERT-Anweisungen gedanklich aus. Ändere anschließend Temperatur oder Zeitpunkt und erkläre, warum jeder neue Messwert eine neue Zeile ist statt eine alte zu überschreiben.", [22, 23, 24]),
        step("database_foundations.05_query", "step_pattern.problem_observation", "Aus Daten eine Antwort machen", "Die SELECT-Abfrage verbindet drei Tabellen wieder zu einer verständlichen Sicht. Formuliere selbst die Frage: „Welche Temperatur hat der Sensor in der Werkstatt zuletzt gemessen?“", [27, 28, 29, 30, 31]),
        step("database_foundations.06_quality", "step_pattern.variant_comparison", "Falsche Daten früh stoppen", "Die CHECK-Regel akzeptiert für diesen Sensor nur plausible Temperaturen. Ergänze gedanklich: Welche weitere Regel wäre sinnvoll – darf ein Messwert ohne Zeitpunkt existieren, darf eine Seriennummer doppelt vorkommen?", [18]),
        step("database_foundations.07_capstone", "step_pattern.reflection_inspiration_sales_bridge", "Abschluss: Dein Mini-Datenlogger", "Erweitere den Entwurf um Luftfeuchte oder einen zweiten Raum. Liefere ein Datenmodell, drei Beispieldatensätze und eine Abfrage, die den neuesten Messwert pro Raum zeigt.", [4, 9, 15, 27]),
      ],
    });
  }

  registry.register({ slug: "database-foundations", create: createLesson });
})(window.LearningProjectRegistry);
