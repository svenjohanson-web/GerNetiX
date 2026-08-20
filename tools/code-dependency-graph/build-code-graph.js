#!/usr/bin/env node
/*
 * Abhaengigkeitsgraph der klassischen Browser-Skripte.
 *
 * Bewusst eine eigene Datenbank, getrennt vom fachlichen Graphen in
 * tools/yaml-graph-sqlite. Dort stehen Requirements, Entscheidungen und
 * Nachweise -- also warum etwas existiert. Hier steht, welche Datei an
 * welcher haengt. Zwei Abstraktionsebenen, die sich nicht vermischen sollen.
 *
 * Befehle:
 *   build              Graph neu aufbauen
 *   summary            Kennzahlen
 *   outgoing <datei>   wovon die Datei abhaengt
 *   incoming <datei>   wer von der Datei abhaengt
 *   isolated           Dateien, von denen niemand abhaengt
 *   order              Vorschlag fuer die Umstellungsreihenfolge
 *   cycles             gegenseitige Abhaengigkeiten
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { analysiereDatei } = require("./src/analyse");
const { OEFFENTLICH: QUELLE, browserDateien } = require("./src/quellen");

const WURZEL = path.join(__dirname, "..", "..");
const DB_PFAD = path.join(__dirname, "out", "code-graph.sqlite");

/*
 * Erfasst wird der gesamte oeffentliche Baum, nicht nur public/app.
 *
 * Eine erste Fassung sah nur public/app an. Das haette beim Umstellen auf
 * ES-Module in die Irre gefuehrt: unified-flash-dialog.js gilt dort als
 * abhaengigkeitsfrei, wird aber auch von /flashbox-einrichten/ und den
 * Nachbauprojekt-Seiten geladen. Deren Skripte liegen ausserhalb von
 * public/app und benutzen die Globalen dieser Datei sehr wohl.
 */

function ladeAcorn() {
  // acorn liegt als Abhaengigkeit von terser bereits im Baum. Es wird nur
  // beim Bauen des Graphen gebraucht, nie zur Laufzeit eines Dienstes --
  // deshalb keine zusaetzliche Abhaengigkeit fuer das Projekt.
  const kandidat = path.join(WURZEL, "services", "identity-server", "node_modules", "acorn");
  try {
    return require(kandidat);
  } catch {
    try { return require("acorn"); } catch { /* faellt unten durch */ }
  }
  throw new Error(
    "acorn nicht gefunden. Erwartet unter services/identity-server/node_modules/acorn.\n" +
    "Abhilfe: npm install --prefix services/identity-server",
  );
}

const quellDateien = browserDateien;

