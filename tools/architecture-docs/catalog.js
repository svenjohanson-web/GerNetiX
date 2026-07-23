const fs = require("node:fs");
const path = require("node:path");

const categories = [
  { id: "start", label: "Einstieg", description: "Zielbild, Prinzipien und Orientierung" },
  { id: "system", label: "Systemarchitektur", description: "Anwendungen, Services, Prozesse und Infrastruktur" },
  { id: "decisions", label: "Entscheidungen", description: "Bestaetigte Entscheidungen aus dem SQLite-Graphen" },
  { id: "model", label: "Metamodell & Traceability", description: "Fachliche Struktur und Nachvollziehbarkeit" },
  { id: "development", label: "Entwicklungsarchitektur", description: "Projekt-, Firmware- und Entwicklungsstrukturen" },
  { id: "operations", label: "Betrieb & Sicherheit", description: "Deployment, Schutz, Backup und Monitoring" },
  { id: "archive", label: "Rekonstruktionsarchiv", description: "Weitere und fruehere Dokumentationsansaetze" },
];

const statusDefinitions = {
  canonical: { label: "Kanonische Graph-Sicht", tone: "canonical" },
  maintained: { label: "Gepflegtes Dokument", tone: "maintained" },
  generated: { label: "Generierte Lesesicht", tone: "generated" },
  reconstructed: { label: "Rekonstruierter Bestand", tone: "reconstructed" },
  superseded: { label: "Abgeloester Ansatz", tone: "superseded" },
};

const curatedDocuments = {
  "docs/architecture-documentation.md": { category: "start", status: "maintained", order: 1 },
  "docs/principles.md": { category: "start", status: "maintained", order: 2 },
  "docs/documentation-strategy.md": { category: "start", status: "maintained", order: 3 },
  "docs/vision-business-goals-customer-journeys.md": { category: "start", status: "maintained", order: 4 },
  "docs/products.md": { category: "start", status: "maintained", order: 5 },
  "docs/domains.md": { category: "start", status: "maintained", order: 6 },

  "docs/system-process-application-uml.md": { category: "system", status: "maintained", order: 1 },
  "docs/process-start-overview.md": { category: "system", status: "maintained", order: 2 },
  "docs/provisioning-process-sequence-uml.md": { category: "system", status: "maintained", order: 3 },
  "docs/ota-build-flash-sequence.md": { category: "system", status: "maintained", order: 4 },
  "docs/vps-docker-deployment.md": { category: "system", status: "maintained", order: 5 },
  "docs/persistence-and-asset-storage.md": { category: "system", status: "maintained", order: 6 },
  "docs/generated/architecture-view.md": { category: "system", status: "generated", order: 7 },

  "docs/metamodel.md": { category: "model", status: "maintained", order: 1 },
  "docs/metamodel-learning-platform.md": { category: "model", status: "maintained", order: 2 },
  "docs/traceability.md": { category: "model", status: "maintained", order: 3 },
  "docs/generated/traceability-overview.md": { category: "model", status: "generated", order: 4 },
  "docs/generated/sqlite-graph-validation.md": { category: "model", status: "generated", order: 5 },
  "docs/generated/open-gaps.md": { category: "model", status: "generated", order: 6 },
  "tools/yaml-graph-sqlite/README.md": { category: "model", status: "maintained", order: 7 },
  "tools/sqlite-graph-explorer/README.md": { category: "model", status: "maintained", order: 8 },

  "docs/development-path-architecture-first.md": { category: "development", status: "maintained", order: 1 },
  "docs/project-idea-data-model.md": { category: "development", status: "maintained", order: 2 },
  "docs/firmware-project-structure.md": { category: "development", status: "maintained", order: 3 },
  "docs/incremental-build-strategy.md": { category: "development", status: "maintained", order: 4 },
  "docs/fast-embedded-firmware-feedback.md": { category: "development", status: "maintained", order: 5 },

  "docs/audit-security-legal-views.md": { category: "operations", status: "maintained", order: 1 },
  "docs/security-posture.md": { category: "operations", status: "maintained", order: 2 },
  "docs/customer-data-backup-and-recovery.md": { category: "operations", status: "maintained", order: 3 },
  "docs/codex-staging-deployment.md": { category: "operations", status: "maintained", order: 4 },
  "docs/register-and-pairing-concept.md": { category: "operations", status: "maintained", order: 5 },

  "docs/generated/decision-log.md": { category: "archive", status: "generated", order: 10 },
  "docs/yaml-first-repository-structure.md": { category: "archive", status: "superseded", order: 90 },
};

const diagramDocuments = [
  {
    id: "diagram-system-landscape",
    title: "System-, Prozess- und Applikationslandschaft",
    category: "system",
    status: "maintained",
    order: 0,
    sourcePath: "docs/system-process-application-uml.svg",
    summary: "Aktuelle Anwendungen, Services, Laufzeitprozesse und Abhaengigkeiten.",
  },
  {
    id: "diagram-process-ports",
    title: "Prozesse und Ports",
    category: "system",
    status: "maintained",
    order: 1,
    sourcePath: "docs/process-port-overview.svg",
    summary: "Portbelegung der lokalen GerNetiX-Prozesse.",
  },
  {
    id: "diagram-vps-topology",
    title: "VPS-Docker-Topologie",
    category: "system",
    status: "maintained",
    order: 2,
    sourcePath: "docs/vps-docker-topology.svg",
    summary: "Container, Netze und externe Zugaenge auf dem VPS.",
  },
  {
    id: "diagram-provisioning-sequence",
    title: "Provisioning-Sequenz",
    category: "system",
    status: "maintained",
    order: 3,
    sourcePath: "docs/provisioning-process-sequence-uml.svg",
    summary: "Sequenz vom Erkennen eines Boards bis zu Registrierung und Pairing.",
  },
];

function discoverMarkdownDocuments(repoRoot) {
  const root = path.join(repoRoot, "docs");
  const files = [
    ...walk(root).filter((file) => file.toLowerCase().endsWith(".md")),
    path.join(repoRoot, "tools", "yaml-graph-sqlite", "README.md"),
    path.join(repoRoot, "tools", "sqlite-graph-explorer", "README.md"),
  ];
  return files.map((file) => {
    const sourcePath = toPosix(path.relative(repoRoot, file));
    const content = fs.readFileSync(file, "utf8");
    const curated = curatedDocuments[sourcePath] || {};
    return {
      id: documentId(sourcePath),
      title: firstHeading(content) || path.basename(file, ".md"),
      category: curated.category || "archive",
      status: curated.status || (sourcePath.startsWith("docs/generated/") ? "generated" : "reconstructed"),
      order: curated.order ?? 999,
      sourcePath,
      summary: firstParagraph(content),
      content,
    };
  });
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function firstHeading(content) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
}

function firstParagraph(content) {
  return content
    .replace(/^#.*$/gm, "")
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.replace(/\r?\n/g, " ").trim())
    .find((part) => part && !part.startsWith("-") && !part.startsWith("```") && !part.startsWith("|")) || "";
}

function documentId(sourcePath) {
  return sourcePath
    .replace(/^docs\//, "")
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  categories,
  diagramDocuments,
  discoverMarkdownDocuments,
  statusDefinitions,
};
