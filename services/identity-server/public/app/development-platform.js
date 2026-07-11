const DevelopmentPlatform = (() => {
  const activeProjectStorageKey = "gernetix.developmentPlatform.activeProjectId";
  const projectTemplates = {
    empty: { title: "", description: "", hint: "Architektur und Anforderungen gemeinsam von Grund auf klaeren." },
    esp32_device_only: { title: "ESP32 Device only", description: "Eigenstaendiges ESP32-Device mit lokaler Sensorik oder Aktorik, ohne Webserver und ohne Internet-Abhaengigkeit.", hint: "ESP32, Sensoren/Aktoren und lokale Bedienung." },
    esp32_datalogger_local_web: { title: "Datenlogger mit lokalem Webserver", description: "ESP32-Datenlogger mit Sensoren, lokaler Speicherung und einem nur im lokalen Netzwerk erreichbaren Webserver.", hint: "ESP32, Messwerthistorie und Browserzugriff im lokalen WLAN." },
    esp32_datalogger_internet_web: { title: "ESP32 Datenlogger mit Internet-Webserver", description: "ESP32-Datenlogger uebertraegt Messwerte sicher an einen internet-erreichbaren Server mit Datenbank und Browser-Dashboard.", hint: "ESP32, Internetanbindung, Server, Datenbank und Browser-Dashboard." },
  };

  function create({ state, postJson, openProjectInIde, escapeHtml, escapeAttribute }) {
    if (!state.developmentPlatform) {
      state.developmentPlatform = {
        assistant: null,
        chat: [],
        architectureDiagram: null,
        lastRouting: null,
        activeProjectId: "",
        projectPanelMode: "choice",
        assistantMode: "architecture_structure",
      };
    }
    if (!state.developmentPlatform.projectPanelMode) state.developmentPlatform.projectPanelMode = "choice";
    if (!state.developmentPlatform.assistantMode) state.developmentPlatform.assistantMode = "architecture_structure";

    function init() {
      document.querySelector("#developmentChatForm").addEventListener("submit", sendChatMessage);
      document.querySelector("#clearDevelopmentChatButton").addEventListener("click", clearChat);
      document.querySelector("#chooseDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("choice"));
      document.querySelector("#continueDevelopmentProjectButton").addEventListener("click", continueLastProject);
      document.querySelector("#openDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("open"));
      document.querySelector("#newEmptyDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-empty"));
      document.querySelector("#newTemplateDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-template"));
      document.querySelector("#developmentProjectForm").addEventListener("submit", createDevelopmentProject);
      document.querySelector("#developmentProjectTemplate").addEventListener("change", applyProjectTemplate);
      document.querySelector("#developmentProjectSelect").addEventListener("change", selectDevelopmentProject);
      document.querySelector("#saveDevelopmentArchitectureButton").addEventListener("click", saveArchitectureDiagram);
      document.querySelector("#startFunctionClarificationButton").addEventListener("click", startFunctionClarification);
      document.querySelector("#startEffectChainButton").addEventListener("click", startEffectChainDerivation);
      document.querySelector("#acceptDevelopmentArchitectureButton").addEventListener("click", acceptArchitectureAndContinue);
    }

    function setAssistantConfig(config) {
      state.developmentPlatform.assistant = config || null;
    }

    function render() {
      renderProjectPicker();
      renderChatMessages();
      renderQuickPrompts();
      renderArchitectureDiagram();
      syncChatAvailability();
    }

    function providerLabel(config = state.developmentPlatform.assistant || {}) {
      if (config.provider === "api" && config.apiProvider === "anthropic") return "Claude / Anthropic";
      if (config.provider === "api") return "OpenAI-kompatibel";
      if (config.provider === "ollama" || !config.provider) return "Lokales Ollama";
      return config.provider;
    }

    function renderChatMessages() {
      const messages = state.developmentPlatform.chat.length ? state.developmentPlatform.chat : [{
        role: "assistant",
        content: defaultAssistantMessage(),
      }];
      document.querySelector("#developmentChatMessages").innerHTML = messages.map((message) => `
        <article class="chat-message ${escapeHtml(message.role)}">
          <span>${message.role === "user" ? "Du" : "Architektur-KI"}</span>
          <p>${escapeHtml(message.content)}</p>
          ${message.routing ? `<div class="chat-routing ${message.routing.local ? "local" : "api"}">
            <strong>${escapeHtml(routingLabel(message.routing))}</strong>
            <small>${escapeHtml(routingDetail(message.routing))}</small>
          </div>` : ""}
          ${message.usage ? `<dl class="chat-usage">${usageRows(message.usage).map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join("")}</dl>` : ""}
        </article>
      `).join("");
      const messageList = document.querySelector("#developmentChatMessages");
      messageList.scrollTop = messageList.scrollHeight;
    }

    function renderQuickPrompts() {
      const target = document.querySelector("#developmentQuickPrompts");
      if (!target) return;
      const prompts = quickPrompts();
      target.innerHTML = prompts.map((prompt) => `
        <button type="button" data-development-quick-prompt="${escapeAttribute(prompt)}">${escapeHtml(prompt)}</button>
      `).join("");
      target.querySelectorAll("[data-development-quick-prompt]").forEach((button) => {
        button.addEventListener("click", () => sendChatContent(button.dataset.developmentQuickPrompt));
      });
    }

    function quickPrompts() {
      if (state.developmentPlatform.assistantMode !== "architecture_structure") return [];
      if (state.developmentPlatform.chat.length) return [];
      return [
        "Ich moechte einen Observer",
        "Ich moechte einen Datenlogger",
        "Nenne mir deine Pattern",
      ];
    }

    function usageRows(usage) {
      return [
        ["Prompt", formatCount(usage.promptTokens, "Tokens")],
        ["Antwort", formatCount(usage.completionTokens, "Tokens")],
        ["Gesamt", formatCount(usage.totalTokens, "Tokens")],
        ["Dauer", formatDuration(usage.totalDurationMs)],
      ];
    }

    function formatCount(value, unit) {
      return Number.isFinite(value) ? `${value.toLocaleString("de-DE")} ${unit}` : "-";
    }

    function formatDuration(value) {
      if (!Number.isFinite(value)) return "-";
      if (value < 1000) return `${value.toLocaleString("de-DE")} ms`;
      return `${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
    }

    function defaultAssistantMessage() {
      if (state.developmentPlatform.assistantMode === "function_clarification") {
        return "Jetzt klaeren wir die Funktion. Beschreibe fachlich, was passiert, z. B. `Temperatur wird gemessen`, `Messwert wird angezeigt` oder `Nutzer sieht den Messwert`.";
      }
      if (state.developmentPlatform.assistantMode === "effect_chain_derivation") {
        return "Jetzt leiten wir Wirkketten ab. Beschreibe Ausloeser und Ablauf, z. B. `Timer startet Messung, ESP32 misst Temperatur, publisht per MQTT, Server speichert`.";
      }
      return "Lass uns ein paar Fragen durchgehen, damit wir den technischen Loesungsraum definieren koennen. Du kannst frei beschreiben, was passieren soll; ich ordne es danach technischen Mustern zu.";
    }

    function assistantModeLabel() {
      return state.developmentPlatform.assistantMode === "function_clarification"
        ? "Funktion klaeren"
        : state.developmentPlatform.assistantMode === "effect_chain_derivation"
          ? "Wirkketten ableiten"
        : "Ziel/Funktion klaeren";
    }

    function clearChat() {
      state.developmentPlatform.chat = [];
      state.developmentPlatform.architectureDiagram = null;
      state.developmentPlatform.lastRouting = null;
      state.developmentPlatform.assistantMode = "architecture_structure";
      setChatStatus("Bereit fuer Architekturfragen.");
      setActionStatus("");
      renderChatMessages();
      renderQuickPrompts();
      renderArchitectureDiagram();
    }

    function renderProjectPicker() {
      const select = document.querySelector("#developmentProjectSelect");
      if (!select) return;
      const projects = developmentProjects();
      const storedProjectId = readStoredActiveProjectId();
      const storedProjectExists = projects.some((project) => project.id === storedProjectId);
      const activeProject = currentProject();
      const lastProject = storedProjectExists ? projects.find((project) => project.id === storedProjectId) : null;
      document.querySelector("#developmentProjectName").textContent = activeProject?.name || "Kein Projekt geoeffnet";
      document.querySelector("#developmentAssistantMode").textContent = assistantModeLabel();
      document.querySelector("#developmentProjectChoicePanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "choice");
      document.querySelector("#chooseDevelopmentProjectButton").classList.toggle("hidden", !activeProject || state.developmentPlatform.projectPanelMode === "choice");
      document.querySelector("#continueDevelopmentProjectButton").classList.toggle("hidden", !lastProject);
      document.querySelector("#continueDevelopmentProjectName").textContent = lastProject?.name || "";
      document.querySelector("#developmentProjectOpenPanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "open");
      const isNewProject = state.developmentPlatform.projectPanelMode === "new-empty" || state.developmentPlatform.projectPanelMode === "new-template";
      document.querySelector("#developmentProjectForm").classList.toggle("hidden", !isNewProject);
      document.querySelector("#developmentProjectTemplateField").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "new-template");
      document.querySelector("#developmentProjectTemplateHint").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "new-template");
      select.innerHTML = [
        `<option value="">Projekt waehlen</option>`,
        ...projects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`),
      ].join("");
      select.value = state.developmentPlatform.activeProjectId || "";
      setProjectStatus(activeProject
        ? `Aktiv: ${activeProject.name}`
        : "Bitte waehle, wie du im Entwicklungsbereich starten moechtest.");
    }

    function developmentProjects() {
      return (state.projects || []).filter((project) => project.type === "development_project" || project.type === "custom_project");
    }

    function activeProjectId() {
      return state.developmentPlatform.activeProjectId || "";
    }

    function showProjectPanel(mode) {
      state.developmentPlatform.projectPanelMode = mode;
      if (mode === "new-empty") {
        document.querySelector("#developmentProjectTemplate").value = "empty";
        applyProjectTemplate();
      } else if (mode === "new-template") {
        document.querySelector("#developmentProjectTemplate").value = "esp32_device_only";
        applyProjectTemplate();
      }
      renderProjectPicker();
      if (mode === "new-empty" || mode === "new-template") {
        document.querySelector("#developmentProjectTitle").focus();
      } else if (mode === "open") {
        document.querySelector("#developmentProjectSelect").focus();
      }
    }

    function continueLastProject() {
      const storedProjectId = readStoredActiveProjectId();
      if (!developmentProjects().some((project) => project.id === storedProjectId)) return;
      activateProject(storedProjectId);
    }

    function selectDevelopmentProject() {
      const projectId = document.querySelector("#developmentProjectSelect").value;
      if (!projectId) {
        setProjectStatus("Bitte waehle ein vorhandenes Projekt aus.");
        return;
      }
      activateProject(projectId);
    }

    function activateProject(projectId) {
      state.developmentPlatform.activeProjectId = projectId;
      storeActiveProjectId(projectId);
      state.developmentPlatform.projectPanelMode = "closed";
      state.developmentPlatform.chat = [];
      state.developmentPlatform.architectureDiagram = architectureDiagramForProject(currentProject());
      state.developmentPlatform.lastRouting = null;
      state.developmentPlatform.assistantMode = "architecture_structure";
      render();
    }

    function architectureDiagramForProject(project) {
      const view = (project?.viewManifest?.views || []).find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
      const source = String(view?.payload?.source || "").trim();
      if (!source) return null;
      return {
        source,
        title: view.title || "Architektur-Skizze",
        summary: view.summary || "Gespeicherte Projektarchitektur.",
        derived_from: view.payload?.derived_from || (project?.buildConfig ? "project_template" : "persisted_project"),
        ...(view.payload?.function_coverage ? { function_coverage: view.payload.function_coverage } : {}),
      };
    }

    async function createDevelopmentProject(event) {
      event.preventDefault();
      const titleInput = document.querySelector("#developmentProjectTitle");
      const descriptionInput = document.querySelector("#developmentProjectDescription");
      const templateInput = document.querySelector("#developmentProjectTemplate");
      const selectedTemplateId = templateInput.value;
      const title = titleInput.value.trim();
      if (!title) {
        setProjectStatus("Bitte gib einen Projektnamen ein.");
        titleInput.focus();
        return;
      }
      setProjectStatus("Projekt wird angelegt...");
      try {
        const response = await postJson("/api/platform/development-projects", {
          title,
          description: descriptionInput.value.trim(),
          template_id: templateInput.value,
        });
        if (response.project) {
          state.projects = state.projects.filter((project) => project.id !== response.project.id).concat(response.project);
          state.developmentPlatform.activeProjectId = response.project.id;
          storeActiveProjectId(response.project.id);
          if (selectedTemplateId !== "empty") {
            const architectureView = (response.project.viewManifest?.views || []).find((view) => view.id === "architecture-diagram");
            const source = architectureView?.payload?.source || "";
            if (source) {
              state.developmentPlatform.architectureDiagram = {
                source,
                title: architectureView.title || "Architektur-Skizze",
                summary: architectureView.summary || "Startarchitektur aus Projekttemplate.",
                derived_from: architectureView.payload?.derived_from || "project_template",
              };
            }
          }
          state.developmentPlatform.projectPanelMode = "closed";
          titleInput.value = "";
          descriptionInput.value = "";
          templateInput.value = "empty";
          applyProjectTemplate({ preserveValues: true });
          setProjectStatus(`Projekt angelegt: ${response.project.name}`);
        }
        render();
      } catch (error) {
        setProjectStatus(`Projekt konnte nicht angelegt werden: ${error.message}`);
      }
    }

    function applyProjectTemplate(event = {}) {
      const templateInput = document.querySelector("#developmentProjectTemplate");
      const template = projectTemplates[templateInput.value] || projectTemplates.empty;
      const titleInput = document.querySelector("#developmentProjectTitle");
      const descriptionInput = document.querySelector("#developmentProjectDescription");
      document.querySelector("#developmentProjectTemplateHint").textContent = template.hint;
      if (!event.preserveValues) {
        titleInput.value = template.title;
        descriptionInput.value = template.description;
      }
    }

    async function sendChatMessage(event) {
      event.preventDefault();
      const input = document.querySelector("#developmentChatInput");
      const content = input.value.trim();
      if (!content) return;
      input.value = "";
      await sendChatContent(content);
    }

    async function sendChatContent(content) {
      const input = document.querySelector("#developmentChatInput");
      const submit = document.querySelector("#developmentChatSubmit");
      const normalizedContent = String(content || "").trim();
      if (!normalizedContent) return;
      if (!activeProjectId()) {
        setProjectStatus("Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.");
        syncChatAvailability();
        return;
      }
      state.developmentPlatform.chat.push({ role: "user", content: normalizedContent });
      submit.disabled = true;
      setChatStatus("Anfrage wird verarbeitet...");
      renderChatMessages();
      renderQuickPrompts();
      try {
        const response = await postJson("/api/platform/development-assistant/chat", {
          projectId: activeProjectId(),
          messages: state.developmentPlatform.chat,
          architectureDiagram: state.developmentPlatform.architectureDiagram,
          assistantMode: state.developmentPlatform.assistantMode,
        });
        setAssistantConfig(response.config || state.developmentPlatform.assistant);
        if (Object.hasOwn(response, "architectureDiagram")) {
          state.developmentPlatform.architectureDiagram = response.architectureDiagram || null;
        }
        state.developmentPlatform.lastRouting = response.routing || null;
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: response.message?.content || "Keine Antwort erhalten.",
          usage: response.usage || null,
          routing: response.routing || null,
        });
        setChatStatus(response.usedFallback
          ? `Fallback-Antwort. Geplante Route: ${routingLabel(response.routing) || providerLabel(response.config)}.`
          : `Geroutet: ${routingLabel(response.routing) || providerLabel(response.config)}.`);
      } catch (error) {
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: `Ich konnte den Architektur-Assistenten nicht erreichen: ${error.message}`,
        });
        state.developmentPlatform.architectureDiagram = null;
        setChatStatus("Fehler beim LLM-Aufruf.");
      } finally {
        submit.disabled = false;
        if (input) input.value = "";
        render();
      }
    }

    function setChatStatus(text) {
      document.querySelector("#developmentChatStatus").textContent = text;
    }

    function routingLabel(routing) {
      if (!routing) return "";
      return routing.label || (routing.local ? "Lokal / Ollama" : "OpenAI / API");
    }

    function routingDetail(routing) {
      if (!routing) return "";
      return [
        routing.model || "Modell unbekannt",
        routing.requestComplexity ? `Anfrage: ${routing.requestComplexity}` : "",
        routing.costPolicy ? costPolicyLabel(routing.costPolicy) : "",
      ].filter(Boolean).join(" · ");
    }

    function costPolicyLabel(value) {
      if (value === "prefer_local") return "kostenarm";
      if (value === "external_costs") return "externe Kosten";
      if (value === "no_llm_call") return "kein LLM-Aufruf";
      return value;
    }

    function setProjectStatus(text) {
      const target = document.querySelector("#developmentProjectStatus");
      if (target) target.textContent = text;
    }

    function setActionStatus(text) {
      const target = document.querySelector("#developmentActionStatus");
      if (target) target.textContent = text;
    }

    function syncChatAvailability() {
      const hasProject = Boolean(activeProjectId());
      const functionCoverage = plantUmlFunctionCoverage(state.developmentPlatform.architectureDiagram?.source || "");
      const hasEffectChains = state.developmentPlatform.architectureDiagram?.derived_from === "architecture_effect_chain_derivation";
      const usesProjectTemplate = state.developmentPlatform.architectureDiagram?.derived_from === "project_template";
      const canContinue = hasProject
        && Boolean(state.developmentPlatform.architectureDiagram?.source)
        && (usesProjectTemplate || (functionCoverage.complete && (functionCoverage.element_count <= 1 || hasEffectChains)));
      document.querySelector("#developmentChatInput").disabled = !hasProject;
      document.querySelector("#developmentChatSubmit").disabled = !hasProject;
      document.querySelectorAll("[data-development-quick-prompt]").forEach((button) => {
        button.disabled = !hasProject;
      });
      document.querySelector("#saveDevelopmentArchitectureButton").disabled = !hasProject || !state.developmentPlatform.architectureDiagram?.source;
      document.querySelector("#startFunctionClarificationButton").disabled = !hasProject || !state.developmentPlatform.architectureDiagram?.source || state.developmentPlatform.assistantMode !== "architecture_structure";
      document.querySelector("#startEffectChainButton").disabled = !hasProject || !state.developmentPlatform.architectureDiagram?.source || !functionCoverage.complete || functionCoverage.element_count <= 1 || state.developmentPlatform.assistantMode === "effect_chain_derivation";
      document.querySelector("#acceptDevelopmentArchitectureButton").disabled = !canContinue;
      document.querySelector("#developmentChatInput").placeholder = hasProject
        ? state.developmentPlatform.assistantMode === "function_clarification"
          ? "Beschreibe eine Funktion, z. B. Temperatur wird gemessen."
          : state.developmentPlatform.assistantMode === "effect_chain_derivation"
            ? "Beschreibe eine Wirkkette, z. B. Timer misst Temperatur und Server speichert."
          : "Beschreibe Ziel und Funktion deines Projekts."
        : "Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.";
    }

    function startFunctionClarification() {
      if (!state.developmentPlatform.architectureDiagram?.source) {
        setActionStatus("Bitte zuerst die Strukturarchitektur erstellen.");
        syncChatAvailability();
        return;
      }
      state.developmentPlatform.assistantMode = "function_clarification";
      state.developmentPlatform.chat.push({
        role: "assistant",
        content: "Die Struktur steht. Jetzt klaeren wir die Funktion: Was passiert fachlich zwischen diesen Elementen? Beispiele: Temperatur wird gemessen, Nutzer sieht Messwerte, ESP32 steuert einen Ausgang.",
      });
      setChatStatus("Phase: Funktion klaeren.");
      setActionStatus("");
      render();
      document.querySelector("#developmentChatInput").focus();
    }

    function startEffectChainDerivation() {
      const coverage = plantUmlFunctionCoverage(state.developmentPlatform.architectureDiagram?.source || "");
      if (!coverage.complete || coverage.element_count <= 1) {
        setActionStatus("Bitte zuerst die Funktion zwischen den Elementen klaeren.");
        syncChatAvailability();
        return;
      }
      state.developmentPlatform.assistantMode = "effect_chain_derivation";
      state.developmentPlatform.chat.push({
        role: "assistant",
        content: "Die Funktion ist geklaert. Jetzt leiten wir Wirkketten ab: Welche Ausloeser starten welche Ablaeufe, welche Komponente verarbeitet etwas, und wo endet die Wirkung?",
      });
      setChatStatus("Phase: Wirkketten ableiten.");
      setActionStatus("");
      render();
      document.querySelector("#developmentChatInput").focus();
    }

    async function saveArchitectureDiagram() {
      return persistArchitectureDiagram(false);
    }

    async function acceptArchitectureAndContinue() {
      return persistArchitectureDiagram(true);
    }

    async function persistArchitectureDiagram(continueToIde) {
      const projectId = activeProjectId();
      const saveButton = document.querySelector("#saveDevelopmentArchitectureButton");
      const acceptButton = document.querySelector("#acceptDevelopmentArchitectureButton");
      if (!projectId) {
        setActionStatus("Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.");
        syncChatAvailability();
        return;
      }
      if (!state.developmentPlatform.architectureDiagram?.source) {
        setActionStatus("Es gibt noch keine Architektur, die uebernommen werden kann.");
        syncChatAvailability();
        return;
      }
      const functionCoverage = plantUmlFunctionCoverage(state.developmentPlatform.architectureDiagram.source);
      const usesProjectTemplate = state.developmentPlatform.architectureDiagram.derived_from === "project_template";
      if (continueToIde && !usesProjectTemplate && !functionCoverage.complete) {
        const missing = functionCoverage.missing.length ? ` Offen: ${functionCoverage.missing.join(", ")}.` : "";
        setActionStatus(`Bitte zuerst die Funktion klaeren: jedes Element braucht mindestens eine funktionale Beziehung.${missing}`);
        syncChatAvailability();
        return;
      }
      if (continueToIde && !usesProjectTemplate && functionCoverage.element_count > 1 && state.developmentPlatform.architectureDiagram.derived_from !== "architecture_effect_chain_derivation") {
        setActionStatus("Bitte zuerst die Wirkketten ableiten.");
        syncChatAvailability();
        return;
      }
      saveButton.disabled = true;
      acceptButton.disabled = true;
      setActionStatus(continueToIde ? "Architektur wird uebernommen..." : "Architektur wird gespeichert...");
      const project = currentProject();
      try {
        const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(projectId)}/architecture`, {
          title: project?.name || state.developmentPlatform.architectureDiagram.title || "Entwicklungsprojekt",
          description: project?.description || "",
          architectureDiagram: state.developmentPlatform.architectureDiagram,
        });
        if (response.project) {
          state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
          state.developmentPlatform.activeProjectId = response.project.id;
          storeActiveProjectId(response.project.id);
        }
        renderProjectPicker();
        if (continueToIde && openProjectInIde) {
          if (!response.project?.id) {
            throw new Error("Interner Fehler: gespeichertes Projekt ohne ID.");
          }
          setActionStatus("Architektur gespeichert. IDE wird geoeffnet...");
          await openProjectInIde(response.project.id);
        } else {
          setActionStatus(`Gespeichert${response.saved_at ? `: ${new Date(response.saved_at).toLocaleString("de-DE")}` : "."}`);
          syncChatAvailability();
        }
      } catch (error) {
        setActionStatus(`Architektur konnte nicht gespeichert werden: ${error.message}`);
        syncChatAvailability();
      }
    }

    function currentProject() {
      return (state.projects || []).find((project) => project.id === activeProjectId()) || null;
    }

    function readStoredActiveProjectId() {
      try {
        return window.localStorage.getItem(activeProjectStorageKey) || "";
      } catch {
        return "";
      }
    }

    function storeActiveProjectId(projectId) {
      try {
        if (projectId) {
          window.localStorage.setItem(activeProjectStorageKey, projectId);
        } else {
          window.localStorage.removeItem(activeProjectStorageKey);
        }
      } catch {
        // Browser storage is optional; the Project Server remains the source of truth.
      }
    }

    function renderArchitectureDiagram() {
      const target = document.querySelector("#developmentArchitectureDiagram");
      if (!target) return;
      const diagram = state.developmentPlatform.architectureDiagram;
      if (!diagram?.source) {
        target.innerHTML = `
          <p class="eyebrow">PlantUML</p>
          <h3>Architekturdiagramm</h3>
          <p class="helper-text">Sobald die Architektur-KI eine verwertbare Antwort liefert, entsteht hier eine PlantUML-Skizze aus dem Ergebnis.</p>
        `;
        return;
      }
      target.innerHTML = `
        <div class="diagram-card-head">
          <div>
            <p class="eyebrow">PlantUML</p>
            <h3>${escapeHtml(diagram.title || "Architekturdiagramm")}</h3>
            <p>${escapeHtml(diagram.summary || "")}</p>
            ${functionCoverageHint(diagram)}
          </div>
        </div>
        <figure class="plantuml-viewer">
          <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(diagram.source)}" alt="${escapeAttribute(diagram.title || "Architekturdiagramm")}">
          <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
        </figure>
      `;
      target.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
    }

    function functionCoverageHint(diagram) {
      const coverage = diagram?.function_coverage || plantUmlFunctionCoverage(diagram?.source || "");
      if (!diagram?.source || coverage.element_count <= 1) return "";
      if (diagram.derived_from === "architecture_effect_chain_derivation" && coverage.complete) return `<p class="helper-text">Wirkketten abgeleitet.</p>`;
      if (coverage.complete) return `<p class="helper-text">Funktion vollstaendig geklaert.</p>`;
      const missing = coverage.missing.length ? ` Offen: ${coverage.missing.join(", ")}.` : "";
      return `<p class="helper-text">Weiter erst moeglich, wenn jedes Element mindestens eine funktionale Beziehung hat.${escapeHtml(missing)}</p>`;
    }

    function plantUmlFunctionCoverage(source) {
      const aliases = new Set();
      const connected = new Set();
      const lines = String(source || "").split(/\r?\n/);
      lines.forEach((line) => {
        const element = line.match(/^\s*(actor|node|rectangle|queue|database|cloud)\s+"[^"]+"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
        if (element) aliases.add(element[2]);
      });
      lines.forEach((line) => {
        const arrow = line.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s+[-.]+>\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (!arrow) return;
        if (aliases.has(arrow[1])) connected.add(arrow[1]);
        if (aliases.has(arrow[2])) connected.add(arrow[2]);
      });
      const elements = [...aliases];
      const missing = elements.length <= 1 ? [] : elements.filter((alias) => !connected.has(alias));
      return {
        element_count: elements.length,
        arrow_count: lines.filter((line) => /\b[A-Za-z_][A-Za-z0-9_]*\s+[-.]+>\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(line)).length,
        complete: elements.length <= 1 || missing.length === 0,
        missing,
      };
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
      init,
      render,
      setAssistantConfig,
    };
  }

  return { create };
})();
