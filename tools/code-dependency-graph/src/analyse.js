/*
 * Sichtbarkeitskorrekte Abhaengigkeitsanalyse fuer klassische Browser-Skripte.
 *
 * Die Dateien unter services/identity-server/public/app werden ohne
 * Modulsystem geladen: 26 <script>-Tags, kein type="module". Alles teilt sich
 * einen globalen Namensraum. Eine Abhaengigkeit besteht daher nicht ueber
 * import, sondern dadurch, dass Datei A einen Namen benutzt, den Datei B auf
 * oberster Ebene deklariert.
 *
 * Eine Textsuche reicht dafuer nicht. Sie haelt eine lokale Variable namens
 * "status" fuer eine Verwendung des gleichnamigen Globals und uebersieht
 * umgekehrt Deklarationen der Form window.X = ... . Beides wurde beim ersten
 * Versuch nachgewiesen. Deshalb wird hier der Syntaxbaum ausgewertet und die
 * Sichtbarkeit tatsaechlich aufgeloest.
 */

/* Deklarationsarten und ihre Reichweite:
 *   var, function      -> naechste Funktions- oder Programmebene
 *   let, const, class  -> naechster Block
 *   Parameter          -> Funktionsebene
 *   catch (e)          -> der catch-Block
 */

function neueEbene(art) {
  return { art, namen: new Set() };
}

function deklariere(ebenen, art, name) {
  if (!name) return;
  if (art === "funktion") {
    for (let i = ebenen.length - 1; i >= 0; i -= 1) {
      if (ebenen[i].art === "funktion" || ebenen[i].art === "programm") { ebenen[i].namen.add(name); return; }
    }
    return;
  }
  ebenen[ebenen.length - 1].namen.add(name);
}

/* Muster wie const { a, b: c } = ... oder ([x, ...rest]) => ... */
function namenAusMuster(knoten, sammler) {
  if (!knoten) return;
  switch (knoten.type) {
    case "Identifier": sammler.push(knoten.name); break;
    case "ObjectPattern": for (const p of knoten.properties) namenAusMuster(p.type === "RestElement" ? p.argument : p.value, sammler); break;
    case "ArrayPattern": for (const e of knoten.elements) namenAusMuster(e, sammler); break;
    case "AssignmentPattern": namenAusMuster(knoten.left, sammler); break;
    case "RestElement": namenAusMuster(knoten.argument, sammler); break;
    default: break;
  }
}

function kinder(knoten) {
  const ergebnis = [];
  for (const schluessel of Object.keys(knoten)) {
    if (schluessel === "type" || schluessel === "start" || schluessel === "end" || schluessel === "loc") continue;
    const wert = knoten[schluessel];
    if (Array.isArray(wert)) { for (const e of wert) if (e && typeof e.type === "string") ergebnis.push(e); }
    else if (wert && typeof wert.type === "string") ergebnis.push(wert);
  }
  return ergebnis;
}

/* var und Funktionsdeklarationen steigen bis zur Funktionsebene auf. Dafuer
   wird der Rumpf vorab durchsucht, ohne in geschachtelte Funktionen zu gehen. */
function hebeHoch(knoten, ebenen) {
  for (const kind of kinder(knoten)) {
    if (kind.type === "FunctionDeclaration") { deklariere(ebenen, "funktion", kind.id?.name); continue; }
    if (kind.type === "FunctionExpression" || kind.type === "ArrowFunctionExpression") continue;
    if (kind.type === "VariableDeclaration" && kind.kind === "var") {
      for (const d of kind.declarations) { const n = []; namenAusMuster(d.id, n); for (const name of n) deklariere(ebenen, "funktion", name); }
    }
    hebeHoch(kind, ebenen);
  }
}

const EIGENE_BINDUNGEN = new Set(["this", "arguments", "undefined", "null", "true", "false"]);

/*
 * Die UMD-Verpackung dieses Projekts reicht globalThis als Parameter herein:
 *
 *   (function expose(root, factory) { root.X = factory(); })(globalThis, ...)
 *
 * Zuweisungen an einen solchen Parameter erzeugen ebenfalls Globale. Ohne
 * diese Erkennung galten ProjectAppController und ProjectAppRenderer als
 * nirgends deklariert, obwohl sie zur Laufzeit bereitstehen.
 */
function parameterDerAeusserenVerpackung(ast) {
  const namen = new Set();
  for (const s of ast.body) {
    const ausdruck = s.type === "ExpressionStatement" ? s.expression : null;
    if (!ausdruck || ausdruck.type !== "CallExpression") continue;
    const ziel = ausdruck.callee;
    if (!ziel || (ziel.type !== "FunctionExpression" && ziel.type !== "ArrowFunctionExpression")) continue;
    const reichtGlobalHerein = ausdruck.arguments.some((a) =>
      (a.type === "Identifier" && (a.name === "globalThis" || a.name === "self" || a.name === "window"))
      || a.type === "ThisExpression"
      || (a.type === "ConditionalExpression" && JSON.stringify(a).includes("globalThis")));
    if (!reichtGlobalHerein) continue;
    for (const p of ziel.params) if (p.type === "Identifier") namen.add(p.name);
  }
  return namen;
}

