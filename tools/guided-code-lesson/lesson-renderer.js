"use strict";

function renderEditor() {
  const step = currentStep();

  if (!isComplete && step.endScreen) {
    renderEndScreenStage(step);
    return;
  }

  if (!isComplete && step.visual) {
    renderVisualStage(step);
    return;
  }

  editor.classList.remove("visual-mode", "end-screen-mode");
  const focusLines = new Set(isComplete ? [] : step.focusLines);
  const editableLines = new Set(isComplete ? codeLines.map((_, index) => index + 1) : step.editableLines);

  editor.classList.toggle("complete", isComplete);
  editor.innerHTML = "";

  codeLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const isEditable = editableLines.has(lineNumber);
    const row = document.createElement("div");
    row.className = [
      "code-line",
      isEditable ? "editable" : "readonly",
      focusLines.has(lineNumber) ? "focus" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const number = document.createElement("div");
    number.className = "code-line-number";
    number.textContent = lineNumber;

    const text = document.createElement("div");
    text.className = "code-text";
    text.textContent = line || " ";
    text.dataset.line = String(lineNumber);
    text.contentEditable = String(isEditable);
    text.spellcheck = false;
    text.addEventListener("keydown", handleLineKeydown);
    text.addEventListener("input", handleLineInput);
    text.addEventListener("paste", handlePaste);

    row.append(number, text);
    editor.append(row);
  });

  editorMode.textContent = isComplete
    ? "Abschlussansicht"
    : `${lesson.projectIdeaId} / ${currentStep().flowItemId}`;
  lineRuleBadge.textContent = isComplete
    ? "Alle Zeilen frei sichtbar"
    : renderEditableLineLabel(currentStep());
}

function renderEndScreenStage(step) {
  editor.classList.remove("complete");
  editor.classList.add("visual-mode", "end-screen-mode");
  fileName.textContent = step.title;
  editorMode.textContent = "Kursabschluss";
  lineRuleBadge.textContent = "Ende";
  editor.innerHTML = `
    <section class="course-end-stage" aria-label="${escapeAttribute(step.title)}">
      <p class="step-kicker">${escapeHtml(step.pattern)}</p>
      <h2>${escapeHtml(step.title)}</h2>
      <p>${escapeHtml(step.text)}</p>
      ${renderEndHighlightList(step.endHighlights)}
    </section>
  `;
}

