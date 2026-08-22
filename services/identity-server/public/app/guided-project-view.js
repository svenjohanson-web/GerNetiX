import { themedPlantUmlSource } from "@app/app-runtime-utils.js";
import { navigate } from "@app/platform-routing.js";

const GuidedProjectView = (() => {
  function create(deps) {
    const {
      state,
      getJson,
      postJson,
      putJson,
      waitForCompletedBuild,
      progressFor,
      escapeHtml,
      escapeAttribute,
      meta,
    } = deps;
    let guidedFlashDialog = null;

    function renderProjectViewManifest(project, targetSelector = "#ideProjectViewManifest") {
      const target = document.querySelector(targetSelector);
      if (!target) return;
      const views = guidedViews(project);
      if (!views.length) {
        target.innerHTML = `<p class="empty">Dieses Projekt hat noch keine gespeicherte IDE-Ansicht.</p>`;
        return;
      }
      state.activeIdeStep = Math.min(state.activeIdeStep || 0, views.length - 1);
      const activeView = views[state.activeIdeStep];
      const validation = validateGuidedView(project, activeView);
      target.innerHTML = `
        <div class="guided-runner ${activeView.payload?.artifact?.type === "uml_activity" ? "is-uml-step" : ""}">
          <section class="guided-artifact-pane">
            ${renderGuidedArtifact(project, activeView)}
          </section>
          <aside class="guided-summary-pane">
            ${renderLearningSoftwareTargetPanel(project)}
            <div class="guided-task-heading">
              <p class="eyebrow">Aufgabe</p>
              <h3>${escapeHtml(activeView.title || "Aktueller Lernschritt")}</h3>
            </div>
            ${renderLearningContext(activeView)}
            ${renderLearningGuidance(activeView, validation)}
            ${renderManifestPayload(activeView)}
            ${renderGuidedCompletion(project, activeView, validation)}
            ${renderRequiredFunctions(activeView)}
            ${validation?.focus ? `<pre class="source-focus-box">${escapeHtml(validation.focus)}</pre>` : ""}
            ${renderGuidedValidation(activeView, validation)}
            ${renderGuidedActions(project, activeView, validation)}
          </aside>
        </div>
        ${renderGuidedCodeAssistant(project, activeView)}
      `;
      bindGuidedSequence(target, project, activeView, targetSelector);
      bindGuidedEvaCalculator(target, project, activeView);
      bindGuidedCodeRunLab(target, project, activeView, targetSelector);
      bindRequirementsMirror(target, project, activeView, targetSelector);
      target.querySelector("[data-guided-back]")?.addEventListener("click", () => setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1), targetSelector));
      target.querySelector("[data-guided-next]")?.addEventListener("click", () => completeIdeGuidedStep(project, targetSelector));
      target.querySelector("[data-guided-preview]")?.addEventListener("click", () => openGuidedRuntimePreview(activeView));
      target.querySelectorAll("[data-guided-control]").forEach((button) => {
        button.addEventListener("click", () => handleGuidedControl(project, activeView, button.dataset.guidedControl, targetSelector));
      });
      target.querySelectorAll("[data-guided-choice]").forEach((input) => {
        input.addEventListener("change", () => {
          setGuidedLessonResponse(project, activeView, { choice: input.value });
          renderProjectViewManifest(project, targetSelector);
        });
      });
      target.querySelectorAll("[data-guided-adaptive-choice]").forEach((input) => {
        input.addEventListener("change", () => {
          setGuidedLessonResponse(project, activeView, {
            adaptiveMode: input.dataset.guidedAdaptiveMode,
            adaptiveChoice: input.value,
          });
          renderProjectViewManifest(project, targetSelector);
        });
      });
      target.querySelector("[data-guided-code-task]")?.addEventListener("input", (event) => {
        setGuidedLessonResponse(project, activeView, {
          code: event.target.value,
          lastRunCode: "",
          runCompleted: false,
          runPending: false,
          runOutput: "",
          runError: "",
        });
        const output = target.querySelector("[data-guided-code-output]");
        if (output) output.textContent = "Code geändert – erneut ausführen";
        target.querySelector(".guided-code-output")?.classList.remove("is-error");
        updateGuidedCompletionState(target, project, activeView);
      });
      target.querySelectorAll("[data-guided-lab-action]").forEach((button) => {
        button.addEventListener("click", () => handleGuidedLabAction(project, activeView, button.dataset.guidedLabAction, targetSelector));
      });
      target.querySelector("[data-guided-webserver-config]")?.addEventListener("submit", (event) => {
        saveGuidedWebserverConfiguration(event, project, activeView, targetSelector);
      });
      target.querySelector("[data-guided-lab-device]")?.addEventListener("change", (event) => assignGuidedLabDevice(project, activeView, event.target.value, targetSelector));
      target.querySelector("[data-guided-board-configuration]")?.addEventListener("change", (event) => assignGuidedBoardConfiguration(project, activeView, event.target.value, targetSelector));
      target.querySelector("[data-learning-software-unit]")?.addEventListener("change", (event) => selectLearningSoftwareUnit(project, event.target.value, targetSelector));
      target.querySelector("[data-learning-target-board]")?.addEventListener("change", (event) => assignGuidedBoardConfiguration(project, activeView, event.target.value, targetSelector));
      target.querySelector("[data-learning-target-device]")?.addEventListener("change", (event) => assignGuidedLabDevice(project, activeView, event.target.value, targetSelector));
      target.querySelector("[data-build-learning-software-unit]")?.addEventListener("click", () => buildGuidedSoftwareUnit(project, activeView, targetSelector));
      bindCodeExplorerChat(target, project, activeView);
      renderGuidedPlantUml(target);
    }

    function renderGuidedCodeAssistant(project, view) {
      if (!isCodeExplorerView(view)) return "";
      return `
        <details class="guided-code-assistant">
          <summary>
            <span>KI-Hilfe zum Code</span>
            <small>Bei Bedarf öffnen und eine konkrete Frage stellen</small>
          </summary>
          ${renderCodeExplorerChat(project, view)}
        </details>
      `;
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

    function isTouchscreenGameProject(project) {
      const manifest = project?.viewManifest || project?.view_manifest || {};
      return manifest.template_id === "touchscreen_game_collection"
        || manifest.templateId === "touchscreen_game_collection";
    }

    function renderCodeExplorerChat(project, view) {
      if (!isCodeExplorerView(view)) return "";
      const messages = codeChatMessages(project, view);
      const waiting = messages.some((message) => message.pending);
      const hasPremiumAi = Boolean(state.billing?.entitlements?.includes("ai_assistant"));
      const gameProject = isTouchscreenGameProject(project);
      return `
        <section class="code-explorer-chat ai-chat ai-chat--compact">
          <div class="code-explorer-chat-head">
            <p class="eyebrow">KI-Chat</p>
            <strong>${gameProject ? "Spielesammlung per KI erweitern" : "Code gemeinsam verstehen"}</strong>
            ${renderCodeExplorerUsage()}
          </div>
          <p class="code-explorer-chat-section-label">Verlauf</p>
          <div class="code-explorer-chat-messages ai-chat__messages" aria-live="polite">
            ${messages.length ? messages.map((message) => `
              <article class="code-explorer-chat-message ai-chat__message ${message.role} ${message.pending ? "is-pending" : ""} ${message.error ? "is-error" : ""}">
                <span>${message.role === "assistant" ? "KI" : "Du"}</span>
                ${message.pending
                  ? `<p class="code-explorer-chat-waiting ai-chat__status" aria-label="${escapeHtml(message.status || "KI antwortet")}"><span>${escapeHtml(message.status || "KI verarbeitet die Anfrage")}</span><i></i><i></i><i></i></p>`
                  : `<p>${escapeHtml(message.content)}</p>`}
                ${message.role === "assistant" && !message.pending ? renderCodeExplorerResponseMeta(message.responseMeta) : ""}
                ${message.fileEdits?.length ? `<div class="code-explorer-edits">
                  ${message.fileEdits.map((edit, editIndex) => `<div class="code-explorer-edit-actions"><button type="button" data-edit-message="${messages.indexOf(message)}" data-show-code-edit="${editIndex}">Änderung anzeigen</button><button type="button" data-edit-message="${messages.indexOf(message)}" data-apply-code-edit="${editIndex}" ${edit.applied ? "disabled" : ""}>${edit.applied ? "Übernommen" : "Übernehmen"}</button><span>${edit.isNewFile ? "Neue Datei · " : ""}${escapeHtml(edit.path)}</span></div>`).join("")}
                  <section class="code-explorer-change-summary" aria-label="Zusammenfassung der Dateiänderungen">
                    <strong>Zusammenfassung</strong>
                    <ul>${message.fileEdits.map((edit) => `<li><code>${escapeHtml(edit.path)}</code><span>${edit.isNewFile ? "Neue Datei, " : ""}Zeile ${edit.lineStart || 1}${edit.lineEnd && edit.lineEnd !== edit.lineStart ? `–${edit.lineEnd}` : ""}: ${escapeHtml(edit.changeSummary || "Inhalt geaendert")}${edit.applied ? " · übernommen" : " · geplant"}</span></li>`).join("")}</ul>
                  </section>
                  ${message.applyError ? `<p class="helper-text is-error">${escapeHtml(message.applyError)}</p>` : ""}
                </div>` : ""}
              </article>
            `).join("") : `<p class="helper-text">${gameProject ? "Beschreibe ein neues Spiel. Die KI liest Katalog und Auswahl, bereitet die neue Spieldatei vor und zeigt jede Änderung vor der Übernahme." : "Frage die KI zum sichtbaren Code, zu einzelnen Zeilen oder zum Verhalten."}</p>`}
          </div>
          <form class="ai-chat__composer" data-code-explorer-chat data-ai-chat-form>
            <p class="code-explorer-chat-section-label">Eingabe</p>
            <label class="code-explorer-chat-input"><span>Frage zum Code</span>
              <span class="code-explorer-chat-input-box ai-chat__input-box">
                <textarea class="ai-chat__input" data-ai-chat-input rows="3" name="message" placeholder="${hasPremiumAi ? (gameProject ? "Erstelle ein neues Spiel …" : "Was passiert in dieser Funktion?") : "KI-Unterstuetzung ist mit Premium verfuegbar."}" ${hasPremiumAi ? "" : "disabled"}></textarea>
                <button class="code-explorer-send-button ai-chat__send" data-ai-chat-send type="submit" aria-label="Frage senden" title="Frage senden" ${waiting || !hasPremiumAi ? "disabled" : ""}>&uarr;</button>
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
          codeProposal: response.codeProposal || null,
          responseMeta: codeExplorerResponseMeta(response),
          pending: false,
        });
      } catch (error) {
        if (requiresAiCreditPurchase(error)) requestAiCreditPurchase(error);
        Object.assign(pendingMessage, {
          content: requiresAiCreditPurchase(error)
            ? "Keine KI-Credits mehr verfügbar. Bitte Tokens kaufen, um den KI-Chat weiter zu verwenden."
            : `Der Code-Assistent ist gerade nicht erreichbar: ${error.message}`,
          responseMeta: { responder: "System / Fehler" },
          pending: false,
          error: true,
        });
      } finally {
        clearTimeout(delayedStatus);
      }
      renderProjectViewManifest(project);
      renderProjectAssistant(project);
    }

    function requiresAiCreditPurchase(error) {
      return error?.code === "ai_usage_rejected"
        && error?.payload?.usagePreflight?.rejection_reason === "insufficient_credits";
    }

    function requestAiCreditPurchase(error) {
      window.dispatchEvent(new CustomEvent("ai-credit-purchase-required", {
        detail: { usagePreflight: error.payload?.usagePreflight || {} },
      }));
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
      if (!message.codeProposal?.proposalId) {
        message.applyError = "Dieser Vorschlag besitzt keinen bestätigbaren Repository-Stand. Bitte die KI-Antwort neu erzeugen.";
        renderProjectAssistant(project);
        return;
      }
      try {
        await postJson("/api/platform/development-assistant/code-proposals/apply", {
          projectId: project.id,
          proposalId: message.codeProposal.proposalId,
          message: `KI-Vorschlag übernehmen: ${message.fileEdits.map((item) => item.path).join(", ")}`,
        });
        message.applyError = "";
        const cachedSources = state.projectSourcesByProjectId[project.id] || [];
        for (const appliedEdit of message.fileEdits) {
          const role = /(^|\/)(treiber|drivers?)(\/|$)/i.test(String(appliedEdit.path || "")) ? "ai_generated_driver" : "user_code";
          appliedEdit.applied = true;
          const cachedSource = cachedSources.find((source) => source.path === appliedEdit.path);
          if (cachedSource) cachedSource.role = role;
          else cachedSources.push({ path: appliedEdit.path, role });
          updateGuidedSourceContent(project, appliedEdit.path, appliedEdit.content);
          if (state.sourcePath === appliedEdit.path) {
            document.querySelector("#sourceEditor").value = appliedEdit.content;
            if (typeof renderIdeViewMode === "function") renderIdeViewMode(project);
          }
        }
        state.projectSourcesByProjectId[project.id] = cachedSources.sort((left, right) => left.path.localeCompare(right.path));
        renderProjectViewManifest(project);
        renderProjectAssistant(project);
        if (state.ideViewMode === "driver-management" && typeof renderDriverManagement === "function") renderDriverManagement(project);
      } catch (error) {
        message.applyError = error?.code === "repository_head_conflict"
          ? "Das Projekt wurde inzwischen geändert. Der Vorschlag bleibt erhalten; bitte die KI-Antwort auf dem aktuellen Stand neu erzeugen."
          : `Der Vorschlag konnte nicht übernommen werden: ${error.message}`;
        renderProjectAssistant(project);
      }
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
      const source = edit.isNewFile
        ? { content: "" }
        : await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(edit.path)}`);
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
        code_task: () => renderGuidedCodeTask(project, view, artifact),
        code_run_lab: () => renderGuidedCodeRunLab(project, view, artifact),
        instruction_cards: () => renderGuidedInstructionCards(project, view, artifact),
        eva_calculator: () => renderGuidedEvaCalculator(project, view, artifact),
        requirements_mirror: () => renderRequirementsMirror(project, view),
        uml_activity: renderGuidedUmlActivityArtifact,
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
      const hasGuidance = Boolean(view.payload?.task || view.payload?.expected_result || view.payload?.why);
      return `
        <div class="guided-artifact-empty">
          <p class="eyebrow">Artefakt</p>
          <h3>${escapeHtml(view.title || "Projektartefakt")}</h3>
          <p>${escapeHtml(view.payload?.artifact_text || (hasGuidance
            ? "Nutze die Erklärung und die konkrete Aufgabe rechts, um diesen Schritt zu bearbeiten."
            : "Für diesen Schritt ist noch keine konkrete Aufgabe oder sichtbare Arbeitsgrundlage hinterlegt."))}</p>
        </div>
      `;
    }

    function renderRequirementsMirror(project, view) {
      const response = guidedLessonResponse(project, view) || {};
      const feedback = response.feedback || null;
      const proposal = response.proposal || "Ein Mitarbeiter soll sich an einer Maschine anmelden können.";
      return `
        <section class="guided-requirements-mirror ai-chat ai-chat--large" aria-label="KI-Verständnisspiegel">
          <header>
            <div><p class="eyebrow">KI-Verständnisspiegel</p><h3>Was versteht die KI – und was nimmt sie nur an?</h3></div>
            <span class="guided-requirements-score">${feedback ? `${Number(feedback.quality_score || 0)} %` : "–"}</span>
          </header>
          <form class="guided-requirements-form ai-chat__composer" data-guided-requirements-form data-ai-chat-form>
            <label for="guidedRequirementsProposal">Dein erster Anforderungsvorschlag</label>
            <span class="ai-chat__input-box">
              <textarea id="guidedRequirementsProposal" class="ai-chat__input" data-ai-chat-input rows="5" maxlength="12000" ${response.pending ? "disabled" : ""}>${escapeHtml(proposal)}</textarea>
              <button class="ai-chat__send" data-ai-chat-send type="submit" aria-label="Vorschlag prüfen" title="Vorschlag prüfen" ${response.pending ? "disabled" : ""}>&uarr;</button>
            </span>
            <small>Enter prüft · Shift+Enter fügt eine neue Zeile ein. Text und Ergebnis werden nicht als Projektinhalt gespeichert.</small>
          </form>
          ${response.pending ? '<p class="guided-requirements-status is-pending" role="status">Die KI trennt Verstandenes, Annahmen und offene Entscheidungen …</p>' : ""}
          ${response.error ? `<p class="guided-requirements-status is-error" role="alert">${escapeHtml(response.error)}</p>` : ""}
          ${feedback ? renderRequirementsFeedback(feedback) : `
            <div class="guided-requirements-empty">
              <strong>Noch keine Auswertung</strong>
              <p>Formuliere bewusst noch nicht perfekt. Der Spiegel soll fehlende Entscheidungen sichtbar machen, nicht verdecken.</p>
            </div>
          `}
        </section>
      `;
    }

    function renderRequirementsFeedback(feedback) {
      return `
        <div class="guided-requirements-feedback">
          <p class="guided-requirements-summary">${escapeHtml(feedback.summary || "")}</p>
          ${requirementsList("Sicher verstanden", feedback.understood, "understood")}
          ${requirementsObjectList("Annahmen, die die KI sonst treffen müsste", feedback.assumptions, "assumptions", (item) => [item.title, item.text, item.impact ? `Auswirkung: ${item.impact}` : ""])}
          ${requirementsList("Unklar oder mehrdeutig", feedback.unclear, "unclear")}
          ${requirementsObjectList("Fachwissen, das noch gebraucht wird", feedback.knowledge_gaps, "knowledge", (item) => [item.topic, item.explanation, item.options?.length ? `Mögliche Richtungen: ${item.options.join(" · ")}` : ""])}
          ${requirementsList("Funktionale Anforderungen", feedback.functional_requirements, "functional")}
          ${requirementsList("Nichtfunktionale Anforderungen", feedback.non_functional_requirements, "quality")}
          ${requirementsList("Randbedingungen", feedback.constraints, "constraints")}
          ${requirementsList("Fachliche Regeln", feedback.business_rules, "rules")}
          ${requirementsList("Testbare Akzeptanzkriterien", feedback.acceptance_criteria, "criteria")}
          ${requirementsList("Priorisierte Rückfragen", feedback.follow_up_questions, "questions")}
        </div>
      `;
    }

    function requirementsList(title, items, tone) {
      const values = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!values.length) return "";
      return `<section class="guided-requirements-result is-${tone}"><h4>${escapeHtml(title)}</h4><ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
    }

    function requirementsObjectList(title, items, tone, fields) {
      const values = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!values.length) return "";
      return `<section class="guided-requirements-result is-${tone}"><h4>${escapeHtml(title)}</h4>${values.map((item) => {
        const [heading, text, note] = fields(item);
        return `<article><strong>${escapeHtml(heading || "")}</strong><p>${escapeHtml(text || "")}</p>${note ? `<small>${escapeHtml(note)}</small>` : ""}</article>`;
      }).join("")}</section>`;
    }

    function bindRequirementsMirror(target, project, view, targetSelector) {
      if (view?.payload?.artifact?.type !== "requirements_mirror") return;
      target.querySelector("[data-guided-requirements-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const proposal = event.currentTarget.querySelector("textarea")?.value.trim() || "";
        if (!proposal) return;
        setGuidedLessonResponse(project, view, { proposal, pending: true, error: "", feedback: null });
        renderProjectViewManifest(project, targetSelector);
        try {
          const result = await postJson("/api/platform/requirements-workshop/feedback", { proposal });
          setGuidedLessonResponse(project, view, { pending: false, error: "", feedback: result.feedback });
        } catch (error) {
          setGuidedLessonResponse(project, view, {
            pending: false,
            error: `${error.message || "Der KI-Verständnisspiegel ist gerade nicht erreichbar."} Dein Vorschlag bleibt in dieser Browseransicht erhalten.`,
          });
        }
        renderProjectViewManifest(project, targetSelector);
      });
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
      const helpItems = Array.isArray(artifact.help_items) ? artifact.help_items : [];
      return `
        <div class="guided-code-viewer ${lines.length <= 8 ? "is-compact" : ""}">
          <div class="guided-artifact-head">
            <p class="eyebrow">Code Viewer</p>
            <h3>${escapeHtml(artifact.title || "Quellcode")}</h3>
            ${helpItems.length ? `<div class="guided-code-help-list" aria-label="Hilfe zur Schreibweise">
              ${helpItems.map((item, index) => {
                const tooltipId = `guidedCodeHelp${state.activeIdeStep || 0}_${index}`;
                return `<span class="guided-code-help">
                  <button type="button" aria-describedby="${tooltipId}" aria-label="${escapeAttribute(`${item.term || "Schreibweise"} erklären`)}"><span>?</span><code>${escapeHtml(item.term || "Erklärung")}</code></button>
                  <span id="${tooltipId}" class="guided-code-help-tooltip" role="tooltip">${escapeHtml(item.text || "")}</span>
                </span>`;
              }).join("")}
            </div>` : ""}
          </div>
          <pre>${lines.map((line, index) => `<span><b>${String(index + 1).padStart(3, " ")}</b>${escapeHtml(line)}</span>`).join("")}</pre>
        </div>
      `;
    }

    function renderGuidedInstructionCards(project, view, artifact) {
      const cards = sequenceCardOrder(project, view, artifact);
      return `
        <section class="guided-instruction-board" data-guided-sequence>
          <div class="guided-artifact-head">
            <p class="eyebrow">Denkaufgabe</p>
            <h3>${escapeHtml(artifact.title || "Anweisungen ordnen")}</h3>
          </div>
          <div class="guided-instruction-board-body">
            ${artifact.goal ? `<strong class="guided-instruction-goal">${escapeHtml(artifact.goal)}</strong>` : ""}
            <div class="guided-instruction-cards">
              ${cards.map((card, index) => `<article draggable="true" data-guided-sequence-card="${escapeAttribute(card.id || "")}">
                <div class="guided-instruction-card-head"><span>${index + 1}</span><small>⋮⋮ Verschieben</small></div>
                <strong>${escapeHtml(card.text || "")}</strong>
                <div class="guided-instruction-card-actions">
                  <button type="button" data-guided-sequence-move="-1" aria-label="${escapeAttribute(`${card.text || "Anweisung"} nach links verschieben`)}" ${index === 0 ? "disabled" : ""}>←</button>
                  <button type="button" data-guided-sequence-move="1" aria-label="${escapeAttribute(`${card.text || "Anweisung"} nach rechts verschieben`)}" ${index === cards.length - 1 ? "disabled" : ""}>→</button>
                </div>
              </article>`).join("")}
            </div>
            ${artifact.note ? `<p>${escapeHtml(artifact.note)}</p>` : ""}
          </div>
        </section>
      `;
    }

    function sequenceCardOrder(project, view, artifact = view?.payload?.artifact || {}) {
      const cards = Array.isArray(artifact.cards) ? artifact.cards.filter((card) => card?.id) : [];
      const byId = new Map(cards.map((card) => [String(card.id), card]));
      const requested = guidedLessonResponse(project, view)?.sequenceOrder || [];
      const requestedIds = Array.isArray(requested) ? requested.map(String).filter((id) => byId.has(id)) : [];
      const orderedIds = [...new Set([...requestedIds, ...cards.map((card) => String(card.id))])];
      return orderedIds.map((id) => byId.get(id)).filter(Boolean);
    }

    function bindGuidedSequence(target, project, view, targetSelector) {
      const board = target.querySelector("[data-guided-sequence]");
      if (!board) return;
      const artifact = view?.payload?.artifact || {};
      board.querySelectorAll("[data-guided-sequence-card]").forEach((card) => {
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("text/plain", card.dataset.guidedSequenceCard || "");
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          card.classList.add("is-dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
        card.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        });
        card.addEventListener("drop", (event) => {
          event.preventDefault();
          const sourceId = event.dataTransfer?.getData("text/plain") || "";
          const targetId = card.dataset.guidedSequenceCard || "";
          moveSequenceCard(project, view, artifact, sourceId, targetId, targetSelector);
        });
      });
      board.querySelectorAll("[data-guided-sequence-move]").forEach((button) => {
        button.addEventListener("click", () => {
          const card = button.closest("[data-guided-sequence-card]");
          moveSequenceCardByOffset(project, view, artifact, card?.dataset.guidedSequenceCard || "", Number(button.dataset.guidedSequenceMove || 0), targetSelector);
        });
      });
    }

    function moveSequenceCard(project, view, artifact, sourceId, targetId, targetSelector) {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const order = sequenceCardOrder(project, view, artifact).map((card) => String(card.id));
      const sourceIndex = order.indexOf(sourceId);
      const targetIndex = order.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      order.splice(sourceIndex, 1);
      order.splice(targetIndex, 0, sourceId);
      setGuidedLessonResponse(project, view, { sequenceOrder: order });
      renderProjectViewManifest(project, targetSelector);
    }

    function moveSequenceCardByOffset(project, view, artifact, cardId, offset, targetSelector) {
      const order = sequenceCardOrder(project, view, artifact).map((card) => String(card.id));
      const currentIndex = order.indexOf(cardId);
      const targetIndex = Math.max(0, Math.min(currentIndex + offset, order.length - 1));
      if (currentIndex < 0 || currentIndex === targetIndex) return;
      const targetId = order[targetIndex];
      moveSequenceCard(project, view, artifact, cardId, targetId, targetSelector);
    }

    function evaCalculatorValues(project, view, artifact = view?.payload?.artifact || {}) {
      const response = guidedLessonResponse(project, view) || {};
      const firstRaw = response.firstInput ?? artifact.initial_values?.[0] ?? 2;
      const secondRaw = response.secondInput ?? artifact.initial_values?.[1] ?? 3;
      const first = Number(firstRaw);
      const second = Number(secondRaw);
      const valid = String(firstRaw).trim() !== "" && String(secondRaw).trim() !== "" && Number.isFinite(first) && Number.isFinite(second);
      return { firstRaw, secondRaw, first, second, valid, result: valid ? first + second : null };
    }

    function renderGuidedEvaCalculator(project, view, artifact) {
      const values = evaCalculatorValues(project, view, artifact);
      const result = values.valid ? String(values.result) : "–";
      return `
        <section class="guided-eva-board" data-guided-eva-board>
          <div class="guided-artifact-head">
            <p class="eyebrow">Interaktive EVA-Kette</p>
            <h3>${escapeHtml(artifact.title || "Eingabe · Verarbeitung · Ausgabe")}</h3>
          </div>
          <div class="guided-eva-board-body">
            <strong class="guided-instruction-goal">${escapeHtml(artifact.goal || "Verändere die Eingaben und beobachte die Ausgabe.")}</strong>
            <div class="guided-eva-inputs">
              <label class="guided-eva-card input"><span>Eingabe 1</span><strong>Zahl 1</strong><input type="number" step="1" value="${escapeAttribute(values.firstRaw)}" data-guided-eva-input="firstInput" aria-label="Erste Zahl"></label>
              <label class="guided-eva-card input"><span>Eingabe 2</span><strong>Zahl 2</strong><input type="number" step="1" value="${escapeAttribute(values.secondRaw)}" data-guided-eva-input="secondInput" aria-label="Zweite Zahl"></label>
            </div>
            <div class="guided-eva-flow" aria-hidden="true">↓</div>
            <article class="guided-eva-card processing"><span>Verarbeitung</span><strong>Addiere beide Zahlen</strong><output data-guided-eva-expression>${values.valid ? `${values.first} + ${values.second}` : "Zwei Zahlen eingeben"}</output></article>
            <div class="guided-eva-flow" aria-hidden="true">↓</div>
            <article class="guided-eva-card output"><span>Ausgabe</span><strong>Ergebnis</strong><output data-guided-eva-result>${escapeHtml(result)}</output></article>
          </div>
        </section>
      `;
    }

    function bindGuidedEvaCalculator(target, project, view) {
      const board = target.querySelector("[data-guided-eva-board]");
      if (!board) return;
      board.querySelectorAll("[data-guided-eva-input]").forEach((input) => {
        input.addEventListener("input", () => {
          setGuidedLessonResponse(project, view, { [input.dataset.guidedEvaInput]: input.value });
          const values = evaCalculatorValues(project, view);
          const expression = board.querySelector("[data-guided-eva-expression]");
          const result = board.querySelector("[data-guided-eva-result]");
          if (expression) expression.textContent = values.valid ? `${values.first} + ${values.second}` : "Zwei Zahlen eingeben";
          if (result) result.textContent = values.valid ? String(values.result) : "–";
          updateGuidedCompletionState(target, project, view);
        });
      });
    }

    function renderGuidedCodeTask(project, view, artifact) {
      const response = guidedLessonResponse(project, view);
      const content = response?.code ?? artifact.content ?? "";
      const embeddedLab = artifact.lab_url ? `
        <section class="guided-embedded-lab" data-guided-embedded-lab>
          <header><div><p class="eyebrow">Browser-Simulator</p><h3>${escapeHtml(artifact.lab_title || "Virtuelles Projektlabor")}</h3></div><a href="${escapeAttribute(artifact.lab_url)}" target="_blank" rel="noreferrer">In eigenem Tab öffnen</a></header>
          <p>Die Simulation arbeitet ausschließlich mit Modellwerten. Sie erkennt und flasht keine reale Hardware.</p>
          <iframe src="${escapeAttribute(artifact.lab_url)}" title="${escapeAttribute(artifact.lab_title || "Virtuelles Projektlabor")}" loading="lazy"></iframe>
        </section>` : "";
      return `
        <div class="guided-code-task-stack">
          ${embeddedLab}
          <div class="guided-code-viewer guided-code-task">
            <div class="guided-artifact-head">
              <p class="eyebrow">Abschlussprotokoll</p>
              <h3>${escapeHtml(artifact.title || "Ressourcenplan ergänzen")}</h3>
            </div>
            <textarea data-guided-code-task spellcheck="false" aria-label="${escapeAttribute(artifact.title || "Ressourcenplan ergänzen")}">${escapeHtml(content)}</textarea>
          </div>
        </div>
      `;
    }

    function renderGuidedCodeRunLab(project, view, artifact) {
      const response = guidedLessonResponse(project, view) || {};
      const content = response.code ?? artifact.content ?? "";
      const helpItems = Array.isArray(artifact.help_items) ? artifact.help_items : [];
      const hasRun = response.lastRunCode === content && response.runCompleted === true;
      const output = response.runPending
        ? "Programm wird ausgeführt …"
        : hasRun
          ? (response.runError || response.runOutput || "Keine Konsolenausgabe")
          : "Noch nicht ausgeführt";
      return `
        <section class="guided-code-run-lab" data-guided-code-run-lab>
          <div class="guided-artifact-head">
            <p class="eyebrow">Mini-Programmierlabor</p>
            <h3>${escapeHtml(artifact.title || "Code ändern und ausführen")}</h3>
            ${helpItems.length ? `<div class="guided-code-help-list" aria-label="Hilfe zur Schreibweise">
              ${helpItems.map((item, index) => {
                const tooltipId = `guidedCodeRunHelp${state.activeIdeStep || 0}_${index}`;
                return `<span class="guided-code-help">
                  <button type="button" aria-describedby="${tooltipId}" aria-label="${escapeAttribute(`${item.term || "Schreibweise"} erklären`)}"><span>?</span><code>${escapeHtml(item.term || "Erklärung")}</code></button>
                  <span id="${tooltipId}" class="guided-code-help-tooltip" role="tooltip">${escapeHtml(item.text || "")}</span>
                </span>`;
              }).join("")}
            </div>` : ""}
          </div>
          <div class="guided-code-viewer guided-code-task">
            <textarea data-guided-code-task spellcheck="false" aria-label="${escapeAttribute(artifact.title || "Code ändern und ausführen")}">${escapeHtml(content)}</textarea>
          </div>
          <div class="guided-code-run-toolbar">
            <button class="primary" type="button" data-guided-code-run ${response.runPending ? "disabled" : ""}>${response.runPending ? "Wird ausgeführt …" : "Programm ausführen"}</button>
            <span>Ändern · ausführen · Ausgabe prüfen</span>
          </div>
          <section class="guided-code-output ${response.runError ? "is-error" : ""}" aria-live="polite">
            <strong>${escapeHtml(artifact.output_label || "Konsolenausgabe")}</strong>
            <output data-guided-code-output>${escapeHtml(output)}</output>
          </section>
          ${artifact.test_code ? `<section class="guided-code-test">
            <strong>Beim Ausführen wird zusätzlich geprüft</strong>
            <pre>${escapeHtml(artifact.test_code)}</pre>
          </section>` : ""}
        </section>
      `;
    }

    function runGuidedJavaScript(code, testCode = "") {
      if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        return Promise.resolve({ output: "", error: "Die Codeausführung wird von diesem Browser nicht unterstützt." });
      }
      const workerSource = `
        const output = [];
        const format = (value) => {
          if (typeof value === "string") return value;
          if (typeof value === "undefined") return "undefined";
          if (typeof value === "function") return "[Function]";
          try { return JSON.stringify(value); } catch { return String(value); }
        };
        console.log = (...values) => output.push(values.map(format).join(" "));
        console.info = console.log;
        console.warn = console.log;
        self.fetch = undefined;
        self.XMLHttpRequest = undefined;
        self.WebSocket = undefined;
        self.EventSource = undefined;
        self.onmessage = (event) => {
          try {
            const source = String(event.data.code || "") + "\\n" + String(event.data.testCode || "");
            Function(source)();
            self.postMessage({ output: output.join("\\n"), error: "" });
          } catch (error) {
            self.postMessage({ output: output.join("\\n"), error: error?.message || String(error) });
          }
        };
      `;
      const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
      return new Promise((resolve) => {
        const worker = new Worker(workerUrl);
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve(result);
        };
        const timeout = setTimeout(() => finish({ output: "", error: "Das Programm wurde nach 1,5 Sekunden beendet." }), 1500);
        worker.addEventListener("message", (event) => finish(event.data || { output: "", error: "Unbekannter Ausführungsfehler." }), { once: true });
        worker.addEventListener("error", (event) => finish({ output: "", error: event.message || "Das Programm konnte nicht ausgeführt werden." }), { once: true });
        worker.postMessage({ code, testCode });
      });
    }

    function bindGuidedCodeRunLab(target, project, view, targetSelector) {
      const lab = target.querySelector("[data-guided-code-run-lab]");
      if (!lab) return;
      lab.querySelector("[data-guided-code-run]")?.addEventListener("click", async () => {
        const code = lab.querySelector("[data-guided-code-task]")?.value || "";
        setGuidedLessonResponse(project, view, {
          code,
          lastRunCode: code,
          runCompleted: false,
          runPending: true,
          runOutput: "",
          runError: "",
        });
        renderProjectViewManifest(project, targetSelector);
        const result = await runGuidedJavaScript(code, view?.payload?.artifact?.test_code || "");
        setGuidedLessonResponse(project, view, {
          code,
          lastRunCode: code,
          runCompleted: true,
          runPending: false,
          runOutput: result.output,
          runError: result.error,
        });
        renderProjectViewManifest(project, targetSelector);
      });
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

    function learningSoftwareUnits(project) {
      if (Array.isArray(project?.softwareUnits) && project.softwareUnits.length) return project.softwareUnits;
      if (!project?.buildConfig) return [];
      return [{
        software_unit_id: "firmware",
        title: "Firmware",
        software_kind: "embedded_firmware",
        build_system: "platformio",
        source_root: "",
        device_id: project.linkedDeviceId || "",
        build_config: project.buildConfig,
      }];
    }

    function projectRequiresHardware(project) {
      return !String(project?.targetRuntime || "").startsWith("runtime.browser_");
    }

    function renderBoardOptions(boards, selectedId) {
      if (typeof BoardConfigurationPlugin === "undefined") {
        throw new Error("Die Hardware-Konfiguration wurde für dieses Hardware-Lernprojekt nicht geladen");
      }
      return BoardConfigurationPlugin.renderBoardOptions(boards, selectedId);
    }

    function selectedLearningSoftwareUnit(project) {
      state.guidedSoftwareUnitByProject ||= {};
      const units = learningSoftwareUnits(project);
      const selectedId = state.guidedSoftwareUnitByProject[project.id] || project.activeSoftwareUnitId || units[0]?.software_unit_id || "";
      return units.find((unit) => unit.software_unit_id === selectedId) || units[0] || null;
    }

    function selectLearningSoftwareUnit(project, softwareUnitId, targetSelector) {
      state.guidedSoftwareUnitByProject ||= {};
      state.guidedSoftwareUnitByProject[project.id] = softwareUnitId;
      renderProjectViewManifest(project, targetSelector);
    }

    function renderLearningSoftwareTargetPanel(project) {
      if (!projectRequiresHardware(project)) return "";
      const units = learningSoftwareUnits(project);
      if (!units.length || project.projectOrigin !== "account_project") return "";
      const selectedUnit = selectedLearningSoftwareUnit(project);
      const config = selectedUnit?.build_config || {};
      const selectedBoardId = config.board_configuration?.account_board_id
        ? `account_board:${config.board_configuration.account_board_id}:v${config.board_configuration.account_board_version}`
        : config.board_configuration?.base_board_profile_id || "";
      const selectedDeviceId = selectedUnit?.device_id || "";
      const platformio = selectedUnit?.build_system === "platformio";
      const compatibleDevices = (state.devices || []).filter((device) => !selectedBoardId || String(device.hardware_profile_id) === String(config.board_configuration?.base_board_profile_id));
      return `<section class="learning-software-target-panel">
        <header><div><p class="eyebrow">Software und Build-Ziel</p><strong>${escapeHtml(selectedUnit?.title || "Softwareeinheit")}</strong></div><span>${escapeHtml(selectedUnit?.build_system || "nicht konfiguriert")}</span></header>
        <div class="learning-software-target-grid">
          <label>Softwareeinheit<select data-learning-software-unit>${units.map((unit) => `<option value="${escapeAttribute(unit.software_unit_id)}" ${unit.software_unit_id === selectedUnit?.software_unit_id ? "selected" : ""}>${escapeHtml(unit.title)} · ${escapeHtml(unit.software_kind)}</option>`).join("")}</select></label>
          ${platformio ? `<label>Zielboard<select data-learning-target-board><option value="">Zielboard auswählen</option>${renderBoardOptions(state.processorBoards || [], selectedBoardId)}</select></label>
          <label>Oder Inventar-Device<select data-learning-target-device><option value="">Nur für das gewählte Board bauen</option>${compatibleDevices.map((device) => `<option value="${escapeAttribute(device.device_id)}" ${device.device_id === selectedDeviceId ? "selected" : ""}>${escapeHtml(device.display_name || device.device_id)}</option>`).join("")}</select></label>` : `<p class="helper-text">Diese Einheit kann bereits mit Quellen und Build-System gespeichert werden. Für ${escapeHtml(selectedUnit?.build_system || "dieses Build-System")} fehlt noch ein ausführender Runner.</p>`}
        </div>
        <footer><span>${platformio && selectedBoardId ? `${escapeHtml(config.platform || "PlatformIO")} · ${escapeHtml(config.board || "Boardziel")} · ${escapeHtml(config.framework || "ohne Framework")}` : "Wähle ein Build-Ziel für diese Softwareeinheit."}</span><button type="button" data-build-learning-software-unit ${platformio && selectedBoardId ? "" : "disabled"}>Ausgewähltes Target bauen</button></footer>
      </section>`;
    }

    function projectLabState(view) {
      state.guidedLabs ||= {};
      const key = view.id || "lab";
      if (!state.guidedLabs[key]) state.guidedLabs[key] = { built: false, flashed: false, transport: "", streamStatus: "noch nicht verbunden", lines: [] };
      return state.guidedLabs[key];
    }

    function renderInventoryBoardSelection(project) {
      const selectedDeviceId = selectedLearningSoftwareUnit(project)?.device_id || project.linkedDeviceId || "";
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
            <p class="guided-lab-step">Schritt 1: Boardkonfiguration auswählen</p>
            ${renderLearningBoardConfigurationSelection(project)}
            <p class="guided-lab-step">Schritt 2: Physisches Board zuordnen</p>
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
      const selectedSoftwareUnit = selectedLearningSoftwareUnit(project);
      const selectedDeviceId = selectedSoftwareUnit?.device_id || project.linkedDeviceId || "";
      const selectedDevice = state.devices.find((device) => device.device_id === selectedDeviceId) || null;
      const buildTargetReady = Boolean(selectedSoftwareUnit?.build_config?.board_configuration?.base_board_profile_id);
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
              <p class="guided-lab-step">1. Boardkonfiguration auswählen</p>
              ${renderLearningBoardConfigurationSelection(project)}
              <p class="guided-lab-step">2. Physisches Board zuordnen</p>
              <label for="guidedLabDevice">Bitte wähle dein ESP-Board aus deinem Inventar. Mit welchem möchtest du arbeiten?</label>
              <select id="guidedLabDevice" data-guided-lab-device>
                <option value="">ESP-Board auswählen</option>
                ${state.devices.map((device) => `<option value="${escapeAttribute(device.device_id)}" ${device.device_id === selectedDeviceId ? "selected" : ""}>${escapeHtml(device.display_name || device.device_id)}${device.ota_status === "ready" ? " · OTA bereit" : ""}</option>`).join("")}
              </select>
              <p>${selectedDevice ? `Dieses Lernprojekt ist mit <strong>${escapeHtml(selectedDevice.display_name || selectedDevice.device_id)}</strong> verbunden. Der MQTT-Broker akzeptiert nur das Zertifikat und die Device-Topics dieses Boards.` : "Waehle ein provisioniertes Board. Erst dessen technische Device-ID und Zertifikat machen die MQTT-Verbindung eindeutig."}</p>
            </section>
            <section class="guided-firmware-card">
              <strong>2. Taster-Firmware für das gewählte Target bauen</strong>
              <pre><code>pinMode(BUTTON_PIN, INPUT_PULLUP);
if (digitalRead(BUTTON_PIN) == LOW) {
  publishEvent("taste_gedrueckt");
  Serial.println("taste_gedrueckt");
}</code></pre>
              <div class="guided-lab-actions">
                <button type="button" data-guided-lab-action="build" ${buildTargetReady ? "" : "disabled"}>Firmware bauen</button>
                <button type="button" data-guided-lab-action="flash_usb" ${lab.built ? "" : "disabled"}>Per USB flashen</button>
                <button type="button" data-guided-lab-action="flash_ota" ${lab.built ? "" : "disabled"}>Per OTA flashen</button>
              </div>
              <p class="helper-text">Der Build verwendet ausschließlich die gespeicherte Softwareeinheit und deren Board-Target. Flash benötigt zusätzlich ein physisches Device.</p>
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
          ${renderLearningGuidance(view, validation)}
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
          ${questions.length ? `
            <section class="guided-check-questions">
              <strong>Prüffragen</strong>
              <ul class="manifest-list">${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </section>
          ` : ""}
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
      if (view.type === "requirements_workshop") return "";
      return Object.keys(payload).length ? `<pre class="plantuml-box">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>` : "";
    }

    function renderLearningContext(view) {
      const payload = view.payload || {};
      const learningText = Array.isArray(payload.learning_text)
        ? payload.learning_text
        : (payload.learning_text ? [payload.learning_text] : []);
      const paragraphs = [view.summary, ...learningText]
        .map((text) => String(text || "").trim())
        .filter((text, index, values) => text && values.indexOf(text) === index);
      if (!paragraphs.length && !payload.why) return "";
      return `
        <section class="guided-learning-context">
          <p class="eyebrow">Worum es geht</p>
          ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          ${payload.why ? `
            <aside>
              <strong>Warum ist das wichtig?</strong>
              <p>${escapeHtml(payload.why)}</p>
            </aside>
          ` : ""}
        </section>
      `;
    }

    function renderLearningGuidance(view, validation = { canContinue: true }) {
      const payload = view.payload || {};
      const completionType = String(view?.completion?.type || "");
      const targetText = completionType === "code_run" && !view?.completion?.required_changed_output_lines
        ? String(view?.completion?.target_output || "").trim()
        : "";
      const expectedResultVisible = !["choice", "sequence", "eva_calculation"].includes(completionType) || validation.canContinue;
      const sections = [
        ["Deine Aufgabe", payload.task],
        ["Das solltest du danach sehen", expectedResultVisible ? payload.expected_result : ""],
      ].filter(([, text]) => text);
      if (!sections.length) return "";
      return `
        <div class="guided-learning-guidance">
          ${sections.map(([title, text]) => `
            <section>
              <strong>${escapeHtml(title)}</strong>
              <p>${renderGuidedTargetText(text, targetText)}</p>
            </section>
          `).join("")}
        </div>
      `;
    }

    function renderGuidedTargetText(text, targetText) {
      const source = String(text || "");
      const target = String(targetText || "");
      if (!target || !source.includes(target)) return escapeHtml(source);
      return source
        .split(target)
        .map(escapeHtml)
        .join(`<mark class="guided-target-text"><code>${escapeHtml(target)}</code></mark>`);
    }

    function renderRequiredFunctions(view) {
      const functions = normalizeRequiredFunctions(view);
      return functions.length ? `<dl class="meta-list compact">${meta("Funktionen", functions.join(", "))}</dl>` : "";
    }

    function guidedLessonResponse(project, view) {
      state.guidedLessonResponses ||= {};
      return state.guidedLessonResponses[`${project?.id || "project"}:${view?.id || "step"}`] || null;
    }

    function setGuidedLessonResponse(project, view, response) {
      state.guidedLessonResponses ||= {};
      const key = `${project?.id || "project"}:${view?.id || "step"}`;
      state.guidedLessonResponses[key] = { ...(state.guidedLessonResponses[key] || {}), ...response };
    }

    function guidedStepIsCompleted(project, view) {
      const views = guidedViews(project);
      const index = views.findIndex((item) => item.id === view?.id);
      const progress = progressFor(project?.id) || {};
      return new Set(progress.completedSteps || []).has(index)
        || new Set(progress.completedStepIds || []).has(view?.id);
    }

    function renderGuidedCompletion(project, view, validation) {
      const completion = view?.completion || {};
      if (completion.type === "hardware_or_simulator") {
        return renderAdaptiveHardwareCompletion(project, view, completion);
      }
      if (completion.type !== "choice") return "";
      const response = guidedLessonResponse(project, view);
      const selected = response?.choice || "";
      const options = Array.isArray(completion.options) ? completion.options : [];
      return `
        <fieldset class="guided-completion" aria-describedby="guidedCompletionStatus">
          <legend>${escapeHtml(completion.prompt || "Wähle die richtige Antwort")}</legend>
          <div class="guided-completion-options">
            ${options.map((option) => {
              const value = String(option?.id ?? option?.value ?? option);
              const label = String(option?.label ?? option);
              return `<label><input type="radio" name="guided-completion-${escapeAttribute(view.id || "step")}" value="${escapeAttribute(value)}" data-guided-choice ${selected === value ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
            }).join("")}
          </div>
        </fieldset>
      `;
    }

    function renderAdaptiveHardwareCompletion(project, view, completion) {
      const devices = adaptiveHardwareDevices(completion);
      const mode = devices.length ? "hardware" : "simulator";
      const branch = completion[mode] || {};
      const response = guidedLessonResponse(project, view);
      const selected = response?.adaptiveMode === mode ? response.adaptiveChoice || "" : "";
      const options = Array.isArray(branch.options) ? branch.options : [];
      const deviceLabel = devices.length
        ? devices.slice(0, 2).map((device) => device.display_name || device.device_id || device.hardware_profile_id).join(", ")
        : "Kein derzeit nutzbares kompatibles Board erkannt";
      return `
        <fieldset class="guided-completion guided-adaptive-completion" aria-describedby="guidedCompletionStatus">
          <legend>${escapeHtml(branch.prompt || "Führe die verpflichtende Prüfung durch")}</legend>
          <div class="guided-adaptive-mode ${mode}">
            <strong>${mode === "hardware" ? "Pflichtprüfung am realen Gerät" : "Pflichtprüfung im Simulator"}</strong>
            <span>${escapeHtml(deviceLabel)}</span>
            ${branch.instructions ? `<p>${escapeHtml(branch.instructions)}</p>` : ""}
          </div>
          <div class="guided-completion-options">
            ${options.map((option) => {
              const value = String(option?.id ?? option?.value ?? option);
              const label = String(option?.label ?? option);
              return `<label><input type="radio" name="guided-adaptive-completion-${escapeAttribute(view.id || "step")}" value="${escapeAttribute(value)}" data-guided-adaptive-choice data-guided-adaptive-mode="${mode}" ${selected === value ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
            }).join("")}
          </div>
        </fieldset>
      `;
    }

    function adaptiveHardwareDevices(completion) {
      const prefixes = Array.isArray(completion?.hardware_profile_prefixes) && completion.hardware_profile_prefixes.length
        ? completion.hardware_profile_prefixes.map(String)
        : ["hardware.processor_board."];
      return (state.devices || []).filter((device) => {
        const profile = String(device?.hardware_profile_id || "");
        return prefixes.some((prefix) => profile.startsWith(prefix)) && adaptiveHardwareIsUsable(device);
      });
    }

    function adaptiveHardwareIsUsable(device) {
      if (device?.usb_flash_supported || device?.usb_port || device?.serial_port) return true;
      const status = String(device?.connectivity_status || "").toLowerCase();
      if (["offline", "unreachable", "unknown", "disconnected"].includes(status)) return false;
      return true;
    }

    function updateGuidedCompletionState(target, project, view) {
      const validation = validateGuidedView(project, view);
      const nextButton = target.querySelector('[data-guided-control="next_step"]');
      if (nextButton) nextButton.disabled = !validation.canContinue;
      const status = target.querySelector("[data-guided-validation]");
      if (!status) return;
      status.className = `validation ${validation.canContinue ? "ok" : "blocked"}`;
      status.innerHTML = renderGuidedValidationContent(validation);
    }

    function guidedViews(project) {
      return Array.isArray(project?.viewManifest?.views) ? project.viewManifest.views : [];
    }

    function validateGuidedView(project, view) {
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

      if (completion.type === "requirements_feedback") {
        const response = guidedLessonResponse(project, view) || {};
        const completed = guidedStepIsCompleted(project, view);
        const canContinue = Boolean(response.feedback) || completed;
        return {
          canContinue,
          showStatus: true,
          message: canContinue
            ? response.feedback ? "Verständnis-Spiegel erstellt. Prüfe die Annahmen, bevor du weitergehst." : "Dieser Schritt wurde bereits abgeschlossen; der flüchtige KI-Inhalt wird nicht erneut angezeigt."
            : response.pending ? "Die Auswertung läuft …" : "Erstelle zuerst einen Verständnis-Spiegel.",
          focus,
        };
      }

      if (completion.type === "choice") {
        const selected = guidedLessonResponse(project, view)?.choice || "";
        const correct = String(completion.correct_option ?? completion.correct ?? "");
        const canContinue = Boolean(selected) && selected === correct;
        return {
          canContinue,
          message: canContinue
            ? completion.success || "Richtig. Du kannst mit der nächsten Lektion fortfahren."
            : selected
              ? completion.failure || "Das passt noch nicht. Prüfe den Code noch einmal."
              : "Beantworte die Aufgabe, bevor du fortfährst.",
          showStatus: true,
          focus,
        };
      }

      if (completion.type === "sequence") {
        const order = sequenceCardOrder(project, view).map((card) => String(card.id));
        const correct = Array.isArray(completion.correct_order) ? completion.correct_order.map(String) : [];
        const canContinue = order.length === correct.length && order.every((id, index) => id === correct[index]);
        const hasMoved = Array.isArray(guidedLessonResponse(project, view)?.sequenceOrder);
        return {
          canContinue,
          message: canContinue
            ? completion.success || "Die Reihenfolge stimmt. Du kannst fortfahren."
            : hasMoved
              ? completion.failure || "Die Reihenfolge passt noch nicht."
              : "Verschiebe die Kacheln in eine sinnvolle Reihenfolge.",
          showStatus: true,
          focus,
        };
      }

      if (completion.type === "eva_calculation") {
        const values = evaCalculatorValues(project, view);
        const targetResult = Number(completion.target_result);
        const canContinue = values.valid && Number.isFinite(targetResult) && values.result === targetResult;
        return {
          canContinue,
          message: canContinue
            ? completion.success || `Richtig: Die Ausgabe zeigt ${targetResult}.`
            : values.valid
              ? completion.failure || `Die Ausgabe zeigt noch ${values.result}. Verändere eine oder beide Eingaben.`
              : "Gib in beiden Eingabe-Kacheln eine Zahl ein.",
          showStatus: true,
          focus,
        };
      }

      if (completion.type === "code_run") {
        const response = guidedLessonResponse(project, view) || {};
        const code = response.code ?? view?.payload?.artifact?.content ?? "";
        const hasCurrentRun = response.lastRunCode === code && response.runCompleted === true;
        const targetOutput = String(completion.target_output ?? "");
        const required = Array.isArray(completion.must_contain) ? completion.must_contain : [];
        const forbidden = Array.isArray(completion.must_not_contain) ? completion.must_not_contain : [];
        const comparableCode = String(code).replaceAll(";", "").replace(/\s+/g, " ").trim();
        const comparablePattern = (item) => String(item).replaceAll(";", "").replace(/\s+/g, " ").trim();
        const requiredChangedOutputLines = Number(completion.required_changed_output_lines || 0);
        const initialCode = comparablePattern(view?.payload?.artifact?.content || "");
        const codeWasChanged = comparableCode !== initialCode;
        const targetLines = targetOutput.trim().split(/\r?\n/).map((line) => line.trim());
        const actualLines = String(response.runOutput || "").trim().split(/\r?\n/).map((line) => line.trim());
        const outputLineCountMatches = targetLines.length === actualLines.length;
        const changedOutputLines = outputLineCountMatches
          ? targetLines.reduce((count, line, index) => count + (line === actualLines[index] ? 0 : 1), 0)
          : -1;
        const codeMatches = required.every((item) => comparableCode.includes(comparablePattern(item)))
          && forbidden.every((item) => !comparableCode.includes(comparablePattern(item)));
        const outputMatches = requiredChangedOutputLines > 0
          ? codeWasChanged && outputLineCountMatches && changedOutputLines === requiredChangedOutputLines
          : String(response.runOutput || "").trim() === targetOutput.trim();
        const errorMatches = completion.target_error
          ? String(response.runError || "").includes(String(completion.target_error))
          : !response.runError;
        const canContinue = hasCurrentRun && codeMatches && outputMatches && errorMatches;
        const actualOutput = response.runError
          ? `Fehler: ${response.runError}`
          : String(response.runOutput || "Keine Konsolenausgabe");
        const changedOutputFailure = !codeWasChanged
          ? "Ändere genau einen Wert im Code und führe ihn danach erneut aus."
          : !outputLineCountMatches
            ? `Die Ausgabe soll weiterhin aus ${targetLines.length} Zeilen bestehen. Aktuell sind es ${actualLines.length}.`
            : `Aktuell ${changedOutputLines === 1 ? "unterscheidet sich eine Zeile" : `unterscheiden sich ${changedOutputLines} Zeilen`}. Ändere genau eine Ausgabe.`;
        return {
          canContinue,
          message: canContinue
            ? completion.success || (targetOutput
              ? `Richtig: Das Programm gibt ${targetOutput} aus.`
              : "Richtig: Das Programm wurde ausgeführt und erzeugt keine Konsolenausgabe.")
            : response.runPending
              ? "Das Programm wird ausgeführt."
            : !hasCurrentRun
              ? "Führe den aktuellen Code aus und prüfe die Ausgabe."
              : response.runError || (requiredChangedOutputLines > 0
                ? changedOutputFailure
                : completion.failure || `Die Ausgabe ist noch nicht ${targetOutput}.`),
          showStatus: true,
          comparison: !canContinue && hasCurrentRun && !response.runPending && targetOutput
            ? {
                expectedLabel: requiredChangedOutputLines > 0 ? "Ausgangsausgabe" : "Erwartet",
                actualLabel: requiredChangedOutputLines > 0 ? "Aktuelle Ausgabe" : "Tatsächlich",
                expected: targetOutput,
                actual: actualOutput,
              }
            : null,
          focus,
        };
      }

      if (completion.type === "code") {
        if (guidedStepIsCompleted(project, view)) {
          return { canContinue: true, message: completion.success || "Code-Aufgabe erfüllt.", showStatus: true, focus };
        }
        const code = guidedLessonResponse(project, view)?.code ?? view?.payload?.artifact?.content ?? "";
        const required = Array.isArray(completion.must_contain) ? completion.must_contain : [];
        const forbidden = Array.isArray(completion.must_not_contain) ? completion.must_not_contain : [];
        const missing = required.filter((item) => !String(code).includes(String(item)));
        const presentForbidden = forbidden.filter((item) => String(code).includes(String(item)));
        const canContinue = missing.length === 0 && presentForbidden.length === 0;
        return {
          canContinue,
          message: canContinue
            ? completion.success || "Code-Aufgabe erfüllt."
            : completion.failure || "Der Code erfüllt die beschriebene Aufgabe noch nicht.",
          showStatus: true,
          focus,
        };
      }

      if (completion.type === "hardware_or_simulator") {
        if (guidedStepIsCompleted(project, view)) {
          return { canContinue: true, message: completion.success || "Pflichtprüfung erfüllt.", showStatus: true, focus };
        }
        const mode = adaptiveHardwareDevices(completion).length ? "hardware" : "simulator";
        const branch = completion[mode] || {};
        const response = guidedLessonResponse(project, view);
        const selected = response?.adaptiveMode === mode ? response.adaptiveChoice || "" : "";
        const correct = String(branch.correct_option ?? branch.correct ?? "");
        const canContinue = Boolean(selected) && selected === correct;
        return {
          canContinue,
          message: canContinue
            ? completion.success || branch.success || (mode === "hardware"
              ? "Reale Hardwareprüfung erfüllt. Du kannst fortfahren."
              : "Simulatorprüfung erfüllt. Du kannst fortfahren.")
            : selected
              ? branch.failure || "Das Ergebnis passt noch nicht zur beschriebenen Prüfung."
              : mode === "hardware"
                ? "Führe die Pflichtprüfung am erkannten realen Gerät durch, bevor du fortfährst."
                : "Führe die Pflichtprüfung im Simulator durch, bevor du fortfährst.",
          showStatus: true,
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
      return validation.canContinue && !validation.showStatus
        ? ""
        : `<div id="guidedCompletionStatus" data-guided-validation class="validation ${validation.canContinue ? "ok" : "blocked"}">${renderGuidedValidationContent(validation)}</div>`;
    }

    function renderGuidedValidationContent(validation) {
      const message = validation.message || (validation.canContinue ? "Aufgabe erfüllt." : "Dieser Schritt ist noch nicht bereit.");
      const comparison = validation.comparison;
      return `
        <p class="guided-validation-message">${escapeHtml(message)}</p>
        ${comparison ? `<dl class="guided-validation-comparison">
          <div><dt>${escapeHtml(comparison.expectedLabel || "Erwartet")}</dt><dd><code>${escapeHtml(comparison.expected)}</code></dd></div>
          <div><dt>${escapeHtml(comparison.actualLabel || "Tatsächlich")}</dt><dd><code>${escapeHtml(comparison.actual)}</code></dd></div>
        </dl>` : ""}
      `;
    }

    function renderGuidedUmlActivityArtifact(artifact) {
      const steps = Array.isArray(artifact.steps) ? artifact.steps.slice(0, 3) : [];
      const firstStep = steps[0] || "Ersten Schritt ausführen";
      const secondStep = steps[1] || "Ergebnis prüfen";
      const thirdStep = steps[2] || "Ergebnis anzeigen";
      const decision = artifact.decision || {};
      const hasDecision = Boolean(decision.label);
      return `
        <section class="guided-uml-artifact" data-guided-uml-artifact="uml_activity">
          <header>
            <p class="eyebrow">Professionelle Notation</p>
            <h4>${escapeHtml(artifact.title || "UML-Aktivitätsdiagramm")}</h4>
            <p>${escapeHtml(artifact.intro || "Ein UML-Aktivitätsdiagramm beschreibt denselben Ablauf mit festgelegten Symbolen.")}</p>
          </header>
          <div class="guided-uml-layout">
            <div class="guided-uml-activity" role="img" aria-label="${escapeAttribute(artifact.accessible_label || "UML-Aktivitätsdiagramm des gelösten Programmablaufs")}">
            <svg viewBox="0 0 620 ${hasDecision ? "445" : "470"}" aria-hidden="true" focusable="false">
              <defs>
                <marker id="guidedUmlArrow" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M0,0 L14,7 L0,14 Z"></path></marker>
              </defs>
              ${hasDecision ? `
                <circle class="uml-start" cx="270" cy="22" r="11"></circle>
                <path class="uml-flow" d="M270 34 V52"></path>
                <rect class="uml-action" x="100" y="52" width="340" height="52" rx="12"></rect>
                <text x="270" y="79">${escapeHtml(firstStep)}</text>
                <path class="uml-flow" d="M270 104 V132"></path>
                <rect class="uml-action" x="100" y="132" width="340" height="52" rx="12"></rect>
                <text x="270" y="159">${escapeHtml(secondStep)}</text>
                <path class="uml-flow" d="M270 184 V210"></path>
                <polygon class="uml-decision" points="270,210 430,260 270,310 110,260"></polygon>
                <text x="270" y="261">${escapeHtml(decision.label)}</text>
                <path class="uml-flow" d="M270 310 V340"></path>
                <text class="uml-branch-label" x="286" y="326">[ja]</text>
                <rect class="uml-action" x="100" y="340" width="340" height="52" rx="12"></rect>
                <text x="270" y="367">${escapeHtml(decision.yes || "Aktion ausführen")}</text>
                <path class="uml-flow" d="M270 392 V406"></path>
                <circle class="uml-end-outer" cx="270" cy="423" r="13"></circle>
                <circle class="uml-end-inner" cx="270" cy="423" r="8"></circle>
                <path class="uml-flow" d="M430 260 H546"></path>
                <text class="uml-branch-label" x="448" y="244">[nein]</text>
                <circle class="uml-end-outer" cx="564" cy="260" r="13"></circle>
                <circle class="uml-end-inner" cx="564" cy="260" r="8"></circle>
              ` : `
                <circle class="uml-start" cx="310" cy="28" r="11"></circle>
                <path class="uml-flow" d="M310 40 V70"></path>
                <rect class="uml-action" x="100" y="70" width="420" height="64" rx="12"></rect>
                <text x="310" y="103">${escapeHtml(firstStep)}</text>
                <path class="uml-flow" d="M310 134 V180"></path>
                <rect class="uml-action" x="100" y="180" width="420" height="64" rx="12"></rect>
                <text x="310" y="213">${escapeHtml(secondStep)}</text>
                <path class="uml-flow" d="M310 244 V290"></path>
                <rect class="uml-action" x="100" y="290" width="420" height="64" rx="12"></rect>
                <text x="310" y="323">${escapeHtml(thirdStep)}</text>
                <path class="uml-flow" d="M310 354 V405"></path>
                <circle class="uml-end-outer" cx="310" cy="434" r="15"></circle>
                <circle class="uml-end-inner" cx="310" cy="434" r="9"></circle>
              `}
            </svg>
            </div>
            <aside class="guided-uml-legend" aria-label="UML-Aktivitätselemente">
              <h5>UML-Aktivitätselemente</h5>
              <div><svg viewBox="0 0 38 28" aria-hidden="true"><circle class="uml-start" cx="19" cy="14" r="8"></circle></svg><p><strong>Initialknoten</strong><span>Start der Aktivität</span></p></div>
              <div><svg viewBox="0 0 38 28" aria-hidden="true"><rect class="uml-action" x="3" y="5" width="32" height="18" rx="5"></rect></svg><p><strong>Aktion</strong><span>Ausführbarer Schritt</span></p></div>
              ${hasDecision ? `<div><svg viewBox="0 0 38 28" aria-hidden="true"><polygon class="uml-decision" points="19,3 35,14 19,25 3,14"></polygon></svg><p><strong>Entscheidungsknoten</strong><span>Verzweigung anhand einer Bedingung</span></p></div>` : ""}
              <div><svg viewBox="0 0 38 28" aria-hidden="true"><defs><marker id="guidedUmlLegendArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z"></path></marker></defs><path class="uml-flow" d="M4 14 H32" style="marker-end:url(#guidedUmlLegendArrow)"></path></svg><p><strong>Kontrollfluss</strong><span>Reihenfolge der Ausführung</span></p></div>
              <div><svg viewBox="0 0 38 28" aria-hidden="true"><circle class="uml-end-outer" cx="19" cy="14" r="10"></circle><circle class="uml-end-inner" cx="19" cy="14" r="6"></circle></svg><p><strong>Aktivitätsendknoten</strong><span>Ende der gesamten Aktivität</span></p></div>
            </aside>
          </div>
          <p class="guided-uml-transfer"><strong>Die Verbindung zu deiner Aufgabe:</strong> Du hast zuvor denselben Programmablauf aus einzelnen Aktionen zusammengesetzt. Entwickler können solche Abläufe mit UML-Aktivitätsdiagrammen eindeutig beschreiben.</p>
        </section>
      `;
    }

    function renderGuidedActions(project, view, validation) {
      const controls = guidedControls(project, view, validation);
      const views = guidedViews(project);
      const position = `<span class="guided-step-position" aria-label="Aktueller Schritt ${state.activeIdeStep + 1} von ${views.length}">Schritt <strong>${state.activeIdeStep + 1}</strong> von ${views.length}</span>`;
      const nextIndex = controls.actions.findIndex((action) => action.fn === "next_step");
      return `
        <div class="guided-actions">
          ${controls.actions.map((action, index) => `
            ${index === nextIndex ? position : ""}<button
              class="${action.primary ? "primary" : ""}"
              type="button"
              data-guided-control="${escapeAttribute(action.fn)}"
              ${action.disabled ? "disabled" : ""}
            >${escapeHtml(action.label)}</button>
          `).join("")}${nextIndex === -1 ? position : ""}
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
      if (fn === "open_billing") return navigate("/app/billing/");
      return undefined;
    }

    async function handleGuidedLabAction(project, view, action, targetSelector) {
      const lab = projectLabState(view);
      if (action === "build") {
        await buildGuidedSoftwareUnit(project, view, targetSelector);
        return;
      }
      if (["flash_usb", "flash_ota", "flash_webserver_usb", "flash_webserver_ota"].includes(action)) {
        openGuidedFlashDialog(project, view, targetSelector, { selectedMethod: action.endsWith("_ota") ? "ota" : "usb", webserver: action.includes("webserver") });
        return;
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

    function openGuidedFlashDialog(project, view, targetSelector, options = {}) {
      const lab = projectLabState(view);
      guidedFlashDialog ||= window.GerNetiXFlashDialog.create();
      guidedFlashDialog.open({
        title: `${view.title || "Geführtes Projekt"} flashen`,
        description: "Auch der geführte Lernablauf verwendet den zentralen Flash-Dialog. Das Terminal zeigt hier die didaktische Simulation.",
        artifact: { name: "firmware.bin", version: lab.buildVersion || "Lern-Build" },
        selectedMethod: options.selectedMethod,
        methods: {
          usb: { enabled: Boolean(lab.built), reason: "Die Firmware muss zuerst gebaut werden." },
          ota: { enabled: Boolean(lab.built), reason: "Die Firmware muss zuerst gebaut werden." },
          flashbox: { enabled: false, reason: "Für dieses geführte Labor ist keine FlashBox zugeordnet." },
        },
        async onExecute(method, terminal) {
          lab.flashed = true;
          lab.transport = method === "ota" ? "OTA ueber GerNetiX Backend" : "USB-Seriell";
          const lines = options.webserver
            ? (method === "ota" ? ["Projekt-Firmware wird übertragen.", "Flash erfolgreich. Board startet neu.", "Lokaler Projekt-Webserver ist bereit."] : ["Projekt-Firmware wird geschrieben.", "Flash erfolgreich. Board startet neu.", "Lokaler Projekt-Webserver ist bereit."])
            : (method === "ota" ? ["Board meldet sich beim GerNetiX Backend.", "firmware.bin wird übertragen.", "Flash erfolgreich. Laufzeitstream wird verbunden."] : ["ESP32 verbunden.", "firmware.bin wird geschrieben.", "Flash erfolgreich."]);
          lab.lines = lines.map((line) => `[${method.toUpperCase()}] ${line}`);
          lab.lines.forEach((line) => terminal.write(line.includes("erfolgreich") ? "ok" : "running", line));
          if (!options.webserver) startGuidedRuntimeStream(project, view, targetSelector);
          renderProjectViewManifest(project, targetSelector);
        },
      });
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
      const softwareUnit = selectedLearningSoftwareUnit(project);
      const lab = projectLabState(view);
      lab.lines = ["[Inventar] Board wird dem Lernprojekt zugeordnet ..."];
      renderProjectViewManifest(project, targetSelector);
      try {
        const response = await postJson(`/api/platform/learning-projects/${encodeURIComponent(project.id)}/device`, { device_id: deviceId, software_unit_id: softwareUnit?.software_unit_id || "" });
        Object.assign(project, response.project);
        state.projects = state.projects.map((item) => item.id === project.id ? response.project : item);
        lab.lines = [`[Inventar] ${response.device?.display_name || deviceId} ist diesem Lernprojekt zugeordnet.`, "[MQTT] Board-ID und Projektzuordnung werden vor jeder Runtime-Meldung serverseitig geprueft."];
      } catch (error) {
        lab.lines = [`[Inventar] Zuordnung fehlgeschlagen: ${error.message}`];
      }
      renderProjectViewManifest(project, targetSelector);
    }

    function renderLearningBoardConfigurationSelection(project) {
      const current = selectedLearningSoftwareUnit(project)?.build_config?.board_configuration || project.buildConfig?.board_configuration || project.build_config?.board_configuration || {};
      const selectedId = current.account_board_id
        ? `account_board:${current.account_board_id}:v${current.account_board_version}`
        : current.base_board_profile_id || project.hardwareProfileId || project.hardware_profile_id || "";
      return `<label>GerNetiX- oder eigenes Account-Board
        <select data-guided-board-configuration>
          <option value="">Boardkonfiguration auswählen</option>
            ${renderBoardOptions(state.processorBoards || [], selectedId)}
        </select>
      </label>`;
    }

    async function assignGuidedBoardConfiguration(project, view, boardProfileId, targetSelector) {
      if (!boardProfileId) return;
      const softwareUnit = selectedLearningSoftwareUnit(project);
      const lab = projectLabState(view);
      lab.lines = ["[Board] Konfiguration wird als Projektsnapshot gespeichert ..."];
      renderProjectViewManifest(project, targetSelector);
      try {
        const response = await postJson(`/api/platform/learning-projects/${encodeURIComponent(project.id)}/device`, { board_profile_id: boardProfileId, software_unit_id: softwareUnit?.software_unit_id || "" });
        Object.assign(project, response.project);
        state.projects = state.projects.map((item) => item.id === project.id ? response.project : item);
        lab.lines = [`[Board] ${response.board?.title || boardProfileId} wurde als fester Projektsnapshot übernommen.`];
      } catch (error) {
        lab.lines = [`[Board] Auswahl fehlgeschlagen: ${error.message}`];
      }
      renderProjectViewManifest(project, targetSelector);
    }

    async function buildGuidedSoftwareUnit(project, view, targetSelector) {
      if (!projectRequiresHardware(project)) return;
      const softwareUnit = selectedLearningSoftwareUnit(project);
      if (!softwareUnit || softwareUnit.build_system !== "platformio") return;
      const lab = projectLabState(view);
      lab.lines = [`[Build] ${softwareUnit.title} wird für das gespeicherte Target gebaut ...`];
      renderProjectViewManifest(project, targetSelector);
      try {
        const build = await postJson("/api/user-ide/build-jobs", {
          project_slug: project.slug,
          software_unit_id: softwareUnit.software_unit_id,
          device_id: softwareUnit.device_id || "",
          mode: "build",
        });
        if (typeof waitForCompletedBuild !== "function") {
          throw new Error("Die Build-Überwachung wurde für dieses Hardware-Lernprojekt nicht geladen");
        }
        const completed = await waitForCompletedBuild(build);
        state.builds ||= [];
        state.builds.unshift(completed);
        lab.built = completed.status === "succeeded";
        lab.lines = completed.status === "succeeded"
          ? [`[Build] ${softwareUnit.title} erfolgreich gebaut.`, `[Target] ${softwareUnit.build_config?.platform || "PlatformIO"} · ${softwareUnit.build_config?.board || "Board"}`]
          : [`[Build] Fehlgeschlagen: ${completed.error || completed.status || "unbekannter Fehler"}`];
      } catch (error) {
        lab.built = false;
        lab.lines = [`[Build] Fehlgeschlagen: ${error.message}`];
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
        window.dispatchEvent(new CustomEvent("learning-progress-updated", { detail: { projectId: project.id } }));
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
        window.dispatchEvent(new CustomEvent("learning-progress-updated", { detail: { projectId: project.id } }));
      } catch (error) {
        console.warn("Lernfortschritt konnte nicht gespeichert werden.", error);
      }
    }

    async function saveIdeGuidedProgress(project, currentStep, completedSteps) {
      const currentView = guidedViews(project)[currentStep] || {};
      const progress = await postJson("/api/platform/learning-progress", {
        courseId: project.courseId,
        lessonId: currentView.lesson_id || project.lessonId,
        currentLessonId: currentView.lesson_id || project.currentLessonId || project.lessonId,
        projectId: project.id,
        currentStep,
        currentStepId: currentView.id || "",
        completedSteps,
        completedStepIds: completedSteps.map((index) => guidedViews(project)[index]?.id).filter(Boolean),
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
      const bytes = new TextEncoder().encode(themedPlantUmlSource(source));
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

export {
  GuidedProjectView,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app-shell-controller.js, app.js, learning-project-controller.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  GuidedProjectView,
});
/* ---- /Uebergangsbruecke ---- */
