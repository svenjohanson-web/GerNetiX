const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

class LocalProjectAnalyzer {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
  }

  analyze(context) {
    const findings = [
      ...this.requirementFindings(context),
      ...this.serviceFindings(context),
      ...this.toolFindings(context),
      ...this.projectFileFindings(context),
      ...this.readmeDecisionFindings(context),
      ...this.gitEventFindings(context),
    ];
    return limitByType(findings, {
      requirement: 6,
      decision: 4,
      artifact: 8,
      runtime: 8,
      event: 2,
    }).map((finding) => ({
      ...finding,
      source: finding.source || "local-project-analyzer",
      payload: finding.payload || {},
    }));
  }

  requirementFindings() {
    const requirementDir = path.join(this.rootDir, "data", "requirements");
    return findYamlFiles(requirementDir).flatMap((filePath) => {
      const relativePath = slash(path.relative(this.rootDir, filePath));
      const content = readText(filePath);
      const entries = extractRequirementEntries(content);
      return entries.map((entry) => ({
        type: "requirement",
        title: entry.title,
        summary: `Aus ${relativePath} als Requirement Slice vorgeschlagen.`,
        confidence: entry.id ? 0.74 : 0.58,
        source: relativePath,
        payload: {
          requirement_id: entry.id || "",
          slice_key: slug(entry.title),
          title: entry.title,
          status: "open",
          summary: `Heuristisch aus ${relativePath} erkannt.`,
          evidence: [relativePath],
        },
      }));
    }).slice(0, 24);
  }

  serviceFindings(context) {
    return prioritizeServices(listDirectories(path.join(this.rootDir, "services"))).flatMap((serviceName) => {
      if (serviceName === "shared") return [];
      const servicePath = `services/${serviceName}`;
      const title = serviceTitle(serviceName);
      return {
        type: "runtime",
        title,
        summary: `Runtime-Komponente aus ${servicePath}. Bitte pruefen, ob sie als eigener Projektkontext gefuehrt werden soll.`,
        confidence: 0.88,
        source: servicePath,
        payload: {
          reference_type: "service",
          reference_id: serviceName,
          source_service: serviceName,
          title,
          payload: { path: servicePath },
        },
      };
    }).filter((finding) => finding.payload.reference_id !== "context-manager" || context.scope?.project_id);
  }

  toolFindings() {
    return listDirectories(path.join(this.rootDir, "tools")).map((toolName) => {
      const toolPath = `tools/${toolName}`;
      const title = toolTitle(toolName);
      return {
        type: "artifact",
        title,
        summary: `Tool-Artefakt aus ${toolPath}. Bitte pruefen, ob es dauerhaft zum Projektkontext gehoert.`,
        confidence: 0.78,
        source: toolPath,
        payload: {
          artifact_id: toolName,
          artifact_type: "tool",
          path: toolPath,
          title,
          relation: "supports",
        },
      };
    });
  }

  projectFileFindings() {
    return findProjectFiles(this.rootDir).map((filePath) => {
      const relativePath = slash(path.relative(this.rootDir, filePath));
      return {
        type: "artifact",
        title: relativePath,
        summary: `Projektdatei ${relativePath} beschreibt Build-, Laufzeit- oder Paketkonfiguration.`,
        confidence: 0.76,
        source: relativePath,
        payload: {
          artifact_id: relativePath,
          artifact_type: projectFileType(relativePath),
          path: relativePath,
          title: relativePath,
          relation: "documents",
        },
      };
    });
  }

  readmeDecisionFindings() {
    return findReadmes(this.rootDir).slice(0, 30).flatMap((filePath) => {
      const relativePath = slash(path.relative(this.rootDir, filePath));
      const content = readText(filePath).slice(0, 6000);
      const decisions = [];
      let inCodeFence = false;
      for (const line of content.split(/\r?\n/)) {
        if (/^\s*```/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
        const cleaned = line.replace(/^#+\s*/, "").trim();
        if (!isDecisionCandidateLine(cleaned)) continue;
        if (/(entscheid|decision|single source of truth|sqlite|persistenz|context pack|requirement slice)/i.test(cleaned)) {
          decisions.push({
            type: "decision",
            title: cleaned,
            summary: `Aus ${relativePath} als Architektur- oder Projektentscheidung erkannt.`,
            confidence: 0.67,
            source: relativePath,
            payload: {
              title: cleaned,
              status: "proposed",
              rationale: `Heuristisch aus ${relativePath} erkannt.`,
            },
          });
        }
      }
      return decisions.slice(0, 2);
    });
  }

  gitEventFindings() {
    const commits = gitLog(this.rootDir)
      .filter((message) => !/tamagotchi/i.test(message))
      .slice(0, 5);
    if (!commits.length) return [];
    return commits.map((message) => ({
      type: "event",
      title: message,
      summary: "Git-Commit als moegliches Projekt-Ereignis erkannt. Bitte pruefen, ob es fachlich relevant bleibt.",
      confidence: 0.62,
      source: "git log",
      payload: {
        event_type: "git.commit",
        actor_id: "git",
        payload: { message },
      },
    }));
  }
}

function listDirectories(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function prioritizeServices(serviceNames) {
  const priority = [
    "context-manager",
    "project-server",
    "device-management-server",
    "persistence-server",
    "identity-server",
    "build-deploy-server",
    "provisioning-tool",
    "admin-tool",
  ];
  return [...serviceNames].sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    const leftRank = leftIndex === -1 ? priority.length : leftIndex;
    const rightRank = rightIndex === -1 ? priority.length : rightIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.localeCompare(right);
  });
}

function findProjectFiles(rootDir) {
  const names = new Set(["package.json", "pyproject.toml", "platformio.ini"]);
  const results = [];
  walk(rootDir, (filePath, entry) => {
    if (names.has(entry.name.toLowerCase())) results.push(filePath);
  }, { maxDepth: 3 });
  return results.sort();
}

function findReadmes(rootDir) {
  const results = [];
  walk(rootDir, (filePath, entry) => {
    if (/^readme(\.[a-z0-9_-]+)?\.md$/i.test(entry.name)) results.push(filePath);
  }, { maxDepth: 4 });
  return results.sort();
}

function findYamlFiles(directory) {
  const results = [];
  walk(directory, (filePath, entry) => {
    if (/\.(yaml|yml)$/i.test(entry.name)) results.push(filePath);
  }, { maxDepth: 2 });
  return results.sort();
}

function extractRequirementEntries(content) {
  const entries = [];
  const lines = content.split(/\r?\n/);
  let currentId = "";
  for (const line of lines) {
    const idMatch = line.match(/^\s*-\s*id:\s*["']?([^"']+)["']?\s*$/) || line.match(/^\s*id:\s*["']?([^"']+)["']?\s*$/);
    if (idMatch) currentId = idMatch[1].trim();
    const titleMatch = line.match(/^\s*(title|name):\s*["']?(.+?)["']?\s*$/);
    if (currentId && titleMatch && titleMatch[2].trim().length > 6 && titleMatch[2].trim().length < 180) {
      entries.push({ id: currentId, title: titleMatch[2].trim() });
      currentId = "";
    }
  }
  return entries.filter((entry, index, list) => list.findIndex((candidate) => candidate.title === entry.title) === index);
}

function walk(directory, onFile, options, depth = 0) {
  if (depth > options.maxDepth) return;
  let entries = [];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filePath, onFile, options, depth + 1);
    } else if (entry.isFile()) {
      onFile(filePath, entry);
    }
  }
}

function gitLog(rootDir) {
  try {
    return execFileSync("git", ["log", "--oneline", "-n", "12"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/)
      .map((line) => line.replace(/^[a-f0-9]+\s+/, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function serviceTitle(name) {
  const title = humanize(name);
  if (/\b(Server|Service|Tool)\b$/i.test(title)) return title;
  return `${title} Service`;
}

function toolTitle(name) {
  const title = humanize(name);
  if (/\bTool\b$/i.test(title)) return title;
  return `${title} Tool`;
}

function humanize(value) {
  return String(value).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function projectFileType(relativePath) {
  if (relativePath.endsWith("package.json")) return "node-package";
  if (relativePath.endsWith("pyproject.toml")) return "python-package";
  if (relativePath.endsWith("platformio.ini")) return "firmware-build-config";
  return "project-config";
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function isDecisionCandidateLine(value) {
  if (!value || value.length > 140) return false;
  if (/:$/.test(value)) return false;
  if (/^Entscheidungen\b/i.test(value)) return false;
  if (/^(Persistenz|Konfiguration|API|Architektur|Entwicklungsstand|Tests)$/i.test(value)) return false;
  if (/^Hier werden\b/i.test(value)) return false;
  if (/^Fuehrende Modellentscheidungen\b/i.test(value)) return false;
  if (/\b(vorbereitet fuer|aktivieren .* ueber|aktiviert .* ueber)\b/i.test(value)) return false;
  if (/^[-*`>|]/.test(value)) return false;
  if (/^(cd|npm|node|git|set|copy|curl|Invoke-WebRequest|Start-Process)\b/i.test(value)) return false;
  if (/^\$env:|^https?:\/\//i.test(value)) return false;
  if (/^[A-Z]:\\|^[./]?[\w-]+[\\/][\w./\\-]+$/.test(value)) return false;
  if (/[A-Z]:\\|[\\/][\w.-]+[\\/][\w./\\-]+/.test(value)) return false;
  if (/^[A-Z0-9_]+(_[A-Z0-9]+)+\b/.test(value)) return false;
  if (/[:=]\s*(`?memory`?|`?sqlite`?|`?json`?)/i.test(value)) return false;
  if (!/\b(ist|sind|bleibt|bleiben|wird|werden|ersetzt|speichert|speichern|darf|duerfen|muss|muessen|soll|sollen)\b/i.test(value)) return false;
  return true;
}

function limitByType(findings, limits) {
  const counts = {};
  return findings.filter((finding) => {
    const limit = limits[finding.type] ?? 20;
    counts[finding.type] = counts[finding.type] || 0;
    if (counts[finding.type] >= limit) return false;
    counts[finding.type] += 1;
    return true;
  });
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

module.exports = { LocalProjectAnalyzer };
