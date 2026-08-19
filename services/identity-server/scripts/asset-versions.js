/*
 * Erfassung der Cache-Versionen ausgelieferter Browser-Dateien.
 *
 * Frueher nagelten 33 Zusicherungen in 17 Testdateien einzelne
 * Versionszeichenketten fest. Das hatte zwei Folgen: jede Aenderung an einer
 * Datei erzwang eine Suche quer durch die Testsuite, und die Pins gerieten
 * untereinander in Widerspruch -- app-event-bindings.js war gleichzeitig auf
 * 20260805-shell-menu-1 und auf 20260814-portfolio-guide-1 festgelegt, sodass
 * die betroffenen Tests nicht alle zugleich gruen sein konnten.
 *
 * Dieses Modul sammelt stattdessen alle Verweise samt Version und Pruefsumme
 * ein. Werkzeug und Test teilen sich diesen Code, damit es keine zweite
 * Wahrheit gibt.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DIENST_WURZEL = path.join(__dirname, "..");
const OEFFENTLICH = path.join(DIENST_WURZEL, "public");
const GETEILT = path.join(DIENST_WURZEL, "..", "shared", "public");
const MANIFEST = path.join(DIENST_WURZEL, "asset-versions.json");

function htmlDateien(verzeichnis, gesammelt = []) {
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    const voll = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") continue;
      htmlDateien(voll, gesammelt);
    } else if (eintrag.name.endsWith(".html")) gesammelt.push(voll);
  }
  return gesammelt;
}

/*
 * Route-Stylesheets und -Skripte werden zur Laufzeit nachgeladen und tragen
 * ihre Version als Variable: loadPlatformStyle(`/app/x.css?v=${version}`).
 * Dazu wird die zuletzt davor deklarierte Konstante aufgeloest -- in
 * app-shell-controller.js gibt es zwei davon, je eine pro Ladefunktion.
 */
function versionVorPosition(quelle, position) {
  let wert = null;
  for (const treffer of quelle.matchAll(/const version = "([^"]+)"/g)) {
    if (treffer.index < position) wert = treffer[1];
    else break;
  }
  return wert;
}

function verweiseAusJavaScript(quelle, herkunft) {
  const verweise = [];
  for (const t of quelle.matchAll(/loadPlatform(?:Script|Style)\("(\/[^"?]+\.(?:js|css))\?v=([^"]+)"\)/g)) {
    verweise.push({ pfad: t[1], version: t[2], herkunft });
  }
  for (const t of quelle.matchAll(/loadPlatform(?:Script|Style)\(`(\/[^`?]+\.(?:js|css))\?v=\$\{version\}`\)/g)) {
    const version = versionVorPosition(quelle, t.index);
    if (version) verweise.push({ pfad: t[1], version, herkunft });
  }
  return verweise;
}

function verweiseAusHtml(quelle, herkunft) {
  const verweise = [];
  for (const t of quelle.matchAll(/(?:href|src)="(\/[^"?]+\.(?:js|css))\?v=([^"]+)"/g)) {
    verweise.push({ pfad: t[1], version: t[2], herkunft });
  }
  return verweise;
}

/* Verweise ohne Version: sie koennen im Browser veraltet haengenbleiben. */
function verweiseOhneVersion(quelle, herkunft) {
  const offen = [];
  for (const t of quelle.matchAll(/(?:href|src)="(\/[^"?]+\.(?:js|css))"/g)) {
    offen.push({ pfad: t[1], herkunft });
  }
  return offen;
}

/*
 * Diese Praefixe werden an einen anderen Dienst durchgereicht (web-routes.js).
 * Ihre Dateien liegen nicht in diesem Verzeichnisbaum, also laesst sich hier
 * weder eine Pruefsumme bilden noch eine Version verantworten.
 */
const DURCHGEREICHT = ["/s3-touch-spielesammlung/"];

function istDurchgereicht(pfad) {
  return DURCHGEREICHT.some((praefix) => pfad.startsWith(praefix));
}

function dateiZuPfad(pfad) {
  const relativ = pfad.replace(/^\//, "");
  const kandidaten = [
    path.join(OEFFENTLICH, relativ),
    path.join(GETEILT, relativ),
    path.join(GETEILT, path.basename(relativ)),
  ];
  return kandidaten.find((k) => fs.existsSync(k)) || null;
}

function pruefsumme(datei) {
  // Zeilenenden vereinheitlichen, sonst meldet dieselbe Datei je nach
  // Auschecken unter Windows und Linux verschiedene Summen.
  const inhalt = fs.readFileSync(datei, "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(inhalt).digest("hex").slice(0, 16);
}

function erfasseVerweise() {
  const verweise = [];
  const ohneVersion = [];
  for (const datei of htmlDateien(OEFFENTLICH)) {
    const quelle = fs.readFileSync(datei, "utf8");
    const herkunft = path.relative(DIENST_WURZEL, datei).replace(/\\/g, "/");
    verweise.push(...verweiseAusHtml(quelle, herkunft));
    ohneVersion.push(...verweiseOhneVersion(quelle, herkunft));
  }
  const ladeSteuerung = path.join(OEFFENTLICH, "app", "app-shell-controller.js");
  if (fs.existsSync(ladeSteuerung)) {
    verweise.push(...verweiseAusJavaScript(fs.readFileSync(ladeSteuerung, "utf8"), "public/app/app-shell-controller.js"));
  }
  return { verweise, ohneVersion };
}

/* Verweise zu einem Bestand je Datei verdichten und Widersprueche melden. */
function bestandAusVerweisen(verweise) {
  const bestand = new Map();
  const widersprueche = [];
  for (const v of verweise) {
    const vorhanden = bestand.get(v.pfad);
    if (!vorhanden) {
      bestand.set(v.pfad, { version: v.version, herkunft: [v.herkunft] });
      continue;
    }
    vorhanden.herkunft.push(v.herkunft);
    if (vorhanden.version !== v.version) {
      widersprueche.push({ pfad: v.pfad, versionen: [vorhanden.version, v.version], herkunft: vorhanden.herkunft });
    }
  }
  return { bestand, widersprueche };
}

function ermittleStand() {
  const { verweise, ohneVersion } = erfasseVerweise();
  const { bestand, widersprueche } = bestandAusVerweisen(verweise);
  const eintraege = {};
  const fehlend = [];
  for (const [pfad, angabe] of [...bestand.entries()].sort()) {
    if (istDurchgereicht(pfad)) continue;
    const datei = dateiZuPfad(pfad);
    if (!datei) { fehlend.push(pfad); continue; }
    eintraege[pfad] = { version: angabe.version, pruefsumme: pruefsumme(datei) };
  }
  return {
    eintraege,
    widersprueche: widersprueche.filter((w) => !istDurchgereicht(w.pfad)),
    fehlend,
    ohneVersion: ohneVersion.filter((o) => !istDurchgereicht(o.pfad)),
  };
}

function liesManifest() {
  if (!fs.existsSync(MANIFEST)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

module.exports = { ermittleStand, liesManifest, MANIFEST, DIENST_WURZEL };
