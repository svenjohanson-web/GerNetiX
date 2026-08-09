"use strict";

function renderEditableLineLabel(stepItem) {
  if (stepItem.editableLines.length === 0) {
    return "Nur erklären";
  }

  return `Editierbar: Zeile${stepItem.editableLines.length > 1 ? "n" : ""} ${stepItem.editableLines.join(", ")}`;
}

function renderPanel() {
  if (isComplete) {
    const summary = createCompletionSummary(lesson);
    sidePanel.innerHTML = `
      <p class="step-kicker">${escapeHtml(summary.eyebrow || "Lernrückblick")}</p>
      <h2>${escapeHtml(summary.title || lesson.title)}</h2>
      <p class="complete-note">${escapeHtml(summary.text)}</p>
      ${renderSummaryList(summary.learned)}
      ${summary.next ? `<div class="next-box"><strong>Nächster Schritt:</strong> ${escapeHtml(summary.next)}</div>` : ""}
      <div class="meta-box">
        <span>${escapeHtml(lesson.projectIdeaId)}</span>
        <span>${escapeHtml(lesson.projectVariantId)}</span>
      </div>
      <div class="panel-spacer"></div>
      <div class="actions">
        <button type="button" data-action="back">Zurück</button>
        <button type="button" class="primary" data-action="restart">Neu starten</button>
      </div>
    `;
    wirePanelButtons();
    return;
  }

  const stepItem = currentStep();
  const validationState = getValidationState(stepItem);
  const primaryActionLabel = stepItem.endButtonLabel
    || (currentStepIndex === lesson.steps.length - 1 ? "Abschließen" : "Weiter");

  sidePanel.innerHTML = `
    <p class="step-kicker">${stepItem.pattern}</p>
    <h2>${lesson.title}</h2>
    <h3>${stepItem.title}</h3>
    ${renderPanelStepText(stepItem)}
    ${renderModelingNote(stepItem)}
    ${renderStepMedia(stepItem)}
    ${renderDecisionControl(stepItem)}
    ${renderCompletionCondition(stepItem, validationState)}
    ${renderValidationApplyAction(stepItem)}
    ${renderValidation(validationState)}
    ${renderRuntimePreviewAction(stepItem, validationState)}
    ${renderAuthoringEditor(stepItem)}
    <div class="panel-spacer"></div>
    <p class="step-progress">Schritt ${currentStepIndex + 1} von ${lesson.steps.length}</p>
    <div class="actions">
      <button type="button" data-action="back" ${currentStepIndex === 0 ? "disabled" : ""}>Zurück</button>
      <button type="button" class="primary" data-action="next" ${validationState.canContinue ? "" : "disabled"}>${escapeHtml(primaryActionLabel)}</button>
    </div>
    <div class="outcome-box secondary-info"><strong>Ergebnis:</strong> ${stepItem.outcome}</div>
    <div class="meta-box secondary-info">
      <span>${stepItem.id}</span>
      <span>${stepItem.flowItemId}</span>
      <span>${renderBoardProfileLabel()}</span>
    </div>
  `;
  wirePanelButtons();
  wireAuthoringInputs(stepItem);
}

function renderPanelStepText(stepItem) {
  if (stepItem.endScreen) {
    return `<p class="step-text">${escapeHtml(stepItem.panelText || "Der freie Kurs ist abgeschlossen. Beende den Kurs, wenn du bereit bist.")}</p>`;
  }

  if (stepItem.panelTextParts?.length) {
    return `
      <div class="step-text">
        ${stepItem.panelTextParts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}
      </div>
    `;
  }

  if (stepItem.visual?.type === "plantUmlMachine") {
    return `<p class="step-text">${escapeHtml(stepItem.text)}</p>`;
  }

  const text = stepItem.visual
    ? "Lies die Erklärung links direkt zusammen mit den Bildern. Rechts bestätigst du nur den Schritt und siehst das Ergebnis."
    : stepItem.text;

  return `<p class="step-text">${escapeHtml(text)}</p>`;
}