function baue() {
  const acorn = ladeAcorn();
  fs.mkdirSync(path.dirname(DB_PFAD), { recursive: true });
  if (fs.existsSync(DB_PFAD)) fs.rmSync(DB_PFAD);
  const db = new DatabaseSync(DB_PFAD);
  db.exec(`
    CREATE TABLE dateien (
      name TEXT PRIMARY KEY,
      groesse_bytes INTEGER NOT NULL,
      deklarierte_namen INTEGER NOT NULL,
      freie_namen INTEGER NOT NULL
    );
    CREATE TABLE globale_namen (
      name TEXT NOT NULL,
      datei TEXT NOT NULL REFERENCES dateien(name),
      PRIMARY KEY (name, datei)
    );
    CREATE TABLE kanten (
      von TEXT NOT NULL REFERENCES dateien(name),
      nach TEXT NOT NULL REFERENCES dateien(name),
      name TEXT NOT NULL,
      verwendungen INTEGER NOT NULL,
      PRIMARY KEY (von, nach, name)
    );
    CREATE TABLE ungeloest (
      datei TEXT NOT NULL REFERENCES dateien(name),
      name TEXT NOT NULL,
      verwendungen INTEGER NOT NULL,
      PRIMARY KEY (datei, name)
    );
    /*
     * Weiche Kanten: der Nutzer faengt das Fehlen selbst ab, etwa mit
     * typeof X === "undefined" ? {} : X. Fuer Zyklen zaehlen sie nicht -- der
     * Aufrufer kommt ohne aus. Fuer die Frage, ob eine Datei zum Modul werden
     * darf, zaehlen sie sehr wohl: als Modul verschwaende ihr Name, der
     * Rueckfall griffe, und die Anwendung liefe stillschweigend mit weniger
     * Inhalt weiter. Genau das drohte bei knowledge-chapter-index.js.
     */
    CREATE TABLE weiche_kanten (
      von TEXT NOT NULL REFERENCES dateien(name),
      nach TEXT NOT NULL REFERENCES dateien(name),
      name TEXT NOT NULL,
      verwendungen INTEGER NOT NULL,
      PRIMARY KEY (von, nach, name)
    );
  `);

  const dateien = quellDateien();
  const analysen = new Map();
  const fehler = [];

  for (const name of dateien) {
    const quelltext = fs.readFileSync(path.join(QUELLE, name), "utf8");
    let ast;
    try {
      ast = acorn.parse(quelltext, { ecmaVersion: 2024, sourceType: "script" });
    } catch (problem) {
      fehler.push(`${name}: ${problem.message}`);
      continue;
    }
    analysen.set(name, { ...analysiereDatei(ast), groesse: Buffer.byteLength(quelltext) });
  }

  if (fehler.length > 0) {
    console.error("Nicht auswertbare Dateien:");
    for (const f of fehler) console.error(`  ${f}`);
    process.exitCode = 1;
  }

  const herkunft = new Map(); // name -> datei
  for (const [datei, a] of analysen) {
    for (const name of a.deklariert) if (!herkunft.has(name)) herkunft.set(name, datei);
  }

  const einfuegenDatei = db.prepare("INSERT INTO dateien VALUES (?, ?, ?, ?)");
  const einfuegenName = db.prepare("INSERT OR IGNORE INTO globale_namen VALUES (?, ?)");
  const einfuegenKante = db.prepare("INSERT OR IGNORE INTO kanten VALUES (?, ?, ?, ?)");
  const einfuegenOffen = db.prepare("INSERT OR IGNORE INTO ungeloest VALUES (?, ?, ?)");

  for (const [datei, a] of analysen) einfuegenDatei.run(datei, a.groesse, a.deklariert.size, a.frei.size);
  for (const [datei, a] of analysen) for (const name of a.deklariert) einfuegenName.run(name, datei);

  const einfuegenWeich = db.prepare("INSERT OR IGNORE INTO weiche_kanten VALUES (?, ?, ?, ?)");

  for (const [datei, a] of analysen) {
    for (const [name, anzahl] of a.frei) {
      const ziel = herkunft.get(name);
      if (ziel && ziel !== datei) einfuegenKante.run(datei, ziel, name, anzahl);
      else if (!ziel) einfuegenOffen.run(datei, name, anzahl);
    }
    for (const [name, anzahl] of a.weich || []) {
      const ziel = herkunft.get(name);
      if (ziel && ziel !== datei) einfuegenWeich.run(datei, ziel, name, anzahl);
    }
  }

  db.close();
  return { dateien: analysen.size, nichtLesbar: fehler.length };
}

function oeffne() {
  if (!fs.existsSync(DB_PFAD)) { baue(); }
  return new DatabaseSync(DB_PFAD, { readOnly: true });
}

function zeige(zeilen) { console.log(JSON.stringify(zeilen, null, 2)); }

function kantenAlsKarte(db) {
  const karte = new Map();
  for (const z of db.prepare("SELECT von, nach FROM kanten GROUP BY von, nach").all()) {
    if (!karte.has(z.von)) karte.set(z.von, new Set());
    karte.get(z.von).add(z.nach);
  }
  return karte;
}

