"use strict";

(function exposeLessonPattern(global) {
  function createDefaultWelcome(config) {
    return {
      eyebrow: "Projektidee",
      title: config.title,
      text: config.summary || "In diesem Projekt lernst du die fachliche Idee, die Systemgrenzen und die nächsten technischen Fragen kennen.",
      topics: (config.lines || [])
        .filter((line) => !line.startsWith("Projektidee:"))
        .slice(0, 4),
      startLabel: "Projekt starten",
    };
  }

  function createIdeaPreviewLesson(config) {
    return {
      ...config,
      welcome: config.welcome || createDefaultWelcome(config),
      source: `${config.lines.join("\n")}\n`,
      learnerProfile: { boardKey: "unknown" },
      boardProfiles: { unknown: { title: "Nicht relevant für diese Vorschau" } },
    };
  }

  function step(idSuffix, pattern, title, outcome, focusLines) {
    return {
      id: `step.${idSuffix}`,
      flowItemId: `project_flow_item.${idSuffix}`,
      pattern,
      title,
      text: outcome,
      outcome,
      focusLines,
      editableLines: [],
    };
  }

  global.GuidedLessonPattern = Object.freeze({
    createDefaultWelcome,
    createIdeaPreviewLesson,
    step,
  });
})(window);
