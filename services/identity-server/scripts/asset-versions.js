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

/*
 * Die Route-Pakete beziehen ihre Version aus einer gemeinsamen Tabelle:
 * loadPlatformScript(`/app/x.js?v=${lazyAssetVersions.flashDialog}`).
 *
 * Diese Form kannte die Erfassung nicht. Elf nachgeladene Dateien standen
 * damit ueberhaupt nicht unter Versionskontrolle -- weder wurde ein Wechsel
 * ihres Inhalts bemerkt, noch liess sich ihre Version anheben. Die Tabelle
 * wird darum ausgelesen.
 */
function lazyVersionsTabelle(quelle) {
  const block = quelle.match(/const lazyAssetVersions = \{([\s\S]*?)\n\};/);
  if (!block) return {};
  const tabelle = {};
  for (const t of block[1].matchAll(/(\w+):\s*"([^"]+)"/g)) tabelle[t[1]] = t[2];
  return tabelle;
}

/*
 * Der Aufruf kann ein zweites Argument tragen -- loadPlatformScript(src,
 * { module: true }) fuer nachgeladene ES-Module. Die Muster duerfen darum
 * nicht auf die schliessende Klammer direkt hinter der Adresse bestehen.
 * Taten sie es, verschwanden genau die umgestellten Dateien aus der
 * Erfassung, und ihre Cache-Version wurde nie wieder angehoben.
 */
