const DevelopmentPlatform = (() => {
  const activeProjectStorageKey = "gernetix.developmentPlatform.activeProjectId";

  function create({ state, postJson, escapeHtml, escapeAttribute, meta }) {
    if (!state.developmentPlatform) {
      state.developmentPlatform = {
        assistant: null,
        chat: [],
        architectureDiagram: null,
        activeProjectId: "",
        projectPanelMode: "closed",
      };
    }
    if (!state.developmentPlatform.projectPanelMode) state.developmentPlatform.projectPanelMode = "closed";

    function init() {
      document.querySelector("#developmentChatForm").addEventListener("submit", sendChatMessage);
      document.querySelector("#clearDevelopmentChatButton").addEventListener("click", clearChat);
      document.querySelector("#openDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("open"));
      document.querySelector("#newDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new"));
      document.querySelector("#developmentProjectForm").addEventListener("submit", createDevelopmentProject);
      document.querySelector("#developmentProjectSelect").addEventListener("change", selectDevelopmentProject);
      document.querySelector("#saveDevelopmentArchitectureButton").addEventListener("click", saveArchitectureDiagram);
      document.querySelectorAll("[data-dev-prompt]").forEach((button) => {
        button.addEventListener("click", () => usePrompt(button.dataset.devPrompt));
      });
    }

    function setAssistantConfig(config) {
      state.developmentPlatform.assistant = config || null;
    }

    function render() {
      renderProjectPicker();
      renderAssistantConfig();
      renderChatMessages();
      renderArchitectureDiagram();
      syncChatAvailability();
    }

    function renderAssistantConfig() {
      const config = state.developmentPlatform.assistant || {};
      document.querySelector("#developmentAssistantConfig").innerHTML = [
        ["Status", config.enabled ? "aktiv" : "nicht konfiguriert"],
        ["Provider", providerLabel(config)],
        ["Endpoint", config.baseUrl || "http://127.0.0.1:11434"],
        ["Modell", config.model || "nicht gesetzt"],
        ["Datenquellen", (config.allowedSources || []).join(", ") || "nur Chat"],
      ].map(meta).join("");
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
        content: "Beschreibe kurz deine Projektidee. Ich frage dann gezielt nach Ziel, Zielsystemen, Geraeten, Daten, Bedienung, Speicherung und Zugriff, bevor wir Technologien festlegen.",
      }];
      document.querySelector("#developmentChatMessages").innerHTML = messages.map((message) => `
        <article class="chat-message ${escapeHtml(message.role)}">
          <span>${message.role === "user" ? "Du" : "Architektur-KI"}</span>
          <p>${escapeHtml(message.content)}</p>
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

    function usePrompt(prompt) {
      document.querySelector("#developmentChatInput").value = prompt || "";
      document.querySelector("#developmentChatInput").focus();
    }

    function clearChat() {
      state.developmentPlatform.chat = [];
      state.developmentPlatform.architectureDiagram = null;
      setChatStatus("Bereit fuer Architekturfragen.");
      renderChatMessages();
      renderArchitectureDiagram();
    }

    function renderProjectPicker() {
      const select = document.querySelector("#developmentProjectSelect");
      if (!select) return;
      const projects = developmentProjects();
      const storedProjectId = readStoredActiveProjectId();
      const storedProjectExists = projects.some((project) => project.id === storedProjectId);
      const current = activeProjectId() || (storedProjectExists ? storedProjectId : "") || projects[0]?.id || "";
      if (state.developmentPlatform.activeProjectId !== current) {
        state.developmentPlatform.activeProjectId = current;
        storeActiveProjectId(current);
      }
      const activeProject = currentProject();
      document.querySelector("#developmentProjectName").textContent = activeProject?.name || "Kein Projekt geoeffnet";
      document.querySelector("#developmentProjectOpenPanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "open");
      document.querySelector("#developmentProjectForm").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "new");
      select.innerHTML = [
        `<option value="">Projekt waehlen</option>`,
        ...projects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`),
      ].join("");
      select.value = state.developmentPlatform.activeProjectId || "";
      setProjectStatus(select.value
        ? `Aktiv: ${projects.find((project) => project.id === select.value)?.name || select.value}`
        : "Bitte Projekt oeffnen oder neu anlegen, bevor der Chat startet.");
    }

    function developmentProjects() {
      return (state.projects || []).filter((project) => project.type === "development_project" || project.type === "custom_project");
    }

    function activeProjectId() {
      return state.developmentPlatform.activeProjectId || "";
    }

    function showProjectPanel(mode) {
      state.developmentPlatform.projectPanelMode = state.developmentPlatform.projectPanelMode === mode ? "closed" : mode;
      renderProjectPicker();
      if (state.developmentPlatform.projectPanelMode === "new") {
        document.querySelector("#developmentProjectTitle").focus();
      } else if (state.developmentPlatform.projectPanelMode === "open") {
        document.querySelector("#developmentProjectSelect").focus();
      }
    }

    function selectDevelopmentProject() {
      state.developmentPlatform.activeProjectId = document.querySelector("#developmentProjectSelect").value;
      storeActiveProjectId(state.developmentPlatform.activeProjectId);
      state.developmentPlatform.projectPanelMode = "closed";
      state.developmentPlatform.chat = [];
      state.developmentPlatform.architectureDiagram = null;
      render();
    }

    async function createDevelopmentProject(event) {
      event.preventDefault();
      const titleInput = document.querySelector("#developmentProjectTitle");
      const descriptionInput = document.querySelector("#developmentProjectDescription");
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
        });
        if (response.project) {
          state.projects = state.projects.filter((project) => project.id !== response.project.id).concat(response.project);
          state.developmentPlatform.activeProjectId = response.project.id;
          storeActiveProjectId(response.project.id);
          state.developmentPlatform.projectPanelMode = "closed";
          titleInput.value = "";
          descriptionInput.value = "";
          setProjectStatus(`Projekt angelegt: ${response.project.name}`);
        }
        render();
      } catch (error) {
        setProjectStatus(`Projekt konnte nicht angelegt werden: ${error.message}`);
      }
    }

    async function sendChatMessage(event) {
      event.preventDefault();
      const input = document.querySelector("#developmentChatInput");
      const submit = document.querySelector("#developmentChatSubmit");
      const content = input.value.trim();
      if (!content) return;
      if (!activeProjectId()) {
        setProjectStatus("Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.");
        syncChatAvailability();
        return;
      }
      state.developmentPlatform.chat.push({ role: "user", content });
      input.value = "";
      submit.disabled = true;
      setChatStatus(`${providerLabel()} denkt...`);
      renderChatMessages();
      try {
        const response = await postJson("/api/platform/development-assistant/chat", {
          projectId: activeProjectId(),
          messages: state.developmentPlatform.chat,
        });
        setAssistantConfig(response.config || state.developmentPlatform.assistant);
        state.developmentPlatform.architectureDiagram = response.architectureDiagram || null;
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: response.message?.content || "Keine Antwort erhalten.",
          usage: response.usage || null,
        });
        setChatStatus(response.usedFallback
          ? `Fallback-Antwort: ${providerLabel(response.config)} nicht erreichbar oder nicht konfiguriert.`
          : `Antwort von ${providerLabel(response.config)} erhalten.`);
      } catch (error) {
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: `Ich konnte den Architektur-Assistenten nicht erreichen: ${error.message}`,
        });
        state.developmentPlatform.architectureDiagram = null;
        setChatStatus("Fehler beim LLM-Aufruf.");
      } finally {
        submit.disabled = false;
        render();
      }
    }

    function setChatStatus(text) {
      document.querySelector("#developmentChatStatus").textContent = text;
    }

    function setProjectStatus(text) {
      const target = document.querySelector("#developmentProjectStatus");
      if (target) target.textContent = text;
    }

    function syncChatAvailability() {
      const hasProject = Boolean(activeProjectId());
      document.querySelector("#developmentChatInput").disabled = !hasProject;
      document.querySelector("#developmentChatSubmit").disabled = !hasProject;
      document.querySelector("#saveDevelopmentArchitectureButton").disabled = !hasProject || !state.developmentPlatform.architectureDiagram?.source;
      document.querySelector("#developmentChatInput").placeholder = hasProject
        ? "Beschreibe kurz deine Projektidee oder antworte auf die Frage der KI."
        : "Bitte zuerst ein Entwicklungsprojekt oeffnen oder neu anlegen.";
    }

    async function saveArchitectureDiagram() {
      if (!activeProjectId() || !state.developmentPlatform.architectureDiagram?.source) return;
      setProjectStatus("Architektur wird gespeichert...");
      const project = currentProject();
      try {
        const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(activeProjectId())}/architecture`, {
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
        setProjectStatus(`Gespeichert${response.saved_at ? `: ${new Date(response.saved_at).toLocaleString("de-DE")}` : "."}`);
      } catch (error) {
        setProjectStatus(`Architektur konnte nicht gespeichert werden: ${error.message}`);
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
          </div>
          <span>${escapeHtml(confidenceLabel(diagram.confidence))}</span>
        </div>
        <figure class="plantuml-viewer">
          <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(diagram.source)}" alt="${escapeAttribute(diagram.title || "Architekturdiagramm")}">
          <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
        </figure>
        <pre class="plantuml-box architecture-source">${escapeHtml(diagram.source)}</pre>
      `;
      target.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
    }

    function confidenceLabel(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "Skizze";
      return `${Math.round(number * 100)}% Signal`;
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
