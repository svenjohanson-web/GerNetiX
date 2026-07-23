const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { normalizeAppPath } = require("../src/dev/http-utils");

const appRoot = path.join(__dirname, "..", "public", "app");
const publicRoot = path.join(__dirname, "..", "public");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const publicShopHtml = fs.readFileSync(path.join(publicRoot, "shop", "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const landingCss = fs.readFileSync(path.join(publicRoot, "landing.css"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("adds the GerNetiX webshop as an Identity platform area", () => {
  assert.equal(normalizeAppPath("/app/shop/"), "/index.html");
  assert.match(html, /href="\/shop\/">Webshop<\/a>/);
  assert.match(html, /id="shopView"/);
  assert.match(app, /shop: "shopView"/);
  assert.match(app, /label: "Webshop", route: "\/app\/shop\/"/);
});

test("serves the webshop as a public page before login", () => {
  assert.match(server, /url\.pathname === "\/shop" \|\| url\.pathname === "\/shop\/"/);
  assert.match(server, /serveStatic\(res, publicDir, "\/shop\/index\.html"\)/);
  assert.doesNotMatch(server, /url\.pathname === "\/shop"[\s\S]*authRoute/);
  assert.match(publicShopHtml, /href="\/shop\/" aria-current="page">Webshop/);
  assert.match(publicShopHtml, /href="\/app\/auth\/">Anmelden/);
});

test("provides a Flashbox mock configurator without checkout", () => {
  const shop = html.slice(html.indexOf('<section id="shopView"'), html.indexOf('<section id="billingView"'));
  assert.match(shop, /GerNetiX Webshop/);
  assert.match(shop, /data-shop-category="flashbox"/);
  assert.match(shop, /id="flashboxConfigForm"/);
  assert.match(shop, /GerNetiX FlashBox USB Helper konfigurieren/);
  assert.match(shop, /Mock-Kauf erzeugen/);
  assert.match(shop, /id="flashboxMockOrderResult"/);
  assert.match(app, /function renderShopConfiguration/);
  assert.match(app, /function createFlashboxMockOrder/);
  assert.match(app, /offer\.gernetix_flashbox_s3_usb_helper/);
  assert.match(app, /Mock-Kauf wird angelegt/);
});

test("adds Flashbox claim path to Identity inventory", () => {
  const inventory = html.slice(html.indexOf('<section id="devicesView"'), html.indexOf('<section id="shopView"'));
  assert.match(inventory, /Registrierte Boards und Flashboxen/);
  assert.match(inventory, /id="flashboxClaimForm"/);
  assert.match(inventory, /Claim-Code/);
  assert.match(inventory, /FlashBox zuordnen/);
  assert.match(app, /function claimFlashboxFromCode/);
  assert.match(app, /\/api\/platform\/flashbox\/claim/);
  assert.match(server, /url\.pathname === "\/api\/platform\/flashbox\/claim"/);
});

test("shows dummy Home Server software licenses, bundles and entitlement states", () => {
  const shop = html.slice(html.indexOf('<section id="shopView"'), html.indexOf('<section id="billingView"'));
  assert.match(shop, /Hardware, Bundles und Lizenzen planen/);
  assert.match(shop, /data-shop-category="software-licenses"/);
  assert.match(shop, /data-shop-category="hardware-bundles"/);
  assert.match(shop, /data-shop-category="subscriptions"/);
  assert.match(shop, /id="homeServerLicense"[\s\S]*GerNetiX Home Server Software/);
  assert.match(shop, /id="homeServerBundle"[\s\S]*GerNetiX Home Server Hardware-Bundle/);
  assert.match(shop, /id="premiumPlans"[\s\S]*Premium monatlich oder jaehrlich/);
  assert.match(shop, /Lizenz aktiv[\s\S]*Home Server installieren[\s\S]*neue Geraete hinzufuegen[\s\S]*Cloud-Funktionen nutzen[\s\S]*KI nutzen/);
  assert.match(shop, /Lizenz abgelaufen[\s\S]*bestehende Geraete funktionieren weiter[\s\S]*MQTT laeuft weiter[\s\S]*Home Assistant laeuft weiter[\s\S]*OTA fuer eingerichtete Modelle bleibt moeglich/);
  assert.match(shop, /Bestandsschutz:[\s\S]*Eine abgelaufene Lizenz legt das lokale Zuhause nicht lahm/);
});

test("shows the same Home Server license model in the public webshop", () => {
  assert.match(publicShopHtml, /Hardware, Bundles und Lizenzen ansehen/);
  assert.match(publicShopHtml, /GerNetiX Home Server Software/);
  assert.match(publicShopHtml, /GerNetiX Home Server Hardware-Bundle/);
  assert.match(publicShopHtml, /Premium monatlich oder jaehrlich/);
  assert.match(publicShopHtml, /Lizenz aktiv[\s\S]*Home Server installieren[\s\S]*neue Geraete hinzufuegen[\s\S]*Cloud-Funktionen nutzen[\s\S]*KI nutzen/);
  assert.match(publicShopHtml, /Lizenz abgelaufen[\s\S]*bestehende Geraete funktionieren weiter[\s\S]*MQTT laeuft weiter[\s\S]*Home Assistant laeuft weiter[\s\S]*OTA fuer eingerichtete Modelle bleibt moeglich/);
  assert.match(publicShopHtml, /Bestandsschutz:[\s\S]*Eine abgelaufene Lizenz legt das lokale Zuhause nicht lahm/);
});

test("uses existing platform layout primitives for the webshop", () => {
  assert.match(css, /\.shop-layout \{ display: grid;/);
  assert.match(css, /\.shop-product-navigation a\.active/);
  assert.match(css, /\.shop-license-grid/);
  assert.match(css, /\.shop-license-state\.active/);
  assert.match(css, /\.shop-license-state\.expired/);
  assert.match(css, /\.shop-configurator/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(landingCss, /\.shop-public-layout/);
  assert.match(landingCss, /\.shop-public-license\.active/);
  assert.match(landingCss, /\.shop-public-license\.expired/);
});
