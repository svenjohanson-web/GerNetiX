const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const i18nSource = fs.readFileSync(path.join(publicRoot, "app", "i18n", "i18n.js"), "utf8");
const platformHtml = fs.readFileSync(path.join(publicRoot, "app", "index.html"), "utf8");
const platformSource = readPlatformAppSource();
const apiClientSource = fs.readFileSync(path.join(publicRoot, "app", "api-client.js"), "utf8");
const landingHtml = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const landingSource = fs.readFileSync(path.join(publicRoot, "landing.js"), "utf8");
const flashboxHtml = fs.readFileSync(path.join(publicRoot, "flashbox-einrichten", "index.html"), "utf8");
const catalogs = Object.fromEntries(["de", "en", "nl"].map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(path.join(publicRoot, "app", "i18n", "locales", `${locale}.json`), "utf8")),
]));

test("German, English and Dutch catalogs expose the same translation keys", () => {
  const germanKeys = Object.keys(catalogs.de).sort();
  assert.deepEqual(Object.keys(catalogs.en).sort(), germanKeys);
  assert.deepEqual(Object.keys(catalogs.nl).sort(), germanKeys);
  assert.ok(germanKeys.length > 30);
});

test("browser i18n resolves supported locales without localStorage persistence", () => {
  assert.match(i18nSource, /SUPPORTED_LOCALES = \["de", "en", "nl"\]/);
  assert.match(i18nSource, /queryLocale\(\)[\s\S]*normalizeLocale\(accountLocale\)[\s\S]*cookieLocale\(\)[\s\S]*hostnameLocale\(\)[\s\S]*browserLocale\(\)/);
  assert.match(i18nSource, /gernetix_locale/);
  assert.match(i18nSource, /new Intl\.DateTimeFormat/);
  assert.match(i18nSource, /new Intl\.NumberFormat/);
  assert.doesNotMatch(i18nSource, /localStorage|sessionStorage/);
});

test("platform keeps the persistent language control in the header without duplicating it in the profile", () => {
  assert.match(platformHtml, /DE · EN · NL[\s\S]*id="platformLanguage"/);
  assert.match(platformHtml, /🌐/);
  assert.match(platformHtml, /data-i18n="profile\.menu">Profil<\/a>/);
  assert.doesNotMatch(platformHtml, /id="profileLanguage"|profileLanguageStatus|account-language-settings/);
  assert.doesNotMatch(platformSource, /#profileLanguage|#profileLanguageStatus/);
  assert.match(platformHtml, /\/app\/i18n\/i18n\.js/);
});

test("authenticated language changes are persisted through the account preferences API", () => {
  assert.match(platformSource, /GerNetiXI18n\.create\(\{[\s\S]*accountLocale: state\.account\?\.preferred_locale/);
  assert.match(platformSource, /patchJson\("\/api\/account\/preferences", \{ preferred_locale: nextLocale \}\)/);
  assert.match(platformSource, /state\.account = \{ \.\.\.state\.account, \.\.\.result\.account \}/);
  assert.match(apiClientSource, /writeJson\("PATCH", url, body\)/);
});

test("public entry page provides an initial English translation and visible language switcher", () => {
  assert.match(landingHtml, /data-i18n="landing\.hero\.title"/);
  assert.match(landingHtml, /data-i18n="landing\.shared\.knowledge\.title"/);
  assert.match(landingHtml, /data-i18n="landing\.motivation\.title"/);
  assert.equal(catalogs.en["landing.hero.title"], "Understand technology and develop your own systems.");
  assert.equal(catalogs.en["landing.shared.knowledge.title"], "Knowledge portal");
  assert.equal(catalogs.en["landing.shared.community.title"], "Community");
  assert.equal(catalogs.en["dashboard.title"], "Welcome to GerNetiX");
  assert.match(landingSource, /addPublicLanguageSwitcher/);
  assert.match(landingSource, /public-language-switcher/);
  assert.match(landingSource, /GerNetiXI18n\.create\(\)/);
});

test("public FlashBox setup visibly changes language and waits for i18n initialization", () => {
  assert.match(flashboxHtml, /data-i18n="flashbox\.intro\.title"/);
  assert.match(flashboxHtml, /data-i18n="flashbox\.connect\.auto"/);
  assert.match(flashboxHtml, /data-i18n="flashbox\.dialog\.title"/);
  assert.equal(catalogs.en["flashbox.intro.title"], "What is the FlashBox for?");
  assert.equal(catalogs.en["flashbox.connect.auto"], "Find FlashBox automatically");
  assert.match(landingSource, /const publicI18nReady = initializePublicI18n\(\)/);
  assert.match(landingSource, /publicI18n \|\| await publicI18nReady/);
});
