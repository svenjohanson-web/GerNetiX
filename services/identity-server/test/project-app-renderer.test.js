const assert = require("node:assert/strict");
const test = require("node:test");
const { render } = require("../public/app/project-app-renderer");

function manifest() {
  return {
    schema: "gernetix.project-app/v1",
    manifest_version: 1,
    app_id: "nexi",
    title: "Nexi Elternbereich",
    description: "Einstellungen für die konkrete Nexi-Instanz.",
    settings: [
      { key: "web_search", type: "boolean", label: "Websuche", default: true },
      { key: "voice", type: "select", label: "Stimme", options: [{ value: "warm", label: "Warm" }, { value: "calm", label: "Ruhig" }] },
      { key: "child_name", type: "string", label: "Vorname", default: "" },
      { key: "volume", type: "integer", label: "Maximale Lautstärke", min: 1, max: 5, default: 5 },
    ],
    bindings: [
      { id: "web_search_value", type: "setting", key: "web_search" },
      { id: "voice_value", type: "setting", key: "voice" },
      { id: "child_name_value", type: "setting", key: "child_name" },
      { id: "volume_value", type: "setting", key: "volume" },
      { id: "device_online", type: "device_status", field: "connectivity_status" },
    ],
    actions: [
      { id: "set_web_search", type: "update_setting", setting_key: "web_search" },
      { id: "set_voice", type: "update_setting", setting_key: "voice" },
      { id: "set_child_name", type: "update_setting", setting_key: "child_name" },
      { id: "set_volume", type: "update_setting", setting_key: "volume" },
    ],
    pages: [{
      id: "settings",
      title: "Einstellungen",
      widgets: [
        { id: "intro", type: "text", text: "Nexi lokal und optional mit KI." },
        { id: "online", type: "status", title: "Gerät", binding_id: "device_online", display: "compact" },
        { id: "web", type: "toggle", binding_id: "web_search_value", action_id: "set_web_search" },
        { id: "voice", type: "select", binding_id: "voice_value", action_id: "set_voice" },
        { id: "child_name", type: "input", binding_id: "child_name_value", action_id: "set_child_name" },
        { id: "volume", type: "input", binding_id: "volume_value", action_id: "set_volume" },
      ],
    }],
  };
}

test("renders a generic project app from allowlisted widgets and bindings", () => {
  const html = render({ manifest: manifest(), snapshot: { settings: { web_search: false, voice: "calm", child_name: "Mia", volume: 4 }, bindings: { device_online: "online" } } });
  assert.match(html, /Nexi Elternbereich/);
  assert.match(html, /data-project-app-setting="web_search"/);
  assert.match(html, /value="calm" selected/);
  assert.match(html, /type="text" value="Mia"[^>]*data-project-app-setting="child_name"/);
  assert.match(html, /type="number" value="4"[^>]*min="1" max="5" step="1"/);
  assert.match(html, />online</);
});

test("escapes project-authored text and rejects unknown executable widgets", () => {
  const unsafe = manifest();
  unsafe.pages[0].widgets[0].text = "<img src=x onerror=alert(1)>";
  const html = render({ manifest: unsafe });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);

  unsafe.pages[0].widgets.push({ id: "script", type: "html", text: "<script>bad()</script>" });
  assert.throws(() => render({ manifest: unsafe }), /Unsupported project app widget/);
});

test("requires a matching typed setting action for interactive controls", () => {
  const invalid = manifest();
  invalid.actions[0].setting_key = "another_setting";
  assert.throws(() => render({ manifest: invalid }), /matching update_setting action/);
});

test("marks every persisted setting control as an observable user action", () => {
  const html = render({ manifest: manifest(), snapshot: { settings: {} } });
  assert.match(html, /data-action-type="project\.settings\.save"/);
});

test("renders telemetry history as a chart and its latest value as a metric", () => {
  const telemetryManifest = manifest();
  telemetryManifest.bindings.push({ id: "temperature", type: "telemetry", metric_id: "room.temperature" });
  telemetryManifest.pages[0].widgets.push(
    { id: "temperature_now", type: "metric", title: "Temperatur", binding_id: "temperature" },
    { id: "temperature_history", type: "chart", title: "Verlauf", binding_id: "temperature" },
  );
  const html = render({
    manifest: telemetryManifest,
    snapshot: { bindings: { temperature: [
      { value: 20.5, unit: "°C", measured_at: "2026-08-04T10:00:00.000Z" },
      { value: 21.5, unit: "°C", measured_at: "2026-08-04T10:01:00.000Z" },
    ] } },
  });
  assert.match(html, />21\.5 °C</);
  assert.match(html, /aria-label="2 Messwerte"/);
  assert.match(html, /--project-app-value:/);
});
