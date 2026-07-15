const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  categories,
  diagramDocuments,
  discoverMarkdownDocuments,
  statusDefinitions,
} = require("./catalog");

const toolRoot = __dirname;
const repoRoot = path.resolve(toolRoot, "..", "..");
const sourceRoot = path.join(toolRoot, "src");
const outputRoot = path.join(toolRoot, "dist");
const graphPath = path.join(repoRoot, "tools", "yaml-graph-sqlite", "out", "model-graph.sqlite");

function build() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const markdownDocuments = discoverMarkdownDocuments(repoRoot);
  const graphDocument = readGraphDecisions(graphPath);
  const diagrams = diagramDocuments.map(diagramDocument);
  const documents = [overviewDocument(markdownDocuments), graphDocument, ...diagrams, ...markdownDocuments]
    .sort(compareDocuments);

  copy("index.html");
  copy("styles.css");
  copy("app.js");
  const payload = { categories, statusDefinitions, documents };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  fs.writeFileSync(path.join(outputRoot, "content.js"), `window.ARCHITECTURE_DOCS = ${json};\n`, "utf8");
  return { outputRoot, documents: documents.length, decisions: graphDocument.decisionCount };
}

function overviewDocument(markdownDocuments) {
  const generated = markdownDocuments.filter((item) => item.status === "generated").length;
  const reconstructed = markdownDocuments.filter((item) => ["reconstructed", "superseded"].includes(item.status)).length;
  return {
    id: "architecture-home",
    title: "Architektur im Ueberblick",
    category: "start",
    status: "maintained",
    order: 0,
    sourcePath: "docs/architecture-documentation.md",
    summary: "Zentraler Einstieg in die GerNetiX-Architekturdokumentation.",
    content: `# GerNetiX Architektur\n\nDiese Offline-Dokumentation fuehrt die vorhandenen Architekturquellen zusammen. Sie ersetzt keine fachliche Quelle, sondern macht deren Rollen und Zusammenhaenge sichtbar.\n\n## Quellenhierarchie\n\n1. **SQLite-Graph** - kanonische fachliche Entscheidungen, Requirements, Artefakte und Beziehungen.\n2. **Gepflegte Dokumente** - lesbarer Kontext, Begruendungen, Betriebs- und Ablaufbeschreibungen.\n3. **Generierte Lesesichten** - aus strukturierten Quellen erzeugte Uebersichten; nicht separat pflegen.\n4. **Rekonstruktionsarchiv** - weitere und fruehere Versuche, die fuer die Nachvollziehbarkeit erhalten bleiben.\n\n## Rekonstruierter Bestand\n\n- ${markdownDocuments.length} Markdown-Dokumente wurden zentral indexiert.\n- ${generated} generierte Lesesichten sind als solche gekennzeichnet.\n- ${reconstructed} weitere oder abgeloeste Ansaetze bleiben im Archiv auffindbar.\n- Die aktuelle Systemlandschaft und weitere zentrale SVG-Diagramme sind direkt eingebunden.\n\n## Empfohlener Einstieg\n\n- [System-, Prozess- und Applikationslandschaft](system-process-application-uml.md)\n- [Architekturentscheidungen aus dem SQLite-Graphen](#/doc/graph-architecture-decisions)\n- [Metamodell](metamodel.md)\n- [Betrieb und Sicherheitsstatus](security-posture.md)\n- [Entwicklungsweg: Architektur zuerst](development-path-architecture-first.md)\n`,
  };
}

function readGraphDecisions(databasePath) {
  if (!fs.existsSync(databasePath)) {
    return graphFallback("Der kanonische SQLite-Graph wurde beim Build nicht gefunden.");
  }
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const decisions = db.prepare(`
      SELECT id, title, status, summary, owner_domain
      FROM artifacts
      WHERE artifact_type_id = 'architecture_decision'
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'approved' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END, title
    `).all();
    const errors = db.prepare("SELECT COUNT(*) AS count FROM validation_errors WHERE severity = 'error'").get().count;
    const content = [
      "# Architekturentscheidungen aus dem SQLite-Graphen",
      "",
      "Diese Seite wird beim Offline-Build direkt aus dem kanonischen SQLite-Graphen erzeugt. Aenderungen werden nicht hier, sondern ueber die Graph-Authoring-Werkzeuge gepflegt.",
      "",
      `**Graph-Status:** ${decisions.length} Architekturentscheidungen, ${errors} Validierungsfehler.`,
      "",
      ...decisions.flatMap((decision) => [
        `## ${decision.title}`,
        "",
        `- ID: \`${decision.id}\``,
        `- Status: **${decision.status || "ohne Status"}**`,
        `- Domaene: ${decision.owner_domain || "nicht zugeordnet"}`,
        "",
        decision.summary || "Keine Zusammenfassung hinterlegt.",
        "",
      ]),
    ].join("\n");
    return {
      id: "graph-architecture-decisions",
      title: "Architekturentscheidungen (Graph)",
      category: "decisions",
      status: "canonical",
      order: 0,
      sourcePath: "tools/yaml-graph-sqlite/out/model-graph.sqlite",
      summary: `${decisions.length} Entscheidungen direkt aus dem kanonischen SQLite-Graphen.`,
      content,
      decisionCount: decisions.length,
    };
  } finally {
    db.close();
  }
}

function graphFallback(message) {
  return {
    id: "graph-architecture-decisions",
    title: "Architekturentscheidungen (Graph)",
    category: "decisions",
    status: "canonical",
    order: 0,
    sourcePath: "tools/yaml-graph-sqlite/out/model-graph.sqlite",
    summary: message,
    content: `# Architekturentscheidungen aus dem SQLite-Graphen\n\n${message}`,
    decisionCount: 0,
  };
}

function diagramDocument(diagram) {
  return {
    ...diagram,
    content: `# ${diagram.title}\n\n${diagram.summary}\n\n![${diagram.title}](${path.basename(diagram.sourcePath)})\n\nQuelle: \`${diagram.sourcePath}\``,
  };
}

function compareDocuments(left, right) {
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  return (categoryOrder.get(left.category) - categoryOrder.get(right.category)) ||
    (left.order - right.order) || left.title.localeCompare(right.title, "de");
}

function copy(fileName) {
  fs.copyFileSync(path.join(sourceRoot, fileName), path.join(outputRoot, fileName));
}

if (require.main === module) {
  const result = build();
  console.log(`Architecture docs built: ${result.documents} documents, ${result.decisions} graph decisions.`);
  console.log(path.join(result.outputRoot, "index.html"));
}

module.exports = { build, readGraphDecisions };
