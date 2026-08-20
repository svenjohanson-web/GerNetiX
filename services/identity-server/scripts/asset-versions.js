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

/*
 * Cache-Versionen geaenderter Dateien anheben.
 *
 * Der Waechter oben meldet zuverlaessig, wenn sich der Inhalt einer Datei
 * geaendert hat, ohne dass ihre Version stieg. Das Anheben selbst war
 * Handarbeit: den Verweis in index.html suchen, die Zeichenkette tauschen,
 * fuer jede betroffene Datei erneut. Bei einem Umbau, der Dutzende Dateien
 * nacheinander anfasst, ist das die Stelle, an der ein Verweis vergessen wird.
 *
 * Zwei Verweisformen sind zu bedienen. Die haeufige nennt die Version direkt.
 * Die nachgeladenen Route-Dateien beziehen sie ueber eine gemeinsame Konstante;
 * dort wird die Konstante angehoben. Das nimmt die Nachbarn derselben Gruppe
 * mit -- folgenlos, es kostet einen einmaligen Neuabruf.
 */
function hebeVersionenAn(neueVersion) {
  const { eintraege } = ermittleStand();
  const vorher = liesManifest();
  if (!vorher) return { angehoben: [], konstanten: [] };

  const betroffen = new Set();
  for (const [pfad, jetzt] of Object.entries(eintraege)) {
    const alt = vorher.dateien?.[pfad];
    if (alt && alt.pruefsumme !== jetzt.pruefsumme && alt.version === jetzt.version) betroffen.add(pfad);
  }
  if (betroffen.size === 0) return { angehoben: [], konstanten: [] };

  const angehoben = new Set();
  const konstanten = new Set();

  const bearbeite = (datei, istLadeSteuerung) => {
    const roh = fs.readFileSync(datei, "utf8");
    let quelle = roh;
    for (const pfad of betroffen) {
      const maskiert = pfad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const direkt = new RegExp(`(["'\`])${maskiert}\\?v=([^"'\`]+)\\1`, "g");
      quelle = quelle.replace(direkt, (treffer, anfuehrung, version) => {
        if (version === neueVersion) return treffer;
        angehoben.add(pfad);
        return `${anfuehrung}${pfad}?v=${neueVersion}${anfuehrung}`;
      });
      if (!istLadeSteuerung) continue;
      // Vorlagenform: die zustaendige Konstante anheben.
      const vorlage = new RegExp(`${maskiert}\\?v=\\$\\{version\\}`);
      const treffer = quelle.match(vorlage);
      if (!treffer) continue;
      const alteKonstante = versionVorPosition(quelle, treffer.index);
      if (!alteKonstante || alteKonstante === neueVersion) continue;
      quelle = quelle.replace(`const version = "${alteKonstante}"`, `const version = "${neueVersion}"`);
      angehoben.add(pfad);
      konstanten.add(alteKonstante);
    }
    if (quelle !== roh) fs.writeFileSync(datei, quelle, "utf8");
  };

  for (const datei of htmlDateien(OEFFENTLICH)) bearbeite(datei, false);
  const ladeSteuerung = path.join(OEFFENTLICH, "app", "app-shell-controller.js");
  if (fs.existsSync(ladeSteuerung)) bearbeite(ladeSteuerung, true);

  const vergessen = [...betroffen].filter((p) => !angehoben.has(p));
  if (vergessen.length > 0) {
    throw new Error(`Kein Verweis gefunden fuer: ${vergessen.join(", ")}`);
  }
  return { angehoben: [...angehoben].sort(), konstanten: [...konstanten].sort() };
}

/*
 * Import Map fuer die ES-Module der Plattform.
 *
 * Module loesen ihre Bezuege ueber URLs auf. Weil hier jede Datei mit ?v=
 * ausgeliefert wird, wuerde ein import "./api-client.js" eine zweite,
 * unversionierte Kopie laden und dasselbe Modul zweimal anlegen. Die Map
 * bindet einen kurzen Namen an die versionierte Adresse -- an einer Stelle
 * statt in jedem import.
 *
 * Sie wird erzeugt, nicht gepflegt: sonst driftete sie von den Cache-Versionen
 * weg, genau wie es die frueheren Versionspins taten.
 */
const APP_HTML = path.join(OEFFENTLICH, "app", "index.html");
const MARKE_START = "<!-- import-map: erzeugt von scripts/update-asset-versions.js -->";
const MARKE_ENDE = "<!-- /import-map -->";

function modulPfade(html) {
  const pfade = [];
  for (const t of html.matchAll(/<script([^>]*)src="(\/app\/[^"?]+\.js)\?v=([^"]+)"/g)) {
    if (/type="module"/.test(t[1])) pfade.push({ pfad: t[2], version: t[3] });
  }
  return pfade;
}

function baueImportMap(html) {
  const eintraege = {};
  for (const { pfad, version } of modulPfade(html)) {
    eintraege[`@app/${path.basename(pfad)}`] = `${pfad}?v=${version}`;
  }
  const inhalt = JSON.stringify({ imports: eintraege }, null, 6).replace(/\n/g, "\n    ");
  return `${MARKE_START}\n    <script type="importmap">\n    ${inhalt}\n    </script>\n    ${MARKE_ENDE}`;
}

function schreibeImportMap() {
  const html = fs.readFileSync(APP_HTML, "utf8");
  const block = baueImportMap(html);
  const vorhanden = new RegExp(`${MARKE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKE_ENDE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const neu = vorhanden.test(html)
    ? html.replace(vorhanden, block)
    // Vor das erste Skript, denn eine Import Map muss vor jedem Modul stehen.
    : html.replace(/(\n(\s*)<script src="\/app\/initial-view-router)/, `\n$2${block}$1`);
  if (neu === html) return false;
  fs.writeFileSync(APP_HTML, neu, "utf8");
  return true;
}

function pruefeImportMap() {
  const html = fs.readFileSync(APP_HTML, "utf8");
  const treffer = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (!treffer) return ["Die Import Map fehlt, obwohl Module geladen werden"];
  let karte;
  try { karte = JSON.parse(treffer[1]); } catch (fehler) { return [`Import Map ist kein gueltiges JSON: ${fehler.message}`]; }
  const fehler = [];
  const erwartet = {};
  for (const { pfad, version } of modulPfade(html)) erwartet[`@app/${path.basename(pfad)}`] = `${pfad}?v=${version}`;
  for (const [name, ziel] of Object.entries(erwartet)) {
    if (karte.imports?.[name] !== ziel) fehler.push(`${name} zeigt auf ${karte.imports?.[name] || "(fehlt)"} statt auf ${ziel}`);
  }
  for (const name of Object.keys(karte.imports || {})) {
    if (!erwartet[name]) fehler.push(`${name} steht in der Map, wird aber nicht mehr als Modul geladen`);
  }
  return fehler;
}

module.exports = { ermittleStand, liesManifest, MANIFEST, DIENST_WURZEL, schreibeImportMap, pruefeImportMap, hebeVersionenAn };
