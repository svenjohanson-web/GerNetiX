const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..", "..");
const read = (...segments) => fs.readFileSync(path.join(repositoryRoot, ...segments), "utf8");

test("public page shells use the visible width while readable content keeps its own limits", () => {
  const landingCss = read("services", "identity-server", "public", "landing.css");
  const publicHeaderCss = read("services", "identity-server", "public", "public-header.css");
  const flashboxCss = read("services", "identity-server", "public", "flashbox-einrichten", "styles.css");
  const authCss = read("services", "identity-server", "public", "app", "auth", "auth.css");
  const platformCss = read("services", "identity-server", "public", "app", "app.css");

  assert.match(publicHeaderCss, /\.site-header \{[\s\S]*left: 16px;[\s\S]*right: 16px;[\s\S]*width: auto/);
  assert.match(landingCss, /main \{[^}]*width: calc\(100% - 32px\)/);
  assert.match(landingCss, /footer \{[\s\S]*width: calc\(100% - 32px\)/);
  assert.match(flashboxCss, /main \{ width: calc\(100% - 32px\)/);
  assert.match(authCss, /body \{[\s\S]*padding-top: 78px/);
  assert.match(platformCss, /body\.public-help-page \.app-shell \{ width: calc\(100% - 32px\)/);
  assert.match(platformCss, /@media \(max-width: 520px\)[\s\S]*\.knowledge-book-navigation,[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(platformCss, /\.knowledge-chapter-title-link,[\s\S]*overflow-wrap: anywhere/);
  assert.match(platformCss, /\.knowledge-book-part \{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*min-width: 0; max-width: 100%/);
  assert.match(platformCss, /\.knowledge-book-chapter \{ min-width: 0; max-width: 100%/);

  assert.match(landingCss, /\.copy-box > p:not\(\.eyebrow\) \{ max-width: 980px/);
  assert.match(authCss, /\.login-panel \{[\s\S]*width: min\(100%, 420px\)/);
});

test("standalone GerNetiX tools no longer impose different outer maximum widths", () => {
  const styles = [
    read("services", "public-demo-server", "public", "app.css"),
    read("services", "admin-tool", "public", "app.css"),
    read("services", "recovery-tool", "public", "app.css"),
    read("services", "provisioning-tool", "public", "app.css"),
  ];

  assert.match(styles[0], /\.shell \{ width:calc\(100% - 36px\)/);
  assert.match(styles[1], /\.admin-shell \{ width: 100%/);
  assert.match(styles[2], /\.shell \{ width: 100%/);
  assert.match(styles[3], /\.shell \{ width: 100%/);
});

test("only the shared token file may declare the theme colours unconditionally", () => {
  // Ein bedingungsloser :root-Block mit diesen Namen wird nach der Token-Datei
  // geladen und ueberschreibt sie unabhaengig vom gewaehlten Modus. Genau so
  // blieb die Spielesammlung dauerhaft dunkel, obwohl ihr Umschalter sichtbar
  // war und das Attribut korrekt gesetzt wurde.
  const geteilteNamen = /--(?:surface|surface-deep|surface-panel|surface-raised|surface-overlay|border|border-subtle|border-strong|text|text-secondary|text-muted|text-dim|text-bright|accent|accent-bright|accent-strong|accent-soft|accent-text|bg|panel|panel-soft|line|muted)\s*:/;
  const stylesheets = [
    ["landing.css", read("services", "identity-server", "public", "landing.css")],
    ["public-header.css", read("services", "identity-server", "public", "public-header.css")],
    ["flashbox-einrichten/styles.css", read("services", "identity-server", "public", "flashbox-einrichten", "styles.css")],
    ["app/unified-flash-dialog.css", read("services", "identity-server", "public", "app", "unified-flash-dialog.css")],
    ["public-demo-server/app.css", read("services", "public-demo-server", "public", "app.css")],
  ];

  for (const [name, css] of stylesheets) {
    for (const block of css.matchAll(/(^|\})\s*:root\s*\{([^}]*)\}/g)) {
      assert.doesNotMatch(block[2], geteilteNamen, `${name} deklariert Theme-Farben in einem bedingungslosen :root-Block`);
    }
  }

  // Die Token-Datei selbst bleibt die eine erlaubte Quelle.
  const tokens = read("services", "shared", "public", "theme-tokens.css");
  assert.match(tokens, /:root \{[\s\S]*--surface:/);
  assert.match(tokens, /html\[data-public-theme="dark"\] \{[\s\S]*--surface:/);
});