function befehlOrder(db) {
  // Wer von niemandem gebraucht wird, kann zuerst umgestellt werden: eine
  // Moduldatei darf Globale weiter lesen, aber ihre eigenen Namen sind fuer
  // klassische Skripte nicht mehr sichtbar.
  const alle = db.prepare("SELECT name FROM dateien ORDER BY name").all().map((z) => z.name);
  const nach = kantenAlsKarte(db);
  const eingehend = new Map(alle.map((d) => [d, 0]));
  for (const [, ziele] of nach) for (const z of ziele) eingehend.set(z, (eingehend.get(z) || 0) + 1);

  const offen = new Set(alle);
  const stufen = [];
  while (offen.size > 0) {
    const stufe = [...offen].filter((d) => {
      for (const anderer of offen) {
        if (anderer === d) continue;
        if (nach.get(anderer)?.has(d)) return false;
      }
      return true;
    });
    if (stufe.length === 0) { stufen.push({ stufe: stufen.length + 1, hinweis: "gegenseitig abhaengig", dateien: [...offen].sort() }); break; }
    stufen.push({ stufe: stufens(stufen), dateien: stufe.sort() });
    for (const d of stufe) offen.delete(d);
  }
  return stufen;
}
function stufens(stufen) { return stufen.length + 1; }

function befehlCycles(db) {
  const nach = kantenAlsKarte(db);
  const paare = [];
  for (const [von, ziele] of nach) {
    for (const ziel of ziele) {
      if (von < ziel && nach.get(ziel)?.has(von)) paare.push({ a: von, b: ziel });
    }
  }
  return paare;
}

const befehl = process.argv[2] || "build";
const argument = process.argv[3];

if (befehl === "build") {
  const ergebnis = baue();
  const db = new DatabaseSync(DB_PFAD, { readOnly: true });
  const z = (sql) => db.prepare(sql).get().n;
  zeige({
    datenbank: path.relative(WURZEL, DB_PFAD).replace(/\\/g, "/"),
    dateien: ergebnis.dateien,
    nicht_lesbar: ergebnis.nichtLesbar,
    globale_namen: z("SELECT COUNT(*) AS n FROM globale_namen"),
    kanten: z("SELECT COUNT(*) AS n FROM kanten"),
    dateipaare: z("SELECT COUNT(*) AS n FROM (SELECT 1 FROM kanten GROUP BY von, nach)"),
    ungeloeste_namen: z("SELECT COUNT(*) AS n FROM ungeloest"),
  });
  db.close();
} else {
  const db = oeffne();
  if (befehl === "summary") {
    const z = (sql) => db.prepare(sql).get().n;
    zeige({
      dateien: z("SELECT COUNT(*) AS n FROM dateien"),
      globale_namen: z("SELECT COUNT(*) AS n FROM globale_namen"),
      kanten: z("SELECT COUNT(*) AS n FROM kanten"),
      dateipaare: z("SELECT COUNT(*) AS n FROM (SELECT 1 FROM kanten GROUP BY von, nach)"),
      gegenseitig: befehlCycles(db).length,
    });
  } else if (befehl === "outgoing") {
    zeige(db.prepare("SELECT nach AS datei, COUNT(*) AS namen, GROUP_CONCAT(name, ', ') AS bezeichner FROM kanten WHERE von = ? GROUP BY nach ORDER BY namen DESC").all(argument));
  } else if (befehl === "incoming") {
    zeige(db.prepare("SELECT von AS datei, COUNT(*) AS namen, GROUP_CONCAT(name, ', ') AS bezeichner FROM kanten WHERE nach = ? GROUP BY von ORDER BY namen DESC").all(argument));
  } else if (befehl === "isolated") {
    /*
     * Weiche Kanten schliessen ebenso aus. Eine Datei, deren Name nur
     * typeof-abgesichert gelesen wird, darf trotzdem kein Modul werden: der
     * Rueckfall des Lesers greift dann klaglos, und der Verlust faellt erst
     * beim Benutzer auf.
     */
    zeige(db.prepare(`
      SELECT d.name, d.groesse_bytes,
             (SELECT COUNT(*) FROM weiche_kanten w WHERE w.nach = d.name) AS weiche_nutzer
      FROM dateien d
      WHERE d.name NOT IN (SELECT nach FROM kanten)
        AND d.name NOT IN (SELECT nach FROM weiche_kanten)
      ORDER BY d.groesse_bytes
    `).all());
  } else if (befehl === "order") {
    zeige(befehlOrder(db));
  } else if (befehl === "cycles") {
    zeige(befehlCycles(db));
  } else {
    console.error(`Unbekannter Befehl: ${befehl}`);
    process.exitCode = 1;
  }
  db.close();
}
