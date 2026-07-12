const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.resolve(__dirname, "../public/index.html"), "utf8");
const client = fs.readFileSync(path.resolve(__dirname, "../public/admin-config.js"), "utf8");
const service = fs.readFileSync(path.resolve(__dirname, "../src/services/admin-service.js"), "utf8");

test("renders provider-discovered API models in a select without preset fallback options", () => {
  assert.match(html, /<select id="adminApiModel"><\/select>/);
  assert.match(html, /refreshApiLlmModelsButton/);
  assert.match(html, />Lokal<\/option>/);
  assert.match(html, />Internet<\/option>/);
  assert.match(html, />OpenAI<\/option>/);
  assert.match(html, /Modellliste kann erst geladen werden, nachdem ein API-Key gespeichert wurde/);
  assert.match(client, /state\.apiModels\.map/);
  assert.match(client, /provider=api&api_provider=/);
  assert.match(client, /API-Modelle werden geladen/);
  assert.match(client, /Kein API-Key gespeichert/);
  assert.match(client, /if \(!state\.llm\?\.hasApiKey\)/);
  assert.match(client, /result\.provider === "ollama"/);
  assert.match(client, /Admin Tool neu starten/);
  assert.doesNotMatch(client, /data-api-llm-model/);
  assert.doesNotMatch(client, /modelGroups:/);
});

test("does not send unsupported temperature to OpenAI-compatible models", () => {
  const compatibleCall = service.match(/async callOpenAiCompatibleConfigTest[\s\S]*?async callAnthropicConfigTest/)?.[0] || "";
  assert.doesNotMatch(compatibleCall, /temperature/);
});
