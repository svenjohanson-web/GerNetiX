const BoardConfigurationPlugin = (() => {
  const instances = new WeakMap();

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function boardId(board) {
    return String(board?.hardware_item_id || board?.hardware_profile_id || board?.id || "");
  }

  function normalizePins(pins) {
    if (!pins || typeof pins !== "object" || Array.isArray(pins)) return {};
    return Object.fromEntries(Object.entries(pins).filter(([, pin]) => Number.isInteger(Number(pin))).map(([signal, pin]) => [signal, Number(pin)]));
  }

  function assignedPinsForFeature(board, feature, selected = {}) {
    if (Object.prototype.hasOwnProperty.call(selected, "pins")) return selected.pins;
    const assigned = board?.pin_profile?.assigned_pins || {};
    const exactIds = [feature.feature_id, `${feature.feature_id}_${selected.connection || ""}`].filter(Boolean);
    const exact = exactIds.map((id) => assigned[id]).find((pins) => pins && typeof pins === "object");
    if (exact) return exact;
    const matches = Object.entries(assigned).filter(([id, pins]) => id.startsWith(`${feature.feature_id}_`) && pins && typeof pins === "object");
    return matches.length === 1 ? matches[0][1] : {};
  }

  function normalizeSelections(features, selections = {}, board = null) {
    return Object.fromEntries((features || []).map((feature) => {
      const selected = selections?.[feature.feature_id] || {};
      return [feature.feature_id, {
        enabled: selected.enabled === true,
        hardware: String(selected.hardware || ""),
        driver: String(selected.driver || ""),
        connection: String(selected.connection || ""),
        pins: normalizePins(assignedPinsForFeature(board, feature, selected)),
        value: String(selected.value || ""),
      }];
    }));
  }

  function defaultsForBoard(board, features) {
    return normalizeSelections(features, board?.default_instance_configuration?.board_features || {}, board);
  }

  function boardScope(board) {
    if (board?.configuration_scope === "project") return "project";
    if (board?.configuration_scope === "account") return "account";
    return "gernetix";
  }

  function boardScopeLabel(board) {
    return boardScope(board) === "project"
      ? "Projektanpassung"
      : boardScope(board) === "account"
        ? "Eigenes Account-Board"
        : "GerNetiX-Board";
  }

  function renderBoardOptions(boards, selectedBoardId) {
    const groups = [
      ["gernetix", "──────── GerNetiX-Boards ────────"],
      ["account", "──────── Meine Boards ────────"],
      ["project", "──────── Projektanpassungen ────────"],
    ];
    return groups.map(([scope, label]) => {
      const items = boards.filter((board) => boardScope(board) === scope);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(label)}">${items.map((item) => `<option value="${escapeHtml(boardId(item))}" ${boardId(item) === selectedBoardId ? "selected" : ""}>${escapeHtml(item.title || boardId(item))}</option>`).join("")}</optgroup>`;
    }).join("");
  }

  function settingChanged(current, defaults) {
    return JSON.stringify(current ?? "") !== JSON.stringify(defaults ?? "");
  }

  function selectionsDiffer(current = {}, defaults = {}) {
    const ids = new Set([...Object.keys(current || {}), ...Object.keys(defaults || {})]);
    return [...ids].some((id) => ["enabled", "hardware", "driver", "connection", "pins", "value"]
      .some((field) => settingChanged(current?.[id]?.[field], defaults?.[id]?.[field])));
  }

  function tableSelect(field, options, selected, defaultValue, ariaLabel, disabled) {
    const items = Array.isArray(options) ? options : [];
    if (!items.length) return "";
    const known = !selected || items.some((item) => item.id === selected);
    return `<select class="${settingChanged(selected, defaultValue) ? "is-modified" : ""}" aria-label="${escapeHtml(ariaLabel)}" data-board-feature-field="${field}" ${disabled}>
      <option value="">Bitte wählen</option>
      ${known ? "" : `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (Boardprofil)</option>`}
      ${items.map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === selected ? "selected" : ""}>${escapeHtml(option.title)}</option>`).join("")}
    </select>`;
  }

  function formatPins(pins) {
    return Object.entries(normalizePins(pins)).map(([signal, pin]) => `${signal.toUpperCase()}=${pin >= 0 ? `GPIO${pin}` : pin}`).join(", ");
  }

  function pinButton(feature, selected, defaults, disabled) {
    const assigned = formatPins(selected.pins);
    return `<button type="button" class="board-feature-pin-editor-button ${settingChanged(selected.pins, defaults.pins) ? "is-modified" : ""}" data-edit-board-feature-pins="${escapeHtml(feature.feature_id)}" aria-label="${escapeHtml(feature.title)}: Pins bearbeiten" ${disabled}><span aria-hidden="true">&#9998;</span><span>Bearbeiten</span>${assigned ? `<small>${escapeHtml(assigned)}</small>` : ""}</button>`;
  }

  function renderFeatureTable(features, selections, defaults = {}) {
    return `<div class="board-feature-table-scroll"><table class="board-feature-table">
      <thead><tr><th aria-label="Aktiv"></th><th>Komponente</th><th>Art</th><th>Treiber</th><th>Anschluss</th><th>Pin-Zuordnung</th><th>Größe / Wert</th></tr></thead>
      <tbody>${(features || []).map((feature) => {
        const selected = selections?.[feature.feature_id] || {};
        const baseline = defaults?.[feature.feature_id] || {};
        const disabled = selected.enabled ? "" : "disabled";
        const modified = ["enabled", "hardware", "driver", "connection", "pins", "value"].some((field) => settingChanged(selected[field], baseline[field]));
        return `<tr class="board-feature-row ${selected.enabled ? "" : "is-disabled"} ${modified ? "is-modified" : ""}" data-board-feature-row="${escapeHtml(feature.feature_id)}">
          <td class="board-feature-toggle"><input type="checkbox" aria-label="${escapeHtml(feature.title)} aktivieren" data-board-feature-enabled="${escapeHtml(feature.feature_id)}" ${selected.enabled ? "checked" : ""}></td>
          <td><strong>${escapeHtml(feature.title)}</strong></td>
          <td>${tableSelect("hardware", feature.hardware_options, selected.hardware, baseline.hardware, `${feature.title}: Art`, disabled)}</td>
          <td>${tableSelect("driver", feature.driver_options, selected.driver, baseline.driver, `${feature.title}: Treiber`, disabled)}</td>
          <td>${tableSelect("connection", feature.connection_options, selected.connection, baseline.connection, `${feature.title}: Anschluss`, disabled)}</td>
          <td>${pinButton(feature, selected, baseline, disabled)}</td>
          <td>${tableSelect("value", feature.value_options, selected.value, baseline.value, `${feature.title}: Größe oder Wert`, disabled)}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  function renderCompilerProjection(board, selections = {}) {
    const config = board?.platformio_build || {};
    if (!config.platform || !config.board) return "";
    const flashValue = selections?.flash?.value || board?.default_instance_configuration?.board_features?.flash?.value || (config.flash_size_mb ? `${config.flash_size_mb}_mb` : "Boardstandard");
    const values = [
      ["Plattform", config.platform],
      ["Environment", config.environment || config.board],
      ["Compiler-Board", config.board],
      ["Framework", config.framework || "ohne Framework"],
      ["Flash", String(flashValue).replace("_mb", " MB").replace("_kb", " KB")],
    ];
    return `<section class="board-configuration-compiler-projection"><header><div><span>Compiler-Ausgabe</span><small>GerNetiX erzeugt daraus beim Speichern die platformio.ini des Projekts.</small></div><code>platformio.ini</code></header><dl>${values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
  }

  function render(instance) {
    const { root, options, model } = instance;
    const board = options.boards.find((item) => boardId(item) === model.boardId) || null;
    const defaults = board ? defaultsForBoard(board, options.features) : {};
    const modified = board ? selectionsDiffer(model.selections, defaults) : false;
    root.innerHTML = `<section class="board-configuration-plugin ${modified ? "has-modifications" : ""}" data-board-configuration-plugin>
      ${options.showSelector === false ? "" : `<header><div><p class="eyebrow">Boardauswahl</p><h4>${escapeHtml(options.title || "Board auswählen und konfigurieren")}</h4></div><span class="board-configuration-plugin-state ${modified ? "is-modified" : ""}">${board ? (modified ? "Projektbezogen geändert" : boardScopeLabel(board)) : "Noch kein Board"}</span></header>
      <label class="board-configuration-plugin-selector">Board<select data-board-configuration-board><option value="">Board auswählen…</option>${renderBoardOptions(options.boards, model.boardId)}</select></label>`}
      ${board ? `<div class="board-configuration-plugin-board"><strong>${escapeHtml(board.title || model.boardId)}</strong><small>${escapeHtml(board.processor_family || "")} · ${escapeHtml(board.mcu_variant || "")}</small></div>` : ""}
      ${options.status ? `<p class="hardware-catalog-hint ${options.status.state === "error" ? "is-error" : ""}">${escapeHtml(options.status.message || "")}</p>` : ""}
      ${board ? renderCompilerProjection(board, model.selections) : ""}
      ${board && options.features.length ? renderFeatureTable(options.features, model.selections, defaults) : board ? '<p class="empty">Ausstattungsoptionen werden geladen…</p>' : `<p class="empty">${escapeHtml(options.emptyText || "Wähle ein GerNetiX-Board oder ein eigenes Account-Board aus.")}</p>`}
      ${board && modified && options.allowAccountSave ? `<footer class="board-configuration-plugin-save"><label>Name des eigenen Boards<input type="text" maxlength="120" data-board-configuration-name value="${escapeHtml(model.name)}" placeholder="z. B. Mein Board mit eigener Pinbelegung"></label><p>Geänderte Katalogwerte werden als unveränderliche Version im Account gespeichert.</p></footer>` : ""}
    </section>`;
    bind(instance);
  }

  function bind(instance) {
    const { root, options, model } = instance;
    root.querySelector("[data-board-configuration-board]")?.addEventListener("change", (event) => {
      model.boardId = event.target.value;
      const board = options.boards.find((item) => boardId(item) === model.boardId);
      model.selections = defaultsForBoard(board, options.features);
      model.name = board?.configuration_scope === "account" ? String(board.title || "").replace(/ · Mein Board$/, "") : "";
      notify(instance, "board");
      render(instance);
    });
    root.querySelectorAll("[data-board-feature-enabled]").forEach((input) => input.addEventListener("change", () => updateFeature(instance, input.dataset.boardFeatureEnabled)));
    root.querySelectorAll("[data-board-feature-field]").forEach((input) => input.addEventListener("change", () => updateFeature(instance, input.closest("[data-board-feature-row]").dataset.boardFeatureRow)));
    root.querySelectorAll("[data-edit-board-feature-pins]").forEach((button) => button.addEventListener("click", () => openPinEditor(instance, button.dataset.editBoardFeaturePins)));
    root.querySelector("[data-board-configuration-name]")?.addEventListener("input", (event) => { model.name = event.target.value.trim(); notify(instance, "name"); });
  }

  function updateFeature(instance, featureId) {
    const row = instance.root.querySelector(`[data-board-feature-row="${CSS.escape(featureId)}"]`);
    if (!row) return;
    const previous = instance.model.selections[featureId] || {};
    const read = (field) => row.querySelector(`[data-board-feature-field="${field}"]`)?.value || "";
    instance.model.selections[featureId] = { ...previous, enabled: row.querySelector("[data-board-feature-enabled]")?.checked === true, hardware: read("hardware"), driver: read("driver"), connection: read("connection"), value: read("value") };
    notify(instance, "feature");
    render(instance);
  }

  function pinSignals(featureId, pins) {
    const defaults = { display: ["sclk", "mosi", "miso", "cs", "dc", "reset", "backlight"], touch: ["sda", "scl", "interrupt", "reset"], speaker: ["enable", "mclk", "bclk", "data_out", "lrclk"], microphone: ["bclk", "ws", "din"] };
    return [...new Set([...Object.keys(pins || {}), ...(defaults[featureId] || [])])];
  }

  function availablePins(board) {
    const declared = (board?.pin_profile?.digital_pins || [])
      .map((pin) => Number(String(pin).match(/-?\d+/)?.[0]));
    const assigned = Object.values(board?.pin_profile?.assigned_pins || {})
      .flatMap((group) => Object.values(group || {}).map(Number));
    return [...new Set([...declared, ...assigned].filter((pin) => Number.isInteger(pin) && pin >= 0))].sort((a, b) => a - b);
  }

  function openPinEditor(instance, featureId) {
    const feature = instance.options.features.find((item) => item.feature_id === featureId);
    const board = instance.options.boards.find((item) => boardId(item) === instance.model.boardId);
    if (!feature || !board) return;
    const selected = instance.model.selections[featureId] || {};
    const pins = availablePins(board);
    const dialog = document.createElement("dialog");
    dialog.className = "provisioning-pin-editor-dialog";
    dialog.innerHTML = `<form method="dialog" class="provisioning-pin-editor-form"><header><div><p class="eyebrow">Hardware · Pin-Zuordnung</p><h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(board.title || instance.model.boardId)}</p></div><button type="submit" value="cancel" aria-label="Dialog schließen">×</button></header><div class="provisioning-pin-editor-content"><section><p class="helper-text">Ordne jedem Signal einen GPIO des ausgewählten Boardprofils zu.</p><div class="provisioning-pin-fields">${pinSignals(featureId, selected.pins).map((signal) => `<label>${escapeHtml(signal.toUpperCase())}<select data-board-plugin-pin="${escapeHtml(signal)}"><option value="">Nicht belegt</option><option value="-1" ${selected.pins?.[signal] === -1 ? "selected" : ""}>Nicht verbunden</option>${pins.map((pin) => `<option value="${pin}" ${selected.pins?.[signal] === pin ? "selected" : ""}>GPIO${pin}</option>`).join("")}</select></label>`).join("")}</div></section><aside><h4>Mögliche GPIOs</h4><div class="provisioning-pin-chip-list">${pins.map((pin) => `<span>GPIO${pin}</span>`).join("") || "<span>Keine GPIOs im Boardprofil hinterlegt</span>"}</div></aside></div><footer><button type="submit" value="cancel">Abbrechen</button><button type="button" class="primary" data-board-plugin-save-pins>Übernehmen</button></footer></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove());
    dialog.querySelector("[data-board-plugin-save-pins]").addEventListener("click", () => {
      const nextPins = {};
      dialog.querySelectorAll("[data-board-plugin-pin]").forEach((input) => { if (input.value !== "") nextPins[input.dataset.boardPluginPin] = Number(input.value); });
      instance.model.selections[featureId] = { ...selected, pins: nextPins };
      notify(instance, "pins");
      dialog.close();
      render(instance);
    });
    dialog.showModal();
  }

  function notify(instance, reason) {
    instance.options.onChange?.(value(instance.root), reason);
  }

  function mount(root, options = {}) {
    if (!root) return null;
    const features = Array.isArray(options.features) ? options.features : [];
    const boards = Array.isArray(options.boards) ? options.boards : [];
    const selectedBoard = boards.find((board) => boardId(board) === String(options.selectedBoardId || ""));
    const instance = {
      root,
      options: { ...options, features, boards },
      model: {
        boardId: String(options.selectedBoardId || ""),
        selections: normalizeSelections(features, options.selections || selectedBoard?.default_instance_configuration?.board_features || {}, selectedBoard),
        name: String(options.name || ""),
      },
    };
    instances.set(root, instance);
    render(instance);
    return instance;
  }

  function value(root) {
    const instance = instances.get(root);
    if (!instance) return null;
    const board = instance.options.boards.find((item) => boardId(item) === instance.model.boardId) || null;
    const defaults = board ? defaultsForBoard(board, instance.options.features) : {};
    return { boardId: instance.model.boardId, board, selections: structuredClone(instance.model.selections), name: instance.model.name, modified: Boolean(board) && selectionsDiffer(instance.model.selections, defaults) };
  }

  return { availablePins, boardId, boardScope, defaultsForBoard, formatPins, mount, normalizeSelections, renderBoardOptions, renderCompilerProjection, renderFeatureTable, selectionsDiffer, value };
})();