function renderModelingNote(stepItem) {
  const note = stepItem.modelingNote;
  if (!note) return "";

  return `
    <section class="modeling-note">
      <h4>${escapeHtml(note.title)}</h4>
      ${(note.paragraphs || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      ${note.bullets?.length ? `<ul>${note.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${(note.closing || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
    </section>
  `;
}

function createCompletionSummary(lessonItem) {
  if (lessonItem.completionSummary) return lessonItem.completionSummary;

  return {
    eyebrow: "Lernrückblick",
    title: `Was du in ${lessonItem.title} gelernt hast`,
    text: "Die Lektion ist abgeschlossen. Du hast die wichtigsten Beobachtungen Schritt für Schritt aufgebaut.",
    learned: lessonItem.steps
      .map((stepItem) => stepItem.outcome)
      .filter(Boolean)
      .slice(0, 5),
    next: "Von hier aus kann die Projektidee vertieft oder in eine konkrete Umsetzung überführt werden.",
  };
}

function renderSummaryList(items) {
  if (!items?.length) return "";
  return `
    <section class="summary-list" aria-label="Gelernt">
      <h3>Das hast du gelernt</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}
function renderStepMedia(stepItem) {
  if (!stepItem.media?.imageSrc) return "";
  return `
    <figure class="step-media">
      <img src="${escapeAttribute(stepItem.media.imageSrc)}" alt="${escapeAttribute(stepItem.media.imageAlt || "Step-Bild")}">
      ${stepItem.media.imageAlt ? `<figcaption>${escapeHtml(stepItem.media.imageAlt)}</figcaption>` : ""}
    </figure>
  `;
}

function renderDecisionControl(stepItem) {
  if (stepItem.decision?.type !== "singleChoice") return "";

  const field = stepItem.decision.profileField;
  const selected = lesson.learnerProfile?.[field] || "";
  const buttons = stepItem.decision.options
    .map((option) => {
      const isActive = option.key === selected;
      return `<button type="button" class="${isActive ? "active" : ""}" data-action="select-decision" data-field="${escapeAttribute(field)}" data-value="${escapeAttribute(option.key)}">${escapeHtml(option.label)}</button>`;
    })
    .join("");

  return `
    <div class="decision-box">
      <strong>${escapeHtml(stepItem.decision.title || "Entscheidung")}</strong>
      <div class="decision-options">${buttons}</div>
    </div>
  `;
}

function renderCompletionCondition(stepItem, validationState) {
  if (!stepItem.completion) return "";

  const result = resolveCompletionResult(stepItem);
  const resultLabel = stepItem.completion.type === "acknowledge"
    ? validationState.canContinue ? "erfüllt" : "offen"
    : result ? renderDecisionResultLabel(stepItem, result) : "offen";

  return `
    <div class="completion-box ${validationState.canContinue ? "ok" : "blocked"}">
      <strong>Abschlussbedingung:</strong> ${escapeHtml(stepItem.completion.label)}
      <span>Ergebnis: ${escapeHtml(resultLabel)}</span>
    </div>
  `;
}

function renderDecisionResultLabel(stepItem, result) {
  const option = stepItem.decision?.options?.find((item) => item.key === result);
  return option?.label || result;
}

function renderAuthoringEditor(stepItem) {
  if (!isEditMode) return "";
  return `
    <div class="authoring-box">
      <label>Titel<input data-field="title" value="${escapeAttribute(stepItem.title)}"></label>
      <label>Text<textarea data-field="text">${escapeHtml(stepItem.text)}</textarea></label>
      <label>Ergebnis<textarea data-field="outcome">${escapeHtml(stepItem.outcome)}</textarea></label>
      <label>Bildpfad oder URL<input data-field="imageSrc" value="${escapeAttribute(stepItem.media?.imageSrc || "")}"></label>
      <label>Bildbeschreibung<input data-field="imageAlt" value="${escapeAttribute(stepItem.media?.imageAlt || "")}"></label>
      <label>Bilddatei<input data-field="imageFile" type="file" accept="image/*"></label>
      <button type="button" class="primary full" data-action="save-step">Step speichern</button>
    </div>
  `;
}

function renderValidation(validationState) {
  if (!validationState.message) {
    return "";
  }

  return `<div class="validation ${validationState.canContinue ? "ok" : "blocked"}">${validationState.message}</div>`;
}

function renderValidationApplyAction(stepItem) {
  if (!stepItem.validation?.applyLabel) return "";

  return `
    <div class="validation-action">
      <button type="button" class="primary full" data-action="apply-validation">${escapeHtml(stepItem.validation.applyLabel)}</button>
    </div>
  `;
}

function renderRuntimePreviewAction(stepItem, validationState) {
  if (!runtimePreviewAdapterFor(stepItem)) return "";

  const disabled = validationState.canContinue ? "" : "disabled";
  const title = validationState.canContinue
    ? "App ausführen"
    : "Run ist verfügbar, sobald die Abschlussbedingungen erfüllt sind.";

  return `
    <div class="runtime-preview-action">
      <button type="button" class="primary full" data-action="run-runtime-preview" ${disabled} title="${escapeAttribute(title)}">${escapeHtml(stepItem.runtimePreview.buttonLabel || "Run")}</button>
    </div>
  `;
}
