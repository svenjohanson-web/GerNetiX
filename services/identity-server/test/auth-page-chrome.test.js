const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const authRoot = path.join(__dirname, "..", "public", "app", "auth");
const html = fs.readFileSync(path.join(authRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(authRoot, "auth.css"), "utf8");
const script = fs.readFileSync(path.join(authRoot, "auth.js"), "utf8");

test("shows the public GerNetiX header and burger menu on the authentication page", () => {
  assert.match(html, /class="auth-site-header"/);
  assert.match(html, /src="\/gernetix-wordmark\.png"[\s\S]*alt="GerNetiX"/);
  assert.match(html, /id="authMenuButton"[\s\S]*aria-controls="authMenu"/);
  assert.match(html, /id="authMenu"[\s\S]*href="\/wissen\/"[\s\S]*href="\/hilfe\//);
  assert.match(html, /id="authMenu"[\s\S]*href="\/shop\/"[\s\S]*Webshop/);
  assert.match(css, /\.auth-site-header/);
  assert.match(css, /\.auth-menu-button/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none !important;/);
  assert.match(script, /function closeAuthMenu/);
  assert.match(script, /authMenuButton\?\.addEventListener/);
  assert.doesNotMatch(html, /class="brand-mark" aria-hidden="true">G/);
  assert.match(html, /class="guest-access"[\s\S]*Als Gast starten/);
  assert.match(html, /Passwort\/Passkey vergessen/);
  assert.match(script, /\/api\/recovery\/offline\/start/);
  assert.match(script, /\/api\/recovery\/offline\/passkey\/options/);
  assert.match(script, /\/api\/recovery\/offline\/passkey\/verify/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.match(html, /class="auth-site-footer"[\s\S]*Vision[\s\S]*Über uns[\s\S]*Wissensportal[\s\S]*Hilfe/);
  assert.match(css, /\.auth-site-footer/);
});
