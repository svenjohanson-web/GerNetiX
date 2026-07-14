const DevelopmentPlatform = (() => {
  const activeProjectStorageKey = "gernetix.developmentPlatform.activeProjectId";
  let projectTemplates = {};

  function create({ state, postJson, openProjectInIde, navigate, escapeHtml, escapeAttribute }) {
    if (!state.developmentPlatform) {
      state.developmentPlatform = {
        assistant: null,
        chat: [],
        architectureDiagram: null,
        lastRouting: null,
        activeProjectId: "",
        projectPanelMode: "choice",
        assistantMode: "architecture_structure",
        hardwareConfiguration: null,
      };
    }
    if (!state.developmentPlatform.projectPanelMode) state.developmentPlatform.projectPanelMode = "choice";
    if (!state.developmentPlatform.assistantMode) state.developmentPlatform.assistantMode = "architecture_structure";

    function init() {
      document.querySelector("#developmentChatForm").addEventListener("submit", sendChatMessage);
      document.querySelector("#chooseDevelopmentProjectButton").addEventListener("click", () => {
        const nextMode = state.developmentPlatform.projectPanelMode === "closed" ? "choice" : "closed";
        showProjectPanel(nextMode);
      });
      document.querySelector("#continueDevelopmentProjectButton").addEventListener("click", continueLastProject);
      document.querySelector("#openDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("open"));
      document.querySelector("#newEmptyDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-empty"));
      document.querySelector("#newTemplateDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-template"));
      document.querySelector("#developmentProjectForm").addEventListener("submit", createDevelopmentProject);
      document.querySelector("#developmentProjectTemplate").addEventListener("change", applyProjectTemplate);
      document.querySelector("#developmentProjectSelect").addEventListener("change", selectDevelopmentProject);
      document.querySelector("#saveDevelopmentArchitectureButton").addEventListener("click", saveArchitectureDiagram);
      document.querySelector("#acceptDevelopmentArchitectureButton").addEventListener("click", acceptArchitectureAndContinue);
      document.querySelector("#developmentHardwareForm").addEventListener("change", handleHardwareConfigurationChange);
      document.querySelector("#backToDevelopmentArchitectureButton").addEventListener("click", () => navigate("/app/development-platform/"));
      document.querySelector("#saveDevelopmentHardwareButton").addEventListener("click", () => saveHardwareConfiguration(false));
      document.querySelector("#continueDevelopmentHardwareButton").addEventListener("click", () => saveHardwareConfiguration(true));
    }

    function setAssistantConfig(config) {
      state.developmentPlatform.assistant = config || null;
    }

    function setProjectTemplates(templates) {
      const catalog = Array.isArray(templates) ? templates : [];
      projectTemplates = Object.fromEntries(catalog.map((template) => [template.id, {
        title: template.default_title ?? template.title ?? "",
        description: template.description || "",
        hint: template.hint || template.description || "",
      }]));
      const select = document.querySelector("#developmentProjectTemplate");
      if (!select) return;
      select.innerHTML = catalog
        .map((template) => `<option value="${escapeAttribute(template.id)}" ${template.id === "empty" ? "hidden" : ""}>${escapeHtml(template.title)}</option>`)
        .join("");
    }

    function render() {
      renderProjectPicker();
      renderRequirementsText();
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
      if (currentProjectUsesTemplate()) return [];
      return [
        "Ich moechte einen Observer",
        "Ich moechte einen Datenlogger",
        "Nenne mir deine Pattern",
      ];
    }

    function currentProjectUsesTemplate() {
      const project = currentProject();
      const templateId = project?.viewManifest?.template_id || project?.viewManifest?.templateId || "";
      return Boolean(templateId && templateId !== "empty")
        || state.developmentPlatform.architectureDiagram?.derived_from === "project_template";
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
      return "Beschreibe dein Projektziel oder nutze eine Vorlage. Ich leite daraus die passenden technischen Muster ab.";
    }

    function renderProjectPicker() {
      const select = document.querySelector("#developmentProjectSelect");
      if (!select) return;
      const projects = developmentProjects();
      const storedProjectId = readStoredActiveProjectId();
      const storedProjectExists = projects.some((project) => project.id === storedProjectId);
      let activeProject = currentProject();
      const lastProject = storedProjectExists ? projects.find((project) => project.id === storedProjectId) : null;
      if (!activeProject && lastProject) {
        state.developmentPlatform.activeProjectId = lastProject.id;
        state.developmentPlatform.projectPanelMode = "closed";
        activeProject = lastProject;
        restoreDevelopmentDialog(lastProject);
      }
      document.querySelector("#developmentProjectName").textContent = activeProject?.name || "Kein Projekt geoeffnet";
      document.querySelector("#developmentProjectChoicePanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "choice");
      document.querySelector("#chooseDevelopmentProjectButton").classList.toggle("active", state.developmentPlatform.projectPanelMode !== "closed");
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
        ? ""
        : "Bitte waehle, wie du im Entwicklungsbereich starten moechtest.");
    }

    function renderRequirementsText() {
      const target = document.querySelector("#developmentRequirementsText");
      if (!target) return;
      const items = requirementSummaryItems(currentProject(), state.developmentPlatform.chat);
      if (!items.length) {
        target.innerHTML = `<p class="empty">Noch keine Anforderungen erfasst. Starte rechts im KI-Chat oder lege ein Projekt an.</p>`;
        return;
      }
      target.innerHTML = items.map(([label, text]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <p>${escapeHtml(text)}</p>
        </article>
      `).join("");
    }

    function requirementSummaryItems(project, chat) {
      const messages = Array.isArray(chat) ? chat : [];
      const transcript = messages.map((message) => message.content || "").join("\n");
      const items = [];
      if (project?.description) {
        items.push(["Projektkern", compactRequirementText(project.description)]);
      }
      const patterns = detectRequirementPatterns(transcript);
      if (patterns.length) items.push(["Funktionsklasse", patterns.join(", ")]);
      const access = detectAccessScope(transcript);
      if (access) items.push(["Zugriff", access]);
      const devices = detectIotDeviceScope(`${project?.description || ""}\n${transcript}`);
      if (devices) items.push(["IoT-Devices", devices]);
      const openQuestions = extractOpenRequirementQuestions(messages);
      if (openQuestions.length) items.push(["Offene Klaerung", openQuestions.join("\n")]);
      return items;
    }

    function compactRequirementText(text) {
      const normalized = String(text || "").replace(/\s+/g, " ").trim();
      if (normalized.length <= 180) return normalized;
      return `${normalized.slice(0, 177).trim()}...`;
    }

    function detectRequirementPatterns(text) {
      const normalized = String(text || "").toLowerCase();
      return [
        [/\b(observer|benachrichtigung|benachrichtigen|ereignis)\b/, "Observer / Benachrichtigung"],
        [/\b(datenlogger|data logger|logger|messdaten|messwerte)\b/, "Datenlogger"],
        [/\b(remote|steuerung|steuern|schalten|aktor)\b/, "Remote-Steuerung / Aktorik"],
        [/\b(regelung|regelstrecke|autonom|ohne wlan|lokal ausfuehren)\b/, "Lokale Regel-/Steuerstrecke"],
        [/\b(zustandsmodell|state|states|synchronisiert|broadcast)\b/, "Synchronisiertes Zustandsmodell"],
      ].filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
    }

    function detectAccessScope(text) {
      const normalized = String(text || "").toLowerCase();
      if (/\b(weltweit|internet|remote|von unterwegs|extern erreichbar)\b/.test(normalized)) return "weltweit / ueber Internet";
      if (/\b(nur lokal|lokal|heimnetz|wlan|lan)\b/.test(normalized)) return "lokal / eigenes Netzwerk";
      if (/lokal funktionieren oder weltweit erreichbar/.test(normalized)) return "noch offen: lokal oder weltweit";
      return "";
    }

    function detectIotDeviceScope(text) {
      const normalized = String(text || "").toLowerCase();
      const explicitCount = normalized.match(/\b(\d+|ein|eine|einen|mehrere)\s+(iot[- ]?)?(devices?|logger|esp32|boards?)\b/);
      if (explicitCount) return `${explicitCount[1]} ${explicitCount[3]}`.replace(/\bein(en|e)?\b/, "1");
      if (/\besp32\b/.test(normalized)) return "ESP32 als IoT-Device beteiligt";
      if (/wie viele iot-devices/.test(normalized)) return "noch offen";
      return "";
    }

    function extractOpenRequirementQuestions(messages) {
      const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content || "";
      return latestAssistant
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
        .filter((line) => line.endsWith("?"))
        .filter((line) => /ereignis|benachrichtigt|lokal|weltweit|iot-devices|messwerte|gemessen|abrufbar|logger/i.test(line))
        .slice(0, 4);
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
      restoreDevelopmentDialog(currentProject());
      render();
    }

    function restoreDevelopmentDialog(project) {
      const dialog = project?.viewManifest?.architecture_dialog || project?.viewManifest?.architectureDialog || {};
      state.developmentPlatform.chat = Array.isArray(dialog.messages) ? dialog.messages : [];
      state.developmentPlatform.architectureDiagram = sanitizeArchitectureDiagram(dialog.architectureDiagram) || architectureDiagramForProject(project);
      state.developmentPlatform.lastRouting = dialog.lastRouting || null;
      state.developmentPlatform.assistantMode = dialog.assistantMode || "architecture_structure";
    }

    async function persistDevelopmentDialog() {
      const projectId = activeProjectId();
      if (!projectId) return;
      try {
        const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(projectId)}/dialog`, {
          messages: state.developmentPlatform.chat,
          architectureDiagram: state.developmentPlatform.architectureDiagram,
          assistantMode: state.developmentPlatform.assistantMode,
          lastRouting: state.developmentPlatform.lastRouting,
        });
        if (response.project) {
          state.projects = state.projects.filter((project) => project.id !== response.project.id).concat(response.project);
        }
      } catch (error) {
        setActionStatus(`Dialog konnte nicht gespeichert werden: ${error.message}`);
      }
    }

    function architectureDiagramForProject(project) {
      const view = (project?.viewManifest?.views || []).find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
      const derivedFrom = view?.payload?.derived_from || (project?.buildConfig ? "project_template" : "persisted_project");
      const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(view?.payload?.source || ""), derivedFrom);
      if (!source) return null;
      return {
        source,
        title: view.title || "Architektur-Skizze",
        summary: view.summary || "Gespeicherte Projektarchitektur.",
        derived_from: derivedFrom,
        ...(view.payload?.function_coverage ? { function_coverage: view.payload.function_coverage } : {}),
      };
    }

    function sanitizeArchitectureDiagram(diagram) {
      if (!diagram?.source) return null;
      const derivedFrom = diagram.derived_from || diagram.derivedFrom || "";
      return {
        ...diagram,
        source: normalizeArchitecturePlantUml(stripPlantUmlNotes(diagram.source), derivedFrom),
      };
    }

    function stripPlantUmlNotes(source) {
      const lines = String(source || "").split(/\r?\n/);
      const cleaned = [];
      let inNote = false;
      lines.forEach((line) => {
        if (/^\s*note\b/i.test(line)) {
          inNote = true;
          return;
        }
        if (inNote) {
          if (/^\s*end\s+note\b/i.test(line)) inNote = false;
          return;
        }
        cleaned.push(line);
      });
      return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    function normalizeArchitecturePlantUml(source, derivedFrom = "") {
      const isTemplate = derivedFrom === "project_template" || /Startarchitektur aus Projekttemplate/i.test(source);
      let normalized = String(source || "")
        .replace(/^(\s*)(?:node|component|database|cloud|queue|artifact)\s+("[^"]+")(\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?/gmi, "$1rectangle $2$3");
      if (isTemplate) {
        normalized = normalized
          .replace(/ESP32 Datenlogger/g, "IoT-Device Datenlogger")
          .replace(/ESP32 Device/g, "IoT-Device")
          .replace(/ESP32-Device/g, "IoT-Device")
          .replace(/^\s*Startarchitektur aus Projekttemplate;.*$/gmi, "");
      }
      return numberGenericIotDeviceInstances(normalized).replace(/\n{3,}/g, "\n\n").trim();
    }

    function numberGenericIotDeviceInstances(source) {
      const text = String(source || "");
      const usedNumbers = new Set(Array.from(text.matchAll(/\bIoT[- ]Device\s+(\d+)\b/gi), (match) => Number(match[1])));
      let nextNumber = 1;
      return text.replace(/(\brectangle\s+")IoT[- ]Device(")/gi, (_match, prefix, suffix) => {
        while (usedNumbers.has(nextNumber)) nextNumber += 1;
        const instanceNumber = nextNumber;
        usedNumbers.add(instanceNumber);
        nextNumber += 1;
        return `${prefix}IoT-Device ${instanceNumber}${suffix}`;
      });
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
          state.developmentPlatform.chat = [];
          state.developmentPlatform.lastRouting = null;
          state.developmentPlatform.assistantMode = "architecture_structure";
          state.developmentPlatform.architectureDiagram = architectureDiagramForProject(response.project);
          storeActiveProjectId(response.project.id);
          if (selectedTemplateId !== "empty") {
            const architectureView = (response.project.viewManifest?.views || []).find((view) => view.id === "architecture-diagram");
            const source = architectureView?.payload?.source || "";
            if (source) {
              state.developmentPlatform.architectureDiagram = sanitizeArchitectureDiagram({
                source,
                title: architectureView.title || "Architektur-Skizze",
                summary: architectureView.summary || "Startarchitektur aus Projekttemplate.",
                derived_from: architectureView.payload?.derived_from || "project_template",
              });
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
      renderRequirementsText();
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
          state.developmentPlatform.architectureDiagram = sanitizeArchitectureDiagram(response.architectureDiagram);
        }
        state.developmentPlatform.lastRouting = response.routing || null;
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: response.message?.content || "Keine Antwort erhalten.",
          usage: response.usage || null,
          routing: response.routing || null,
        });
        await persistDevelopmentDialog();
      } catch (error) {
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: `Ich konnte den Architektur-Assistenten nicht erreichen: ${error.message}`,
        });
        state.developmentPlatform.architectureDiagram = null;
        await persistDevelopmentDialog();
      } finally {
        submit.disabled = false;
        if (input) input.value = "";
        render();
      }
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
      if (!target) return;
      target.textContent = text;
      target.classList.toggle("hidden", !text);
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
      document.querySelector("#acceptDevelopmentArchitectureButton").disabled = !canContinue;
      document.querySelector("#developmentChatInput").placeholder = hasProject
        ? state.developmentPlatform.assistantMode === "function_clarification"
          ? "Beschreibe eine Funktion, z. B. Temperatur wird gemessen."
          : state.developmentPlatform.assistantMode === "effect_chain_derivation"
            ? "Beschreibe eine Wirkkette, z. B. Timer misst Temperatur und Server speichert."
          : "Beschreibe Ziel und Funktion deines Projekts."
        : "Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.";
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
      const project = currentProject();
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
        if (continueToIde) {
          if (!response.project?.id) {
            throw new Error("Interner Fehler: gespeichertes Projekt ohne ID.");
          }
          setActionStatus("Architektur gespeichert. Hardware-Zuordnung wird geoeffnet...");
          navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(response.project.id)}`);
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

    function developmentProcessorBoardStepState(project, diagram) {
      if (!project || !diagram?.source || !projectNeedsProcessorBoardStep(project, diagram)) {
        return { required: false, blocking: false, allocated: null, compatible: [], suggestions: [] };
      }
      const compatible = compatibleInventoryDevices(project);
      const allocated = allocatedDevelopmentDevice(project);
      const suggestions = suggestedProcessorBoards(project, diagram);
      return {
        required: true,
        blocking: !allocated,
        allocated,
        compatible,
        suggestions,
        reason: compatible.length
          ? "Bitte klaere das IoT-Device und ordne dem Projekt ein passendes Inventar-Device zu."
          : "Bitte lege zuerst ein passendes IoT-Device im Inventar an und ordne es danach diesem Projekt zu.",
      };
    }

    function projectNeedsProcessorBoardStep(project, diagram) {
      const text = [
        project?.name,
        project?.description,
        diagram?.title,
        diagram?.summary,
        diagram?.source,
        ...(diagram?.detected_blocks || []),
      ].join("\n").toLowerCase();
      return /\b(esp32|esp8266|esp[- ]?wroom|arduino|nano|avr|atmega|raspberry|raspberrie|processor|prozessor|board|iot device|device|sensor|sensoren|messwert|messwerte|messung|eingang|eingänge|eingangssignal|aktor|aktoren|relais|pumpe|motor|ausgang)\b/.test(text);
    }

    function suggestedProcessorBoards(project, diagram) {
      const text = [
        project?.name,
        project?.description,
        diagram?.title,
        diagram?.summary,
        diagram?.source,
        ...(diagram?.detected_blocks || []),
      ].join("\n").toLowerCase();
      const boards = availableProcessorBoards();
      const familyOrder = [];
      const addFamily = (family) => {
        if (!familyOrder.includes(family)) familyOrder.push(family);
      };
      if (/raspberry|raspberrie|linux|sbc|kamera|hdmi|container|server/.test(text)) addFamily("raspberry_pi");
      if (/esp32|esp[- ]?wroom|ota|mqtt|webserver|wlan|wifi|internet|browser|datenlogger/.test(text)) addFamily("esp32");
      if (/esp8266|d1 mini|esp-12/.test(text)) addFamily("esp8266");
      if (/arduino|nano|avr|atmega|einfach|lokal|gpio|taster|relais/.test(text)) addFamily("avr_8bit");
      ["esp32", "esp8266", "avr_8bit", "raspberry_pi"].forEach(addFamily);
      return familyOrder.flatMap((family) => boards
        .filter((board) => processorBoardFamily(board) === family)
        .slice(0, 2)
        .map((board) => ({
          family,
          id: board.hardware_item_id || board.hardware_profile_id || board.title,
          label: processorBoardLabel(board),
        })))
        .slice(0, 6);
    }

    function availableProcessorBoards() {
      if (Array.isArray(state.processorBoards) && state.processorBoards.length) return state.processorBoards;
      return typeof fallbackProcessorBoards === "function" ? fallbackProcessorBoards() : [];
    }

    function processorBoardFamily(board) {
      if (typeof DeviceOnboardingModel !== "undefined" && DeviceOnboardingModel.boardFamily) {
        return DeviceOnboardingModel.boardFamily(board);
      }
      return String(board?.processor_family || "other").toLowerCase();
    }

    function processorBoardLabel(board) {
      if (typeof DeviceOnboardingModel !== "undefined" && DeviceOnboardingModel.boardLabel) {
        return DeviceOnboardingModel.boardLabel(board);
      }
      return board?.title || board?.hardware_item_id || board?.hardware_profile_id || "IoT-Device";
    }

    function processorLabel(processor) {
      const familyLabels = {
        esp32: "ESP32",
        esp8266: "ESP8266",
        avr_8bit: "AVR 8-bit",
        raspberry_pi: "Raspberry Pi",
      };
      const family = familyLabels[processor.family] || processor.family;
      return processor.variant.toLowerCase() === String(family).toLowerCase()
        ? processor.variant
        : `${processor.variant} (${family})`;
    }

    function compatibleInventoryDevices(project) {
      const projectPlatform = String(project?.buildConfig?.platform || "").toLowerCase();
      return (state.devices || []).filter((device) => {
        const devicePlatform = String(device?.build_config?.platform || "").toLowerCase();
        if (projectPlatform && devicePlatform) return projectPlatform === devicePlatform;
        const profile = String(device?.hardware_profile_id || "").toLowerCase();
        const runtime = String(project?.targetRuntime || project?.buildConfig?.board || "").toLowerCase();
        return !runtime || /esp|processor|board|architecture\.discovery/.test(runtime) || profile.includes("esp");
      });
    }

    function developmentComponentPath(project) {
      return String(project?.buildConfig?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "Komponenten/IoT-Device 1";
    }

    function allocatedDevelopmentDevice(project) {
      const allocations = Array.isArray(project?.buildConfig?.component_device_allocations)
        ? project.buildConfig.component_device_allocations
        : [];
      const componentPath = developmentComponentPath(project);
      const allocatedId = allocations.find((item) => item.component_path === componentPath)?.device_id
        || project?.linkedDeviceId
        || "";
      return (state.devices || []).find((device) => device.device_id === allocatedId) || null;
    }

    function renderHardwareAllocation() {
      const target = document.querySelector("#developmentHardwareAllocation");
      if (!target) return;
      const project = currentProject();
      const allocation = developmentProcessorBoardStepState(project, state.developmentPlatform.architectureDiagram);
      target.classList.toggle("hidden", !allocation.required);
      if (!allocation.required) {
        target.innerHTML = "";
        return;
      }
      if (allocation.allocated) {
        target.innerHTML = `
          <div>
            <span>IoT-Device-Zuordnung</span>
            <strong>${escapeHtml(allocation.allocated.display_name || allocation.allocated.device_id)}</strong>
            <small>IoT-Device ist dem Projekt zugeordnet. Device-Eigenschaften und Pins koennen im naechsten Schritt genauer geklaert werden.</small>
          </div>
        `;
        return;
      }
      target.innerHTML = `
        <div>
          <span>Naechster Zwischenschritt</span>
          <strong>IoT-Device festlegen</strong>
          <small>${escapeHtml(allocation.reason)}</small>
        </div>
        ${allocation.suggestions.length ? `
          <div class="processor-board-suggestions">
            <span>Vorschlaege aus den Eigenschaften</span>
            ${allocation.suggestions.map((board) => `<small>${escapeHtml(board.label)}</small>`).join("")}
          </div>
        ` : ""}
        ${allocation.compatible.length ? `
          <label>Inventar-Device
            <select id="developmentAllocationDevice">
              <option value="">Device waehlen</option>
              ${allocation.compatible.map((device) => `<option value="${escapeAttribute(device.device_id)}">${escapeHtml(device.display_name || device.device_id)}${device.build_target_label ? ` · ${escapeHtml(device.build_target_label)}` : ""}</option>`).join("")}
            </select>
          </label>
          <button type="button" data-development-allocate-board>Zuordnen</button>
          <small data-development-allocation-status></small>
        ` : `
          <a class="button-link" href="/app/device-management/inventory/">Inventar oeffnen</a>
        `}
      `;
    }

    async function handleHardwareAllocationClick(event) {
      if (!event.target.matches("[data-development-allocate-board]")) return;
      const project = currentProject();
      const select = document.querySelector("#developmentAllocationDevice");
      const status = document.querySelector("[data-development-allocation-status]");
      const deviceId = select?.value || "";
      if (!project || !deviceId) {
        if (status) status.textContent = "Bitte zuerst ein Inventar-Device waehlen.";
        return;
      }
      event.target.disabled = true;
      if (status) status.textContent = "Zuordnung wird gespeichert...";
      try {
        const response = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/device-allocation`, {
          component_path: developmentComponentPath(project),
          device_id: deviceId,
        });
        if (response.project) {
          state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
        }
        render();
        setActionStatus("Board-Zuordnung gespeichert. Du kannst jetzt uebernehmen und weiter.");
      } catch (error) {
        if (status) status.textContent = error.message;
        event.target.disabled = false;
      }
    }

    function renderHardwareConfiguration() {
      const project = currentProject();
      const projectName = document.querySelector("#developmentHardwareProjectName");
      if (projectName) projectName.textContent = project?.name || "Kein Projekt geoeffnet";
      if (!project) {
        document.querySelector("#developmentHardwareComponents").innerHTML = `<p class="empty">Bitte zuerst ein Entwicklungsprojekt oeffnen.</p>`;
        return;
      }
      const diagram = architectureDiagramForProject(project) || state.developmentPlatform.architectureDiagram;
      state.developmentPlatform.architectureDiagram = diagram;
      renderPlantUmlInto(document.querySelector("#developmentHardwareArchitecture"), diagram);
      void renderPersistedHardwareArchitecture(project);
      const configuration = reconcileHardwareConfiguration(projectHardwareConfiguration(project), diagram?.source || "", project);
      state.developmentPlatform.hardwareConfiguration = configuration;
      renderHardwareComponentTable(configuration);
      syncHardwareActions(configuration);
    }

    async function renderPersistedHardwareArchitecture(project) {
      if (!projectHardwareConfiguration(project)) return;
      try {
        const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent("Architektur/verdrahtung/hardware.puml")}`);
        if (currentProject()?.id !== project.id) return;
        if (source?.content) {
          renderPlantUmlInto(document.querySelector("#developmentHardwareArchitecture"), {
            source: source.content,
            title: "Hardware-Architektur",
            summary: "Vollstaendige Hardware-Realisierung des Projekts.",
          });
        }
      } catch (error) {
        if (currentProject()?.id !== project.id) return;
        document.querySelector("#developmentHardwareArchitecture").innerHTML = `<p class="error">Hardware-Architektur konnte nicht geladen werden: ${escapeHtml(error.message)}</p>`;
      }
    }

    function renderPlantUmlInto(target, diagram) {
      if (!target) return;
      if (!diagram?.source) {
        target.innerHTML = `<p class="helper-text">Noch keine statische Architektur vorhanden.</p>`;
        return;
      }
      target.innerHTML = `
        <figure class="plantuml-viewer">
          <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(diagram.source)}" alt="${escapeAttribute(diagram.title || "Architekturdiagramm")}">
          <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
        </figure>
      `;
      target.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
    }

    function projectHardwareConfiguration(project) {
      const view = (project?.viewManifest?.views || []).find((item) => item.id === "hardware-configuration");
      return view?.payload && typeof view.payload === "object" ? view.payload : null;
    }

    function reconcileHardwareConfiguration(persisted, source, project = null) {
      const previous = new Map((persisted?.components || []).map((component) => [component.component_id, component]));
      const legacyAllocations = Array.isArray(project?.buildConfig?.component_device_allocations)
        ? project.buildConfig.component_device_allocations
        : [];
      const boards = availableProcessorBoards();
      let deviceIndex = 0;
      const components = abstractArchitectureComponents(source).map((component) => {
        const merged = {
          ...component,
          ...(previous.get(component.component_id) || {}),
          label: component.label,
          abstract_type: component.abstract_type,
        };
        if (merged.abstract_type === "iot_device") {
          if (!merged.inventory_device_id) merged.inventory_device_id = legacyAllocations[deviceIndex]?.device_id || "";
          deviceIndex += 1;
          const processorKey = DevelopmentHardwareModel.selectionForComponent(merged, boards);
          return DevelopmentHardwareModel.applyProcessorSelection(merged, processorKey, boards);
        }
        if (merged.abstract_type === "sensor") return DevelopmentHardwareModel.reconcileSensor(merged, availableSensors());
        return merged;
      });
      return {
        schema_version: 4,
        components,
        updated_at: persisted?.updated_at || "",
      };
    }

    function abstractArchitectureComponents(source) {
      const components = [];
      String(source || "").split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*(actor|node|component|rectangle|database|cloud|queue|artifact)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
        if (!match) return;
        const label = match[2].replace(/\\n/g, " ").trim();
        components.push({
          component_id: match[3],
          label,
          plantuml_type: match[1].toLowerCase(),
          abstract_type: hardwareComponentType(label, match[1]),
          concrete_type: "",
          sensor_category: "",
          signal_type: "",
          processor_family: "",
          processor_variant: "",
          board_profile_id: "",
          inventory_device_id: "",
          target_device_id: "",
          pin: "",
          secondary_pin: "",
          properties: {},
          circuit: null,
        });
      });
      return components;
    }

    function hardwareComponentType(label, plantUmlType) {
      const text = String(label || "").toLowerCase();
      if (/iot.?device|esp32|esp8266|arduino|raspberry|processor.?board|datenlogger/.test(text)) return "iot_device";
      if (/sensor|fuehler|fuhler|temperatur|feuchte|helligkeit|wasserstand|ntc|ptc|pt1000/.test(text)) return "sensor";
      if (/aktor|motor|relais|ventil|servo|summer|buzzer|led/.test(text)) return "actuator";
      if (String(plantUmlType).toLowerCase() === "actor") return "actor";
      return "structural";
    }

    function renderHardwareComponentTable(configuration) {
      const target = document.querySelector("#developmentHardwareComponents");
      if (!target) return;
      const devices = configuration.components.filter((component) => component.abstract_type === "iot_device");
      target.innerHTML = configuration.components.map((component) => hardwareComponentRow(component, devices)).join("");
    }

    function hardwareComponentRow(component, devices) {
      const typeLabel = ({ iot_device: "IoT-Device", sensor: "Sensor/in", actuator: "Aktor/out", actor: "Akteur", structural: "Strukturelement" })[component.abstract_type] || component.abstract_type;
      if (component.abstract_type === "sensor") {
        return `
          <div class="hardware-table-row hardware-sensor-row" role="row" data-hardware-component="${escapeAttribute(component.component_id)}">
            <div class="hardware-component-identity"><strong>${escapeHtml(component.label)}</strong><small>${escapeHtml(typeLabel)}</small></div>
            <div class="hardware-inline-assignment">
              ${sensorRealizationControls(component)}
              ${hardwarePropertyControls(component)}
              ${hardwareConnectionControls(component, devices)}
            </div>
          </div>
        `;
      }
      return `
        <div class="hardware-table-row" role="row" data-hardware-component="${escapeAttribute(component.component_id)}">
          <div><strong>${escapeHtml(component.label)}</strong><small>${escapeHtml(typeLabel)}</small></div>
          <div>${hardwareRealizationControl(component)}</div>
          <div>${hardwarePropertyControls(component)}</div>
          <div>${hardwareConnectionControls(component, devices)}</div>
        </div>
      `;
    }

    function hardwareRealizationControl(component) {
      if (component.abstract_type === "iot_device") {
        const boards = availableProcessorBoards();
        const processorKey = DevelopmentHardwareModel.selectionForComponent(component, boards);
        const compatibleBoards = DevelopmentHardwareModel.boardsForProcessor(boards, processorKey);
        return `<div class="hardware-board-selection">
          <label>Prozessor<select data-hardware-processor>
            <option value="">Prozessor waehlen</option>
            ${DevelopmentHardwareModel.processorOptions(boards).map((processor) => `<option value="${escapeAttribute(processor.key)}" ${selected(processorKey, processor.key)}>${escapeHtml(processorLabel(processor))}</option>`).join("")}
          </select></label>
          <label>Board<select data-hardware-field="board_profile_id" ${processorKey ? "" : "disabled"}>
            <option value="">${processorKey ? "Board waehlen" : "Zuerst Prozessor waehlen"}</option>
            ${compatibleBoards.map((board) => `<option value="${escapeAttribute(DevelopmentHardwareModel.boardIdentifier(board))}" ${selected(component.board_profile_id, DevelopmentHardwareModel.boardIdentifier(board))}>${escapeHtml(processorBoardLabel(board))}</option>`).join("")}
          </select></label>
        </div>`;
      }
      if (component.abstract_type === "sensor") return sensorRealizationControls(component);
      if (component.abstract_type === "actuator") return hardwareTypeSelect(component, actuatorTypes());
      return `<span class="hardware-not-applicable">Keine Hardware-Zuordnung</span>`;
    }

    function hardwareTypeSelect(component, options) {
      return `<label>Konkreter Typ<select data-hardware-field="concrete_type">
        <option value="">Typ waehlen</option>
        ${options.map((option) => `<option value="${escapeAttribute(option.id)}" ${selected(component.concrete_type, option.id)}>${escapeHtml(option.label)}</option>`).join("")}
      </select></label>`;
    }

    function sensorRealizationControls(component) {
      const sensors = availableSensors();
      const catalogStatus = state.sensorCatalogStatus || { state: "idle", message: "" };
      const catalogUnavailable = catalogStatus.state === "error";
      const catalogLoading = catalogStatus.state === "loading" || catalogStatus.state === "idle";
      const categories = DevelopmentHardwareModel.sensorCategoryOptions(sensors);
      const signalTypes = DevelopmentHardwareModel.signalTypeOptions(sensors, component.sensor_category);
      const concreteSensors = DevelopmentHardwareModel.sensorTypesFor(sensors, component.sensor_category, component.signal_type);
      return `<div class="hardware-sensor-selection">
        <label>Sensorart<select data-hardware-sensor-category ${catalogUnavailable || catalogLoading ? "disabled" : ""}>
          <option value="">${catalogUnavailable ? "Hardware Catalog nicht erreichbar" : catalogLoading ? "Sensorarten werden geladen" : categories.length ? "Sensorart waehlen" : "Keine Sensorarten vorhanden"}</option>
          ${categories.map((category) => `<option value="${escapeAttribute(category.id)}" ${selected(component.sensor_category, category.id)}>${escapeHtml(category.label)}</option>`).join("")}
        </select>${catalogStatus.message ? `<small class="hardware-catalog-hint ${catalogUnavailable ? "is-error" : ""}">${escapeHtml(catalogStatus.message)}</small>` : ""}</label>
        <label>Erfassung<select data-hardware-signal-type ${component.sensor_category ? "" : "disabled"}>
          <option value="">${component.sensor_category ? "Erfassung waehlen" : "Zuerst Sensorart waehlen"}</option>
          ${signalTypes.map((signal) => `<option value="${escapeAttribute(signal.id)}" ${selected(component.signal_type, signal.id)}>${escapeHtml(signal.label)}</option>`).join("")}
        </select></label>
        <label>Konkreter Sensor<select data-hardware-field="concrete_type" ${component.signal_type ? "" : "disabled"}>
          <option value="">${component.signal_type ? "Sensor waehlen" : "Zuerst Erfassung waehlen"}</option>
          ${concreteSensors.map((sensor) => `<option value="${escapeAttribute(sensor.sensor_type_id)}" ${selected(component.concrete_type, sensor.sensor_type_id)}>${escapeHtml(sensor.title)}</option>`).join("")}
        </select></label>
      </div>`;
    }

    function availableSensors() {
      return Array.isArray(state.sensorCatalog) ? state.sensorCatalog : [];
    }

    function actuatorTypes() {
      return [
        { id: "dc_motor", label: "DC-Motor" },
        { id: "relay", label: "Relais" },
        { id: "servo", label: "Servo" },
        { id: "led", label: "LED" },
        { id: "buzzer", label: "Summer" },
      ];
    }

    function hardwarePropertyControls(component) {
      const properties = component.properties || {};
      if (component.abstract_type === "iot_device") {
        const inventoryDevices = compatibleInventoryDevices(component);
        return `<label>Inventar-Device (optional)<select data-hardware-field="inventory_device_id" ${component.board_profile_id ? "" : "disabled"}>
          <option value="">${component.board_profile_id ? "Kein Device zuordnen" : "Zuerst Board waehlen"}</option>
          ${inventoryDevices.map((device) => `<option value="${escapeAttribute(device.device_id)}" ${selected(component.inventory_device_id, device.device_id)}>${escapeHtml(device.display_name || device.device_id)}</option>`).join("")}
        </select><small>Ohne Inventar-Device kann kein Flash-Vorgang gestartet werden.</small></label>`;
      }
      if (component.concrete_type === "pt1000") return `
        <label>R0<input data-hardware-property="nominal_resistance_ohm" type="number" min="100" value="${escapeAttribute(properties.nominal_resistance_ohm || 1000)}"><small>Ohm bei 0 Grad C</small></label>
        <label>Leiter<select data-hardware-property="wire_count">${[2, 3, 4].map((count) => `<option value="${count}" ${selected(properties.wire_count || 2, count)}>${count}-Leiter</option>`).join("")}</select></label>`;
      if (["ntc", "ptc"].includes(component.concrete_type)) return `
        <label>Nennwiderstand<input data-hardware-property="nominal_resistance_ohm" type="number" min="100" value="${escapeAttribute(properties.nominal_resistance_ohm || 10000)}"><small>Ohm</small></label>`;
      if (component.concrete_type === "dc_motor") return `
        <label>Nennspannung<input data-hardware-property="nominal_voltage_v" type="number" min="1" step="0.1" value="${escapeAttribute(properties.nominal_voltage_v || 5)}"><small>Volt</small></label>
        <label>Maximalstrom<input data-hardware-property="max_current_a" type="number" min="0.01" step="0.01" value="${escapeAttribute(properties.max_current_a || 0.5)}"><small>Ampere</small></label>`;
      if (component.abstract_type === "sensor") return "";
      if (component.abstract_type === "actuator") return `<label>Beschreibung<input data-hardware-property="description" value="${escapeAttribute(properties.description || "")}" placeholder="Bauart oder wichtige Kenndaten"></label>`;
      return `<span class="hardware-not-applicable">-</span>`;
    }

    function compatibleInventoryDevices(component) {
      if (!component.board_profile_id) return [];
      return (Array.isArray(state.devices) ? state.devices : []).filter((device) => (
        String(device.hardware_profile_id || "") === String(component.board_profile_id)
      ));
    }

    function hardwareConnectionControls(component, devices) {
      if (!["sensor", "actuator"].includes(component.abstract_type)) return `<span class="hardware-not-applicable">-</span>`;
      const targetDevice = devices.find((device) => device.component_id === component.target_device_id) || devices[0];
      const pinOptions = boardPins(targetDevice?.board_profile_id, component);
      return `
        <label>IoT-Device<select data-hardware-field="target_device_id">
          <option value="">Device waehlen</option>
          ${devices.map((device) => `<option value="${escapeAttribute(device.component_id)}" ${selected(component.target_device_id || (devices.length === 1 ? devices[0].component_id : ""), device.component_id)}>${escapeHtml(device.label)}</option>`).join("")}
        </select></label>
        <label>${pinLabel(component)}<select data-hardware-field="pin">
          <option value="">Pin waehlen</option>
          ${pinOptions.map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(component.pin, pin)}>${escapeHtml(pin)}</option>`).join("")}
        </select></label>
        ${component.concrete_type === "dc_motor" ? `<label>Richtungspin<select data-hardware-field="secondary_pin"><option value="">Pin waehlen</option>${boardPins(targetDevice?.board_profile_id, "digital_output").map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(component.secondary_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>` : ""}
        ${component.signal_type === "incremental_ab" ? `<label>Kanal B<select data-hardware-field="secondary_pin"><option value="">Pin waehlen</option>${pinOptions.filter((pin) => pin !== component.pin || pin === component.secondary_pin).map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(component.secondary_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>` : ""}
      `;
    }

    function selected(left, right) {
      return String(left ?? "") === String(right ?? "") ? "selected" : "";
    }

    function pinLabel(component) {
      const type = typeof component === "object" ? component.concrete_type : component;
      const signalType = typeof component === "object" ? component.signal_type : "";
      if (signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(type)) return "Analogeingang";
      if (signalType === "i2c" || type === "i2c_sensor") return "I2C-Anschluss";
      if (signalType === "spi") return "SPI-Anschluss";
      if (signalType === "one_wire") return "1-Wire-Pin";
      if (signalType === "uart") return "UART-Anschluss";
      if (signalType === "pulse_counter") return "Zaehleingang";
      if (signalType === "incremental_ab") return "Kanal A";
      if (type === "dc_motor") return "PWM-Pin";
      return "GPIO-Pin";
    }

    function boardPins(boardId, componentOrType) {
      const id = String(boardId || "").toLowerCase();
      if (!id) return [];
      const concreteType = typeof componentOrType === "object" ? componentOrType.concrete_type : componentOrType;
      const signalType = typeof componentOrType === "object" ? componentOrType.signal_type : "";
      const board = availableProcessorBoards().find((item) => String(item.hardware_item_id || item.hardware_profile_id || "").toLowerCase() === id);
      const profile = board?.pin_profile || {};
      if ((signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(concreteType)) && Array.isArray(profile.analog_inputs)) return profile.analog_inputs;
      if ((signalType === "i2c" || concreteType === "i2c_sensor") && Array.isArray(profile.i2c)) return profile.i2c;
      if (concreteType === "dc_motor" && Array.isArray(profile.pwm_pins)) return profile.pwm_pins;
      if (Array.isArray(profile.digital_pins) && profile.digital_pins.length) return profile.digital_pins;
      const analog = id.includes("arduino_nano_r3") ? ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"]
        : id.includes("esp8266") || id.includes("d1_mini") ? ["A0"]
          : id.includes("raspberry") ? []
            : ["GPIO32 / ADC1_CH4", "GPIO33 / ADC1_CH5", "GPIO34 / ADC1_CH6", "GPIO35 / ADC1_CH7", "GPIO36 / ADC1_CH0", "GPIO39 / ADC1_CH3"];
      const digital = id.includes("arduino_nano_r3") ? ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"]
        : id.includes("esp8266") || id.includes("d1_mini") ? ["D1 / GPIO5", "D2 / GPIO4", "D5 / GPIO14", "D6 / GPIO12", "D7 / GPIO13"]
          : id.includes("raspberry") ? ["GPIO17", "GPIO18", "GPIO22", "GPIO23", "GPIO24", "GPIO25", "GPIO27"]
            : ["GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO16", "GPIO17", "GPIO18", "GPIO19", "GPIO21", "GPIO22", "GPIO23", "GPIO25", "GPIO26", "GPIO27"];
      if (signalType === "analog" || ["pt1000", "ntc", "ptc", "analog_sensor"].includes(concreteType)) return analog;
      if (signalType === "i2c" || concreteType === "i2c_sensor") return id.includes("arduino_nano_r3") ? ["SDA A4 + SCL A5"] : id.includes("raspberry") ? ["SDA GPIO2 + SCL GPIO3"] : ["SDA GPIO21 + SCL GPIO22"];
      if (concreteType === "dc_motor") return digital.filter((pin) => /D3|D5|D6|D9|D10|D11|GPIO4|GPIO5|GPIO12|GPIO13|GPIO14|GPIO18|GPIO19|GPIO23|GPIO25|GPIO26|GPIO27/.test(pin));
      return digital;
    }

    function handleHardwareConfigurationChange() {
      state.developmentPlatform.hardwareConfiguration = collectHardwareConfiguration();
      renderHardwareComponentTable(state.developmentPlatform.hardwareConfiguration);
      syncHardwareActions(state.developmentPlatform.hardwareConfiguration);
    }

    function collectHardwareConfiguration() {
      const current = state.developmentPlatform.hardwareConfiguration || { schema_version: 4, components: [] };
      const boards = availableProcessorBoards();
      const components = current.components.map((component) => {
        const row = document.querySelector(`[data-hardware-component="${CSS.escape(component.component_id)}"]`);
        if (!row) return component;
        const next = { ...component, properties: { ...(component.properties || {}) } };
        row.querySelectorAll("[data-hardware-field]").forEach((input) => { next[input.dataset.hardwareField] = input.value; });
        const processorInput = row.querySelector("[data-hardware-processor]");
        const processorSelection = processorInput
          ? DevelopmentHardwareModel.applyProcessorSelection(next, processorInput.value, boards)
          : next;
        Object.assign(next, processorSelection);
        if (next.inventory_device_id && !compatibleInventoryDevices(next).some((device) => device.device_id === next.inventory_device_id)) {
          next.inventory_device_id = "";
        }
        const sensorCategoryInput = row.querySelector("[data-hardware-sensor-category]");
        const signalTypeInput = row.querySelector("[data-hardware-signal-type]");
        if (sensorCategoryInput) {
          const categorySelection = DevelopmentHardwareModel.applySensorCategory(next, sensorCategoryInput.value, availableSensors());
          const signalSelection = DevelopmentHardwareModel.applySignalType(categorySelection, signalTypeInput?.value || "", availableSensors());
          Object.assign(next, signalSelection);
        }
        row.querySelectorAll("[data-hardware-property]").forEach((input) => { next.properties[input.dataset.hardwareProperty] = input.value; });
        if (next.abstract_type === "sensor") delete next.properties.description;
        if (!next.target_device_id) {
          const devices = current.components.filter((item) => item.abstract_type === "iot_device");
          if (devices.length === 1) next.target_device_id = devices[0].component_id;
        }
        next.circuit = circuitFor(next);
        return next;
      });
      return { schema_version: 4, components, updated_at: current.updated_at || "" };
    }

    function circuitFor(component) {
      if (component.concrete_type === "pt1000") return { type: "pt1000_measurement", label: "PT1000-Messschaltung", stages: ["PT1000", "Konstantstromquelle / Messbruecke", "Messverstaerker", "ADC"] };
      if (["ntc", "ptc"].includes(component.concrete_type)) return { type: "resistive_divider", label: "Widerstands-Messschaltung", stages: [component.concrete_type.toUpperCase(), "Spannungsteiler", "ADC"] };
      if (component.concrete_type === "dc_motor") return { type: "motor_driver", label: "Motor-Treiberstufe", stages: ["PWM / Richtung", "Motortreiber / H-Bruecke", "DC-Motor"] };
      return null;
    }

    function hardwareConfigurationValidation(configuration) {
      const missing = [];
      configuration.components.forEach((component) => {
        if (component.abstract_type === "iot_device" && (!component.processor_family || !component.processor_variant)) missing.push(`${component.label}: Prozessor`);
        if (component.abstract_type === "iot_device" && !component.board_profile_id) missing.push(`${component.label}: reales Board`);
        if (component.abstract_type === "sensor") {
          if (!component.sensor_category) missing.push(`${component.label}: Sensorart`);
          if (!component.signal_type) missing.push(`${component.label}: Erfassung`);
        }
        if (["sensor", "actuator"].includes(component.abstract_type)) {
          if (!component.concrete_type) missing.push(`${component.label}: konkreter Typ`);
          if (!component.target_device_id) missing.push(`${component.label}: IoT-Device`);
          if (!component.pin) missing.push(`${component.label}: Pin`);
          if (component.concrete_type === "dc_motor" && !component.secondary_pin) missing.push(`${component.label}: Richtungspin`);
          if (component.signal_type === "incremental_ab" && !component.secondary_pin) missing.push(`${component.label}: Kanal B`);
          if (component.signal_type === "incremental_ab" && component.pin && component.secondary_pin === component.pin) missing.push(`${component.label}: Kanal A und B muessen verschieden sein`);
        }
      });
      return { complete: missing.length === 0, missing };
    }

    function syncHardwareActions(configuration) {
      const validation = hardwareConfigurationValidation(configuration);
      const continueButton = document.querySelector("#continueDevelopmentHardwareButton");
      if (continueButton) continueButton.disabled = !validation.complete;
      renderHardwareHints(configuration, validation);
      setHardwareStatus("");
    }

    function renderHardwareHints(configuration, validation = hardwareConfigurationValidation(configuration)) {
      const target = document.querySelector("#developmentHardwareHints");
      if (!target) return;
      const openItems = validation.missing.map((item) => `
        <li class="hardware-hint-item is-open">
          <strong>${escapeHtml(item)}</strong>
          <span class="hardware-recommended-action"><b>Empfohlene Maßnahme:</b> ${escapeHtml(recommendedHardwareAction(item))}</span>
        </li>
      `);
      const inventoryItems = configuration.components
        .filter((component) => component.abstract_type === "iot_device" && !component.inventory_device_id)
        .map((component) => `
          <li class="hardware-hint-item is-optional">
            <strong>${escapeHtml(component.label)}: Inventar-Device optional</strong>
            <span class="hardware-recommended-action"><b>Empfohlene Maßnahme:</b> Ordne das passende Inventar-Device vor dem ersten Flash-Vorgang zu. Die Zuordnung kann bis dahin nachgeholt werden.</span>
          </li>
        `);
      const completed = validation.complete
        ? '<li class="hardware-hint-item is-complete"><strong>Hardware-Zuordnung vollständig</strong><span class="hardware-recommended-action"><b>Empfohlene Maßnahme:</b> Prüfe die Zuordnung kurz und fahre anschließend mit „Weiter zur IDE“ fort.</span></li>'
        : "";
      const completedSection = completed ? `<ul class="hardware-hint-list">${completed}</ul>` : "";
      const openSection = openItems.length ? `
        <section class="hardware-hint-group">
          <h3>Offene Punkte</h3>
          <ul class="hardware-hint-list">${openItems.join("")}</ul>
        </section>
      ` : "";
      const optionalSection = inventoryItems.length ? `
        <section class="hardware-hint-group">
          <h3>Optional</h3>
          <ul class="hardware-hint-list">${inventoryItems.join("")}</ul>
        </section>
      ` : "";
      target.innerHTML = `${completedSection}${openSection}${optionalSection}`;
    }

    function recommendedHardwareAction(item) {
      const detail = String(item || "").split(":").slice(1).join(":").trim();
      if (/Kanal A und B/.test(detail)) return "Wähle für Kanal A und Kanal B unterschiedliche Pins.";
      if (/Richtungspin/.test(detail)) return "Wähle einen zweiten freien Pin für die Motor-Richtung.";
      if (/Kanal B/.test(detail)) return "Wähle einen zweiten freien Pin für Kanal B.";
      if (/Prozessor/.test(detail)) return "Wähle Prozessorfamilie und Prozessorvariante für dieses IoT-Device.";
      if (/reales Board/.test(detail)) return "Wähle ein zum Prozessor passendes reales Board aus dem Hardware-Katalog.";
      if (/Sensorart/.test(detail)) return "Wähle die Sensorart beziehungsweise Messgröße.";
      if (/Erfassung/.test(detail)) return "Wähle die passende Erfassungs- oder Signalart.";
      if (/konkreter Typ/.test(detail)) return "Wähle den konkreten Sensor- oder Aktortyp.";
      if (/IoT-Device/.test(detail)) return "Ordne den Sensor oder Aktor dem zuständigen IoT-Device zu.";
      if (/Pin/.test(detail)) return "Wähle einen geeigneten freien Pin am zugeordneten Board.";
      return "Ergänze die fehlende Hardware-Angabe in der zugehörigen Tabellenzeile.";
    }

    function setHardwareStatus(text) {
      const target = document.querySelector("#developmentHardwareStatus");
      if (target) target.textContent = text;
    }

    async function saveHardwareConfiguration(continueToIde) {
      const project = currentProject();
      if (!project) return;
      const configuration = collectHardwareConfiguration();
      const validation = hardwareConfigurationValidation(configuration);
      if (continueToIde && !validation.complete) {
        renderHardwareHints(configuration, validation);
        setHardwareStatus("Bitte klaere zuerst die offenen Punkte in der Hinweisbox.");
        return;
      }
      const saveButton = document.querySelector("#saveDevelopmentHardwareButton");
      const continueButton = document.querySelector("#continueDevelopmentHardwareButton");
      saveButton.disabled = true;
      continueButton.disabled = true;
      setHardwareStatus("Hardware-Konfiguration wird gespeichert...");
      try {
        const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(project.id)}/hardware-configuration`, { hardware_configuration: configuration });
        if (response.project) state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
        state.developmentPlatform.hardwareConfiguration = response.hardware_configuration || configuration;
        if (response.hardware_architecture?.source) {
          renderPlantUmlInto(document.querySelector("#developmentHardwareArchitecture"), response.hardware_architecture);
        }
        if (continueToIde) {
          setHardwareStatus("Hardware gespeichert. IDE wird geoeffnet...");
          await openProjectInIde(response.project.id);
          return;
        }
        renderHardwareConfiguration();
        setHardwareStatus("Hardware-Konfiguration gespeichert.");
      } catch (error) {
        setHardwareStatus(`Hardware-Konfiguration konnte nicht gespeichert werden: ${error.message}`);
        saveButton.disabled = false;
        syncHardwareActions(configuration);
      }
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
          <p class="helper-text">Noch keine statische Architektur vorhanden.</p>
        `;
        return;
      }
      target.innerHTML = `
        <figure class="plantuml-viewer">
          <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(diagram.source)}" alt="${escapeAttribute(diagram.title || "Architekturdiagramm")}">
          <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
        </figure>
      `;
      target.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
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
      renderHardwareConfiguration,
      setAssistantConfig,
      setProjectTemplates,
    };
  }

  return { create };
})();
