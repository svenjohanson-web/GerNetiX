const GuidedProjectView = (() => {
  function create(deps) {
    const {
      state,
      getJson,
      postJson,
      putJson,
      progressFor,
      escapeHtml,
      escapeAttribute,
      meta,
    } = deps;

    function renderProjectViewManifest(project) {
      const target = document.querySelector("#ideProjectViewManifest");
      if (!target) return;
      const manifest = project?.viewManifest || {};
      const views = guidedViews(project);
      if (!views.length) {
        target.innerHTML = `<p class="empty">Dieses Projekt hat noch keine gespeicherte IDE-Ansicht.</p>`;
        return;
      }
      state.activeIdeStep = Math.min(state.activeIdeStep || 0, views.length - 1);
      const activeView = views[state.activeIdeStep];
      const validation = validateGuidedView(activeView);
      const progress = progressFor(project.id);
      target.innerHTML = `
        <div class="manifest-head">
          <p class="eyebrow">Projektansicht</p>
          <h3>${escapeHtml(manifest.title || "IDE Ansicht")}</h3>
          <p>${escapeHtml(manifest.summary || "")}</p>
        </div>
        <div class="guided-runner">
          <nav class="guided-step-rail" aria-label="Guided IDE Schritte">
            ${views.map((view, index) => `
              <button class="${index === state.activeIdeStep ? "active" : ""} ${progress.completedSteps.includes(index) ? "done" : ""}" type="button" data-ide-step="${index}">
                <span>${index + 1}</span>
                ${escapeHtml(view.title || view.id)}
              </button>
            `).join("")}
          </nav>
          <section class="guided-step-panel">
            <p class="eyebrow">Schritt ${state.activeIdeStep + 1} von ${views.length}</p>
            <div class="guided-artifact-layout">
              <section class="guided-artifact-pane">
                ${renderGuidedArtifact(activeView)}
              </section>
              <aside class="guided-summary-pane">
                ${renderManifestView(activeView, validation)}
                ${renderGuidedValidation(activeView, validation)}
                ${renderCodeExplorerChat(project, activeView)}
                ${renderGuidedActions(project, activeView, validation)}
              </aside>
            </div>
          </section>
        </div>
      `;
      target.querySelectorAll("[data-ide-step]").forEach((button) => {
        button.addEventListener("click", () => setIdeGuidedStep(project, Number(button.dataset.ideStep)));
      });
      target.querySelector("[data-guided-back]")?.addEventListener("click", () => setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1)));
      target.querySelector("[data-guided-next]")?.addEventListener("click", () => completeIdeGuidedStep(project));
      target.querySelector("[data-guided-preview]")?.addEventListener("click", () => openGuidedRuntimePreview(activeView));
      target.querySelectorAll("[data-guided-control]").forEach((button) => {
        button.addEventListener("click", () => handleGuidedControl(project, activeView, button.dataset.guidedControl));
      });
      target.querySelector("[data-code-explorer-chat]")?.addEventListener("submit", (event) => submitCodeExplorerChat(event, project, activeView));
      target.querySelectorAll("[data-apply-code-edit]").forEach((button) => {
        button.addEventListener("click", () => applyCodeExplorerEdit(project, activeView, button.dataset.editMessage, Number(button.dataset.applyCodeEdit)));
      });
      renderGuidedPlantUml(target);
    }

    function codeChatKey(project, view) {
      return `${project.id}:${view.id || state.activeIdeStep}`;
    }

    function codeChatMessages(project, view) {
      const key = codeChatKey(project, view);
      if (!Array.isArray(state.guidedCodeChats[key])) state.guidedCodeChats[key] = [];
      return state.guidedCodeChats[key];
    }

    function isCodeExplorerView(view) {
      return view?.type === "source_analysis" || view?.payload?.artifact?.type === "code";
    }

    function renderCodeExplorerChat(project, view) {
      if (!isCodeExplorerView(view)) return "";
      const messages = codeChatMessages(project, view);
      return `
        <section class="code-explorer-chat">
          <div class="code-explorer-chat-head">
            <p class="eyebrow">KI-Chat</p>
            <strong>Code gemeinsam verstehen</strong>
          </div>
          <div class="code-explorer-chat-messages" aria-live="polite">
            ${messages.length ? messages.map((message) => `
              <article class="code-explorer-chat-message ${message.role}">
                <span>${message.role === "assistant" ? "KI" : "Du"}</span>
                <p>${escapeHtml(message.content)}</p>
                ${message.fileEdits?.length ? `<div class="code-explorer-edits">
                  ${message.fileEdits.map((edit, editIndex) => `<button type="button" data-edit-message="${messages.indexOf(message)}" data-apply-code-edit="${editIndex}" ${edit.applied ? "disabled" : ""}>${edit.applied ? "Uebernommen" : `Aenderung in ${escapeHtml(edit.path)} uebernehmen`}</button>`).join("")}
                </div>` : ""}
              </article>
            `).join("") : `<p class="helper-text">Frage die KI zum sichtbaren Code, zu einzelnen Zeilen oder zum Verhalten.</p>`}
          </div>
          <form data-code-explorer-chat>
            <label>Frage zum Code
              <textarea rows="3" name="message" placeholder="Was passiert in dieser Funktion?"></textarea>
            </label>
            <div class="button-row">
              <span class="chat-status" data-code-chat-status>Bereit.</span>
              <button class="primary" type="submit">Fragen</button>
            </div>
          </form>
        </section>
      `;
    }

    async function submitCodeExplorerChat(event, project, view) {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.elements.message;
      const content = String(input.value || "").trim();
      if (!content) return;
      const messages = codeChatMessages(project, view);
      messages.push({ role: "user", content });
      input.value = "";
      form.querySelector("button").disabled = true;
      form.querySelector("[data-code-chat-status]").textContent = "KI analysiert den Code...";
      try {
        const artifact = view.payload?.artifact || {};
        const files = await loadCodeExplorerProjectFiles(project);
        const response = await postJson("/api/platform/development-assistant/chat", {
          projectId: project.id,
          assistantMode: "code_explorer",
          messages,
          codeContext: {
            path: view.source_path || state.sourcePath || "Projektquelle",
            content: artifact.content || document.querySelector("#sourceEditor")?.value || "",
            focusLines: view.source_lines || view.editable_lines || [],
            questions: view.payload?.questions || [],
            files,
            artifacts: guidedViews(project).map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              summary: item.summary,
              sourcePath: item.source_path,
              payload: item.payload,
            })),
          },
        });
        messages.push({ role: "assistant", content: response.message?.content || "Keine Antwort erhalten.", fileEdits: response.fileEdits || [] });
      } catch (error) {
        messages.push({ role: "assistant", content: `Der Code-Assistent ist gerade nicht erreichbar: ${error.message}` });
      }
      renderProjectViewManifest(project);
    }

    async function loadCodeExplorerProjectFiles(project) {
      const sources = state.projectSourcesByProjectId[project.id] || [];
      const loaded = await Promise.all(sources.slice(0, 40).map(async (source) => {
        const path = source.path || source.source_path;
        if (!path) return null;
        const result = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(path)}`);
        return { path, content: result.content || "" };
      }));
      return loaded.filter(Boolean);
    }

    async function applyCodeExplorerEdit(project, view, messageIndex, editIndex) {
      const message = codeChatMessages(project, view)[Number(messageIndex)];
      const edit = message?.fileEdits?.[editIndex];
      if (!edit || edit.applied) return;
      await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(edit.path)}`, { content: edit.content });
      edit.applied = true;
      if (state.sourcePath === edit.path) document.querySelector("#sourceEditor").value = edit.content;
      renderProjectViewManifest(project);
    }

    function renderGuidedArtifact(view) {
      const artifact = view.payload?.artifact || {};
      const artifactRenderers = {
        code: renderGuidedCodeArtifact,
        state_rows: renderGuidedStateRows,
        cycle: renderGuidedCycle,
        plantuml: () => renderGuidedPlantUmlArtifact(view),
        svg_note: renderGuidedSvgNote,
      };
      const viewRenderers = {
        plantuml: () => renderGuidedPlantUmlArtifact(view),
      };
      const renderer = artifactRenderers[artifact.type] || viewRenderers[view.type];
      if (renderer) return renderer(artifact);
      return `
        <div class="guided-artifact-empty">
          <p class="eyebrow">Artefakt</p>
          <h3>${escapeHtml(view.title || "Projektartefakt")}</h3>
          <p>${escapeHtml(view.summary || "Dieses Projekt legt fest, welches Artefakt hier angezeigt wird.")}</p>
        </div>
      `;
    }

    function renderGuidedCodeArtifact(artifact) {
      const lines = String(artifact.content || "").replace(/\r\n/g, "\n").split("\n");
      return `
        <div class="guided-code-viewer">
          <div class="guided-artifact-head">
            <p class="eyebrow">Code Viewer</p>
            <h3>${escapeHtml(artifact.title || "Quellcode")}</h3>
          </div>
          <pre>${lines.map((line, index) => `<span><b>${String(index + 1).padStart(3, " ")}</b>${escapeHtml(line)}</span>`).join("")}</pre>
        </div>
      `;
    }

    function renderGuidedStateRows(artifact) {
      const rows = artifact.rows || [];
      return `
        <div class="guided-visual-stage">
          <div class="guided-artifact-head">
            <p class="eyebrow">Visualisierung</p>
            <h3>${escapeHtml(artifact.title || "Zustaende")}</h3>
          </div>
          <div class="guided-state-rows">
            ${rows.map((row) => `
              <section class="guided-state-row">
                <div>
                  <strong>${escapeHtml(row.label)}</strong>
                  <p>${escapeHtml(row.description || "")}</p>
                </div>
                <div class="guided-state-sequence">
                  ${(row.states || []).map(renderGuidedStateCard).join("")}
                </div>
              </section>
            `).join("")}
          </div>
        </div>
      `;
    }

    function renderGuidedCycle(artifact) {
      const states = artifact.states || [];
      const transitions = artifact.transitions || [];
      const firstState = states[0] || { label: "Start", kind: "label" };
      const secondState = states[1] || { label: "Ziel", kind: "label" };
      return `
        <div class="guided-visual-stage">
          <div class="guided-artifact-head">
            <p class="eyebrow">SVG Modell</p>
            <h3>${escapeHtml(artifact.title || "Zustandskreislauf")}</h3>
          </div>
          <section class="guided-cycle" aria-label="${escapeAttribute(artifact.title || "Zustandskreislauf")}">
            <svg class="guided-cycle-arrows" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
              <defs>
                <marker id="guidedCycleArrowHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              </defs>
              <path class="guided-cycle-path" d="M 230 132 C 310 18, 410 18, 490 132"></path>
              <path class="guided-cycle-path" d="M 490 228 C 410 342, 310 342, 230 228"></path>
            </svg>
            <article class="guided-state-card guided-cycle-state">${renderGuidedStatePicture(firstState)}<strong>${escapeHtml(firstState.label)}</strong></article>
            <div class="guided-cycle-transition guided-cycle-top"><span>${escapeHtml(transitions[0]?.label || "")}</span></div>
            <article class="guided-state-card guided-cycle-state">${renderGuidedStatePicture(secondState)}<strong>${escapeHtml(secondState.label)}</strong></article>
            <div class="guided-cycle-transition guided-cycle-bottom"><span>${escapeHtml(transitions[1]?.label || "")}</span></div>
          </section>
        </div>
      `;
    }

    function renderGuidedPlantUmlArtifact(view) {
      const source = view.payload?.source || view.payload?.artifact?.source || "";
      const highlightLines = new Set((view.payload?.highlight_lines || view.payload?.highlightLines || []).map(Number));
      const sourceLines = String(source).replace(/\r\n/g, "\n").split("\n");
      return `
        <div class="guided-plantuml-workspace">
          <div class="guided-artifact-head">
            <p class="eyebrow">PlantUML</p>
            <h3>${escapeHtml(view.title || "Zustandsmodell")}</h3>
          </div>
          <figure class="plantuml-viewer">
            <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(view.title || "PlantUML Diagramm")}">
            <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
          </figure>
          <pre class="plantuml-box highlighted-source">${sourceLines.map((line, index) => `<span class="${highlightLines.has(index + 1) ? "is-highlighted" : ""}"><b>${String(index + 1).padStart(2, " ")}</b>${escapeHtml(line || " ")}</span>`).join("")}</pre>
        </div>
      `;
    }

    function renderGuidedSvgNote(artifact) {
      return `
        <div class="guided-svg-note">
          <svg viewBox="0 0 720 360" aria-hidden="true" focusable="false">
            <rect x="70" y="70" width="220" height="120" rx="12"></rect>
            <rect x="430" y="70" width="220" height="120" rx="12"></rect>
            <path d="M 290 130 C 340 80, 380 80, 430 130"></path>
            <path d="M 430 170 C 380 230, 340 230, 290 170"></path>
          </svg>
          <h3>${escapeHtml(artifact.title || "Modellartefakt")}</h3>
          <p>${escapeHtml(artifact.text || "")}</p>
        </div>
      `;
    }

    function renderGuidedStateCard(state) {
      const value = state.value && state.showValue !== false ? `<span>${escapeHtml(state.value)}</span>` : "";
      const substates = state.substates?.length ? `<div class="guided-substates">${state.substates.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</div>` : "";
      return `
        <article class="guided-state-card">
          ${renderGuidedStatePicture(state)}
          <strong>${escapeHtml(state.label)}</strong>
          ${value}
          ${substates}
        </article>
      `;
    }

    function renderGuidedStatePicture(state) {
      if (state.kind === "barrel") return `<div class="guided-picture barrel"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
      if (state.kind === "battery") return `<div class="guided-picture battery"><span style="width: ${Number(state.level) || 0}%"></span></div>`;
      if (state.kind === "thermometer") return `<div class="guided-picture thermometer"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
      if (state.kind === "power") return `<div class="guided-picture power ${state.value === "on" ? "on" : "off"}"><span>${state.value === "on" ? "AN" : "AUS"}</span></div>`;
      if (state.kind === "weather") return `<div class="guided-picture weather"><span>${escapeHtml(state.label)}</span></div>`;
      if (state.kind === "label") return `<div class="guided-picture label-state"><span>${escapeHtml(state.value || state.label)}</span></div>`;
      return `<div class="guided-picture stone ${escapeAttribute(state.tone || "warm")}"><span></span></div>`;
    }

    function renderManifestView(view, validation = null) {
      const typeLabel = {
        source_analysis: "Analyse",
        explanation: "Erklaerung",
        story_slide: "Lernfolie",
        plantuml: "PlantUML",
        implementation_plan: "Umsetzung",
        runtime_preview: "Preview",
      }[view.type] || view.type;
      return `
        <article class="manifest-view-card active-step">
          <div class="manifest-view-title">
            <span>${escapeHtml(typeLabel)}</span>
            <strong>${escapeHtml(view.title || view.id)}</strong>
          </div>
          <p>${escapeHtml(view.summary || "")}</p>
          ${renderRequiredFunctions(view)}
          ${renderManifestPayload(view)}
          ${validation?.focus ? `<pre class="source-focus-box">${escapeHtml(validation.focus)}</pre>` : ""}
        </article>
      `;
    }

    function renderManifestPayload(view) {
      const payload = view.payload || {};
      if (view.type === "source_analysis") {
        const lines = (view.source_lines || []).length ? `Zeilen: ${(view.source_lines || []).join(", ")}` : "";
        const questions = payload.questions || [];
        return `
          <dl class="meta-list compact">
            ${meta("Datei", view.source_path || "Projektquelle")}
            ${lines ? meta("Fokus", lines) : ""}
          </dl>
          ${questions.length ? `<ul class="manifest-list">${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        `;
      }
      if (view.type === "explanation") {
        const cards = payload.cards || [];
        return cards.length ? `<div class="explanation-grid">${cards.map((card) => `
          <div>
            <strong>${escapeHtml(card.title)}</strong>
            <p>${escapeHtml(card.text)}</p>
          </div>
        `).join("")}</div>` : "";
      }
      if (view.type === "story_slide") {
        const lines = payload.model_lines || [];
        const note = payload.note || "";
        return `
          ${note ? `<div class="insight">${escapeHtml(note)}</div>` : ""}
          ${lines.length ? `<div class="model-line-list">${lines.map((line) => `
            <article>
              <span>${escapeHtml(line.label)}</span>
              <p>${escapeHtml(line.text)}</p>
            </article>
          `).join("")}</div>` : ""}
        `;
      }
      if (view.type === "plantuml") {
        const lines = payload.model_lines || [];
        return `
          <p class="helper-text">Links siehst du das gerenderte Diagramm und die PlantUML-Quelle als Projektartefakt.</p>
          ${lines.length ? `<div class="model-line-list">${lines.map((line) => `
            <article>
              <span>${escapeHtml(line.label)}</span>
              <p>${escapeHtml(line.text)}</p>
            </article>
          `).join("")}</div>` : ""}
        `;
      }
      if (view.type === "implementation_plan") {
        const tasks = payload.tasks || [];
        return tasks.length ? `<ul class="manifest-list">${tasks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
      }
      return Object.keys(payload).length ? `<pre class="plantuml-box">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>` : "";
    }

    function renderRequiredFunctions(view) {
      const functions = normalizeRequiredFunctions(view);
      return functions.length ? `<dl class="meta-list compact">${meta("Funktionen", functions.join(", "))}</dl>` : "";
    }

    function guidedViews(project) {
      return Array.isArray(project?.viewManifest?.views) ? project.viewManifest.views : [];
    }

    function validateGuidedView(view) {
      const source = document.querySelector("#sourceEditor")?.value || "";
      const payloadSource = view?.payload?.source || "";
      const validation = view?.validation || {};
      const completion = view?.completion || {};
      const focus = sourceFocusText(source, view?.source_lines || view?.editable_lines || []);

      if (validation.type === "source_contains_all" || completion.type === "source_contains_all") {
        const required = validation.must_contain || completion.must_contain || ["delay"];
        const missing = required.filter((item) => !source.includes(item));
        return {
          canContinue: missing.length === 0,
          message: missing.length ? "Dieser Schritt braucht noch eine kleine Ergaenzung." : "",
          focus,
        };
      }

      if (validation.type === "plantuml_contains") {
        const required = validation.must_contain || [];
        const missing = required.filter((item) => !payloadSource.includes(item));
        return {
          canContinue: missing.length === 0,
          message: missing.length ? "Das Diagramm konnte noch nicht passend gelesen werden." : "",
          focus,
        };
      }

      return {
        canContinue: true,
        message: "",
        focus,
      };
    }

    function sourceFocusText(source, lines) {
      const selected = Array.from(new Set((lines || []).map(Number).filter((line) => line > 0))).sort((left, right) => left - right);
      if (!selected.length) return "";
      const sourceLines = source.split(/\r?\n/);
      return selected
        .map((line) => `${String(line).padStart(3, " ")} | ${sourceLines[line - 1] || ""}`)
        .join("\n");
    }

    function renderGuidedValidation(view, validation) {
      if (validation.canContinue) return "";
      return `<div class="validation blocked">${escapeHtml(validation.message || "Dieser Schritt ist noch nicht bereit.")}</div>`;
    }

    function renderGuidedActions(project, view, validation) {
      const controls = guidedControls(project, view, validation);
      return `
        <div class="guided-actions">
          ${controls.actions.map((action) => `
            <button
              class="${action.primary ? "primary" : ""}"
              type="button"
              data-guided-control="${escapeAttribute(action.fn)}"
              ${action.disabled ? "disabled" : ""}
            >${escapeHtml(action.label)}</button>
          `).join("")}
        </div>
      `;
    }

    function guidedControls(project, view, validation) {
      const views = guidedViews(project);
      const isLast = state.activeIdeStep >= views.length - 1;
      const configured = Array.isArray(view?.controls?.actions) ? view.controls.actions : [];
      const actions = configured.length
        ? configured.map((action) => normalizeControlAction(action, validation, isLast)).filter(Boolean)
        : defaultControlActions(view, validation, isLast);
      return { actions };
    }

    function defaultControlActions(view, validation, isLast) {
      return [
        { fn: "previous_step", label: "Zurueck", disabled: state.activeIdeStep === 0 },
        view.runtime_preview ? { fn: "runtime_preview", label: view.runtime_preview.button_label || "Preview starten" } : null,
        { fn: "next_step", label: isLast ? "Fertig" : "Weiter", primary: true, disabled: !validation.canContinue },
      ].filter(Boolean);
    }

    function normalizeControlAction(action, validation, isLast) {
      const fn = String(action.function || action.fn || action.id || "").trim();
      if (!fn) return null;
      const disablesWhenInvalid = action.requires_valid !== false && (fn === "next_step" || action.primary);
      return {
        fn,
        label: action.label || defaultControlLabel(fn, isLast),
        primary: Boolean(action.primary) || fn === "next_step",
        disabled: Boolean(action.disabled) || (fn === "previous_step" && state.activeIdeStep === 0) || (disablesWhenInvalid && !validation.canContinue),
      };
    }

    function defaultControlLabel(fn, isLast) {
      return {
        previous_step: "Zurueck",
        next_step: isLast ? "Fertig" : "Weiter",
        runtime_preview: "Preview starten",
      }[fn] || fn;
    }

    function normalizeRequiredFunctions(view) {
      const required = view?.required_functions || view?.requiredFunctions || view?.controls?.required_functions || [];
      return Array.isArray(required) ? required.map(String).filter(Boolean) : [];
    }

    function handleGuidedControl(project, view, fn) {
      if (fn === "previous_step") return setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1));
      if (fn === "next_step") return completeIdeGuidedStep(project);
      if (fn === "runtime_preview") return openGuidedRuntimePreview(view);
      return undefined;
    }

    async function setIdeGuidedStep(project, index) {
      state.activeIdeStep = Math.max(0, Math.min(index, guidedViews(project).length - 1));
      await saveIdeGuidedProgress(project, state.activeIdeStep, progressFor(project.id).completedSteps);
      renderProjectViewManifest(project);
      focusIdeStepSource(project);
    }

    async function completeIdeGuidedStep(project) {
      const completed = new Set(progressFor(project.id).completedSteps);
      completed.add(state.activeIdeStep);
      const next = Math.min(state.activeIdeStep + 1, guidedViews(project).length - 1);
      state.activeIdeStep = next;
      await saveIdeGuidedProgress(project, next, Array.from(completed));
      renderProjectViewManifest(project);
      focusIdeStepSource(project);
    }

    async function saveIdeGuidedProgress(project, currentStep, completedSteps) {
      const progress = await postJson("/api/platform/learning-progress", {
        courseId: project.courseId,
        lessonId: project.lessonId,
        projectId: project.id,
        currentStep,
        completedSteps,
      });
      state.progress = state.progress.filter((item) => item.id !== progress.id).concat(progress);
      state.workspace = await postJson("/api/platform/workspace-state", {
        lastProjectId: project.id,
        lastMode: "ide",
        lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
      });
    }

    function focusIdeStepSource(project) {
      const view = guidedViews(project)[state.activeIdeStep];
      const line = Number((view?.source_lines || view?.editable_lines || [])[0] || 0);
      const editor = document.querySelector("#sourceEditor");
      if (!editor || !line) return;
      const lines = editor.value.split(/\r?\n/);
      const start = lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
      const end = start + (lines[line - 1] || "").length;
      editor.focus();
      editor.setSelectionRange(start, end);
    }

    function openGuidedRuntimePreview(view) {
      const preview = view.runtime_preview || {};
      const frames = preview.frames || ["Preview bereit."];
      const overlay = document.createElement("div");
      overlay.className = "runtime-modal";
      overlay.innerHTML = `
        <section class="runtime-dialog" role="dialog" aria-modal="true" aria-label="${escapeAttribute(preview.title || "Runtime Preview")}">
          <div class="runtime-dialog-header">
            <div>
              <p class="eyebrow">Runtime Preview</p>
              <h2>${escapeHtml(preview.title || view.title || "Preview")}</h2>
            </div>
            <button type="button" data-close-preview aria-label="Schliessen">Schliessen</button>
          </div>
          <div class="runtime-frame-list">
            ${frames.map((frame, index) => `<div class="runtime-frame"><span>${index + 1}</span>${escapeHtml(frame)}</div>`).join("")}
          </div>
        </section>
      `;
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.dataset.closePreview !== undefined) overlay.remove();
      });
      document.body.append(overlay);
    }

    function renderGuidedPlantUml(root) {
      root.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
    }

    async function renderPlantUmlImage(image, source) {
      const status = image.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
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
      const bytes = new TextEncoder().encode(source);
      const compressed = await deflateForPlantUml(bytes);
      return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
    }

    async function deflateForPlantUml(bytes) {
      if (typeof CompressionStream === "undefined") throw new Error("CompressionStream unavailable");
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
      const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
      return compressed.slice(2, -4);
    }

    function encodePlantUmlBytes(bytes) {
      let output = "";
      for (let index = 0; index < bytes.length; index += 3) {
        output += appendPlantUml3Bytes(bytes[index], bytes[index + 1] ?? 0, bytes[index + 2] ?? 0);
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

    return {
      focusIdeStepSource,
      guidedViews,
      renderProjectViewManifest,
    };
  }

  return { create };
})();
