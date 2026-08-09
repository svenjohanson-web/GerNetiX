"use strict";

async function publishLessonToServerPreview() {
  if (!publishToServerButton) return;
  const originalText = publishToServerButton.textContent;
  publishToServerButton.textContent = "Wird gespiegelt...";
  publishToServerButton.classList.add("is-syncing");
  publishToServerButton.disabled = true;

  try {
    const payload = {
      slug: lesson.slug,
      project_id: `project_${lesson.slug}`,
      view_manifest: createServerPreviewManifest(lesson),
    };
    const response = await fetch("http://127.0.0.1:4300/api/dev/lesson-preview-migration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || result.error || "Migration fehlgeschlagen.");
    }
    publishToServerButton.textContent = `Gespiegelt (${result.view_count})`;
    window.open(`http://127.0.0.1:4300${result.preview_url}`, "_blank", "noopener");
  } catch (error) {
    publishToServerButton.textContent = "Fehler beim Spiegeln";
    window.alert(`Server-Preview konnte nicht erstellt werden: ${error.message}`);
  } finally {
    window.setTimeout(() => {
      publishToServerButton.textContent = originalText;
      publishToServerButton.classList.remove("is-syncing");
      publishToServerButton.disabled = false;
    }, 2200);
  }
}

function createServerPreviewManifest(lessonItem) {
  return {
    schema_version: 1,
    title: lessonItem.title,
    summary: lessonItem.welcome?.text || lessonItem.summary || "",
    primary_source_path: "model/lesson.json",
    hide_source_editor: true,
    mode: "guided_ide",
    views: lessonItem.steps
      .filter((stepItem) => !stepItem.endScreen)
      .map((stepItem, index) => convertLessonStepToManifestView(lessonItem, stepItem, index)),
  };
}

function convertLessonStepToManifestView(lessonItem, stepItem, index) {
  if (stepItem.visual?.type === "plantUmlMachine") {
    const sourceField = stepItem.visual.sourceField || "plantUmlSource";
    const source = lessonItem.learnerProfile?.[sourceField] || stepItem.visual.plantUmlSource || "";
    return {
      id: stepItem.id,
      type: "plantuml",
      title: stepItem.title,
      summary: stepItem.text || "",
      completion: { type: "acknowledge", label: stepItem.completion?.label || "Verstanden" },
      validation: { type: "plantuml_contains", must_contain: ["-->"] },
      payload: {
        source,
        highlight_lines: highlightedPlantUmlLines(source),
        model_lines: [
          { label: "PlantUML", text: "Das Diagramm wird aus der textuellen PlantUML-Quelle erzeugt." },
          { label: "Projektmodell", text: stepItem.outcome || "Die View stammt aus dem Dev-Step-by-Step-Tool." },
        ],
      },
    };
  }

  return {
    id: stepItem.id,
    type: "story_slide",
    title: stepItem.title,
    summary: stepItem.text || "",
    completion: { type: "acknowledge", label: stepItem.completion?.label || "Verstanden" },
    payload: {
      artifact: convertLessonVisualToArtifact(lessonItem, stepItem, index),
      note: stepItem.modelingNote?.title || "",
      model_lines: [
        { label: "Ziel", text: stepItem.outcome || stepItem.text || "" },
      ],
    },
  };
}

function convertLessonVisualToArtifact(lessonItem, stepItem, index) {
  const visual = stepItem.visual;
  if (visual?.type === "cycle") {
    return {
      type: "cycle",
      title: visual.title,
      states: visual.states || [],
      transitions: visual.transitions || [],
    };
  }
  if (visual?.rows) {
    return {
      type: "state_rows",
      title: visual.title,
      rows: visual.rows || [],
    };
  }
  if (index === 0) {
    return {
      type: "code",
      title: lessonItem.file || "Projektquelle",
      content: lessonItem.source.split(/\r?\n/).slice(0, 90).join("\n"),
    };
  }
  return {
    type: "svg_note",
    title: stepItem.title,
    text: stepItem.text || "",
  };
}

function highlightedPlantUmlLines(source) {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((item) => /state |-->|Initialwerte|Hunger/.test(item.line))
    .map((item) => item.number);
}
