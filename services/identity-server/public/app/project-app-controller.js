(function exposeProjectAppController(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProjectAppController = api;
})(typeof globalThis === "object" ? globalThis : this, function createProjectAppController() {
  function create({ getJson, putJson, renderer, escapeHtml }) {
    let activeProjectId = "";
    let snapshot = null;

    async function render(projectId) {
      const target = document.querySelector("#projectAppContent");
      if (!target) return;
      activeProjectId = projectId || "";
      if (!activeProjectId) {
        target.innerHTML = '<section class="panel"><h2>Projekt-App nicht gefunden</h2><p>Öffne die Projekt-App aus einem deiner Projekte.</p></section>';
        return;
      }
      target.innerHTML = '<section class="panel"><p>Projekt-App wird geladen …</p></section>';
      try {
        const cacheKey = Date.now();
        snapshot = await getJson(`/api/platform/projects/${encodeURIComponent(activeProjectId)}/project-app?refresh=${cacheKey}`);
        draw(target);
      } catch (error) {
        target.innerHTML = `<section class="panel"><h2>Projekt-App nicht verfügbar</h2><p>${escapeHtml(error.message || "Die Projekt-App konnte nicht geladen werden.")}</p></section>`;
      }
    }

    function draw(target) {
      target.innerHTML = renderer.render({
        manifest: snapshot.manifest,
        snapshot: { settings: snapshot.values || {}, bindings: snapshot.bindings || {} },
      });
      renderer.bind(target, { onAction: applyAction });
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