function renderEndHighlightList(items) {
  if (!items?.length) return "";

  return `
    <ul class="course-end-highlights">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderVisualStage(step) {
  editor.classList.remove("complete");
  editor.classList.remove("end-screen-mode");
  editor.classList.add("visual-mode");
  fileName.textContent = step.visual.title || step.title;
  editorMode.textContent = "Bildfolge statt Code";
  lineRuleBadge.textContent = "Visualisierung";
  editor.innerHTML = `
    <div class="state-visual-stage">
      ${renderVisualIntro(step)}
      ${renderVisualContent(step.visual)}
    </div>
  `;
  wireVisualInputs(step);
  wirePlantUmlDiagrams(step);
}

function renderVisualIntro(step) {
  if (step.visual.type === "plantUmlMachine" || step.visual.hideIntro) return "";
  const parts = step.visual.introParts || [step.visual.intro || step.text];
  return `
    <div class="state-visual-intro">
      ${parts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}
    </div>
  `;
}

function renderVisualContent(visual) {
  if (visual.type === "cycle") return renderStateCycle(visual);
  if (visual.type === "plantUmlMachine") return renderPlantUmlMachine(visual);
  return renderVisualRows(visual);
}

function renderVisualRows(visual) {
  return `
    <div class="state-visual-rows">
      ${visual.rows.map(renderVisualRow).join("")}
    </div>
  `;
}

function renderStateCycle(visual) {
  const firstState = visual.states[0];
  const secondState = visual.states[1];
  const firstTransition = visual.transitions[0];
  const secondTransition = visual.transitions[1];

  return `
    <section class="state-cycle" aria-label="${escapeAttribute(visual.title || "Zustandskreislauf")}">
      <svg class="cycle-arrows" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
        <defs>
          <marker id="cycleArrowHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        <path class="cycle-path" d="M 230 132 C 310 18, 410 18, 490 132"></path>
        <path class="cycle-path" d="M 490 228 C 410 342, 310 342, 230 228"></path>
      </svg>
      <article class="state-card cycle-state">
        ${renderStatePicture(firstState)}
        <strong>${escapeHtml(firstState.label)}</strong>
      </article>
      <div class="cycle-transition cycle-top">
        <span>${escapeHtml(firstTransition.label)}</span>
      </div>
      <article class="state-card cycle-state">
        ${renderStatePicture(secondState)}
        <strong>${escapeHtml(secondState.label)}</strong>
      </article>
      <div class="cycle-transition cycle-bottom">
        <span>${escapeHtml(secondTransition.label)}</span>
      </div>
    </section>
  `;
}

function renderPlantUmlMachine(visual) {
  const sourceField = visual.sourceField;
  const source = lesson.learnerProfile?.[sourceField] || visual.plantUmlSource || "";

  return `
    <section class="machine-workspace" aria-label="${escapeAttribute(visual.title || "State-Machine")}">
      <div class="machine-diagram">
        ${source ? `
          <figure class="plantuml-viewer">
            <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(visual.title || "PlantUML-Diagramm")}">
            <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
          </figure>
        ` : ""}
      </div>
      <aside class="plantuml-editor-pane" aria-label="PlantUML-Eingabe">
        ${visual.insertHint ? `<div class="plantuml-insert-hint">${escapeHtml(visual.insertHint)}</div>` : ""}
        ${visual.exampleInsert ? `
          <button type="button" class="plantuml-example-button" data-action="insert-plantuml-example">
            ${escapeHtml(visual.exampleInsert.label)}
          </button>
        ` : ""}
        ${visual.resetSource ? `
          <button type="button" class="plantuml-example-button" data-action="reset-plantuml-source">
            ${escapeHtml(visual.resetLabel || "Zurücksetzen")}
          </button>
        ` : ""}
        ${visual.readonly
          ? `<pre class="plantuml-readonly"><code>${renderPlantUmlReadonlySource(source)}</code></pre>`
          : `<textarea class="plantuml-editor" data-action="edit-plantuml-source" data-field="${escapeAttribute(sourceField)}" spellcheck="false">${escapeHtml(source)}</textarea>`}
      </aside>
    </section>
  `;
}

function renderPlantUmlReadonlySource(source) {
  return escapeHtml(source).replace(/\b\d+\b/g, (value) =>
    `<mark class="plantuml-number-highlight">${value}</mark>`
  );
}

function renderVisualRow(row) {
  return `
    <section class="state-visual-row">
      <div class="state-visual-copy">
        <h3>${escapeHtml(row.label)}</h3>
        ${row.description ? `<p>${escapeHtml(row.description)}</p>` : ""}
      </div>
      <div class="state-sequence">
        ${row.states.map(renderVisualState).join("")}
      </div>
    </section>
  `;
}

function renderVisualState(state) {
  const value = state.value && state.showValue !== false ? `<span class="state-value">${escapeHtml(state.value)}</span>` : "";
  const substates = state.substates?.length
    ? `<div class="substate-list">${state.substates.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
    : "";
  return `
    <article class="state-card">
      ${renderStatePicture(state)}
      <strong>${escapeHtml(state.label)}</strong>
      ${value}
      ${substates}
    </article>
  `;
}

function renderStatePicture(state) {
  if (state.kind === "barrel") {
    return `<div class="picture barrel"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "battery") {
    return `<div class="picture battery"><span style="width: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "thermometer") {
    return `<div class="picture thermometer"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  }

  if (state.kind === "weather") {
    return renderWeatherPicture(state.value || state.label);
  }

  if (state.kind === "power") {
    return renderPowerPicture(state.value || state.label);
  }

  if (state.kind === "label") {
    return `<div class="picture label-state"><span>${escapeHtml(state.value || state.label)}</span></div>`;
  }

  return `<div class="picture stone ${escapeAttribute(state.tone || "warm")}"><span></span></div>`;
}

function renderWeatherPicture(kind) {
  const icons = {
    sunny: `
      <circle cx="41" cy="41" r="17" fill="#facc15"></circle>
      <g stroke="#f59e0b" stroke-width="5" stroke-linecap="round">
        <line x1="41" y1="9" x2="41" y2="18"></line>
        <line x1="41" y1="64" x2="41" y2="73"></line>
        <line x1="9" y1="41" x2="18" y2="41"></line>
        <line x1="64" y1="41" x2="73" y2="41"></line>
        <line x1="18" y1="18" x2="24" y2="24"></line>
        <line x1="58" y1="58" x2="64" y2="64"></line>
        <line x1="64" y1="18" x2="58" y2="24"></line>
        <line x1="24" y1="58" x2="18" y2="64"></line>
      </g>
    `,
    cloudy: `
      <path d="M25 55h33a14 14 0 0 0 0-28 18 18 0 0 0-34-2 15 15 0 0 0 1 30z" fill="#cbd5e1"></path>
      <path d="M31 48h27a10 10 0 0 0 0-20 15 15 0 0 0-28 0 11 11 0 0 0 1 20z" fill="#e2e8f0"></path>
    `,
    rainy: `
      <path d="M25 49h33a14 14 0 0 0 0-28 18 18 0 0 0-34-2 15 15 0 0 0 1 30z" fill="#cbd5e1"></path>
      <path d="M31 42h27a10 10 0 0 0 0-20 15 15 0 0 0-28 0 11 11 0 0 0 1 20z" fill="#e2e8f0"></path>
      <g stroke="#0284c7" stroke-width="5" stroke-linecap="round">
        <line x1="29" y1="59" x2="25" y2="72"></line>
        <line x1="43" y1="59" x2="39" y2="72"></line>
        <line x1="57" y1="59" x2="53" y2="72"></line>
      </g>
    `,
    windy: `
      <g fill="none" stroke="#0f766e" stroke-width="5" stroke-linecap="round">
        <path d="M14 28h43a9 9 0 0 1 9 9"></path>
        <path d="M14 43h55a9 9 0 0 1 9 9"></path>
        <path d="M14 58h37a9 9 0 0 1 9 9"></path>
      </g>
    `,
  };

  return `
    <div class="picture weather">
      <svg class="weather-svg" viewBox="0 0 82 82" aria-hidden="true" focusable="false">
        ${icons[kind] || icons.cloudy}
      </svg>
    </div>
  `;
}

function renderPowerPicture(kind) {
  const isOn = kind === "on";
  return `
    <div class="picture power ${isOn ? "on" : "off"}">
      <svg class="power-svg" viewBox="0 0 82 82" aria-hidden="true" focusable="false">
        ${isOn
          ? `<path d="M41 16v22" fill="none" stroke="#0f766e" stroke-width="7" stroke-linecap="round"></path>
             <path d="M28 25a25 25 0 1 0 26 0" fill="none" stroke="#0f766e" stroke-width="7" stroke-linecap="round"></path>`
          : `<circle cx="41" cy="41" r="24" fill="none" stroke="#64748b" stroke-width="7"></circle>
             <path d="M25 57 57 25" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round"></path>`}
      </svg>
    </div>
  `;
}

function wireVisualInputs(stepItem) {
  if (stepItem.visual?.type !== "plantUmlMachine") return;

  editor.querySelectorAll('[data-action="insert-plantuml-example"]').forEach((button) => {
    button.addEventListener("click", () => {
      insertPlantUmlExample(stepItem);
    });
  });

  editor.querySelectorAll('[data-action="reset-plantuml-source"]').forEach((button) => {
    button.addEventListener("click", () => {
      resetPlantUmlSource(stepItem);
    });
  });

  editor.querySelectorAll('[data-action="edit-plantuml-source"]').forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      if (!field) return;

      lesson.learnerProfile = {
        ...(lesson.learnerProfile || {}),
        [field]: input.value,
      };
      persistRuntimeEdits();
      renderPanel();

      const image = editor.querySelector("[data-plantuml-source]");
      if (image) {
        image.dataset.plantumlSource = input.value;
        renderPlantUmlImage(image, input.value);
      }
    });
  });

  editor.querySelectorAll('[data-action="edit-machine-condition"]').forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.dataset.field;
      const key = input.dataset.key;
      if (!field || !key) return;

      lesson.learnerProfile = {
        ...(lesson.learnerProfile || {}),
        [field]: {
          ...(lesson.learnerProfile?.[field] || {}),
          [key]: input.value,
        },
      };
      persistRuntimeEdits();
    });
  });

}

function insertPlantUmlExample(stepItem) {
  const example = stepItem.visual?.exampleInsert;
  const input = editor.querySelector('[data-action="edit-plantuml-source"]');
  if (!example) return;

  const sourceField = stepItem.visual.sourceField || "plantUmlSource";
  const currentSource = input?.value ?? lesson.learnerProfile?.[sourceField] ?? stepItem.visual.plantUmlSource ?? "";
  const result = resolvePlantUmlExampleInsert(currentSource, example);

  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [sourceField]: result.source,
  };
  persistRuntimeEdits();

  if (!input) {
    render();
    scrollPlantUmlReadonlyToOffset(result.source, result.selectionStart);
    return;
  }

  input.value = result.source;
  renderPanel();

  const image = editor.querySelector("[data-plantuml-source]");
  if (image) {
    image.dataset.plantumlSource = result.source;
    renderPlantUmlImage(image, result.source);
  }

  input.focus();
  input.setSelectionRange(result.selectionStart, result.selectionEnd);
}

function scrollPlantUmlReadonlyToOffset(source, offset) {
  const readonlyBlock = editor.querySelector(".plantuml-readonly");
  if (!readonlyBlock) return;

  const lineIndex = source.slice(0, offset).split("\n").length - 1;
  const computedStyle = window.getComputedStyle(readonlyBlock);
  const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : 20;
  readonlyBlock.scrollTop = Math.max(0, (lineIndex - 2) * lineHeight);
}

function resetPlantUmlSource(stepItem) {
  const sourceField = stepItem.visual?.sourceField || "plantUmlSource";
  const source = resolvePlantUmlResetSource(stepItem.visual);

  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [sourceField]: source,
  };
  persistRuntimeEdits();
  render();
}

function resolvePlantUmlResetSource(visual) {
  const sourceField = visual?.sourceField || "plantUmlSource";
  return visual?.plantUmlSource
    || lesson.runtimeDefaults?.[sourceField]
    || lesson.learnerProfile?.[sourceField]
    || "";
}

function resolvePlantUmlExampleInsert(source, example) {
  if (example.type === "transition") {
    return insertPlantUmlTransitionExample(source, example);
  }

  if (example.type === "initialValues") {
    return insertPlantUmlLinesBeforeEnd(source, example.lines);
  }

  if (example.type === "initialValueLine") {
    return insertPlantUmlLineIntoNote(source, example.noteStart, example.line);
  }

  if (example.type === "initialValueLineWithTransition") {
    const withInitialValue = insertPlantUmlLineIntoNote(source, example.noteStart, example.line);
    return insertPlantUmlLineBeforeEnd(withInitialValue.source, example.transitionLine);
  }

  return insertLinesIntoPlantUmlBlock(source, example.block, example.lines);
}

function insertPlantUmlTransitionExample(source, example) {
  const customStates = getPlantUmlStatesInBlockFromText(source, example.block)
    .filter((state) => !(example.existingAliases || []).includes(state.alias));
  const from = customStates[0]?.alias || example.fallback?.from || "state_a";
  const to = customStates[1]?.alias || example.fallback?.to || "state_b";
  const condition = chooseTransitionExampleCondition(from, to, example);
  const transitionLine = `${from} --> ${to} : ${condition}`;
  return insertPlantUmlLineBeforeEnd(source, transitionLine);
}

function chooseTransitionExampleCondition(from, to, example) {
  if (from === example.fallback?.from && to === example.fallback?.to) {
    return example.fallback.condition;
  }

  return "Bedingung eintragen";
}

function insertPlantUmlLineBeforeEnd(source, lineToInsert) {
  return insertPlantUmlLinesBeforeEnd(source, [lineToInsert]);
}

function insertPlantUmlLinesBeforeEnd(source, linesToInsert) {
  const lines = source.split("\n");
  const existingIndex = findExistingLineSequence(lines, linesToInsert);

  if (existingIndex >= 0) {
    const selectionStart = lineOffset(source, existingIndex);
    const selectedText = linesToInsert.join("\n");
    return {
      source,
      selectionStart,
      selectionEnd: selectionStart + selectedText.length,
    };
  }

  const endIndex = lines.findIndex((line) => line.trim() === "@enduml");
  const insertIndex = endIndex >= 0 ? endIndex : lines.length;
  lines.splice(insertIndex, 0, ...linesToInsert);

  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  const selectedText = linesToInsert.join("\n");
  return {
    source: nextSource,
    selectionStart,
    selectionEnd: selectionStart + selectedText.length,
  };
}

function findExistingLineSequence(lines, sequence) {
  return lines.findIndex((_, index) =>
    sequence.every((line, offset) => lines[index + offset]?.trim() === line.trim())
  );
}

function insertPlantUmlLineIntoNote(source, noteStart, lineToInsert) {
  const lines = source.split("\n");
  const noteStartIndex = lines.findIndex((line) => line.trim() === noteStart.trim());
  const existingIndex = lines.findIndex((line) => line.trim() === lineToInsert.trim());

  if (existingIndex >= 0) {
    const selectionStart = lineOffset(source, existingIndex);
    return {
      source,
      selectionStart,
      selectionEnd: selectionStart + lines[existingIndex].length,
    };
  }

  let insertIndex = -1;
  if (noteStartIndex >= 0) {
    insertIndex = lines.findIndex((line, index) => index > noteStartIndex && line.trim() === "end note");
  }

  if (insertIndex < 0) {
    return insertPlantUmlLinesBeforeEnd(source, [noteStart, lineToInsert, "end note"]);
  }

  lines.splice(insertIndex, 0, lineToInsert);
  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  return {
    source: nextSource,
    selectionStart,
    selectionEnd: selectionStart + lineToInsert.length,
  };
}

function insertLinesIntoPlantUmlBlock(source, block, linesToInsert) {
  const lines = source.split("\n");
  const existingAliases = new Set(
    parsePlantUmlStates(source)
      .map((state) => state.alias)
      .filter(Boolean)
  );
  const linesToAdd = linesToInsert.filter((line) => {
    const state = parsePlantUmlStateLine(line);
    return !state?.alias || !existingAliases.has(state.alias);
  });

  if (!linesToAdd.length) {
    const firstExistingIndex = lines.findIndex((line) => linesToInsert.includes(line));
    const selectionStart = firstExistingIndex >= 0
      ? lineOffset(source, firstExistingIndex)
      : 0;
    const selectionEnd = firstExistingIndex >= 0
      ? selectionStart + linesToInsert.join("\n").length
      : 0;
    return { source, selectionStart, selectionEnd };
  }

  let blockDepth = 0;
  let blockStartIndex = -1;
  let insertIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (blockStartIndex === -1 && isPlantUmlBlockStart(lines[index], block)) {
      blockStartIndex = index;
      blockDepth = 1;
      continue;
    }

    if (blockStartIndex === -1) continue;

    if (trimmed.endsWith("{")) blockDepth += 1;
    if (trimmed === "}") blockDepth -= 1;

    if (blockDepth === 0) {
      insertIndex = index;
      break;
    }
  }

  if (insertIndex === -1) {
    insertIndex = Math.max(lines.length - 1, 0);
  }

  lines.splice(insertIndex, 0, ...linesToAdd);
  const nextSource = lines.join("\n");
  const selectionStart = lineOffset(nextSource, insertIndex);
  const selectionEnd = selectionStart + linesToAdd.join("\n").length;
  return { source: nextSource, selectionStart, selectionEnd };
}

function parsePlantUmlStates(source) {
  return source
    .split(/\r?\n/)
    .map(parsePlantUmlStateLine)
    .filter(Boolean);
}

function parsePlantUmlStateLine(line) {
  const match = line.trim().match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!match) return null;
  return { label: match[1], alias: match[2] };
}

function lineOffset(source, lineIndex) {
  if (lineIndex <= 0) return 0;
  return source
    .split("\n")
    .slice(0, lineIndex)
    .join("\n").length + 1;
}

function wirePlantUmlDiagrams(stepItem) {
  if (stepItem.visual?.type !== "plantUmlMachine") return;

  editor.querySelectorAll("[data-plantuml-source]").forEach((image) => {
    renderPlantUmlImage(image, image.dataset.plantumlSource || "");
  });
}

async function renderPlantUmlImage(image, source) {
  const status = image.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
  image.classList.remove("loaded");

  if (!source) return;

  try {
    image.src = await createPlantUmlSvgUrl(source);
    image.addEventListener("load", () => {
      image.classList.add("loaded");
      if (status) status.textContent = "Gerendert aus PlantUML.";
    }, { once: true });
    image.addEventListener("error", () => {
      if (status) status.textContent = "PlantUML-Bild konnte nicht geladen werden.";
    }, { once: true });
  } catch {
    if (status) status.textContent = "PlantUML-Bild konnte im Browser nicht erzeugt werden.";
  }
}

async function createPlantUmlSvgUrl(source) {
  const bytes = new TextEncoder().encode(themedPlantUmlSource(source));
  const compressed = await deflateForPlantUml(bytes);
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
}

function themedPlantUmlSource(source) {
  const theme = [
    "skinparam backgroundColor transparent",
    "skinparam shadowing false",
    "skinparam defaultFontColor #F8FAFC",
    "skinparam defaultFontSize 15",
    "skinparam stereotypeFontColor #E2E8F0",
    "skinparam TitleFontColor #F8FAFC",
    "skinparam TitleFontSize 18",
    "skinparam ArrowColor #F8FAFC",
    "skinparam ArrowFontColor #F8FAFC",
    "skinparam ArrowThickness 2",
    "skinparam rectangleBackgroundColor #1E3A5F",
    "skinparam rectangleBorderColor #67E8F9",
    "skinparam rectangleFontColor #FFFFFF",
    "skinparam actorBackgroundColor #1E3A5F",
    "skinparam actorBorderColor #67E8F9",
    "skinparam actorFontColor #FFFFFF",
    "skinparam componentBackgroundColor #1E3A5F",
    "skinparam componentBorderColor #67E8F9",
    "skinparam componentFontColor #FFFFFF",
    "skinparam nodeBackgroundColor #1E3A5F",
    "skinparam nodeBorderColor #67E8F9",
    "skinparam nodeFontColor #FFFFFF",
    "skinparam databaseBackgroundColor #1E3A5F",
    "skinparam databaseBorderColor #67E8F9",
    "skinparam databaseFontColor #FFFFFF",
    "skinparam packageBackgroundColor #172554",
    "skinparam packageBorderColor #67E8F9",
    "skinparam packageFontColor #FFFFFF",
    "skinparam classBackgroundColor #1E3A5F",
    "skinparam classBorderColor #67E8F9",
    "skinparam classFontColor #FFFFFF",
    "skinparam noteBackgroundColor #334155",
    "skinparam noteBorderColor #FACC15",
    "skinparam noteFontColor #FFFFFF",
    "skinparam participantBackgroundColor #1E3A5F",
    "skinparam participantBorderColor #67E8F9",
    "skinparam participantFontColor #FFFFFF",
    "skinparam sequenceLifeLineBorderColor #E2E8F0",
    "skinparam sequenceDividerBackgroundColor #334155",
    "skinparam sequenceDividerBorderColor #67E8F9",
    "skinparam sequenceDividerFontColor #FFFFFF",
    "skinparam activityBackgroundColor #1E3A5F",
    "skinparam activityBorderColor #67E8F9",
    "skinparam activityFontColor #FFFFFF",
    "skinparam stateBackgroundColor #1E3A5F",
    "skinparam stateBorderColor #67E8F9",
    "skinparam stateFontColor #FFFFFF",
    "skinparam usecaseBackgroundColor #1E3A5F",
    "skinparam usecaseBorderColor #67E8F9",
    "skinparam usecaseFontColor #FFFFFF",
    "skinparam objectBackgroundColor #1E3A5F",
    "skinparam objectBorderColor #67E8F9",
    "skinparam objectFontColor #FFFFFF",
  ].join("\n");
  const text = String(source || "");
  return /^\s*@startuml[^\r\n]*/im.test(text)
    ? text.replace(/^(\s*@startuml[^\r\n]*)/im, `$1\n${theme}`)
    : `${theme}\n${text}`;
}

async function deflateForPlantUml(bytes) {
  if (typeof CompressionStream === "undefined") {
    throw new Error("CompressionStream unavailable");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.slice(2, -4);
}

function encodePlantUmlBytes(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    output += appendPlantUml3Bytes(
      bytes[index],
      bytes[index + 1] ?? 0,
      bytes[index + 2] ?? 0,
    );
  }
  return output;
}

function appendPlantUml3Bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return encodePlantUml6Bit(c1 & 0x3f)
    + encodePlantUml6Bit(c2 & 0x3f)
    + encodePlantUml6Bit(c3 & 0x3f)
    + encodePlantUml6Bit(c4 & 0x3f);
}

function encodePlantUml6Bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}
