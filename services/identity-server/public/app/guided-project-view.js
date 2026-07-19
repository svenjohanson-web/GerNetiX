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

    function renderProjectViewManifest(project, targetSelector = "#ideProjectViewManifest") {
      const target = document.querySelector(targetSelector);
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
      target.innerHTML = `
        <div class="manifest-head">
          <p class="eyebrow">Projektansicht</p>
          <h3>${escapeHtml(manifest.title || "IDE Ansicht")}</h3>
          <p>${escapeHtml(manifest.summary || "")}</p>
        </div>
        <div class="guided-runner">
          <section class="guided-step-panel">
            <p class="eyebrow">Aktueller Lerninhalt</p>
            <div class="guided-artifact-layout">
              <section class="guided-artifact-pane">
                ${renderGuidedArtifact(project, activeView)}
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
      target.querySelector("[data-guided-back]")?.addEventListener("click", () => setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1), targetSelector));
      target.querySelector("[data-guided-next]")?.addEventListener("click", () => completeIdeGuidedStep(project, targetSelector));
      target.querySelector("[data-guided-preview]")?.addEventListener("click", () => openGuidedRuntimePreview(activeView));
      target.querySelectorAll("[data-guided-control]").forEach((button) => {
        button.addEventListener("click", () => handleGuidedControl(project, activeView, button.dataset.guidedControl, targetSelector));
      });
      target.querySelectorAll("[data-guided-lab-action]").forEach((button) => {
        button.addEventListener("click", () => handleGuidedLabAction(project, activeView, button.dataset.guidedLabAction, targetSelector));
      });
      target.querySelector("[data-guided-webserver-config]")?.addEventListener("submit", (event) => {
        saveGuidedWebserverConfiguration(event, project, activeView, targetSelector);
      });
      target.querySelector("[data-guided-lab-device]")?.addEventListener("change", (event) => assignGuidedLabDevice(project, activeView, event.target.value, targetSelector));
      bindCodeExplorerChat(target, project, activeView);
      renderGuidedPlantUml(target);
    }

    function renderProjectAssistant(project) {
      const target = document.querySelector("#ideCodeAssistant");
      if (!target || !project) return;
      const configuredView = guidedViews(project)[state.activeIdeStep];
      const view = isCodeExplorerView(configuredView) ? configuredView : {
        id: `source:${state.sourcePath || "project"}`,
        type: "source_analysis",
        title: state.sourcePath || "Projektdatei",
        summary: "KI-Unterstuetzung fuer die aktuell geoeffnete Datei und die Artefakte dieses Projekts.",
        source_path: state.sourcePath,
        payload: { artifact: { type: "code", content: document.querySelector("#sourceEditor")?.value || "" } },
      };
      target.innerHTML = renderCodeExplorerChat(project, view);
      bindCodeExplorerChat(target, project, view);
      scrollCodeExplorerChatToEnd(target);
      if (typeof restoreIdeChatInputHeight === "function") restoreIdeChatInputHeight();
    }

    function bindCodeExplorerChat(target, project, view) {
      target.querySelector("[data-code-explorer-chat]")?.addEventListener("submit", (event) => submitCodeExplorerChat(event, project, view));
      target.querySelectorAll("[data-apply-code-edit]").forEach((button) => {
        button.addEventListener("click", () => applyCodeExplorerEdit(project, view, button.dataset.editMessage, Number(button.dataset.applyCodeEdit)));
      });
      target.querySelectorAll("[data-show-code-edit]").forEach((button) => {
        button.addEventListener("click", () => showCodeExplorerEdit(project, view, button.dataset.editMessage, Number(button.dataset.showCodeEdit)));
      });
    }

    function scrollCodeExplorerChatToEnd(target) {
      const history = target.querySelector(".code-explorer-chat-messages");
      if (history) history.scrollTop = history.scrollHeight;
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
      const waiting = messages.some((message) => message.pending);
      const hasPremiumAi = Boolean(state.billing?.entitlements?.includes("ai_assistant"));
      return `
        <section class="code-explorer-chat">
          <div class="code-explorer-chat-head">
            <p class="eyebrow">KI-Chat</p>
            <strong>Code gemeinsam verstehen</strong>
            ${renderCodeExplorerUsage()}
          </div>
          <p class="code-explorer-chat-section-label">Verlauf</p>
          <div class="code-explorer-chat-messages" aria-live="polite">
            ${messages.length ? messages.map((message) => `
              <article class="code-explorer-chat-message ${message.role}">
                <span>${message.role === "assistant" ? "KI" : "Du"}</span>
                ${message.pending
                  ? `<p class="code-explorer-chat-waiting" aria-label="${escapeHtml(message.status || "KI antwortet")}"><span>${escapeHtml(message.status || "KI verarbeitet die Anfrage")}</span><i></i><i></i><i></i></p>`
                  : `<p>${escapeHtml(message.content)}</p>`}
                ${message.role === "assistant" && !message.pending ? renderCodeExplorerResponseMeta(message.responseMeta) : ""}
                ${message.fileEdits?.length ? `<div class="code-explorer-edits">
                  ${message.fileEdits.map((edit, editIndex) => `<div class="code-explorer-edit-actions"><button type="button" data-edit-message="${messages.indexOf(message)}" data-show-code-edit="${editIndex}">Änderung anzeigen</button><button type="button" data-edit-message="${messages.indexOf(message)}" data-apply-code-edit="${editIndex}" ${edit.applied ? "disabled" : ""}>${edit.applied ? "Übernommen" : "Übernehmen"}</button><span>${escapeHtml(edit.path)}</span></div>`).join("")}
                  <section class="code-explorer-change-summary" aria-label="Zusammenfassung der Dateiänderungen">
                    <strong>Zusammenfassung</strong>
                    <ul>${message.fileEdits.map((edit) => `<li><code>${escapeHtml(edit.path)}</code><span>Zeile ${edit.lineStart || 1}${edit.lineEnd && edit.lineEnd !== edit.lineStart ? `–${edit.lineEnd}` : ""}: ${escapeHtml(edit.changeSummary || "Inhalt geaendert")}${edit.applied ? " · übernommen" : " · geplant"}</span></li>`).join("")}</ul>
                  </section>
                </div>` : ""}
              </article>
            `).join("") : `<p class="helper-text">Frage die KI zum sichtbaren Code, zu einzelnen Zeilen oder zum Verhalten.</p>`}
          </div>
          <form data-code-explorer-chat>
            <p class="code-explorer-chat-section-label">Eingabe</p>
            <label class="code-explorer-chat-input"><span>Frage zum Code</span>
              <span class="code-explorer-chat-input-box">
                <textarea rows="3" name="message" placeholder="${hasPremiumAi ? "Was passiert in dieser Funktion?" : "KI-Unterstuetzung ist mit Premium verfuegbar."}" ${hasPremiumAi ? "" : "disabled"}></textarea>
                <button class="code-explorer-send-button" type="submit" aria-label="Frage senden" title="Frage senden" ${waiting || !hasPremiumAi ? "disabled" : ""}>&uarr;</button>
              </span>
            </label>
            ${hasPremiumAi ? "" : '<p class="chat-premium-hint">KI-Unterstuetzung ist im Premium-Abo enthalten. <a href="/hilfe/#ai-premium">Warum?</a></p>'}
          </form>
        </section>
      `;
    }

    async function submitCodeExplorerChat(event, project, view) {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.elements.message;
      if (!state.billing?.entitlements?.includes("ai_assistant")) return;
      const content = String(input.value || "").trim();
      if (!content) return;
      const messages = codeChatMessages(project, view);
      if (messages.some((message) => message.pending)) return;
      messages.push({ role: "user", content });
      const pendingMessage = { role: "assistant", content: "", pending: true, status: "Projektkontext wird vorbereitet" };
      messages.push(pendingMessage);
      input.value = "";
      renderProjectAssistant(project);
      const delayedStatus = setTimeout(() => {
        if (!pendingMessage.pending) return;
        pendingMessage.status = "Die KI arbeitet noch – die Antwort dauert ungewöhnlich lange";
        renderProjectAssistant(project);
      }, 8000);
      try {
        const targetPath = view.source_path || state.sourcePath || "Projektquelle";
        pendingMessage.status = "KI durchsucht das Projekt nach relevanten Dateien";
        renderProjectAssistant(project);
        const response = await postJson("/api/platform/development-assistant/chat", {
          projectId: project.id,
          assistantMode: "code_explorer",
          previousResponseId: messages.providerResponseId || "",
          messages: messages.filter((message) => !message.pending).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          codeContext: {
            path: targetPath,
            content: "",
            editTargetPath: "",
            focusLines: view.source_lines || view.editable_lines || [],
            questions: view.payload?.questions || [],
            files: [],
            artifacts: [],
          },
        });
        recordCodeExplorerUsage(response);
        if (response.providerResponseId) messages.providerResponseId = response.providerResponseId;
        Object.assign(pendingMessage, {
          content: response.message?.content || "Keine Antwort erhalten.",
          fileEdits: response.fileEdits || [],
          responseMeta: codeExplorerResponseMeta(response),
          pending: false,
        });
      } catch (error) {
        Object.assign(pendingMessage, {
          content: `Der Code-Assistent ist gerade nicht erreichbar: ${error.message}`,
          responseMeta: { responder: "System / Fehler" },
          pending: false,
        });
      } finally {
        clearTimeout(delayedStatus);
      }
      renderProjectViewManifest(project);
      renderProjectAssistant(project);
    }

    function renderCodeExplorerUsage() {
      const rating = state.aiUsage?.rating || {};
      const sources = Array.isArray(rating.sources) ? rating.sources : [];
      if (!sources.length) return `<div class="code-explorer-usage unavailable">Tokenverbrauch nicht verfügbar</div>`;
      const limited = sources.filter((source) => !source.unlimited && Number(source.token_limit) > 0)
        .sort((left, right) => Number(right.used_percent || 0) - Number(left.used_percent || 0));
      const source = limited[0] || sources[0];
      const usedPercent = Math.max(0, Math.min(100, Number(source.used_percent || 0)));
      const title = source.title || source.source_id || "KI";
      const value = source.unlimited ? "unbegrenzt" : `${usedPercent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % verbraucht`;
      const detail = source.unlimited
        ? `${Number(source.month_tokens || 0).toLocaleString("de-DE")} Tokens diesen Monat`
        : `${Number(source.month_tokens || 0).toLocaleString("de-DE")} / ${Number(source.token_limit || 0).toLocaleString("de-DE")} Tokens`;
      return `<div class="code-explorer-usage" title="${escapeAttribute(`${title}: ${detail}`)}">
        <span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(detail)}</small>
        ${source.unlimited ? "" : `<i class="code-explorer-usage-bar"><b style="width:${usedPercent}%"></b></i>`}
      </div>`;
    }

    function recordCodeExplorerUsage(response = {}) {
      const totalTokens = Number(response.usage?.totalTokens);
      const sources = state.aiUsage?.rating?.sources;
      if (!Number.isFinite(totalTokens) || totalTokens <= 0 || !Array.isArray(sources)) return;
      const sourceId = response.routing?.local === false ? "openai_gpt" : "local_llm";
      const source = sources.find((item) => item.source_id === sourceId);
      if (!source) return;
      source.month_tokens = Number(source.month_tokens || 0) + totalTokens;
      source.used_percent = Number(source.token_limit) > 0
        ? Number(Math.min(100, (source.month_tokens / Number(source.token_limit)) * 100).toFixed(2))
        : 0;
      const limited = sources.filter((item) => !item.unlimited && Number(item.token_limit) > 0);
      state.aiUsage.rating.used_percent = limited.length ? Math.max(...limited.map((item) => Number(item.used_percent || 0))) : 0;
    }

    function codeExplorerResponseMeta(response = {}) {
      const routing = response.routing || {};
      const usage = response.usage || {};
      const usageSteps = Array.isArray(response.usageBreakdown?.steps) ? response.usageBreakdown.steps : [];
      const firstStep = usageSteps[0] || {};
      const toolSteps = usageSteps.slice(1);
      return {
        responder: routing.label || routing.provider || "KI",
        model: routing.model || "",
        promptTokens: Number.isFinite(usage.promptTokens) ? usage.promptTokens : null,
        completionTokens: Number.isFinite(usage.completionTokens) ? usage.completionTokens : null,
        totalTokens: Number.isFinite(usage.totalTokens) ? usage.totalTokens : null,
        durationMs: Number.isFinite(usage.totalDurationMs) ? usage.totalDurationMs : null,
        baseInputTokens: Number.isFinite(firstStep.inputTokens) ? firstStep.inputTokens : null,
        toolInputTokens: toolSteps.length ? toolSteps.reduce((sum, step) => sum + Number(step.inputTokens || 0), 0) : 0,
        cachedInputTokens: usageSteps.reduce((sum, step) => sum + Number(step.cachedTokens || 0), 0),
      };
    }

    function renderCodeExplorerResponseMeta(meta = {}) {
      const items = [
        meta.responder || "KI",
        meta.model,
        meta.promptTokens !== null && meta.promptTokens !== undefined ? `Eingabe ${meta.promptTokens} Token` : "",
        meta.completionTokens !== null && meta.completionTokens !== undefined ? `Antwort ${meta.completionTokens} Token` : "",
        meta.totalTokens !== null && meta.totalTokens !== undefined ? `Gesamt ${meta.totalTokens} Token` : "",
        meta.baseInputTokens !== null && meta.baseInputTokens !== undefined ? `Grundkontext ${meta.baseInputTokens}` : "",
        meta.toolInputTokens ? `Werkzeugschritte ${meta.toolInputTokens}` : "",
        meta.cachedInputTokens ? `davon gecacht ${meta.cachedInputTokens}` : "",
        meta.durationMs !== null && meta.durationMs !== undefined ? `${meta.durationMs >= 1000 ? `${(meta.durationMs / 1000).toFixed(1)} s` : `${Math.round(meta.durationMs)} ms`}` : "",
      ].filter(Boolean);
      return `<div class="code-explorer-response-meta" aria-label="Details zur KI-Antwort">${items.map((item) => `<span>${escapeHtml(String(item))}</span>`).join("")}</div>`;
    }

    async function applyCodeExplorerEdit(project, view, messageIndex, editIndex) {
      const message = codeChatMessages(project, view)[Number(messageIndex)];
      const edit = message?.fileEdits?.[editIndex];
      if (!edit || edit.applied) return;
      const role = /(^|\/)(treiber|drivers?)(\/|$)/i.test(String(edit.path || "")) ? "ai_generated_driver" : "user_code";
      await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(edit.path)}`, { content: edit.content, role });
      edit.applied = true;
      const cachedSources = state.projectSourcesByProjectId[project.id] || [];
      const cachedSource = cachedSources.find((source) => source.path === edit.path);
      if (cachedSource) cachedSource.role = role;
      else cachedSources.push({ path: edit.path, role });
      state.projectSourcesByProjectId[project.id] = cachedSources.sort((left, right) => left.path.localeCompare(right.path));
      updateGuidedSourceContent(project, edit.path, edit.content);
      if (state.sourcePath === edit.path) {
        document.querySelector("#sourceEditor").value = edit.content;
        if (typeof renderIdeViewMode === "function") renderIdeViewMode(project);
      }
      renderProjectViewManifest(project);
      renderProjectAssistant(project);
      if (state.ideViewMode === "driver-management" && typeof renderDriverManagement === "function") renderDriverManagement(project);
    }

    function updateGuidedSourceContent(project, sourcePath, content) {
      guidedViews(project).forEach((guidedView) => {
        if (guidedView.source_path !== sourcePath) return;
        guidedView.payload ||= {};
        if (guidedView.type === "plantuml" || /\.(?:puml|plantuml)$/i.test(sourcePath)) guidedView.payload.source = content;
        if (guidedView.payload.artifact) {
          guidedView.payload.artifact.content = content;
          if (guidedView.payload.artifact.type === "plantuml") guidedView.payload.artifact.source = content;
        }
      });
    }

    async function showCodeExplorerEdit(project, view, messageIndex, editIndex) {
      const message = codeChatMessages(project, view)[Number(messageIndex)];
      const edit = message?.fileEdits?.[editIndex];
      if (!edit) return;
      const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(edit.path)}`);
      const diff = buildCodeExplorerDiff(source.content || "", edit.content || "");
      const overlay = document.createElement("div");
      overlay.className = "runtime-modal code-diff-modal";
      overlay.innerHTML = `
        <section class="runtime-dialog code-diff-dialog" role="dialog" aria-modal="true" aria-label="Änderung in ${escapeAttribute(edit.path)}">
          <div class="runtime-dialog-header">
            <div><p class="eyebrow">Vorgeschlagene Änderung</p><strong>${escapeHtml(edit.path)}</strong></div>
            <button type="button" data-close-code-diff aria-label="Änderungsansicht schließen">Schließen</button>
          </div>
          <div class="code-diff-legend"><span class="removed">Entfernt</span><span class="added">Hinzugefügt</span></div>
          <div class="code-diff-content">${diff.map((line) => `<div class="code-diff-line ${line.kind}"><span>${line.oldNumber || ""}</span><span>${line.newNumber || ""}</span><code>${escapeHtml(line.text || " ")}</code></div>`).join("")}</div>
        </section>`;
      const close = () => overlay.remove();
      overlay.querySelector("[data-close-code-diff]").addEventListener("click", close);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
      document.body.append(overlay);
    }

    function buildCodeExplorerDiff(previousContent, nextContent) {
      const before = String(previousContent).replace(/\r\n/g, "\n").split("\n");
      const after = String(nextContent).replace(/\r\n/g, "\n").split("\n");
      let prefix = 0;
      while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
      let suffix = 0;
      while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
      const lines = [];
      before.slice(0, prefix).forEach((text, index) => lines.push({ kind: "context", text, oldNumber: index + 1, newNumber: index + 1 }));
      before.slice(prefix, before.length - suffix).forEach((text, index) => lines.push({ kind: "removed", text, oldNumber: prefix + index + 1, newNumber: "" }));
      after.slice(prefix, after.length - suffix).forEach((text, index) => lines.push({ kind: "added", text, oldNumber: "", newNumber: prefix + index + 1 }));
      before.slice(before.length - suffix).forEach((text, index) => lines.push({ kind: "context", text, oldNumber: before.length - suffix + index + 1, newNumber: after.length - suffix + index + 1 }));
      return lines;
    }

    function renderGuidedArtifact(project, view) {
      if (view.type === "access_gate") return renderEntitlementGate(view);
      const artifact = view.payload?.artifact || {};
      const artifactRenderers = {
        code: renderGuidedCodeArtifact,
        state_rows: renderGuidedStateRows,
        cycle: renderGuidedCycle,
        plantuml: () => renderGuidedPlantUmlArtifact(view),
        svg_note: renderGuidedSvgNote,
        inventory_board_selection: () => renderInventoryBoardSelection(project),
        button_input_lab: () => renderButtonInputLab(project, projectLabState(view)),
        project_webserver_lab: () => renderProjectWebserverLab(project, projectLabState(view)),
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

    function renderEntitlementGate(view) {
      const payload = view.payload || {};
      const required = Array.isArray(view.required_entitlements) ? view.required_entitlements : [];
      const granted = new Set(state.billing?.entitlements || []);
      const available = required.every((entitlement) => granted.has(entitlement));
      return `
        <section class="guided-entitlement-gate ${available ? "available" : "locked"}">
          <p class="eyebrow">${available ? "Ressource verfuegbar" : "Ressourcenfreigabe"}</p>
          <h3>${escapeHtml(payload.offer_title || view.title || "Projektressource")}</h3>
          <p>${escapeHtml(payload.offer_text || view.summary || "Diese Erweiterung braucht eine gesonderte Freischaltung.")}</p>
          ${payload.included?.length ? `<ul>${payload.included.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
          <p class="helper-text">${available ? "Die Entitlement-Pruefung ist positiv. Die konkrete Worker-Konfiguration wird in einem folgenden Lernschritt ergaenzt." : `Benötigt: ${escapeHtml(required.join(", ") || "eine passende Projektressource")}. Lokale Home-Node- und Home-Assistant-Funktionen bleiben ohne diese Ressource nutzbar.`}</p>
        </section>
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

    function projectLabState(view) {
      state.guidedLabs ||= {};
      const key = view.id || "lab";
      if (!state.guidedLabs[key]) state.guidedLabs[key] = { built: false, flashed: false, transport: "", streamStatus: "noch nicht verbunden", lines: [] };
      return state.guidedLabs[key];
    }

    function renderInventoryBoardSelection(project) {
      const selectedDeviceId = project.linkedDeviceId || "";
      const selectedDevice = state.devices.find((device) => device.device_id === selectedDeviceId) || null;
      const otaReadyDevices = state.devices.filter((device) => device.ota_status === "ready");
      return `
        <section class="guided-board-introduction">
          <header class="guided-artifact-head">
            <p class="eyebrow">Praxisnahes Lernprojekt</p>
            <h3>Dein ESP-Board ist die zentrale Komponente</h3>
            <p>In den folgenden Schritten arbeitet dein ESP-Board mit der GerNetiX-Infrastruktur zusammen. Deshalb muss es bereits in deinem Inventar angelegt und OTA-faehig sein.</p>
          </header>
          <section class="guided-device-selection guided-first-step-selection">
            <p class="guided-lab-step">Schritt 1: ESP-Board auswählen</p>
            <label for="guidedLabDevice">Bitte wähle jetzt dein ESP-Board aus, mit dem du arbeiten möchtest.</label>
            <select id="guidedLabDevice" data-guided-lab-device>
              <option value="">OTA-fähiges ESP-Board auswählen</option>
              ${otaReadyDevices.map((device) => `<option value="${escapeAttribute(device.device_id)}" ${device.device_id === selectedDeviceId ? "selected" : ""}>${escapeHtml(device.display_name || device.device_id)} · OTA bereit</option>`).join("")}
            </select>
            <p>${selectedDevice ? `Ausgewählt: <strong>${escapeHtml(selectedDevice.display_name || selectedDevice.device_id)}</strong>. Dieses Board wird für die Taster-Firmware und die weiteren Schritte verwendet.` : otaReadyDevices.length ? "Wähle eines deiner OTA-fähigen Inventar-Boards. Die Minimal-Basissoftware genügt für dieses Lernprojekt nicht." : "Noch kein OTA-fähiges ESP-Board im Inventar. Provisioniere ein Board mit der FULL-Basissoftware und aktiviere OTA, bevor du fortfährst."}</p>
          </section>
          <aside class="guided-ota-requirement">
            <strong>Warum OTA-fähig?</strong>
            <p>Spätere Schritte bauen Firmware und verbinden das Board mit Projekt-Ressourcen. Dafür benötigen wir eine Netzwerkverbindung über die FULL-Basissoftware; eine Minimal-Konfiguration ist hier bewusst nicht auswählbar.</p>
          </aside>
        </section>
      `;
    }

    function renderButtonInputLab(project, lab) {
      const serialLines = lab.lines.length ? lab.lines : ["Warte auf Firmware-Flash."];
      const selectedDeviceId = project.linkedDeviceId || "";
      const selectedDevice = state.devices.find((device) => device.device_id === selectedDeviceId) || null;
      const ready = lab.flashed && Boolean(selectedDevice);
      return `
        <section class="guided-device-lab">
          <header class="guided-artifact-head">
            <p class="eyebrow">Praxislabor</p>
            <h3>Taster am ESP32 einlesen</h3>
            <p>Du wählst zuerst das ESP-Board, mit dem du arbeiten möchtest. Danach bauen und flashen wir die Taster-Firmware für genau dieses Board.</p>
          </header>
          <div class="guided-device-lab-body">
            <section class="guided-device-selection">
              <p class="guided-lab-step">1. Board auswählen</p>
              <label for="guidedLabDevice">Bitte wähle dein ESP-Board aus deinem Inventar. Mit welchem möchtest du arbeiten?</label>
              <select id="guidedLabDevice" data-guided-lab-device>
                <option value="">ESP-Board auswählen</option>
                ${state.devices.map((device) => `<option value="${escapeAttribute(device.device_id)}" ${device.device_id === selectedDeviceId ? "selected" : ""}>${escapeHtml(device.display_name || device.device_id)}${device.ota_status === "ready" ? " · OTA bereit" : ""}</option>`).join("")}
              </select>
              <p>${selectedDevice ? `Dieses Lernprojekt ist mit <strong>${escapeHtml(selectedDevice.display_name || selectedDevice.device_id)}</strong> verbunden. Der MQTT-Broker akzeptiert nur das Zertifikat und die Device-Topics dieses Boards.` : "Waehle ein provisioniertes Board. Erst dessen technische Device-ID und Zertifikat machen die MQTT-Verbindung eindeutig."}</p>
            </section>
            <section class="guided-firmware-card">
              <strong>2. Taster-Firmware bauen (Simulation)</strong>
              <pre><code>pinMode(BUTTON_PIN, INPUT_PULLUP);
if (digitalRead(BUTTON_PIN) == LOW) {
  publishEvent("taste_gedrueckt");
  Serial.println("taste_gedrueckt");
}</code></pre>
              <div class="guided-lab-actions">
                <button type="button" data-guided-lab-action="build" ${selectedDevice ? "" : "disabled"}>Firmware bauen</button>
                <button type="button" data-guided-lab-action="flash_usb" ${lab.built ? "" : "disabled"}>Per USB flashen</button>
                <button type="button" data-guided-lab-action="flash_ota" ${lab.built ? "" : "disabled"}>Per OTA flashen</button>
              </div>
              <p class="helper-text">Build und Flash sind in diesem Lernschritt simuliert. Die echten Build- und Flashdienste werden anschliessend angeschlossen.</p>
            </section>
            <section class="guided-serial-monitor" aria-live="polite">
              <div><strong>Serial Monitor</strong><span>${ready ? `${escapeHtml(lab.streamStatus)} · ${escapeHtml(lab.transport)}` : "noch nicht verbunden"}</span></div>
              <pre>${serialLines.map((line) => escapeHtml(line)).join("\n")}</pre>
              <button type="button" data-guided-lab-action="press_button" ${ready ? "" : "disabled"}>Tastendruck ausloesen</button>
            </section>
          </div>
          <aside class="guided-ota-explanation">
            <strong>Was bei OTA anders ist</strong>
            <p>Beim OTA-Weg ist das ESP32 bereits ueber seine GerNetiX-Basissoftware mit dem Backend verbunden. Das Backend liefert die Firmware an das Board und leitet dessen Laufzeitmeldung an deinen PC bzw. Browser weiter. Es ist keine direkte elektrische USB-Seriellverbindung.</p>
          </aside>
        </section>
      `;
    }

    function suggestedGuidedDeviceWebUrl(device) {
      const address = [device?.local_address, device?.ip_address, device?.hostname, device?.node_name]
        .map((value) => String(value || "").trim())
        .find(Boolean);
      if (!address) return "";
      return /^https?:\/\//i.test(address) ? address : `http://${address.replace(/\/$/, "")}/`;
    }

    function renderProjectWebserverLab(project, lab) {
      const selectedDevice = state.devices.find((device) => device.device_id === (project.linkedDeviceId || "")) || null;
      const deviceUrl = lab.webUrl || suggestedGuidedDeviceWebUrl(selectedDevice);
      const lines = lab.lines.length ? lab.lines : ["Konfiguriere zuerst die lokale Anzeige."];
      return `
        <section class="guided-device-lab">
          <header class="guided-artifact-head">
            <p class="eyebrow">Lokale Projekt-Webseite</p>
            <h3>Messwert am Board sichtbar machen</h3>
            <p>Diese Ansicht läuft direkt auf deinem ESP32 im lokalen WLAN. Sie ist noch keine PWA und sendet keine Werte an GerNetiX.</p>
          </header>
          <div class="guided-device-lab-body">
            <form class="guided-firmware-card" data-guided-webserver-config>
              <strong>1. Anzeige konfigurieren</strong>
              <label>Titel der Seite<input name="web_title" value="${escapeAttribute(lab.webTitle || "Tastendruck-Monitor")}"></label>
              <label>Lokale Board-Adresse<input name="web_url" value="${escapeAttribute(deviceUrl)}" placeholder="http://192.168.x.x/"></label>
              <p class="helper-text">Die Adresse bleibt nur in diesem Browser-Lernschritt. Das Board muss im selben WLAN erreichbar sein.</p>
              <button type="submit" ${selectedDevice ? "" : "disabled"}>Anzeige speichern</button>
            </form>
            <section class="guided-firmware-card">
              <strong>2. Projekt-Firmware bauen und flashen</strong>
              <p>Die Firmware enthält die lokale Projekt-Webseite mit aktuellem Zustand und Projekt-Log.</p>
              <div class="guided-lab-actions">
                <button type="button" data-guided-lab-action="build_webserver" ${lab.configured ? "" : "disabled"}>Firmware bauen</button>
                <button type="button" data-guided-lab-action="flash_webserver_usb" ${lab.built ? "" : "disabled"}>Per USB flashen</button>
                <button type="button" data-guided-lab-action="flash_webserver_ota" ${lab.built ? "" : "disabled"}>Per OTA flashen</button>
              </div>
              <p class="helper-text">Build und Flash sind in diesem Lernschritt simuliert. Der Ablauf zeigt bereits dieselben Schritte wie der spätere echte Build-Service.</p>
            </section>
            <section class="guided-serial-monitor" aria-live="polite">
              <div><strong>Projekt-Log</strong><span>${lab.flashed ? "Firmware geflasht" : "noch nicht geflasht"}</span></div>
              <pre>${lines.map((line) => escapeHtml(line)).join("\n")}</pre>
              <button type="button" data-guided-lab-action="open_webserver" ${lab.flashed && deviceUrl ? "" : "disabled"}>Webserver öffnen</button>
            </section>
          </div>
          <aside class="guided-ota-explanation"><strong>Lokaler Zugriff</strong><p>Die Board-Seite ist nur im lokalen Netzwerk erreichbar. Erst der nächste Lernschritt erweitert die Ereigniskette um Backend und optionale PWA-Push-Benachrichtigungen.</p></aside>
        </section>
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
        access_gate: "Ressourcenfreigabe",
        device_lab: "Praxislabor",
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
      if (view.type === "device_lab") {
        return `<p class="helper-text">Baue zuerst die Beispiel-Firmware, waehle USB oder OTA und pruefe danach die Ereignismeldung im Serial Monitor.</p>`;
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
      if (view.type === "access_gate") {
        const required = Array.isArray(view.required_entitlements) ? view.required_entitlements : [];
        return `<dl class="meta-list compact">${meta("Benötigte Ressource", required.join(", ") || "noch festzulegen")}</dl>`;
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

      if (view?.type === "access_gate") {
        const required = Array.isArray(view.required_entitlements) ? view.required_entitlements : [];
        const granted = new Set(state.billing?.entitlements || []);
        const missing = required.filter((entitlement) => !granted.has(entitlement));
        return {
          canContinue: missing.length === 0,
          message: missing.length ? `Dieser Abschnitt braucht die Projektressource: ${missing.join(", ")}.` : "",
          focus,
        };
      }

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

    function handleGuidedControl(project, view, fn, targetSelector) {
      if (fn === "previous_step") return setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1), targetSelector);
      if (fn === "next_step") return completeIdeGuidedStep(project, targetSelector);
      if (fn === "runtime_preview") return openGuidedRuntimePreview(view);
      if (fn === "open_billing") return window.navigate("/app/billing/");
      return undefined;
    }

    function handleGuidedLabAction(project, view, action, targetSelector) {
      const lab = projectLabState(view);
      if (action === "build") {
        lab.built = true;
        lab.lines = ["[Build] Starte ESP32-Firmware-Build (Simulation) ...", "[Build] Erfolgreich: firmware.bin bereit."];
      }
      if (action === "flash_usb" || action === "flash_ota") {
        const ota = action === "flash_ota";
        lab.flashed = true;
        lab.transport = ota ? "OTA ueber GerNetiX Backend" : "USB-Seriell";
        lab.streamStatus = "Runtime-Stream wird verbunden";
        lab.lines = ota
          ? ["[OTA] Board meldet sich beim GerNetiX Backend.", "[OTA] firmware.bin wird an das Board uebertragen.", "[OTA] Flash erfolgreich. Laufzeitmeldungen werden an den Browser weitergeleitet.", "[Serial] Bereit. Druecke den Taster am Board."]
          : ["[USB] ESP32 verbunden.", "[USB] firmware.bin wird geschrieben.", "[USB] Flash erfolgreich.", "[Serial] Bereit. Druecke den Taster am Board."];
      }
      if (action === "press_button" && lab.flashed) {
        lab.lines.push("[Serial] taste_gedrueckt", "[Event] Ereignis fuer das Projekt erzeugt.");
      }
      if (action === "build_webserver" && lab.configured) {
        lab.built = true;
        lab.lines = ["[Build] Projekt-Webseite wird in die ESP32-Firmware eingebunden.", "[Build] Erfolgreich: firmware.bin bereit."];
      }
      if (action === "flash_webserver_usb" || action === "flash_webserver_ota") {
        const ota = action === "flash_webserver_ota";
        lab.flashed = true;
        lab.lines = ota
          ? ["[OTA] Projekt-Firmware wird übertragen.", "[OTA] Flash erfolgreich. Board startet neu.", "[Web] Lokaler Projekt-Webserver ist bereit."]
          : ["[USB] Projekt-Firmware wird geschrieben.", "[USB] Flash erfolgreich. Board startet neu.", "[Web] Lokaler Projekt-Webserver ist bereit."];
      }
      if (action === "open_webserver" && lab.flashed && lab.webUrl) {
        return openGuidedWebserverPopup(lab.webUrl, lab.webTitle || "Lokale Board-Webseite");
      }
      if ((action === "flash_usb" || action === "flash_ota") && lab.flashed) startGuidedRuntimeStream(project, view, targetSelector);
      renderProjectViewManifest(project, targetSelector);
    }

    function saveGuidedWebserverConfiguration(event, project, view, targetSelector) {
      event.preventDefault();
      const lab = projectLabState(view);
      const data = new FormData(event.currentTarget);
      lab.webTitle = String(data.get("web_title") || "").trim() || "Lokale Board-Webseite";
      lab.webUrl = String(data.get("web_url") || "").trim();
      lab.configured = true;
      lab.lines = [`[Konfiguration] Titel: ${lab.webTitle}`, lab.webUrl ? `[Konfiguration] Board-Adresse: ${lab.webUrl}` : "[Konfiguration] Board-Adresse wird später eingetragen."];
      renderProjectViewManifest(project, targetSelector);
    }

    function openGuidedWebserverPopup(url, title) {
      const overlay = document.createElement("div");
      overlay.className = "runtime-modal";
      overlay.innerHTML = `<section class="runtime-dialog guided-webserver-dialog" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}"><div class="runtime-dialog-header"><div><p class="eyebrow">Lokaler ESP32-Webserver</p><strong>${escapeHtml(title)}</strong></div><button type="button" data-close-guided-webserver>Schließen</button></div><p><a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">Im eigenen Tab öffnen</a></p><iframe title="${escapeAttribute(title)}" src="${escapeAttribute(url)}"></iframe></section>`;
      overlay.querySelector("[data-close-guided-webserver]").addEventListener("click", () => overlay.remove());
      overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
      document.body.append(overlay);
    }

    async function assignGuidedLabDevice(project, view, deviceId, targetSelector) {
      if (!deviceId) return;
      const lab = projectLabState(view);
      lab.lines = ["[Inventar] Board wird dem Lernprojekt zugeordnet ..."];
      renderProjectViewManifest(project, targetSelector);
      try {
        const response = await postJson(`/api/platform/learning-projects/${encodeURIComponent(project.id)}/device`, { device_id: deviceId });
        Object.assign(project, response.project);
        state.projects = state.projects.map((item) => item.id === project.id ? response.project : item);
        lab.lines = [`[Inventar] ${response.device?.display_name || deviceId} ist diesem Lernprojekt zugeordnet.`, "[MQTT] Board-ID und Projektzuordnung werden vor jeder Runtime-Meldung serverseitig geprueft."];
      } catch (error) {
        lab.lines = [`[Inventar] Zuordnung fehlgeschlagen: ${error.message}`];
      }
      renderProjectViewManifest(project, targetSelector);
    }

    function startGuidedRuntimeStream(project, view, targetSelector) {
      if (typeof EventSource === "undefined") return;
      state.guidedRuntimeStreams ||= {};
      const key = `${project.id}:${view.id || "lab"}`;
      if (state.guidedRuntimeStreams[key]) return;
      const lab = projectLabState(view);
      const stream = new EventSource(`/api/platform/projects/${encodeURIComponent(project.id)}/runtime-stream`);
      state.guidedRuntimeStreams[key] = stream;
      stream.addEventListener("ready", () => {
        lab.streamStatus = "live verbunden";
        renderProjectViewManifest(project, targetSelector);
      });
      stream.addEventListener("runtime", (event) => {
        try {
          const message = JSON.parse(event.data || "{}");
          lab.lines.push(`[${message.channel || "serial"}] ${message.line || "Runtime-Meldung"}`);
          lab.lines = lab.lines.slice(-40);
          renderProjectViewManifest(project, targetSelector);
        } catch {
          lab.lines.push("[Runtime] Ungueltige Laufzeitmeldung empfangen.");
          renderProjectViewManifest(project, targetSelector);
        }
      });
      stream.onerror = () => { lab.streamStatus = "Verbindung wird erneut aufgebaut"; };
    }

    async function setIdeGuidedStep(project, index, targetSelector = "#ideProjectViewManifest") {
      state.activeIdeStep = Math.max(0, Math.min(index, guidedViews(project).length - 1));
      renderProjectViewManifest(project, targetSelector);
      focusIdeStepSource(project);
      try {
        await saveIdeGuidedProgress(project, state.activeIdeStep, progressFor(project.id).completedSteps);
      } catch (error) {
        console.warn("Lernfortschritt konnte nicht gespeichert werden.", error);
      }
    }

    async function completeIdeGuidedStep(project, targetSelector = "#ideProjectViewManifest") {
      const completed = new Set(progressFor(project.id).completedSteps);
      completed.add(state.activeIdeStep);
      const next = Math.min(state.activeIdeStep + 1, guidedViews(project).length - 1);
      state.activeIdeStep = next;
      renderProjectViewManifest(project, targetSelector);
      focusIdeStepSource(project);
      try {
        await saveIdeGuidedProgress(project, next, Array.from(completed));
      } catch (error) {
        console.warn("Lernfortschritt konnte nicht gespeichert werden.", error);
      }
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
      renderProjectAssistant,
      renderProjectViewManifest,
    };
  }

  return { create };
})();
