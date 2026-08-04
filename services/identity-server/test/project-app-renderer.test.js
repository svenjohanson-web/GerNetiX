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
    ],
    bindings: [
      { id: "web_search_value", type: "setting", key: "web_search" },
      { id: "voice_value", type: "setting", key: "voice" },
      { id: "device_online", type: "device_status", field: "connectivity_status" },
    ],
    actions: [
      { id: "set_web_search", type: "update_setting", setting_key: "web_search" },
      { id: "set_voice", type: "update_setting", setting_key: "voice" },
    ],
    pages: [{
      id: "settings",
      title: "Einstellungen",
      widgets: [
        { id: "intro", type: "text", text: "Nexi lokal und optional mit KI." },
        { id: "online", type: "status", title: "Gerät", binding_id: "device_online", display: "compact" },
        { id: "web", type: "toggle", binding_id: "web_search_value", action_id: "set_web_search" },
        { id: "voice", type: "select", binding_id: "voice_value", action_id: "set_voice" },
      ],
    }],
  };
}

test("renders a generic project app from allowlisted widgets and bindings", () => {
  const html = render({ manifest: manifest(), snapshot: { settings: { web_search: false, voice: "calm" }, bindings: { device_online: "online" } } });
  assert.match(html, /Nexi Elternbereich/);
  assert.match(html, /data-project-app-setting="web_search"/);
  assert.match(html, /value="calm" selected/);
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
