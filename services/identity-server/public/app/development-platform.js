const DevelopmentPlatform = (() => {
  const activeProjectStorageKey = "gernetix.developmentPlatform.activeProjectId";
  let projectTemplates = {};
  let projectTemplateCatalog = [];
  let projectTemplatePreviews = {};

  function create({ state, postJson, deleteJson, openProjectInIde, navigate, escapeHtml, escapeAttribute, openHelpTopic }) {
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
        homeAutomationConfiguration: null,
        gameConfiguration: null,
        assistantOpen: false,
        componentDraftType: "iot_device",
        workflowStep: "project_start",
      };
    }
    if (!state.developmentPlatform.projectPanelMode) state.developmentPlatform.projectPanelMode = "choice";
    if (!state.developmentPlatform.assistantMode) state.developmentPlatform.assistantMode = "architecture_structure";
    if (!state.developmentPlatform.workflowStep) state.developmentPlatform.workflowStep = "project_start";
    if (typeof state.developmentPlatform.assistantOpen !== "boolean") state.developmentPlatform.assistantOpen = false;
    if (!state.developmentPlatform.componentDraftType) state.developmentPlatform.componentDraftType = "iot_device";

    function init() {
      document.querySelector("#developmentChatForm").addEventListener("submit", sendChatMessage);
      document.querySelector("#continueDevelopmentProjectButton").addEventListener("click", continueLastProject);
      document.querySelector("#openDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("open"));
      document.querySelector("#manageDevelopmentProjectsButton").addEventListener("click", () => showProjectPanel("manage"));
      document.querySelector("#developmentProjectOverview").addEventListener("click", handleProjectOverviewClick);
      document.querySelector("#newEmptyDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-empty"));
      document.querySelector("#newTemplateDevelopmentProjectButton").addEventListener("click", () => showProjectPanel("new-template"));
      document.querySelector("#openDevelopmentTemplateHelpButton").addEventListener("click", openDevelopmentTemplateHelp);
      document.querySelector("#developmentTemplateHelpDialog").addEventListener("click", (event) => {
        if (event.target === event.currentTarget || event.target.closest("[data-close-development-template-help]")) event.currentTarget.close();
      });
      document.querySelector("#developmentProjectForm").addEventListener("submit", createDevelopmentProject);
      document.querySelector("#developmentProjectTemplate").addEventListener("change", applyProjectTemplate);
      document.querySelector("#developmentProjectSelect").addEventListener("change", updateDevelopmentProjectSelection);
      document.querySelector("#selectDevelopmentProjectButton").addEventListener("click", selectDevelopmentProject);
      document.querySelector("#continueDevelopmentConfigurationButton").addEventListener("click", continueToDevelopmentConfiguration);
      document.querySelector("#backToDevelopmentProjectStartButton").addEventListener("click", enterProjectStart);
      document.querySelector("#saveDevelopmentArchitectureButton").addEventListener("click", saveArchitectureDiagram);
      document.querySelector("#acceptDevelopmentArchitectureButton").addEventListener("click", acceptArchitectureAndContinue);
      document.querySelector("#toggleDevelopmentAssistantButton").addEventListener("click", toggleDevelopmentAssistant);
      document.querySelector("#templateComponentConfiguration").addEventListener("click", handleTemplateComponentConfigurationClick);
      document.querySelector("#templateComponentConfiguration").addEventListener("change", handleTemplateComponentConfigurationChange);
      document.querySelector("#developmentHardwareForm").addEventListener("change", handleHardwareConfigurationChange);
      document.querySelector("#developmentHardwareForm").addEventListener("click", handleHardwareHelpClick);
      document.querySelector("#backToDevelopmentArchitectureButton").addEventListener("click", () => navigate("/app/development-platform/"));
      document.querySelector("#saveDevelopmentHardwareButton").addEventListener("click", () => saveHardwareConfiguration(false));
      document.querySelector("#continueDevelopmentHardwareButton").addEventListener("click", () => saveHardwareConfiguration(true));
      document.querySelector("#touchscreenGameForm").addEventListener("change", handleTouchscreenGameChange);
      document.querySelector("#touchscreenGameForm").addEventListener("click", handleTouchscreenGameClick);
    }

    function setAssistantConfig(config, billing = null) {
      state.developmentPlatform.assistant = config || null;
      state.developmentPlatform.billing = billing || state.developmentPlatform.billing || null;
    }

    function setProjectTemplates(templates, previews = []) {
      const catalog = Array.isArray(templates) ? templates : [];
      projectTemplateCatalog = catalog.filter((template) => template.id !== "empty");
      projectTemplatePreviews = Object.fromEntries((Array.isArray(previews) ? previews : []).map((preview) => [preview.template_id, preview]));
      projectTemplates = Object.fromEntries(catalog.map((template) => [template.id, {
        title: template.default_title ?? template.title ?? "",
        description: template.description || "",
        hint: template.hint || template.description || "",
        available: template.available !== false,
        requiredEntitlements: template.required_entitlements || [],
      }]));
      const select = document.querySelector("#developmentProjectTemplate");
      if (!select) return;
      select.innerHTML = [
        `<option value="">Template waehlen</option>`,
        ...catalog.map((template) => `<option value="${escapeAttribute(template.id)}" ${template.id === "empty" ? "hidden" : ""} ${template.available === false ? "disabled" : ""}>${escapeHtml(template.title)}${template.available === false ? " · Premium" : ""}</option>`),
      ].join("");
    }

    function openDevelopmentTemplateHelp() {
      const target = document.querySelector("#developmentTemplateHelpContent");
      if (!target) return;
      target.innerHTML = projectTemplateCatalog.length
        ? projectTemplateCatalog.map((template) => {
          const entitlements = Array.isArray(template.required_entitlements) ? template.required_entitlements : [];
          const premium = entitlements.length > 0;
          const access = premium
            ? `${template.available === false ? "Premium erforderlich" : "Premium-Berechtigung vorhanden"}: ${entitlements.map(templateEntitlementLabel).join(", ")}`
            : "Ohne Premium-Zusatz verfügbar";
          return `<article class="development-template-help-card ${template.available === false ? "unavailable" : ""}">
            <header><strong>${escapeHtml(template.title || template.id)}</strong><span>${escapeHtml(access)}</span></header>
            <p>${escapeHtml(template.description || template.hint || "Keine Beschreibung vorhanden.")}</p>
            ${template.hint ? `<small>${escapeHtml(template.hint)}</small>` : ""}
          </article>`;
        }).join("")
        : "<p class=\"empty\">Die Projekttemplates werden geladen.</p>";
      const dialog = document.querySelector("#developmentTemplateHelpDialog");
      if (!dialog.open) dialog.showModal();
    }

    function templateEntitlementLabel(entitlement) {
      const labels = { web_push: "Web Push" };
      return labels[String(entitlement)] || String(entitlement).replace(/_/g, " ");
    }

    function render() {
      renderProjectPicker();
      renderWorkflowStep();
      renderRequirementsText();
      renderTemplateComponentConfiguration();
      renderTouchscreenGameAssistant();
      renderChatMessages();
      renderQuickPrompts();
      renderArchitectureDiagram();
      syncChatAvailability();
    }

    function handleProjectOverviewClick(event) {
      const openButton = event.target.closest("[data-open-development-project]");
      if (openButton) { activateProject(openButton.dataset.openDevelopmentProject); return; }
      const editButton = event.target.closest("[data-edit-development-project]");
      if (editButton) { openProjectInIde(editButton.dataset.editDevelopmentProject); return; }
      const deleteButton = event.target.closest("[data-delete-development-project]");
      if (deleteButton) deleteDevelopmentProject(deleteButton.dataset.deleteDevelopmentProject);
    }

    async function deleteDevelopmentProject(projectId) {
      const project = developmentProjects().find((item) => item.id === projectId);
      if (!project || !window.confirm(`Projekt „${project.name}“ wirklich unwiderruflich loeschen?`)) return;
      try {
        await deleteJson(`/api/platform/projects/${encodeURIComponent(projectId)}`);
        state.projects = state.projects.filter((item) => item.id !== projectId);
        if (activeProjectId() === projectId) enterProjectStart();
        render();
        setProjectStatus(`Projekt „${project.name}“ wurde geloescht.`);
      } catch (error) { setProjectStatus(error.message || "Projekt konnte nicht geloescht werden."); }
    }

    function renderWorkflowStep() {
      const configurationStep = state.developmentPlatform.workflowStep === "configuration";
      const workspace = document.querySelector(".development-workspace-panel");
      const mainWorkspace = document.querySelector(".development-main-workspace");
      workspace?.classList.toggle("development-project-start-step", !configurationStep);
      workspace?.classList.toggle("development-assistant-closed", configurationStep && !state.developmentPlatform.assistantOpen);
      mainWorkspace?.classList.toggle("development-project-start-no-preview", !configurationStep && !state.developmentPlatform.architectureDiagram?.source);
      document.querySelectorAll(".development-configuration-only").forEach((element) => {
        element.classList.toggle("hidden", !configurationStep);
      });
      const startActions = document.querySelector("#developmentProjectStartActions");
      const continueButton = document.querySelector("#continueDevelopmentConfigurationButton");
      if (continueButton) continueButton.disabled = !activeProjectId();
      startActions?.classList.toggle("hidden", configurationStep || !activeProjectId());
      const assistant = document.querySelector("#developmentChatSidebar");
      const assistantToggle = document.querySelector("#toggleDevelopmentAssistantButton");
      const assistantVisible = configurationStep && state.developmentPlatform.assistantOpen;
      assistant?.classList.toggle("hidden", !assistantVisible);
      if (assistantToggle) assistantToggle.textContent = assistantVisible ? "KI-Unterstuetzung ausblenden" : "KI-Unterstuetzung (optional)";
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
        "Ich moechte einen Touchscreen Game Loop",
        "Nenne mir deine Pattern",
      ];
    }

    function currentProjectUsesTemplate() {
      const templateId = currentProjectTemplateId();
      return Boolean(templateId && templateId !== "empty")
        || state.developmentPlatform.architectureDiagram?.derived_from === "project_template";
    }

    function currentProjectTemplateId() {
      const project = currentProject();
      return project?.viewManifest?.template_id || project?.viewManifest?.templateId || "";
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
      return "Beschreibe dein Projektziel. Ich helfe dir bei Architekturfragen oder beim Ergaenzen von Komponenten.";
    }

    function renderProjectPicker() {
      const select = document.querySelector("#developmentProjectSelect");
      if (!select) return;
      const projects = developmentProjects();
      const storedProjectId = readStoredActiveProjectId();
      const storedProjectExists = projects.some((project) => project.id === storedProjectId);
      let activeProject = currentProject();
      const lastProject = storedProjectExists ? projects.find((project) => project.id === storedProjectId) : null;
      document.querySelector("#developmentProjectName").textContent = activeProject?.name || "Kein Projekt geoeffnet";
      document.querySelector("#developmentProjectChoicePanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "choice");
      document.querySelector("#continueDevelopmentProjectButton").classList.toggle("hidden", !lastProject);
      document.querySelector("#continueDevelopmentProjectName").textContent = lastProject?.name || "";
      document.querySelector("#developmentProjectOpenPanel").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "open");
      const overview = document.querySelector("#developmentProjectOverview");
      overview.classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "manage");
      if (state.developmentPlatform.projectPanelMode === "manage") {
        overview.innerHTML = projects.length ? `<header><p class="eyebrow">Meine Projekte</p><h3>Entwicklungsprojekte</h3></header>${projects.map((project) => `<article class="project-card"><div><strong>${escapeHtml(project.name)}</strong><p>${escapeHtml(project.description || "Keine Beschreibung.")}</p></div><div class="button-row"><button type="button" data-open-development-project="${escapeAttribute(project.id)}">Oeffnen</button><button type="button" data-edit-development-project="${escapeAttribute(project.id)}">Bearbeiten</button><button type="button" data-delete-development-project="${escapeAttribute(project.id)}">Loeschen</button></div></article>`).join("")}` : `<p class="empty">Noch keine eigenen Entwicklungsprojekte vorhanden.</p>`;
      }
      const isNewProject = state.developmentPlatform.projectPanelMode === "new-empty" || state.developmentPlatform.projectPanelMode === "new-template";
      document.querySelector("#developmentProjectForm").classList.toggle("hidden", !isNewProject);
      document.querySelector("#developmentProjectTemplateField").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "new-template");
      document.querySelector("#developmentProjectTemplateHint").classList.toggle("hidden", state.developmentPlatform.projectPanelMode !== "new-template");
      select.innerHTML = [
        `<option value="">Projekt waehlen</option>`,
        ...projects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`),
      ].join("");
      select.value = state.developmentPlatform.activeProjectId || "";
      const selectButton = document.querySelector("#selectDevelopmentProjectButton");
      if (selectButton) selectButton.disabled = !select.value;
      setProjectStatus(activeProject
        ? ""
        : "Bitte waehle, wie du im Entwicklungsbereich starten moechtest.");
    }

    function enterProjectStart() {
      state.developmentPlatform.workflowStep = "project_start";
      state.developmentPlatform.projectPanelMode = "choice";
      state.developmentPlatform.activeProjectId = "";
      state.developmentPlatform.architectureDiagram = null;
      state.developmentPlatform.homeAutomationConfiguration = null;
      state.developmentPlatform.gameConfiguration = null;
      state.developmentPlatform.assistantOpen = false;
      state.developmentPlatform.chat = [];
      state.developmentPlatform.lastRouting = null;
      setActionStatus("");
      render();
    }

    function usesTemplateComponentConfiguration(project = currentProject()) {
      const templateId = currentProjectTemplateIdFor(project);
      return Boolean(templateId && templateId !== "empty" && templateId !== "touchscreen_game_collection");
    }

    function toggleDevelopmentAssistant() {
      state.developmentPlatform.assistantOpen = !state.developmentPlatform.assistantOpen;
      renderWorkflowStep();
      if (state.developmentPlatform.assistantOpen) {
        document.querySelector("#developmentChatInput")?.focus();
      }
    }

    function renderTemplateComponentConfiguration() {
      const section = document.querySelector("#templateComponentConfiguration");
      if (!section) return;
      const visible = state.developmentPlatform.workflowStep === "configuration" && usesTemplateComponentConfiguration();
      section.classList.toggle("hidden", !visible);
      if (!visible) return;
      const diagram = state.developmentPlatform.architectureDiagram || architectureDiagramForProject(currentProject());
      const components = abstractArchitectureComponents(diagram?.source || "");
      const configurableComponents = components.filter(isUserConfigurableComponent);
      const componentById = new Map(components.map((component) => [component.component_id, component]));
      const controlAssignments = controlUnitAssignments(diagram?.source || "");
      const connections = new Map([...componentConnectionAssignments(diagram?.source || "")]
        .filter(([, targetId]) => isUserConfigurableComponent(componentById.get(targetId))));
      const connectionCoverage = plantUmlFunctionCoverage(diagram?.source || "");
      const disconnectedComponents = connectionCoverage.missing
        .map((componentId) => componentById.get(componentId) || { component_id: componentId, label: componentId })
        .filter(isUserConfigurableComponent);
      const invalidRelations = connectionCoverage.invalid || [];
      const componentRows = configurableComponents.length
        ? configurableComponents.map((component) => `
          <li class="${connectionCoverage.missing.includes(component.component_id) ? "has-connection-hint" : ""}">
            <strong>${escapeHtml(component.label)}</strong>
            <small>${escapeHtml(templateComponentTypeLabel(component.abstract_type))}${connections.get(component.component_id) || controlAssignments.get(component.component_id) ? ` · ${controlAssignments.get(component.component_id) ? "Steuereinheit" : "Verbunden mit"}: ${escapeHtml(componentById.get(connections.get(component.component_id) || controlAssignments.get(component.component_id))?.label || connections.get(component.component_id) || controlAssignments.get(component.component_id))}` : ""}</small>
          </li>`).join("")
        : "<li class=\"empty\">Noch keine Komponenten vorhanden.</li>";
      const connectionHints = disconnectedComponents.length || invalidRelations.length
        ? `<aside class="template-component-connection-hints" role="status">
            <strong>Hinweise zur Verbindung</strong>
            ${disconnectedComponents.length ? `<p>Diese Komponenten haben noch keine zulaessige Verbindung:</p><ul>${disconnectedComponents.map((component) => `<li>${escapeHtml(component.label)}</li>`).join("")}</ul>` : ""}
            ${invalidRelations.length ? `<p>Nicht zulaessige Beziehungen:</p><ul>${invalidRelations.map((relation) => `<li>${escapeHtml(`${relation.source.label} → ${relation.target.label}`)}</li>`).join("")}</ul>` : ""}
          </aside>`
        : "";
      const draftType = state.developmentPlatform.componentDraftType || "iot_device";
      const connectionOptions = componentConnectionOptions(draftType, components);
      section.innerHTML = `
        <header>
          <div>
            <p class="eyebrow">Komponenten konfigurieren</p>
            <h3>Was soll dein Projekt enthalten?</h3>
          </div>
          <small>Das Template liefert den Start. Hier bleiben Sensoren und Aktoren abstrakt; Typ, Board und Pins werden erst im Hardware-Schritt festgelegt. Die KI bleibt eine optionale Hilfe.</small>
        </header>
        <div class="template-component-layout">
          <section>
            <h4>Vorhandene Komponenten</h4>
            <ul class="template-component-list">${componentRows}</ul>
            ${connectionHints}
          </section>
          <form class="template-component-add" onsubmit="return false">
            <h4>Komponente hinzufuegen</h4>
            <label>Art
              <select data-template-component-type>
                <option value="iot_device" ${selected(draftType, "iot_device")}>IoT-Device</option>
                <option value="sensor" ${selected(draftType, "sensor")}>Sensor</option>
                <option value="actuator" ${selected(draftType, "actuator")}>Aktor</option>
                <option value="smartphone_app" ${selected(draftType, "smartphone_app")}>Smartphone-App</option>
                <option value="browser_app" ${selected(draftType, "browser_app")}>Browser-App</option>
                <option value="server_api" ${selected(draftType, "server_api")}>Server / API</option>
              </select>
            </label>
            <label>Bezeichnung (optional)<input data-template-component-label maxlength="80" placeholder="z. B. Sensor Kueche"></label>
            ${componentConnectionSelection(draftType, connectionOptions)}
            <button type="button" class="secondary" data-template-component-add ${!connectionOptions.length ? "disabled" : ""}>+ Komponente</button>
          </form>
        </div>
      `;
    }

    function templateComponentTypeLabel(type) {
      return globalThis.DevelopmentComponentMetamodel?.typeLabel(type) || "Komponente";
    }

    function componentConnectionOptions(type, components) {
      return globalThis.DevelopmentComponentMetamodel?.optionsForNewComponent(type, components) || [];
    }

    function componentConnectionSelection(type, options) {
      const requiresControlUnit = ["sensor", "actuator"].includes(type);
      if (!options.length) return `<p class="template-component-hint">${requiresControlUnit ? "Lege zuerst ein IoT-Device als Steuereinheit an." : "Es gibt noch keine Komponente mit einer zulaessigen Beziehung."}</p>`;
      const label = requiresControlUnit ? "Steuereinheit" : "Zulaessige Beziehung";
      const prompt = requiresControlUnit ? "IoT-Device waehlen" : "Beziehung waehlen";
      return `<label>${label}
        <select data-template-connection-target>
          <option value="">${prompt}</option>
          ${options.map((option) => `<option value="${escapeAttribute(`${option.rule.id}|${option.target.component_id}`)}">${escapeHtml(`${option.rule.label}: ${option.target.label}`)}</option>`).join("")}
        </select>
      </label>`;
    }

    function handleTemplateComponentConfigurationClick(event) {
      if (!event.target.closest("[data-template-component-add]")) return;
      const section = document.querySelector("#templateComponentConfiguration");
      const type = section?.querySelector("[data-template-component-type]")?.value || "structural";
      const labelInput = section?.querySelector("[data-template-component-label]");
      const label = String(labelInput?.value || "").trim() || templateComponentDefaultLabel(type);
      const connectionSelection = section?.querySelector("[data-template-connection-target]")?.value || "";
      const [relationshipRuleId, connectionTargetId] = connectionSelection.split("|");
      if (!relationshipRuleId || !connectionTargetId) {
        setActionStatus(["sensor", "actuator"].includes(type)
          ? "Bitte waehle die IoT-Steuereinheit fuer diese Komponente."
          : "Bitte waehle eine zulaessige Beziehung fuer diese Komponente.");
        return;
      }
      appendTemplateComponent(type, label, connectionTargetId, relationshipRuleId);
      if (labelInput) labelInput.value = "";
      renderTemplateComponentConfiguration();
      renderArchitectureDiagram();
      setActionStatus(`${label} wurde zur Architektur hinzugefuegt. Speichere die Konfiguration, wenn die Auswahl passt.`);
    }

    function handleTemplateComponentConfigurationChange(event) {
      if (!event.target.matches("[data-template-component-type]")) return;
      state.developmentPlatform.componentDraftType = event.target.value;
      renderTemplateComponentConfiguration();
    }

    function templateComponentDefaultLabel(type) {
      return globalThis.DevelopmentComponentMetamodel?.typeLabel(type) || "Komponente";
    }

    function isUserConfigurableComponent(component) {
      return globalThis.DevelopmentComponentMetamodel?.componentTypes?.[component?.abstract_type]?.user_configurable !== false;
    }

    function appendTemplateComponent(type, label, connectionTargetId = "", relationshipRuleId = "") {
      const diagram = state.developmentPlatform.architectureDiagram || architectureDiagramForProject(currentProject());
      if (!diagram?.source) return;
      const safeLabel = String(label).replace(/["\\\\]/g, " ").replace(/\s+/g, " ").trim();
      const aliasBase = ({ iot_device: "iot_device", sensor: "sensor", actuator: "actuator", smartphone_app: "smartphone_app", browser_app: "browser_app", server_api: "server_api" })[type] || "component";
      const aliases = new Set(abstractArchitectureComponents(diagram.source).map((component) => component.component_id));
      let suffix = 1;
      while (aliases.has(`${aliasBase}_${suffix}`)) suffix += 1;
      const alias = `${aliasBase}_${suffix}`;
      const plantUmlType = ({ iot_device: "node", smartphone_app: "component", server_api: "node" })[type] || "component";
      const declaration = `${plantUmlType} "${safeLabel}" as ${alias}`;
      const relationshipRule = globalThis.DevelopmentComponentMetamodel?.relationshipRules.find((item) => item.id === relationshipRuleId);
      if (!relationshipRule) return;
      const relation = relationshipRule.source_type === type
        ? `${alias} --> ${connectionTargetId} : ${relationshipRule.label}`
        : `${connectionTargetId} --> ${alias} : ${relationshipRule.label}`;
      const additions = `${declaration}\n${relation}`;
      const source = /@enduml\s*$/i.test(diagram.source)
        ? diagram.source.replace(/@enduml\s*$/i, `${additions}\n@enduml`)
        : `${diagram.source}\n${additions}`;
      state.developmentPlatform.architectureDiagram = { ...diagram, source, derived_from: diagram.derived_from || "project_template" };
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

    function renderHomeAutomationAssistant() {
      const section = document.querySelector("#homeAutomationAssistant");
      const form = document.querySelector("#homeAutomationForm");
      if (!section || !form) return;
      const visible = state.developmentPlatform.workflowStep === "configuration"
        && currentProjectTemplateId() === "distributed_home_automation";
      section.classList.toggle("hidden", !visible);
      if (!visible) return;
      const configuration = normalizeHomeAutomationConfiguration(state.developmentPlatform.homeAutomationConfiguration);
      state.developmentPlatform.homeAutomationConfiguration = configuration;
      synchronizeConfigurationArchitecture();
      form.querySelector('[data-home-automation-field="coordinator"]').value = configuration.coordinator;
      form.querySelector('[data-home-automation-field="failure_policy"]').value = configuration.failure_policy;
      form.querySelectorAll("[data-home-automation-state]").forEach((input) => {
        input.checked = Boolean(configuration.state_model[input.dataset.homeAutomationState]);
      });
      document.querySelector("#homeAutomationNodes").innerHTML = configuration.nodes.map((node, index) => `
        <article class="home-automation-node" data-home-automation-node="${index}">
          <label>Name<input data-home-node-field="name" maxlength="80" value="${escapeAttribute(node.name)}"></label>
          <label>Rolle<select data-home-node-field="role">
            ${homeAutomationOptions(homeAutomationRoleOptions(), node.role)}
          </select></label>
          <label>Kommunikation<select data-home-node-field="transport">
            ${homeAutomationOptions(homeAutomationTransportOptions(), node.transport)}
          </select></label>
          <label>Sensoren<input data-home-node-field="sensor_count" type="number" min="0" max="20" step="1" value="${node.sensor_count}"></label>
          <label>Aktoren<input data-home-node-field="actuator_count" type="number" min="0" max="20" step="1" value="${node.actuator_count}"></label>
          <fieldset class="home-automation-board-features">
            <legend>Boardeigenschaften</legend>
            ${homeAutomationBoardFeatureOptions().map((feature) => `
              <label><input type="checkbox" data-home-node-feature="${escapeAttribute(feature.id)}" ${node.board_features[feature.id] ? "checked" : ""}> ${escapeHtml(feature.label)}</label>
            `).join("")}
          </fieldset>
          <div class="home-automation-board-recommendation">
            <span>Boardvorschlag</span>
            <strong>${escapeHtml(recommendedBoardForNode(node))}</strong>
          </div>
          <button type="button" class="icon-button" data-home-automation-remove-node="${index}" aria-label="Device entfernen" title="Device entfernen">&times;</button>
        </article>
      `).join("");
    }

    function homeAutomationOptions(options, value) {
      return options.map((option) => `<option value="${escapeAttribute(option.id)}" ${String(option.id) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
    }

    function homeAutomationRoleOptions() {
      return [
        { id: "sensor_node", label: "Sensor-Node" },
        { id: "actuator_node", label: "Aktor-Node" },
        { id: "combined_node", label: "Sensor- und Aktor-Node" },
        { id: "control_node", label: "Bedien-Node" },
        { id: "gateway", label: "Gateway" },
      ];
    }

    function homeAutomationTransportOptions() {
      return [
        { id: "undecided", label: "Noch offen" },
        { id: "local", label: "Nur lokal am Device" },
        { id: "wifi_rest", label: "WLAN / REST" },
        { id: "wifi_mqtt", label: "WLAN / MQTT" },
        { id: "zigbee", label: "Zigbee" },
      ];
    }

    function homeAutomationBoardFeatureOptions() {
      return [
        { id: "integrated_display", label: "Display" },
        { id: "integrated_touchscreen", label: "Touchscreen" },
        { id: "battery_operation", label: "Akkubetrieb" },
        { id: "sd_card", label: "SD-Karte" },
        { id: "audio", label: "Audio" },
        { id: "many_gpio", label: "Viele GPIOs" },
      ];
    }

    function recommendedBoardForNode(node) {
      const features = node.board_features || {};
      if (features.integrated_touchscreen && node.transport === "zigbee") return "ESP32-S3 Touch-Display-Board mit Zigbee-Erweiterung";
      if (features.integrated_touchscreen) return "ESP32-S3 Touch-Display-Board";
      if (node.transport === "zigbee") return features.battery_operation ? "ESP32-C6 Low-Power-Board" : "ESP32-C6 DevKitC-1";
      if (features.integrated_display) return "ESP32-S3 Display-Board";
      if (features.many_gpio || features.audio || features.sd_card) return "ESP32-S3 DevKitC-1";
      if (features.battery_operation) return "ESP32-C6 Low-Power-Board";
      return "ESP32 DevKitC";
    }

    function handleHomeAutomationChange(event) {
      if (event?.target?.dataset.homeNodeFeature === "integrated_touchscreen" && event.target.checked) {
        const row = event.target.closest("[data-home-automation-node]");
        const display = row?.querySelector('[data-home-node-feature="integrated_display"]');
        if (display) display.checked = true;
      }
      state.developmentPlatform.homeAutomationConfiguration = collectHomeAutomationConfiguration();
      const changedRow = event?.target?.closest?.("[data-home-automation-node]");
      const changedIndex = Number(changedRow?.dataset.homeAutomationNode);
      if (changedRow && Number.isInteger(changedIndex)) {
        const recommendation = changedRow.querySelector(".home-automation-board-recommendation strong");
        const node = state.developmentPlatform.homeAutomationConfiguration.nodes[changedIndex];
        if (recommendation && node) recommendation.textContent = recommendedBoardForNode(node);
      }
      synchronizeConfigurationArchitecture();
      renderArchitectureDiagram();
      syncChatAvailability();
      setHomeAutomationStatus("Vorschau aktualisiert. Bitte Konfiguration speichern.");
    }

    function handleHomeAutomationClick(event) {
      const addButton = event.target.closest("[data-home-automation-add-node]");
      const removeButton = event.target.closest("[data-home-automation-remove-node]");
      const saveButton = event.target.closest("[data-home-automation-save]");
      const aiButton = event.target.closest("[data-home-automation-ai]");
      if (addButton) {
        const configuration = collectHomeAutomationConfiguration();
        configuration.nodes.push({ name: `IoT-Device ${configuration.nodes.length + 1}`, role: "combined_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: {} });
        state.developmentPlatform.homeAutomationConfiguration = configuration;
        renderHomeAutomationAssistant();
        handleHomeAutomationChange();
      } else if (removeButton) {
        const configuration = collectHomeAutomationConfiguration();
        configuration.nodes.splice(Number(removeButton.dataset.homeAutomationRemoveNode), 1);
        state.developmentPlatform.homeAutomationConfiguration = normalizeHomeAutomationConfiguration(configuration);
        renderHomeAutomationAssistant();
        handleHomeAutomationChange();
      } else if (saveButton) {
        saveHomeAutomationConfiguration();
      } else if (aiButton) {
        state.developmentPlatform.homeAutomationConfiguration = collectHomeAutomationConfiguration();
        sendChatContent("Konfiguration pruefen");
      }
    }

    function collectHomeAutomationConfiguration() {
      const form = document.querySelector("#homeAutomationForm");
      if (!form) return normalizeHomeAutomationConfiguration(state.developmentPlatform.homeAutomationConfiguration);
      return normalizeHomeAutomationConfiguration({
        coordinator: form.querySelector('[data-home-automation-field="coordinator"]').value,
        failure_policy: form.querySelector('[data-home-automation-field="failure_policy"]').value,
        state_model: Object.fromEntries(Array.from(form.querySelectorAll("[data-home-automation-state]"), (input) => [input.dataset.homeAutomationState, input.checked])),
        nodes: Array.from(form.querySelectorAll("[data-home-automation-node]"), (row) => ({
          ...Object.fromEntries(Array.from(row.querySelectorAll("[data-home-node-field]"), (input) => [input.dataset.homeNodeField, input.value])),
          board_features: Object.fromEntries(Array.from(row.querySelectorAll("[data-home-node-feature]"), (input) => [input.dataset.homeNodeFeature, input.checked])),
        })),
      });
    }

    async function saveHomeAutomationConfiguration() {
      state.developmentPlatform.homeAutomationConfiguration = collectHomeAutomationConfiguration();
      synchronizeConfigurationArchitecture();
      setHomeAutomationStatus("Konfiguration und Architektur werden gespeichert...");
      const saved = await persistDevelopmentDialog();
      setHomeAutomationStatus(saved ? "Konfiguration und Architektur sind im Projekt gespeichert." : "Konfiguration konnte nicht gespeichert werden.");
      renderArchitectureDiagram();
      syncChatAvailability();
    }

    function synchronizeConfigurationArchitecture() {
      if (state.developmentPlatform.workflowStep !== "configuration") return false;
      if (currentProjectTemplateId() === "touchscreen_game_collection") {
        const gameConfiguration = normalizeTouchscreenGameConfiguration(state.developmentPlatform.gameConfiguration);
        state.developmentPlatform.gameConfiguration = gameConfiguration;
        state.developmentPlatform.architectureDiagram = touchscreenGameArchitectureDiagram(gameConfiguration, currentProject()?.name);
        return true;
      }
      return false;
    }

    function setHomeAutomationStatus(text) {
      const target = document.querySelector("#homeAutomationStatus");
      if (target) target.textContent = text;
    }

    function renderTouchscreenGameAssistant() {
      const section = document.querySelector("#touchscreenGameAssistant");
      const form = document.querySelector("#touchscreenGameForm");
      if (!section || !form) return;
      const visible = state.developmentPlatform.workflowStep === "configuration"
        && currentProjectTemplateId() === "touchscreen_game_collection";
      section.classList.toggle("hidden", !visible);
      if (!visible) return;
      const configuration = normalizeTouchscreenGameConfiguration(state.developmentPlatform.gameConfiguration);
      state.developmentPlatform.gameConfiguration = configuration;
      const boardSelect = form.querySelector('[data-game-field="board_profile_id"]');
      const boards = touchscreenGameBoards();
      boardSelect.innerHTML = [
        '<option value="">Touch-Display-Board waehlen</option>',
        ...boards.map((board) => `<option value="${escapeAttribute(board.hardware_item_id)}">${escapeHtml(processorBoardLabel(board))}</option>`),
      ].join("");
      boardSelect.value = configuration.board_profile_id;
      const inventorySelect = form.querySelector('[data-game-field="inventory_device_id"]');
      const inventory = touchscreenGameInventory(configuration.board_profile_id);
      inventorySelect.innerHTML = [
        '<option value="">Noch keinem Inventar-Board zuordnen</option>',
        ...inventory.map((device) => `<option value="${escapeAttribute(device.device_id)}">${escapeHtml(device.display_name || device.device_id)}</option>`),
      ].join("");
      inventorySelect.value = inventory.some((device) => device.device_id === configuration.inventory_device_id)
        ? configuration.inventory_device_id
        : "";
      form.querySelector('[data-game-field="pattern_id"]').value = configuration.pattern_id;
      document.querySelector("#touchscreenGameChoices").innerHTML = [
        "<legend>Beispielspiele im Startbildschirm</legend>",
        ...touchscreenGameOptions().map((game) => `<label><input type="checkbox" data-game-id="${escapeAttribute(game.id)}" ${configuration.selected_game_ids.includes(game.id) ? "checked" : ""}> ${escapeHtml(game.label)}</label>`),
      ].join("");
      const match = document.querySelector("#touchscreenGameInventoryMatch");
      if (!configuration.board_profile_id) {
        match.innerHTML = "<strong>Noch kein Board gewaehlt</strong><span>Empfohlen wird ein ESP32-S3-Board mit integriertem Display und Touchcontroller.</span>";
      } else if (configuration.inventory_device_id) {
        const device = inventory.find((item) => item.device_id === configuration.inventory_device_id);
        match.innerHTML = `<strong>Inventar passt</strong><span>${escapeHtml(device?.display_name || configuration.inventory_device_id)} kann direkt verwendet werden.</span>`;
      } else if (inventory.length) {
        match.innerHTML = `<strong>${inventory.length} passendes ${inventory.length === 1 ? "Board" : "Boards"} im Inventar</strong><span>Waehle eines aus oder lasse die Zuordnung vorerst offen.</span>`;
      } else {
        match.innerHTML = "<strong>Kein passendes Inventar-Board</strong><span>Das benoetigte Board kann spaeter inventarisiert werden.</span>";
      }
      form.querySelector("[data-game-save]").disabled = !configuration.pattern_id
        || !configuration.board_profile_id
        || !configuration.selected_game_ids.length;
      synchronizeConfigurationArchitecture();
    }

    function touchscreenGameOptions() {
      return [
        { id: "nibbles", label: "Nibbles" },
        { id: "snake", label: "Snake" },
        { id: "frogger", label: "Frogger" },
        { id: "tic_tac_toe", label: "Tic-Tac-Toe" },
        { id: "pong", label: "Pong" },
        { id: "breakout", label: "Breakout" },
        { id: "memory", label: "Memory" },
      ];
    }

    function touchscreenGameBoards() {
      return availableProcessorBoards()
        .filter((board) => processorBoardFamily(board) === "esp32" && isTouchscreenGameBoard(board))
        .sort((left, right) => touchscreenBoardScore(right) - touchscreenBoardScore(left));
    }

    function isTouchscreenGameBoard(board) {
      const capabilities = new Set(board.capability_ids || []);
      const text = `${board.title || ""} ${board.form_factor || ""}`.toLowerCase();
      return capabilities.has("capability.touchscreen_input") || /touch/.test(text);
    }

    function touchscreenBoardScore(board) {
      const capabilities = new Set(board.capability_ids || []);
      const text = `${board.title || ""} ${board.mcu_variant || ""} ${board.form_factor || ""}`.toLowerCase();
      return (capabilities.has("capability.touchscreen_input") ? 100 : 0)
        + (capabilities.has("capability.display_output") ? 50 : 0)
        + (/touch/.test(text) ? 30 : 0)
        + (/esp32-s3/.test(text) ? 10 : 0);
    }

    function touchscreenGameInventory(boardProfileId) {
      return boardProfileId
        ? (state.devices || []).filter((device) => touchscreenGameInventoryMatches(boardProfileId, device))
        : [];
    }

    function touchscreenGameInventoryMatches(boardProfileId, device) {
      const inventoryProfile = String(device?.hardware_profile_id || "");
      return inventoryProfile === boardProfileId
        || (boardProfileId === "hardware.processor_board.generic_esp32_s3_touch_display" && /touch|display/i.test(inventoryProfile));
    }

    function normalizeTouchscreenGameConfiguration(value = {}) {
      const patterns = new Set(["", "touchscreen_game_loop", "event_driven_scene_loop", "turn_based_state_machine"]);
      const games = new Set(touchscreenGameOptions().map((game) => game.id));
      return {
        schema_version: 1,
        pattern_id: patterns.has(value?.pattern_id) ? value.pattern_id : "",
        selected_game_ids: Array.from(new Set(Array.isArray(value?.selected_game_ids) ? value.selected_game_ids : ["nibbles", "snake", "frogger", "tic_tac_toe"])).filter((id) => games.has(id)),
        board_profile_id: String(value?.board_profile_id || "hardware.processor_board.generic_esp32_s3_touch_display"),
        inventory_device_id: String(value?.inventory_device_id || ""),
      };
    }

    function collectTouchscreenGameConfiguration() {
      const form = document.querySelector("#touchscreenGameForm");
      return normalizeTouchscreenGameConfiguration({
        pattern_id: form.querySelector('[data-game-field="pattern_id"]').value,
        board_profile_id: form.querySelector('[data-game-field="board_profile_id"]').value,
        inventory_device_id: form.querySelector('[data-game-field="inventory_device_id"]').value,
        selected_game_ids: Array.from(form.querySelectorAll("[data-game-id]:checked"), (input) => input.dataset.gameId),
      });
    }

    function handleTouchscreenGameChange(event) {
      state.developmentPlatform.gameConfiguration = collectTouchscreenGameConfiguration();
      if (event.target?.dataset.gameField === "board_profile_id") {
        state.developmentPlatform.gameConfiguration.inventory_device_id = "";
      }
      synchronizeConfigurationArchitecture();
      renderArchitectureDiagram();
      renderTouchscreenGameAssistant();
      setTouchscreenGameStatus("Vorschau aktualisiert. Bitte Spielprojekt speichern.");
    }

    function handleTouchscreenGameClick(event) {
      if (event.target.closest("[data-game-save]")) saveTouchscreenGameConfiguration();
    }

    async function saveTouchscreenGameConfiguration() {
      state.developmentPlatform.gameConfiguration = collectTouchscreenGameConfiguration();
      synchronizeConfigurationArchitecture();
      setTouchscreenGameStatus("Pattern, Spiele, Board und User-Quellen werden gespeichert...");
      const saved = await persistDevelopmentDialog();
      setTouchscreenGameStatus(saved
        ? "Spielprojekt gespeichert. Startbildschirm und Spiele liegen getrennt im User-Bereich."
        : "Spielprojekt konnte nicht gespeichert werden.");
    }

    function setTouchscreenGameStatus(text) {
      const target = document.querySelector("#touchscreenGameStatus");
      if (target) target.textContent = text;
    }

    function touchscreenGameArchitectureDiagram(configuration, title = "Touchscreen-Spielesammlung") {
      const lines = [
        "@startuml",
        `title ${plantUmlLabel(title)}`,
        "left to right direction",
        'actor "Nutzer" as user',
        'rectangle "Board mit Touchdisplay" as device',
        'user --> device : bedient lokal',
        "@enduml",
      ];
      return { type: "plantuml", source: lines.join("\n"), title: "Statische Architektur der Touchscreen-Spielesammlung", summary: "Logische Struktur aus Nutzer und Board; Verhalten und Realisierung werden getrennt gepflegt.", derived_from: "project_template" };
    }

    function normalizeHomeAutomationConfiguration(value = {}) {
      const defaults = defaultHomeAutomationConfiguration();
      const allowedCoordinators = new Set(["undecided", "none", "gernetix_home_server", "home_assistant", "gernetix_with_home_assistant"]);
      const allowedPolicies = new Set(["local_fallback", "safe_state", "central_required", "undecided"]);
      const allowedRoles = new Set(homeAutomationRoleOptions().map((option) => option.id));
      const allowedTransports = new Set(homeAutomationTransportOptions().map((option) => option.id));
      const nodes = Array.isArray(value?.nodes) ? value.nodes.slice(0, 30).map((node, index) => {
        const legacyTouchscreen = boundedHomeAutomationCount(node?.control_count) > 0;
        const boardFeatures = Object.fromEntries(homeAutomationBoardFeatureOptions().map((feature) => [feature.id, node?.board_features?.[feature.id] === true]));
        if (legacyTouchscreen) boardFeatures.integrated_touchscreen = true;
        if (boardFeatures.integrated_touchscreen) boardFeatures.integrated_display = true;
        return {
          name: String(node?.name || `IoT-Device ${index + 1}`).trim().slice(0, 80),
          role: allowedRoles.has(node?.role) ? node.role : "combined_node",
          transport: allowedTransports.has(node?.transport) ? node.transport : "undecided",
          sensor_count: boundedHomeAutomationCount(node?.sensor_count),
          actuator_count: boundedHomeAutomationCount(node?.actuator_count),
          board_features: boardFeatures,
        };
      }) : defaults.nodes;
      return {
        schema_version: 2,
        coordinator: allowedCoordinators.has(value?.coordinator) ? value.coordinator : defaults.coordinator,
        failure_policy: allowedPolicies.has(value?.failure_policy) ? value.failure_policy : defaults.failure_policy,
        state_model: Object.fromEntries(["commands", "desired_state", "actual_state", "events"].map((key) => [key, value?.state_model?.[key] !== false])),
        nodes,
      };
    }

    function boundedHomeAutomationCount(value) {
      const number = Number.parseInt(value, 10);
      return Number.isFinite(number) ? Math.min(20, Math.max(0, number)) : 0;
    }

    function defaultHomeAutomationConfiguration() {
      return {
        schema_version: 1,
        coordinator: "undecided",
        failure_policy: "local_fallback",
        state_model: { commands: true, desired_state: true, actual_state: true, events: true },
        nodes: [
          { name: "Raumklima", role: "sensor_node", transport: "undecided", sensor_count: 2, actuator_count: 0, board_features: {} },
          { name: "Lichtsteuerung", role: "actuator_node", transport: "undecided", sensor_count: 0, actuator_count: 1, board_features: {} },
          { name: "Touchpanel", role: "control_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: { integrated_display: true, integrated_touchscreen: true } },
        ],
      };
    }

    function homeAutomationArchitectureDiagram(configuration, title = "Verteilte Hausautomatisierung") {
      const config = normalizeHomeAutomationConfiguration(configuration);
      const coordinatorLabels = {
        undecided: "Zustandskoordination\\nNoch offen",
        none: "Verteilte Zustandssynchronisation",
        gernetix_home_server: "GerNetiX Home Server",
        home_assistant: "Home Assistant",
        gernetix_with_home_assistant: "GerNetiX Home Server\\nmit Home Assistant",
      };
      const roleLabels = Object.fromEntries(homeAutomationRoleOptions().map((option) => [option.id, option.label]));
      const transportLabels = Object.fromEntries(homeAutomationTransportOptions().map((option) => [option.id, option.label]));
      const failureLabels = {
        local_fallback: "Lokal weiterarbeiten",
        safe_state: "Sicheren Zustand einnehmen",
        central_required: "Zentrale Instanz erforderlich",
        undecided: "Noch offen",
      };
      const stateLabels = { commands: "Befehle", desired_state: "Sollzustand", actual_state: "Istzustand", events: "Ereignisse / Messwerte" };
      const activeStates = Object.entries(config.state_model).filter(([, enabled]) => enabled).map(([key]) => stateLabels[key]);
      const lines = [
        "@startuml",
        `title ${plantUmlLabel(title)}`,
        "left to right direction",
        `rectangle "${coordinatorLabels[config.coordinator]}" as coordination`,
        `rectangle "Konfiguration\\nAusfall: ${plantUmlLabel(failureLabels[config.failure_policy])}\\nDaten: ${plantUmlLabel(activeStates.join(", ") || "Keine")}" as configuration`,
        "configuration .. coordination",
      ];
      config.nodes.forEach((node, index) => {
        const id = `device_${index + 1}`;
        const featureLabels = homeAutomationBoardFeatureOptions().filter((feature) => node.board_features[feature.id]).map((feature) => feature.label);
        lines.push(`rectangle "IoT-Device ${index + 1}\\n${plantUmlLabel(node.name)}\\n${plantUmlLabel(roleLabels[node.role])}\\n${plantUmlLabel(transportLabels[node.transport])}\\nBoard: ${plantUmlLabel(featureLabels.join(", ") || "Standard")}" as ${id}`);
        if (config.state_model.events || config.state_model.actual_state) lines.push(`${id} --> coordination : ${plantUmlLabel(transportLabels[node.transport])} / Istzustand`);
        if (config.state_model.commands || config.state_model.desired_state) lines.push(`coordination --> ${id} : Befehl / Sollzustand`);
        for (let sensorIndex = 1; sensorIndex <= node.sensor_count; sensorIndex += 1) {
          lines.push(`rectangle "Sensor ${index + 1}.${sensorIndex}" as sensor_${index + 1}_${sensorIndex}`);
          lines.push(`sensor_${index + 1}_${sensorIndex} --> ${id} : Messwert`);
        }
        for (let actuatorIndex = 1; actuatorIndex <= node.actuator_count; actuatorIndex += 1) {
          lines.push(`rectangle "Aktor ${index + 1}.${actuatorIndex}" as actuator_${index + 1}_${actuatorIndex}`);
          lines.push(`${id} --> actuator_${index + 1}_${actuatorIndex} : schaltet`);
        }
      });
      lines.push("@enduml");
      return {
        type: "plantuml",
        source: lines.join("\n"),
        title: "Konfigurierte Hausautomationsarchitektur",
        summary: "Aus dem statischen Konfigurationsassistenten erzeugte Startarchitektur.",
        derived_from: "project_template",
      };
    }

    function plantUmlLabel(value) {
      return String(value || "").replace(/["\r\n]/g, " ").trim();
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
        [/\b(touchscreen game loop|touch[- ]?display|touchscreen.*spiel|spiel.*touchscreen|game loop)\b/, "Touchscreen Game Loop"],
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
      state.developmentPlatform.workflowStep = "project_start";
      state.developmentPlatform.projectPanelMode = mode;
      if (mode === "new-empty") {
        document.querySelector("#developmentProjectTemplate").value = "empty";
        applyProjectTemplate();
      } else if (mode === "new-template") {
        document.querySelector("#developmentProjectTemplate").value = "";
        applyProjectTemplate();
      }
      renderProjectPicker();
      renderWorkflowStep();
      renderArchitectureDiagram();
      syncChatAvailability();
      if (mode === "new-template") {
        document.querySelector("#developmentProjectTemplate").focus();
      } else if (mode === "new-empty") {
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

    function updateDevelopmentProjectSelection() {
      const projectId = document.querySelector("#developmentProjectSelect").value;
      const selectButton = document.querySelector("#selectDevelopmentProjectButton");
      if (selectButton) selectButton.disabled = !projectId;
      if (!projectId) setProjectStatus("Bitte waehle ein vorhandenes Projekt aus.");
    }

    function activateProject(projectId) {
      state.developmentPlatform.activeProjectId = projectId;
      storeActiveProjectId(projectId);
      state.developmentPlatform.projectPanelMode = "closed";
      restoreDevelopmentDialog(currentProject());
      state.developmentPlatform.workflowStep = usesTemplateComponentConfiguration() || currentProjectTemplateId() === "touchscreen_game_collection"
        ? "configuration"
        : "project_start";
      render();
    }

    function continueToDevelopmentConfiguration() {
      if (!activeProjectId()) {
        setProjectStatus("Bitte zuerst ein Projekt oeffnen oder neu aus einem Template anlegen.");
        return;
      }
      state.developmentPlatform.workflowStep = "configuration";
      state.developmentPlatform.projectPanelMode = "closed";
      state.developmentPlatform.assistantOpen = false;
      setActionStatus("Projekt und initiale Architektur uebernommen. Jetzt folgt die Konfiguration.");
      render();
    }

    function restoreDevelopmentDialog(project) {
      const dialog = project?.viewManifest?.architecture_dialog || project?.viewManifest?.architectureDialog || {};
      state.developmentPlatform.chat = Array.isArray(dialog.messages) ? dialog.messages : [];
      const storedDiagram = sanitizeArchitectureDiagram(dialog.architectureDiagram);
      state.developmentPlatform.architectureDiagram = refreshProjectTemplateDiagram(
        storedDiagram || architectureDiagramForProject(project),
        currentProjectTemplateIdFor(project),
      );
      state.developmentPlatform.lastRouting = dialog.lastRouting || null;
      state.developmentPlatform.assistantMode = dialog.assistantMode || "architecture_structure";
      state.developmentPlatform.assistantOpen = false;
      const storedConfiguration = project?.viewManifest?.home_automation_configuration || project?.viewManifest?.homeAutomationConfiguration;
      state.developmentPlatform.homeAutomationConfiguration = currentProjectTemplateIdFor(project) === "distributed_home_automation"
        ? normalizeHomeAutomationConfiguration(storedConfiguration)
        : null;
      const storedGameConfiguration = project?.viewManifest?.game_configuration || project?.viewManifest?.gameConfiguration;
      state.developmentPlatform.gameConfiguration = currentProjectTemplateIdFor(project) === "touchscreen_game_collection"
        ? normalizeTouchscreenGameConfiguration(storedGameConfiguration)
        : null;
    }

    function currentProjectTemplateIdFor(project) {
      return project?.viewManifest?.template_id || project?.viewManifest?.templateId || "";
    }

    async function persistDevelopmentDialog() {
      const projectId = activeProjectId();
      if (!projectId) return false;
      synchronizeConfigurationArchitecture();
      try {
        const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(projectId)}/dialog`, {
          messages: state.developmentPlatform.chat,
          architectureDiagram: state.developmentPlatform.architectureDiagram,
          assistantMode: state.developmentPlatform.assistantMode,
          lastRouting: state.developmentPlatform.lastRouting,
          homeAutomationConfiguration: state.developmentPlatform.homeAutomationConfiguration,
          gameConfiguration: state.developmentPlatform.gameConfiguration,
        });
        if (response.project) {
          state.projects = state.projects.filter((project) => project.id !== response.project.id).concat(response.project);
        }
        return true;
      } catch (error) {
        setActionStatus(`Dialog konnte nicht gespeichert werden: ${error.message}`);
        return false;
      }
    }

    function architectureDiagramForProject(project) {
      const view = (project?.viewManifest?.views || []).find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
      const storedDerivedFrom = view?.payload?.derived_from || "";
      const templateId = project?.viewManifest?.template_id || project?.viewManifest?.templateId || "";
      const usesProjectTemplate = Boolean(templateId && templateId !== "empty");
      const derivedFrom = usesProjectTemplate && (!storedDerivedFrom || storedDerivedFrom === "persisted_project")
        ? "project_template"
        : storedDerivedFrom || (project?.buildConfig ? "project_template" : "persisted_project");
      const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(view?.payload?.source || ""), derivedFrom);
      if (!source) return null;
      return refreshProjectTemplateDiagram({
        source,
        title: view.title || "Architektur-Skizze",
        summary: view.summary || "Gespeicherte Projektarchitektur.",
        derived_from: derivedFrom,
        ...(view.payload?.function_coverage ? { function_coverage: view.payload.function_coverage } : {}),
      }, templateId);
    }

    function refreshProjectTemplateDiagram(diagram, templateId) {
      if (!diagram?.source || !["event_driven_project_application", "iot_datalogger_web_push_pwa"].includes(templateId)) return diagram;
      const containsLegacyInfrastructure = templateId === "event_driven_project_application"
        ? /\bas\s+(?:telemetry|runtime|push)\b/i.test(diagram.source)
        : /\bas\s+(?:telemetry|storage|push)\b/i.test(diagram.source);
      const refreshedSource = projectTemplatePreviews[templateId]?.source;
      if (!containsLegacyInfrastructure || !refreshedSource) return diagram;
      return {
        ...diagram,
        source: normalizeArchitecturePlantUml(refreshedSource, "project_template"),
        derived_from: "project_template",
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
      if (state.developmentPlatform.projectPanelMode === "new-template" && !selectedTemplateId) {
        setProjectStatus("Bitte waehle zuerst ein Projekttemplate.");
        templateInput.focus();
        return;
      }
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
          const startsInConfiguration = selectedTemplateId && selectedTemplateId !== "empty";
          state.developmentPlatform.workflowStep = startsInConfiguration ? "configuration" : "project_start";
          state.developmentPlatform.chat = [];
          state.developmentPlatform.lastRouting = null;
          state.developmentPlatform.assistantMode = "architecture_structure";
          state.developmentPlatform.assistantOpen = false;
          state.developmentPlatform.architectureDiagram = architectureDiagramForProject(response.project);
          state.developmentPlatform.homeAutomationConfiguration = selectedTemplateId === "distributed_home_automation"
            ? normalizeHomeAutomationConfiguration(response.project.viewManifest?.home_automation_configuration)
            : null;
          state.developmentPlatform.gameConfiguration = selectedTemplateId === "touchscreen_game_collection"
            ? normalizeTouchscreenGameConfiguration(response.project.viewManifest?.game_configuration)
            : null;
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
          setProjectStatus(startsInConfiguration
            ? `Projekt angelegt: ${response.project.name}. Konfiguration ist geoeffnet.`
            : `Projekt angelegt: ${response.project.name}`);
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
      const submitButtons = document.querySelectorAll('#developmentProjectForm button[type="submit"]');
      const details = document.querySelector("#developmentProjectDetails");
      const choosingTemplate = state.developmentPlatform.projectPanelMode === "new-template";
      const templateSelected = Boolean(templateInput.value && templateInput.value !== "empty");
      details?.classList.toggle("hidden", choosingTemplate && !templateSelected);
      titleInput.disabled = choosingTemplate && !templateSelected;
      descriptionInput.disabled = choosingTemplate && !templateSelected;
      submitButtons.forEach((button) => {
        button.disabled = choosingTemplate && !templateSelected;
      });
      document.querySelector("#developmentProjectTemplateHint").textContent = choosingTemplate && !templateSelected
        ? "Bitte waehle zuerst ein Projekttemplate. Danach erscheinen Vorschau, Projektname und Beschreibung."
        : template.hint;
      if (["new-empty", "new-template"].includes(state.developmentPlatform.projectPanelMode)) {
        const preview = projectTemplatePreviews[templateInput.value];
        state.developmentPlatform.architectureDiagram = preview ? sanitizeArchitectureDiagram(preview) : null;
      }
      if (!event.preserveValues) {
        titleInput.value = templateSelected || !choosingTemplate ? template.title : "";
        descriptionInput.value = templateSelected || !choosingTemplate ? template.description : "";
      }
      renderArchitectureDiagram();
      renderWorkflowStep();
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
          homeAutomationConfiguration: state.developmentPlatform.homeAutomationConfiguration,
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
      const hasPremiumAi = Boolean(state.developmentPlatform.billing?.entitlements?.includes("ai_assistant"));
      const functionCoverage = plantUmlFunctionCoverage(state.developmentPlatform.architectureDiagram?.source || "");
      const hasEffectChains = state.developmentPlatform.architectureDiagram?.derived_from === "architecture_effect_chain_derivation";
      const usesProjectTemplate = currentProjectUsesTemplate();
      const canContinue = hasProject
        && Boolean(state.developmentPlatform.architectureDiagram?.source)
        && functionCoverage.complete
        && (usesProjectTemplate || functionCoverage.element_count <= 1 || hasEffectChains);
      document.querySelector("#developmentChatInput").disabled = !hasProject || !hasPremiumAi;
      document.querySelector("#developmentChatSubmit").disabled = !hasProject || !hasPremiumAi;
      document.querySelector("#developmentChatPremiumHint").classList.toggle("hidden", hasPremiumAi);
      document.querySelectorAll("[data-development-quick-prompt]").forEach((button) => {
        button.disabled = !hasProject || !hasPremiumAi;
      });
      document.querySelector("#saveDevelopmentArchitectureButton").disabled = !hasProject || !state.developmentPlatform.architectureDiagram?.source;
      document.querySelector("#acceptDevelopmentArchitectureButton").disabled = !canContinue;
      document.querySelector("#developmentChatInput").placeholder = !hasPremiumAi
        ? "KI-Unterstuetzung ist mit Premium verfuegbar."
        : hasProject
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
      const usesProjectTemplate = currentProjectUsesTemplate();
      const project = currentProject();
      if (continueToIde && !functionCoverage.complete) {
        const missing = functionCoverage.missing.length ? ` Nicht verbunden: ${functionCoverage.missing.join(", ")}.` : "";
        const invalid = functionCoverage.invalid?.length ? ` Nicht zulaessig: ${functionCoverage.invalid.map((relation) => `${relation.source.label} → ${relation.target.label}`).join(", ")}.` : "";
        setActionStatus(`Bitte zuerst die Verbindungen nach dem Komponenten-Metamodell klaeren.${missing}${invalid}`);
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
      if (processor.family === "esp32") {
        return processor.variant === "ESP32" ? "ESP32 (klassisch)" : processor.variant;
      }
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
      const controlAssignments = controlUnitAssignments(source);
      const boards = availableProcessorBoards();
      let deviceIndex = 0;
      const components = abstractArchitectureComponents(source).map((component) => {
        const merged = {
          ...component,
          ...(previous.get(component.component_id) || {}),
          label: component.label,
          abstract_type: component.abstract_type,
        };
        if (["sensor", "actuator"].includes(merged.abstract_type) && !merged.target_device_id && controlAssignments.get(merged.component_id)) {
          merged.target_device_id = controlAssignments.get(merged.component_id);
        }
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

    function controlUnitAssignments(source) {
      const components = abstractArchitectureComponents(source);
      const byId = new Map(components.map((component) => [component.component_id, component]));
      const assignments = new Map();
      componentConnectionAssignments(source).forEach((targetId, sourceId) => {
        const sourceComponent = byId.get(sourceId);
        const targetComponent = byId.get(targetId);
        const allocationSide = globalThis.DevelopmentComponentMetamodel?.controlUnitForRelation(sourceComponent?.abstract_type, targetComponent?.abstract_type);
        if (allocationSide === "target") {
          assignments.set(sourceComponent.component_id, targetComponent.component_id);
        }
        if (allocationSide === "source") assignments.set(targetComponent.component_id, sourceComponent.component_id);
      });
      return assignments;
    }

    function componentConnectionAssignments(source) {
      const assignments = new Map();
      String(source || "").split(/\r?\n/).forEach((line) => {
        const relation = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[-.]+>\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (relation) assignments.set(relation[1], relation[2]);
      });
      return assignments;
    }

    function hardwareComponentType(label, plantUmlType) {
      const text = String(label || "").toLowerCase();
      if (String(plantUmlType).toLowerCase() === "actor") return "actor";
      // The start architecture is persisted as PlantUML.  Preserve the semantic
      // component types of managed project services when it is read back into
      // the editor; otherwise they would all fall through to "structural".
      if (/telemetrie.api/.test(text)) return "telemetry_api";
      if (/projekt.speicher/.test(text)) return "project_storage";
      if (/projekt.runtime.daten/.test(text)) return "project_runtime_data";
      if (/ereignis.worker/.test(text)) return "event_worker";
      if (/ereignis.dispatcher/.test(text)) return "event_dispatcher";
      if (/projekt.push.versand|benachrichtigungsdienst/.test(text)) return "notification_service";
      if (/iot.?device|iot.?zielger(?:ae|ä)t|esp32|esp8266|arduino|raspberry|processor.?board|datenlogger/.test(text)) return "iot_device";
      if (/sensor|fuehler|fuhler|temperatur|feuchte|helligkeit|wasserstand|ntc|ptc|pt1000/.test(text)) return "sensor";
      if (/aktor|motor|relais|ventil|servo|summer|buzzer|led/.test(text)) return "actuator";
      if (/pwa|iphone|smartphone|mobile app/.test(text)) return "smartphone_app";
      if (/browser|dashboard/.test(text)) return "browser_app";
      if (/server|api|vps|koordination|webserver/.test(text)) return "server_api";
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
        const inventoryDevice = (state.devices || []).find((device) => device.device_id === component.inventory_device_id);
        const inventoryBoard = boards.find((board) => DevelopmentHardwareModel.boardIdentifier(board) === inventoryDevice?.hardware_profile_id);
        const processorKey = inventoryBoard ? DevelopmentHardwareModel.processorKey(inventoryBoard) : DevelopmentHardwareModel.selectionForComponent(component, boards);
        const compatibleBoards = DevelopmentHardwareModel.boardsForProcessor(boards, processorKey);
        const useInventory = Boolean(inventoryDevice);
        return `<div class="hardware-board-selection">
          <fieldset class="hardware-choice"><legend>Board aus Inventar verwenden? <button type="button" class="hardware-inline-help" data-hardware-inventory-help title="Ohne Inventar-Board kann die Zuordnung später nachgeholt werden.">?</button></legend>
            <label><input type="radio" name="hardware-source-${escapeAttribute(component.component_id)}" data-hardware-source value="inventory" ${useInventory ? "checked" : ""}> Ja</label>
            <label><input type="radio" name="hardware-source-${escapeAttribute(component.component_id)}" data-hardware-source value="catalog" ${useInventory ? "" : "checked"}> Nein</label>
          </fieldset>
          ${useInventory ? `<label>Inventar-Board<select data-hardware-field="inventory_device_id">${(state.devices || []).filter((device) => device.hardware_profile_id).map((device) => `<option value="${escapeAttribute(device.device_id)}" ${selected(component.inventory_device_id, device.device_id)}>${escapeHtml(device.display_name || device.device_id)} · ${inventoryConnectLabel(device)}</option>`).join("")}</select><small>${inventoryConnectLabel(inventoryDevice)}. Board und Prozessor werden übernommen.</small></label>` : `
          <label>Prozessor <button type="button" class="hardware-inline-help" data-hardware-processor-help aria-label="Hilfe zu unterstützten Boards" title="Unterstützte Boards anzeigen">?</button><select data-hardware-processor>
            <option value="">Prozessor waehlen</option>
            ${DevelopmentHardwareModel.processorOptions(boards).map((processor) => `<option value="${escapeAttribute(processor.key)}" ${selected(processorKey, processor.key)}>${escapeHtml(processorLabel(processor))}</option>`).join("")}
          </select></label>
          <label>Board<select data-hardware-field="board_profile_id" ${processorKey ? "" : "disabled"}>
            <option value="">${processorKey ? "Board waehlen" : "Zuerst Prozessor waehlen"}</option>
            ${compatibleBoards.map((board) => `<option value="${escapeAttribute(DevelopmentHardwareModel.boardIdentifier(board))}" ${selected(component.board_profile_id, DevelopmentHardwareModel.boardIdentifier(board))}>${escapeHtml(processorBoardLabel(board))}</option>`).join("")}
          </select></label>`}
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
        { id: "stepper_motor", label: "Schrittmotor" },
        { id: "synchronous_motor", label: "Synchronmotor / BLDC / PMSM" },
        { id: "relay", label: "Relais" },
        { id: "servo", label: "Servo" },
        { id: "led", label: "LED" },
        { id: "buzzer", label: "Summer" },
      ];
    }

    function motorDriverTypes(concreteType) {
      const drivers = {
        dc_motor: [
          { id: "h_bridge", label: "H-Brücke (Drehrichtung und Drehzahl)", resources: "PWM + 2 GPIO" },
          { id: "low_side_mosfet", label: "MOSFET-Treiber (eine Drehrichtung)", resources: "PWM + GPIO" },
        ],
        servo: [
          { id: "servo_pwm", label: "Servo-PWM-Treiber", resources: "PWM + Zeitgeber" },
        ],
        stepper_motor: [
          { id: "step_dir", label: "STEP/DIR-Schrittmotortreiber", resources: "Zeitgeber/RMT + 2 GPIO" },
          { id: "four_phase", label: "4-Phasen-Treiber", resources: "4 GPIO + Zeitgeber" },
        ],
        synchronous_motor: [
          { id: "three_phase_foc", label: "3-Phasen-Treiber mit FOC", resources: "Motor-PWM + 3 Phasen + ADC + Rotorlage" },
          { id: "three_phase_six_step", label: "3-Phasen-Treiber mit 6-Step-Kommutierung", resources: "Motor-PWM + 3 Phasen + Rotorlage" },
        ],
      };
      return drivers[concreteType] || [];
    }

    function motorDriverControls(component) {
      const properties = component.properties || {};
      const drivers = motorDriverTypes(component.concrete_type);
      if (!drivers.length) return "";
      const selectedDriver = drivers.find((driver) => driver.id === properties.motor_driver_type);
      return `<label>Motorsteuerung<select data-hardware-property="motor_driver_type">
        <option value="">Motorsteuerung waehlen</option>
        ${drivers.map((driver) => `<option value="${escapeAttribute(driver.id)}" ${selected(properties.motor_driver_type, driver.id)}>${escapeHtml(driver.label)}</option>`).join("")}
      </select><small>${escapeHtml(selectedDriver?.resources || "Die benötigten Boardressourcen werden aus der Motorsteuerung abgeleitet.")}</small></label>`;
    }

    function measurementAcquisitionControls(component) {
      if (!component.concrete_type) return "";
      const properties = component.properties || {};
      const mode = properties.measurement_mode || "live";
      const intervalValue = properties.sampling_interval_value || 5;
      const intervalUnit = properties.sampling_interval_unit || "seconds";
      const samplesPerRecord = properties.samples_per_record || 5;
      const aggregation = properties.aggregation || "mean";
      const storageMode = properties.storage_mode || "local_history";
      const intervalLabels = { seconds: "Sekunden", minutes: "Minuten", hours: "Stunden" };
      const aggregationLabels = { last: "letzten Wert", mean: "Mittelwert", min: "Minimum", max: "Maximum", rms: "Effektivwert (RMS)" };
      const recordInterval = Number(intervalValue) * Number(samplesPerRecord);
      const loggerSummary = Number.isFinite(recordInterval)
        ? `Alle ${intervalValue} ${intervalLabels[intervalUnit] || intervalUnit} messen; nach ${samplesPerRecord} Werten den ${aggregationLabels[aggregation] || aggregation} speichern (ca. alle ${recordInterval} ${intervalLabels[intervalUnit] || intervalUnit}).`
        : "Messintervall und Wertefenster bestimmen, wann ein Datensatz gespeichert wird.";
      return `
        <label>Messmodus<select data-hardware-property="measurement_mode">
          <option value="live" ${selected(mode, "live")}>Live-Wert</option>
          <option value="periodic_log" ${selected(mode, "periodic_log")}>Zyklischer Datenlogger</option>
        </select><small>${mode === "periodic_log" ? "Der Runtime-Zeitgeber übernimmt die zyklische Ausführung." : "Es wird nur der aktuelle Messwert bereitgestellt."}</small></label>
        ${mode === "periodic_log" ? `
          <label>Messintervall<input data-hardware-property="sampling_interval_value" type="number" min="0.001" step="any" value="${escapeAttribute(intervalValue)}"><small>Abstand zwischen zwei Rohmessungen</small></label>
          <label>Einheit<select data-hardware-property="sampling_interval_unit"><option value="seconds" ${selected(intervalUnit, "seconds")}>Sekunden</option><option value="minutes" ${selected(intervalUnit, "minutes")}>Minuten</option><option value="hours" ${selected(intervalUnit, "hours")}>Stunden</option></select></label>
          <label>Werte pro Datensatz<input data-hardware-property="samples_per_record" type="number" min="1" step="1" value="${escapeAttribute(samplesPerRecord)}"><small>Größe des Auswertefensters</small></label>
          <label>Auswertung<select data-hardware-property="aggregation"><option value="last" ${selected(aggregation, "last")}>Letzter Wert</option><option value="mean" ${selected(aggregation, "mean")}>Mittelwert</option><option value="min" ${selected(aggregation, "min")}>Minimum</option><option value="max" ${selected(aggregation, "max")}>Maximum</option><option value="rms" ${selected(aggregation, "rms")}>Effektivwert (RMS)</option></select></label>
          <label>Speicherziel<select data-hardware-property="storage_mode"><option value="local_history" ${selected(storageMode, "local_history")}>Lokale Messwerthistorie</option><option value="publish" ${selected(storageMode, "publish")}>An angebundenes Ziel übertragen</option><option value="latest_only" ${selected(storageMode, "latest_only")}>Nur letzten Datensatz halten</option></select><small>Lokale Historien werden im persistenten Device-Speicher geführt.</small></label>
          ${storageMode === "local_history" ? `<label>Max. Datensätze<input data-hardware-property="retention_records" type="number" min="1" step="1" value="${escapeAttribute(properties.retention_records || 1000)}"><small>Älteste Einträge werden anschließend überschrieben.</small></label>` : ""}
          <label>Datenlogger-Ablauf<small>${escapeHtml(loggerSummary)}</small></label>
        ` : ""}`;
    }

    function hardwarePropertyControls(component) {
      const properties = component.properties || {};
      if (component.abstract_type === "iot_device") {
        return `<span class="hardware-not-applicable">Board über Inventar oder Katalog wählen.</span>`;
      }
      if (component.abstract_type === "sensor") {
        const electrical = component.concrete_type === "pt1000" ? `
          <label>R0<input data-hardware-property="nominal_resistance_ohm" type="number" min="100" value="${escapeAttribute(properties.nominal_resistance_ohm || 1000)}"><small>Ohm bei 0 Grad C</small></label>
          <label>Leiter<select data-hardware-property="wire_count">${[2, 3, 4].map((count) => `<option value="${count}" ${selected(properties.wire_count || 2, count)}>${count}-Leiter</option>`).join("")}</select></label>`
          : ["ntc", "ptc"].includes(component.concrete_type) ? `
          <label>Nennwiderstand<input data-hardware-property="nominal_resistance_ohm" type="number" min="100" value="${escapeAttribute(properties.nominal_resistance_ohm || 10000)}"><small>Ohm</small></label>` : "";
        return `${electrical}${measurementAcquisitionControls(component)}`;
      }
      if (motorDriverTypes(component.concrete_type).length) return `
        ${motorDriverControls(component)}
        <label>Nennspannung<input data-hardware-property="nominal_voltage_v" type="number" min="1" step="0.1" value="${escapeAttribute(properties.nominal_voltage_v || 5)}"><small>Volt</small></label>
        <label>Maximalstrom<input data-hardware-property="max_current_a" type="number" min="0.01" step="0.01" value="${escapeAttribute(properties.max_current_a || 0.5)}"><small>Ampere</small></label>`;
      if (component.abstract_type === "actuator") return `<label>Beschreibung<input data-hardware-property="description" value="${escapeAttribute(properties.description || "")}" placeholder="Bauart oder wichtige Kenndaten"></label>`;
      return `<span class="hardware-not-applicable">-</span>`;
    }

    function compatibleInventoryDevices(component) {
      if (!component.board_profile_id) return [];
      return (Array.isArray(state.devices) ? state.devices : []).filter((device) => (
        String(device.hardware_profile_id || "") === String(component.board_profile_id)
      ));
    }

    function inventoryConnectLabel(device) {
      const profile = device?.instance_configuration?.basissoftware_profile;
      if (!profile || device?.connectivity_status === "unsupported") return "Nicht connect-fähig";
      return device?.connectivity_status === "online" ? "Connect-fähig · online" : "Connect-fähig · noch nicht online";
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
        ${["dc_motor", "stepper_motor"].includes(component.concrete_type) ? `<label>Richtungspin<select data-hardware-field="secondary_pin"><option value="">Pin waehlen</option>${boardPins(targetDevice?.board_profile_id, "digital_output").map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(component.secondary_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>` : ""}
        ${component.concrete_type === "synchronous_motor" ? synchronousMotorConnectionControls(component, targetDevice) : ""}
        ${component.signal_type === "incremental_ab" ? `<label>Kanal B<select data-hardware-field="secondary_pin"><option value="">Pin waehlen</option>${pinOptions.filter((pin) => pin !== component.pin || pin === component.secondary_pin).map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(component.secondary_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>` : ""}
      `;
    }

    function synchronousMotorConnectionControls(component, targetDevice) {
      const properties = component.properties || {};
      const phasePins = boardPins(targetDevice?.board_profile_id, component);
      const analogPins = boardPins(targetDevice?.board_profile_id, "analog_sensor");
      return `
        <label>Phase V<select data-hardware-property="phase_v_pin"><option value="">PWM-Pin waehlen</option>${phasePins.map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(properties.phase_v_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>
        <label>Phase W<select data-hardware-property="phase_w_pin"><option value="">PWM-Pin waehlen</option>${phasePins.map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(properties.phase_w_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>
        <label>Strommessung (optional)<select data-hardware-property="current_sense_pin"><option value="">Keine / extern</option>${analogPins.map((pin) => `<option value="${escapeAttribute(pin)}" ${selected(properties.current_sense_pin, pin)}>${escapeHtml(pin)}</option>`).join("")}</select></label>
        <label>Rotorlage<select data-hardware-property="rotor_feedback"><option value="">Ohne Sensor / sensorlos</option><option value="hall" ${selected(properties.rotor_feedback, "hall")}>Hall-Sensoren</option><option value="encoder" ${selected(properties.rotor_feedback, "encoder")}>Encoder</option></select></label>`;
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
      if (["dc_motor", "servo", "synchronous_motor"].includes(type)) return type === "synchronous_motor" ? "Phase U" : "PWM-Pin";
      if (type === "stepper_motor") return "STEP-Pin";
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
      if (["dc_motor", "servo", "synchronous_motor"].includes(concreteType) && Array.isArray(profile.pwm_pins)) return profile.pwm_pins;
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
      if (["dc_motor", "servo", "synchronous_motor"].includes(concreteType)) return digital.filter((pin) => /D3|D5|D6|D9|D10|D11|GPIO4|GPIO5|GPIO12|GPIO13|GPIO14|GPIO18|GPIO19|GPIO23|GPIO25|GPIO26|GPIO27/.test(pin));
      return digital;
    }

    function handleHardwareConfigurationChange() {
      state.developmentPlatform.hardwareConfiguration = collectHardwareConfiguration();
      renderHardwareComponentTable(state.developmentPlatform.hardwareConfiguration);
      syncHardwareActions(state.developmentPlatform.hardwareConfiguration);
    }

    function handleHardwareHelpClick(event) {
      if (event.target.closest("[data-hardware-inventory-help]")) {
        setActionStatus("Kein Inventar-Board zu wählen ist erlaubt. Die konkrete Gerätezuordnung kann später nachgeholt werden; Flash und Online-Prüfung sind dann bis zur Zuordnung nicht verfügbar.");
        return;
      }
      if (!event.target.closest("[data-hardware-processor-help]")) return;
      openHelpTopic?.("supported-devices");
    }

    function collectHardwareConfiguration() {
      const current = state.developmentPlatform.hardwareConfiguration || { schema_version: 4, components: [] };
      const boards = availableProcessorBoards();
      const components = current.components.map((component) => {
        const row = document.querySelector(`[data-hardware-component="${CSS.escape(component.component_id)}"]`);
        if (!row) return component;
        const next = { ...component, properties: { ...(component.properties || {}) } };
        row.querySelectorAll("[data-hardware-field]").forEach((input) => { next[input.dataset.hardwareField] = input.value; });
        const source = row.querySelector("[data-hardware-source]:checked")?.value || "catalog";
        if (source !== "inventory") next.inventory_device_id = "";
        if (source === "inventory" && !next.inventory_device_id) {
          next.inventory_device_id = (state.devices || []).find((device) => device.hardware_profile_id)?.device_id || "";
        }
        const inventoryDevice = (state.devices || []).find((device) => device.device_id === next.inventory_device_id);
        const inventoryBoard = boards.find((board) => DevelopmentHardwareModel.boardIdentifier(board) === inventoryDevice?.hardware_profile_id);
        const processorInput = row.querySelector("[data-hardware-processor]");
        const processorSelection = inventoryBoard
          ? DevelopmentHardwareModel.applyProcessorSelection({ ...next, board_profile_id: DevelopmentHardwareModel.boardIdentifier(inventoryBoard) }, DevelopmentHardwareModel.processorKey(inventoryBoard), boards)
          : processorInput ? DevelopmentHardwareModel.applyProcessorSelection(next, processorInput.value, boards) : next;
        Object.assign(next, processorSelection);
        if (next.inventory_device_id && !inventoryBoard) {
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
      const driver = component.properties?.motor_driver_type || "";
      if (component.concrete_type === "dc_motor") return { type: "motor_driver", label: "DC-Motorsteuerung", stages: ["PWM / Richtung", driver === "low_side_mosfet" ? "MOSFET-Treiber" : "H-Bruecke", "DC-Motor"] };
      if (component.concrete_type === "servo") return { type: "servo_driver", label: "Servo-Steuerung", stages: ["Zeitgeber", "Servo-PWM", "Servo"] };
      if (component.concrete_type === "stepper_motor") return { type: "stepper_driver", label: "Schrittmotor-Steuerung", stages: ["Zeitgeber / RMT", driver === "four_phase" ? "4-Phasen-Treiber" : "STEP/DIR-Treiber", "Schrittmotor"] };
      if (component.concrete_type === "synchronous_motor") return { type: "synchronous_motor_driver", label: "Synchronmotor-Steuerung", stages: [driver === "three_phase_six_step" ? "6-Step-Kommutierung" : "FOC", "Motor-PWM / ADC / Rotorlage", "3-Phasen-Leistungstreiber", "BLDC / PMSM"] };
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
          if (component.properties?.measurement_mode === "periodic_log") {
            if (!(Number(component.properties?.sampling_interval_value) > 0)) missing.push(`${component.label}: Messintervall`);
            if (!(Number(component.properties?.samples_per_record) >= 1)) missing.push(`${component.label}: Werte pro Datensatz`);
            if (!component.properties?.aggregation) missing.push(`${component.label}: Auswertung`);
            if (!component.properties?.storage_mode) missing.push(`${component.label}: Speicherziel`);
          }
        }
        if (["sensor", "actuator"].includes(component.abstract_type)) {
          if (!component.concrete_type) missing.push(`${component.label}: konkreter Typ`);
          if (!component.target_device_id) missing.push(`${component.label}: IoT-Device`);
          if (!component.pin) missing.push(`${component.label}: Pin`);
          if (motorDriverTypes(component.concrete_type).length && !component.properties?.motor_driver_type) missing.push(`${component.label}: Motorsteuerung`);
          if (["dc_motor", "stepper_motor"].includes(component.concrete_type) && !component.secondary_pin) missing.push(`${component.label}: Richtungspin`);
          if (component.concrete_type === "synchronous_motor") {
            if (!component.properties?.phase_v_pin) missing.push(`${component.label}: Phase V`);
            if (!component.properties?.phase_w_pin) missing.push(`${component.label}: Phase W`);
            const phasePins = [component.pin, component.properties?.phase_v_pin, component.properties?.phase_w_pin].filter(Boolean);
            if (new Set(phasePins).size !== phasePins.length) missing.push(`${component.label}: Phasenpins muessen verschieden sein`);
          }
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
      if (/Messintervall/.test(detail)) return "Gib ein positives Intervall für die zyklische Messung an.";
      if (/Werte pro Datensatz/.test(detail)) return "Lege fest, wie viele Rohwerte zu einem Datensatz zusammengefasst werden.";
      if (/Auswertung/.test(detail)) return "Wähle beispielsweise Mittelwert, Minimum, Maximum oder RMS.";
      if (/Speicherziel/.test(detail)) return "Wähle lokale Historie, Übertragung oder nur den letzten Datensatz.";
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
        const configurationStep = state.developmentPlatform.workflowStep === "configuration";
        target.classList.toggle("hidden", !configurationStep);
        target.innerHTML = configurationStep ? `<p class="helper-text">Noch keine Architektur vorhanden. Beschreibe sie im KI-Chat oder waehle ein Template.</p>` : "";
        return;
      }
      target.classList.remove("hidden");
      target.innerHTML = `
        <figure class="plantuml-viewer">
          <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(diagram.source)}" alt="${escapeAttribute(diagram.title || "Architekturdiagramm")}">
          <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
        </figure>
      `;
      target.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
    }

    function plantUmlFunctionCoverage(source) {
      const components = abstractArchitectureComponents(source);
      const byId = new Map(components.map((component) => [component.component_id, component]));
      const connected = new Set();
      const invalid = [];
      const lines = String(source || "").split(/\r?\n/);
      lines.forEach((line) => {
        const arrow = line.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s+[-.]+>\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (!arrow) return;
        const sourceComponent = byId.get(arrow[1]);
        const targetComponent = byId.get(arrow[2]);
        if (!sourceComponent || !targetComponent) return;
        if (!globalThis.DevelopmentComponentMetamodel?.validatesRelation(sourceComponent.abstract_type, targetComponent.abstract_type)) {
          invalid.push({ source: sourceComponent, target: targetComponent });
          return;
        }
        connected.add(arrow[1]);
        connected.add(arrow[2]);
      });
      const elements = components.map((component) => component.component_id);
      const missing = elements.filter((alias) => !connected.has(alias));
      return {
        element_count: elements.length,
        arrow_count: lines.filter((line) => /\b[A-Za-z_][A-Za-z0-9_]*\s+[-.]+>\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(line)).length,
        complete: elements.length > 0 && missing.length === 0 && invalid.length === 0,
        missing,
        invalid,
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
      enterProjectStart,
    };
  }

  return { create };
})();
