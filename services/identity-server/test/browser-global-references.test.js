const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { analysiereDatei } = require("../../../tools/code-dependency-graph/src/analyse");
const { OEFFENTLICH, browserDateien } = require("../../../tools/code-dependency-graph/src/quellen");

const acorn = require(path.join(__dirname, "..", "node_modules", "acorn"));

/*
 * Die Dateien unter public/app teilen sich einen globalen Namensraum. Ein
 * Bezeichner, den keine dieser Dateien deklariert und den auch der Browser
 * nicht bereitstellt, ist zur Laufzeit ein ReferenceError -- oft auf einem
 * Pfad, den kein Test durchlaeuft.
 *
 * Genau so lag es in project-app-controller.js: die UMD-Verpackung nimmt
 * "root" als Parameter der aeusseren Funktion entgegen, benutzt wurde es aber
 * in der Fabrikfunktion daneben. Die ist ein Geschwister, kein Kind, also war
 * "root" dort nie gebunden. Betroffen war unter anderem der Normalpfad beim
 * Speichern von Einstellungen.
 */

const BROWSER_GLOBALE = new Set([
  // Sprachkern
  "String", "Number", "Boolean", "Array", "Object", "Set", "Map", "WeakMap", "WeakSet",
  "Math", "JSON", "Date", "Error", "TypeError", "RangeError", "Promise", "Symbol",
  "Intl", "RegExp", "Function", "BigInt", "Proxy", "Reflect", "globalThis",
  "parseInt", "parseFloat", "isNaN", "isFinite", "structuredClone", "queueMicrotask",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Float32Array", "Float64Array",
  "ArrayBuffer", "DataView", "TextEncoder", "TextDecoder",
  // Browser
  "window", "document", "console", "navigator", "location", "history", "screen",
  "localStorage", "sessionStorage", "indexedDB", "crypto", "performance",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
  "fetch", "Request", "Response", "Headers", "AbortController", "FormData", "Blob", "File",
  "URL", "URLSearchParams", "CustomEvent", "Event", "EventTarget", "MutationObserver",
  "IntersectionObserver", "ResizeObserver", "DOMParser", "XMLSerializer", "Notification",
  "CSS", "getComputedStyle", "alert", "confirm", "prompt", "matchMedia", "customElements",
  "CompressionStream", "DecompressionStream", "ReadableStream", "WritableStream",
  "Image", "Audio", "AudioContext", "SpeechSynthesisUtterance", "speechSynthesis",
  "HTMLElement", "Node", "NodeFilter", "Range", "Worker", "BroadcastChannel", "WebSocket",
  "atob", "btoa", "EventSource", "SyntaxError", "ReferenceError", "EvalError", "URIError",
  // ueber window.X angesprochen und deshalb wie ein Global aufgeloest
  "addEventListener", "removeEventListener", "dispatchEvent", "isSecureContext",
  "innerWidth", "innerHeight", "scrollTo", "scrollY", "open", "close", "print", "focus",
  "PublicKeyCredential", "AuthenticatorAssertionResponse", "AuthenticatorAttestationResponse",
  // CommonJS-Bruecke: dieselben Dateien werden von Tests mit require geladen.
  "module", "require", "exports",
]);

const dateien = browserDateien();

test("no browser script references an identifier that nothing provides", () => {
  const deklariert = new Set();
  const analysen = new Map();

  for (const name of dateien) {
    const quelltext = fs.readFileSync(path.join(OEFFENTLICH, name), "utf8");
    const ast = acorn.parse(quelltext, { ecmaVersion: 2024, sourceType: "script" });
    const ergebnis = analysiereDatei(ast);
    analysen.set(name, ergebnis);
    for (const bezeichner of ergebnis.deklariert) deklariert.add(bezeichner);
  }

  const offen = [];
  for (const [datei, ergebnis] of analysen) {
    for (const [bezeichner, verwendungen] of ergebnis.frei) {
      if (deklariert.has(bezeichner) || BROWSER_GLOBALE.has(bezeichner)) continue;
      offen.push(`${datei}: ${bezeichner} (${verwendungen}x)`);
    }
  }

  assert.deepEqual(
    offen.sort(),
    [],
    "Diese Bezeichner sind nirgends deklariert und kein bekanntes Browser-Global. " +
    "Entweder fehlt die Deklaration, oder die Liste BROWSER_GLOBALE muss ergaenzt werden.\n" +
    offen.join("\n"),
  );
});

test("the analysis actually resolves scopes instead of matching text", () => {
  // Ohne diese Zusicherung koennte die Analyse stillschweigend zu einer
  // Textsuche verkommen und der Test darueber waertlos werden.
  const ast = acorn.parse(`
    const draussen = 1;
    function f(parameter) {
      const drinnen = parameter + draussen;
      { let imBlock = drinnen; unbekannt(imBlock); }
      try { null; } catch (fehler) { void fehler; }
      return drinnen;
    }
    window.alsGlobalGesetzt = f;
  `, { ecmaVersion: 2024, sourceType: "script" });

  const ergebnis = analysiereDatei(ast);
  assert.ok(ergebnis.deklariert.has("draussen"));
  assert.ok(ergebnis.deklariert.has("f"));
  assert.ok(ergebnis.deklariert.has("alsGlobalGesetzt"), "window.X = ... erzeugt ein Global");
  assert.ok(!ergebnis.deklariert.has("drinnen"), "lokale Namen gehoeren nicht zum globalen Namensraum");
  assert.ok(!ergebnis.frei.has("parameter"), "Parameter sind gebunden");
  assert.ok(!ergebnis.frei.has("imBlock"), "Blockvariablen sind gebunden");
  assert.ok(!ergebnis.frei.has("fehler"), "catch-Parameter ist gebunden");
  assert.ok(ergebnis.frei.has("unbekannt"), "wirklich freie Namen werden erkannt");
});
