(function exposeProjectAppController(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProjectAppController = api;
})(typeof globalThis === "object" ? globalThis : this, function createProjectAppController() {
  function create({ getJson, putJson, renderer, escapeHtml, escapeAttribute, onDevicesChanged }) {
    let activeProjectId = "";
    let snapshot = null;

    async function render(projectId) {
      const target = document.querySelector("#projectAppContent");
      if (!target) return;
      activeProjectId = projectId || "";
      if (!activeProjectId) {
        target.innerHTML = '<section class="panel"><h2>Anwendung nicht gefunden</h2><p>Öffne eine persönliche Anwendung über „Meine Anwendungen“.</p></section>';
        return;
      }
      target.innerHTML = '<section class="panel"><p>Anwendung wird geladen …</p></section>';
      try {
        const cacheKey = Date.now();
        snapshot = await getJson(`/api/platform/projects/${encodeURIComponent(activeProjectId)}/project-app?refresh=${cacheKey}`);
        draw(target);
      } catch (error) {
        target.innerHTML = `<section class="panel"><h2>Anwendung nicht verfügbar</h2><p>${escapeHtml(error.message || "Die Projektoberfläche konnte nicht geladen werden.")}</p></section>`;
      }
    }

    function draw(target) {
      target.innerHTML = `${renderDeviceManager()}${renderer.render({
        manifest: snapshot.manifest,
        snapshot: { settings: snapshot.values || {}, bindings: snapshot.bindings || {} },
      })}`;
      const saveDevicesButton = target.querySelector("[data-save-project-app-devices]");
      saveDevicesButton?.addEventListener("click", () => applyDevices(saveDevicesButton));
      renderer.bind(target, { onAction: applyAction });
    }

    function renderDeviceManager() {
      const assignedIds = new Set(snapshot.assigned_device_ids || []);
      const devices = snapshot.available_devices || [];
      const choices = devices.length ? devices.map((device) => `
        <label class="project-app-device-choice${assignedIds.has(device.device_id) ? " is-assigned" : ""}${device.compatible === false ? " is-incompatible" : ""}">
          <input type="checkbox" value="${escapeAttribute(device.device_id)}" data-project-app-device${assignedIds.has(device.device_id) ? " checked" : ""}${device.compatible === false ? " disabled" : ""}>
          <span>
            <strong>${escapeHtml(device.display_name || device.device_id)}</strong>
            <small>${escapeHtml(device.connectivity_status || "unknown")}${device.firmware_version ? ` · Firmware ${escapeHtml(device.firmware_version)}` : ""}</small>
            ${device.compatible === false ? `<small class="project-app-device-rejection">Nicht geeignet: ${escapeHtml((device.missing_requirements || []).join(", ") || "Hardwareanforderungen nicht erfüllt")}</small>` : ""}
          </span>
        </label>
      `).join("") : '<p class="project-app-empty">Noch keine Geräte mit diesem Account verbunden.</p>';
      const requirements = snapshot.manifest?.hardware_requirements;
      const requirementItems = requirements ? [
        requirements.processor_variant ? `<li><span aria-hidden="true">✓</span><strong>${escapeHtml(requirements.processor_variant)}</strong><small>verbindlicher Prozessor</small></li>` : "",
        ...(requirements.features || []).map((feature) => `<li><span aria-hidden="true">✓</span><strong>${escapeHtml(feature.label)}</strong><small>Mindestanforderung</small></li>`),
      ].filter(Boolean).join("") : "";
      return `
        <section class="panel project-app-device-manager" aria-labelledby="projectAppDevicesTitle">
          <header>
            <div><p class="eyebrow">Multi-Device</p><h2 id="projectAppDevicesTitle">${snapshot.manifest?.app_id === "nexi" ? "Nexi-Geräte" : "Anwendungsgeräte"}</h2></div>
            <strong>${assignedIds.size} zugeordnet</strong>
          </header>
          <p>Wähle alle Geräte, die zu dieser Anwendung gehören. Familienregeln und Limits gelten gemeinsam; Status und Firmware bleiben je Gerät sichtbar.</p>
          ${requirementItems ? `<div class="project-app-hardware-requirements"><h3>Hardware-Mindestanforderungen</h3><p>Diese Anwendung kann nur Geräten zugeordnet werden, die alle diese Eigenschaften nachweislich besitzen.</p><ul>${requirementItems}</ul></div>` : ""}
          <div class="project-app-device-grid">${choices}</div>
          <footer><button class="primary" type="button" data-save-project-app-devices>Gerätezuordnung speichern</button></footer>
        </section>
      `;
    }

    async function applyDevices(control) {
      const selectedIds = Array.from(document.querySelectorAll("#projectAppContent [data-project-app-device]:checked"))
        .map((input) => input.value);
      control.disabled = true;
      try {
        const saved = await putJson(`/api/platform/projects/${encodeURIComponent(activeProjectId)}/project-app/devices`, {
          device_ids: selectedIds,
        });
        snapshot = { ...snapshot, ...saved, assigned_device_ids: saved.assigned_device_ids || selectedIds };
        onDevicesChanged?.(activeProjectId, snapshot.assigned_device_ids);
        try {
          snapshot = await getJson(`/api/platform/projects/${encodeURIComponent(activeProjectId)}/project-app?refresh=${Date.now()}`);
        } catch {
          // Die Zuordnung ist bereits gespeichert; nur der optionale Status-Refresh ist fehlgeschlagen.
        }
        draw(document.querySelector("#projectAppContent"));
      } catch (error) {
        control.disabled = false;
        root.alert?.(error.message || "Die Gerätezuordnung konnte nicht gespeichert werden.");
      }
    }

    async function applyAction({ actionId, settingKey, value, control }) {
      const action = (snapshot.manifest.actions || []).find((item) => item.id === actionId);
      if (!action || action.type !== "update_setting" || !settingKey) return;
      control.disabled = true;
      try {
        const saved = await putJson(`/api/platform/projects/${encodeURIComponent(activeProjectId)}/project-app`, {
          manifest_version: snapshot.manifest_version,
          expected_revision: snapshot.revision,
          values: { [settingKey]: value },
        });
        snapshot = { ...saved, bindings: snapshot.bindings || {} };
        draw(document.querySelector("#projectAppContent"));
      } catch (error) {
        control.disabled = false;
        root.alert?.(error.message || "Die Einstellung konnte nicht gespeichert werden.");
      }
    }

    return { render };
  }

  return { create };
});