function analysiereDatei(ast) {
  const programmNamen = new Set();
  const frei = new Map(); // name -> Anzahl
  // Namen, deren Fehlen der Quelltext an Ort und Stelle abfaengt.
  const weich = new Map();

  /*
   * Der Schutz durch typeof gilt nur dort, wo er auch steht:
   *
   *   typeof X === "undefined" ? {} : X      -> X ist abgesichert
   *   typeof X !== "undefined" && X.tu()     -> X ist abgesichert
   *
   * Eine erste Fassung erklaerte einen Namen fuer die GANZE Datei zu weich,
   * sobald er irgendwo mit typeof geprueft wurde. Damit verschwand eine echte
   * Abhaengigkeit: app-shell-controller.js prueft GerNetiXHardwareLab einmal
   * in Zeile 238 und ruft es danach an vier Stellen ungeschuetzt auf.
   */
  function geschuetzteNamen(bedingung) {
    const namen = new Set();
    (function suche(knoten) {
      if (!knoten) return;
      if (knoten.type === "UnaryExpression" && knoten.operator === "typeof" && knoten.argument.type === "Identifier") {
        namen.add(knoten.argument.name);
      }
      for (const kind of kinder(knoten)) suche(kind);
    })(bedingung);
    return namen;
  }

  function laufe(knoten, ebenen, geschuetzt = new Set()) {
    if (!knoten) return;

    switch (knoten.type) {
      case "ConditionalExpression": {
        const erweitert = new Set([...geschuetzt, ...geschuetzteNamen(knoten.test)]);
        laufe(knoten.test, ebenen, geschuetzt);
        laufe(knoten.consequent, ebenen, erweitert);
        laufe(knoten.alternate, ebenen, erweitert);
        return;
      }
      case "LogicalExpression": {
        const erweitert = new Set([...geschuetzt, ...geschuetzteNamen(knoten.left)]);
        laufe(knoten.left, ebenen, geschuetzt);
        laufe(knoten.right, ebenen, erweitert);
        return;
      }
      case "IfStatement": {
        const erweitert = new Set([...geschuetzt, ...geschuetzteNamen(knoten.test)]);
        laufe(knoten.test, ebenen, geschuetzt);
        laufe(knoten.consequent, ebenen, erweitert);
        laufe(knoten.alternate, ebenen, erweitert);
        return;
      }
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        if (knoten.type === "FunctionExpression" && knoten.id) {
          // Der eigene Name einer benannten Funktionsausdrucks ist innen sichtbar.
          ebenen = [...ebenen, neueEbene("block")];
          ebenen[ebenen.length - 1].namen.add(knoten.id.name);
        }
        const innen = [...ebenen, neueEbene("funktion")];
        for (const p of knoten.params) { const n = []; namenAusMuster(p, n); for (const name of n) deklariere(innen, "funktion", name); }
        hebeHoch(knoten.body, innen);
        // Vorgabewerte der Parameter werden im inneren Bereich ausgewertet.
        for (const p of knoten.params) if (p.type === "AssignmentPattern") laufe(p.right, innen, geschuetzt);
        laufe(knoten.body, innen, geschuetzt);
        return;
      }
      case "BlockStatement":
      case "StaticBlock": {
        const innen = [...ebenen, neueEbene("block")];
        for (const s of knoten.body) {
          if (s.type === "FunctionDeclaration") deklariere(innen, "block", s.id?.name);
          if (s.type === "ClassDeclaration") deklariere(innen, "block", s.id?.name);
          if (s.type === "VariableDeclaration" && s.kind !== "var") {
            for (const d of s.declarations) { const n = []; namenAusMuster(d.id, n); for (const name of n) deklariere(innen, "block", name); }
          }
        }
        for (const s of knoten.body) laufe(s, innen, geschuetzt);
        return;
      }
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const innen = [...ebenen, neueEbene("block")];
        const kopf = knoten.init || knoten.left;
        if (kopf && kopf.type === "VariableDeclaration" && kopf.kind !== "var") {
          for (const d of kopf.declarations) { const n = []; namenAusMuster(d.id, n); for (const name of n) deklariere(innen, "block", name); }
        }
        for (const kind of kinder(knoten)) laufe(kind, innen, geschuetzt);
        return;
      }
      case "CatchClause": {
        const innen = [...ebenen, neueEbene("block")];
        if (knoten.param) { const n = []; namenAusMuster(knoten.param, n); for (const name of n) deklariere(innen, "block", name); }
        laufe(knoten.body, innen, geschuetzt);
        return;
      }
      case "MemberExpression": {
        /*
         * window.X und globalThis.X sind vollwertige Verweise auf das Global X,
         * auch wenn sie syntaktisch ein Eigenschaftszugriff sind. Ohne diese
         * Behandlung blieb die Abhaengigkeit unsichtbar, mit der drei Dateien
         * ueber window.GerNetiXFlashDialog am Flash-Dialog haengen.
         */
        if (!knoten.computed && knoten.object.type === "Identifier"
          && ["window", "globalThis", "self"].includes(knoten.object.name)
          && knoten.property.type === "Identifier") {
          verweis(knoten.property.name, ebenen, geschuetzt, true);
          return;
        }
        laufe(knoten.object, ebenen, geschuetzt);
        if (knoten.computed) laufe(knoten.property, ebenen, geschuetzt);
        return;
      }
      case "Property": {
        if (knoten.computed) laufe(knoten.key, ebenen, geschuetzt);
        laufe(knoten.value, ebenen, geschuetzt);
        return;
      }
      case "MethodDefinition":
      case "PropertyDefinition": {
        if (knoten.computed) laufe(knoten.key, ebenen, geschuetzt);
        laufe(knoten.value, ebenen, geschuetzt);
        return;
      }
      case "AssignmentExpression": {
        // Die linke Seite von window.X = ... ist eine Deklaration, kein Verweis.
        const istGlobalZuweisung = knoten.left.type === "MemberExpression" && !knoten.left.computed
          && knoten.left.object.type === "Identifier"
          && ["window", "globalThis", "self"].includes(knoten.left.object.name);
        if (!istGlobalZuweisung) laufe(knoten.left, ebenen, geschuetzt);
        laufe(knoten.right, ebenen, geschuetzt);
        return;
      }
      case "UnaryExpression": {
        if (knoten.operator === "typeof" && knoten.argument.type === "Identifier") {
          // Ein blankes typeof wirft nie, auch nicht bei unbekanntem Namen.
          verweis(knoten.argument.name, ebenen, geschuetzt, false, true);
          return;
        }
        laufe(knoten.argument, ebenen, geschuetzt);
        return;
      }
      case "LabeledStatement": { laufe(knoten.body, ebenen, geschuetzt); return; }
      case "BreakStatement":
      case "ContinueStatement": return;
      case "Identifier": {
        verweis(knoten.name, ebenen, geschuetzt);
        return;
      }
      default: break;
    }

    for (const kind of kinder(knoten)) laufe(kind, ebenen, geschuetzt);
  }

  function verweis(name, ebenen, geschuetzt, ueberGlobalObjekt = false, durchTypeof = false) {
    if (EIGENE_BINDUNGEN.has(name)) return;
    // Ein Zugriff ueber window.X umgeht die oertliche Sichtbarkeit bewusst.
    if (!ueberGlobalObjekt) {
      for (let i = ebenen.length - 1; i >= 0; i -= 1) if (ebenen[i].namen.has(name)) return;
    }
    if (durchTypeof || geschuetzt.has(name)) { weich.set(name, (weich.get(name) || 0) + 1); return; }
    frei.set(name, (frei.get(name) || 0) + 1);
  }

  // Programmebene vorbereiten
  const programm = neueEbene("programm");
  const ebenen = [programm];
  for (const s of ast.body) {
    if (s.type === "FunctionDeclaration") deklariere(ebenen, "funktion", s.id?.name);
    if (s.type === "ClassDeclaration") deklariere(ebenen, "block", s.id?.name);
    if (s.type === "VariableDeclaration") {
      for (const d of s.declarations) { const n = []; namenAusMuster(d.id, n); for (const name of n) deklariere(ebenen, s.kind === "var" ? "funktion" : "block", name); }
    }
  }
  hebeHoch(ast, ebenen);
  for (const name of programm.namen) programmNamen.add(name);

  // Zuweisungen an window.X / globalThis.X erzeugen ebenfalls Globale --
  // ebenso an den Parameter, ueber den die UMD-Verpackung globalThis erhaelt.
  const globalTraeger = new Set(["window", "globalThis", "self", ...parameterDerAeusserenVerpackung(ast)]);
  (function sucheGlobalZuweisungen(knoten) {
    if (!knoten) return;
    if (knoten.type === "AssignmentExpression" && knoten.left.type === "MemberExpression" && !knoten.left.computed
      && knoten.left.object.type === "Identifier" && globalTraeger.has(knoten.left.object.name)
      && knoten.left.property.type === "Identifier") {
      programmNamen.add(knoten.left.property.name);
    }
    for (const kind of kinder(knoten)) sucheGlobalZuweisungen(kind);
  })(ast);

  for (const s of ast.body) laufe(s, ebenen);

  // Namen, die die Datei selbst deklariert, sind nicht frei.
  for (const name of programmNamen) { frei.delete(name); weich.delete(name); }

  return { deklariert: programmNamen, frei, weich };
}

module.exports = { analysiereDatei };