function verweiseAusJavaScript(quelle, herkunft) {
  const verweise = [];
  for (const t of quelle.matchAll(/loadPlatform(?:Script|Style)\("(\/[^"?]+\.(?:js|css))\?v=([^"]+)"\s*[,)]/g)) {
    verweise.push({ pfad: t[1], version: t[2], herkunft });
  }
  for (const t of quelle.matchAll(/loadPlatform(?:Script|Style)\(`(\/[^`?]+\.(?:js|css))\?v=\$\{version\}`\s*[,)]/g)) {
    const version = versionVorPosition(quelle, t.index);
    if (version) verweise.push({ pfad: t[1], version, herkunft });
  }
  const tabelle = lazyVersionsTabelle(quelle);
  for (const t of quelle.matchAll(/loadPlatform(?:Script|Style)\(`(\/[^`?]+\.(?:js|css))\?v=\$\{lazyAssetVersions\.(\w+)\}`\s*[,)]/g)) {
    const version = tabelle[t[2]];
    if (version) verweise.push({ pfad: t[1], version, herkunft });
  }
  /*
   * Das Wissensportal bildet seine Adressen aus einer Liste:
   *   ["a.js", "b.js"].map((file) => `/app/${file}?v=${version}`)
   * Auch das ist ein Verweis. Ohne diese Form standen die beiden Dateien
   * ausserhalb der Versionsverwaltung.
   */
  for (const t of quelle.matchAll(/\[([^\]]*?\.js"[^\]]*?)\]\.map\(\(\w+\) => `(\/[^`$]*)\$\{\w+\}\?v=\$\{version\}`\)/g)) {
    const version = versionVorPosition(quelle, t.index);
    if (!version) continue;
    for (const name of t[1].matchAll(/"([^"]+\.js)"/g)) {
      verweise.push({ pfad: `${t[2]}${name[1]}`, version, herkunft });
    }
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
  /*
   * landing.js laedt die Uebersetzung auf jeder oeffentlichen Seite selbst
   * nach -- mit einer eigenen, fest eingetragenen Version. Sie war nicht
   * erfasst und wich vom Dokument ab, ohne dass es auffiel. Fuer den Browser
   * sind zwei Adressen zwei Module: die Datei waere zweimal ausgewertet
   * worden.
   */
  const startseite = path.join(OEFFENTLICH, "landing.js");
  if (fs.existsSync(startseite)) {
    const quelle = fs.readFileSync(startseite, "utf8");
    for (const t of quelle.matchAll(/script\.src = "(\/[^"?]+\.js)\?v=([^"]+)"/g)) {
      verweise.push({ pfad: t[1], version: t[2], herkunft: "public/landing.js" });
    }
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
    /*
     * Eine Datei ohne Eintrag war bisher nicht erfasst. Ob die ausgelieferte
     * Version zu ihrem Inhalt passt, laesst sich dann nicht sagen -- also wird
     * sie einmal angehoben. Das kostet einen Abruf und beendet die Ungewissheit.
     */
    if (!alt) betroffen.add(pfad);
  }
  if (betroffen.size === 0) return { angehoben: [], konstanten: [] };

  const angehoben = new Set();
  const konstanten = new Set();
  // Getrennt gefuehrt: ein Verweis, der die Zielversion schon traegt, ist
  // gefunden, aber nicht angehoben. Nur ein gar nicht gefundener ist ein Fehler.
  const gefunden = new Set();

  const bearbeite = (datei, istLadeSteuerung) => {
    const roh = fs.readFileSync(datei, "utf8");
    let quelle = roh;
    for (const pfad of betroffen) {
      const maskiert = pfad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      /*
       * Nur ausgeschriebene Versionen. Ein Platzhalter darf hier nicht
       * hineingeraten: er wuerde durch einen festen Wert ersetzt, die Datei
       * verlore ihren Anschluss an die gemeinsame Tabelle, und ab dann
       * traegt sie an einer Stelle eine andere Version als an den anderen.
       */
      const direkt = new RegExp(`(["'\`])${maskiert}\\?v=([^"'\`$]+)\\1`, "g");
      quelle = quelle.replace(direkt, (treffer, anfuehrung, version) => {
        gefunden.add(pfad);
        if (version === neueVersion) return treffer;
        angehoben.add(pfad);
        return `${anfuehrung}${pfad}?v=${neueVersion}${anfuehrung}`;
      });
      if (!istLadeSteuerung) continue;

      // Vorlagenform mit lokaler Konstante.
      const vorlage = quelle.match(new RegExp(`${maskiert}\\?v=\\$\\{version\\}`));
      if (vorlage) {
        const alteKonstante = versionVorPosition(quelle, vorlage.index);
        if (alteKonstante && alteKonstante !== neueVersion) {
          quelle = quelle.replace(`const version = "${alteKonstante}"`, `const version = "${neueVersion}"`);
          angehoben.add(pfad);
          gefunden.add(pfad);
          konstanten.add(alteKonstante);
        } else if (alteKonstante) gefunden.add(pfad);
        continue;
      }

      /*
       * Listenform: der Dateiname steht in einem Feld, die Adresse entsteht
       * erst beim Bilden. Angehoben wird die Konstante, die die Liste regiert
       * -- damit ziehen ihre Geschwister mit, was hier richtig ist: sie
       * gehoeren zu derselben Ansicht und muessen zusammen ungueltig werden.
       */
      const name = pfad.split("/").pop().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inListe = quelle.match(new RegExp(`\\[[^\\]]*"${name}"[^\\]]*\\]\\.map\\(\\(\\w+\\) => \`[^\`]*\\?v=\\$\\{version\\}\``));
      if (inListe) {
        const alteKonstante = versionVorPosition(quelle, inListe.index);
        if (alteKonstante) {
          gefunden.add(pfad);
          if (alteKonstante !== neueVersion) {
            quelle = quelle.replace(`const version = "${alteKonstante}"`, `const version = "${neueVersion}"`);
            angehoben.add(pfad);
            konstanten.add(alteKonstante);
          }
        }
        continue;
      }

      // Vorlagenform mit gemeinsamer Tabelle: dort den Eintrag anheben.
      const ausTabelle = quelle.match(new RegExp(`${maskiert}\\?v=\\$\\{lazyAssetVersions\\.(\\w+)\\}`));
      if (!ausTabelle) continue;
      const schluessel = ausTabelle[1];
      const alterWert = lazyVersionsTabelle(quelle)[schluessel];
      if (!alterWert) continue;
      gefunden.add(pfad);
      if (alterWert === neueVersion) continue;
      angehoben.add(pfad);
      quelle = quelle.replace(new RegExp(`(${schluessel}:\\s*)"${alterWert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `$1"${neueVersion}"`);
      konstanten.add(`lazyAssetVersions.${schluessel}`);
    }
    if (quelle !== roh) fs.writeFileSync(datei, quelle, "utf8");
  };

  for (const datei of htmlDateien(OEFFENTLICH)) bearbeite(datei, false);
  const ladeSteuerung = path.join(OEFFENTLICH, "app", "app-shell-controller.js");
  if (fs.existsSync(ladeSteuerung)) bearbeite(ladeSteuerung, true);

  const vergessen = [...betroffen].filter((p) => !gefunden.has(p));
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

/*
 * Welche ausgelieferten Dateien sind Module?
 *
 * Nicht nur die mit type="module" im Dokument: die Haelfte der Plattform wird
 * ueber loadPlatformScript nachgeladen und taucht in index.html gar nicht auf.
 * Wuerde die Map nur die Tags kennen, koennte eine nachgeladene Datei nichts
 * einfuehren -- ihr import fiele auf eine unversionierte Adresse zurueck und
 * legte dasselbe Modul ein zweites Mal an.
 *
 * Entschieden wird darum am Inhalt: eine Datei mit import- oder
 * export-Anweisung ist ein Modul. Das laesst sich nicht vergessen.
 */
function istModulDatei(pfad) {
  const datei = dateiZuPfad(pfad);
  if (!datei) return false;
  return /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m
    .test(fs.readFileSync(datei, "utf8"));
}

/*
 * Welche kurzen Namen werden ueberhaupt eingefuehrt?
 *
 * Die Map traegt nur diese. Ein Eintrag fuer ein Modul, das niemand einfuehrt,
 * hat keine Wirkung -- kostet aber: er fuehrt dessen Adresse ein zweites Mal
 * im Dokument auf, und jede Zusicherung der Art "diese Datei wird erst bei
 * Bedarf geladen" schlaegt dann auf den Map-Eintrag an statt auf ein Skript.
 */
/*
 * Zwei Schreibweisen, weil nicht jedes Modul unter /app/ liegt.
 *
 * Der Kurzname "@app/x.js" deckt die Plattform ab. landing.js liegt in der
 * Wurzel und wird von der Anmeldeseite eingefuehrt; dafuer traegt die Map die
 * Adresse selbst als Schluessel ("/landing.js"). Eine Import Map darf das --
 * ein Schluessel muss kein blosser Name sein -- und das Ergebnis wird nicht
 * erneut abgebildet, es entsteht also keine Schleife.
 */
function moduleSchluessel(pfad) {
  return pfad.startsWith("/app/") ? `@app/${pfad.replace("/app/", "")}` : pfad;
}

function eingefuehrteNamen() {
  const namen = new Set();
  const suche = (verzeichnis) => {
    for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
      const voll = path.join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) { if (eintrag.name !== "node_modules" && eintrag.name !== "dist") suche(voll); }
      else if (eintrag.name.endsWith(".js")) {
        const quelle = fs.readFileSync(voll, "utf8");
        // Beide Formen, und auch das spaete Holen: import("...").
        for (const t of quelle.matchAll(/(?:from|import\()\s*"(@app\/[^"]+|\/[^"]+\.js)"/g)) namen.add(t[1]);
      }
    }
  };
  suche(OEFFENTLICH);
  return namen;
}

function modulPfade() {
  const { verweise } = erfasseVerweise();
  const { bestand } = bestandAusVerweisen(verweise);
  const gebraucht = eingefuehrteNamen();
  const pfade = [];
  for (const [pfad, angabe] of [...bestand.entries()].sort()) {
    if (istDurchgereicht(pfad) || !pfad.endsWith(".js")) continue;
    if (!gebraucht.has(moduleSchluessel(pfad)) || !istModulDatei(pfad)) continue;
    pfade.push({ pfad, version: angabe.version });
  }
  return pfade;
}

function baueImportMap() {
  const eintraege = {};
  for (const { pfad, version } of modulPfade()) {
    eintraege[moduleSchluessel(pfad)] = `${pfad}?v=${version}`;
  }
  const inhalt = JSON.stringify({ imports: eintraege }, null, 6).replace(/\n/g, "\n    ");
  return `${MARKE_START}\n    <script type="importmap">\n    ${inhalt}\n    </script>\n    ${MARKE_ENDE}`;
}

const MARKE_MUSTER = new RegExp(`${MARKE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARKE_ENDE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/*
 * Welche Seiten brauchen die Map?
 *
 * Sie ist die Aufloesungstabelle fuer die kurzen Namen und gilt fuer das
 * Dokument, nicht fuer eine Datei. Gebraucht wird sie, sobald eine Seite ein
 * Modul laedt -- oder ein klassisches Skript, das sich eines spaeter holt.
 * landing.js tut genau das und laeuft auf jeder oeffentlichen Seite.
 */
function seitenMitModulen() {
  return htmlDateien(OEFFENTLICH).filter((datei) => {
    const html = fs.readFileSync(datei, "utf8");
    if (/<script[^>]*type="module"[^>]*src=/.test(html)) return true;
    for (const t of html.matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)) {
      const ziel = t[1].startsWith("/")
        ? path.join(OEFFENTLICH, t[1].slice(1))
        : path.resolve(path.dirname(datei), t[1]);
      if (fs.existsSync(ziel) && /["'`]@app\//.test(fs.readFileSync(ziel, "utf8"))) return true;
    }
    return false;
  });
}

function schreibeImportMap() {
  const block = baueImportMap();
  let geaendert = false;
  for (const datei of seitenMitModulen()) {
    const html = fs.readFileSync(datei, "utf8");
    const neu = MARKE_MUSTER.test(html)
      ? html.replace(MARKE_MUSTER, block)
      // Vor das erste Skript, denn eine Import Map muss vor jedem Modul stehen.
      : html.replace(/([ \t]*)(<script[^>]*src=)/, `$1${block}\n$1$2`);
    if (neu === html) continue;
    fs.writeFileSync(datei, neu, "utf8");
    geaendert = true;
  }
  return geaendert;
}

function pruefeImportMap() {
  const fehlerAlle = [];
  for (const datei of seitenMitModulen()) {
    const wo = path.relative(OEFFENTLICH, datei).replace(/\\/g, "/");
    for (const meldung of pruefeImportMapEiner(fs.readFileSync(datei, "utf8"))) {
      fehlerAlle.push(`${wo}: ${meldung}`);
    }
  }
  return fehlerAlle;
}

function pruefeImportMapEiner(html) {
  const treffer = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (!treffer) return ["Die Import Map fehlt, obwohl Module geladen werden"];
  let karte;
  try { karte = JSON.parse(treffer[1]); } catch (fehler) { return [`Import Map ist kein gueltiges JSON: ${fehler.message}`]; }
  const fehler = [];
  const erwartet = {};
  for (const { pfad, version } of modulPfade()) erwartet[moduleSchluessel(pfad)] = `${pfad}?v=${version}`;
  for (const [name, ziel] of Object.entries(erwartet)) {
    if (karte.imports?.[name] !== ziel) fehler.push(`${name} zeigt auf ${karte.imports?.[name] || "(fehlt)"} statt auf ${ziel}`);
  }
  for (const name of Object.keys(karte.imports || {})) {
    if (!erwartet[name]) fehler.push(`${name} steht in der Map, wird aber nicht mehr als Modul geladen`);
  }
  return fehler;
}

module.exports = { ermittleStand, liesManifest, MANIFEST, DIENST_WURZEL, schreibeImportMap, pruefeImportMap, hebeVersionenAn };


