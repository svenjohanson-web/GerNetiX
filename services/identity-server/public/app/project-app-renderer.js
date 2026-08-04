(function exposeProjectAppRenderer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProjectAppRenderer = api;
})(typeof globalThis === "object" ? globalThis : this, function createProjectAppRenderer() {
  const WIDGET_TYPES = new Set(["text", "status", "metric", "chart", "toggle", "select", "schedule", "button"]);
  const DISPLAY_TYPES = new Set(["default", "compact", "prominent"]);

  function render(options = {}) {
    const manifest = options.manifest || {};
    const snapshot = options.snapshot || {};
    assertManifest(manifest);
    const bindingValues = snapshot.bindings || {};
    const settingValues = snapshot.settings || {};
    const settings = new Map((manifest.settings || []).map((setting) => [setting.key, setting]));
    const bindings = new Map((manifest.bindings || []).map((binding) => [binding.id, binding]));
    const actions = new Map((manifest.actions || []).map((action) => [action.id, action]));
    return `
      <article class="project-app" data-project-app="${escapeAttribute(manifest.app_id)}">
        <header class="project-app-header">
          <p class="eyebrow">Projekt-App</p>
          <h2>${escapeHtml(manifest.title)}</h2>
          ${manifest.description ? `<p>${escapeHtml(manifest.description)}</p>` : ""}
        </header>
        <nav class="project-app-page-nav" aria-label="Projekt-App Seiten">
          ${(manifest.pages || []).map((page, index) => `<button type="button" data-project-app-page-target="${escapeAttribute(page.id)}"${index === 0 ? " aria-current=\"page\"" : ""}>${escapeHtml(page.title)}</button>`).join("")}
        </nav>
        <div class="project-app-pages">
          ${(manifest.pages || []).map((page, index) => renderPage(page, index, { actions, bindings, bindingValues, settings, settingValues })).join("")}
        </div>
      </article>
    `;
  }

  function renderPage(page, index, context) {
    return `
      <section class="project-app-page" data-project-app-page="${escapeAttribute(page.id)}"${index === 0 ? "" : " hidden"}>
        <header><h3>${escapeHtml(page.title)}</h3>${page.description ? `<p>${escapeHtml(page.description)}</p>` : ""}</header>
        <div class="project-app-widget-grid">
          ${(page.widgets || []).map((widget) => renderWidget(widget, context)).join("")}
        </div>
      </section>
    `;
  }

  function renderWidget(widget, context) {
    if (!WIDGET_TYPES.has(widget.type)) throw new Error(`Unsupported project app widget: ${widget.type}`);
    const display = DISPLAY_TYPES.has(widget.display) ? widget.display : "default";
    const binding = widget.binding_id ? context.bindings.get(widget.binding_id) : null;
    const action = widget.action_id ? context.actions.get(widget.action_id) : null;
    const value = binding ? context.bindingValues[binding.id] : undefined;
    const setting = binding?.type === "setting" ? context.settings.get(binding.key) : null;
    const settingValue = setting ? valueOrDefault(context.settingValues[setting.key], setting.default) : value;
    const heading = widget.title ? `<h4>${escapeHtml(widget.title)}</h4>` : "";
    const body = renderWidgetBody(widget, { action, binding, setting, value: settingValue });
    return `<section class="project-app-widget project-app-widget-${escapeAttribute(widget.type)} is-${escapeAttribute(display)}" data-project-app-widget="${escapeAttribute(widget.id)}">${heading}${body}</section>`;
  }

  function renderWidgetBody(widget, context) {
    if (widget.type === "text") return `<p>${escapeHtml(widget.text || "")}</p>`;
    if (widget.type === "status") return `<output class="project-app-status">${escapeHtml(formatValue(context.value))}</output>`;
    if (widget.type === "metric") return `<output class="project-app-metric">${escapeHtml(formatValue(context.value))}</output>`;
    if (widget.type === "chart") return renderChart(context.value);
    if (widget.type === "toggle") return renderToggle(widget, context);
    if (widget.type === "select") return renderSelect(widget, context);
    if (widget.type === "schedule") return renderSchedule(widget, context);
    return renderButton(widget, context);
  }

  function renderChart(value) {
    const points = Array.isArray(value) ? value.slice(-24) : [];
    if (!points.length) return `<p class="project-app-empty">Noch keine Messwerte</p>`;
    const numeric = points.map((point) => Number(typeof point === "object" ? point.value : point)).filter(Number.isFinite);
    if (!numeric.length) return `<p class="project-app-empty">Noch keine Messwerte</p>`;
    const maximum = Math.max(...numeric, 1);
    return `<div class="project-app-chart" role="img" aria-label="${escapeAttribute(`${numeric.length} Messwerte`)}">${numeric.map((point) => `<span style="--project-app-value:${Math.max(0, point) / maximum}" title="${escapeAttribute(String(point))}"></span>`).join("")}</div>`;
  }

  function renderToggle(widget, { action, setting, value }) {
    assertSettingAction(widget, action, setting);
    return `<label class="project-app-control"><input type="checkbox" data-project-app-action="${escapeAttribute(action.id)}" data-project-app-setting="${escapeAttribute(setting.key)}"${value ? " checked" : ""}><span>${escapeHtml(setting.label)}</span></label>${setting.description ? `<small>${escapeHtml(setting.description)}</small>` : ""}`;
  }

  function renderSelect(widget, { action, setting, value }) {
    assertSettingAction(widget, action, setting);
    return `<label class="project-app-control"><span>${escapeHtml(setting.label)}</span><select data-project-app-action="${escapeAttribute(action.id)}" data-project-app-setting="${escapeAttribute(setting.key)}">${(setting.options || []).map((option) => `<option value="${escapeAttribute(option.value)}"${String(option.value) === String(value) ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>${setting.description ? `<small>${escapeHtml(setting.description)}</small>` : ""}`;
  }

  function renderSchedule(widget, { action, setting, value }) {
    assertSettingAction(widget, action, setting);
    const schedule = value && typeof value === "object" ? value : {};
    return `<fieldset class="project-app-schedule" data-project-app-schedule-enabled="${schedule.enabled !== false}" data-project-app-schedule-timezone="${escapeAttribute(schedule.timezone || "Europe/Berlin")}"><legend>${escapeHtml(setting.label)}</legend><label>Von <input type="time" value="${escapeAttribute(schedule.start || "")}" data-project-app-schedule-start="${escapeAttribute(setting.key)}"></label><label>Bis <input type="time" value="${escapeAttribute(schedule.end || "")}" data-project-app-schedule-end="${escapeAttribute(setting.key)}"></label><button type="button" data-project-app-action="${escapeAttribute(action.id)}" data-project-app-setting="${escapeAttribute(setting.key)}">Speichern</button></fieldset>`;
  }

  function renderButton(widget, { action }) {
    if (!action) throw new Error(`Project app button ${widget.id} requires a known action.`);
    return `<button type="button" data-project-app-action="${escapeAttribute(action.id)}"${action.confirmation ? ` data-project-app-confirmation="${escapeAttribute(action.confirmation)}"` : ""}>${escapeHtml(widget.text || widget.title || "Ausführen")}</button>`;
  }

  function bind(target, handlers = {}) {
    if (!target) return;
    target.querySelectorAll("[data-project-app-page-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const pageId = button.dataset.projectAppPageTarget;
        target.querySelectorAll("[data-project-app-page]").forEach((page) => { page.hidden = page.dataset.projectAppPage !== pageId; });
        target.querySelectorAll("[data-project-app-page-target]").forEach((candidate) => candidate.removeAttribute("aria-current"));
        button.setAttribute("aria-current", "page");
      });
    });
    target.querySelectorAll("[data-project-app-action]").forEach((control) => {
      const eventName = control.matches("select,input[type=checkbox]") ? "change" : "click";
      control.addEventListener(eventName, async () => {
        const confirmation = control.dataset.projectAppConfirmation;
        if (confirmation && typeof root.confirm === "function" && !root.confirm(confirmation)) return;
        const settingKey = control.dataset.projectAppSetting || "";
        const value = readControlValue(target, control, settingKey);
        await handlers.onAction?.({ actionId: control.dataset.projectAppAction, settingKey, value, control });
      });
    });
  }

  function readControlValue(target, control, settingKey) {
    if (control.matches("input[type=checkbox]")) return control.checked;
    if (control.matches("select,input:not([type=time])")) return control.value;
    if (settingKey) {
      const schedule = control.closest("[data-project-app-schedule-timezone]");
      return {
        enabled: schedule?.dataset.projectAppScheduleEnabled !== "false",
        start: target.querySelector(`[data-project-app-schedule-start="${cssEscape(settingKey)}"]`)?.value || "",
        end: target.querySelector(`[data-project-app-schedule-end="${cssEscape(settingKey)}"]`)?.value || "",
        timezone: schedule?.dataset.projectAppScheduleTimezone || "Europe/Berlin",
      };
    }
    return undefined;
  }

  function assertManifest(manifest) {
    if (manifest.schema !== "gernetix.project-app/v1" || manifest.manifest_version !== 1) throw new Error("Unsupported project app manifest.");
    if (!manifest.app_id || !manifest.title || !Array.isArray(manifest.pages)) throw new Error("Incomplete project app manifest.");
  }

  function assertSettingAction(widget, action, setting) {
    if (!setting || !action || action.type !== "update_setting" || action.setting_key !== setting.key) {
      throw new Error(`Project app control ${widget.id} requires a matching update_setting action.`);
    }
  }

  function valueOrDefault(value, fallback) { return value === undefined ? fallback : value; }
  function formatValue(value) {
    if (value === undefined || value === null || value === "") return "Nicht verfügbar";
    if (typeof value === "boolean") return value ? "Aktiv" : "Inaktiv";
    if (typeof value === "object") return value.label || value.value || "Verfügbar";
    return String(value);
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]); }
  function escapeAttribute(value) { return escapeHtml(value); }
  function cssEscape(value) { return typeof CSS === "object" && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }

  return { bind, render };
});
